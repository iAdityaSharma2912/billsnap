"""Tests for /backup/* — create, download as a file, and restore via upload."""
import io


def test_backup_create_and_list(client):
    r = client.post("/backup/create")
    assert r.status_code == 200
    assert r.json()["path"].endswith(".zip")

    r = client.get("/backup/list")
    assert r.status_code == 200
    assert len(r.json()["backups"]) >= 1


def test_backup_download_returns_zip_bytes(client):
    r = client.post("/backup/create")
    path = r.json()["path"]
    filename = path.split("/")[-1]

    r2 = client.get(f"/backup/download/{filename}")
    assert r2.status_code == 200
    assert r2.headers["content-type"] == "application/zip"
    assert len(r2.content) > 0
    # Without this header, the browser displays/navigates instead of
    # saving the file — this was the actual cause of "download not working".
    assert "attachment" in r2.headers["content-disposition"]
    assert filename in r2.headers["content-disposition"]


def test_backup_download_missing_file_404(client):
    r = client.get("/backup/download/does-not-exist.zip")
    assert r.status_code == 404


def test_restore_from_uploaded_zip(client):
    # create a backup, download its bytes, then "upload" those same bytes
    # back through the restore endpoint to simulate a user browsing to a
    # previously-downloaded file.
    r = client.post("/backup/create")
    path = r.json()["path"]
    filename = path.split("/")[-1]

    r2 = client.get(f"/backup/download/{filename}")
    zip_bytes = r2.content

    r3 = client.post(
        "/backup/restore",
        files={"file": (filename, io.BytesIO(zip_bytes), "application/zip")},
    )
    assert r3.status_code == 200
    assert r3.json()["success"] is True


def test_restore_rejects_non_zip_file(client):
    r = client.post(
        "/backup/restore",
        files={"file": ("notes.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert r.status_code == 400
