"""
Change Order Routes
-------------------
Unexpected work discovered in the field.

  POST /api/change-orders/{job_id}              — create change order
  GET  /api/change-orders/{job_id}              — list change orders for a job
  POST /api/change-orders/{co_id}/approve       — customer approves
  POST /api/change-orders/{co_id}/decline       — customer declines
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models.supply_and_field import ChangeOrder, ChangeOrderStatus
from app.models.job import Job

router = APIRouter()


class ChangeOrderCreate(BaseModel):
    description: str
    additional_items: Optional[str] = None
    additional_price: Optional[float] = None


@router.post("/{job_id}")
async def create_change_order(
    job_id: str,
    data: ChangeOrderCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a change order for a job. Marcus submits from the field."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get next CO number for this job
    count_result = await db.execute(
        select(func.count(ChangeOrder.id)).where(
            ChangeOrder.job_id == uuid.UUID(job_id)
        )
    )
    co_count = count_result.scalar() + 1

    # Generate approval token
    approval_token = str(uuid.uuid4())

    co = ChangeOrder(
        job_id=uuid.UUID(job_id),
        co_number=co_count,
        description=data.description,
        additional_items=data.additional_items,
        additional_price=data.additional_price,
        status=ChangeOrderStatus.pending,
        approval_token=approval_token
    )
    db.add(co)
    await db.commit()
    await db.refresh(co)

    return {
        "change_order_id": str(co.id),
        "job_id": job_id,
        "co_number": co.co_number,
        "description": co.description,
        "additional_price": float(co.additional_price) if co.additional_price else None,
        "status": co.status,
        "approval_token": approval_token,
        "message": f"Change Order #{co_count} created — send approval link to customer"
    }


@router.get("/{job_id}")
async def list_change_orders(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all change orders for a job."""
    result = await db.execute(
        select(ChangeOrder)
        .where(ChangeOrder.job_id == uuid.UUID(job_id))
        .order_by(ChangeOrder.co_number)
    )
    cos = result.scalars().all()

    return {
        "job_id": job_id,
        "change_orders": [
            {
                "change_order_id": str(co.id),
                "co_number": co.co_number,
                "description": co.description,
                "additional_items": co.additional_items,
                "additional_price": float(co.additional_price) if co.additional_price else None,
                "status": co.status,
                "approved_at": co.approved_at,
            }
            for co in cos
        ],
        "total": len(cos),
        "pending": sum(1 for co in cos if co.status == ChangeOrderStatus.pending),
        "approved": sum(1 for co in cos if co.status == ChangeOrderStatus.approved),
    }


@router.post("/{co_id}/approve")
async def approve_change_order(
    co_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Customer approves a change order."""
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == uuid.UUID(co_id))
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")

    co.status = ChangeOrderStatus.approved
    co.approved_at = datetime.utcnow().isoformat()
    await db.commit()

    return {
        "change_order_id": co_id,
        "co_number": co.co_number,
        "status": co.status,
        "approved_at": co.approved_at,
        "message": f"Change Order #{co.co_number} approved"
    }


@router.post("/{co_id}/decline")
async def decline_change_order(
    co_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Customer declines a change order."""
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == uuid.UUID(co_id))
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")

    co.status = ChangeOrderStatus.declined
    await db.commit()

    return {
        "change_order_id": co_id,
        "co_number": co.co_number,
        "status": co.status,
        "message": f"Change Order #{co.co_number} declined"
    }
