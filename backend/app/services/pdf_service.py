"""
PDF invoice generation using ReportLab.

Layout: ONE A4 page, ORIGINAL on the top half, DUPLICATE on the bottom
half, separated by a dashed cut line at the exact geometric midpoint
(148.5mm from top = 148.5mm from bottom in ReportLab coords).

Implementation uses two absolute Frames (not a flowing story) so the
cut line always lands at exactly PAGE_H/2 regardless of content size.
KeepInFrame shrinks content that is too tall to fit its half.
"""
import os
import io
from datetime import date
from decimal import Decimal, ROUND_HALF_UP

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.lib import colors
from reportlab.platypus import (
    Table, TableStyle, Paragraph, Spacer, Image, KeepInFrame, Frame
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_RIGHT, TA_CENTER
from reportlab.pdfgen.canvas import Canvas

try:
    import qrcode
    HAS_QRCODE = True
except ImportError:
    HAS_QRCODE = False

from app.core.paths import APP_DATA_DIR, INVOICES_DIR

BASE_DIR = APP_DATA_DIR

# ── Colours ──────────────────────────────────────────────────────────────
BLUE_900 = colors.HexColor("#042C53")
BLUE_600 = colors.HexColor("#185FA5")
BLUE_50  = colors.HexColor("#E6F1FB")
GRAY_700 = colors.HexColor("#444441")
GRAY_300 = colors.HexColor("#B4B2A9")
GRAY_50  = colors.HexColor("#F1EFE8")

INVOICE_HEADING = "Cash Memo / Delivery Challan"

# ── Page geometry ─────────────────────────────────────────────────────────
PAGE_W, PAGE_H = A4          # 595.28 x 841.89 pt
MID_Y = PAGE_H / 2           # exact geometric midpoint (420.94 pt from bottom)

SIDE_MARGIN   = 16 * mm
TOP_MARGIN    = 8  * mm
BOTTOM_MARGIN = 8  * mm

CONTENT_W = PAGE_W - 2 * SIDE_MARGIN

# Each half's frame: from the midpoint to either the top or bottom margin
HALF_H = MID_Y - max(TOP_MARGIN, BOTTOM_MARGIN) - 4 * mm  # small padding from cut line

# Frame positions (ReportLab: y=0 is bottom of page)
# Top-half frame: starts at MID_Y + small gap, height = up to top margin
TOP_FRAME_H = PAGE_H - MID_Y - TOP_MARGIN - 4 * mm
TOP_FRAME_Y = MID_Y + 4 * mm        # 4mm above the cut line

# Bottom-half frame: starts just above bottom margin, height up to cut line
BOT_FRAME_H = MID_Y - BOTTOM_MARGIN - 4 * mm
BOT_FRAME_Y = BOTTOM_MARGIN         # sits on the bottom margin


def _draw_page(canvas: Canvas, invoice_number: str,
               original_content, duplicate_content):
    """
    Renders one complete page:
    - cut line at exact midpoint
    - original copy in top frame
    - duplicate copy in bottom frame
    """
    canvas.saveState()

    # ── Cut line at exact A4 midpoint ─────────────────────────────────
    y = MID_Y
    canvas.setDash(4, 3)
    canvas.setStrokeColor(GRAY_300)
    canvas.setLineWidth(0.75)
    canvas.line(SIDE_MARGIN, y, PAGE_W - SIDE_MARGIN, y)
    canvas.setDash()
    canvas.setFillColor(GRAY_300)
    canvas.setFont("Helvetica", 7)
    canvas.drawCentredString(
        PAGE_W / 2, y - 6,
        "✂  - - - - - - - - - -  Cut here  - - - - - - - - - -  ✂"
    )

    canvas.restoreState()

    # ── Top half: ORIGINAL ────────────────────────────────────────────
    top_frame = Frame(
        SIDE_MARGIN, TOP_FRAME_Y,
        CONTENT_W, TOP_FRAME_H,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )
    top_frame.addFromList([KeepInFrame(CONTENT_W, TOP_FRAME_H,
                                       original_content, mode="shrink")], canvas)

    # ── Bottom half: DUPLICATE ────────────────────────────────────────
    bot_frame = Frame(
        SIDE_MARGIN, BOT_FRAME_Y,
        CONTENT_W, BOT_FRAME_H,
        leftPadding=0, rightPadding=0,
        topPadding=0, bottomPadding=0,
        showBoundary=0,
    )
    bot_frame.addFromList([KeepInFrame(CONTENT_W, BOT_FRAME_H,
                                       duplicate_content, mode="shrink")], canvas)


def _round_rupees(amount: float) -> int:
    """Round-half-up for printed Indian invoices (not banker's rounding)."""
    return int(Decimal(str(amount)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _qr_image(upi_id: str, amount: float):
    if not HAS_QRCODE or not upi_id:
        return None
    payload = f"upi://pay?pa={upi_id}&am={amount:.2f}&cu=INR"
    qr = qrcode.QRCode(box_size=3, border=1)
    qr.add_data(payload)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return Image(buf, width=18 * mm, height=18 * mm)


def _build_copy_flowables(invoice, customer, settings, items, copy_label: str):
    """
    Returns flowables for ONE copy of the invoice.

    Font sizes:
    - Company name : 18pt bold  (most prominent — largest element)
    - Customer name: 15pt bold  (second most prominent)
    - Body text    : 8.5pt      (up from 7.5pt — more readable on print)
    - Table text   : 8.5pt
    - Grand total  : 10.5pt bold
    """
    inv_date: date = invoice.invoice_date
    flowables = []

    # ── Styles ────────────────────────────────────────────────────────
    company_style = ParagraphStyle(
        "company", fontSize=18, textColor=BLUE_900,
        fontName="Helvetica-Bold", leading=22,
    )
    heading_style = ParagraphStyle(
        "heading", fontSize=10, textColor=GRAY_700,
        fontName="Helvetica-Bold", alignment=TA_CENTER, leading=13,
    )
    sub_style = ParagraphStyle(
        "sub", fontSize=8.5, textColor=GRAY_700, leading=11,
    )
    label_style = ParagraphStyle(
        "label", fontSize=7.5, textColor=GRAY_300, leading=10,
    )
    copy_label_style = ParagraphStyle(
        "copylabel", fontSize=8, textColor=BLUE_600,
        fontName="Helvetica-Bold", alignment=TA_RIGHT,
    )
    customer_name_style = ParagraphStyle(
        "customername", fontSize=15, textColor=GRAY_700,
        fontName="Helvetica-Bold", leading=18,
    )
    sig_label_style = ParagraphStyle(
        "siglabel", fontSize=7.5, textColor=GRAY_700,
        alignment=TA_CENTER, leading=10,
    )
    meta_style = ParagraphStyle(
        "meta", fontSize=8.5, textColor=GRAY_700,
        alignment=TA_RIGHT, leading=11,
    )

    # ── Copy label ────────────────────────────────────────────────────
    flowables.append(Paragraph(copy_label.upper(), copy_label_style))

    # ── Heading ───────────────────────────────────────────────────────
    flowables.append(Paragraph(f"<u>{INVOICE_HEADING}</u>", heading_style))
    flowables.append(Spacer(1, 2.5 * mm))

    # ── Company + invoice meta ────────────────────────────────────────
    header_table = Table(
        [[
            Paragraph(f"<b>{settings.company_name}</b>", company_style),
            Paragraph(
                f"<b>{invoice.invoice_number}</b><br/>Date: {inv_date.strftime('%d %b %Y')}",
                meta_style,
            ),
        ]],
        colWidths=[110 * mm, 68 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flowables.append(header_table)
    flowables.append(Paragraph(settings.address or "", sub_style))
    flowables.append(Paragraph(f"Ph: {settings.phone or ''}", sub_style))
    flowables.append(Spacer(1, 3 * mm))

    # ── Bill To ───────────────────────────────────────────────────────
    flowables.append(Paragraph("<b>BILL TO</b>", label_style))
    flowables.append(Paragraph(customer.name, customer_name_style))
    if customer.address:
        flowables.append(Paragraph(customer.address, sub_style))
    flowables.append(Paragraph(f"Ph: {customer.phone}", sub_style))
    flowables.append(Spacer(1, 2.5 * mm))

    # ── Items table ───────────────────────────────────────────────────
    table_data = [["#", "Item", "Qty", "Unit", "Rate", "Amount"]]
    for idx, it in enumerate(items, start=1):
        amount = round(it.qty * it.rate, 2)
        table_data.append([
            str(idx), it.item_name, f"{it.qty:g}", it.unit,
            f"{it.rate:,.2f}", f"{amount:,.2f}",
        ])

    items_table = Table(
        table_data,
        colWidths=[8 * mm, 70 * mm, 16 * mm, 16 * mm, 26 * mm, 32 * mm],
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,  0), (-1,  0), BLUE_50),
        ("TEXTCOLOR",     (0,  0), (-1,  0), BLUE_900),
        ("FONTNAME",      (0,  0), (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,  0), (-1, -1), 8.5),
        ("ALIGN",         (2,  0), (-1, -1), "RIGHT"),
        ("ALIGN",         (0,  0), ( 1, -1), "LEFT"),
        ("GRID",          (0,  0), (-1, -1), 0.4, GRAY_300),
        ("ROWBACKGROUNDS",(0,  1), (-1, -1), [colors.white, GRAY_50]),
        ("TOPPADDING",    (0,  0), (-1, -1), 2.5),
        ("BOTTOMPADDING", (0,  0), (-1, -1), 2.5),
    ]))
    flowables.append(items_table)
    flowables.append(Spacer(1, 2 * mm))

    # ── Grand total ───────────────────────────────────────────────────
    rounded_total = _round_rupees(invoice.grand_total)
    total_table = Table(
        [["Grand Total", f"Rs. {rounded_total:,}"]],
        colWidths=[40 * mm, 40 * mm],
        hAlign="RIGHT",
    )
    total_table.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, -1), BLUE_50),
        ("FONTNAME",      (0, 0), (-1, -1), "Helvetica-Bold"),
        ("FONTSIZE",      (0, 0), (-1, -1), 10.5),
        ("TEXTCOLOR",     (0, 0), (-1, -1), BLUE_900),
        ("ALIGN",         (1, 0), ( 1,  0), "RIGHT"),
        ("BOX",           (0, 0), (-1, -1), 0.5, BLUE_600),
        ("TOPPADDING",    (0, 0), (-1, -1), 4),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
        ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 6),
    ]))
    flowables.append(total_table)
    flowables.append(Spacer(1, 2.5 * mm))

    # ── Payment block ─────────────────────────────────────────────────
    if settings.show_payment_block and (settings.upi_id or settings.bank_details):
        qr_img = _qr_image(settings.upi_id, invoice.grand_total) if settings.upi_id else None
        pay_style = ParagraphStyle("paysub", parent=sub_style, fontSize=7, leading=9)
        pay_row = [
            qr_img if qr_img else Paragraph("", sub_style),
            Paragraph(
                f"<b>UPI:</b> {settings.upi_id or '-'}<br/>"
                f"<b>Bank:</b> {settings.bank_details or ''}",
                pay_style,
            ),
        ]
        pay_table = Table([pay_row], colWidths=[22 * mm, 156 * mm])
        pay_table.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), GRAY_50),
            ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
            ("BOX",           (0, 0), (-1, -1), 0.4, GRAY_300),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING",   (0, 0), (-1, -1), 5),
        ]))
        flowables.append(pay_table)
        flowables.append(Spacer(1, 1.5 * mm))

    if invoice.remarks:
        flowables.append(Paragraph(f"<b>Remarks:</b> {invoice.remarks}", sub_style))
        flowables.append(Spacer(1, 1 * mm))

    # ── Signatures ────────────────────────────────────────────────────
    flowables.append(Spacer(1, 6 * mm))
    sig_table = Table(
        [[
            Paragraph("_" * 28, sig_label_style),
            Paragraph("_" * 28, sig_label_style),
        ], [
            Paragraph(
                f"{customer.name}<br/>"
                f"<font size=6.5 color='#B4B2A9'>Customer Signature</font>",
                sig_label_style,
            ),
            Paragraph(
                f"{settings.company_name}<br/>"
                f"<font size=6.5 color='#B4B2A9'>Authorised Signatory</font>",
                sig_label_style,
            ),
        ]],
        colWidths=[89 * mm, 89 * mm],
    )
    sig_table.setStyle(TableStyle([
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("TOPPADDING",    (0, 0), (-1,  0), 0),
        ("BOTTOMPADDING", (0, 0), (-1,  0), 0),
        ("TOPPADDING",    (0, 1), (-1,  1), 2),
    ]))
    flowables.append(sig_table)
    flowables.append(Spacer(1, 2 * mm))

    flowables.append(Paragraph(
        f"Thank you for your business · {settings.company_name}",
        ParagraphStyle(
            "footer", parent=sub_style, alignment=TA_CENTER,
            textColor=GRAY_300, fontSize=7,
        ),
    ))

    return flowables


def generate_invoice_pdf(invoice, customer, settings, items) -> str:
    """
    Generates a single A4 PDF with:
    - ORIGINAL in the top half (above geometric midpoint)
    - DUPLICATE in the bottom half (below geometric midpoint)
    - Dashed cut line drawn directly on canvas at exactly PAGE_H/2

    Uses absolute Frame positioning instead of a flowing story, so the
    cut line is guaranteed to be at the true page midpoint regardless
    of how much content each half contains.
    """
    inv_date: date = invoice.invoice_date
    year_dir = os.path.join(INVOICES_DIR, str(inv_date.year), inv_date.strftime("%B"))
    os.makedirs(year_dir, exist_ok=True)
    filename = f"{invoice.invoice_number}.pdf"
    full_path = os.path.join(year_dir, filename)

    original_content  = _build_copy_flowables(invoice, customer, settings, items, "Original")
    duplicate_content = _build_copy_flowables(invoice, customer, settings, items, "Duplicate")

    c = Canvas(full_path, pagesize=A4)
    _draw_page(c, invoice.invoice_number, original_content, duplicate_content)
    c.save()

    return os.path.relpath(full_path, BASE_DIR)
