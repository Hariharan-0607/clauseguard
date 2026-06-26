from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

SAMPLE = (
    "1. The tenant shall pay rent of Rs. 12000 payable in advance on or before the 5th.\n"
    "2. The landlord shall forfeit the deposit if the tenant vacates early for any reason.\n"
    "3. The landlord may evict the tenant and require them to vacate within 24 hours without notice.\n"
)


def test_health():
    assert client.get("/health").json()["status"] == "healthy"


def test_analyze_flags_illegal_clauses():
    r = client.post("/analyze", json={"text": SAMPLE, "language": "en",
                                      "jurisdiction": "IN", "counterparty": "Acme Rentals"})
    assert r.status_code == 200
    data = r.json()
    assert data["risk_level"] == "red"        # has illegal clauses
    verdicts = [c["verdict"] for c in data["clauses"]]
    assert "illegal" in verdicts
    # the illegal clauses should carry a legal citation from the rule pack
    assert any(c["citation"] for c in data["clauses"] if c["verdict"] == "illegal")


def test_letter_generation():
    r = client.post("/analyze", json={"text": SAMPLE, "language": "en", "jurisdiction": "IN"})
    analysis_id = r.json()["id"]
    lr = client.post("/letters", json={"analysis_id": analysis_id,
                                       "letter_type": "complaint", "language": "en"})
    assert lr.status_code == 200
    assert len(lr.json()["text"]) > 20


def test_report_and_aggregate():
    r = client.post("/analyze", json={"text": SAMPLE, "language": "en",
                                      "jurisdiction": "IN", "counterparty": "Bad Landlord LLC"})
    analysis_id = r.json()["id"]
    rep = client.post(f"/reports/{analysis_id}", params={"lat": 13.08, "lon": 80.27})
    assert rep.status_code == 200
    assert rep.json()["count"] >= 1
    assert any(row["counterparty"] == "Bad Landlord LLC" for row in client.get("/reports").json())
