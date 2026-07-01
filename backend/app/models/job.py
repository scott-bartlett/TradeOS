from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey, \
                       Numeric, Integer, DateTime
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class JobStatus(str, enum.Enum):
    estimate         = "estimate"
    quoted           = "quoted"
    approved         = "approved"
    scheduled        = "scheduled"
    in_progress      = "in_progress"
    complete         = "complete"
    ready_to_invoice = "ready_to_invoice"  # COs resolved, cleared for invoicing
    invoiced         = "invoiced"
    paid             = "paid"
    cancelled        = "cancelled"


class JobVertical(str, enum.Enum):
    hvac        = "hvac"
    electrical  = "electrical"
    pipefitting = "pipefitting"


class Job(BaseModel):
    __tablename__ = "jobs"

    job_number = Column(String(50), unique=True, nullable=False)
    status     = Column(Enum(JobStatus), nullable=False, default=JobStatus.estimate)
    vertical   = Column(Enum(JobVertical), nullable=False, default=JobVertical.hvac)

    customer_id         = Column(UUID(as_uuid=True), ForeignKey("customers.id"), nullable=False)
    service_location_id = Column(UUID(as_uuid=True), ForeignKey("service_locations.id"), nullable=False)
    assigned_tech_id    = Column(UUID(as_uuid=True), ForeignKey("users.id"))

    title         = Column(String(255), nullable=False)
    scope_of_work = Column(Text)
    ai_analysis   = Column(JSONB)

    scheduled_date  = Column(DateTime)
    arrival_window  = Column(String(50))
    estimated_hours = Column(Numeric(5, 2))
    actual_hours    = Column(Numeric(5, 2))

    labor_rate      = Column(Numeric(10, 2), default=110)
    material_markup = Column(Numeric(5, 2),  default=30)
    quote_total     = Column(Numeric(10, 2))
    internal_cost   = Column(Numeric(10, 2))
    deposit_required  = Column(Numeric(10, 2))
    deposit_received  = Column(Boolean, default=False)

    quote_number      = Column(String(50))
    quote_sent_at     = Column(DateTime)
    quote_approved_at = Column(DateTime)
    quote_valid_days  = Column(Integer, default=30)

    close_note = Column(Text)
    closed_at  = Column(DateTime)

    customer         = relationship("Customer", back_populates="jobs")
    service_location = relationship("ServiceLocation", back_populates="jobs")
    assigned_tech    = relationship("User", back_populates="assigned_jobs",
                                    foreign_keys=[assigned_tech_id])
    supply_items     = relationship("JobSupplyItem", back_populates="job",
                                    cascade="all, delete-orphan")
    field_notes      = relationship("FieldNote", back_populates="job",
                                    cascade="all, delete-orphan",
                                    order_by="FieldNote.created_at")
    change_orders    = relationship("ChangeOrder", back_populates="job",
                                    cascade="all, delete-orphan")
    photos           = relationship("JobPhoto", back_populates="job",
                                    cascade="all, delete-orphan")
    invoice          = relationship("Invoice", back_populates="job", uselist=False)

    def __repr__(self):
        return f"<Job {self.job_number} — {self.title} ({self.status})>"
