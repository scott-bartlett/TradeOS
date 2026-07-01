"""
Invoice Routes
--------------
Invoice assembly, Diana's review checklist, send flow, and payment tracking.

  POST /api/invoices/build/{job_id}          — build invoice from job record
  GET  /api/invoices/                        — list all invoices
  GET  /api/invoices/job/{job_id}            — get invoice for a job
  GET  /api/invoices/{invoice_id}            — get invoice detail
  PATCH /api/invoices/{invoice_id}/review    — update Diana's checklist
  POST /api/invoices/{invoice_id}/send       — generate PDF + email customer
  POST /api/invoices/{invoice_id}/mark-paid  — record payment received
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
import io
import os
from datetime import datetime, timedelta

from app.database import get_db
from app.models.invoice import Invoice, InvoiceStatus
from app.models.job import Job, JobStatus
from app.models.supply_and_field import JobSupplyItem, ChangeOrder, ChangeOrderStatus
from app.models.customer import Customer

router = APIRouter()


# ── SCHEMAS ───────────────────────────────────────────────────────────────────

class ReviewUpdate(BaseModel):
    review_lines_verified: Optional[bool] = None
    review_hours_verified: Optional[bool] = None
    review_co_verified: Optional[bool] = None
    review_nocharge_verified: Optional[bool] = None
    review_total_verified: Optional[bool] = None


class SendInvoiceRequest(BaseModel):
    customer_email: str


class MarkPaidRequest(BaseModel):
    amount_paid: Optional[float] = None  # defaults to full balance


# ── PDF BUILDER ───────────────────────────────────────────────────────────────

def _build_invoice_pdf(job, invoice, customer, supply_items, change_orders,
                       ai_summary=None, customer_notes=None, service_location=None):
    from app.services.pdf_builders import build_invoice_pdf
    return build_invoice_pdf(job, invoice, customer, service_location,
                             supply_items, change_orders, ai_summary, customer_notes)


async def _send_email(to: str, subject: str, body: str,
                      attachment_bytes: bytes, attachment_name: str):
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    from_email = os.environ.get("FROM_EMAIL", "invoices@tradeos.app")

    if sendgrid_key:
        try:
            import sendgrid as sg_module
            from sendgrid.helpers.mail import (Mail, Attachment, FileContent,
                                               FileName, FileType, Disposition)
            import base64
            sg = sg_module.SendGridAPIClient(api_key=sendgrid_key)
            message = Mail(from_email=from_email, to_emails=to,
                           subject=subject, html_content=body)
            encoded = base64.b64encode(attachment_bytes).decode()
            message.attachment = Attachment(
                FileContent(encoded), FileName(attachment_name),
                FileType('application/pdf'), Disposition('attachment')
            )
            sg.send(message)
            return True
        except Exception as e:
            print(f"SendGrid error: {e}")
            return False
    else:
        print(f"\n{'='*60}")
        print(f"📧 INVOICE EMAIL (dev mode)")
        print(f"   To:      {to}")
        print(f"   Subject: {subject}")
        print(f"   Attach:  {attachment_name} ({len(attachment_bytes)} bytes)")
        print(f"{'='*60}\n")
        return True


# ── BUILD INVOICE ─────────────────────────────────────────────────────────────

@router.post("/build/{job_id}")
async def build_invoice(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    existing = await db.execute(
        select(Invoice).where(Invoice.job_id == uuid.UUID(job_id))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400,
                            detail="Invoice already exists for this job")

    labor_hours = float(job.actual_hours or job.estimated_hours or 0)
    labor_rate = float(job.labor_rate or 110)
    labor_total = labor_hours * labor_rate
    quote_total = float(job.quote_total or 0)

    co_result = await db.execute(
        select(ChangeOrder).where(
            ChangeOrder.job_id == uuid.UUID(job_id),
            ChangeOrder.status == ChangeOrderStatus.approved
        )
    )
    change_orders = co_result.scalars().all()
    co_total = sum(float(co.additional_price or 0) for co in change_orders)

    # Subtract deposit if received
    deposit = 0
    if hasattr(job, 'deposit_required') and job.deposit_received:
        deposit = float(job.deposit_required or 0)

    total = quote_total + co_total
    balance = total - deposit

    count_result = await db.execute(select(Invoice))
    count = len(count_result.scalars().all()) + 1
    invoice_number = f"INV-{datetime.utcnow().year}-{count:04d}"

    invoice = Invoice(
        job_id=uuid.UUID(job_id),
        invoice_number=invoice_number,
        status=InvoiceStatus.draft,
        subtotal=total,
        tax_amount=0,
        total_amount=total,
        amount_paid=deposit,
        balance_due=balance,
        due_date=datetime.utcnow() + timedelta(days=30),
        review_lines_verified=False,
        review_hours_verified=False,
        review_co_verified=False,
        review_nocharge_verified=False,
        review_total_verified=False,
    )
    db.add(invoice)
    job.status = JobStatus.complete
    await db.commit()
    await db.refresh(invoice)

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "job_id": job_id,
        "status": invoice.status,
        "total_amount": float(invoice.total_amount),
        "balance_due": float(invoice.balance_due),
        "deposit_applied": deposit,
        "diana_approved": invoice.diana_approved,
        "message": "Invoice built — ready for Diana's review"
    }


# ── LIST INVOICES ─────────────────────────────────────────────────────────────

@router.get("/")
async def list_invoices(
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    from app.models.customer import Customer

    query = select(Invoice).order_by(Invoice.created_at.desc())
    if status:
        query = query.where(Invoice.status == InvoiceStatus(status))
    result = await db.execute(query)
    invoices = result.scalars().all()

    invoice_list = []
    for i in invoices:
        # Get customer name via job
        customer_name = None
        job_title = None
        if i.job_id:
            job_result = await db.execute(select(Job).where(Job.id == i.job_id))
            job = job_result.scalar_one_or_none()
            if job:
                job_title = job.title
                if job.customer_id:
                    c_result = await db.execute(
                        select(Customer).where(Customer.id == job.customer_id)
                    )
                    customer = c_result.scalar_one_or_none()
                    if customer:
                        customer_name = customer.display_name

        invoice_list.append({
            "invoice_id": str(i.id),
            "invoice_number": i.invoice_number,
            "job_id": str(i.job_id),
            "job_title": job_title,
            "customer_name": customer_name,
            "status": i.status,
            "total_amount": float(i.total_amount),
            "balance_due": float(i.balance_due) if i.balance_due else None,
            "amount_paid": float(i.amount_paid) if i.amount_paid else 0,
            "sent_at": i.sent_at.isoformat() if i.sent_at else None,
            "due_date": i.due_date.isoformat() if i.due_date else None,
            "paid_at": i.paid_at.isoformat() if i.paid_at else None,
            "diana_approved": i.diana_approved,
            "created_at": i.created_at.isoformat(),
        })

    return {"invoices": invoice_list, "total": len(invoice_list)}

@router.get("/{invoice_id}/preview")
async def get_invoice_preview(invoice_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.customer import Customer, ServiceLocation
    from app.models.supply_and_field import JobSupplyItem, ChangeOrder, FieldNote
    from app.models.job import Job

    result = await db.execute(select(Invoice).where(Invoice.id == uuid.UUID(invoice_id)))
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    job_result = await db.execute(select(Job).where(Job.id == invoice.job_id))
    job = job_result.scalar_one_or_none()

    customer = None
    location = None
    if job:
        if job.customer_id:
            c_result = await db.execute(select(Customer).where(Customer.id == job.customer_id))
            customer = c_result.scalar_one_or_none()
        if job.service_location_id:
            l_result = await db.execute(select(ServiceLocation).where(ServiceLocation.id == job.service_location_id))
            location = l_result.scalar_one_or_none()

    items_result = await db.execute(select(JobSupplyItem).where(JobSupplyItem.job_id == invoice.job_id))
    supply_items = items_result.scalars().all()

    co_result = await db.execute(select(ChangeOrder).where(ChangeOrder.job_id == invoice.job_id))
    change_orders = co_result.scalars().all()

    notes_result = await db.execute(select(FieldNote).where(FieldNote.job_id == invoice.job_id).order_by(FieldNote.created_at))
    field_notes = notes_result.scalars().all()

    ai_summary = None
    try:
        from app.services.ai_provider import get_ai_response
        notes_text = " | ".join([n.note_text for n in field_notes[-5:]]) if field_notes else ""
        materials_text = ", ".join([i.description for i in supply_items[:8]]) if supply_items else ""
        cos_text = "; ".join([f"CO#{co.co_number}: {co.description}" for co in change_orders if co.status == "approved"])
        prompt = f"""Write a 2-3 sentence professional summary of completed work for a customer invoice.
Job: {job.title if job else "Electrical service"}
Scope: {job.scope_of_work if job else ""}
Materials used: {materials_text}
Field notes: {notes_text}
Change orders: {cos_text}
Write from the contractor's perspective, past tense. No pricing. No bullet points.
Return only the summary paragraph."""
        ai_summary = await get_ai_response(prompt, max_tokens=256)
    except Exception:
        ai_summary = f"Work completed for {job.title if job else 'electrical service'}."

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "total_amount": float(invoice.total_amount or 0),
        "balance_due": float(invoice.balance_due or invoice.total_amount or 0),
        "amount_paid": float(invoice.amount_paid or 0),
        "tax_amount": float(invoice.tax_amount or 0),
        "sent_at": invoice.sent_at.isoformat() if invoice.sent_at else None,
        "diana_approved": invoice.diana_approved,
        "ai_summary": ai_summary,
        "job": {"job_id": str(job.id), "title": job.title, "scope_of_work": job.scope_of_work, "labor_hours": float(job.actual_hours or job.estimated_hours or 0), "deposit_required": float(job.deposit_required or 0)} if job else None,
        "customer": {"display_name": customer.display_name, "email": customer.email or "", "billing_street": customer.billing_street or "", "billing_city": customer.billing_city or "", "billing_state": customer.billing_state or "", "billing_zip": customer.billing_zip or ""} if customer else None,
        "service_location": {"street": location.street or "", "city": location.city or "", "state": location.state or ""} if location else None,
        "supply_items": [{"description": i.description, "sku": i.sku, "quantity": float(i.quantity), "unit": i.unit} for i in supply_items],
        "change_orders": [{"co_number": co.co_number, "description": co.description, "status": co.status, "additional_price": float(co.additional_price or 0)} for co in change_orders if co.status == "approved"],
    }

# ── GET INVOICE ───────────────────────────────────────────────────────────────

@router.get("/job/{job_id}")
async def get_invoice_for_job(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where(Invoice.job_id == uuid.UUID(job_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="No invoice found for this job")
    return await _invoice_response(invoice, db)


@router.get("/{invoice_id}")
async def get_invoice(invoice_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return await _invoice_response(invoice, db)


# ── DIANA'S REVIEW CHECKLIST ──────────────────────────────────────────────────

@router.patch("/{invoice_id}/review")
async def update_review(invoice_id: str, data: ReviewUpdate,
                         db: AsyncSession = Depends(get_db)):
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
async def send_invoice(invoice_id: str, data: SendInvoiceRequest,
                       db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.sent:
        raise HTTPException(status_code=400, detail="Invoice already sent")
    if not invoice.diana_approved:
        raise HTTPException(status_code=400,
                            detail="Diana's checklist must be complete before sending")

    # Get job
    job_result = await db.execute(select(Job).where(Job.id == invoice.job_id))
    job = job_result.scalar_one_or_none()

    # Get customer
    customer_result = await db.execute(
        select(Customer).where(Customer.id == job.customer_id)
    )
    customer = customer_result.scalar_one_or_none()

    # Get supply items
    items_result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.job_id == invoice.job_id)
    )
    supply_items = items_result.scalars().all()

    # Get approved change orders
    co_result = await db.execute(
        select(ChangeOrder).where(
            ChangeOrder.job_id == invoice.job_id,
            ChangeOrder.status == ChangeOrderStatus.approved
        )
    )
    change_orders = co_result.scalars().all()

    # Build PDF
    pdf_bytes = _build_invoice_pdf(job, invoice, customer,
                                    supply_items, change_orders)

    # Email body
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1A6E45; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Invoice {invoice.invoice_number}</h1>
      </div>
      <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e5e7eb;">
        <p style="color: #374151;">Hi {customer.first_name or customer.display_name},</p>
        <p style="color: #374151;">Thank you for your business. Please find your invoice for
          <strong>{job.title}</strong> attached.</p>
        <p style="color: #374151;"><strong>Amount Due: ${float(invoice.balance_due or invoice.total_amount):,.2f}</strong></p>
        <p style="color: #374151;">Payment is due by
          <strong>{invoice.due_date.strftime('%B %d, %Y') if invoice.due_date else 'Net 30'}</strong>.</p>
        <p style="color: #6b7280; font-size: 13px; margin-top: 16px;">
          Questions? Reply to this email or call us directly.
        </p>
      </div>
    </div>
    """

    sent = await _send_email(
        to=data.customer_email,
        subject=f"Invoice {invoice.invoice_number} — {job.title}",
        body=email_body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{invoice.invoice_number}.pdf",
    )

    invoice.status = InvoiceStatus.sent
    invoice.sent_at = datetime.utcnow()
    if job:
        job.status = JobStatus.invoiced

    await db.commit()

    return {
        "invoice_id": invoice_id,
        "invoice_number": invoice.invoice_number,
        "status": invoice.status,
        "sent_to": data.customer_email,
        "email_sent": sent,
        "message": f"Invoice sent to {data.customer_email}" if sent else "Invoice marked sent but email failed",
    }


# ── MARK PAID ─────────────────────────────────────────────────────────────────

@router.post("/{invoice_id}/mark-paid")
async def mark_paid(invoice_id: str, data: MarkPaidRequest,
                    db: AsyncSession = Depends(get_db)):
    """Mark invoice as paid. Jamie flips this after QuickBooks confirms."""
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    amount = data.amount_paid if data.amount_paid else float(invoice.balance_due or invoice.total_amount)

    invoice.amount_paid = float(invoice.amount_paid or 0) + amount
    invoice.balance_due = max(0, float(invoice.total_amount) - float(invoice.amount_paid))
    invoice.status = InvoiceStatus.paid
    invoice.paid_at = datetime.utcnow()

@router.post("/{invoice_id}/revert")
async def revert_to_draft(invoice_id: str, db: AsyncSession = Depends(get_db)):
    """Revert a sent invoice back to draft so Jamie can fix mistakes."""
    result = await db.execute(
        select(Invoice).where(Invoice.id == uuid.UUID(invoice_id))
    )
    invoice = result.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    if invoice.status == InvoiceStatus.paid:
        raise HTTPException(status_code=400, detail="Cannot revert a paid invoice")

    invoice.status = InvoiceStatus.draft
    invoice.sent_at = None
    await db.commit()
    return {"message": "Invoice reverted to draft", "invoice_id": invoice_id}

    # Update job status
    job_result = await db.execute(select(Job).where(Job.id == invoice.job_id))
    job = job_result.scalar_one_or_none()
    if job:
        job.status = JobStatus.paid

    await db.commit()

    return {
        "invoice_id": invoice_id,
        "status": invoice.status,
        "amount_paid": float(invoice.amount_paid),
        "balance_due": float(invoice.balance_due),
        "paid_at": invoice.paid_at.isoformat(),
        "message": "Invoice marked as paid — job status updated to paid",
    }


# ── HELPER ────────────────────────────────────────────────────────────────────

async def _invoice_response(invoice: Invoice, db: AsyncSession) -> dict:
    # Get job for line item details
    job_result = await db.execute(select(Job).where(Job.id == invoice.job_id))
    job = job_result.scalar_one_or_none()

    # Get supply items
    items_result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.job_id == invoice.job_id)
    )
    supply_items = items_result.scalars().all()

    # Get change orders
    co_result = await db.execute(
        select(ChangeOrder).where(
            ChangeOrder.job_id == invoice.job_id,
            ChangeOrder.status == ChangeOrderStatus.approved
        )
    )
    change_orders = co_result.scalars().all()

    labor_hours = float(job.actual_hours or job.estimated_hours or 0) if job else 0
    labor_rate = float(job.labor_rate or 110) if job else 110

    return {
        "invoice_id": str(invoice.id),
        "invoice_number": invoice.invoice_number,
        "job_id": str(invoice.job_id),
        "job_title": job.title if job else None,
        "job_number": job.job_number if job else None,
        "status": invoice.status,
        "subtotal": float(invoice.subtotal) if invoice.subtotal else None,
        "tax_amount": float(invoice.tax_amount) if invoice.tax_amount else 0,
        "total_amount": float(invoice.total_amount),
        "amount_paid": float(invoice.amount_paid) if invoice.amount_paid else 0,
        "balance_due": float(invoice.balance_due) if invoice.balance_due else None,
        "diana_approved": invoice.diana_approved,
        "checklist": {
            "lines_verified":    invoice.review_lines_verified,
            "hours_verified":    invoice.review_hours_verified,
            "co_verified":       invoice.review_co_verified,
            "nocharge_verified": invoice.review_nocharge_verified,
            "total_verified":    invoice.review_total_verified,
        },
        "line_items": {
            "labor": {
                "hours": labor_hours,
                "rate": labor_rate,
                "total": labor_hours * labor_rate,
            },
            "materials": [
                {
                    "description": i.description,
                    "sku": i.sku,
                    "quantity": float(i.quantity),
                    "unit": i.unit,
                }
                for i in supply_items
            ],
            "change_orders": [
                {
                    "co_number": co.co_number,
                    "description": co.description,
                    "amount": float(co.additional_price or 0),
                }
                for co in change_orders
            ],
        },
        "sent_at":   invoice.sent_at.isoformat() if invoice.sent_at else None,
        "due_date":  invoice.due_date.isoformat() if invoice.due_date else None,
        "paid_at":   invoice.paid_at.isoformat() if invoice.paid_at else None,
        "quickbooks_invoice_id": invoice.quickbooks_invoice_id,
        "created_at": invoice.created_at.isoformat(),
    }
