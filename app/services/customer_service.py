"""
Customer records per business: phone normalization, lookup, voice linking, CSV import helpers.
"""
from __future__ import annotations

import csv
import io
import re
from datetime import date, datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy.orm import Session

from app.models.customer import Customer


def normalize_phone_digits(phone: Optional[str]) -> str:
    if not phone:
        return ""
    return re.sub(r"\D", "", phone)


def phones_loose_match(a: Optional[str], b: Optional[str]) -> bool:
    da = normalize_phone_digits(a)
    db = normalize_phone_digits(b)
    if not da or not db:
        return False
    if len(da) >= 10 and len(db) >= 10:
        return da[-10:] == db[-10:]
    return da == db


def find_customers_by_phone(db: Session, business_id: int, phone: Optional[str]) -> List[Customer]:
    if not phone or len(normalize_phone_digits(phone)) < 10:
        return []
    all_c = db.query(Customer).filter(Customer.business_id == business_id).all()
    return [c for c in all_c if c.phone and phones_loose_match(c.phone, phone)]


def find_customers_by_name_hint(db: Session, business_id: int, hint: str) -> List[Customer]:
    hint = (hint or "").strip().lower()
    if len(hint) < 2:
        return []
    parts = [p for p in hint.split() if len(p) > 1]
    all_c = db.query(Customer).filter(Customer.business_id == business_id).all()
    out: List[Customer] = []
    for c in all_c:
        fn = (c.first_name or "").lower()
        ln = (c.last_name or "").lower()
        full = f"{fn} {ln}".strip()
        if not full:
            continue
        if hint in full:
            out.append(c)
        elif len(parts) >= 2 and parts[0] in fn and parts[1] in ln:
            out.append(c)
        elif len(parts) == 1 and (parts[0] in fn or parts[0] in ln or full.startswith(parts[0])):
            out.append(c)
    seen: set[int] = set()
    uniq: List[Customer] = []
    for c in out:
        if c.id not in seen:
            seen.add(c.id)
            uniq.append(c)
    return uniq[:8]


def split_display_name(name: str) -> Tuple[str, str]:
    name = (name or "").strip()
    if not name:
        return "Unknown", "Caller"
    parts = name.split()
    if len(parts) == 1:
        return parts[0][:100], "Customer"
    return parts[0][:100], " ".join(parts[1:])[:100]


def find_or_create_customer_for_voice(
    db: Session,
    business_id: int,
    caller_phone: Optional[str],
    full_name: Optional[str],
) -> Optional[Customer]:
    """
    Link voice bookings to a Customer: match by caller phone when possible; otherwise create.
    """
    first, last = split_display_name(full_name or "")
    phone_stripped = (caller_phone or "").strip()[:20] if caller_phone else None
    if phone_stripped and len(normalize_phone_digits(phone_stripped)) >= 10:
        candidates = find_customers_by_phone(db, business_id, phone_stripped)
        if len(candidates) == 1:
            c = candidates[0]
            if (c.first_name == "Unknown" or not c.first_name) and first and first != "Unknown":
                c.first_name = first
                c.last_name = last
                db.add(c)
                db.commit()
                db.refresh(c)
            return c
        if len(candidates) > 1:
            hint = f"{first} {last}".strip().lower()
            for c in candidates:
                fn = f"{c.first_name} {c.last_name}".lower()
                if hint and (hint in fn or fn.startswith(first.lower())):
                    return c
            return candidates[0]

    c = Customer(
        business_id=business_id,
        first_name=first,
        last_name=last,
        phone=phone_stripped,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _norm_header(h: str) -> str:
    return (h or "").strip().lower().replace(" ", "_")


def _map_csv_field(header: Optional[str]) -> Optional[str]:
    key = _norm_header(header or "")
    aliases = {
        "first_name": "first_name",
        "firstname": "first_name",
        "first": "first_name",
        "last_name": "last_name",
        "lastname": "last_name",
        "last": "last_name",
        "name": "full_name",
        "full_name": "full_name",
        "phone": "phone",
        "mobile": "phone",
        "telephone": "phone",
        "cell": "phone",
        "email": "email",
        "e-mail": "email",
        "dob": "date_of_birth",
        "date_of_birth": "date_of_birth",
        "birthday": "date_of_birth",
    }
    return aliases.get(key)


def parse_customer_csv(
    raw: bytes,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, str]]]:
    """
    Parse CSV; returns (rows as dicts with first_name, last_name, phone, email, date_of_birth, errors).
    """
    text = raw.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        return [], [{"line": "0", "message": "CSV has no header row"}]

    rows_out: List[Dict[str, Any]] = []
    errors: List[Dict[str, str]] = []
    for i, row in enumerate(reader, start=2):
        mapped: Dict[str, Any] = {}
        for k, v in row.items():
            canon = _map_csv_field(k)
            if canon:
                mapped[canon] = (v or "").strip()
        fn = mapped.get("first_name", "")
        ln = mapped.get("last_name", "")
        full = mapped.get("full_name", "")
        if full and not (fn and ln):
            ff, ll = split_display_name(full)
            fn, ln = ff, ll
        phone = mapped.get("phone", "")
        if not phone and not fn and not ln:
            continue
        if not phone or len(normalize_phone_digits(phone)) < 10:
            errors.append({"line": str(i), "message": "phone required (10+ digits)"})
            continue
        if not fn or not ln:
            errors.append({"line": str(i), "message": "first and last name (or full name) required"})
            continue
        email = mapped.get("email") or None
        dob_raw = mapped.get("date_of_birth") or ""
        dob: Optional[date] = None
        if dob_raw:
            for fmt in ("%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y"):
                try:
                    dob = datetime.strptime(dob_raw, fmt).date()
                    break
                except ValueError:
                    continue
        rows_out.append(
            {
                "first_name": fn[:100],
                "last_name": ln[:100],
                "phone": phone[:20],
                "email": (email[:255] if email else None),
                "date_of_birth": dob,
            }
        )
    return rows_out, errors


def upsert_customers_bulk(
    db: Session,
    business_id: int,
    rows: List[Dict[str, Any]],
) -> Tuple[int, int]:
    """Returns (created, updated). Match existing by normalized phone (last 10 digits)."""
    created = updated = 0
    all_c = db.query(Customer).filter(Customer.business_id == business_id).all()
    by_digits: Dict[str, Customer] = {}
    for c in all_c:
        if c.phone:
            d = normalize_phone_digits(c.phone)
            if len(d) >= 10:
                key = d[-10:]
                by_digits[key] = c

    for row in rows:
        phone = row["phone"]
        d = normalize_phone_digits(phone)
        key = d[-10:] if len(d) >= 10 else ""
        existing = by_digits.get(key) if key else None
        if existing:
            existing.first_name = row["first_name"]
            existing.last_name = row["last_name"]
            if row.get("email"):
                existing.email = row["email"]
            if row.get("date_of_birth"):
                existing.date_of_birth = row["date_of_birth"]
            existing.updated_at = datetime.utcnow()
            db.add(existing)
            updated += 1
        else:
            c = Customer(
                business_id=business_id,
                first_name=row["first_name"],
                last_name=row["last_name"],
                phone=phone,
                email=row.get("email"),
                date_of_birth=row.get("date_of_birth"),
            )
            db.add(c)
            db.flush()
            if key:
                by_digits[key] = c
            created += 1
    db.commit()
    return created, updated
