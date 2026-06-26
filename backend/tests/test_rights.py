from app.services import rights


def test_illegal_deposit_escalates():
    clause = "The landlord shall forfeit the deposit if the tenant vacates early."
    out = rights.apply_rules(clause, "IN", llm_verdict="fair")
    # rule pack must escalate a fair guess to illegal + attach a citation
    assert out["verdict"] == "illegal"
    assert out["citation"]
    assert out["reason_override"]


def test_law_does_not_downgrade():
    # if the LLM says illegal but a fair rule matches, keep the stricter (illegal)
    clause = "Rent is payable in advance on or before the 5th."
    out = rights.apply_rules(clause, "IN", llm_verdict="illegal")
    assert out["verdict"] == "illegal"


def test_no_rule_keeps_llm_verdict():
    out = rights.apply_rules("The tenant shall water the plants.", "IN", llm_verdict="fair")
    assert out["verdict"] == "fair"
    assert out["citation"] == ""


def test_overall_risk_levels():
    assert rights.overall_risk([{"verdict": "fair"}])[0] == "green"
    assert rights.overall_risk([{"verdict": "unfair"}])[0] == "amber"
    assert rights.overall_risk([{"verdict": "illegal"}])[0] == "red"
    level, score = rights.overall_risk([{"verdict": "illegal"}, {"verdict": "fair"}])
    assert level == "red"
    assert 0.0 <= score <= 1.0
