from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, \
                       Numeric, DateTime, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


# ── INVOICE ───────────────────────────────────────────────────────────────────

class InvoiceStatus(str, enum.Enum):
    draft    = "draft"    # Being assembled
    review   = "review"   # Diana reviewing
    sent     = "sent"     # Sent to customer
    paid     = "paid"     # Payment confirmed
    overdue  = "overdue"  # Past due date, unpaid


class Invoice(BaseModel):
    """
    The customer-facing invoice.
    Built from approved quote + change orders + actual hours.
    Diana must review before sending — nothing goes out unreviewed.
    QuickBooks is the system of record — we sync after Diana approves.
    """
    __tablename__ = "invoices"

    job_id          = Column(UUID(as_uuid=True), ForeignKey("jobs.id"),
                             nullable=False, unique=True)

    # Invoice number
    invoice_number  = Column(String(50), unique=True, nullable=False)
                                         # e.g. "INV-2024-0847"

    # Status
    status          = Column(Enum(InvoiceStatus), nullable=False,
                             default=InvoiceStatus.draft)

    # Amounts
    subtotal        = Column(Numeric(10, 2))
    tax_amount      = Column(Numeric(10, 2), default=0)
    total_amount    = Column(Numeric(10, 2), nullable=False)
    amount_paid     = Column(Numeric(10, 2), default=0)
    balance_due     = Column(Numeric(10, 2))

    # Diana review checklist — stored as flags
    review_lines_verified   = Column(Boolean, default=False)
    review_hours_verified   = Column(Boolean, default=False)
    review_co_verified      = Column(Boolean, default=False)
    review_nocharge_verified = Column(Boolean, default=False)
    review_total_verified   = Column(Boolean, default=False)

    @property
    def diana_approved(self):
        """All five checklist items must be True before sending"""
        return all([
            self.review_lines_verified,
            self.review_hours_verified,
            self.review_co_verified,
            self.review_nocharge_verified,
            self.review_total_verified,
        ])

    # Send tracking
    sent_at         = Column(DateTime)
    due_date        = Column(DateTime)
    paid_at         = Column(DateTime)
    ai_invoice_summary = Column(Text)   # cached AI summary for invoice PDF

    # QuickBooks sync
    quickbooks_invoice_id = Column(String(100))  # QB invoice ID after sync
    quickbooks_synced_at  = Column(DateTime)

    # Reminder tracking
    reminder_7_sent  = Column(Boolean, default=False)
    reminder_14_sent = Column(Boolean, default=False)
    reminder_30_sent = Column(Boolean, default=False)

    # Relationship
    job             = relationship("Job", back_populates="invoice")

    def __repr__(self):
        return f"<Invoice {self.invoice_number} ${self.total_amount} ({self.status})>"


# ── VAN INVENTORY ─────────────────────────────────────────────────────────────

class VanInventoryItem(BaseModel):
    """
    What each tech is carrying on their truck.
    Updated automatically when change orders consume parts.
    Restock flags surface on the dashboard.
    """
    __tablename__ = "van_inventory"

    tech_id         = Column(UUID(as_uuid=True), ForeignKey("users.id"),
                             nullable=False)

    # Item
    sku             = Column(String(100))
    description     = Column(String(500), nullable=False)
    unit            = Column(String(50))

    # Quantity
    quantity_on_hand = Column(Numeric(10, 2), default=0)
    restock_threshold = Column(Numeric(10, 2), default=1)  # Flag when at or below this
    restock_quantity  = Column(Numeric(10, 2), default=2)  # How many to restock to

    # Flags
    restock_needed  = Column(Boolean, default=False)       # True when qty <= threshold
    last_used_job_id = Column(UUID(as_uuid=True),
                              ForeignKey("jobs.id"))        # Which job consumed last

    def __repr__(self):
        return (f"<VanInventory tech={self.tech_id} "
                f"{self.sku} qty={self.quantity_on_hand}>")
