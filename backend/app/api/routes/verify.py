"""Credential verification endpoints for Service Providers."""
from datetime import datetime, timedelta
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.crypto import verify_proof, generate_nonce
from app.database import get_db
from app.models.registry import Commitment, Nullifier, Nonce

router = APIRouter()

NONCE_TTL_MINUTES = 5


class VerifyRequest(BaseModel):
    """Request body for credential verification."""

    sp_id: str
    nonce: str
    proof: str
    nullifier: str
    commitment: str


class VerifyResponse(BaseModel):
    """Response for credential verification."""

    verified: bool
    message: str


@router.get("/nonce")
def get_nonce(sp_id: str, db: Session = Depends(get_db)):
    """Get a fresh nonce for SP to use in auth flow. Nonce expires in 5 minutes."""
    nonce = generate_nonce()
    expires_at = datetime.utcnow() + timedelta(minutes=NONCE_TTL_MINUTES)
    record = Nonce(nonce=nonce, sp_id=sp_id, expires_at=expires_at)
    db.add(record)
    db.commit()
    return {"nonce": nonce, "sp_id": sp_id, "expires_in": NONCE_TTL_MINUTES * 60}


@router.post("/credential", response_model=VerifyResponse)
def verify_credential(body: VerifyRequest, db: Session = Depends(get_db)):
    """
    Verify a child credential from a Service Provider.
    Checks: commitment in registry, proof format, nullifier not used, nonce valid.
    """
    # 1. Check commitment exists in registry
    commitment_record = db.query(Commitment).filter(Commitment.commitment == body.commitment).first()
    if not commitment_record:
        raise HTTPException(status_code=400, detail="Commitment not found in registry")

    # 2. Verify proof format (hash-based PoC: we cannot verify without msk)
    if not verify_proof(body.commitment, body.proof, body.sp_id, body.nonce):
        raise HTTPException(status_code=400, detail="Invalid proof format")

    # 3. Check nullifier not already used for this SP (Sybil resistance)
    existing_nullifier = (
        db.query(Nullifier)
        .filter(Nullifier.sp_id == body.sp_id, Nullifier.nullifier == body.nullifier)
        .first()
    )
    if existing_nullifier:
        raise HTTPException(status_code=400, detail="Nullifier already used for this SP")

    # 4. Check nonce valid (issued, not expired, not used)
    nonce_record = db.query(Nonce).filter(Nonce.nonce == body.nonce, Nonce.sp_id == body.sp_id).first()
    if not nonce_record:
        raise HTTPException(status_code=400, detail="Invalid or unknown nonce")
    expires_at = cast(datetime | None, nonce_record.expires_at)
    now = datetime.utcnow()
    if expires_at is not None and expires_at < now:
        raise HTTPException(status_code=400, detail="Nonce expired")
    if getattr(nonce_record, "used", 0) != 0:
        raise HTTPException(status_code=400, detail="Nonce already used (replay attack)")

    # 5. Store nullifier and mark nonce used
    nullifier_record = Nullifier(sp_id=body.sp_id, nullifier=body.nullifier)
    db.add(nullifier_record)
    setattr(nonce_record, "used", 1)
    db.commit()

    return VerifyResponse(verified=True, message="Credential verified successfully")
