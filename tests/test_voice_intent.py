"""Voice keyword intents for Phase 2–3."""
from app.services.ai_agent_service import detect_intent_simple


def test_cancel_before_appointment():
    assert detect_intent_simple("cancel my appointment") == "cancel_appointment"
    assert detect_intent_simple("I need a cancellation") == "cancel_appointment"


def test_reschedule():
    assert detect_intent_simple("reschedule my visit") == "reschedule_appointment"
    assert detect_intent_simple("move my appointment to Tuesday") == "reschedule_appointment"


def test_new_vs_returning():
    assert detect_intent_simple("I'm a new customer") == "new_customer"
    assert detect_intent_simple("existing patient here") == "returning_customer"


def test_book_still_appointment():
    assert detect_intent_simple("book an appointment tomorrow") == "appointment"
