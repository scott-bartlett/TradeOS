"""
catalog_seed.py — Load Johnstone price list into catalog_items table.

Run from the backend directory:
    python catalog_seed.py

Prerequisites:
- DATABASE_URL env var set (same as Railway)
- catalog_items table already created (run alembic upgrade head first)
- Price list Excel file at: ./data/TradeOS_HVAC_PriceList_Johnstone.xlsx
  (copy it there, or update EXCEL_PATH below)

Re-running this script is safe — it upserts by SKU (delete-all then re-insert).
"""

import os
import sys
import asyncio
from pathlib import Path
from decimal import Decimal

# Allow running from backend/ directory
sys.path.insert(0, str(Path(__file__).parent))

import openpyxl
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import text

# ── Config ────────────────────────────────────────────────────────────────────

EXCEL_PATH = Path(__file__).parent / "data" / "TradeOS_HVAC_PriceList_Johnstone.xlsx"
SHEET_NAME = "HVAC Price List"

# ── Main ──────────────────────────────────────────────────────────────────────

async def seed():
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        print("ERROR: DATABASE_URL env var not set")
        sys.exit(1)

    if not EXCEL_PATH.exists():
        print(f"ERROR: Excel file not found at {EXCEL_PATH}")
        print("Copy TradeOS_HVAC_PriceList_Johnstone.xlsx to backend/data/")
        sys.exit(1)

    # Read Excel
    print(f"Reading {EXCEL_PATH}...")
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb[SHEET_NAME]

    items = []
    for row in ws.iter_rows(values_only=True):
        sku = row[0]
        if not sku or not str(sku).startswith("HVAC-"):
            continue
        description    = row[1]
        category       = row[2]
        unit           = row[3]
        unit_cost      = row[4]
        markup_pct     = row[5] if row[5] else 0.30
        # Customer price may be a formula string if data_only=False; skip if so
        customer_price = row[6] if isinstance(row[6], (int, float)) else None
        if customer_price is None and unit_cost:
            customer_price = float(unit_cost) * (1 + float(markup_pct))

        items.append({
            "sku":            str(sku),
            "description":    str(description),
            "category":       str(category) if category else None,
            "unit":           str(unit) if unit else None,
            "unit_cost":      Decimal(str(unit_cost)) if unit_cost else None,
            "markup_pct":     Decimal(str(markup_pct)),
            "customer_price": Decimal(str(round(customer_price, 2))) if customer_price else None,
        })

    print(f"Found {len(items)} catalog items")

    # Connect and upsert
    engine = create_async_engine(database_url, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        # Clear existing catalog
        await session.execute(text("DELETE FROM catalog_items"))
        print("Cleared existing catalog items")

        # Insert fresh
        for item in items:
            await session.execute(text("""
                INSERT INTO catalog_items
                    (id, sku, description, category, unit, unit_cost, markup_pct, customer_price, created_at, updated_at)
                VALUES
                    (gen_random_uuid(), :sku, :description, :category, :unit,
                     :unit_cost, :markup_pct, :customer_price, NOW(), NOW())
            """), item)

        await session.commit()
        print(f"✓ Seeded {len(items)} catalog items into catalog_items table")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
