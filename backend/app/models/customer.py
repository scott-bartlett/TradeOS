from sqlalchemy import Column, String, Boolean, Enum, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import enum
from app.models.base import BaseModel


class CustomerType(str, enum.Enum):
    residential = "residential"  # Homeowner — person with one address
    commercial  = "commercial"   # Property manager, business, HOA, etc.


class Customer(BaseModel):
    """
    Matches QuickBooks customer record.
    One customer can have many service locations (property managers, etc.)
    """
    __tablename__ = "customers"

    # Type
    customer_type = Column(Enum(CustomerType), nullable=False,
                           default=CustomerType.residential)

    # Company (commercial) or person (residential)
    company_name  = Column(String(255))           # Commercial: "Apex Property Mgmt"
    first_name    = Column(String(100))           # Residential OR commercial contact
    last_name     = Column(String(100))
    display_name  = Column(String(255), nullable=False)  # QuickBooks display name

    # Primary contact
    email         = Column(String(255))
    phone         = Column(String(30))
    mobile        = Column(String(30))

    # Billing address (where invoice goes)
    billing_street  = Column(String(255))
    billing_city    = Column(String(100))
    billing_state   = Column(String(50))
    billing_zip     = Column(String(20))

    # QuickBooks sync
    quickbooks_id   = Column(String(100), unique=True)  # QB customer ID after sync

    # Internal
    notes           = Column(Text)
    is_active       = Column(Boolean, default=True, nullable=False)

    # Relationships
    service_locations = relationship("ServiceLocation", back_populates="customer",
                                     cascade="all, delete-orphan")
    jobs              = relationship("Job", back_populates="customer")

    def __repr__(self):
        return f"<Customer {self.display_name} ({self.customer_type})>"


class ServiceLocation(BaseModel):
    """
    Where the work actually happens.
    Residential: usually same as billing address.
    Commercial: one per property — property manager may have dozens.
    """
    __tablename__ = "service_locations"

    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id"),
                         nullable=False)

    # Location identity
    location_name = Column(String(255))   # "123 Oak St Unit 4" or "Riverside Plaza"
    contact_name  = Column(String(255))   # On-site contact (may differ from customer)
    contact_phone = Column(String(30))
    contact_email = Column(String(255))

    # Service address
    street        = Column(String(255), nullable=False)
    city          = Column(String(100), nullable=False)
    state         = Column(String(50),  nullable=False)
    zip_code      = Column(String(20),  nullable=False)

    # Access notes — critical for field techs
    access_notes  = Column(Text)          # "Gate code 1234, ring bell twice"

    # Status
    is_active     = Column(Boolean, default=True, nullable=False)

    # Relationships
    customer      = relationship("Customer", back_populates="service_locations")
    jobs          = relationship("Job",      back_populates="service_location")

    def __repr__(self):
        return f"<ServiceLocation {self.street}, {self.city}>"
