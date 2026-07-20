"""Tests for /inventory/* endpoints — now company-scoped."""


def test_create_inventory_item(client):
    r = client.post("/inventory/create", json={
        "company_key": "SA", "item_name": "RR Cable 2.5mm", "category": "Cable", "unit": "Mtr",
        "selling_price": 28.0, "current_stock": 500, "min_stock": 50,
    })
    assert r.status_code == 200
    assert r.json()["item_name"] == "RR Cable 2.5mm"
    assert r.json()["company_key"] == "SA"
    assert r.json()["low_stock"] is False


def test_create_inventory_unknown_company_rejected(client):
    r = client.post("/inventory/create", json={
        "company_key": "ZZ", "item_name": "Ghost Item", "selling_price": 1, "current_stock": 1, "min_stock": 1,
    })
    assert r.status_code == 400


def test_inventory_search_instant_autocomplete(client):
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "RR Cable 2.5mm", "selling_price": 28, "current_stock": 10, "min_stock": 1})
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "RR Switch 6A", "selling_price": 45, "current_stock": 10, "min_stock": 1})
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "Anchor Wire", "selling_price": 12, "current_stock": 10, "min_stock": 1})

    r = client.get("/inventory/search", params={"company_key": "SA", "q": "rr"})
    assert r.status_code == 200
    names = [i["item_name"] for i in r.json()]
    assert "RR Cable 2.5mm" in names
    assert "RR Switch 6A" in names
    assert "Anchor Wire" not in names


def test_inventory_isolated_per_company(client):
    """The same item name can exist independently in two companies, and a
    search in one company never returns the other's items."""
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "RR Cable 2.5mm", "selling_price": 28, "current_stock": 10, "min_stock": 1})
    client.post("/inventory/create", json={"company_key": "SE", "item_name": "RR Cable 2.5mm", "selling_price": 30, "current_stock": 5, "min_stock": 1})

    r_sa = client.get("/inventory/list", params={"company_key": "SA"})
    r_se = client.get("/inventory/list", params={"company_key": "SE"})

    assert len(r_sa.json()) == 1
    assert len(r_se.json()) == 1
    assert r_sa.json()[0]["selling_price"] == 28
    assert r_se.json()[0]["selling_price"] == 30


def test_low_stock_flagged(client):
    r = client.post("/inventory/create", json={
        "company_key": "SA", "item_name": "Low Stock Item", "selling_price": 10, "current_stock": 2, "min_stock": 10,
    })
    assert r.json()["low_stock"] is True

    r = client.get("/inventory/low-stock", params={"company_key": "SA"})
    assert any(i["item_name"] == "Low Stock Item" for i in r.json())


def test_low_stock_does_not_leak_across_companies(client):
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "SA Low", "selling_price": 1, "current_stock": 1, "min_stock": 10})
    client.post("/inventory/create", json={"company_key": "SE", "item_name": "SE Low", "selling_price": 1, "current_stock": 1, "min_stock": 10})

    r = client.get("/inventory/low-stock", params={"company_key": "SA"})
    names = [i["item_name"] for i in r.json()]
    assert "SA Low" in names
    assert "SE Low" not in names


def test_update_inventory_item(client):
    r = client.post("/inventory/create", json={
        "company_key": "SA", "item_name": "Update Me", "selling_price": 10, "current_stock": 50, "min_stock": 5,
    })
    item_id = r.json()["id"]

    r = client.put(f"/inventory/{item_id}", json={"selling_price": 15.0})
    assert r.status_code == 200
    assert r.json()["selling_price"] == 15.0
    assert r.json()["current_stock"] == 50.0  # unchanged


def test_update_inventory_not_found(client):
    r = client.put("/inventory/9999", json={"selling_price": 1.0})
    assert r.status_code == 404


def test_inventory_list_category_filter(client):
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "Cable A", "category": "Cable", "selling_price": 1, "current_stock": 1, "min_stock": 1})
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "Switch A", "category": "Switch", "selling_price": 1, "current_stock": 1, "min_stock": 1})

    r = client.get("/inventory/list", params={"company_key": "SA", "category": "Cable"})
    assert all(i["category"] == "Cable" for i in r.json())


def test_duplicate_item_name_in_same_company_rejected(client):
    client.post("/inventory/create", json={"company_key": "SA", "item_name": "Dup Item", "selling_price": 1, "current_stock": 1, "min_stock": 1})
    r = client.post("/inventory/create", json={"company_key": "SA", "item_name": "Dup Item", "selling_price": 2, "current_stock": 2, "min_stock": 2})
    assert r.status_code == 400
