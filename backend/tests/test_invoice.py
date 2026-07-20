"""Tests for /invoice/* endpoints — the core feature."""


def _make_customer(client, name="Test Customer", phone="9000000001"):
    r = client.post("/customer/create", json={"name": name, "phone": phone})
    return r.json()["id"]


def _make_item(client, company_key="SA", name="Test Cable", price=28.0, stock=100, min_stock=10):
    r = client.post("/inventory/create", json={
        "company_key": company_key, "item_name": name, "category": "Cable", "unit": "Mtr",
        "selling_price": price, "current_stock": stock, "min_stock": min_stock,
    })
    return r.json()["id"]


def test_create_invoice_with_items(client):
    customer_id = _make_customer(client)
    item_id = _make_item(client)

    r = client.post("/invoice/create", json={
        "company": "SA",
        "customer_id": customer_id,
        "payment_mode": "UPI",
        "items": [
            {"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 50, "rate": 28.0},
        ],
    })
    assert r.status_code == 200
    body = r.json()
    assert body["invoice_number"].startswith("SA-")
    assert body["grand_total"] == 1400.0
    assert len(body["items"]) == 1
    assert body["pdf_path"] is not None


def test_create_invoice_unknown_company_rejected(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "ZZ", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r.status_code == 400


def test_invoice_number_increments_per_company_per_day(client):
    customer_id = _make_customer(client)

    r1 = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Item A", "unit": "Pcs", "qty": 1, "rate": 10}],
    })
    r2 = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Item B", "unit": "Pcs", "qty": 1, "rate": 10}],
    })
    n1 = r1.json()["invoice_number"]
    n2 = r2.json()["invoice_number"]
    assert n1.endswith("-001")
    assert n2.endswith("-002")


def test_invoice_number_separate_sequence_per_company(client):
    customer_id = _make_customer(client)

    r_sa = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Item A", "unit": "Pcs", "qty": 1, "rate": 10}],
    })
    r_se = client.post("/invoice/create", json={
        "company": "SE", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Item B", "unit": "Pcs", "qty": 1, "rate": 10}],
    })
    assert r_sa.json()["invoice_number"].startswith("SA-")
    assert r_sa.json()["invoice_number"].endswith("-001")
    assert r_se.json()["invoice_number"].startswith("SE-")
    assert r_se.json()["invoice_number"].endswith("-001")  # separate counter


def test_invoice_reduces_inventory_stock(client):
    customer_id = _make_customer(client)
    item_id = _make_item(client, stock=100)

    client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 30, "rate": 28.0}],
    })

    r = client.get("/inventory/list", params={"company_key": "SA"})
    item = [i for i in r.json() if i["id"] == item_id][0]
    assert item["current_stock"] == 70.0


def test_invoice_line_without_inventory_id_is_added_to_inventory(client):
    """The core new behavior: typing a brand-new item name directly on an
    invoice (no autocomplete match) adds it to that company's inventory
    list, but with zero stock — quantity is not inferred from the sale."""
    customer_id = _make_customer(client)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Brand New Item", "unit": "Pcs", "qty": 3, "rate": 50}],
    })
    assert r.status_code == 200
    invoice_item = r.json()["items"][0]
    assert invoice_item["inventory_id"] is not None

    r2 = client.get("/inventory/list", params={"company_key": "SA"})
    matches = [i for i in r2.json() if i["item_name"] == "Brand New Item"]
    assert len(matches) == 1
    assert matches[0]["current_stock"] == 0.0  # qty NOT copied into stock
    assert matches[0]["selling_price"] == 50


def test_invoice_line_without_inventory_id_reuses_existing_item(client):
    """If the typed name already exists in that company's inventory, the
    invoice should link to the existing row rather than creating a
    duplicate, AND deduct stock just like an explicit autocomplete pick."""
    customer_id = _make_customer(client)
    item_id = _make_item(client, name="Existing Item", stock=20)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Existing Item", "unit": "Mtr", "qty": 5, "rate": 28}],
    })
    assert r.json()["items"][0]["inventory_id"] == item_id

    r2 = client.get("/inventory/list", params={"company_key": "SA"})
    matches = [i for i in r2.json() if i["item_name"] == "Existing Item"]
    assert len(matches) == 1  # no duplicate created
    assert matches[0]["current_stock"] == 15.0  # 20 - 5, deducted like a normal pick


def test_invoice_auto_added_item_scoped_to_company(client):
    """An ad hoc item typed on an SE invoice should not appear in SA's
    inventory list."""
    customer_id = _make_customer(client)
    client.post("/invoice/create", json={
        "company": "SE", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "SE Only Item", "unit": "Pcs", "qty": 1, "rate": 10}],
    })

    r_sa = client.get("/inventory/list", params={"company_key": "SA"})
    r_se = client.get("/inventory/list", params={"company_key": "SE"})
    assert not any(i["item_name"] == "SE Only Item" for i in r_sa.json())
    assert any(i["item_name"] == "SE Only Item" for i in r_se.json())


def test_create_invoice_requires_items(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash", "items": [],
    })
    assert r.status_code == 400


def test_create_invoice_invalid_customer(client):
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": 9999, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r.status_code == 400


def test_list_invoices_filtered_by_company(client):
    customer_id = _make_customer(client)
    client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    client.post("/invoice/create", json={
        "company": "SE", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Y", "unit": "Pcs", "qty": 1, "rate": 1}],
    })

    r = client.get("/invoice/list", params={"company": "SA"})
    assert all(inv["company"] == "SA" for inv in r.json())


def test_list_invoices_includes_customer_name(client):
    customer_id = _make_customer(client, name="Ramesh Traders", phone="9000000111")
    client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })

    r = client.get("/invoice/list")
    assert r.status_code == 200
    assert all(inv["customer_name"] == "Ramesh Traders" for inv in r.json())


def test_pdf_contains_original_and_duplicate_on_one_page(client):
    """Round-trip check that the generated PDF is a single page with both
    copy labels and the new heading, by reading the saved file directly."""
    import os
    from pypdf import PdfReader

    customer_id = _make_customer(client, name="Signature Test Customer")
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 100}],
    })
    pdf_path = r.json()["pdf_path"]
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(base_dir, pdf_path)

    reader = PdfReader(full_path)
    assert len(reader.pages) == 1

    text = reader.pages[0].extract_text()
    assert "ORIGINAL" in text
    assert "DUPLICATE" in text
    assert "Cash Memo / Delivery Challan" in text
    assert text.count("Cash Memo / Delivery Challan") == 2

    # Payment mode is no longer printed on the invoice
    assert "Mode:" not in text

    # Signature blocks: customer name + "Customer Signature" on one side,
    # company name + "Authorised Signatory" on the other, once per copy.
    assert text.count("Customer Signature") == 2
    assert text.count("Authorised Signatory") == 2
    assert text.count("Signature Test Customer") >= 2  # BILL TO + signature line, x2 copies


def test_pdf_grand_total_is_rounded_to_whole_rupees(client):
    """The stored grand_total keeps full decimal precision (for accurate
    reporting/export), and line item amounts in the table also keep their
    decimals — but the Grand Total line specifically should print rounded
    to the nearest whole rupee with no decimals."""
    customer_id = _make_customer(client, name="Rounding Test Customer")
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 50, "rate": 28.33}],
    })
    body = r.json()
    assert body["grand_total"] == 1416.5  # exact value preserved in the API/DB

    import os
    from pypdf import PdfReader
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    full_path = os.path.join(base_dir, body["pdf_path"])
    text = PdfReader(full_path).pages[0].extract_text()

    # 1416.50 rounds UP to 1417 (round-half-up, not Python's banker's
    # rounding, which would give 1416 since 1416 is even).
    assert "Rs. 1,417" in text or "Rs. 1417" in text
    # The rounded total token itself must have no decimal point — confirms
    # this isn't accidentally the unrounded "1,416.50" or "1417.xx".
    import re
    rs_matches = re.findall(r"Rs\.\s*([\d,]+(?:\.\d+)?)", text)
    assert all("." not in m for m in rs_matches), rs_matches


def test_pdf_page_geometry_gives_both_copies_equal_height():
    """Both ORIGINAL and DUPLICATE must be allotted exactly the same
    vertical budget — this is a property of the constants themselves, not
    just something that happens to look right in one rendered example."""
    from app.services.pdf_service import HALF_HEIGHT, USABLE_HEIGHT, PAGE_HEIGHT, TOP_MARGIN, BOTTOM_MARGIN, CUT_LINE_GUTTER

    assert HALF_HEIGHT == USABLE_HEIGHT / 2
    # the two halves plus margins plus the cut-line gutter must reconstruct
    # the full page height exactly, with no overflow or unaccounted gap
    reconstructed = TOP_MARGIN + HALF_HEIGHT + CUT_LINE_GUTTER + HALF_HEIGHT + BOTTOM_MARGIN
    assert abs(reconstructed - PAGE_HEIGHT) < 0.01


def test_get_invoice_pdf_path(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r = client.get(f"/invoice/{invoice_id}/pdf")
    assert r.status_code == 200
    assert r.json()["path"].endswith(".pdf")


def test_download_invoice_pdf_file_forces_attachment(client):
    """The download endpoint must set Content-Disposition: attachment, or
    the browser will just display the PDF instead of saving it."""
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r = client.get(f"/invoice/{invoice_id}/pdf/file")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 100  # actual PDF bytes, not a JSON path
    assert "attachment" in r.headers["content-disposition"]
    assert "filename=" in r.headers["content-disposition"]


def test_view_invoice_pdf_is_inline(client):
    """The view endpoint (used for printing) must set Content-Disposition:
    inline, so it opens in the browser's PDF viewer instead of downloading."""
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r = client.get(f"/invoice/{invoice_id}/pdf/view")
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/pdf"
    assert len(r.content) > 100
    assert "inline" in r.headers["content-disposition"]


def test_update_invoice_changes_items_and_keeps_invoice_number(client):
    customer_id = _make_customer(client)
    item_id = _make_item(client, stock=100)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 20, "rate": 28.0}],
    })
    original = r.json()
    invoice_id = original["id"]

    r2 = client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "UPI",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 35, "rate": 28.0}],
    })
    assert r2.status_code == 200
    updated = r2.json()
    assert updated["invoice_number"] == original["invoice_number"]
    assert updated["payment_mode"] == "UPI"
    assert updated["grand_total"] == 35 * 28.0
    assert len(updated["items"]) == 1
    assert updated["items"][0]["qty"] == 35


def test_update_invoice_reconciles_stock_on_quantity_change(client):
    customer_id = _make_customer(client)
    item_id = _make_item(client, stock=100)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 20, "rate": 28.0}],
    })
    invoice_id = r.json()["id"]

    stock = client.get("/inventory/list", params={"company_key": "SA"}).json()[0]["current_stock"]
    assert stock == 80.0  # 100 - 20

    client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 35, "rate": 28.0}],
    })

    stock = client.get("/inventory/list", params={"company_key": "SA"}).json()[0]["current_stock"]
    assert stock == 65.0  # 100 - 35, not 100 - 20 - 35


def test_update_invoice_reconciles_stock_when_item_is_swapped(client):
    customer_id = _make_customer(client)
    item_a = _make_item(client, name="Item A", stock=50)
    item_b = _make_item(client, name="Item B", stock=50)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_a, "item_name": "Item A", "unit": "Mtr", "qty": 10, "rate": 10.0}],
    })
    invoice_id = r.json()["id"]

    client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_b, "item_name": "Item B", "unit": "Mtr", "qty": 15, "rate": 10.0}],
    })

    stocks = {i["item_name"]: i["current_stock"] for i in client.get("/inventory/list", params={"company_key": "SA"}).json()}
    assert stocks["Item A"] == 50.0  # fully restored, no longer used
    assert stocks["Item B"] == 35.0  # 50 - 15, newly deducted


def test_update_invoice_does_not_deduct_stock_for_freshly_auto_added_item(client):
    """An item typed ad hoc during an edit that doesn't match anything
    existing should be added to inventory at zero stock, same as on
    create — it should not go negative."""
    customer_id = _make_customer(client)
    item_id = _make_item(client, stock=10)

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"inventory_id": item_id, "item_name": "Test Cable", "unit": "Mtr", "qty": 5, "rate": 28.0}],
    })
    invoice_id = r.json()["id"]

    client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Brand New Edited Item", "unit": "Pcs", "qty": 4, "rate": 60}],
    })

    stocks = {i["item_name"]: i["current_stock"] for i in client.get("/inventory/list", params={"company_key": "SA"}).json()}
    assert stocks["Test Cable"] == 10.0  # restored
    assert stocks["Brand New Edited Item"] == 0.0  # never deducted, qty not copied in


def test_update_invoice_regenerates_pdf(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Original Item", "unit": "Pcs", "qty": 1, "rate": 100}],
    })
    invoice_id = r.json()["id"]

    client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Edited Item Name", "unit": "Pcs", "qty": 2, "rate": 55}],
    })

    r2 = client.get(f"/invoice/{invoice_id}/pdf/file")
    assert r2.status_code == 200

    import io
    from pypdf import PdfReader
    text = PdfReader(io.BytesIO(r2.content)).pages[0].extract_text()
    assert "Edited Item Name" in text
    assert "Original Item" not in text


def test_update_invoice_can_change_customer(client):
    customer_a = _make_customer(client, name="Customer A", phone="9111111111")
    customer_b = _make_customer(client, name="Customer B", phone="9222222222")

    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_a, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r2 = client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_b, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r2.json()["customer_name"] == "Customer B"


def test_update_invoice_not_found(client):
    r = client.put("/invoice/9999", json={
        "customer_id": 1, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r.status_code == 404


def test_update_invoice_requires_items(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r2 = client.put(f"/invoice/{invoice_id}", json={
        "customer_id": customer_id, "payment_mode": "Cash", "items": [],
    })
    assert r2.status_code == 400


def test_update_invoice_invalid_customer(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r2 = client.put(f"/invoice/{invoice_id}", json={
        "customer_id": 9999, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r2.status_code == 400


def test_delete_invoice(client):
    customer_id = _make_customer(client)
    r = client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    invoice_id = r.json()["id"]

    r = client.delete(f"/invoice/{invoice_id}")
    assert r.status_code == 200

    r = client.get(f"/invoice/{invoice_id}")
    assert r.status_code == 404
