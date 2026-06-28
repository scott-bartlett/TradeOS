"""
Customer Routes
---------------
Customer and service location management.

  POST /api/customers/                              — create customer
  GET  /api/customers/                              — list all customers
  GET  /api/customers/{customer_id}                 — get customer detail
  PATCH /api/customers/{customer_id}                — update customer
  GET  /api/customers/{customer_id}/jobs            — get jobs for customer
  POST /api/customers/{customer_id}/locations       — add service location
  GET  /api/customers/{customer_id}/locations       — list service locations
  PATCH /api/customers/locations/{location_id}      — update service location
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.customer import Customer, ServiceLocation, CustomerType

router = APIRouter()


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class CustomerCreate(BaseModel):
    customer_type: str = "residential"
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    notes: Optional[str] = None


class CustomerUpdate(BaseModel):
    company_name: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    display_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    mobile: Optional[str] = None
    billing_street: Optional[str] = None
    billing_city: Optional[str] = None
    billing_state: Optional[str] = None
    billing_zip: Optional[str] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class ServiceLocationCreate(BaseModel):
    location_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    street: str
    city: str
    state: str
    zip_code: str
    access_notes: Optional[str] = None


class ServiceLocationUpdate(BaseModel):
    location_name: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    contact_email: Optional[str] = None
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    access_notes: Optional[str] = None
    is_active: Optional[bool] = None


# ── CREATE CUSTOMER ───────────────────────────────────────────────────────────

@router.post("/")
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db)
):
    customer = Customer(
        customer_type=CustomerType(data.customer_type),
        company_name=data.company_name,
        first_name=data.first_name,
        last_name=data.last_name,
        display_name=data.display_name,
        email=data.email,
        phone=data.phone,
        mobile=data.mobile,
        billing_street=data.billing_street,
        billing_city=data.billing_city,
        billing_state=data.billing_state,
        billing_zip=data.billing_zip,
        notes=data.notes,
        is_active=True
    )
    db.add(customer)
    await db.commit()
    await db.refresh(customer)

    return {
        "customer_id": str(customer.id),
        "display_name": customer.display_name,
        "customer_type": customer.customer_type,
        "message": "Customer created successfully"
    }


# ── LIST CUSTOMERS ────────────────────────────────────────────────────────────

@router.get("/")
async def list_customers(
    customer_type: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db)
):
    query = select(Customer).order_by(Customer.display_name)
    if customer_type:
        query = query.where(Customer.customer_type == CustomerType(customer_type))
    if active_only:
        query = query.where(Customer.is_active == True)

    result = await db.execute(query)
    customers = result.scalars().all()

    return {
        "customers": [
            {
                "customer_id": str(c.id),
                "display_name": c.display_name,
                "customer_type": c.customer_type,
                "email": c.email,
                "phone": c.phone,
                "billing_city": c.billing_city,
                "billing_state": c.billing_state,
                "is_active": c.is_active,
                "quickbooks_id": c.quickbooks_id,
            }
            for c in customers
        ],
        "total": len(customers)
    }


# ── GET CUSTOMER DETAIL ───────────────────────────────────────────────────────

@router.get("/{customer_id}")
async def get_customer(
    customer_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(customer_id))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    locs_result = await db.execute(
        select(ServiceLocation)
        .where(ServiceLocation.customer_id == uuid.UUID(customer_id))
        .order_by(ServiceLocation.created_at)
    )
    locations = locs_result.scalars().all()

    return {
        "customer_id": str(customer.id),
        "customer_type": customer.customer_type,
        "company_name": customer.company_name,
        "first_name": customer.first_name,
        "last_name": customer.last_name,
        "display_name": customer.display_name,
        "email": customer.email,
        "phone": customer.phone,
        "mobile": customer.mobile,
        "billing_street": customer.billing_street,
        "billing_city": customer.billing_city,
        "billing_state": customer.billing_state,
        "billing_zip": customer.billing_zip,
        "notes": customer.notes,
        "is_active": customer.is_active,
        "quickbooks_id": customer.quickbooks_id,
        "service_locations": [
            {
                "location_id": str(l.id),
                "location_name": l.location_name,
                "contact_name": l.contact_name,
                "contact_phone": l.contact_phone,
                "street": l.street,
                "city": l.city,
                "state": l.state,
                "zip_code": l.zip_code,
                "access_notes": l.access_notes,
                "is_active": l.is_active,
            }
            for l in locations
        ],
        "created_at": customer.created_at.isoformat()
    }


# ── GET CUSTOMER JOBS ─────────────────────────────────────────────────────────

@router.get("/{customer_id}/jobs")
async def get_customer_jobs(
    customer_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all jobs for a customer, ordered most recent first."""
    from app.models.job import Job
    result = await db.execute(
        select(Job)
        .where(Job.customer_id == uuid.UUID(customer_id))
        .order_by(Job.created_at.desc())
    )
    jobs = result.scalars().all()

    return {
        "customer_id": customer_id,
        "jobs": [
            {
                "job_id": str(j.id),
                "job_number": j.job_number,
                "title": j.title,
                "status": j.status,
                "vertical": j.vertical,
                "quote_total": float(j.quote_total) if j.quote_total else None,
                "created_at": j.created_at.isoformat(),
            }
            for j in jobs
        ],
        "total": len(jobs)
    }


# ── UPDATE CUSTOMER ───────────────────────────────────────────────────────────

@router.patch("/{customer_id}")
async def update_customer(
    customer_id: str,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(customer_id))
    )
    customer = result.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(customer, field, value)

    await db.commit()
    return {"customer_id": customer_id, "message": "Customer updated successfully"}


# ── ADD SERVICE LOCATION ──────────────────────────────────────────────────────

@router.post("/{customer_id}/locations")
async def add_service_location(
    customer_id: str,
    data: ServiceLocationCreate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Customer).where(Customer.id == uuid.UUID(customer_id))
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Customer not found")

    location = ServiceLocation(
        customer_id=uuid.UUID(customer_id),
        location_name=data.location_name,
        contact_name=data.contact_name,
        contact_phone=data.contact_phone,
        contact_email=data.contact_email,
        street=data.street,
        city=data.city,
        state=data.state,
        zip_code=data.zip_code,
        access_notes=data.access_notes,
        is_active=True
    )
    db.add(location)
    await db.commit()
    await db.refresh(location)

    return {
        "location_id": str(location.id),
        "customer_id": customer_id,
        "street": location.street,
        "city": location.city,
        "message": "Service location added successfully"
    }


# ── LIST SERVICE LOCATIONS ────────────────────────────────────────────────────

@router.get("/{customer_id}/locations")
async def list_service_locations(
    customer_id: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ServiceLocation)
        .where(ServiceLocation.customer_id == uuid.UUID(customer_id))
        .order_by(ServiceLocation.created_at)
    )
    locations = result.scalars().all()

    return {
        "customer_id": customer_id,
        "locations": [
            {
                "location_id": str(l.id),
                "location_name": l.location_name,
                "contact_name": l.contact_name,
                "contact_phone": l.contact_phone,
                "street": l.street,
                "city": l.city,
                "state": l.state,
                "zip_code": l.zip_code,
                "access_notes": l.access_notes,
                "is_active": l.is_active,
            }
            for l in locations
        ],
        "total": len(locations)
    }


# ── UPDATE SERVICE LOCATION ───────────────────────────────────────────────────

@router.patch("/locations/{location_id}")
async def update_service_location(
    location_id: str,
    data: ServiceLocationUpdate,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(ServiceLocation).where(ServiceLocation.id == uuid.UUID(location_id))
    )
    location = result.scalar_one_or_none()
    if not location:
        raise HTTPException(status_code=404, detail="Service location not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(location, field, value)

    await db.commit()
    return {"location_id": location_id, "message": "Service location updated successfully"}
