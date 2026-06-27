"""
Job Routes
----------
Core job management endpoints.

  POST /api/jobs/                        — create a new job
  GET  /api/jobs/                        — list all jobs
  GET  /api/jobs/{job_id}                — get job detail
  PATCH /api/jobs/{job_id}/status        — update job status
  POST /api/jobs/{job_id}/supply-list    — generate supply list from AI
  POST /api/jobs/{job_id}/field-note     — add a field note (Marcus)
  GET  /api/jobs/{job_id}/field-notes    — get all field notes for a job
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime

from app.database import get_db
from app.models.job import Job, JobStatus, JobVertical
from app.models.supply_and_field import JobSupplyItem, SupplySource, FieldNote
from app.services import ai_provider

router = APIRouter()


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class JobCreate(BaseModel):
    title: str
    customer_id: str
    service_location_id: str
    vertical: str = "hvac"
    scope_of_work: Optional[str] = None
    estimated_hours: Optional[float] = None
    labor_rate: Optional[float] = 110.0
    material_markup: Optional[float] = 30.0


class JobStatusUpdate(BaseModel):
    status: str


class FieldNoteCreate(BaseModel):
    note_text: str
    tech_id: str
    client_uuid: Optional[str] = None
    captured_at: Optional[str] = None
    note_type: str = "dictation"


class SupplyListRequest(BaseModel):
    dictation: str


# ── CREATE JOB ────────────────────────────────────────────────────────────────

@router.post("/")
async def create_job(
    job_data: JobCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new job record. Starts at 'estimate' status."""
    # Generate job number: TOS-YYYY-XXXX
    year = datetime.utcnow().year
    job_count_result = await db.execute(select(Job))
    job_count = len(job_count_result.scalars().all()) + 1
    job_number = f"TOS-{year}-{job_count:04d}"

    job = Job(
        job_number=job_number,
        title=job_data.title,
        customer_id=uuid.UUID(job_data.customer_id),
        service_location_id=uuid.UUID(job_data.service_location_id),
        vertical=JobVertical(job_data.vertical),
        scope_of_work=job_data.scope_of_work,
        estimated_hours=job_data.estimated_hours,
        labor_rate=job_data.labor_rate,
        material_markup=job_data.material_markup,
        status=JobStatus.estimate
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    return {
        "job_id": str(job.id),
        "job_number": job.job_number,
        "status": job.status,
        "message": "Job created successfully"
    }


# ── LIST JOBS ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_jobs(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all jobs, optionally filtered by status."""
    query = select(Job).order_by(Job.created_at.desc())
    if status:
        query = query.where(Job.status == JobStatus(status))

    result = await db.execute(query)
    jobs = result.scalars().all()

    return {
        "jobs": [
            {
                "job_id": str(j.id),
                "job_number": j.job_number,
                "title": j.title,
                "status": j.status,
                "vertical": j.vertical,
                "created_at": j.created_at.isoformat()
            }
            for j in jobs
        ],
        "total": len(jobs)
    }


# ── GET JOB DETAIL ────────────────────────────────────────────────────────────

@router.get("/{job_id}")
async def get_job(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get full job detail including AI analysis."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return {
        "job_id": str(job.id),
        "job_number": job.job_number,
        "title": job.title,
        "status": job.status,
        "vertical": job.vertical,
        "scope_of_work": job.scope_of_work,
        "ai_analysis": job.ai_analysis,
        "estimated_hours": float(job.estimated_hours) if job.estimated_hours else None,
        "actual_hours": float(job.actual_hours) if job.actual_hours else None,
        "labor_rate": float(job.labor_rate) if job.labor_rate else None,
        "material_markup": float(job.material_markup) if job.material_markup else None,
        "quote_total": float(job.quote_total) if job.quote_total else None,
        "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
        "created_at": job.created_at.isoformat(),
        "updated_at": job.updated_at.isoformat()
    }


# ── UPDATE STATUS ─────────────────────────────────────────────────────────────

@router.patch("/{job_id}/status")
async def update_job_status(
    job_id: str,
    update: JobStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update job status. Validates the transition is allowed."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    try:
        job.status = JobStatus(update.status)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status '{update.status}'. Valid values: {[s.value for s in JobStatus]}"
        )

    await db.commit()

    return {
        "job_id": job_id,
        "status": job.status,
        "message": f"Status updated to {job.status}"
    }


# ── GENERATE SUPPLY LIST ──────────────────────────────────────────────────────

@router.post("/{job_id}/supply-list")
async def generate_supply_list(
    job_id: str,
    request: SupplyListRequest,
    db: AsyncSession = Depends(get_db)
):
    """
    Generate AI supply list from photo analysis + technician dictation.
    Requires the job to have at least one analyzed photo.
    """
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.ai_analysis:
        raise HTTPException(
            status_code=400,
            detail="No photo analysis found. Upload and analyze photos first."
        )

    # Generate supply list via AI
    items = await ai_provider.generate_supply_list(
        equipment_data=job.ai_analysis,
        dictation=request.dictation,
        vertical=job.vertical.value
    )

    # Save items to database
    for item_data in items:
        item = JobSupplyItem(
            job_id=uuid.UUID(job_id),
            sku=item_data.get("sku"),
            description=item_data.get("description", ""),
            quantity=item_data.get("quantity", 1),
            unit=item_data.get("unit", "ea"),
            unit_cost=item_data.get("estimated_unit_cost", 0),
            source=SupplySource(item_data.get("source", "inferred")),
            is_approved=False
        )
        db.add(item)

    await db.commit()

    return {
        "job_id": job_id,
        "items_generated": len(items),
        "items": items,
        "message": "Supply list generated successfully"
    }


# ── ADD FIELD NOTE ─────────────────────────────────────────────────────────────

@router.post("/{job_id}/field-note")
async def add_field_note(
    job_id: str,
    note_data: FieldNoteCreate,
    db: AsyncSession = Depends(get_db)
):
    """
    Add a field note from Marcus.
    Accepts offline-captured notes — client_uuid prevents duplicates on sync.
    """
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check for duplicate (offline sync protection)
    if note_data.client_uuid:
        existing = await db.execute(
            select(FieldNote).where(FieldNote.client_uuid == note_data.client_uuid)
        )
        if existing.scalar_one_or_none():
            return {"message": "Note already synced", "duplicate": True}

    note = FieldNote(
        job_id=uuid.UUID(job_id),
        tech_id=uuid.UUID(note_data.tech_id),
        note_text=note_data.note_text,
        note_type=note_data.note_type,
        client_uuid=note_data.client_uuid or str(uuid.uuid4()),
        captured_at=note_data.captured_at,
        is_synced=True
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return {
        "note_id": str(note.id),
        "job_id": job_id,
        "captured_at": note.captured_at,
        "message": "Field note saved"
    }


# ── GET FIELD NOTES ────────────────────────────────────────────────────────────

@router.get("/{job_id}/field-notes")
async def get_field_notes(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all field notes for a job, ordered by capture time."""
    result = await db.execute(
        select(FieldNote)
        .where(FieldNote.job_id == uuid.UUID(job_id))
        .order_by(FieldNote.created_at)
    )
    notes = result.scalars().all()

    return {
        "job_id": job_id,
        "notes": [
            {
                "note_id": str(n.id),
                "note_text": n.note_text,
                "note_type": n.note_type,
                "captured_at": n.captured_at,
                "created_at": n.created_at.isoformat()
            }
            for n in notes
        ],
        "total": len(notes)
    }


# ── SET QUOTE TOTAL ───────────────────────────────────────────────────────────

class QuoteTotalUpdate(BaseModel):
    quote_total: float
    estimated_hours: Optional[float] = None
    labor_rate: Optional[float] = None
    material_markup: Optional[float] = None


@router.patch("/{job_id}/quote-total")
async def set_quote_total(
    job_id: str,
    data: QuoteTotalUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Set the customer-facing quote total.
    This is the price Jamie enters after reviewing the AI suggestion.
    Required before sending a quote to the customer.
    """
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.quote_total = data.quote_total
    if data.estimated_hours is not None:
        job.estimated_hours = data.estimated_hours
    if data.labor_rate is not None:
        job.labor_rate = data.labor_rate
    if data.material_markup is not None:
        job.material_markup = data.material_markup

    await db.commit()

    return {
        "job_id": job_id,
        "quote_total": float(job.quote_total),
        "message": "Quote total set successfully"
    }
@router.get("/{job_id}/supply-items")
async def get_supply_items(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all supply items for a job."""
    from app.models.supply_and_field import JobSupplyItem
    result = await db.execute(
        select(JobSupplyItem).where(
            JobSupplyItem.job_id == uuid.UUID(job_id)
        )
    )
    items = result.scalars().all()
    return {
        "job_id": job_id,
        "items": [
            {
                "item_id": str(i.id),
                "sku": i.sku,
                "description": i.description,
                "quantity": float(i.quantity),
                "unit": i.unit,
                "unit_cost": float(i.unit_cost) if i.unit_cost else None,
                "source": i.source,
                "is_approved": i.is_approved,
            }
            for i in items
        ],
        "total": len(items)
    }
@router.get("/dashboard/summary")
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db)
):
    """
    Aggregate business data for the dashboard AI flags.
    Returns jobs, invoices, and patterns for Claude to analyze.
    """
    from app.models.invoice import Invoice
    from datetime import datetime, timedelta

    # Get all jobs
    jobs_result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    jobs = jobs_result.scalars().all()

    # Get all invoices
    inv_result = await db.execute(select(Invoice).order_by(Invoice.created_at.desc()))
    invoices = inv_result.scalars().all()

    # Build summary data for AI
    now = datetime.utcnow()

    jobs_summary = [
        {
            "job_id": str(j.id),
            "job_number": j.job_number,
            "title": j.title,
            "status": j.status.value,
            "created_at": j.created_at.isoformat(),
            "days_open": (now - j.created_at).days,
            "quote_total": float(j.quote_total) if j.quote_total else None,
            "estimated_hours": float(j.estimated_hours) if j.estimated_hours else None,
            "actual_hours": float(j.actual_hours) if j.actual_hours else None,
        }
        for j in jobs
    ]

    invoices_summary = [
        {
            "invoice_id": str(i.id),
            "invoice_number": i.invoice_number,
            "status": i.status.value,
            "total_amount": float(i.total_amount) if i.total_amount else 0,
            "sent_at": i.sent_at.isoformat() if i.sent_at else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "days_outstanding": (now - i.sent_at).days if i.sent_at else None,
        }
        for i in invoices
    ]

    # Calculate patterns
    paid_invoices = [i for i in invoices if i.status.value == "paid" and i.sent_at and i.paid_at]
    avg_collection_days = (
        sum((i.paid_at - i.sent_at).days for i in paid_invoices) / len(paid_invoices)
        if paid_invoices else 11
    )

    completed_jobs = [j for j in jobs if j.actual_hours and j.estimated_hours]
    avg_hour_drift = (
        sum(float(j.actual_hours) - float(j.estimated_hours) for j in completed_jobs) / len(completed_jobs)
        if completed_jobs else 0
    )

    return {
        "jobs": jobs_summary,
        "invoices": invoices_summary,
        "patterns": {
            "avg_collection_days": round(avg_collection_days, 1),
            "avg_hour_drift": round(avg_hour_drift, 2),
            "total_jobs": len(jobs),
            "open_estimates": len([j for j in jobs if j.status.value == "estimate"]),
            "overdue_invoices": len([i for i in invoices if i.status.value == "sent" and i.due_date and i.due_date < now]),
        }
    }
@router.post("/dashboard/flags")
async def generate_dashboard_flags_endpoint(
    db: AsyncSession = Depends(get_db)
):
    """
    Generate AI-powered dashboard flags from business data.
    Calls Claude to analyze patterns and return actionable flags.
    """
    from app.models.invoice import Invoice

    # Get the summary data
    summary = await get_dashboard_summary(db)

    # Call AI
    flags = await ai_provider.generate_dashboard_flags(summary)

    return {
        "flags": flags,
        "generated_at": __import__('datetime').datetime.utcnow().isoformat()
    }
class SupplyItemUpdate(BaseModel):
    quantity: Optional[float] = None
    is_approved: Optional[bool] = None
    unit_cost: Optional[float] = None

@router.patch("/supply-items/{item_id}")
async def update_supply_item(
    item_id: str,
    data: SupplyItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update a supply item — quantity, approval status, or cost."""
    from app.models.supply_and_field import JobSupplyItem
    result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.id == uuid.UUID(item_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Supply item not found")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(item, field, value)

    await db.commit()
    return {"item_id": item_id, "message": "Supply item updated"}


@router.delete("/supply-items/{item_id}")
async def delete_supply_item(
    item_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Remove a supply item from a job."""
    from app.models.supply_and_field import JobSupplyItem
    result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.id == uuid.UUID(item_id))
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Supply item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Supply item removed"}


@router.post("/{job_id}/supply-items/add")
async def add_supply_item(
    job_id: str,
    data: dict,
    db: AsyncSession = Depends(get_db)
):
    """Add a custom supply item to a job."""
    from app.models.supply_and_field import JobSupplyItem
    item = JobSupplyItem(
        job_id=uuid.UUID(job_id),
        sku=data.get("sku"),
        description=data.get("description", ""),
        quantity=data.get("quantity", 1),
        unit=data.get("unit", "ea"),
        unit_cost=data.get("unit_cost"),
        source="manual",
        is_approved=True
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return {
        "item_id": str(item.id),
        "message": "Supply item added"
    }