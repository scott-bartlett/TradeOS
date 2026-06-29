"""
Change Order Routes
-------------------
  GET  /api/change-orders/{job_id}              — list change orders for job
  POST /api/change-orders/{job_id}              — create change order manually
  POST /api/change-orders/{job_id}/generate     — AI draft from field notes
  PATCH /api/change-orders/{co_id}              — update change order
  POST /api/change-orders/{co_id}/approve       — approve change order
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional, List
import uuid
import json

from app.database import get_db
from app.models.supply_and_field import ChangeOrder, ChangeOrderStatus, FieldNote, JobSupplyItem
from app.models.job import Job
from app.services.ai_provider import get_ai_response

router = APIRouter()


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class ChangeOrderCreate(BaseModel):
    description: str
    additional_price: Optional[float] = 0
    extra_hours: Optional[float] = None
    line_items: Optional[list] = None


class ChangeOrderUpdate(BaseModel):
    description: Optional[str] = None
    additional_price: Optional[float] = None
    extra_hours: Optional[float] = None
    line_items: Optional[list] = None


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _co_response(co: ChangeOrder) -> dict:
    return {
        "change_order_id": str(co.id),
        "job_id": str(co.job_id),
        "co_number": co.co_number,
        "description": co.description,
        "additional_price": float(co.additional_price or 0),
        "extra_hours": float(co.extra_hours) if co.extra_hours else None,
        "line_items": co.line_items or [],
        "status": co.status,
        "approved_at": co.approved_at,
        "created_at": co.created_at.isoformat(),
    }


# ── LIST ──────────────────────────────────────────────────────────────────────

@router.get("/{job_id}")
async def list_change_orders(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChangeOrder)
        .where(ChangeOrder.job_id == uuid.UUID(job_id))
        .order_by(ChangeOrder.co_number)
    )
    cos = result.scalars().all()
    return {"change_orders": [_co_response(co) for co in cos], "total": len(cos)}


# ── CREATE ────────────────────────────────────────────────────────────────────

@router.post("/{job_id}")
async def create_change_order(
    job_id: str, data: ChangeOrderCreate, db: AsyncSession = Depends(get_db)
):
    # Get next CO number for this job
    result = await db.execute(
        select(func.max(ChangeOrder.co_number))
        .where(ChangeOrder.job_id == uuid.UUID(job_id))
    )
    max_num = result.scalar() or 0

    co = ChangeOrder(
        job_id=uuid.UUID(job_id),
        co_number=max_num + 1,
        description=data.description,
        additional_price=data.additional_price or 0,
        extra_hours=data.extra_hours,
        line_items=data.line_items,
        status=ChangeOrderStatus.pending,
    )
    db.add(co)
    await db.commit()
    await db.refresh(co)
    return _co_response(co)


# ── AI GENERATE ───────────────────────────────────────────────────────────────

@router.post("/{job_id}/generate")
async def generate_change_order(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    AI drafts a change order from field notes.
    Compares field notes against original scope to identify extra work,
    extra hours, and any parts used beyond the original supply list.
    """
    # Get job
    job_result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get field notes
    notes_result = await db.execute(
        select(FieldNote)
        .where(FieldNote.job_id == uuid.UUID(job_id))
        .order_by(FieldNote.created_at)
    )
    field_notes = notes_result.scalars().all()

    if not field_notes:
        raise HTTPException(status_code=400, detail="No field notes found for this job")

    # Get original supply list
    items_result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.job_id == uuid.UUID(job_id))
    )
    supply_items = items_result.scalars().all()

    # Build context for AI
    notes_text = "\n".join([f"- {n.note_text}" for n in field_notes])
    supply_text = "\n".join([
        f"- {i.description} (qty: {float(i.quantity)}, SKU: {i.sku or 'N/A'})"
        for i in supply_items
    ])

    labor_rate = float(job.labor_rate or 110)
    estimated_hours = float(job.estimated_hours or 0)

    prompt = f"""You are analyzing field notes from an HVAC job to identify change order items.

JOB: {job.title}
ORIGINAL SCOPE: {job.scope_of_work or 'Not specified'}
ESTIMATED HOURS: {estimated_hours} hrs at ${labor_rate}/hr
LABOR RATE: ${labor_rate}/hr

ORIGINAL SUPPLY LIST:
{supply_text if supply_text else 'No items on supply list'}

FIELD NOTES FROM TECHNICIAN:
{notes_text}

Based on the field notes, identify any work or materials BEYOND the original scope.
Look for:
- Extra hours worked beyond the estimate
- Parts or materials used that weren't on the original supply list
- Additional work discovered during the job
- Items pulled from the van/truck inventory

Respond ONLY with a JSON object (no markdown, no explanation):
{{
  "description": "clear 1-2 sentence description of the additional work",
  "extra_hours": <number or null — additional hours beyond estimate>,
  "line_items": [
    {{
      "description": "item name",
      "sku": "SKU if known or null",
      "quantity": <number>,
      "unit": "ea/ft/lb/etc",
      "unit_cost": <estimated cost or null>,
      "from_van": <true if pulled from truck inventory, false if needs ordering>
    }}
  ],
  "additional_price": <total dollar amount to charge customer>,
  "notes": "brief explanation of what was found"
}}

If no change order is needed (work matches original scope exactly), respond with:
{{"no_change_order": true, "notes": "explanation"}}"""

    try:
        response_text = await get_ai_response(prompt)
        # Strip any markdown fences
        clean = response_text.strip()
        if clean.startswith('```'):
            clean = clean.split('\n', 1)[1]
            clean = clean.rsplit('```', 1)[0]

        result = json.loads(clean)

        if result.get("no_change_order"):
            return {
                "draft": None,
                "no_change_order": True,
                "message": result.get("notes", "No additional work identified beyond original scope"),
            }

        return {
            "draft": result,
            "no_change_order": False,
            "message": result.get("notes", "AI identified additional work — review and save to create change order"),
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI generation failed: {str(e)}")


# ── UPDATE ────────────────────────────────────────────────────────────────────

@router.patch("/{co_id}")
async def update_change_order(
    co_id: str, data: ChangeOrderUpdate, db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == uuid.UUID(co_id))
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(co, field, value)

    await db.commit()
    return _co_response(co)


# ── APPROVE ───────────────────────────────────────────────────────────────────

@router.post("/{co_id}/approve")
async def approve_change_order(co_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ChangeOrder).where(ChangeOrder.id == uuid.UUID(co_id))
    )
    co = result.scalar_one_or_none()
    if not co:
        raise HTTPException(status_code=404, detail="Change order not found")

    from datetime import datetime
    co.status = ChangeOrderStatus.approved
    co.approved_at = datetime.utcnow().isoformat()
    await db.commit()
    return _co_response(co)
