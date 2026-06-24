from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, \
                       Numeric, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


# ── SUPPLY ITEMS ──────────────────────────────────────────────────────────────

class SupplySource(str, enum.Enum):
    photo    = "photo"    # AI read from equipment photo
    dictation = "dictation"  # AI pulled from tech dictation
    inferred = "inferred" # AI trade knowledge
    manual   = "manual"   # Jamie added from catalog


class JobSupplyItem(BaseModel):
    """
    One line item on the supply list for a job.
    Matches the Johnstone catalog structure.
    Never shown to the customer with pricing.
    """
    __tablename__ = "job_supply_items"

    job_id      = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)

    # Item details
    sku         = Column(String(100))
    description = Column(String(500), nullable=False)
    quantity    = Column(Numeric(10, 2), nullable=False, default=1)
    unit        = Column(String(50))                    # ea, ft, lb, kit, etc.
    unit_cost   = Column(Numeric(10, 2))                # our cost — never shown to customer
    source      = Column(Enum(SupplySource), default=SupplySource.inferred)

    # Status
    is_approved = Column(Boolean, default=False)        # True after Jamie approves list
    po_sent     = Column(Boolean, default=False)        # True after PO sent to supplier

    # Relationship
    job         = relationship("Job", back_populates="supply_items")

    def __repr__(self):
        return f"<SupplyItem {self.sku} x{self.quantity}>"


# ── FIELD NOTES ───────────────────────────────────────────────────────────────

class FieldNote(BaseModel):
    """
    Marcus's dictation entries from the field.
    Captured offline-first — synced when signal returns.
    Never modified after save — append only.
    """
    __tablename__ = "field_notes"

    job_id      = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)
    tech_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)

    # Content
    note_text   = Column(Text, nullable=False)
    note_type   = Column(String(50), default="dictation")  # dictation, typed, system

    # Offline sync tracking
    # client_uuid is set by the PWA before sync — prevents duplicates
    client_uuid = Column(String(100), unique=True)
    # captured_at is the DEVICE time — may differ from created_at (server time)
    captured_at = Column(String(50))                    # ISO string from device
    is_synced   = Column(Boolean, default=True)         # False if still pending sync

    # Relationships
    job         = relationship("Job",  back_populates="field_notes")
    tech        = relationship("User", back_populates="field_notes")

    def __repr__(self):
        return f"<FieldNote job={self.job_id} at {self.captured_at}>"


# ── JOB PHOTOS ────────────────────────────────────────────────────────────────

class PhotoType(str, enum.Enum):
    equipment    = "equipment"    # Existing unit, data plate
    site         = "site"         # Job site conditions
    completed    = "completed"    # After work is done
    change_order = "change_order" # Photo supporting a change order


class JobPhoto(BaseModel):
    """
    Photos stored in Cloudflare R2.
    Database stores the reference URL, not the binary.
    """
    __tablename__ = "job_photos"

    job_id       = Column(UUID(as_uuid=True), ForeignKey("jobs.id"), nullable=False)

    # R2 storage
    r2_key       = Column(String(500), nullable=False)  # R2 object key
    public_url   = Column(String(500), nullable=False)  # CDN URL

    # Metadata
    photo_type   = Column(Enum(PhotoType), default=PhotoType.equipment)
    caption      = Column(String(500))
    ai_analyzed  = Column(Boolean, default=False)       # True after AI reads it

    # Offline sync
    client_uuid  = Column(String(100), unique=True)

    # Relationship
    job          = relationship("Job", back_populates="photos")

    def __repr__(self):
        return f"<JobPhoto {self.photo_type} — {self.r2_key}>"


# ── CHANGE ORDERS ─────────────────────────────────────────────────────────────

class ChangeOrderStatus(str, enum.Enum):
    pending  = "pending"   # Submitted, awaiting customer approval
    approved = "approved"  # Customer approved
    declined = "declined"  # Customer declined


class ChangeOrder(BaseModel):
    """
    Unexpected work discovered in the field.
    Marcus dictates, customer approves via link, added to invoice.
    """
    __tablename__ = "change_orders"

    job_id          = Column(UUID(as_uuid=True), ForeignKey("jobs.id"),
                             nullable=False)

    # Numbering
    co_number       = Column(Integer, nullable=False)   # CO #1, #2, etc. per job

    # Content
    description     = Column(Text, nullable=False)      # What Marcus found
    additional_items = Column(Text)                     # Parts/labor added
    additional_price = Column(Numeric(10, 2))           # What we're charging

    # Approval
    status          = Column(Enum(ChangeOrderStatus),
                             default=ChangeOrderStatus.pending)
    approval_token  = Column(String(255))               # UUID in the approval link
    approved_at     = Column(String(50))                # ISO timestamp

    # Relationship
    job             = relationship("Job", back_populates="change_orders")

    def __repr__(self):
        return f"<ChangeOrder #{self.co_number} job={self.job_id} ({self.status})>"
