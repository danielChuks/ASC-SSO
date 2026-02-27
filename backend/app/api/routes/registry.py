"""Identity Registry endpoints - register and check commitments."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.registry import Commitment

router = APIRouter()


class RegisterRequest(BaseModel):
    """Request body for registering a commitment."""

    commitment: str


@router.post("/register")
def register_commitment(body: RegisterRequest, db: Session = Depends(get_db)):
    """Register a new master identity commitment."""
    commitment = body.commitment
    existing = db.query(Commitment).filter(Commitment.commitment == commitment).first()
    if existing:
        raise HTTPException(status_code=400, detail="Commitment already registered")
    record = Commitment(commitment=commitment)
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "commitment": record.commitment, "status": "registered"}


@router.get("/check/{commitment}")
def check_commitment(commitment: str, db: Session = Depends(get_db)):
    """Check if a commitment exists in the registry."""
    record = db.query(Commitment).filter(Commitment.commitment == commitment).first()
    return {"exists": record is not None}
