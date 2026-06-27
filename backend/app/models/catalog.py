from sqlalchemy import Column, String, Numeric
from app.models.base import BaseModel


class CatalogItem(BaseModel):
    """
    Supplier catalog — seeded from Johnstone price list Excel.
    Read-only at runtime; updated by re-running catalog_seed.py.
    This is what the supply list search queries.
    """
    __tablename__ = "catalog_items"

    sku           = Column(String(100), unique=True, nullable=False, index=True)
    description   = Column(String(500), nullable=False)
    category      = Column(String(100))
    unit          = Column(String(50))
    unit_cost     = Column(Numeric(10, 2))
    markup_pct    = Column(Numeric(5, 4), default=0.30)   # 0.30 = 30%
    customer_price = Column(Numeric(10, 2))

    def __repr__(self):
        return f"<CatalogItem {self.sku}>"
