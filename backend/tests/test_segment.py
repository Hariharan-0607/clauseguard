from app.services.segment import split_clauses


def test_numbered_clauses():
    text = ("1. The tenant shall pay rent monthly.\n"
            "2. The landlord may forfeit the deposit.\n"
            "3. Notice of one month is required.")
    clauses = split_clauses(text)
    assert len(clauses) == 3
    assert "rent monthly" in clauses[0]


def test_blank_line_blocks():
    text = "First clause about rent here.\n\nSecond clause about the deposit here."
    clauses = split_clauses(text)
    assert len(clauses) == 2


def test_empty():
    assert split_clauses("") == []


def test_short_fragments_dropped():
    text = "1. ok\n2. This is a real clause with enough length to keep."
    clauses = split_clauses(text)
    assert all(len(c) >= 10 for c in clauses)
