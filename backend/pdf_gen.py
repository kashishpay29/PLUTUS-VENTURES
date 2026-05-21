"""
PDF service report generator.
Renders ticket details, device info, warranty, engineer notes, parts,
photos, and customer signature into a branded PDF.
"""
import io
import os
import base64
import logging
from datetime import datetime

import qrcode
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.lib.colors import HexColor
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, PageBreak
)
from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER

logger = logging.getLogger(__name__)

NAVY = HexColor("#0A1128")
BLUE = HexColor("#2563EB")
SLATE = HexColor("#475569")
LIGHT = HexColor("#F1F5F9")
BORDER = HexColor("#CBD5E1")


def _header_footer(canvas, doc):
    canvas.saveState()
    width, height = A4
    company = os.environ.get("COMPANY_NAME", "Plutus Ventures")
    tagline = "Partnering Your IT Landscape"
    logo_path = os.path.join(os.path.dirname(__file__), "assets", "plutus_letterhead.jpeg")
    if not os.path.exists(logo_path):
        logo_path = os.path.join(os.path.dirname(__file__), "assets", "plutus_logo.jpeg")
    # Header band (white with subtle accent)
    canvas.setFillColor(HexColor("#FFFFFF"))
    canvas.rect(0, height - 32 * mm, width, 32 * mm, fill=1, stroke=0)
    # Accent strip
    canvas.setFillColor(BLUE)
    canvas.rect(0, height - 33 * mm, width, 1 * mm, fill=1, stroke=0)
    # Logo
    try:
        if os.path.exists(logo_path):
            canvas.drawImage(logo_path, 12 * mm, height - 28 * mm,
                              width=24 * mm, height=24 * mm,
                              preserveAspectRatio=True, mask='auto')
    except Exception:
        pass
    # Company name
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 18)
    canvas.drawString(40 * mm, height - 14 * mm, company)
    canvas.setFillColor(BLUE)
    canvas.setFont("Helvetica", 9)
    canvas.drawString(40 * mm, height - 20 * mm, tagline)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(40 * mm, height - 25 * mm, "IT Service Management • Field Service Report")
    # Right side meta
    canvas.setFillColor(NAVY)
    canvas.setFont("Helvetica-Bold", 9)
    canvas.drawRightString(width - 15 * mm, height - 14 * mm, "SERVICE REPORT")
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 8)
    canvas.drawRightString(width - 15 * mm, height - 20 * mm,
                            datetime.now().strftime("%d %b %Y"))
    # Footer
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.3)
    canvas.line(15 * mm, 14 * mm, width - 15 * mm, 14 * mm)
    canvas.setFillColor(SLATE)
    canvas.setFont("Helvetica", 8)
    canvas.drawString(15 * mm, 9 * mm, f"{company} • {tagline}")
    canvas.drawRightString(width - 15 * mm, 9 * mm, f"Page {doc.page}")
    canvas.restoreState()


def _b64_to_image(b64_str, max_w_mm=80, max_h_mm=55):
    """Decode a data URL or raw base64 string into a reportlab Image."""
    if not b64_str:
        return None
    try:
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        data = base64.b64decode(b64_str)
        bio = io.BytesIO(data)
        img = Image(bio)
        # Scale to fit
        iw, ih = img.imageWidth, img.imageHeight
        max_w = max_w_mm * mm
        max_h = max_h_mm * mm
        scale = min(max_w / iw, max_h / ih, 1)
        img.drawWidth = iw * scale
        img.drawHeight = ih * scale
        return img
    except Exception as e:
        logger.error(f"Failed to load image for PDF: {e}")
        return None


def _qr_image(text: str, size_mm: int = 22):
    qr = qrcode.QRCode(version=1, box_size=10, border=1,
                       error_correction=qrcode.constants.ERROR_CORRECT_M)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#0A1128", back_color="#FFFFFF")
    bio = io.BytesIO()
    img.save(bio, format="PNG")
    bio.seek(0)
    rl_img = Image(bio)
    rl_img.drawWidth = size_mm * mm
    rl_img.drawHeight = size_mm * mm
    return rl_img


def build_service_report_pdf(ticket: dict, device: dict, engineer: dict,
                              report: dict) -> bytes:
    """Return PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=15 * mm,
        rightMargin=15 * mm,
        topMargin=38 * mm,
        bottomMargin=18 * mm,
        title=f"Service Report {ticket.get('ticket_number', '')}",
    )
    styles = getSampleStyleSheet()
    h2 = ParagraphStyle("h2", parent=styles["Heading2"],
                        textColor=NAVY, fontName="Helvetica-Bold",
                        spaceAfter=6, fontSize=12)
    body = ParagraphStyle("body", parent=styles["BodyText"],
                          fontName="Helvetica", fontSize=9, leading=12,
                          textColor=HexColor("#0F172A"))
    small = ParagraphStyle("small", parent=body, fontSize=8,
                           textColor=SLATE)

    story = []

    # Title strip
    title_t = Table([[
        Paragraph(f"<b>Ticket {ticket.get('ticket_number', '')}</b>", h2),
        Paragraph(
            f"<font color='#475569' size='9'>Status</font><br/>"
            f"<b>{ticket.get('status', '').upper()}</b>", body),
        Paragraph(
            f"<font color='#475569' size='9'>Created</font><br/>"
            f"<b>{ticket.get('created_at', '')[:16].replace('T', ' ')}</b>",
            body),
    ]], colWidths=[70 * mm, 50 * mm, 60 * mm])
    title_t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), LIGHT),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    story.append(title_t)
    story.append(Spacer(1, 8))

    def kv_table(rows, col1_w=45, col2_w=135):
        t = Table([[Paragraph(f"<b>{k}</b>", body), Paragraph(str(v or "—"), body)]
                   for k, v in rows], colWidths=[col1_w * mm, col2_w * mm])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("LINEBELOW", (0, 0), (-1, -1), 0.2, BORDER),
        ]))
        return t

    # Customer
    story.append(Paragraph("CUSTOMER", h2))
    story.append(kv_table([
        ("Name", ticket.get("customer_name")),
        ("Company", ticket.get("customer_company")),
        ("Phone", ticket.get("customer_phone")),
        ("Source", (ticket.get("contact_source") or "").title()),
    ]))
    story.append(Spacer(1, 8))

    # Device
    story.append(Paragraph("DEVICE", h2))
    warranty = device.get("warranty_status", "none") if device else "none"
    expiry = device.get("warranty_expiry", "—") if device else "—"
    story.append(kv_table([
        ("Brand / Model", f"{device.get('brand', '')} {device.get('model', '')}" if device else ""),
        ("Serial Number", device.get("serial_number") if device else "—"),
        ("Device ID", device.get("device_id") if device else "—"),
        ("Warranty", f"{warranty.upper()} (expires {expiry or '—'})"),
    ]))
    story.append(Spacer(1, 8))

    # Engineer
    story.append(Paragraph("ENGINEER", h2))
    story.append(kv_table([
        ("Name", engineer.get("name") if engineer else "—"),
        ("Email", engineer.get("email") if engineer else "—"),
        ("Skills", ", ".join(engineer.get("skills", [])) if engineer else "—"),
    ]))
    story.append(Spacer(1, 8))

    # Problem
    story.append(Paragraph("PROBLEM REPORTED", h2))
    story.append(Paragraph(ticket.get("problem_description") or "—", body))
    story.append(Spacer(1, 8))

    # Work notes
    story.append(Paragraph("ENGINEER WORK NOTES", h2))
    story.append(Paragraph(report.get("work_notes") or "—", body))
    story.append(Spacer(1, 8))

    # Parts
    parts = report.get("parts_used") or []
    if parts:
        story.append(Paragraph("PARTS USED", h2))
        data = [["#", "Part Name", "Part No.", "Qty"]]
        for i, p in enumerate(parts, 1):
            data.append([str(i), p.get("name", ""), p.get("part_number", "—"),
                         str(p.get("quantity", 1))])
        t = Table(data, colWidths=[12 * mm, 90 * mm, 50 * mm, 28 * mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("TEXTCOLOR", (0, 0), (-1, 0), HexColor("#FFFFFF")),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9),
            ("GRID", (0, 0), (-1, -1), 0.25, BORDER),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [HexColor("#FFFFFF"), LIGHT]),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # Photos
    photos_before = report.get("photos_before") or []
    photos_after = report.get("photos_after") or []
    if photos_before or photos_after:
        story.append(Paragraph("PHOTO EVIDENCE", h2))
        # Build 2-col rows: before | after
        rows = []
        max_rows = max(len(photos_before), len(photos_after))
        for i in range(max_rows):
            row = []
            for src in (photos_before[i] if i < len(photos_before) else None,
                        photos_after[i] if i < len(photos_after) else None):
                img = _b64_to_image(src, max_w_mm=78, max_h_mm=50) if src else None
                row.append(img if img else Paragraph("—", small))
            rows.append(row)
        labels = [[Paragraph("<b>Before</b>", small),
                   Paragraph("<b>After</b>", small)]]
        t = Table(labels + rows, colWidths=[88 * mm, 88 * mm])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("BOX", (0, 0), (-1, -1), 0.3, BORDER),
            ("INNERGRID", (0, 0), (-1, -1), 0.2, BORDER),
        ]))
        story.append(t)
        story.append(Spacer(1, 10))

    # Signature
    story.append(Paragraph("CUSTOMER SIGN-OFF", h2))
    sig_img = _b64_to_image(report.get("customer_signature"),
                             max_w_mm=80, max_h_mm=30)
    sig_cell = sig_img if sig_img else Paragraph("(No signature captured)", small)
    sig_t = Table([
        [Paragraph("<b>Signed by:</b>", body),
         Paragraph(report.get("customer_signed_name") or
                   ticket.get("customer_name") or "—", body)],
        [Paragraph("<b>Signature:</b>", body), sig_cell],
        [Paragraph("<b>Signed at:</b>", body),
         Paragraph((report.get("signed_at") or "")[:19].replace("T", " "),
                   body)],
    ], colWidths=[35 * mm, 145 * mm])
    sig_t.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ("LINEBELOW", (0, 0), (-1, -1), 0.2, BORDER),
    ]))
    story.append(sig_t)

    # QR code + verification footer
    try:
        qr_payload = ticket.get("ticket_number") or ticket.get("id") or ""
        qr = _qr_image(qr_payload, size_mm=22)
        qr_row = Table([[
            qr,
            Paragraph(
                f"<b>Verify this report</b><br/>"
                f"<font size='8' color='#475569'>Scan the QR to verify the ticket reference."
                f" Ticket #: <b>{qr_payload}</b><br/>"
                f"Report ID: {(ticket.get('report_id') or '—')}</font>",
                body),
        ]], colWidths=[28 * mm, 152 * mm])
        qr_row.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 8),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ]))
        story.append(Spacer(1, 6))
        story.append(qr_row)
    except Exception as e:
        logger.error(f"QR generation failed: {e}")

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    pdf = buf.getvalue()
    buf.close()
    return pdf
