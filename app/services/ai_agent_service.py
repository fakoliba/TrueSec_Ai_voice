"""
AI Agent service: OpenAI integration, business context, and conversation handling.
"""
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional

from openai import OpenAI
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.business import Business, BusinessSettings
from app.models.service import Service
from app.services.availability_service import get_business_hours

SYSTEM_PROMPT_TEMPLATE = """You are a friendly AI assistant for "{business_name}", a small business.

## Scope (strict — follow always)
- **Only** respond to topics about: (1) **{business_name}** — hours, location, services, appointments, contact details, and anything explicitly provided in the business context below; (2) **{app_name}** — what this assistant is for (helping customers learn about the business and schedule or inquire about appointments) and how this channel works at a high level.
- **Do not** answer questions outside this scope: no general knowledge, trivia, news, other businesses, unrelated technical or personal advice, homework, coding, medical/legal opinions, or any topic not clearly about this business or this assistant offering.
- If the user asks something off-topic, decline briefly and politely: say you can only help with **{business_name}** and **{app_name}**, then invite them to ask about hours, services, or appointments.

## Your role within scope
Help customers with:
- Business hours and location
- Services offered and pricing (when known)
- Booking or inquiring about appointments

Use the following business information to answer accurately. If you don't have specific info (e.g. pricing), say so politely. Keep responses concise and helpful. If the customer wants to book an appointment, suggest times from the available slots below when provided, or ask for their preferred date/time.

## Business context
{context}
"""

INTERNAL_HELP_SYSTEM_PROMPT = """You are an internal help assistant for staff at "{business_name}" who use the {app_name} dashboard.

## Who you help
- The user is a **team member** (not a customer). They need help using the product: navigation, settings, users, services, appointments, intake configuration, voice setup, etc.

## Scope (strict)
- **Only** answer questions about using this dashboard/product and the business context below (hours, services, how things are configured in the app).
- **Do not** run customer intake, collect customer PII for booking, or offer appointment slots in this chat. If someone asks to book or register a customer, say clearly: **customers use the phone (voice line) for booking and intake** — this chat is for staff help only.
- **Do not** answer off-topic general knowledge, other products, coding tutorials unrelated to the app, etc.

## Tone
Clear, concise, step-by-step when explaining UI. If you are unsure about a specific screen, say what you can infer from the context and suggest they check Settings or the relevant section.

## Business / product context
{context}
"""


def _format_business_hours(hours: Dict[str, Any]) -> str:
    """Format business hours for the context string."""
    lines = []
    day_names = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
    for day in day_names:
        cfg = hours.get(day)
        if not cfg or not cfg.get("open"):
            lines.append(f"- {day.capitalize()}: Closed")
        else:
            lines.append(f"- {day.capitalize()}: {cfg.get('open', '')} - {cfg.get('close', '')}")
    return "\n".join(lines)


def build_business_context(db: Session, business: Business) -> str:
    """Build a string describing the business for the AI system prompt."""
    parts = [
        f"Business name: {business.name}",
        f"Timezone: {business.timezone or 'UTC'}",
        f"Address: {business.address or 'Not specified'}",
        f"Phone: {business.phone or 'Not specified'}",
        "",
        "Business hours:",
        _format_business_hours(get_business_hours(db, business.id)),
    ]
    services = db.query(Service).filter(Service.business_id == business.id).all()
    if services:
        parts.append("")
        parts.append("Services offered:")
        for s in services:
            parts.append(f"- {s.name}" + (f" (duration: {s.duration_minutes} min)" if getattr(s, "duration_minutes", None) else ""))
    return "\n".join(parts)


async def get_context_with_slots(
    db: Session,
    business: Business,
    from_date: Optional[date] = None,
    days_ahead: int = 3,
) -> str:
    """Build business context and append available slots for the next few days."""
    base = build_business_context(db, business)
    from_date = from_date or date.today()
    try:
        from app.services.availability_service import get_available_slots_async
        to_date = from_date + timedelta(days=days_ahead)
        slots = await get_available_slots_async(
            db=db,
            business_id=business.id,
            business=business,
            from_date=from_date,
            to_date=to_date,
            slot_minutes=30,
            include_calendar=True,
        )
        if slots:
            base += "\n\nAvailable appointment slots (start - end, UTC):\n"
            for s in slots[:20]:
                base += f"- {s.get('start', '')} to {s.get('end', '')}\n"
    except Exception:
        pass
    return base


def detect_intent_simple(user_message: str) -> str:
    """Keyword-based intent. Returns handoff, cancel_appointment, reschedule_appointment, new_customer, returning_customer, appointment, hours, inquiry, other."""
    msg = (user_message or "").strip().lower()
    if not msg:
        return "other"
    if any(w in msg for w in ["person", "human", "agent", "representative", "real person", "operator", "someone", "speak to a", "transfer", "hold for"]):
        return "handoff"
    if any(
        w in msg
        for w in [
            "cancel my appointment",
            "cancel the appointment",
            "cancel an appointment",
            "cancellation",
            "call off",
            "don't need my appointment",
            "dont need my appointment",
        ]
    ) or (msg in ("cancel", "cancellation") or (msg.startswith("cancel") and "appointment" in msg)):
        return "cancel_appointment"
    if any(
        w in msg
        for w in [
            "reschedule",
            "rescheduling",
            "move my appointment",
            "change my appointment",
            "different time",
            "different day",
            "another time",
            "another day",
            "push it back",
        ]
    ):
        return "reschedule_appointment"
    if any(w in msg for w in ["new patient", "new customer", "first time", "first visit", "never been", "never visited"]):
        return "new_customer"
    if any(
        w in msg
        for w in [
            "existing patient",
            "existing customer",
            "returning",
            "already a patient",
            "already a customer",
            "seen you before",
            "been there before",
        ]
    ):
        return "returning_customer"
    if any(w in msg for w in ["book", "schedule", "appointment", "reserve", "slot", "available"]):
        return "appointment"
    if any(w in msg for w in ["hour", "open", "close", "when are you"]):
        return "hours"
    if any(w in msg for w in ["price", "cost", "service", "what do you offer"]):
        return "inquiry"
    return "other"


def chat_completion(
    messages: List[Dict[str, str]],
    system_prompt: str,
    model: str = "gpt-4o-mini",
) -> Optional[str]:
    """
    Call OpenAI Chat Completions. messages: [{"role": "user"|"assistant", "content": "..."}].
    Returns the assistant reply text or None on error.
    """
    if not getattr(settings, "OPENAI_API_KEY", None) or not settings.OPENAI_API_KEY:
        return None
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    full = [{"role": "system", "content": system_prompt}] + [
        {"role": m.get("role", "user"), "content": m.get("content", "") or ""}
        for m in messages
    ]
    try:
        resp = client.chat.completions.create(
            model=model,
            messages=full,
            max_tokens=500,
        )
        if resp.choices:
            return (resp.choices[0].message.content or "").strip()
    except Exception:
        pass
    return None


VOICE_SYSTEM_ADDON = """

You are on a phone call. Keep every reply very brief (1–2 short sentences). Speak naturally; do not say "please speak after the beep" or mention recording.
When the customer says they want to schedule a new appointment (or book, or make an appointment), respond with: "Can I have your name, starting with your first and last name?"
When they say they want to update an existing appointment, ask for their name or the details you need to look it up.
"""

VOICE_SLOT_ADDON = """

You are collecting booking details. So far we have: {slots_collected}. We still need: {slots_missing}. Ask for exactly ONE of the missing items in one short sentence (e.g. "What date works for you?" or "What time would you prefer?").
"""


async def get_ai_reply(
    db: Session,
    business: Business,
    messages: List[Dict[str, str]],
    include_slots: bool = True,
    channel: str = "chat",
    voice_slots: Optional[Dict[str, Any]] = None,
    voice_missing_slots: Optional[List[str]] = None,
) -> tuple[Optional[str], str]:
    """
    Get AI reply for the given conversation messages.
    Returns (reply_text, detected_intent). reply_text is None if OpenAI is not configured or errors.
    channel: "voice" for phone calls (adds brief, conversational flow including asking for name when scheduling).
    voice_slots / voice_missing_slots: when in slot-filling, pass collected slots and list of still-missing slot names so the AI asks for the next one.
    """
    context = build_business_context(db, business)
    if include_slots:
        context = await get_context_with_slots(db, business)
    system_prompt = SYSTEM_PROMPT_TEMPLATE.format(
        business_name=business.name,
        app_name=settings.APP_NAME,
        context=context,
    )
    if channel == "voice":
        system_prompt = system_prompt.rstrip() + VOICE_SYSTEM_ADDON
        if voice_slots is not None and voice_missing_slots is not None and len(voice_missing_slots) > 0:
            slots_collected = ", ".join(f"{k}={v}" for k, v in voice_slots.items() if v)
            slots_missing = ", ".join(voice_missing_slots)
            system_prompt = system_prompt.rstrip() + VOICE_SLOT_ADDON.format(
                slots_collected=slots_collected or "nothing yet",
                slots_missing=slots_missing,
            )
    last_user = next((m for m in reversed(messages) if m.get("role") == "user"), None)
    intent = detect_intent_simple(last_user.get("content", "") if last_user else "")
    reply = chat_completion(messages, system_prompt)
    return reply, intent


async def get_internal_help_reply(
    db: Session,
    business: Business,
    messages: List[Dict[str, str]],
) -> tuple[Optional[str], str]:
    """
    Staff-only dashboard help: no customer intake, no slot suggestions.
    Returns (reply_text, intent) where intent is always 'none'.
    """
    context = build_business_context(db, business)
    system_prompt = INTERNAL_HELP_SYSTEM_PROMPT.format(
        business_name=business.name,
        app_name=settings.APP_NAME,
        context=context,
    )
    reply = chat_completion(messages, system_prompt)
    return reply, "none"
