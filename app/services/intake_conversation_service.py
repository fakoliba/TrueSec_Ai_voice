"""AI-guided intake: load default form, create draft submissions, ask questions turn-by-turn."""
from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.business import Business, BusinessSettings
from app.models.conversation import Conversation as ConversationModel
from app.models.customer import Customer
from app.models.intake import IntakeForm as IntakeFormModel, IntakeSubmission as IntakeSubmissionModel
from app.services.ai_agent_service import chat_completion

# Intake-specific intents (returned with reply)
INTENT_INTAKE = "intake"
INTENT_INTAKE_CANCEL = "intake_cancel"


def _normalize_qid(raw: Any) -> str:
    if raw is None:
        return ""
    return str(raw).strip()


def _questions_list(form: IntakeFormModel) -> List[Dict[str, Any]]:
    q = form.questions
    if isinstance(q, list):
        return [x for x in q if isinstance(x, dict)]
    return []


def load_default_intake_form(db: Session, business_id: int) -> Optional[IntakeFormModel]:
    """Return the business default intake form if configured, active, and valid."""
    bs = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    if not bs or not getattr(bs, "ai_intake_enabled", True):
        return None
    fid = getattr(bs, "default_intake_form_id", None)
    if not fid:
        return None
    form = (
        db.query(IntakeFormModel)
        .filter(
            IntakeFormModel.id == fid,
            IntakeFormModel.business_id == business_id,
            IntakeFormModel.is_active.is_(True),
        )
        .first()
    )
    return form


def wants_start_intake(user_message: str, explicit_start: bool) -> bool:
    if explicit_start:
        return True
    msg = (user_message or "").strip().lower()
    if not msg:
        return False
    keys = [
        "new customer",
        "new patient",
        "first visit",
        "register",
        "registration",
        "sign up",
        "signup",
        "intake form",
        "fill out",
        "patient intake",
        "customer intake",
    ]
    return any(k in msg for k in keys)


def wants_cancel_intake(user_message: str) -> bool:
    msg = (user_message or "").strip().lower()
    if not msg:
        return False
    return any(
        x in msg
        for x in (
            "cancel intake",
            "stop intake",
            "stop registering",
            "never mind",
            "forget it",
            "quit",
        )
    ) or msg in ("cancel", "stop")


def _next_unanswered_question(questions: List[Dict[str, Any]], responses: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    for q in questions:
        qid = _normalize_qid(q.get("id"))
        if not qid:
            continue
        if qid not in responses or responses.get(qid) in (None, ""):
            return q
    return None


def _extract_answer(
    user_message: str,
    question: Dict[str, Any],
) -> str:
    """Use LLM JSON extraction when API key set; else whole message as answer."""
    label = (question.get("label") or "this field").strip()
    qtype = (question.get("type") or "text").strip()
    options = question.get("options")
    if not getattr(settings, "OPENAI_API_KEY", None):
        return (user_message or "").strip()

    sys = (
        "You extract a single answer for a form field. Reply with JSON only: "
        '{"answer": "<string>"}. If unclear, best guess from the user message; use empty string if no answer.'
    )
    opt_line = ""
    if isinstance(options, list) and options:
        opt_line = " Allowed options (pick closest match): " + ", ".join(str(o) for o in options[:20])
    user = f'Field label: "{label}"\nField type: {qtype}{opt_line}\nUser said:\n"""{user_message}"""'
    raw = chat_completion(
        [{"role": "user", "content": user}],
        sys,
        model="gpt-4o-mini",
    )
    if not raw:
        return (user_message or "").strip()
    try:
        data = json.loads(raw)
        if isinstance(data, dict) and "answer" in data:
            return str(data["answer"] or "").strip()
    except json.JSONDecodeError:
        m = re.search(r'"answer"\s*:\s*"([^"]*)"', raw)
        if m:
            return m.group(1).strip()
    return (user_message or "").strip()


def cancel_intake(
    db: Session,
    conv: ConversationModel,
) -> Tuple[str, str]:
    """Clear conversation intake link; mark draft submission archived."""
    sub_id = conv.intake_submission_id
    if sub_id:
        sub = (
            db.query(IntakeSubmissionModel)
            .filter(
                IntakeSubmissionModel.id == sub_id,
                IntakeSubmissionModel.business_id == conv.business_id,
            )
            .first()
        )
        if sub and sub.status == "draft":
            sub.status = "archived"
    conv.intake_submission_id = None
    db.commit()
    return "Okay, I've cancelled the registration. Let me know if you need anything else.", INTENT_INTAKE_CANCEL


def start_intake(
    db: Session,
    business: Business,
    conv: ConversationModel,
) -> Tuple[Optional[str], str]:
    """Create draft submission and return first question prompt."""
    if conv.intake_submission_id:
        return (
            "We're already going through registration. Answer the current question when you're ready.",
            INTENT_INTAKE,
        )
    form = load_default_intake_form(db, business.id)
    if not form:
        return (
            "Intake isn't set up for this business yet. Please contact us directly.",
            "other",
        )
    questions = _questions_list(form)
    if not questions:
        return ("The registration form has no questions configured yet.", "other")

    sub = IntakeSubmissionModel(
        business_id=business.id,
        customer_id=conv.customer_id,
        intake_form_id=form.id,
        responses={},
        status="draft",
    )
    db.add(sub)
    db.flush()
    conv.intake_submission_id = sub.id
    db.commit()
    db.refresh(sub)

    first = questions[0]
    label = (first.get("label") or "this").strip()
    ph = (first.get("placeholder") or "").strip()
    hint = f' ({ph})' if ph else ""
    reply = f"I'll help you register. {label}{hint}?"
    return reply, INTENT_INTAKE


def process_intake_turn(
    db: Session,
    business: Business,
    conv: ConversationModel,
    user_message: str,
) -> Tuple[str, str]:
    """Fill next answer from user_message; ask next question or complete."""
    sub_id = conv.intake_submission_id
    if not sub_id:
        return "", "other"

    sub = (
        db.query(IntakeSubmissionModel)
        .filter(
            IntakeSubmissionModel.id == sub_id,
            IntakeSubmissionModel.business_id == business.id,
        )
        .first()
    )
    if not sub or sub.status != "draft":
        conv.intake_submission_id = None
        db.commit()
        return "", "other"

    form = (
        db.query(IntakeFormModel)
        .filter(IntakeFormModel.id == sub.intake_form_id, IntakeFormModel.business_id == business.id)
        .first()
    )
    if not form:
        conv.intake_submission_id = None
        db.commit()
        return ("Sorry, that form is no longer available.", "other")

    questions = _questions_list(form)
    responses = dict(sub.responses or {})

    current = _next_unanswered_question(questions, responses)
    if not current:
        # nothing left; finalize
        return _finalize_intake(db, business, conv, sub, responses)

    qid = _normalize_qid(current.get("id"))
    answer = _extract_answer(user_message, current)
    if not answer and current.get("required"):
        label = (current.get("label") or "this field").strip()
        return (f"I didn't catch that. Could you tell me {label}?", INTENT_INTAKE)

    if answer:
        responses[qid] = answer
    sub.responses = responses
    db.flush()

    nxt = _next_unanswered_question(questions, responses)
    if not nxt:
        return _finalize_intake(db, business, conv, sub, responses)

    label = (nxt.get("label") or "the next detail").strip()
    ph = (nxt.get("placeholder") or "").strip()
    hint = f' ({ph})' if ph else ""
    reply = f"Thanks. {label}{hint}?"
    db.commit()
    return reply, INTENT_INTAKE


def _finalize_intake(
    db: Session,
    business: Business,
    conv: ConversationModel,
    sub: IntakeSubmissionModel,
    responses: Dict[str, Any],
) -> Tuple[str, str]:
    sub.responses = responses
    sub.status = "pending"
    _try_create_customer_from_responses(db, business, conv, sub)
    conv.intake_submission_id = None
    conv.intent = INTENT_INTAKE
    db.commit()
    return (
        "Thank you — I've saved your registration. Someone from the team may follow up if needed. Is there anything else I can help with?",
        INTENT_INTAKE,
    )


def _try_create_customer_from_responses(
    db: Session,
    business: Business,
    conv: ConversationModel,
    sub: IntakeSubmissionModel,
) -> None:
    """Map common question ids to Customer; link to submission and conversation."""
    r = sub.responses or {}
    fn = _norm_str(r.get("first_name") or r.get("first") or r.get("firstName"))
    ln = _norm_str(r.get("last_name") or r.get("last") or r.get("lastName"))
    if not fn and not ln:
        # single "name" field
        full = _norm_str(r.get("name") or r.get("full_name"))
        if full:
            parts = full.split(None, 1)
            fn = parts[0]
            ln = parts[1] if len(parts) > 1 else "."
    if not fn:
        fn = "Unknown"
    if not ln:
        ln = "."

    phone = _norm_str(r.get("phone") or r.get("phone_number") or r.get("mobile"))
    email = _norm_str(r.get("email") or r.get("e_mail"))
    addr = _norm_str(r.get("address") or r.get("street"))

    if fn == "Unknown" and ln == "." and not phone and not email:
        return

    cust = Customer(
        business_id=business.id,
        first_name=fn[:100],
        last_name=ln[:100],
        email=email or None,
        phone=phone or None,
        address=addr or None,
    )
    db.add(cust)
    db.flush()
    sub.customer_id = cust.id
    conv.customer_id = cust.id


def _norm_str(v: Any) -> str:
    if v is None:
        return ""
    return str(v).strip()
