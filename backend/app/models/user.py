from sqlalchemy import Column, String, Boolean, Enum
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class UserRole(str, enum.Enum):
    owner  = "owner"   # Jamie — full access
    office = "office"  # Diana — all flows except field
    tech   = "tech"    # Marcus — field app only


class User(BaseModel):
    __tablename__ = "users"

    # Identity (Clerk handles auth — this mirrors their record)
    clerk_id   = Column(String(255), unique=True, nullable=False)
    email      = Column(String(255), unique=True, nullable=False)
    first_name = Column(String(100), nullable=False)
    last_name  = Column(String(100), nullable=False)
    phone      = Column(String(30))

    # Role
    role       = Column(Enum(UserRole), nullable=False, default=UserRole.tech)
    is_active  = Column(Boolean, default=True, nullable=False)

    # Relationships
    field_notes    = relationship("FieldNote",    back_populates="tech")
    assigned_jobs  = relationship("Job",          back_populates="assigned_tech",
                                  foreign_keys="Job.assigned_tech_id")

    def __repr__(self):
        return f"<User {self.first_name} {self.last_name} ({self.role})>"
