"""
Job Routes
----------
Core job management endpoints.

  POST /api/jobs/                        — create a new job
  GET  /api/jobs/                        — list all jobs
  GET  /api/jobs/{job_id}                — get job detail
  PATCH /api/jobs/{job_id}/status        — update job status
  PATCH /api/jobs/{job_id}/quote-total   — set pricing fields
  PATCH /api/jobs/{job_id}/pricing       — update hours/rate/markup
  POST /api/jobs/{job_id}/send-quote     — generate PDF + send quote email
  PATCH /api/jobs/{job_id}/deposit       — mark deposit received
  POST /api/jobs/{job_id}/send-po        — send supply order PO email
  POST /api/jobs/{job_id}/supply-list    — generate supply list from AI
  POST /api/jobs/{job_id}/field-note     — add a field note
  GET  /api/jobs/{job_id}/field-notes    — get all field notes
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid
import io
import os
from datetime import datetime

from app.database import get_db
from app.models.job import Job, JobStatus, JobVertical
from app.models.supply_and_field import JobSupplyItem, SupplySource, FieldNote
from app.models.customer import Customer
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


class QuoteTotalUpdate(BaseModel):
    quote_total: float
    estimated_hours: Optional[float] = None
    labor_rate: Optional[float] = None
    material_markup: Optional[float] = None


class PricingUpdate(BaseModel):
    estimated_hours: Optional[float] = None
    labor_rate: Optional[float] = None
    material_markup: Optional[float] = None
    quote_total: Optional[float] = None
    deposit_required: Optional[float] = None


class SendQuoteRequest(BaseModel):
    customer_email: str
    quote_total: float
    estimated_hours: Optional[float] = None
    labor_rate: Optional[float] = None
    material_markup: Optional[float] = None
    notes: Optional[str] = None


class DepositUpdate(BaseModel):
    deposit_received: bool
    deposit_required: Optional[float] = None


class SupplyItemUpdate(BaseModel):
    quantity: Optional[float] = None
    is_approved: Optional[bool] = None
    unit_cost: Optional[float] = None


# ── HELPERS ───────────────────────────────────────────────────────────────────

def _build_quote_pdf(job: Job, supply_items: list, quote_total: float,
                     estimated_hours: float, labor_rate: float) -> bytes:
    """Generate customer-facing quote PDF. Never shows unit costs."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=0.75*inch, leftMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)

        green = colors.HexColor('#1A6E45')
        light_green = colors.HexColor('#E8F5EE')
        gray = colors.HexColor('#6B7280')
        dark = colors.HexColor('#111827')

        styles = getSampleStyleSheet()
        story = []

        # Header
        header_style = ParagraphStyle('header', fontSize=22, textColor=green,
                                       fontName='Helvetica-Bold', spaceAfter=4)
        sub_style = ParagraphStyle('sub', fontSize=10, textColor=gray,
                                    fontName='Helvetica', spaceAfter=2)
        story.append(Paragraph("TradeOS", header_style))
        story.append(Paragraph("Professional HVAC Services", sub_style))
        story.append(Paragraph(f"Quote #{job.quote_number or job.job_number}", sub_style))
        story.append(Spacer(1, 0.15*inch))
        story.append(HRFlowable(width="100%", thickness=2, color=green))
        story.append(Spacer(1, 0.15*inch))

        # Job info
        info_style = ParagraphStyle('info', fontSize=10, textColor=dark,
                                     fontName='Helvetica', spaceAfter=4)
        bold_style = ParagraphStyle('bold', fontSize=11, textColor=dark,
                                     fontName='Helvetica-Bold', spaceAfter=4)
        story.append(Paragraph(job.title, bold_style))
        story.append(Paragraph(f"Date: {datetime.utcnow().strftime('%B %d, %Y')}", info_style))
        story.append(Paragraph(f"Valid for {job.quote_valid_days or 30} days", info_style))
        story.append(Spacer(1, 0.15*inch))

        # Scope
        if job.scope_of_work:
            story.append(Paragraph("Scope of Work", bold_style))
            story.append(Paragraph(job.scope_of_work, info_style))
            story.append(Spacer(1, 0.1*inch))

        # Materials (description + qty only — no costs)
        if supply_items:
            story.append(Paragraph("Materials & Equipment", bold_style))
            table_data = [['Description', 'SKU', 'Qty', 'Unit']]
            for item in supply_items:
                table_data.append([
                    item.description or '',
                    item.sku or '—',
                    str(int(item.quantity) if item.quantity == int(item.quantity) else item.quantity),
                    item.unit or 'ea',
                ])
            t = Table(table_data, colWidths=[3.2*inch, 1.4*inch, 0.6*inch, 0.6*inch])
            t.setStyle(TableStyle([
                ('BACKGROUND',   (0,0), (-1,0), green),
                ('TEXTCOLOR',    (0,0), (-1,0), colors.white),
                ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTSIZE',     (0,0), (-1,-1), 9),
                ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_green]),
                ('GRID',         (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
                ('LEFTPADDING',  (0,0), (-1,-1), 8),
                ('RIGHTPADDING', (0,0), (-1,-1), 8),
                ('TOPPADDING',   (0,0), (-1,-1), 5),
                ('BOTTOMPADDING',(0,0), (-1,-1), 5),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.15*inch))

        # Labor
        story.append(Paragraph("Labor", bold_style))
        labor_data = [
            ['Estimated Hours', f"{estimated_hours} hrs"],
            ['Labor Rate',      f"${labor_rate:.2f}/hr"],
            ['Labor Subtotal',  f"${estimated_hours * labor_rate:,.2f}"],
        ]
        lt = Table(labor_data, colWidths=[3*inch, 2*inch])
        lt.setStyle(TableStyle([
            ('FONTSIZE',     (0,0), (-1,-1), 9),
            ('FONTNAME',     (0,1), (-1,-1), 'Helvetica'),
            ('FONTNAME',     (0,2), (-1,2), 'Helvetica-Bold'),
            ('TEXTCOLOR',    (0,0), (-1,-1), dark),
            ('LEFTPADDING',  (0,0), (-1,-1), 4),
            ('BOTTOMPADDING',(0,0), (-1,-1), 4),
        ]))
        story.append(lt)
        story.append(Spacer(1, 0.2*inch))

        # Total box
        total_data = [['TOTAL QUOTE', f"${quote_total:,.2f}"]]
        tt = Table(total_data, colWidths=[4.5*inch, 1.3*inch])
        tt.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,-1), green),
            ('TEXTCOLOR',    (0,0), (-1,-1), colors.white),
            ('FONTNAME',     (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE',     (0,0), (-1,-1), 14),
            ('ALIGN',        (1,0), (1,0), 'RIGHT'),
            ('LEFTPADDING',  (0,0), (-1,-1), 12),
            ('RIGHTPADDING', (0,0), (-1,-1), 12),
            ('TOPPADDING',   (0,0), (-1,-1), 10),
            ('BOTTOMPADDING',(0,0), (-1,-1), 10),
        ]))
        story.append(tt)
        story.append(Spacer(1, 0.2*inch))

        # Payment link placeholder
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB')))
        story.append(Spacer(1, 0.1*inch))
        pay_style = ParagraphStyle('pay', fontSize=10, textColor=green,
                                    fontName='Helvetica-Bold', alignment=TA_CENTER)
        story.append(Paragraph("To approve this quote and make a deposit, visit:", pay_style))
        link_style = ParagraphStyle('link', fontSize=10, textColor=gray,
                                     fontName='Helvetica', alignment=TA_CENTER)
        story.append(Paragraph(f"[Payment link — coming soon]", link_style))
        story.append(Spacer(1, 0.15*inch))

        # Footer
        footer_style = ParagraphStyle('footer', fontSize=8, textColor=gray,
                                       fontName='Helvetica', alignment=TA_CENTER)
        story.append(Paragraph(
            "This quote is valid for the period stated above. Prices subject to change after expiry. "
            "Thank you for your business.",
            footer_style
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        # Fallback plain text if reportlab not installed
        lines = [
            f"QUOTE — {job.title}",
            f"Quote #: {job.quote_number or job.job_number}",
            f"Date: {datetime.utcnow().strftime('%B %d, %Y')}",
            "",
            "MATERIALS:",
        ]
        for item in supply_items:
            lines.append(f"  {item.description} — qty {item.quantity} {item.unit or 'ea'}")
        lines += [
            "",
            f"LABOR: {estimated_hours} hrs @ ${labor_rate}/hr",
            f"TOTAL: ${quote_total:,.2f}",
        ]
        return "\n".join(lines).encode()


def _build_po_pdf(job: Job, supply_items: list) -> bytes:
    """Generate purchase order PDF for supplier."""
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=0.75*inch, leftMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)

        green = colors.HexColor('#1A6E45')
        light_green = colors.HexColor('#E8F5EE')
        gray = colors.HexColor('#6B7280')
        dark = colors.HexColor('#111827')

        styles = getSampleStyleSheet()
        story = []

        bold = ParagraphStyle('bold', fontSize=11, textColor=dark,
                               fontName='Helvetica-Bold', spaceAfter=4)
        normal = ParagraphStyle('normal', fontSize=10, textColor=dark,
                                 fontName='Helvetica', spaceAfter=3)
        gray_style = ParagraphStyle('gray', fontSize=9, textColor=gray,
                                     fontName='Helvetica', spaceAfter=2)

        # Header
        story.append(Paragraph("PURCHASE ORDER", ParagraphStyle(
            'po', fontSize=22, textColor=green, fontName='Helvetica-Bold', spaceAfter=4)))
        story.append(Paragraph("TradeOS", normal))
        po_number = f"PO-{job.job_number}-{datetime.utcnow().strftime('%Y%m%d')}"
        story.append(Paragraph(f"PO #: {po_number}", normal))
        story.append(Paragraph(f"Date: {datetime.utcnow().strftime('%B %d, %Y')}", normal))
        story.append(Spacer(1, 0.1*inch))
        story.append(HRFlowable(width="100%", thickness=2, color=green))
        story.append(Spacer(1, 0.15*inch))

        # Vendor + Job info side by side
        info_data = [
            ['VENDOR', 'JOB REFERENCE'],
            ['Johnstone Supply', job.title],
            ['[Branch Address]', f"Job #: {job.job_number}"],
            ['[City, State ZIP]', f"Date Needed: {datetime.utcnow().strftime('%B %d, %Y')}"],
        ]
        it = Table(info_data, colWidths=[3*inch, 3*inch])
        it.setStyle(TableStyle([
            ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',     (0,0), (-1,-1), 9),
            ('TEXTCOLOR',    (0,0), (-1,0), green),
            ('LEFTPADDING',  (0,0), (-1,-1), 0),
            ('BOTTOMPADDING',(0,0), (-1,-1), 3),
        ]))
        story.append(it)
        story.append(Spacer(1, 0.2*inch))

        # Line items
        story.append(Paragraph("Order Items", bold))
        table_data = [['SKU', 'Description', 'Qty', 'Unit', 'Unit Cost', 'Total']]
        po_total = 0
        for item in supply_items:
            unit_cost = float(item.unit_cost) if item.unit_cost else 0
            qty = float(item.quantity)
            line_total = unit_cost * qty
            po_total += line_total
            table_data.append([
                item.sku or '—',
                item.description,
                str(int(qty) if qty == int(qty) else qty),
                item.unit or 'ea',
                f"${unit_cost:.2f}",
                f"${line_total:.2f}",
            ])

        t = Table(table_data, colWidths=[1.1*inch, 2.5*inch, 0.5*inch, 0.5*inch, 0.8*inch, 0.8*inch])
        t.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,0), green),
            ('TEXTCOLOR',    (0,0), (-1,0), colors.white),
            ('FONTNAME',     (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE',     (0,0), (-1,-1), 8),
            ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, light_green]),
            ('GRID',         (0,0), (-1,-1), 0.5, colors.HexColor('#E5E7EB')),
            ('LEFTPADDING',  (0,0), (-1,-1), 6),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING',   (0,0), (-1,-1), 4),
            ('BOTTOMPADDING',(0,0), (-1,-1), 4),
            ('ALIGN',        (2,0), (-1,-1), 'RIGHT'),
        ]))
        story.append(t)
        story.append(Spacer(1, 0.15*inch))

        # PO Total
        total_data = [['PO TOTAL', f"${po_total:,.2f}"]]
        tt = Table(total_data, colWidths=[5.1*inch, 0.9*inch])
        tt.setStyle(TableStyle([
            ('BACKGROUND',   (0,0), (-1,-1), green),
            ('TEXTCOLOR',    (0,0), (-1,-1), colors.white),
            ('FONTNAME',     (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE',     (0,0), (-1,-1), 12),
            ('ALIGN',        (1,0), (1,0), 'RIGHT'),
            ('LEFTPADDING',  (0,0), (-1,-1), 10),
            ('RIGHTPADDING', (0,0), (-1,-1), 10),
            ('TOPPADDING',   (0,0), (-1,-1), 8),
            ('BOTTOMPADDING',(0,0), (-1,-1), 8),
        ]))
        story.append(tt)
        story.append(Spacer(1, 0.2*inch))

        # Notes
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor('#E5E7EB')))
        story.append(Spacer(1, 0.1*inch))
        story.append(Paragraph("Notes", bold))
        story.append(Paragraph("Please confirm availability and expected delivery date. "
                               "Contact us with any substitutions before shipping.", normal))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        lines = [f"PURCHASE ORDER — {job.job_number}", ""]
        for item in supply_items:
            cost = float(item.unit_cost) if item.unit_cost else 0
            lines.append(f"  {item.sku or '—'}  {item.description}  x{item.quantity}  ${cost:.2f}/ea")
        return "\n".join(lines).encode()


async def _send_email(to: str, subject: str, body: str,
                      attachment_bytes: bytes, attachment_name: str):
    """
    Send email with PDF attachment.
    Uses SendGrid if SENDGRID_API_KEY is set, otherwise logs to console.
    """
    sendgrid_key = os.environ.get("SENDGRID_API_KEY")
    from_email = os.environ.get("FROM_EMAIL", "quotes@tradeos.app")

    if sendgrid_key:
        try:
            import sendgrid as sg_module
            from sendgrid.helpers.mail import (Mail, Attachment, FileContent,
                                               FileName, FileType, Disposition)
            import base64

            sg = sg_module.SendGridAPIClient(api_key=sendgrid_key)
            message = Mail(
                from_email=from_email,
                to_emails=to,
                subject=subject,
                html_content=body,
            )
            encoded = base64.b64encode(attachment_bytes).decode()
            attachment = Attachment(
                FileContent(encoded),
                FileName(attachment_name),
                FileType('application/pdf'),
                Disposition('attachment'),
            )
            message.attachment = attachment
            sg.send(message)
            return True
        except Exception as e:
            print(f"SendGrid error: {e}")
            return False
    else:
        # Dev mode — log to console
        print(f"\n{'='*60}")
        print(f"📧 EMAIL (dev mode — no SENDGRID_API_KEY set)")
        print(f"   To:      {to}")
        print(f"   Subject: {subject}")
        print(f"   Attach:  {attachment_name} ({len(attachment_bytes)} bytes)")
        print(f"{'='*60}\n")
        return True


# ── CREATE JOB ────────────────────────────────────────────────────────────────

@router.post("/")
async def create_job(job_data: JobCreate, db: AsyncSession = Depends(get_db)):
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
        status=JobStatus.estimate,
        deposit_received=False,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return {"job_id": str(job.id), "job_number": job.job_number,
            "status": job.status, "message": "Job created successfully"}


# ── LIST JOBS ─────────────────────────────────────────────────────────────────

@router.get("/")
async def list_jobs(status: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    from app.models.customer import Customer, ServiceLocation
    query = select(Job).order_by(Job.created_at.desc())
    if status:
        query = query.where(Job.status == JobStatus(status))
    result = await db.execute(query)
    jobs = result.scalars().all()

    # Fetch customer and location info for each job
    job_list = []
    for j in jobs:
        customer = None
        location = None
        if j.customer_id:
            c_result = await db.execute(
                select(Customer).where(Customer.id == j.customer_id)
            )
            customer = c_result.scalar_one_or_none()
        if j.service_location_id:
            l_result = await db.execute(
                select(ServiceLocation).where(ServiceLocation.id == j.service_location_id)
            )
            location = l_result.scalar_one_or_none()

        job_list.append({
            "job_id": str(j.id),
            "job_number": j.job_number,
            "title": j.title,
            "status": j.status,
            "vertical": j.vertical,
            "customer_name": customer.display_name if customer else None,
            "service_address": f"{location.street}, {location.city}" if location else None,
            "service_city": location.city if location else None,
            "created_at": j.created_at.isoformat(),
        })

    return {"jobs": job_list, "total": len(job_list)}


# ── GET JOB DETAIL ────────────────────────────────────────────────────────────

@router.get("/dashboard/summary")
async def get_dashboard_summary(db: AsyncSession = Depends(get_db)):
    from app.models.invoice import Invoice
    jobs_result = await db.execute(select(Job).order_by(Job.created_at.desc()))
    jobs = jobs_result.scalars().all()
    inv_result = await db.execute(select(Invoice).order_by(Invoice.created_at.desc()))
    invoices = inv_result.scalars().all()
    now = datetime.utcnow()
    jobs_summary = [{"job_id": str(j.id), "job_number": j.job_number, "title": j.title,
                     "status": j.status.value, "created_at": j.created_at.isoformat(),
                     "days_open": (now - j.created_at).days,
                     "quote_total": float(j.quote_total) if j.quote_total else None,
                     "estimated_hours": float(j.estimated_hours) if j.estimated_hours else None,
                     "actual_hours": float(j.actual_hours) if j.actual_hours else None}
                    for j in jobs]
    invoices_summary = [{"invoice_id": str(i.id), "invoice_number": i.invoice_number,
                          "status": i.status.value,
                          "total_amount": float(i.total_amount) if i.total_amount else 0,
                          "sent_at": i.sent_at.isoformat() if i.sent_at else None,
                          "due_date": i.due_date.isoformat() if i.due_date else None,
                          "days_outstanding": (now - i.sent_at).days if i.sent_at else None}
                         for i in invoices]
    paid = [i for i in invoices if i.status.value == "paid" and i.sent_at and i.paid_at]
    avg_collection = sum((i.paid_at - i.sent_at).days for i in paid) / len(paid) if paid else 11
    completed = [j for j in jobs if j.actual_hours and j.estimated_hours]
    avg_drift = sum(float(j.actual_hours) - float(j.estimated_hours) for j in completed) / len(completed) if completed else 0
    return {"jobs": jobs_summary, "invoices": invoices_summary,
            "patterns": {"avg_collection_days": round(avg_collection, 1),
                         "avg_hour_drift": round(avg_drift, 2),
                         "total_jobs": len(jobs),
                         "open_estimates": len([j for j in jobs if j.status.value == "estimate"]),
                         "overdue_invoices": len([i for i in invoices if i.status.value == "sent"
                                                   and i.due_date and i.due_date < now])}}


@router.post("/dashboard/flags")
async def generate_dashboard_flags_endpoint(db: AsyncSession = Depends(get_db)):
    summary = await get_dashboard_summary(db)
    flags = await ai_provider.generate_dashboard_flags(summary)
    return {"flags": flags, "generated_at": datetime.utcnow().isoformat()}


@router.get("/{job_id}")
async def get_job(job_id: str, db: AsyncSession = Depends(get_db)):
    from app.models.customer import Customer, ServiceLocation

    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Get customer and location for display
    customer_name = None
    customer_email = None
    service_address = None
    service_city = None

    if job.customer_id:
        c_result = await db.execute(select(Customer).where(Customer.id == job.customer_id))
        customer = c_result.scalar_one_or_none()
        if customer:
            customer_name = customer.display_name
            customer_email = customer.email

    if job.service_location_id:
        l_result = await db.execute(
            select(ServiceLocation).where(ServiceLocation.id == job.service_location_id)
        )
        location = l_result.scalar_one_or_none()
        if location:
            service_address = f"{location.street}, {location.city}"
            service_city = location.city

    return {
        "job_id": str(job.id), "job_number": job.job_number, "title": job.title,
        "status": job.status, "vertical": job.vertical,
        "customer_name": customer_name,
        "customer_email": customer_email,
        "service_address": service_address,
        "service_city": service_city,
        "scope_of_work": job.scope_of_work, "ai_analysis": job.ai_analysis,
        "estimated_hours": float(job.estimated_hours) if job.estimated_hours else None,
        "actual_hours": float(job.actual_hours) if job.actual_hours else None,
        "labor_rate": float(job.labor_rate) if job.labor_rate else None,
        "material_markup": float(job.material_markup) if job.material_markup else None,
        "quote_total": float(job.quote_total) if job.quote_total else None,
        "quote_number": job.quote_number,
        "quote_sent_at": job.quote_sent_at.isoformat() if job.quote_sent_at else None,
        "quote_approved_at": job.quote_approved_at.isoformat() if job.quote_approved_at else None,
        "deposit_required": float(job.deposit_required) if job.deposit_required else None,
        "deposit_received": job.deposit_received or False,
        "scheduled_date": job.scheduled_date.isoformat() if job.scheduled_date else None,
        "created_at": job.created_at.isoformat(), "updated_at": job.updated_at.isoformat()
    }

# ── UPDATE STATUS ─────────────────────────────────────────────────────────────

@router.patch("/{job_id}/status")
async def update_job_status(job_id: str, update: JobStatusUpdate,
                             db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        job.status = JobStatus(update.status)
    except ValueError:
        raise HTTPException(status_code=400,
                            detail=f"Invalid status '{update.status}'")
    await db.commit()
    return {"job_id": job_id, "status": job.status}


# ── UPDATE PRICING ────────────────────────────────────────────────────────────

@router.patch("/{job_id}/pricing")
async def update_pricing(job_id: str, data: PricingUpdate,
                          db: AsyncSession = Depends(get_db)):
    """Update hours, rate, markup, quote total, and deposit amount."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if data.estimated_hours is not None:
        job.estimated_hours = data.estimated_hours
    if data.labor_rate is not None:
        job.labor_rate = data.labor_rate
    if data.material_markup is not None:
        job.material_markup = data.material_markup
    if data.quote_total is not None:
        job.quote_total = data.quote_total
    if data.deposit_required is not None:
        job.deposit_required = data.deposit_required

    await db.commit()
    return {
        "job_id": job_id,
        "estimated_hours": float(job.estimated_hours) if job.estimated_hours else None,
        "labor_rate": float(job.labor_rate) if job.labor_rate else None,
        "material_markup": float(job.material_markup) if job.material_markup else None,
        "quote_total": float(job.quote_total) if job.quote_total else None,
        "deposit_required": float(job.deposit_required) if job.deposit_required else None,
    }


# ── SEND QUOTE ────────────────────────────────────────────────────────────────

@router.post("/{job_id}/send-quote")
async def send_quote(job_id: str, data: SendQuoteRequest,
                     db: AsyncSession = Depends(get_db)):
    """
    Generate quote PDF and email it to the customer.
    Updates job status to 'quoted' and saves quote_sent_at.
    """
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Save pricing to job
    job.quote_total = data.quote_total
    if data.estimated_hours:
        job.estimated_hours = data.estimated_hours
    if data.labor_rate:
        job.labor_rate = data.labor_rate
    if data.material_markup:
        job.material_markup = data.material_markup

    # Generate quote number if not set
    if not job.quote_number:
        job.quote_number = f"Q-{job.job_number}"

    # Get supply items
    items_result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.job_id == uuid.UUID(job_id))
    )
    supply_items = items_result.scalars().all()

    # Build PDF
    pdf_bytes = _build_quote_pdf(
        job=job,
        supply_items=supply_items,
        quote_total=data.quote_total,
        estimated_hours=data.estimated_hours or float(job.estimated_hours or 0),
        labor_rate=data.labor_rate or float(job.labor_rate or 110),
    )

    # Email body
    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1A6E45; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Your Quote is Ready</h1>
      </div>
      <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e5e7eb;">
        <p style="color: #374151;">Hi there,</p>
        <p style="color: #374151;">Please find your quote for <strong>{job.title}</strong> attached.</p>
        <p style="color: #374151;"><strong>Quote Total: ${data.quote_total:,.2f}</strong></p>
        <p style="color: #374151;">This quote is valid for {job.quote_valid_days or 30} days.</p>
        <div style="margin: 24px 0;">
          <a href="#" style="background: #1A6E45; color: white; padding: 12px 24px;
             border-radius: 6px; text-decoration: none; font-weight: bold;">
            Review &amp; Approve Quote
          </a>
        </div>
        <p style="color: #6b7280; font-size: 13px;">
          Questions? Reply to this email or call us directly.
        </p>
      </div>
    </div>
    """

    sent = await _send_email(
        to=data.customer_email,
        subject=f"Your Quote — {job.title} ({job.quote_number})",
        body=email_body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{job.quote_number}.pdf",
    )

    # Update job
    job.status = JobStatus.quoted
    job.quote_sent_at = datetime.utcnow()
    await db.commit()

    return {
        "job_id": job_id,
        "quote_number": job.quote_number,
        "status": job.status,
        "sent_to": data.customer_email,
        "email_sent": sent,
        "message": "Quote sent successfully" if sent else "Quote saved but email failed",
    }


# ── DEPOSIT ───────────────────────────────────────────────────────────────────

@router.patch("/{job_id}/deposit")
async def update_deposit(job_id: str, data: DepositUpdate,
                          db: AsyncSession = Depends(get_db)):
    """Mark deposit as received. Unlocks supply order."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    job.deposit_received = data.deposit_received
    if data.deposit_required is not None:
        job.deposit_required = data.deposit_required

    # Auto-advance status to approved when deposit received
    if data.deposit_received and job.status == JobStatus.quoted:
        job.status = JobStatus.approved
        job.quote_approved_at = datetime.utcnow()

    await db.commit()
    return {
        "job_id": job_id,
        "deposit_received": job.deposit_received,
        "status": job.status,
        "message": "Deposit marked as received — supply order unlocked" if data.deposit_received else "Deposit status updated",
    }


# ── SEND SUPPLY ORDER (PO) ────────────────────────────────────────────────────

@router.post("/{job_id}/send-po")
async def send_purchase_order(job_id: str, db: AsyncSession = Depends(get_db)):
    """
    Generate PO PDF and email to supplier.
    Only allowed after deposit_received = True.
    """
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if not job.deposit_received:
        raise HTTPException(status_code=400,
                            detail="Cannot send PO until deposit is received")

    # Get approved supply items only
    items_result = await db.execute(
        select(JobSupplyItem).where(
            JobSupplyItem.job_id == uuid.UUID(job_id),
            JobSupplyItem.is_approved == True,
        )
    )
    supply_items = items_result.scalars().all()

    if not supply_items:
        raise HTTPException(status_code=400, detail="No approved supply items to order")

    pdf_bytes = _build_po_pdf(job=job, supply_items=supply_items)

    supplier_email = os.environ.get("SUPPLIER_EMAIL", "purchasing@johnstone.com")
    po_number = f"PO-{job.job_number}-{datetime.utcnow().strftime('%Y%m%d')}"

    po_total = sum(
        float(i.unit_cost or 0) * float(i.quantity) for i in supply_items
    )

    email_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <div style="background: #1A6E45; padding: 24px; border-radius: 8px 8px 0 0;">
        <h1 style="color: white; margin: 0; font-size: 22px;">Purchase Order — {po_number}</h1>
      </div>
      <div style="padding: 24px; background: #f9f9f9; border: 1px solid #e5e7eb;">
        <p><strong>Job:</strong> {job.title} ({job.job_number})</p>
        <p><strong>Items:</strong> {len(supply_items)}</p>
        <p><strong>PO Total:</strong> ${po_total:,.2f}</p>
        <p>Please see the attached PO for full item details.
           Confirm availability and expected delivery date.</p>
      </div>
    </div>
    """

    sent = await _send_email(
        to=supplier_email,
        subject=f"Purchase Order {po_number} — {job.title}",
        body=email_body,
        attachment_bytes=pdf_bytes,
        attachment_name=f"{po_number}.pdf",
    )

    # Mark items as PO sent
    for item in supply_items:
        item.po_sent = True
    await db.commit()

    return {
        "job_id": job_id,
        "po_number": po_number,
        "items_ordered": len(supply_items),
        "po_total": po_total,
        "sent_to": supplier_email,
        "email_sent": sent,
        "message": f"PO sent to {supplier_email}" if sent else "PO generated but email failed",
    }


# ── SUPPLY ITEMS ──────────────────────────────────────────────────────────────

@router.get("/{job_id}/supply-items")
async def get_supply_items(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(JobSupplyItem).where(JobSupplyItem.job_id == uuid.UUID(job_id))
    )
    items = result.scalars().all()
    return {
        "job_id": job_id,
        "items": [{"item_id": str(i.id), "sku": i.sku, "description": i.description,
                   "quantity": float(i.quantity), "unit": i.unit,
                   "unit_cost": float(i.unit_cost) if i.unit_cost else None,
                   "source": i.source, "is_approved": i.is_approved} for i in items],
        "total": len(items)
    }


@router.patch("/supply-items/{item_id}")
async def update_supply_item(item_id: str, data: SupplyItemUpdate,
                              db: AsyncSession = Depends(get_db)):
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
async def delete_supply_item(item_id: str, db: AsyncSession = Depends(get_db)):
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
async def add_supply_item(job_id: str, data: dict,
                           db: AsyncSession = Depends(get_db)):
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
    return {"item_id": str(item.id), "message": "Supply item added"}


# ── GENERATE SUPPLY LIST ──────────────────────────────────────────────────────

@router.post("/{job_id}/supply-list")
async def generate_supply_list(job_id: str, request: SupplyListRequest,
                                db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if not job.ai_analysis:
        raise HTTPException(status_code=400,
                            detail="No photo analysis found. Upload and analyze photos first.")
    items = await ai_provider.generate_supply_list(
        equipment_data=job.ai_analysis,
        dictation=request.dictation,
        vertical=job.vertical.value
    )
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
    return {"job_id": job_id, "items_generated": len(items), "items": items}


# ── FIELD NOTES ───────────────────────────────────────────────────────────────

@router.post("/{job_id}/field-note")
async def add_field_note(job_id: str, note_data: FieldNoteCreate,
                          db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    if note_data.client_uuid:
        existing = await db.execute(
            select(FieldNote).where(FieldNote.client_uuid == note_data.client_uuid)
        )
        if existing.scalar_one_or_none():
            return {"message": "Note already synced", "duplicate": True}
    note = FieldNote(
        job_id=uuid.UUID(job_id), tech_id=uuid.UUID(note_data.tech_id),
        note_text=note_data.note_text, note_type=note_data.note_type,
        client_uuid=note_data.client_uuid or str(uuid.uuid4()),
        captured_at=note_data.captured_at, is_synced=True
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return {"note_id": str(note.id), "job_id": job_id,
            "captured_at": note.captured_at, "message": "Field note saved"}


@router.get("/{job_id}/field-notes")
async def get_field_notes(job_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(FieldNote).where(FieldNote.job_id == uuid.UUID(job_id))
        .order_by(FieldNote.created_at)
    )
    notes = result.scalars().all()
    return {
        "job_id": job_id,
        "notes": [{"note_id": str(n.id), "note_text": n.note_text,
                   "note_type": n.note_type, "captured_at": n.captured_at,
                   "created_at": n.created_at.isoformat()} for n in notes],
        "total": len(notes)
    }


# ── QUOTE TOTAL (legacy — keep for compatibility) ─────────────────────────────

@router.patch("/{job_id}/quote-total")
async def set_quote_total(job_id: str, data: QuoteTotalUpdate,
                           db: AsyncSession = Depends(get_db)):
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
    return {"job_id": job_id, "quote_total": float(job.quote_total)}
