"""
PDF invoice generation using ReportLab.

Layout logic:
  - SHORT invoice (few items): ORIGINAL top half, DUPLICATE bottom half,
    dashed cut line at exact A4 midpoint. One page.
  - LONG invoice (many items): ORIGINAL on page 1 (full page),
    DUPLICATE on page 2 (full page). Two pages.

The switch happens automatically by measuring flowable height before
rendering. If original content > HALF_H threshold, two-page mode is used.

Item names wrap to next line automatically (Paragraph objects in table
cells) so long names never overlap the Qty/Rate columns.
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
from reportlab.platypus.doctemplate import SimpleDocTemplate

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
MID_Y = PAGE_H / 2           # exact geometric midpoint

SIDE_MARGIN   = 16 * mm
TOP_MARGIN    = 8  * mm
BOTTOM_MARGIN = 8  * mm
CONTENT_W     = PAGE_W - 2 * SIDE_MARGIN

# Single-page layout frame sizes
TOP_FRAME_H = PAGE_H - MID_Y - TOP_MARGIN - 4 * mm
TOP_FRAME_Y = MID_Y + 4 * mm
BOT_FRAME_H = MID_Y - BOTTOM_MARGIN - 4 * mm
BOT_FRAME_Y = BOTTOM_MARGIN

# Full-page layout frame (used when content is too tall for half-page)
FULL_FRAME_H = PAGE_H - TOP_MARGIN - BOTTOM_MARGIN
FULL_FRAME_Y = BOTTOM_MARGIN

# If content height exceeds this threshold, switch to two-page layout.
# We allow up to 15% overflow beyond TOP_FRAME_H because KeepInFrame
# with mode="shrink" handles moderate overflows gracefully — the content
# is proportionally scaled to fit. Only genuinely long invoices (many
# items) trigger two-page mode.
TWO_PAGE_THRESHOLD = TOP_FRAME_H * 1.15


# ── Helpers ───────────────────────────────────────────────────────────────

def _round_rupees(amount: float) -> int:
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


def _measure_height(flowables, width: float) -> float:
    """
    Estimate the rendered height of a list of flowables in a frame of
    the given width, without actually drawing anything.  Used to decide
    whether to use single-page or two-page layout.
    """
    from reportlab.platypus import BaseDocTemplate, PageTemplate
    from reportlab.lib.pagesizes import A4 as _A4
    import io as _io

    buf = _io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=_A4,
                            leftMargin=0, rightMargin=0,
                            topMargin=0, bottomMargin=0)
    # We only need the wrap height — use a dummy build that measures
    total = 0.0
    for f in flowables:
        w, h = f.wrap(width, 9999)
        total += h
    return total


def _draw_cut_line(canvas: Canvas):
    """Draw the dashed cut line at the exact A4 midpoint."""
    canvas.saveState()
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


def _make_styles():
    """Return a dict of all paragraph styles used in the invoice."""
    return dict(
        company=ParagraphStyle(
            "company", fontSize=18, textColor=BLUE_900,
            fontName="Helvetica-Bold", leading=22,
        ),
        heading=ParagraphStyle(
            "heading", fontSize=10, textColor=GRAY_700,
            fontName="Helvetica-Bold", alignment=TA_CENTER, leading=13,
        ),
        sub=ParagraphStyle("sub", fontSize=9.5, textColor=GRAY_700, leading=12),
        label=ParagraphStyle("label", fontSize=9, textColor=GRAY_300, leading=11),
        copy_label=ParagraphStyle(
            "copylabel", fontSize=8, textColor=BLUE_600,
            fontName="Helvetica-Bold", alignment=TA_RIGHT,
        ),
        customer_name=ParagraphStyle(
            "customername", fontSize=18, textColor=GRAY_700,
            fontName="Helvetica-Bold", leading=21,
        ),
        sig=ParagraphStyle(
            "siglabel", fontSize=9, textColor=GRAY_700,
            alignment=TA_CENTER, leading=11,
        ),
        meta=ParagraphStyle(
            "meta", fontSize=9.5, textColor=GRAY_700,
            alignment=TA_RIGHT, leading=12,
        ),
        item_name=ParagraphStyle(
            # Item names wrap automatically — this is the key fix for
            # long names overlapping the Qty/Rate columns.
            "itemname", fontSize=9.5, textColor=GRAY_700,
            leading=12, wordWrap='LTR',
        ),
        item_cell=ParagraphStyle(
            "itemcell", fontSize=9.5, textColor=GRAY_700,
            leading=12, alignment=TA_RIGHT,
        ),
        pay=ParagraphStyle("pay", fontSize=8, textColor=GRAY_700, leading=10),
        footer=ParagraphStyle(
            "footer", fontSize=8, textColor=GRAY_300,
            alignment=TA_CENTER, leading=11,
        ),
    )


def _build_copy_flowables(invoice, customer, settings, items,
                           copy_label: str, s: dict) -> list:
    """
    Build and return the flowables for ONE copy of the invoice.
    `s` is the styles dict from _make_styles().

    Key change: table item cells now use Paragraph objects so long
    item names wrap to the next line instead of overflowing/clipping.
    """
    inv_date: date = invoice.invoice_date
    flowables = []

    # Copy label (ORIGINAL / DUPLICATE)
    flowables.append(Paragraph(copy_label.upper(), s["copy_label"]))

    # Heading
    flowables.append(Paragraph(f"<u>{INVOICE_HEADING}</u>", s["heading"]))
    flowables.append(Spacer(1, 2.5 * mm))

    # Company header + invoice meta
    header_table = Table(
        [[
            Paragraph(f"<b>{settings.company_name}</b>", s["company"]),
            Paragraph(
                f"<b>{invoice.invoice_number}</b><br/>"
                f"Date: {inv_date.strftime('%d %b %Y')}",
                s["meta"],
            ),
        ]],
        colWidths=[110 * mm, 68 * mm],
    )
    header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")]))
    flowables.append(header_table)
    flowables.append(Paragraph(settings.address or "", s["sub"]))
    flowables.append(Paragraph(f"Ph: {settings.phone or ''}", s["sub"]))
    flowables.append(Spacer(1, 3 * mm))

    # Bill To
    flowables.append(Paragraph("<b>BILL TO</b>", s["label"]))
    flowables.append(Paragraph(customer.name, s["customer_name"]))
    if customer.address:
        flowables.append(Paragraph(customer.address, s["sub"]))
    phone_val = getattr(customer, 'phone', '') or ''
    if phone_val:
        flowables.append(Paragraph(f"Ph: {phone_val}", s["sub"]))
    flowables.append(Spacer(1, 2.5 * mm))

    # ── Items table ───────────────────────────────────────────────────
    # IMPORTANT: item_name cells are Paragraph objects so long names
    # wrap to a new line. All other cells are plain strings (they're
    # short numbers that never overflow their columns).
    # colWidths sum = CONTENT_W (178mm):
    #   #(7) + Item(80) + Qty(16) + Unit(16) + Rate(26) + Amount(33) = 178mm
    table_data = [["#", "Item", "Qty", "Unit", "Rate", "Amount"]]
    for idx, it in enumerate(items, start=1):
        amount = round(it.qty * it.rate, 2)
        table_data.append([
            str(idx),
            Paragraph(it.item_name, s["item_name"]),   # wraps on long names
            f"{it.qty:g}",
            it.unit,
            f"{it.rate:,.2f}",
            f"{amount:,.2f}",
        ])

    # Totals row — spans # and Item columns, shows total qty and total amount
    total_qty    = sum(it.qty for it in items)
    total_amount = sum(round(it.qty * it.rate, 2) for it in items)
    table_data.append([
        "",
        Paragraph("<b>Total</b>", ParagraphStyle("tot", fontSize=9.5, fontName="Helvetica-Bold", textColor=BLUE_900, leading=12)),
        f"{total_qty:g}",
        "",
        "",
        f"{total_amount:,.2f}",
    ])

    n_items = len(items)   # number of data rows (excluding header and totals)

    items_table = Table(
        table_data,
        colWidths=[7 * mm, 80 * mm, 16 * mm, 16 * mm, 26 * mm, 33 * mm],
    )
    items_table.setStyle(TableStyle([
        ("BACKGROUND",    (0,  0), (-1,  0), BLUE_50),
        ("TEXTCOLOR",     (0,  0), (-1,  0), BLUE_900),
        ("FONTNAME",      (0,  0), (-1,  0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,  0), (-1,  0), 9.5),
        ("FONTSIZE",      (0,  1), (-1, -1), 9.5),
        ("ALIGN",         (0,  0), ( 0, -1), "CENTER"),   # # col centered
        ("ALIGN",         (1,  0), ( 1, -1), "LEFT"),     # Item col left
        ("ALIGN",         (2,  0), (-1, -1), "RIGHT"),    # numbers right
        ("VALIGN",        (0,  0), (-1, -1), "TOP"),      # top-align all
        ("GRID",          (0,  0), (-1, -1), 0.4, GRAY_300),
        ("ROWBACKGROUNDS",(0,  1), (-1, -2), [colors.white, GRAY_50]),
        ("TOPPADDING",    (0,  0), (-1, -1), 3),
        ("BOTTOMPADDING", (0,  0), (-1, -1), 3),
        ("LEFTPADDING",   (0,  0), (-1, -1), 3),
        ("RIGHTPADDING",  (0,  0), (-1, -1), 3),
        # Totals row styling — last row
        ("BACKGROUND",    (0, -1), (-1, -1), BLUE_50),
        ("TEXTCOLOR",     (0, -1), (-1, -1), BLUE_900),
        ("FONTNAME",      (0, -1), (-1, -1), "Helvetica-Bold"),
        ("LINEABOVE",     (0, -1), (-1, -1), 0.6, BLUE_600),
    ]))
    flowables.append(items_table)
    flowables.append(Spacer(1, 2 * mm))

    # Grand total
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

    # Payment block
    if settings.show_payment_block and (settings.upi_id or settings.bank_details):
        qr_img = _qr_image(settings.upi_id, invoice.grand_total) if settings.upi_id else None
        pay_row = [
            qr_img if qr_img else Paragraph("", s["sub"]),
            Paragraph(
                f"<b>UPI:</b> {settings.upi_id or '-'}<br/>"
                f"<b>Bank:</b> {settings.bank_details or ''}",
                s["pay"],
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
        flowables.append(Paragraph(f"<b>Remarks:</b> {invoice.remarks}", s["sub"]))
        flowables.append(Spacer(1, 1 * mm))

    # Signatures
    flowables.append(Spacer(1, 6 * mm))
    sig_table = Table(
        [[
            Paragraph("_" * 28, s["sig"]),
            Paragraph("_" * 28, s["sig"]),
        ], [
            Paragraph(
                f"{customer.name}<br/>"
                f"<font size=8 color='#B4B2A9'>Customer Signature</font>",
                s["sig"],
            ),
            Paragraph(
                f"{settings.company_name}<br/>"
                f"<font size=8 color='#B4B2A9'>Authorised Signatory</font>",
                s["sig"],
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
        s["footer"],
    ))

    return flowables


def generate_invoice_pdf(invoice, customer, settings, items) -> str:
    """
    Main entry point. Decides between single-page (original + duplicate
    on one A4) and two-page (original on page 1, duplicate on page 2)
    layout based on content height.

    Decision logic:
      1. Build the original flowables.
      2. Measure their total height by wrapping against CONTENT_W.
      3. If height > TWO_PAGE_THRESHOLD → two-page layout.
      4. Otherwise → single-page layout with cut line at midpoint.
    """
    inv_date: date = invoice.invoice_date
    year_dir = os.path.join(INVOICES_DIR, str(inv_date.year), inv_date.strftime("%B"))
    os.makedirs(year_dir, exist_ok=True)
    filename = f"{invoice.invoice_number}.pdf"
    full_path = os.path.join(year_dir, filename)

    s = _make_styles()
    original_content  = _build_copy_flowables(invoice, customer, settings, items, "Original",  s)
    duplicate_content = _build_copy_flowables(invoice, customer, settings, items, "Duplicate", s)

    # Measure content height to decide layout
    content_height = _measure_height(original_content, CONTENT_W)
    use_two_pages  = content_height > TWO_PAGE_THRESHOLD

    c = Canvas(full_path, pagesize=A4)

    if use_two_pages:
        # ── Two-page layout ───────────────────────────────────────────
        # Page 1: ORIGINAL (full page)
        orig_frame = Frame(
            SIDE_MARGIN, FULL_FRAME_Y,
            CONTENT_W, FULL_FRAME_H,
            leftPadding=0, rightPadding=0,
            topPadding=0, bottomPadding=0,
            showBoundary=0,
        )
        orig_frame.addFromList(
            [KeepInFrame(CONTENT_W, FULL_FRAME_H, original_content, mode="shrink")], c
        )

        # Page 2: DUPLICATE (full page)
        c.showPage()
        dup_frame = Frame(
            SIDE_MARGIN, FULL_FRAME_Y,
            CONTENT_W, FULL_FRAME_H,
            leftPadding=0, rightPadding=0,
            topPadding=0, bottomPadding=0,
            showBoundary=0,
        )
        dup_frame.addFromList(
            [KeepInFrame(CONTENT_W, FULL_FRAME_H, duplicate_content, mode="shrink")], c
        )
    else:
        # ── Single-page layout (original top, duplicate bottom) ────────
        # Cut line at exact A4 midpoint
        _draw_cut_line(c)

        # Top half: ORIGINAL
        top_frame = Frame(
            SIDE_MARGIN, TOP_FRAME_Y,
            CONTENT_W, TOP_FRAME_H,
            leftPadding=0, rightPadding=0,
            topPadding=0, bottomPadding=0,
            showBoundary=0,
        )
        top_frame.addFromList(
            [KeepInFrame(CONTENT_W, TOP_FRAME_H, original_content, mode="shrink")], c
        )

        # Bottom half: DUPLICATE
        bot_frame = Frame(
            SIDE_MARGIN, BOT_FRAME_Y,
            CONTENT_W, BOT_FRAME_H,
            leftPadding=0, rightPadding=0,
            topPadding=0, bottomPadding=0,
            showBoundary=0,
        )
        bot_frame.addFromList(
            [KeepInFrame(CONTENT_W, BOT_FRAME_H, duplicate_content, mode="shrink")], c
        )

    c.save()
    return os.path.relpath(full_path, BASE_DIR)
