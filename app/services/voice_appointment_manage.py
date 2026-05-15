"""
Voice-only flows: resolve upcoming appointments (by caller phone or name), cancel, reschedule.
Keyword-driven state machine; works with keys stored in voice call state (Redis/memory).
"""
from __future__ import annotations

import re
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.appointment import Appointment
from app.models.business import Business
from app.models.customer import Customer
from app.services.availability_service import get_calendar_conflicts
from app.services.customer_service import (
    find_customers_by_phone,
    find_customers_by_name_hint,
    normalize_phone_digits,
    phones_loose_match,
)
from app.services.slot_filling import extract_slots_from_message, slots_to_start_end, _slot_value


def upcoming_appointments_by_booking_phone(
    db: Session, business_id: int, phone: Optional[str], limit: int = 25
) -> List[Appointment]:
    """
    Future voice appointments where `booking_phone` matches the caller (e.g. legacy rows
    before customer_id was linked, or edge cases).
    """
    if not phone or len(normalize_phone_digits(phone)) < 10:
        return []
    now = datetime.utcnow()
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.business_id == business_id,
            Appointment.start_time > now,
            Appointment.status.in_(["scheduled", "confirmed"]),
            Appointment.source == "voice",
            Appointment.booking_phone.isnot(None),
        )
        .order_by(Appointment.start_time.asc())
        .limit(80)
        .all()
    )
    matched = [a for a in rows if phones_loose_match(a.booking_phone, phone)]
    return matched[:limit]


def maybe_link_appointments_to_customer(
    db: Session,
    business_id: int,
    phone: Optional[str],
    appointments: List[Appointment],
) -> None:
    """If caller matches exactly one Customer, attach customer_id to unlinked voice rows."""
    if not phone or not appointments:
        return
    custs = find_customers_by_phone(db, business_id, phone)
    if len(custs) != 1:
        return
    cid = custs[0].id
    changed = False
    for apt in appointments:
        if apt.customer_id is None and apt.source == "voice":
            apt.customer_id = cid
            apt.updated_at = datetime.utcnow()
            db.add(apt)
            changed = True
    if changed:
        db.commit()
        for apt in appointments:
            if apt.customer_id == cid:
                db.refresh(apt)


def upcoming_appointments_for_customer(
    db: Session, business_id: int, customer_id: int, limit: int = 15
) -> List[Appointment]:
    now = datetime.utcnow()
    return (
        db.query(Appointment)
        .filter(
            Appointment.business_id == business_id,
            Appointment.customer_id == customer_id,
            Appointment.start_time > now,
            Appointment.status.in_(["scheduled", "confirmed"]),
        )
        .order_by(Appointment.start_time.asc())
        .limit(limit)
        .all()
    )


def _dedupe_appointments(rows: List[Appointment]) -> List[Appointment]:
    seen: set[int] = set()
    out: List[Appointment] = []
    for a in sorted(rows, key=lambda x: x.start_time):
        if a.id not in seen:
            seen.add(a.id)
            out.append(a)
    return out


def upcoming_for_phone_or_name(
    db: Session,
    business_id: int,
    phone: Optional[str],
    name_hint: Optional[str] = None,
) -> Tuple[List[Appointment], str]:
    """Returns (appointments, resolution_tag). Uses Customer rows first; falls back to booking_phone on voice rows."""
    apts: List[Appointment] = []
    tag = "none"
    if phone:
        custs = find_customers_by_phone(db, business_id, phone)
        if len(custs) == 1:
            apts = upcoming_appointments_for_customer(db, business_id, custs[0].id)
            tag = "phone_single"
        elif len(custs) > 1:
            seen: set[int] = set()
            merged: List[Appointment] = []
            for c in custs:
                for apt in upcoming_appointments_for_customer(db, business_id, c.id, limit=10):
                    if apt.id not in seen:
                        seen.add(apt.id)
                        merged.append(apt)
            merged.sort(key=lambda x: x.start_time)
            apts = merged[:15]
            tag = "phone_multi"
        else:
            apts = []
        # Always merge voice rows matched by stored caller phone (legacy customer_id null, or duplicate path)
        by_bp = upcoming_appointments_by_booking_phone(db, business_id, phone)
        if by_bp:
            if not apts:
                tag = "booking_phone_fallback"
            apts = _dedupe_appointments(apts + by_bp)[:25]
        maybe_link_appointments_to_customer(db, business_id, phone, apts)
    if not apts and name_hint:
        custs = find_customers_by_name_hint(db, business_id, name_hint)
        if len(custs) == 1:
            apts = upcoming_appointments_for_customer(db, business_id, custs[0].id)
            return apts, "name_single"
        if len(custs) > 1:
            return [], "name_ambiguous"
    return apts, tag


def format_apt_speech(apt: Appointment, idx: int) -> str:
    st = apt.start_time
    if isinstance(st, datetime):
        ds = st.strftime("%B %d at %I:%M %p")
        ds = ds.replace(" 0", " ")  # "09" -> "9" for hour in some locales
    else:
        ds = str(st)
    return f"Number {idx + 1}: {ds}."


def parse_appointment_pick(user_text: str, appointments: List[Appointment]) -> Optional[int]:
    msg = (user_text or "").strip().lower()
    if not msg or not appointments:
        return None
    if "first" in msg or msg.strip() in ("one", "1", "the first"):
        return appointments[0].id
    if ("second" in msg or msg.strip() in ("two", "2")) and len(appointments) >= 2:
        return appointments[1].id
    if ("third" in msg or msg.strip() in ("three", "3")) and len(appointments) >= 3:
        return appointments[2].id
    m = re.search(r"\b([1-9])\b", msg)
    if m:
        n = int(m.group(1))
        if 1 <= n <= len(appointments):
            return appointments[n - 1].id
    for apt in appointments:
        st = apt.start_time
        if not isinstance(st, datetime):
            continue
        mon = st.strftime("%B").lower()
        day = str(st.day)
        ymd = st.strftime("%Y-%m-%d")
        if ymd in msg or (mon in msg and day in msg):
            return apt.id
    return None


def wants_yes(msg: str) -> bool:
    m = (msg or "").strip().lower()
    return any(
        x in m
        for x in (
            "yes",
            "yeah",
            "yep",
            "confirm",
            "please do",
            "go ahead",
            "that's right",
            "thats right",
            "correct",
            "sure",
        )
    )


def wants_no(msg: str) -> bool:
    m = (msg or "").strip().lower()
    if "cancel my appointment" in m or "cancel the appointment" in m:
        return False
    return any(x in m for x in ("no", "nope", "don't cancel", "do not cancel", "keep it", "never mind"))


def get_missing_reschedule_slots(slots: Dict[str, Any]) -> List[str]:
    return [k for k in ("date", "time") if not _slot_value(slots.get(k))]


def cancel_appointment_db(db: Session, apt: Appointment) -> None:
    apt.status = "cancelled"
    apt.updated_at = datetime.utcnow()
    db.add(apt)
    db.commit()
    db.refresh(apt)


def reschedule_appointment_db(
    db: Session,
    apt: Appointment,
    business: Business,
    new_start: datetime,
    new_end: datetime,
) -> bool:
    conflicts = get_calendar_conflicts(
        db,
        apt.business_id,
        new_start,
        new_end,
        exclude_appointment_id=apt.id,
    )
    if conflicts:
        return False
    apt.start_time = new_start
    apt.end_time = new_end
    apt.updated_at = datetime.utcnow()
    db.add(apt)
    db.commit()
    db.refresh(apt)
    return True


def load_appointments_by_ids(db: Session, business_id: int, ids: List[int]) -> List[Appointment]:
    if not ids:
        return []
    rows = (
        db.query(Appointment)
        .filter(Appointment.business_id == business_id, Appointment.id.in_(ids))
        .all()
    )
    by_id = {a.id: a for a in rows}
    return [by_id[i] for i in ids if i in by_id]


def handle_voice_manage(
    db: Session,
    business: Business,
    business_id: int,
    phone: Optional[str],
    user_text: str,
    state: Dict[str, Any],
) -> Tuple[Optional[str], str, Dict[str, Any], str]:
    """
    Process cancel/reschedule turn. Returns (reply, intent, state_patch, outcome_tag).
    """
    kind = state.get("manage_kind")
    if kind not in ("cancel", "reschedule"):
        return None, "other", {}, "noop"

    step = state.get("manage_step") or "resolve"
    patch: Dict[str, Any] = {}
    intent = "cancel_appointment" if kind == "cancel" else "reschedule_appointment"

    def _clear_manage() -> None:
        patch["manage_kind"] = None
        patch["manage_step"] = None
        patch["manage_appointment_ids"] = []
        patch["manage_selected_appointment_id"] = None
        patch["manage_slots"] = {}
        patch["manage_name_tried"] = None

    apt_ids: List[int] = list(state.get("manage_appointment_ids") or [])
    selected_id = state.get("manage_selected_appointment_id")
    slots = dict(state.get("manage_slots") or {})

    # --- confirm cancel ---
    if step == "confirm_cancel" and selected_id:
        if wants_yes(user_text):
            apt = db.query(Appointment).filter(Appointment.id == selected_id, Appointment.business_id == business_id).first()
            if apt and apt.status != "cancelled":
                cancel_appointment_db(db, apt)
            _clear_manage()
            return "Your appointment is cancelled. Anything else?", "cancel_appointment", patch, "cancelled"
        if wants_no(user_text):
            _clear_manage()
            return "Okay, I did not cancel anything. How else can I help?", intent, patch, "aborted"
        return "Please say yes to cancel, or no to keep your appointment.", intent, patch, "confirm_again"

    # --- collect new time (reschedule) ---
    if step == "collect_new_time" and selected_id:
        apt = db.query(Appointment).filter(Appointment.id == selected_id, Appointment.business_id == business_id).first()
        if not apt:
            _clear_manage()
            return "I lost track of that appointment. Let's start again.", "other", patch, "error"
        missing = get_missing_reschedule_slots(slots)
        slots = extract_slots_from_message(user_text, slots, missing)
        patch["manage_slots"] = slots
        missing = get_missing_reschedule_slots(slots)
        if missing:
            need = missing[0]
            if need == "date":
                return "What new date works for you?", intent, patch, "need_date"
            return "What time on that day works?", intent, patch, "need_time"
        pair = slots_to_start_end(slots, business)
        if not pair:
            patch["manage_slots"] = {}
            return "I didn't get that date or time. Please say them again.", intent, patch, "bad_slot"
        new_start, _ignored_end = pair
        duration = apt.end_time - apt.start_time if apt.end_time and apt.start_time else timedelta(minutes=30)
        new_end = new_start + duration
        ok = reschedule_appointment_db(db, apt, business, new_start, new_end)
        if not ok:
            return "That time is not available. Please suggest another date or time.", intent, patch, "conflict"
        _clear_manage()
        return (
            "You're set. I've moved your appointment. Anything else?",
            "reschedule_appointment",
            patch,
            "rescheduled",
        )

    # --- pick ---
    if step == "pick" and apt_ids:
        apts = load_appointments_by_ids(db, business_id, apt_ids)
        apts.sort(key=lambda x: x.start_time)
        pick_id = parse_appointment_pick(user_text, apts)
        if not pick_id:
            lines = [format_apt_speech(a, i) for i, a in enumerate(apts)]
            return (
                "Say the list number, or describe the date. " + " ".join(lines),
                intent,
                patch,
                "pick_again",
            )
        patch["manage_selected_appointment_id"] = pick_id
        apt = db.query(Appointment).filter(Appointment.id == pick_id).first()
        if not apt:
            _clear_manage()
            return "I couldn't load that appointment.", "other", patch, "error"
        if kind == "cancel":
            patch["manage_step"] = "confirm_cancel"
            line = format_apt_speech(apt, 0).replace("Number 1: ", "")
            return (
                f"I have {line} Say yes to cancel, or no to keep it.",
                intent,
                patch,
                "await_confirm",
            )
        patch["manage_step"] = "collect_new_time"
        patch["manage_slots"] = {}
        return "What new date and time would you like?", intent, patch, "collect_reschedule"

    # --- need name ---
    if step == "need_name":
        apts, tag = upcoming_for_phone_or_name(db, business_id, None, name_hint=user_text)
        if tag == "name_ambiguous":
            return "I found more than one profile. Please call from the number on file or say your full name.", intent, patch, "ambiguous"
        if not apts:
            _clear_manage()
            return "I still don't see an upcoming appointment. You can book a new visit or ask for a person.", intent, patch, "not_found"
        ids = [a.id for a in apts]
        patch["manage_appointment_ids"] = ids
        if len(apts) == 1:
            patch["manage_selected_appointment_id"] = apts[0].id
            apt = apts[0]
            if kind == "cancel":
                patch["manage_step"] = "confirm_cancel"
                line = format_apt_speech(apt, 0).replace("Number 1: ", "")
                return (
                    f"I have {line} Say yes to cancel, or no to keep it.",
                    intent,
                    patch,
                    "await_confirm",
                )
            patch["manage_step"] = "collect_new_time"
            patch["manage_slots"] = {}
            return "What new date and time would you like?", intent, patch, "collect_reschedule"
        patch["manage_step"] = "pick"
        lines = [format_apt_speech(a, i) for i, a in enumerate(apts)]
        return (
            "Which appointment? " + " ".join(lines) + " Say the number.",
            intent,
            patch,
            "pick_list",
        )

    # --- resolve ---
    if step == "resolve":
        apts, tag = upcoming_for_phone_or_name(db, business_id, phone, None)
        if not apts:
            patch["manage_step"] = "need_name"
            patch["manage_name_tried"] = True
            return (
                "I don't see an upcoming appointment for this phone. Please say your first and last name.",
                intent,
                patch,
                "need_name",
            )
        ids = [a.id for a in apts]
        patch["manage_appointment_ids"] = ids
        if len(apts) == 1:
            patch["manage_selected_appointment_id"] = apts[0].id
            apt = apts[0]
            if kind == "cancel":
                patch["manage_step"] = "confirm_cancel"
                line = format_apt_speech(apt, 0).replace("Number 1: ", "")
                return (
                    f"I have {line} Say yes to cancel, or no to keep it.",
                    intent,
                    patch,
                    "await_confirm",
                )
            patch["manage_step"] = "collect_new_time"
            patch["manage_slots"] = {}
            return "What new date and time would you like?", intent, patch, "collect_reschedule"
        patch["manage_step"] = "pick"
        lines = [format_apt_speech(a, i) for i, a in enumerate(apts)]
        return (
            "You have more than one upcoming visit. " + " ".join(lines) + " Which one?",
            intent,
            patch,
            "pick_list",
        )

    return "Let's try again. Say cancel or reschedule.", intent, patch, "fallback"
