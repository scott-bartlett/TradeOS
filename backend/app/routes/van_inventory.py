"""
Van Inventory Routes
--------------------
Track what each tech is carrying on their truck.

  GET  /api/van-inventory/{tech_id}             — get tech's inventory
  POST /api/van-inventory/{tech_id}             — add item to truck
  PATCH /api/van-inventory/{item_id}            — update quantity
  POST /api/van-inventory/{tech_id}/use         — log item usage from a job
  GET  /api/van-inventory/{tech_id}/restock     — get items needing restock
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.invoice import VanInventoryItem

router = APIRouter()


class InventoryItemCreate(BaseModel):
    sku: Optional[str] = None
    description: str
    unit: Optional[str] = None
    quantity_on_hand: float = 0
    restock_threshold: float = 1
    restock_quantity: float = 2


class InventoryUpdate(BaseModel):
    quantity_on_hand: Optional[float] = None
    restock_threshold: Optional[float] = None
    restock_quantity: Optional[float] = None
    restock_needed: Optional[bool] = None


class ItemUsage(BaseModel):
    sku: str
    quantity_used: float
    job_id: str


@router.get("/{tech_id}")
async def get_van_inventory(
    tech_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all inventory items for a tech's truck."""
    result = await db.execute(
        select(VanInventoryItem)
        .where(VanInventoryItem.tech_id == uuid.UUID(tech_id))
        .order_by(VanInventoryItem.description)
    )
    items = result.scalars().all()

    return {
        "tech_id": tech_id,
        "items": [
            {
                "item_id": str(i.id),
                "sku": i.sku,
                "description": i.description,
                "unit": i.unit,
                "quantity_on_hand": float(i.quantity_on_hand),
                "restock_threshold": float(i.restock_threshold),
                "restock_needed": i.restock_needed,
            }
            for i in items
        ],
        "total_items": len(items),
        "restock_needed": sum(1 for i in items if i.restock_needed)
    }


@router.post("/{tech_id}")
async def add_inventory_item(
    tech_id: str,
    data: InventoryItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """Add an item to a tech's truck inventory."""
    item = VanInventoryItem(
        tech_id=uuid.UUID(tech_id),
        sku=data.sku,
        description=data.description,
        unit=data.unit,
        quantity_on_hand=data.quantity_on_hand,
        restock_threshold=data.restock_threshold,
        restock_quantity=data.restock_quantity,
        restock_needed=data.quantity_on_hand <= data.restock_threshold
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)

    return {
        "item_id": str(item.id),
        "tech_id": tech_id,
        "description": item.description,
        "quantity_on_hand": float(item.quantity_on_hand),
        "message": "Item added to van inventory"
    }


@router.patch("/{item_id}")
async def update_inventory_item(
    item_id: str,
    data: InventoryUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update an inventory item — quantity, thresholds, or restock flag."""
    result = await db.execute(
        select(VanInventoryItem).where(VanInventoryItem.id == uuid.UUID(item_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Inventory item not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    # Auto-update restock flag
    item.restock_needed = float(item.quantity_on_hand) <= float(item.restock_threshold)

    await db.commit()

    return {
        "item_id": item_id,
        "quantity_on_hand": float(item.quantity_on_hand),
        "restock_needed": item.restock_needed,
        "message": "Inventory updated"
    }


@router.post("/{tech_id}/use")
async def log_item_usage(
    tech_id: str,
    data: ItemUsage,
    db: AsyncSession = Depends(get_db)
):
    """
    Log that a tech used an item from their truck on a job.
    Decrements quantity and flags restock if below threshold.
    """
    result = await db.execute(
        select(VanInventoryItem).where(
            VanInventoryItem.tech_id == uuid.UUID(tech_id),
            VanInventoryItem.sku == data.sku
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(
            status_code=404,
            detail=f"Item with SKU {data.sku} not found in this tech's inventory"
        )

    item.quantity_on_hand = float(item.quantity_on_hand) - data.quantity_used
    item.last_used_job_id = uuid.UUID(data.job_id)
    item.restock_needed = float(item.quantity_on_hand) <= float(item.restock_threshold)

    await db.commit()

    return {
        "item_id": str(item.id),
        "sku": item.sku,
        "quantity_remaining": float(item.quantity_on_hand),
        "restock_needed": item.restock_needed,
        "message": f"Used {data.quantity_used} {item.unit or 'unit(s)'} on job"
    }


@router.get("/{tech_id}/restock")
async def get_restock_list(
    tech_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all items that need restocking for a tech's truck."""
    result = await db.execute(
        select(VanInventoryItem).where(
            VanInventoryItem.tech_id == uuid.UUID(tech_id),
            VanInventoryItem.restock_needed == True
        )
    )
    items = result.scalars().all()

    return {
        "tech_id": tech_id,
        "restock_items": [
            {
                "item_id": str(i.id),
                "sku": i.sku,
                "description": i.description,
                "quantity_on_hand": float(i.quantity_on_hand),
                "restock_to": float(i.restock_quantity),
                "order_quantity": float(i.restock_quantity) - float(i.quantity_on_hand)
            }
            for i in items
        ],
        "total": len(items)
    }
