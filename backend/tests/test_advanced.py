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


def _admin_headers():
    """The seeded demo account is an admin."""
    tok = client.post("/auth/login", json={
        "email": "demo@clauseguard.app", "password": "demo1234"}).json()["token"]
    return {"Authorization": f"Bearer {tok}"}


# --- Role management (admin) ---
def test_signup_defaults_to_user_role():
    h, _ = _signup()
    assert client.get("/auth/me", headers=h).json()["role"] == "user"


def test_non_admin_cannot_manage_roles():
    h, _ = _signup()
    assert client.get("/admin/users", headers=h).status_code == 403


def test_admin_promotes_user_and_unlocks_gated_route():
    # a plain user is blocked from the reviewer-only route
    h, uid = _signup()
    det = client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT}).json()
    fid = det["findings"][0]["id"]
    assert client.patch(f"/detection/findings/{fid}/review", headers=h,
                        json={"verdict": "confirmed"}).status_code == 403

    # admin promotes them to reviewer
    ah = _admin_headers()
    promoted = client.patch(f"/admin/users/{uid}/role", headers=ah, json={"role": "reviewer"})
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "reviewer"

    # now the same user can review (new token reflects DB role on each request)
    r = client.patch(f"/detection/findings/{fid}/review", headers=h, json={"verdict": "confirmed"})
    assert r.status_code == 200
    assert r.json()["review_verdict"] == "confirmed"


def test_admin_cannot_self_demote():
    ah = _admin_headers()
    me = client.get("/auth/me", headers=ah).json()
    r = client.patch(f"/admin/users/{me['id']}/role", headers=ah, json={"role": "user"})
    assert r.status_code == 400


def test_translate_uses_offline_dictionary():
    """UI strings must translate via the built-in dictionary even in AI_MOCK mode."""
    r = client.post("/translate", json={
        "texts": ["Dashboard", "Users", "Human Rights"], "language": "Tamil"}).json()
    out = r["translations"]
    assert len(out) == 3
    # none should remain the English original (dictionary must have replaced them)
    assert out[0] != "Dashboard" and out[1] != "Users"
    assert "டாஷ்போர்டு" == out[0]


def test_translate_english_passthrough():
    r = client.post("/translate", json={"texts": ["Dashboard"], "language": "English"}).json()
    assert r["translations"] == ["Dashboard"]


def test_admin_platform_stats():
    # generate some data as a regular user
    h, _ = _signup()
    client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT, "title": "Stats contract"})
    client.post("/cases", headers=h, json={"title": "Stats case", "category": "wages"})

    # non-admin cannot see platform stats
    assert client.get("/admin/stats", headers=h).status_code == 403

    # admin gets the aggregated oversight view
    s = client.get("/admin/stats", headers=_admin_headers()).json()
    assert s["users"]["total"] >= 1 and "by_role" in s["users"]
    assert s["detections"]["total"] >= 1
    assert "pending_review" in s["findings"]
    assert s["cases"]["total"] >= 1 and "resolution_rate" in s["cases"]


def test_invalid_role_rejected():
    ah = _admin_headers()
    h, uid = _signup()
    r = client.patch(f"/admin/users/{uid}/role", headers=ah, json={"role": "wizard"})
    assert r.status_code == 400


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


def test_review_queue_lists_pending_and_reviewer_gated():
    # a plain user cannot see the review queue
    h, _ = _signup()
    assert client.get("/detection/review-queue", headers=h).status_code == 403

    # generate findings, then the admin (has review perm) sees them in the queue
    client.post("/detection/run", headers=h, json={
        "domain": "human_rights", "text": HR_TEXT, "title": "Queue contract"})
    ah = _admin_headers()
    q = client.get("/detection/review-queue", headers=ah).json()
    assert len(q) >= 1
    item = q[0]
    assert item["finding_id"] and item["detection_title"] and not item["reviewed"]

    # after reviewing, it drops out of the pending queue
    client.patch(f"/detection/findings/{item['finding_id']}/review", headers=ah,
                 json={"verdict": "confirmed"})
    pending_ids = {i["finding_id"] for i in client.get("/detection/review-queue", headers=ah).json()}
    assert item["finding_id"] not in pending_ids


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
