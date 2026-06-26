from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_library_and_directory():
    topics = client.get("/library").json()
    assert len(topics) >= 5
    assert "body" not in topics[0]            # list view omits long body
    one = client.get(f"/library/{topics[0]['id']}").json()
    assert "body" in one and one["rights"]
    assert len(client.get("/directory?country=IN").json()) >= 1


def test_auth_and_deadlines_flow():
    tok = client.post("/auth/signup", json={
        "email": "p@test.com", "password": "secret123", "name": "P"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    assert client.get("/auth/me", headers=h).json()["email"] == "p@test.com"

    d = client.post("/deadlines", headers=h, json={
        "title": "Rent due", "kind": "rent", "due_date": "2026-08-01"}).json()
    assert d["done"] is False
    assert len(client.get("/deadlines", headers=h).json()) == 1
    client.patch(f"/deadlines/{d['id']}", headers=h)
    assert client.get("/deadlines", headers=h).json()[0]["done"] is True


def test_deadlines_require_auth():
    assert client.get("/deadlines").status_code == 401


def test_advise_returns_structured_plan():
    r = client.post("/advise", json={
        "situation": "My landlord refuses to return my deposit after I moved out.",
        "jurisdiction": "IN", "language": "English"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] and d["summary"]
    assert len(d["rights"]) >= 1 and len(d["steps"]) >= 1 and len(d["documents"]) >= 1
    assert d["urgency"] in ("low", "medium", "high")
    assert d["help"]


def test_advise_rejects_empty():
    assert client.post("/advise", json={"situation": "hi"}).status_code == 400


def test_clause_message_redline():
    a = client.post("/analyze", json={
        "text": "The landlord shall forfeit the full deposit. The landlord may evict within 24 hours.",
        "language": "English", "jurisdiction": "IN"}).json()
    r = client.post("/clauses/message", json={
        "analysis_id": a["id"], "clause_order": 0, "language": "English"})
    assert r.status_code == 200
    assert len(r.json()["message"]) > 20


def test_redraft_whole_contract():
    a = client.post("/analyze", json={
        "text": "The landlord shall forfeit the full deposit. The tenant gets 30 days notice.",
        "language": "English", "jurisdiction": "IN"}).json()
    r = client.post(f"/analyses/{a['id']}/redraft", json={"language": "English"})
    assert r.status_code == 200
    d = r.json()
    assert d["title"] and len(d["text"]) > 40
    assert client.post("/analyses/does-not-exist/redraft", json={}).status_code == 404


def test_compare_two_contracts():
    r = client.post("/compare", json={
        "text_a": "The deposit is refunded. One month notice is required before eviction.",
        "text_b": "The landlord shall forfeit the deposit and may evict within 24 hours without notice.",
        "label_a": "Lease A", "label_b": "Lease B", "jurisdiction": "IN", "language": "English"})
    assert r.status_code == 200
    d = r.json()
    assert d["safer"] in ("A", "B", "TIE")
    assert "counts" in d["a"] and "risk_level" in d["b"]
    assert isinstance(d["differences"], list)


def test_save_and_list_plans():
    tok = client.post("/auth/signup", json={
        "email": "plan@test.com", "password": "secret123", "name": "P"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    plan = client.post("/advise", json={
        "situation": "My landlord won't return my deposit.", "jurisdiction": "IN",
        "language": "English"}).json()
    saved = client.post("/advise/save", headers=h, json=plan).json()
    assert saved["id"]
    plans = client.get("/advise/plans", headers=h).json()
    assert any(p["id"] == saved["id"] for p in plans)
    one = client.get(f"/advise/plans/{saved['id']}", headers=h).json()
    assert one["title"] == plan["title"]


def test_save_plan_requires_auth():
    plan = client.post("/advise", json={"situation": "My deposit was not returned.",
                                        "jurisdiction": "IN", "language": "English"}).json()
    assert client.post("/advise/save", json=plan).status_code == 401


def test_translate_english_passthrough_and_batch():
    # English returns the same strings, no AI call
    r = client.post("/translate", json={"texts": ["Home", "Help"], "language": "English"})
    assert r.json()["translations"] == ["Home", "Help"]
    # Non-English uses the (mocked) AI and returns the same count
    r2 = client.post("/translate", json={"texts": ["Home", "Help"], "language": "Hindi"})
    assert len(r2.json()["translations"]) == 2
