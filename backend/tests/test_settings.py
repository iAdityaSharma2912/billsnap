"""Tests for /settings/* — companies are now dynamic, not hardcoded SA/SE."""


def test_default_companies_seeded(client):
    r = client.get("/settings/list")
    assert r.status_code == 200
    keys = [s["company_key"] for s in r.json()]
    assert "SA" in keys
    assert "SE" in keys


def test_create_new_company(client):
    r = client.post("/settings/companies/create", json={
        "company_key": "GS", "company_name": "Gupta Stores", "address": "Karol Bagh", "phone": "9123456789",
    })
    assert r.status_code == 200
    assert r.json()["company_key"] == "GS"

    r = client.get("/settings/list")
    keys = [s["company_key"] for s in r.json()]
    assert "GS" in keys


def test_create_company_duplicate_key_rejected(client):
    client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Gupta Stores"})
    r = client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Another Gupta"})
    assert r.status_code == 400


def test_new_company_usable_for_invoice(client):
    client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Gupta Stores"})
    r_cust = client.post("/customer/create", json={"name": "Test", "phone": "9000000099"})
    customer_id = r_cust.json()["id"]

    r = client.post("/invoice/create", json={
        "company": "GS", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })
    assert r.status_code == 200
    assert r.json()["invoice_number"].startswith("GS-")


def test_new_company_has_independent_inventory(client):
    client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Gupta Stores"})
    client.post("/inventory/create", json={"company_key": "GS", "item_name": "Gupta Item", "selling_price": 5, "current_stock": 5, "min_stock": 1})

    r_sa = client.get("/inventory/list", params={"company_key": "SA"})
    r_gs = client.get("/inventory/list", params={"company_key": "GS"})
    assert not any(i["item_name"] == "Gupta Item" for i in r_sa.json())
    assert any(i["item_name"] == "Gupta Item" for i in r_gs.json())


def test_delete_company_without_invoices(client):
    client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Gupta Stores"})
    r = client.delete("/settings/companies/GS")
    assert r.status_code == 200

    r = client.get("/settings/list")
    keys = [s["company_key"] for s in r.json()]
    assert "GS" not in keys


def test_delete_company_with_invoices_blocked(client):
    client.post("/settings/companies/create", json={"company_key": "GS", "company_name": "Gupta Stores"})
    r_cust = client.post("/customer/create", json={"name": "Test2", "phone": "9000000098"})
    customer_id = r_cust.json()["id"]
    client.post("/invoice/create", json={
        "company": "GS", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "X", "unit": "Pcs", "qty": 1, "rate": 1}],
    })

    r = client.delete("/settings/companies/GS")
    assert r.status_code == 400


def test_update_company_settings(client):
    r = client.put("/settings/SA", json={"upi_id": "newupi@upi"})
    assert r.status_code == 200
    assert r.json()["upi_id"] == "newupi@upi"
