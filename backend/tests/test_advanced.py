"""End-to-end tests for the advanced modules (run against the offline AI mock).

Covers: Detection Engine, Case Management + RBAC, Estimation, Personal Agent,
and the event-driven memory seeding.
"""
import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.core.roles import Role, Permission, has_permission

client = TestClient(app)

HR_TEXT = (
    "1. The worker cannot leave the premises and the employer will confiscate passport until the debt is cleared.\n"
    "2. Any complaint will result in immediate termination of the worker.\n"
    "3. Salary will be deducted as a penalty for arriving late.\n"
)


def _signup(role=None):
    email = f"{uuid.uuid4().hex[:8]}@test.com"
    tok = client.post("/auth/signup", json={
        "email": email, "password": "secret123", "name": "T"}).json()["token"]
    h = {"Authorization": f"Bearer {tok}"}
    uid = client.get("/auth/me", headers=h).json()["id"]
    return h, uid


# --- RBAC unit ---
def test_permission_matrix():
    assert has_permission(Role.ADMIN, Permission.USER_MANAGE)
    assert not has_permission(Role.USER, Permission.DETECTION_REVIEW)
    assert has_permission(Role.REVIEWER, Permission.DETECTION_REVIEW)
    assert has_permission(Role.CASEWORKER, Permission.CASE_ASSIGN)


# --- Detection Engine ---
def test_detection_domains_listed():
    domains = [d["domain"] for d in client.get("/detection/domains").json()]
    assert {"human_rights", "exploitation", "consumer", "dark_patterns",
            "hr_compliance", "vendor_risk"} <= set(domains)


def test_detection_run_finds_violations():
    h, _ = _signup()
    r = client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT, "jurisdiction": "IN",
        "title": "Labour contract", "subject": "Acme Labour", "region": "Chennai"})
    assert r.status_code == 200
    data = r.json()
    assert data["severity"] in ("high", "critical")
    assert len(data["findings"]) >= 1
    cats = {f["category"] for f in data["findings"]}
    assert cats & {"forced_labor", "retaliation", "unlawful_salary_deduction"}
    # each finding carries an applicable law + actions
    f0 = data["findings"][0]
    assert f0["laws"] and f0["recommended_actions"]


def test_detection_review_requires_reviewer_role():
    h, _ = _signup()  # plain user
    det = client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT}).json()
    fid = det["findings"][0]["id"]
    # a normal user lacks DETECTION_REVIEW -> 403
    r = client.patch(f"/detection/findings/{fid}/review", headers=h, json={"verdict": "confirmed"})
    assert r.status_code == 403


def test_detection_analytics():
    h, _ = _signup()
    client.post("/detection/run", headers=h, json={
        "domain": "exploitation", "text": "We will keep the deposit and pay below minimum wage.",
        "subject": "BadCorp", "region": "Mumbai", "industry": "construction"})
    a = client.get("/detection/analytics/exploitation", headers=h).json()
    assert a["total_detections"] >= 1
    assert "severity_mix" in a and "top_categories" in a


# --- Case Management + RBAC ---
def test_case_lifecycle_and_ownership():
    h, uid = _signup()
    case = client.post("/cases", headers=h, json={
        "title": "Unpaid wages", "category": "wages", "priority": "high",
        "summary": "Employer withheld 2 months salary."}).json()
    assert case["status"] == "open"
    assert any(e["kind"] == "system" for e in case["events"])  # creation event logged

    # status update is recorded on the timeline
    upd = client.patch(f"/cases/{case['id']}", headers=h, json={"status": "in_progress"}).json()
    assert upd["status"] == "in_progress"
    assert any("in_progress" in e["title"] for e in upd["events"])

    # add evidence + note
    client.post(f"/cases/{case['id']}/evidence", headers=h,
                json={"label": "Payslip", "kind": "document"})
    client.post(f"/cases/{case['id']}/events", headers=h,
                json={"kind": "note", "title": "Called HR", "body": "No response."})
    full = client.get(f"/cases/{case['id']}", headers=h).json()
    assert len(full["evidence"]) == 1

    # another user cannot read this case
    h2, _ = _signup()
    assert client.get(f"/cases/{case['id']}", headers=h2).status_code == 403


def test_case_assign_requires_permission():
    h, _ = _signup()
    case = client.post("/cases", headers=h, json={"title": "X"}).json()
    # plain user can't assign
    r = client.patch(f"/cases/{case['id']}", headers=h, json={"assignee_id": "someone"})
    assert r.status_code == 403


# --- Estimation ---
def test_compensation_wage_theft():
    h, _ = _signup()
    r = client.post("/estimation/compensation", headers=h, json={
        "claim_type": "wage_theft", "currency": "INR",
        "inputs": {"monthly_wage": 20000, "months_unpaid": 3}}).json()
    assert r["kind"] == "compensation"
    assert r["amount_mid"] >= 60000        # 3 x 20000 principal at least
    assert r["amount_low"] < r["amount_mid"] < r["amount_high"]
    assert r["legal_basis"]


def test_cost_prediction():
    h, _ = _signup()
    r = client.post("/estimation/cost", headers=h, json={
        "forum": "labour_court", "complexity": 1.5, "claim_amount": 200000}).json()
    assert r["kind"] == "cost"
    assert r["amount_mid"] > 0
    labels = {b["label"] for b in r["breakdown"]}
    assert {"Lawyer fees", "Court costs", "Filing fees"} <= labels


def test_settlement_bands():
    h, _ = _signup()
    r = client.post("/estimation/settlement", headers=h, json={
        "claim_amount": 100000, "evidence_strength": 0.9}).json()
    assert 0 < r["probability"] <= 1
    assert r["amount_low"] <= r["amount_mid"] <= r["amount_high"]


def test_compensation_bad_type():
    h, _ = _signup()
    r = client.post("/estimation/compensation", headers=h, json={
        "claim_type": "nonsense", "inputs": {}})
    assert r.status_code == 400


# --- Personal Agent + event-driven memory ---
def test_agent_chat_and_memory():
    h, _ = _signup()
    client.post("/agent/memories", headers=h,
                json={"content": "My landlord is withholding my deposit of 50000.", "kind": "fact"})
    r = client.post("/agent/chat", headers=h,
                    json={"message": "What should I do about my deposit?"}).json()
    assert len(r["answer"]) > 10
    mems = client.get("/agent/memories", headers=h).json()
    assert len(mems) >= 1


def test_passport_trust_score_and_aggregation():
    h, _ = _signup()
    # fresh passport starts fully protected
    p = client.get("/passport/worker", headers=h).json()
    assert p["kind"] == "worker"
    assert p["trust_score"] == 100
    assert p["rights"]

    # adding records raises completeness
    upd = client.patch("/passport/worker", headers=h, json={
        "display_name": "Ravi", "records": {"employer": "Acme", "wage": 20000}}).json()
    assert upd["record_completeness"] > 0

    # a critical detection should lower the trust score (live aggregation)
    client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT, "title": "Contract"})
    after = client.get("/passport/worker", headers=h).json()
    assert after["trust_score"] < 100
    assert after["risk_factors"]
    assert after["stats"]["checks_run"] >= 1


def test_passport_bad_kind():
    h, _ = _signup()
    assert client.get("/passport/spaceship", headers=h).status_code == 400


def test_detection_seeds_agent_memory():
    """Event-driven: running a detection should add a memory for that user."""
    h, _ = _signup()
    before = len(client.get("/agent/memories", headers=h).json())
    client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT, "title": "Contract"})
    after = client.get("/agent/memories", headers=h).json()
    assert len(after) > before
    assert any("human_rights" in m["content"] for m in after)
