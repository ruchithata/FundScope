from decimal import Decimal

from app.api.export import _csv_value


def test_csv_value_preserves_decimal_precision():
    value = Decimal("1234567890.123456789")

    assert _csv_value(value) == "1234567890.123456789"


def test_csv_value_preserves_decimal_scale():
    assert _csv_value(Decimal("110.200000000")) == "110.200000000"


def test_csv_value_handles_none():
    assert _csv_value(None) == ""