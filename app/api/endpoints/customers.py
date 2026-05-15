"""Business-scoped customers: list, CRUD, CSV import."""
from typing import List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.dependencies import get_business_membership, get_business_or_404
from app.db.session import get_db
from app.models.business import Business
from app.models.customer import Customer as CustomerModel
from app.models.user import User
from app.schemas.customer import (
    CustomerCreate,
    CustomerImportResult,
    CustomerResponse,
    CustomerUpdate,
)
from app.services.customer_service import parse_customer_csv, upsert_customers_bulk

router = APIRouter()


@router.get("/{business_id}/customers", response_model=List[CustomerResponse])
def list_customers(
    business_id: int,
    skip: int = 0,
    limit: int = 200,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    rows = (
        db.query(CustomerModel)
        .filter(CustomerModel.business_id == business_id)
        .order_by(CustomerModel.last_name.asc(), CustomerModel.first_name.asc())
        .offset(skip)
        .limit(min(limit, 500))
        .all()
    )
    return rows


@router.post("/{business_id}/customers", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(
    business_id: int,
    payload: CustomerCreate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    c = CustomerModel(
        business_id=business_id,
        first_name=payload.first_name.strip(),
        last_name=payload.last_name.strip(),
        email=(payload.email or "").strip() or None,
        phone=(payload.phone or "").strip()[:20] or None,
        date_of_birth=payload.date_of_birth,
        address=payload.address,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/{business_id}/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(
    business_id: int,
    customer_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    c = (
        db.query(CustomerModel)
        .filter(CustomerModel.id == customer_id, CustomerModel.business_id == business_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return c


@router.put("/{business_id}/customers/{customer_id}", response_model=CustomerResponse)
def update_customer(
    business_id: int,
    customer_id: int,
    payload: CustomerUpdate,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    c = (
        db.query(CustomerModel)
        .filter(CustomerModel.id == customer_id, CustomerModel.business_id == business_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    data = payload.model_dump(exclude_unset=True)
    for k, v in data.items():
        if k == "phone" and v is not None:
            v = str(v).strip()[:20] or None
        if k == "email" and v is not None:
            v = str(v).strip() or None
        setattr(c, k, v)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.delete("/{business_id}/customers/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(
    business_id: int,
    customer_id: int,
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    c = (
        db.query(CustomerModel)
        .filter(CustomerModel.id == customer_id, CustomerModel.business_id == business_id)
        .first()
    )
    if not c:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    db.delete(c)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{business_id}/customers/import", response_model=CustomerImportResult)
async def import_customers_csv(
    business_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    business: Business = Depends(get_business_or_404),
    _: User = Depends(get_business_membership),
):
    """
    Upload a UTF-8 CSV with headers such as:
    `first_name`, `last_name`, `phone` (required; 10+ digits), optional `email`, `date_of_birth` (YYYY-MM-DD).
    Or use `name` / `full_name` instead of first/last. Rows match existing customers by phone (last 10 digits) and update.
    """
    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    rows, row_errors = parse_customer_csv(raw)
    if not rows and row_errors:
        return CustomerImportResult(created=0, updated=0, row_errors=row_errors)
    if not rows:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No valid rows. Check phone and name columns.",
        )
    created, updated = upsert_customers_bulk(db, business_id, rows)
    return CustomerImportResult(created=created, updated=updated, row_errors=row_errors)
