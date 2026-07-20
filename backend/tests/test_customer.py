"""Tests for /customer/* endpoints."""


def test_create_customer(client):
    r = client.post("/customer/create", json={
        "name": "Rajesh Kumar", "phone": "9876543210", "address": "Karol Bagh, Delhi",
    })
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "Rajesh Kumar"
    assert body["phone"] == "9876543210"


def test_list_customers_with_search(client):
    client.post("/customer/create", json={"name": "Amit Singh", "phone": "9111111111"})
    client.post("/customer/create", json={"name": "Sunita Verma", "phone": "9222222222"})

    r = client.get("/customer/list", params={"search": "Amit"})
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["name"] == "Amit Singh"


def test_get_customer_detail(client):
    r = client.post("/customer/create", json={"name": "Test User", "phone": "9000000000"})
    customer_id = r.json()["id"]

    r = client.get(f"/customer/{customer_id}")
    assert r.status_code == 200
    assert r.json()["invoice_count"] == 0
    assert r.json()["total_purchases"] == 0.0


def test_get_customer_not_found(client):
    r = client.get("/customer/9999")
    assert r.status_code == 404


def test_update_customer(client):
    r = client.post("/customer/create", json={"name": "Old Name", "phone": "9333333333"})
    customer_id = r.json()["id"]

    r = client.put(f"/customer/{customer_id}", json={"name": "New Name"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"
    assert r.json()["phone"] == "9333333333"  # unchanged


def test_delete_customer(client):
    r = client.post("/customer/create", json={"name": "Delete Me", "phone": "9444444444"})
    customer_id = r.json()["id"]

    r = client.delete(f"/customer/{customer_id}")
    assert r.status_code == 200
    assert r.json()["success"] is True

    r = client.get(f"/customer/{customer_id}")
    assert r.status_code == 404


def test_delete_customer_with_invoices_is_blocked(client):
    r = client.post("/customer/create", json={"name": "Has Invoice", "phone": "9555555555"})
    customer_id = r.json()["id"]

    client.post("/invoice/create", json={
        "company": "SA", "customer_id": customer_id, "payment_mode": "Cash",
        "items": [{"item_name": "Test Item", "unit": "Pcs", "qty": 1, "rate": 100}],
    })

    r = client.delete(f"/customer/{customer_id}")
    assert r.status_code == 400
