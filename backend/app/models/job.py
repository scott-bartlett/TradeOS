from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, \
                       Numeric, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class JobStatus(str, enum.Enum):
    """
    Full lifecycle of a job from first contact to paid.
    An estimate that never converts stays at 'estimate' forever — no separate table.
    """
    estimate    = "estimate"     # Quote built, not yet sent or approved
    quoted      = "quoted"       # Quote sent to customer, awaiting approval
    approved    = "approved"     # Customer approved the quote
    scheduled   = "scheduled"    # Job on the calendar, tech assigned
    in_progress = "in_progress"  # Tech on site
    complete    = "complete"     # Work done, pending invoice
    invoiced    = "invoiced"     # Invoice sent
    paid        = "paid"         # Payment confirmed
    cancelled   = "cancelled"    # Job cancelled at any stage


class JobVertical(str, enum.Enum):
    hvac       = "hvac"
    electrical = "electrical"
    pipefitting = "pipefitting"


class Job(BaseModel):
    __tablename__ = "jobs"

    # Job number (human-readable, shown to customers)
    job_number = Column(String(50), unique=True, nullable=False)
                                    # e.g. "TOS-2024-0847"

    # Status
    status     = Column(Enum(JobStatus), nullable=False,
                        default=JobStatus.estimate)
    vertical   = Column(Enum(JobVertical), nullable=False,
                        default=JobVertical.hvac)

    # Relationships — customer + location
    customer_id          = Column(UUID(as_uuid=True), ForeignKey("customers.id"),
                                  nullable=False)
    service_location_id  = Column(UUID(as_uuid=True),
                                  ForeignKey("service_locations.id"),
                                  nullable=False)
    assigned_tech_id     = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    # Scope
    title           = Column(String(255), nullable=False)  # "Condenser Replacement"
    scope_of_work   = Column(Text)                         # Full scope description
    ai_analysis     = Column(JSONB)                        # Raw AI photo analysis output

    # Scheduling
    scheduled_date  = Column(DateTime)
    arrival_window  = Column(String(50))                   # "8:00 - 9:00 AM"
    estimated_hours = Column(Numeric(5, 2))                # 5.50
    actual_hours    = Column(Numeric(5, 2))                # filled from close note

    # Pricing
    labor_rate      = Column(Numeric(10, 2), default=110)  # $/hr
    material_markup = Column(Numeric(5, 2),  default=30)   # %
    quote_total     = Column(Numeric(10, 2))               # customer-facing price
    internal_cost   = Column(Numeric(10, 2))               # our cost (never shown)

    # Quote
    quote_number    = Column(String(50))
    quote_sent_at   = Column(DateTime)
    quote_approved_at = Column(DateTime)
    quote_valid_days  = Column(Integer, default=30)

    # Close
    close_note      = Column(Text)                         # Marcus's final dictation
    closed_at       = Column(DateTime)

    # Relationships
    customer          = relationship("Customer",
                                     back_populates="jobs")
    service_location  = relationship("ServiceLocation",
                                     back_populates="jobs")
    assigned_tech     = relationship("User",
                                     back_populates="assigned_jobs",
                                     foreign_keys=[assigned_tech_id])
    supply_items      = relationship("JobSupplyItem",
                                     back_populates="job",
                                     cascade="all, delete-orphan")
    field_notes       = relationship("FieldNote",
                                     back_populates="job",
                                     cascade="all, delete-orphan",
                                     order_by="FieldNote.created_at")
    change_orders     = relationship("ChangeOrder",
                                     back_populates="job",
                                     cascade="all, delete-orphan")
    photos            = relationship("JobPhoto",
                                     back_populates="job",
                                     cascade="all, delete-orphan")
    invoice           = relationship("Invoice",
                                     back_populates="job",
                                     uselist=False)

    def __repr__(self):
        return f"<Job {self.job_number} — {self.title} ({self.status})>"
