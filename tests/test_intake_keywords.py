"""Keyword helpers for AI intake flow."""
from app.services.intake_conversation_service import wants_cancel_intake, wants_start_intake


def test_wants_start_explicit():
    assert wants_start_intake("", True) is True
    assert wants_start_intake("hello", True) is True


def test_wants_start_phrases():
    assert wants_start_intake("I want to register for an account", False) is True
    assert wants_start_intake("new patient intake please", False) is True
    assert wants_start_intake("what are your hours", False) is False


def test_wants_cancel():
    assert wants_cancel_intake("cancel intake") is True
    assert wants_cancel_intake("stop") is True
    assert wants_cancel_intake("book tomorrow") is False
