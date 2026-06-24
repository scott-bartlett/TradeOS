# Import all models explicitly so Alembic can find them
from app.models.base import BaseModel
from app.models.user import User, UserRole
from app.models.customer import Customer, ServiceLocation, CustomerType
from app.models.job import Job, JobStatus, JobVertical
from app.models.supply_and_field import (
    JobSupplyItem, SupplySource,
    FieldNote,
    JobPhoto, PhotoType,
    ChangeOrder, ChangeOrderStatus
)
from app.models.invoice import Invoice, InvoiceStatus, VanInventoryItem