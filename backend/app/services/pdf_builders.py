"""
PDF Builders — Alki Electric
-----------------------------
Shared PDF generation for quotes and invoices.
Logo and company info are embedded — no external dependencies at runtime.

Usage:
    from app.pdf_builders import build_quote_pdf, build_invoice_pdf
"""

import io
import base64
import os
from datetime import datetime

# ── COMPANY CONFIG ─────────────────────────────────────────────────────────────
# Replace with real values from company settings once that feature is built

COMPANY = {
    "name":    "Alki Electric",
    "address": "Seattle, WA",
    "phone":   "(206) 250-0248",
    "email":   "info@alkielectric.com",
    "license": "EL-XXXXXXX",          # placeholder — update when available
    "website": "alkielectric.com",
}

# Load logo from file next to this module, fallback to None
_LOGO_PATH = os.path.join(os.path.dirname(__file__), "alki_logo.png")


def _get_logo_image(inch):
    """Return a ReportLab Image object for the logo, or None if unavailable."""
    try:
        from reportlab.platypus import Image as RLImage
        if os.path.exists(_LOGO_PATH):
            return RLImage(_LOGO_PATH, width=0.9*inch, height=0.9*inch)
    except Exception:
        pass
    return None


# ── SHARED STYLES ──────────────────────────────────────────────────────────────

def _get_styles(inch, colors, ParagraphStyle, TA_LEFT, TA_RIGHT, TA_CENTER):
    gray  = colors.HexColor('#6B7280')
    dark  = colors.HexColor('#111827')
    black = colors.HexColor('#000000')

    return {
        "company_name": ParagraphStyle('company_name', fontSize=20,
                         textColor=black, fontName='Helvetica-Bold', spaceAfter=2),
        "company_sub":  ParagraphStyle('company_sub', fontSize=8,
                         textColor=gray, fontName='Helvetica', spaceAfter=1),
        "doc_title":    ParagraphStyle('doc_title', fontSize=14,
                         textColor=black, fontName='Helvetica-Bold',
                         spaceAfter=3, alignment=TA_RIGHT),
        "doc_number":   ParagraphStyle('doc_number', fontSize=10,
                         textColor=gray, fontName='Helvetica',
                         spaceAfter=2, alignment=TA_RIGHT),
        "section_head": ParagraphStyle('section_head', fontSize=9,
                         textColor=gray, fontName='Helvetica-Bold',
                         spaceAfter=4, spaceBefore=6),
        "body":         ParagraphStyle('body', fontSize=9,
                         textColor=dark, fontName='Helvetica', spaceAfter=3),
        "body_bold":    ParagraphStyle('body_bold', fontSize=9,
                         textColor=dark, fontName='Helvetica-Bold', spaceAfter=3),
        "ai_summary":   ParagraphStyle('ai_summary', fontSize=9,
                         textColor=dark, fontName='Helvetica',
                         spaceAfter=6, leading=14),
        "footer":       ParagraphStyle('footer', fontSize=7.5,
                         textColor=gray, fontName='Helvetica',
                         alignment=TA_CENTER),
        "total_label":  ParagraphStyle('total_label', fontSize=10,
                         textColor=dark, fontName='Helvetica-Bold'),
        "total_value":  ParagraphStyle('total_value', fontSize=12,
                         textColor=black, fontName='Helvetica-Bold',
                         alignment=TA_RIGHT),
    }


def _header_table(story, doc_type, doc_number, doc_date,
                  customer, service_location, job,
                  inch, colors, Paragraph, Table, TableStyle,
                  Spacer, HRFlowable, Image, styles):
    """Build the top header: logo+company on left, doc info on right."""
    from reportlab.platypus import Image as RLImage

    dark  = colors.HexColor('#111827')
    gray  = colors.HexColor('#6B7280')
    black = colors.HexColor('#000000')

    # Left: logo + company info
    logo = _get_logo_image(inch)
    if logo:
        from reportlab.platypus import KeepInFrame
        company_lines = [
            Paragraph(COMPANY["name"],    styles["company_name"]),
            Paragraph(COMPANY["address"], styles["company_sub"]),
            Paragraph(COMPANY["phone"],   styles["company_sub"]),
            Paragraph(COMPANY["email"],   styles["company_sub"]),
            Paragraph(f"Lic: {COMPANY['license']}", styles["company_sub"]),
        ]
        left_content = [[logo, company_lines]]
        left_table = Table(left_content, colWidths=[1.1*inch, 3*inch])
        left_table.setStyle(TableStyle([
            ('VALIGN', (0,0), (-1,-1), 'TOP'),
            ('LEFTPADDING', (0,0), (-1,-1), 0),
            ('RIGHTPADDING', (0,0), (-1,-1), 6),
            ('TOPPADDING', (0,0), (-1,-1), 0),
            ('BOTTOMPADDING', (0,0), (-1,-1), 0),
        ]))
    else:
        left_table = Paragraph(COMPANY["name"], styles["company_name"])

    # Right: document type + number + date
    right_content = [
        Paragraph(doc_type, styles["doc_title"]),
        Paragraph(f"#{doc_number}", styles["doc_number"]),
        Paragraph(f"Date: {doc_date}", styles["doc_number"]),
    ]
    if doc_type == "QUOTE":
        right_content.append(
            Paragraph(f"Valid for {job.quote_valid_days or 30} days", styles["doc_number"])
        )
    else:
        right_content.append(
            Paragraph("Due on Receipt", styles["doc_number"])
        )

    header = Table([[left_table, right_content]],
                   colWidths=[4.2*inch, 2.55*inch])
    header.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('RIGHTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 0.1*inch))
    story.append(HRFlowable(width="100%", thickness=1,
                             color=colors.HexColor('#D1D5DB')))
    story.append(Spacer(1, 0.15*inch))

    # Bill To + Job Site side by side
    customer_name = customer.display_name if customer else "—"
    customer_addr = ""
    if customer:
        parts = [
            customer.billing_street or "",
            f"{customer.billing_city or ''}, {customer.billing_state or ''} {customer.billing_zip or ''}".strip(", "),
            customer.email or "",
        ]
        customer_addr = "\n".join(p for p in parts if p.strip(", "))

    site_addr = ""
    if service_location:
        site_parts = [
            service_location.street or "",
            f"{service_location.city or ''}, {service_location.state or ''}",
        ]
        site_addr = "\n".join(p for p in site_parts if p.strip(", "))

    bill_to = [
        Paragraph("BILL TO", styles["section_head"]),
        Paragraph(customer_name, styles["body_bold"]),
        Paragraph(customer_addr.replace('\n', '<br/>'), styles["body"]),
    ]
    job_info = [
        Paragraph("JOB", styles["section_head"]),
        Paragraph(job.title, styles["body_bold"]),
        Paragraph(site_addr.replace('\n', '<br/>'), styles["body"]),
    ]

    billing_row = Table([[bill_to, job_info]],
                        colWidths=[3.4*inch, 3.35*inch])
    billing_row.setStyle(TableStyle([
        ('VALIGN', (0,0), (-1,-1), 'TOP'),
        ('LEFTPADDING', (0,0), (-1,-1), 0),
        ('TOPPADDING', (0,0), (-1,-1), 0),
        ('BOTTOMPADDING', (0,0), (-1,-1), 0),
    ]))
    story.append(billing_row)
    story.append(Spacer(1, 0.15*inch))
    story.append(HRFlowable(width="100%", thickness=0.5,
                             color=colors.HexColor('#E5E7EB')))
    story.append(Spacer(1, 0.15*inch))


# ── QUOTE PDF ──────────────────────────────────────────────────────────────────

def build_quote_pdf(job, supply_items: list, quote_total: float,
                    estimated_hours: float, labor_rate: float,
                    customer=None, service_location=None,
                    ai_summary: str = None,
                    customer_notes: str = None,
                    change_orders: list = None) -> bytes:
    """
    Customer-facing quote PDF.
    - No unit costs shown anywhere
    - AI summary of work to be done
    - Materials: description + qty only
    - Labor: hours only
    - Totals: quote total + deposit if set
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                         Table, TableStyle, HRFlowable, Image)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=0.75*inch, leftMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)

        gray       = colors.HexColor('#6B7280')
        dark       = colors.HexColor('#111827')
        light_gray = colors.HexColor('#F9FAFB')
        border     = colors.HexColor('#E5E7EB')

        styles = _get_styles(inch, colors, ParagraphStyle,
                              TA_LEFT, TA_RIGHT, TA_CENTER)
        story  = []

        doc_date   = datetime.utcnow().strftime('%B %d, %Y')
        doc_number = job.quote_number or job.job_number

        # Header
        _header_table(story, "QUOTE", doc_number, doc_date,
                      customer, service_location, job,
                      inch, colors, Paragraph, Table, TableStyle,
                      Spacer, HRFlowable, Image, styles)

        # AI Summary
        if ai_summary:
            story.append(Paragraph("About This Quote", styles["section_head"]))
            story.append(Paragraph(ai_summary, styles["ai_summary"]))
            story.append(Spacer(1, 0.1*inch))

        # Materials — qty only, no prices
        if supply_items:
            story.append(Paragraph("Materials & Equipment", styles["section_head"]))
            rows = [['Description', 'SKU', 'Qty', 'Unit']]
            for item in supply_items:
                qty = float(item.quantity)
                rows.append([
                    item.description or '',
                    item.sku or '—',
                    str(int(qty) if qty == int(qty) else qty),
                    item.unit or 'ea',
                ])
            t = Table(rows, colWidths=[3.4*inch, 1.3*inch, 0.6*inch, 0.65*inch])
            t.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, light_gray]),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('LINEBELOW',     (0,1), (-1,-1), 0.3, border),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('RIGHTPADDING',  (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.12*inch))

        # Labor — hours only
        if estimated_hours > 0:
            story.append(Paragraph("Labor", styles["section_head"]))
            rows = [['Description', 'Estimated Hours']]
            rows.append([f"Electrical Service — {job.title}",
                         f"{estimated_hours:.1f} hrs"])
            lt = Table(rows, colWidths=[5.0*inch, 1.75*inch])
            lt.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white]),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('ALIGN',         (1,0), (1,-1), 'RIGHT'),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('RIGHTPADDING',  (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(lt)
            story.append(Spacer(1, 0.15*inch))

        # Change orders — description only
        if change_orders:
            story.append(Paragraph("Additional Work", styles["section_head"]))
            rows = [['Description']]
            for co in change_orders:
                rows.append([f"CO #{co.co_number}: {co.description}"])
            ct = Table(rows, colWidths=[6.75*inch])
            ct.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(ct)
            story.append(Spacer(1, 0.15*inch))

        # Totals
        story.append(HRFlowable(width="100%", thickness=0.5, color=border))
        story.append(Spacer(1, 0.1*inch))

        deposit = float(job.deposit_required or 0) if hasattr(job, 'deposit_required') else 0
        totals_rows = [['Quote Total', f"${quote_total:,.2f}"]]
        if deposit > 0:
            totals_rows.append([f"Deposit Required", f"${deposit:,.2f}"])
            totals_rows.append(["Balance Due at Completion",
                                 f"${max(0, quote_total - deposit):,.2f}"])

        tt = Table(totals_rows, colWidths=[5.4*inch, 1.35*inch])
        tt.setStyle(TableStyle([
            ('FONTNAME',      (0,0), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE',      (0,0), (0,0), 11),
            ('FONTSIZE',      (1,0), (1,0), 13),
            ('FONTSIZE',      (0,1), (-1,-1), 9),
            ('TEXTCOLOR',     (0,0), (-1,-1), dark),
            ('ALIGN',         (1,0), (1,-1), 'RIGHT'),
            ('LEFTPADDING',   (0,0), (-1,-1), 6),
            ('RIGHTPADDING',  (0,0), (-1,-1), 6),
            ('TOPPADDING',    (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ]))
        story.append(tt)
        story.append(Spacer(1, 0.15*inch))

        # Customer notes
        if customer_notes:
            story.append(HRFlowable(width="100%", thickness=0.5, color=border))
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("Notes", styles["section_head"]))
            story.append(Paragraph(customer_notes, styles["body"]))
            story.append(Spacer(1, 0.1*inch))

        # Footer
        story.append(HRFlowable(width="100%", thickness=0.5, color=border))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            f"This quote is valid for {job.quote_valid_days or 30} days from the date issued. "
            f"Prices subject to change after expiry. "
            f"Questions? Contact us at {COMPANY['email']} or {COMPANY['phone']}. "
            f"Thank you for choosing {COMPANY['name']}.",
            styles["footer"]
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        lines = [f"QUOTE — {job.title}", f"Quote #: {doc_number}",
                 f"Total: ${quote_total:,.2f}"]
        return "\n".join(lines).encode()


# ── INVOICE PDF ────────────────────────────────────────────────────────────────

def build_invoice_pdf(job, invoice, customer=None, service_location=None,
                      supply_items: list = None, change_orders: list = None,
                      ai_summary: str = None,
                      customer_notes: str = None) -> bytes:
    """
    Customer-facing invoice PDF.
    - No unit costs shown
    - AI summary of work completed
    - Materials: description + qty only
    - Labor: hours only
    - Totals: subtotal, deposit credit, balance due
    """
    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import inch
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
        from reportlab.platypus import (SimpleDocTemplate, Paragraph, Spacer,
                                         Table, TableStyle, HRFlowable, Image)

        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter,
                                rightMargin=0.75*inch, leftMargin=0.75*inch,
                                topMargin=0.75*inch, bottomMargin=0.75*inch)

        gray       = colors.HexColor('#6B7280')
        dark       = colors.HexColor('#111827')
        light_gray = colors.HexColor('#F9FAFB')
        border     = colors.HexColor('#E5E7EB')

        styles = _get_styles(inch, colors, ParagraphStyle,
                              TA_LEFT, TA_RIGHT, TA_CENTER)
        story  = []

        doc_date   = datetime.utcnow().strftime('%B %d, %Y')
        doc_number = invoice.invoice_number

        # Header
        _header_table(story, "INVOICE", doc_number, doc_date,
                      customer, service_location, job,
                      inch, colors, Paragraph, Table, TableStyle,
                      Spacer, HRFlowable, Image, styles)

        # AI Summary
        if ai_summary:
            story.append(Paragraph("Work Completed", styles["section_head"]))
            story.append(Paragraph(ai_summary, styles["ai_summary"]))
            story.append(Spacer(1, 0.1*inch))

        # Materials — qty only
        if supply_items:
            story.append(Paragraph("Materials & Equipment", styles["section_head"]))
            rows = [['Description', 'SKU', 'Qty', 'Unit']]
            for item in supply_items:
                qty = float(item.quantity)
                rows.append([
                    item.description or '',
                    item.sku or '—',
                    str(int(qty) if qty == int(qty) else qty),
                    item.unit or 'ea',
                ])
            t = Table(rows, colWidths=[3.4*inch, 1.3*inch, 0.6*inch, 0.65*inch])
            t.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('ROWBACKGROUNDS',(0,1), (-1,-1), [colors.white, light_gray]),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('LINEBELOW',     (0,1), (-1,-1), 0.3, border),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('RIGHTPADDING',  (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(t)
            story.append(Spacer(1, 0.12*inch))

        # Labor — hours only
        labor_hours = float(job.actual_hours or job.estimated_hours or 0)
        if labor_hours > 0:
            story.append(Paragraph("Labor", styles["section_head"]))
            rows = [['Description', 'Hours']]
            rows.append([f"Electrical Service — {job.title}", f"{labor_hours:.1f} hrs"])
            lt = Table(rows, colWidths=[5.0*inch, 1.75*inch])
            lt.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('ALIGN',         (1,0), (1,-1), 'RIGHT'),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('RIGHTPADDING',  (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(lt)
            story.append(Spacer(1, 0.15*inch))

        # Change orders — description only, no prices
        approved_cos = [co for co in (change_orders or [])
                        if co.status == 'approved']
        if approved_cos:
            story.append(Paragraph("Additional Work", styles["section_head"]))
            rows = [['Description']]
            for co in approved_cos:
                rows.append([f"CO #{co.co_number}: {co.description}"])
            ct = Table(rows, colWidths=[6.75*inch])
            ct.setStyle(TableStyle([
                ('FONTNAME',      (0,0), (-1,0), 'Helvetica-Bold'),
                ('FONTNAME',      (0,1), (-1,-1), 'Helvetica'),
                ('FONTSIZE',      (0,0), (-1,-1), 8.5),
                ('TEXTCOLOR',     (0,0), (-1,0), gray),
                ('TEXTCOLOR',     (0,1), (-1,-1), dark),
                ('LINEBELOW',     (0,0), (-1,0), 0.5, border),
                ('LEFTPADDING',   (0,0), (-1,-1), 6),
                ('TOPPADDING',    (0,0), (-1,-1), 5),
                ('BOTTOMPADDING', (0,0), (-1,-1), 5),
            ]))
            story.append(ct)
            story.append(Spacer(1, 0.15*inch))

        # Totals
        story.append(HRFlowable(width="100%", thickness=0.5, color=border))
        story.append(Spacer(1, 0.1*inch))

        total    = float(invoice.total_amount or 0)
        deposit  = float(job.deposit_required or 0) if hasattr(job, 'deposit_required') else 0
        paid     = float(invoice.amount_paid or 0)
        balance  = float(invoice.balance_due or total)

        totals_rows = [['Invoice Total', f"${total:,.2f}"]]
        if deposit > 0:
            totals_rows.append([f"Deposit Received", f"-${deposit:,.2f}"])
        if invoice.tax_amount and float(invoice.tax_amount) > 0:
            totals_rows.append(['Tax', f"${float(invoice.tax_amount):,.2f}"])
        totals_rows.append(['BALANCE DUE', f"${balance:,.2f}"])

        tt = Table(totals_rows, colWidths=[5.4*inch, 1.35*inch])
        row_styles = [
            ('FONTNAME',      (0,0), (-1,-1), 'Helvetica'),
            ('FONTSIZE',      (0,0), (-1,-1), 9),
            ('TEXTCOLOR',     (0,0), (-1,-1), dark),
            ('ALIGN',         (1,0), (1,-1), 'RIGHT'),
            ('LEFTPADDING',   (0,0), (-1,-1), 6),
            ('RIGHTPADDING',  (0,0), (-1,-1), 6),
            ('TOPPADDING',    (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,0), (-1,-1), 4),
            # Balance due row — bold and larger
            ('FONTNAME',      (0,-1), (-1,-1), 'Helvetica-Bold'),
            ('FONTSIZE',      (0,-1), (-1,-1), 12),
            ('LINEABOVE',     (0,-1), (-1,-1), 1, dark),
        ]
        tt.setStyle(TableStyle(row_styles))
        story.append(tt)
        story.append(Spacer(1, 0.15*inch))

        # Customer notes
        if customer_notes:
            story.append(HRFlowable(width="100%", thickness=0.5, color=border))
            story.append(Spacer(1, 0.1*inch))
            story.append(Paragraph("Notes", styles["section_head"]))
            story.append(Paragraph(customer_notes, styles["body"]))
            story.append(Spacer(1, 0.1*inch))

        # Footer
        story.append(HRFlowable(width="100%", thickness=0.5, color=border))
        story.append(Spacer(1, 0.08*inch))
        story.append(Paragraph(
            f"Payment due on receipt. "
            f"Questions? Contact us at {COMPANY['email']} or {COMPANY['phone']}. "
            f"Thank you for choosing {COMPANY['name']}.",
            styles["footer"]
        ))

        doc.build(story)
        return buffer.getvalue()

    except ImportError:
        lines = [f"INVOICE — {job.title}", f"Invoice #: {doc_number}",
                 f"Total: ${float(invoice.total_amount):,.2f}"]
        return "\n".join(lines).encode()
