"""
Twilio voice webhooks: incoming call, recording callback, TTS play, next turn.
No auth (Twilio calls these). business_id is passed as query param on initial webhook.
"""
import logging
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.business import Business, BusinessSettings
from app.models.conversation import Conversation as ConversationModel
from app.models.call_log import CallLog
from app.services.ai_agent_service import detect_intent_simple, get_ai_reply
from app.services.voice_entitlements import resolve_elevenlabs_voice_id, resolve_voice_stack
from app.services.voice_service import transcribe_audio, text_to_speech
from app.services.voice_appointment_manage import handle_voice_manage
from app.services.slot_filling import (
    get_missing_slots,
    extract_slots_from_message,
    slots_to_start_end,
    create_voice_appointment,
)
from app.services.voice_call_state import (
    get_call_state,
    set_call_state,
    init_call_state,
    get_audio_by_token,
    store_audio_token,
    generate_audio_token,
    MAX_TURNS,
)

logger = logging.getLogger(__name__)
router = APIRouter()


def _base_url() -> str:
    return (getattr(settings, "VOICE_WEBHOOK_BASE_URL", None) or "").rstrip("/") or "http://localhost:8000"


def _twiml_response(xml: str) -> Response:
    return Response(content=xml, media_type="application/xml")


def _persist_voice_providers(
    db: Session,
    state: dict,
    business_id: int,
    stt: str,
    tts: str,
) -> None:
    call_log_id = state.get("call_log_id")
    if not call_log_id:
        return
    cl = (
        db.query(CallLog)
        .filter(CallLog.id == call_log_id, CallLog.business_id == business_id)
        .first()
    )
    if cl:
        cl.voice_providers = {"stt": stt, "tts": tts}
        db.commit()


@router.post("/incoming")
async def voice_incoming(
    request: Request,
    business_id: int,
):
    """
    Twilio webhook when a call comes in. Configure Twilio number to point here with ?business_id=X.
    Returns TwiML to answer, say greeting, and start recording.
    """
    t0 = time.perf_counter()
    form = await request.form()
    call_sid = form.get("CallSid") or ""
    from_number = form.get("From") or ""

    # Validate business exists and capture name before session closes
    db: Session = next(get_db())
    business_name = "our business"
    try:
        business = db.query(Business).filter(Business.id == business_id).first()
        if not business:
            return _twiml_response(
                '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid configuration. Goodbye.</Say><Hangup/></Response>'
            )
        business_name = business.name or business_name
        # Initialize call state
        state = init_call_state(call_sid, business_id)
        state["phone_number"] = from_number
        set_call_state(call_sid, state)

        # Optional: create CallLog
        call_log = CallLog(
            business_id=business_id,
            phone_number=from_number,
            direction="inbound",
            status="in_progress",
            twilio_call_sid=call_sid,
        )
        db.add(call_log)
        db.commit()
        db.refresh(call_log)
        state["call_log_id"] = call_log.id
        set_call_state(call_sid, state)
    finally:
        db.close()

    base = _base_url()
    action_url = f"{base}/api/voice/recording"
    greeting = (
        f"Thank you for calling {_escape_say(business_name)}. "
        "Say book, reschedule, cancel, new customer, or existing customer — or ask your question."
    )
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>{_escape_say(greeting)}</Say>
  <Pause length="1"/>
  <Record action="{action_url}" maxLength="15" playBeep="false" timeout="5" />
</Response>"""
    return _twiml_response(twiml)


@router.post("/recording")
async def voice_recording(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Twilio callback when user finishes speaking. We transcribe, get AI reply, TTS, and return TwiML to play and then redirect to next.
    """
    t0 = time.perf_counter()
    form = await request.form()
    call_sid = form.get("CallSid") or ""
    recording_url = form.get("RecordingUrl") or ""

    state = get_call_state(call_sid)
    if not state:
        return _twiml_response(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Session expired. Goodbye.</Say><Hangup/></Response>'
        )

    business_id = state["business_id"]
    business = db.query(Business).filter(Business.id == business_id).first()
    if not business:
        return _twiml_response(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Goodbye.</Say><Hangup/></Response>'
        )

    biz_settings = db.query(BusinessSettings).filter(BusinessSettings.business_id == business_id).first()
    ai_voice_cfg = (biz_settings and biz_settings.ai_voice_settings) or {}
    voice_stack = resolve_voice_stack(
        business.subscription_plan,
        business.subscription_status,
        ai_voice_cfg,
    )
    elevenlabs_voice_id = resolve_elevenlabs_voice_id(business.subscription_plan, ai_voice_cfg)

    # Fetch recording from Twilio (requires auth)
    t_fetch = time.perf_counter()
    audio_bytes = None
    if recording_url and getattr(settings, "TWILIO_ACCOUNT_SID", None) and getattr(settings, "TWILIO_AUTH_TOKEN", None):
        try:
            with httpx.Client() as client:
                r = client.get(
                    recording_url,
                    auth=(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN),
                    timeout=15.0,
                )
                if r.status_code == 200:
                    audio_bytes = r.content
        except Exception:
            pass
    fetch_ms = (time.perf_counter() - t_fetch) * 1000

    t_transcribe = time.perf_counter()
    user_text = ""
    stt_provider = "openai"
    if audio_bytes:
        user_text, stt_provider = transcribe_audio(
            audio_bytes, "recording.mp3", stack=voice_stack
        )
        user_text = user_text or ""
    transcribe_ms = (time.perf_counter() - t_transcribe) * 1000
    if not user_text:
        user_text = "I didn't catch that."

    voice_intent = detect_intent_simple(user_text)

    # Handoff: transfer to number or voicemail
    if voice_intent == "handoff":
        handoff_phone = (ai_voice_cfg.get("handoff_phone") or "").strip()
        voicemail_only = bool(ai_voice_cfg.get("handoff_voicemail_only"))

        if handoff_phone and not voicemail_only:
            # Transfer to business number (E.164). callerId so the business sees who's calling
            caller = (state.get("phone_number") or "").strip()
            twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Connecting you now. Please hold.</Say>
  <Dial timeout="30" callerId="{_escape_say(caller)}">{_escape_say(handoff_phone)}</Dial>
  <Say>The call could not be completed. Goodbye.</Say>
  <Hangup/>
</Response>"""
            return _twiml_response(twiml)
        # Voicemail or no number: record message
        twiml = """<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>Please leave your name and message after the beep. Press any key when finished.</Say>
  <Record maxLength="120" playBeep="true" />
  <Say>Thank you. Goodbye.</Say>
  <Hangup/>
</Response>"""
        return _twiml_response(twiml)

    # Build messages
    messages = list(state.get("messages") or [])
    now_iso = datetime.now(timezone.utc).isoformat()
    messages.append({"role": "user", "content": user_text, "timestamp": now_iso})

    from app.services.intake_conversation_service import (
        cancel_intake,
        process_intake_turn,
        start_intake,
        wants_cancel_intake,
        wants_start_intake,
    )

    conv = None
    _cid = state.get("conversation_id")
    if _cid:
        conv = (
            db.query(ConversationModel)
            .filter(
                ConversationModel.id == _cid,
                ConversationModel.business_id == business_id,
            )
            .first()
        )

    reply_text: Optional[str] = None
    intent = voice_intent
    llm_ms = 0.0
    intake_handled = False
    manage_outcome: Optional[str] = None

    if conv and wants_cancel_intake(user_text) and conv.intake_submission_id:
        reply_text, intent = cancel_intake(db, conv)
        intake_handled = True
    elif conv and conv.intake_submission_id:
        r, intent = process_intake_turn(db, business, conv, user_text)
        if r:
            reply_text = r
            intake_handled = True
    elif wants_start_intake(user_text, False):
        if not conv:
            conv = ConversationModel(
                business_id=business_id,
                customer_id=None,
                channel="voice",
                messages=[],
            )
            db.add(conv)
            db.flush()
            state["conversation_id"] = conv.id
            set_call_state(call_sid, state)
        reply_text, intent = start_intake(db, business, conv)
        intake_handled = True

    if not intake_handled:
        intent = voice_intent
        # Phase 2: switch into cancel/reschedule (only when not already in that flow)
        if voice_intent == "reschedule_appointment" and state.get("manage_kind") != "reschedule":
            state["slot_intent"] = None
            state["slots"] = {}
            state["manage_kind"] = "reschedule"
            state["manage_step"] = "resolve"
            state["manage_appointment_ids"] = []
            state["manage_selected_appointment_id"] = None
            state["manage_slots"] = {}
            set_call_state(call_sid, state)
        elif voice_intent == "cancel_appointment" and state.get("manage_kind") != "cancel":
            state["slot_intent"] = None
            state["slots"] = {}
            state["manage_kind"] = "cancel"
            state["manage_step"] = "resolve"
            state["manage_appointment_ids"] = []
            state["manage_selected_appointment_id"] = None
            state["manage_slots"] = {}
            set_call_state(call_sid, state)

        if state.get("manage_kind") in ("cancel", "reschedule"):
            r_manage, int_manage, patch_m, manage_outcome = handle_voice_manage(
                db,
                business,
                business_id,
                state.get("phone_number"),
                user_text,
                state,
            )
            if r_manage is not None:
                reply_text = r_manage
                intent = int_manage
                state.update(patch_m)
                set_call_state(call_sid, state)

        if reply_text is None and not state.get("manage_kind"):
            # Phase 3: one-shot route tags (analytics / context)
            if voice_intent == "new_customer" and not state.get("customer_route"):
                state["customer_route"] = "new"
                set_call_state(call_sid, state)
            elif voice_intent == "returning_customer" and not state.get("customer_route"):
                state["customer_route"] = "returning"
                set_call_state(call_sid, state)

        if reply_text is None:
            intent = voice_intent
        slots = dict(state.get("slots") or {})
        slot_intent = state.get("slot_intent")

        # Start slot-filling when user wants to book
        if reply_text is None and intent == "appointment" and not slot_intent:
            slot_intent = "schedule_appointment"

        if reply_text is None and slot_intent == "schedule_appointment":
            missing_before = get_missing_slots(slots, "appointment")
            slots = extract_slots_from_message(user_text, slots, missing_before)
            state["slots"] = slots
            state["slot_intent"] = slot_intent
            set_call_state(call_sid, state)
            missing = get_missing_slots(slots, "appointment")

            # All slots filled: try to create appointment
            if not missing:
                pair = slots_to_start_end(slots, business)
                if pair:
                    start_utc, end_utc = pair
                    title = f"Voice: {slots.get('customer_name', 'Customer')}"
                    apt = create_voice_appointment(
                        db=db,
                        business_id=business_id,
                        title=title,
                        start_time=start_utc,
                        end_time=end_utc,
                        customer_name=slots.get("customer_name"),
                        caller_phone=state.get("phone_number"),
                    )
                    if apt:
                        reply_text = (
                            f"You're all set. I've booked {slots.get('date', '')} at {slots.get('time', '')} "
                            f"for {slots.get('customer_name', 'you')}. Anything else?"
                        )
                        state["slot_intent"] = None
                        state["slots"] = {}
                        set_call_state(call_sid, state)
                    else:
                        reply_text = "That time is no longer available. Can you pick another date or time?"
                else:
                    reply_text = "I couldn't understand the date or time. Please say the date and time again."
            else:
                # Ask for next slot via AI
                t_llm = time.perf_counter()
                reply_text, intent = await get_ai_reply(
                    db=db,
                    business=business,
                    messages=messages,
                    include_slots=True,
                    channel="voice",
                    voice_slots=slots,
                    voice_missing_slots=missing,
                )
                llm_ms = (time.perf_counter() - t_llm) * 1000
        elif reply_text is None:
            t_llm = time.perf_counter()
            reply_text, intent = await get_ai_reply(
                db=db, business=business, messages=messages, include_slots=True, channel="voice"
            )
            llm_ms = (time.perf_counter() - t_llm) * 1000

    if not reply_text:
        reply_text = "I'm sorry, I couldn't process that right now. Please try again or call back later."

    messages.append({"role": "assistant", "content": reply_text, "timestamp": now_iso})
    state["messages"] = messages
    state["turn_count"] = state.get("turn_count", 0) + 1
    state["intent"] = intent
    set_call_state(call_sid, state)

    # Persist conversation
    conv: ConversationModel | None = None
    conv_id = state.get("conversation_id")
    if conv_id:
        conv = db.query(ConversationModel).filter(
            ConversationModel.id == conv_id,
            ConversationModel.business_id == business_id,
        ).first()
        if conv:
            conv.messages = messages
            conv.intent = intent
            db.commit()
    else:
        conv = ConversationModel(
            business_id=business_id,
            customer_id=None,
            channel="voice",
            messages=messages,
            intent=intent,
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)
        state["conversation_id"] = conv.id
        set_call_state(call_sid, state)

    # Link voice CallLog row to this AI conversation (for dashboard transcript URL)
    if conv is not None:
        call_log_id = state.get("call_log_id")
        if call_log_id:
            cl = (
                db.query(CallLog)
                .filter(CallLog.id == call_log_id, CallLog.business_id == business_id)
                .first()
            )
            if cl:
                cl.conversation_id = conv.id
                db.commit()

    # TTS and cache for Play URL
    t_tts = time.perf_counter()
    audio, tts_provider = text_to_speech(
        reply_text,
        stack=voice_stack,
        elevenlabs_voice_id=elevenlabs_voice_id,
    )
    tts_ms = (time.perf_counter() - t_tts) * 1000
    if not audio:
        reply_text = reply_text[:200]  # fallback: Twilio Say has character limit
        _persist_voice_providers(db, state, business_id, stt_provider, "twilio_say")
        twiml = f'<?xml version="1.0" encoding="UTF-8"?><Response><Say>{_escape_say(reply_text)}</Say><Redirect>{_base_url()}/api/voice/next</Redirect></Response>'
        return _twiml_response(twiml)

    token = generate_audio_token()
    store_audio_token(token, audio)
    _persist_voice_providers(db, state, business_id, stt_provider, tts_provider)
    base = _base_url()
    play_url = f"{base}/api/voice/audio/{token}"
    next_url = f"{base}/api/voice/next"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Play>{play_url}</Play>
  <Redirect>{next_url}</Redirect>
</Response>"""
    total_ms = (time.perf_counter() - t0) * 1000
    logger.info(
        "voice_recording call_sid=%s fetch_ms=%.0f transcribe_ms=%.0f llm_ms=%.0f tts_ms=%.0f total_ms=%.0f "
        "voice_intent=%s manage_kind=%s manage_outcome=%s customer_route=%s stt=%s tts=%s stack=%s",
        call_sid[:8],
        fetch_ms,
        transcribe_ms,
        llm_ms,
        tts_ms,
        total_ms,
        voice_intent,
        state.get("manage_kind"),
        manage_outcome,
        state.get("customer_route"),
        stt_provider,
        tts_provider,
        voice_stack,
    )
    return _twiml_response(twiml)


def _escape_say(s: str) -> str:
    """Escape for Twilio Say (basic XML)."""
    return (
        s.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
        .replace("'", "&apos;")
    )


@router.get("/audio/{token}")
def voice_audio(token: str):
    """Serve cached TTS audio for Twilio <Play>."""
    audio = get_audio_by_token(token)
    if not audio:
        return Response(status_code=404)
    return Response(content=audio, media_type="audio/mpeg")


@router.get("/next")
@router.post("/next")
async def voice_next(request: Request):
    """
    After playing the AI reply, Twilio hits this. We either start another Record (next turn) or Hangup.
    """
    # Twilio sends GET with query params when we use Redirect
    if request.method == "GET":
        call_sid = request.query_params.get("CallSid", "")
    else:
        form = await request.form()
        call_sid = form.get("CallSid", "")

    state = get_call_state(call_sid)
    if not state:
        return _twiml_response(
            '<?xml version="1.0" encoding="UTF-8"?><Response><Hangup/></Response>'
        )

    turn_count = state.get("turn_count", 0)
    if turn_count >= MAX_TURNS:
        twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Say>Thank you for calling. Goodbye.</Say><Hangup/></Response>'
        return _twiml_response(twiml)

    base = _base_url()
    action_url = f"{base}/api/voice/recording"
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Pause length="1"/>
  <Record action="{action_url}" maxLength="15" playBeep="false" timeout="5" />
</Response>"""
    return _twiml_response(twiml)
