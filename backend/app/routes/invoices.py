"""
Invoice Routes
--------------
Invoice assembly, Diana's review checklist, and send flow.

  POST /api/invoices/build/{job_id}          — build invoice from job record
  GET  /api/invoices/{invoice_id}            — get invoice detail
  GET  /api/invoices/job/{job_id}            — get invoice for a job
  PATCH /api/invoices/{invoice_id}/review    — update Diana's checklist
  POST /api/invoices/{invoice_id}/send       — send invoice (requires all checks)
  GET  /api/invoices/                        — list all invoices
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
from datetime import datetime, timedelta

from app.database import get_db
from app.models.invoice import Invoice, InvoiceStatus
from app.models.job import Job, JobStatus
from app.models.supply_and_field import ChangeOrder, ChangeOrderStatus

router = APIRouter()


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class ReviewUpdate(BaseModel):
    review_lines_verified: Optional[bool] = None
    review_hours_verified: Optional[bool] = None
    review_co_verified: Optional[bool] = None
    review_nocharge_verified: Optional[bool] = None
    review_total_verified: Optional[bool] = None


# ── BUILD INVOICE ─────────────────────────────────────────────────────────────

@router.post("/build/{job_id}")
async def build_invoice(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Build an invoice from the job record.
    Assembles line items from: approved quote + change orders + actual hours.
    Creates the invoice in 'draft' status for Diana to review.
    """
    # Get job
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if invoice already exists
    existing = await db.execute(
        select(Invoice).where(Invoice.job_id == uuid.UUID(job_id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=400,
            detail="Invoice already exists for this job. Use GET /api/invoices/job/{job_id}"
        )

    # Calculate totals
    # Labor: use actual hours if available, fall back to estimated
    labor_hours = float(job.actual_hours or job.estimated_hours or 0)
    labor_rate = float(job.labor_rate or 110)
    labor_total = labor_hours * labor_rate

    # Quote total (customer-facing price already set)
    quote_total = float(job.quote_total or 0)

    # Add approved change orders
    co_result = await db.execute(
        select(ChangeOrder).where(
            ChangeOrder.job_id == uuid.UUID(job_id),
            ChangeOrder.status == ChangeOrderStatus.approved
        )
    )
    change_orders = co_result.scalars().all()
    co_total = sum(float(co.additional_price or 0) for co in change_orders)

    # Total
    total = quote_total + co_total

    # Generate invoice number
    count_result = await db.execute(select(Invoice))
    count = len(count_result.scalars().all()) + 1
    year = datetime.utcnow().year
    invoice_number = f"INV-{year}-{count:04d}"

    invoice = Invoice(
        job_id=uuid.UUID(job_id),
        invoice_number=invoice_number,
        status=InvoiceStatus.draft,
        subtotal=total,
        tax_amount=0,
        total_amount=total,
        amount_paid=0,
        balance_due=total,
        due_date=datetime.utcnow() + timedelta(days=30),
        # Checklist starts all False — Diana must verify each item
        review_lines_verified=False,
        review_hours_verified=False,
        review_co_verified=False,
        review_nocharge_verified=False,
        review_total_verified=False,
    )
    db.add(invoice)

    # Update job status to complete
    job.status = JobStatus.complete
    await db.commit()
    await db.refresh(invoice)

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "job_id": job_id,
        "status": invoice.status,
        "total_amount": float(invoice.total_amount),
        "labor_hours": labor_hours,
        "labor_total": labor_total,
        "quote_total": quote_total,
        "change_order_total": co_total,
        "change_orders_included": len(change_orders),
        "diana_approved": invoice.diana_approved,
        "message": "Invoice built — ready for Diana's review"
    }


# ── GET INVOICE ───────────────────────────────────────────────────────────────

@router.get("/job/{job_id}")
async def get_invoice_for_job(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get the invoice for a specific job."""
    result = await db.execute(
        select(Invoice).where(Invoice.job_id == uuid.UUID(job_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="No invoice found for this job")

    return _invoice_response(invoice)


@router.get("/{invoice_id}")
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get invoice by ID."""
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return _invoice_response(invoice)


# ── LIST INVOICES ─────────────────────────────────────────────────────────────

@router.get("/")
async def list_invoices(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """List all invoices, optionally filtered by status."""
    query = select(Invoice).order_by(Invoice.created_at.desc())
    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))

    result = await db.execute(query)
    invoices = result.scalars().all()

    return {
        "invoices": [
            {
                "invoice_id": str(i.id),
                "invoice_number": i.invoice_number,
                "job_id": str(i.job_id),
                "status": i.status,
                "total_amount": float(i.total_amount),
                "balance_due": float(i.balance_due) if i.balance_due else None,
                "sent_at": i.sent_at.isoformat() if i.sent_at else None,
                "due_date": i.due_date.isoformat() if i.due_date else None,
                "diana_approved": i.diana_approved,
            }
            for i in invoices
        ],
        "total": len(invoices)
    }


# ── DIANA'S REVIEW CHECKLIST ──────────────────────────────────────────────────

@router.patch("/{invoice_id}/review")
async def update_review(
    invoice_id: str,
    data: ReviewUpdate,
    db: AsyncSession = Depends(get_db)
):
    """
    Update Diana's review checklist.
    All five items must be True before the invoice can be sent.
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.sent:
        raise HTTPException(status_code=400, detail="Invoice already sent")

    for field, value in data.model_dump(exclude_none=True).items():
        setattr(invoice, field, value)

    # If all checks pass, move to review status
    if invoice.diana_approved:
        invoice.status = InvoiceStatus.review

    await db.commit()

    return {
        "invoice_id": invoice_id,
        "diana_approved": invoice.diana_approved,
        "status": invoice.status,
        "checklist": {
            "lines_verified":    invoice.review_lines_verified,
            "hours_verified":    invoice.review_hours_verified,
            "co_verified":       invoice.review_co_verified,
            "nocharge_verified": invoice.review_nocharge_verified,
            "total_verified":    invoice.review_total_verified,
        },
        "message": "All checks passed — ready to send" if invoice.diana_approved else "Checklist updated"
    }


# ── SEND INVOICE ──────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/send")
async def send_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Send the invoice to the customer.
    Requires Diana's full checklist to be complete.
    In Phase 1: marks as sent and logs timestamp.
    In Phase 2: triggers Resend email with PDF and QuickBooks sync.
    """
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.sent:
        raise HTTPException(status_code=400, detail="Invoice already sent")

    if not invoice.diana_approved:
        raise HTTPException(
            status_code=400,
            detail="Diana's review checklist is not complete. All 5 items must be checked before sending."
        )

    # Mark as sent
    invoice.status = InvoiceStatus.sent
    invoice.sent_at = datetime.utcnow()

    # Update job status
    job_result = await db.execute(
        select(Job).where(Job.id == invoice.job_id)
    )
    job = job_result.scalar_one_or_none()
    if job:
        job.status = JobStatus.invoiced

    await db.commit()

    return {
        "invoice_id": invoice_id,
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "sent_at": invoice.sent_at.isoformat(),
        "total_amount": float(invoice.total_amount),
        "message": f"Invoice {invoice.invoice_number} sent successfully — Phase 2 will trigger Resend email + QuickBooks sync"
    }


# ── HELPER ────────────────────────────────────────────────────────────────────

def _invoice_response(invoice: Invoice) -> dict:
    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "job_id": str(invoice.job_id),
        "status": invoice.status,
        "subtotal": float(invoice.subtotal) if invoice.subtotal else None,
        "tax_amount": float(invoice.tax_amount) if invoice.tax_amount else None,
        "total_amount": float(invoice.total_amount),
        "amount_paid": float(invoice.amount_paid) if invoice.amount_paid else None,
        "balance_due": float(invoice.balance_due) if invoice.balance_due else None,
        "diana_approved": invoice.diana_approved,
        "checklist": {
            "lines_verified":    invoice.review_lines_verified,
            "hours_verified":    invoice.review_hours_verified,
            "co_verified":       invoice.review_co_verified,
            "nocharge_verified": invoice.review_nocharge_verified,
            "total_verified":    invoice.review_total_verified,
        },
        "sent_at":   invoice.sent_at.isoformat() if invoice.sent_at else None,
        "due_date":  invoice.due_date.isoformat() if invoice.due_date else None,
        "paid_at":   invoice.paid_at.isoformat() if invoice.paid_at else None,
        "quickbooks_invoice_id": invoice.quickbooks_invoice_id,
        "created_at": invoice.created_at.isoformat(),
    }
