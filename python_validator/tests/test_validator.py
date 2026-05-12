from datasheet_ci import validate


VALID_DATASHEET = """
# Motivation
# Composition
# Collection Process
# Preprocessing
# Uses
# Distribution
# Maintenance
"""


def test_valid_datasheet_passes():
    result = validate(VALID_DATASHEET)
    assert result["ok"] is True
    assert result["missing"] == []


def test_missing_sections_fail_without_blocking_pii_warning():
    result = validate("# Motivation\nContact owner@example.com")
    assert result["ok"] is False
    assert "Composition" in result["missing"]
    assert result["piiWarnings"] == [{"pattern": "email", "match": "owner@example.com"}]
