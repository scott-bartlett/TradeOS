from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, func
from app.database import get_db
from app.models.catalog import CatalogItem

router = APIRouter()


@router.get("")
async def search_catalog(
    q: str = Query(..., min_length=2, description="Search term — matches SKU or description"),
    limit: int = Query(10, ge=1, le=30),
    db: AsyncSession = Depends(get_db),
):
    """
    Search the supply catalog by description or SKU.
    Used by the supply list add-item search in the field app.

    Returns items ordered by: exact SKU match first, then description relevance.
    """
    search = f"%{q.lower()}%"

    result = await db.execute(
        select(CatalogItem)
        .where(
            or_(
                func.lower(CatalogItem.description).like(search),
                func.lower(CatalogItem.sku).like(search),
                func.lower(CatalogItem.category).like(search),
            )
        )
        .order_by(
            # Exact SKU prefix match sorts first
            func.lower(CatalogItem.sku).like(f"{q.lower()}%").desc(),
            CatalogItem.category,
            CatalogItem.description,
        )
        .limit(limit)
    )
    items = result.scalars().all()

    return [
        {
            "sku":            item.sku,
            "description":    item.description,
            "category":       item.category,
            "unit":           item.unit,
            "unit_cost":      float(item.unit_cost) if item.unit_cost else None,
            "customer_price": float(item.customer_price) if item.customer_price else None,
        }
        for item in items
    ]
