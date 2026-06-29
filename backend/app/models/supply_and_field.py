from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, \
                       Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


# ── SUPPLY ITEMS ──────────────────────────────────────────────────────────────

class SupplySource(str, enum.Enum):
    photo     = "photo"
    dictation = "dictation"
    inferred  = "inferred"
    manual    = "manual"


class JobSupplyItem(BaseModel):
    __tablename__ = "job_supply_items"

    job_id      = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    sku         = Column(String(100))
    description = Column(String(500), nullable=False)
    quantity    = Column(Numeric(10, 2), nullable=False, default=1)
    unit        = Column(String(50))
    unit_cost   = Column(Numeric(10, 2))
    source      = Column(Enum(SupplySource), default=SupplySource.inferred)
    is_approved = Column(Boolean, default=False)
    po_sent     = Column(Boolean, default=False)
    job         = relationship("Job", back_populates="supply_items")

    def __repr__(self):
        return f"<SupplyItem {self.sku} x{self.quantity}>"


# ── FIELD NOTES ───────────────────────────────────────────────────────────────

class FieldNote(BaseModel):
    __tablename__ = "field_notes"

    job_id      = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    tech_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    note_text   = Column(Text, nullable=False)
    note_type   = Column(String(50), default="dictation")
    client_uuid = Column(String(100), unique=True)
    captured_at = Column(String(50))
    is_synced   = Column(Boolean, default=True)
    job         = relationship("Job",  back_populates="field_notes")
    tech        = relationship("User", back_populates="field_notes")

    def __repr__(self):
        return f"<FieldNote job={self.job_id} at {self.captured_at}>"


# ── JOB PHOTOS ────────────────────────────────────────────────────────────────

class PhotoType(str, enum.Enum):
    equipment    = "equipment"
    site         = "site"
    completed    = "completed"
    change_order = "change_order"


class JobPhoto(BaseModel):
    __tablename__ = "job_photos"

    job_id      = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    r2_key      = Column(String(500), nullable=False)
    public_url  = Column(String(500), nullable=False)
    photo_type  = Column(Enum(PhotoType), default=PhotoType.equipment)
    caption     = Column(String(500))
    ai_analyzed = Column(Boolean, default=False)
    client_uuid = Column(String(100), unique=True)
    job         = relationship("Job", back_populates="photos")

    def __repr__(self):
        return f"<JobPhoto {self.photo_type} — {self.r2_key}>"


# ── CHANGE ORDERS ─────────────────────────────────────────────────────────────

class ChangeOrderStatus(str, enum.Enum):
    pending  = "pending"
    approved = "approved"
    declined = "declined"


class ChangeOrder(BaseModel):
    """
    Unexpected work discovered in the field.
    AI drafts from field notes, Jamie reviews, customer approves.
    line_items: [{ description, sku, quantity, unit, unit_cost, from_van }]
    extra_hours: additional labor hours beyond the original quote
    """
    __tablename__ = "change_orders"

    job_id           = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    co_number        = Column(Integer, nullable=False)
    description      = Column(Text, nullable=False)
    additional_items = Column(Text)                     # legacy plain text
    additional_price = Column(Numeric(10, 2))
    extra_hours      = Column(Numeric(5, 2))            # extra labor hours
    line_items       = Column(JSONB)                    # structured parts list

    status          = Column(Enum(ChangeOrderStatus), default=ChangeOrderStatus.pending)
    approval_token  = Column(String(255))
    approved_at     = Column(String(50))

    job             = relationship("Job", back_populates="change_orders")

    def __repr__(self):
        return f"<ChangeOrder #{self.co_number} job={self.job_id} ({self.status})>"
