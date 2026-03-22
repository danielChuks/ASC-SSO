"""Credential verification endpoints for Service Providers."""
import secrets
from datetime import datetime, timedelta
from typing import cast

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.config import Settings
from app.core.crypto import verify_proof, generate_nonce  # verify_proof for legacy /credential
from app.database import get_db
from app.models.registry import (
    AuthChallenge,
    Nonce,
    Nullifier,
    SpRegistration,
)
from app.services.idr_contract import IdRContract

router = APIRouter()


def _commitment_exists(commitment: str) -> bool:
    """Check if commitment exists in IdR (on-chain contract only)."""
    s = Settings.load()
    if not s.use_idr_contract:
        return False
    try:
        client = IdRContract(
            rpc_url=s.eth_rpc_url,
            contract_address=s.idr_contract_address,
        )
        return client.has_commitment(commitment)
    except Exception:
        return False

NONCE_TTL_MINUTES = 5
CHALLENGE_TTL_MINUTES = 5


class VerifyRequest(BaseModel):
    """Request body for credential verification (legacy / single-flow)."""

    sp_id: str
    nonce: str
    proof: str
    nullifier: str
    commitment: str


class RegisterZKRequest(BaseModel):
    """Request body for U2SSO registration with ZK proof (Semaphore)."""

    sp_id: str
    pseudonym: str
    nullifier_hash: str  # From Semaphore proof (Sybil resistance)
    proof: str  # JSON string of ZK proof
    merkle_tree_root: str


class AuthChallengeRequest(BaseModel):
    """Request for auth challenge."""

    sp_id: str
    pseudonym: str


class AuthRequest(BaseModel):
    """Request body for U2SSO authentication (Gauth)."""

    sp_id: str
    pseudonym: str
    challenge: str
    signature: str  # hex-encoded Ed25519 signature


class VerifyResponse(BaseModel):
    """Response for credential verification."""

    verified: bool
    message: str


@router.get("/nonce")
def get_nonce(sp_id: str, db: Session = Depends(get_db)):
    """Get a fresh nonce for registration flow. Nonce expires in 5 minutes."""
    nonce = generate_nonce()
    expires_at = datetime.utcnow() + timedelta(minutes=NONCE_TTL_MINUTES)
    record = Nonce(nonce=nonce, sp_id=sp_id, expires_at=expires_at)
    db.add(record)
    db.commit()
    return {"nonce": nonce, "sp_id": sp_id, "expires_in": NONCE_TTL_MINUTES * 60}


# def _verify_semaphore_proof(proof_json: str, nullifier_hash: str, merkle_root: str, sp_id: str) -> bool:
#     """Verify Semaphore ZK proof via Node.js subprocess."""
#     import json
#     import subprocess
#     from pathlib import Path

#     verifier_dir = Path(__file__).resolve().parent.parent.parent.parent / "semaphore-verifier"
#     verify_js = verifier_dir / "verify.js"
#     if not verify_js.exists():
#         raise RuntimeError("Semaphore verifier not found. Run: cd backend/semaphore-verifier && npm install")
#     import shutil
#     NODE_PATH = shutil.which("node") or "node"  
#     payload = json.dumps({
#         "proof": json.loads(proof_json),
#         "nullifierHash": nullifier_hash,
#         "merkleTreeRoot": merkle_root,
#         "scope": sp_id,
#         "message": "0",
#     })
#     try:
#         result = subprocess.run(
#             [NODE_PATH, str(verify_js)],
#             input=payload,
#             capture_output=True,
#             text=True,
#             cwd=str(verifier_dir),
#             timeout=30,
#         )
#         if result.returncode != 0:
#             return False
#         out = json.loads(result.stdout)
#         return out.get("verified", False)
#     except Exception:
#         return False

def _verify_semaphore_proof(proof_json: str, nullifier_hash: str, merkle_root: str, sp_id: str) -> bool:
    import json
    import os
    import subprocess
    import tempfile
    from pathlib import Path

    from app.core.semaphore import _get_node_binary

    verifier_dir = Path(__file__).resolve().parent.parent.parent.parent / "semaphore-verifier"
    verify_js = verifier_dir / "verify.js"
    
    if not verify_js.exists():
        print("verify.js not found!")
        return False

    try:
        proof_obj = json.loads(proof_json) if isinstance(proof_json, str) else proof_json
    except Exception as e:
        print(f"Failed to parse proof JSON: {e}")
        return False

    payload = json.dumps({
        "proof": proof_obj,
        "nullifierHash": nullifier_hash,
        "merkleTreeRoot": merkle_root,
        "scope": sp_id,
        "message": "0",
    })
    
    node_bin = _get_node_binary()

    fd, tmp_path = tempfile.mkstemp(suffix=".json", text=True)
    with os.fdopen(fd, 'w') as f:
        f.write(payload)
        
    try:
        result = subprocess.run(
            [node_bin, str(verify_js), tmp_path],
            capture_output=True,
            text=True,
            cwd=str(verifier_dir),
            timeout=30,
        )
        
        if result.returncode != 0:
            print(f"Node crashed! Error: {result.stderr}")
            return False
            
        out = json.loads(result.stdout)
        return out.get("verified", False)
        
    except Exception as e:
        print(f"Python failed to run Node subprocess: {e}")
        return False
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.post("/register", response_model=VerifyResponse)
@router.post("/register-zk", response_model=VerifyResponse)
def register(body: RegisterZKRequest, db: Session = Depends(get_db)):
    """
    U2SSO registration with ZK proof (Semaphore). No nonce needed.
    """
    # 1. Verify ZK proof
    if not _verify_semaphore_proof(
        body.proof, body.nullifier_hash, body.merkle_tree_root, body.sp_id
    ):
        raise HTTPException(status_code=400, detail="Invalid ZK proof")

    # 2. Check nullifier not already used (Sybil resistance)
    existing = (
        db.query(SpRegistration)
        .filter(SpRegistration.sp_id == body.sp_id, SpRegistration.nullifier == body.nullifier_hash)
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Nullifier already used for this SP")

    # 3. Check pseudonym not already registered
    existing_pseudo = (
        db.query(SpRegistration)
        .filter(SpRegistration.sp_id == body.sp_id, SpRegistration.pseudonym == body.pseudonym)
        .first()
    )
    if existing_pseudo:
        raise HTTPException(status_code=400, detail="Pseudonym already registered for this SP")

    # 4. Store registration (commitment not needed for ZK - proof proves membership)
    reg = SpRegistration(
        sp_id=body.sp_id,
        pseudonym=body.pseudonym,
        nullifier=body.nullifier_hash,
        commitment="zk",  # Placeholder - ZK doesn't reveal commitment
    )
    db.add(reg)
    db.commit()

    return VerifyResponse(verified=True, message="Registration successful (ZK)")


@router.get("/auth/challenge")
def get_auth_challenge(sp_id: str, pseudonym: str, db: Session = Depends(get_db)):
    """Get a challenge for Gauth authentication."""
    # Check pseudonym is registered
    reg = (
        db.query(SpRegistration)
        .filter(SpRegistration.sp_id == sp_id, SpRegistration.pseudonym == pseudonym)
        .first()
    )
    if not reg:
        raise HTTPException(status_code=400, detail="Pseudonym not registered for this SP")

    challenge = secrets.token_hex(32)
    expires_at = datetime.utcnow() + timedelta(minutes=CHALLENGE_TTL_MINUTES)
    record = AuthChallenge(
        sp_id=sp_id,
        pseudonym=pseudonym,
        challenge=challenge,
        expires_at=expires_at,
    )
    db.add(record)
    db.commit()
    return {"challenge": challenge, "sp_id": sp_id, "expires_in": CHALLENGE_TTL_MINUTES * 60}


@router.post("/auth", response_model=VerifyResponse)
def authenticate(body: AuthRequest, db: Session = Depends(get_db)):
    """
    U2SSO authentication: Gauth (Ed25519 signature over challenge).
    No ASC proof — uses child credential only.
    """
    # 1. Check pseudonym is registered
    reg = (
        db.query(SpRegistration)
        .filter(SpRegistration.sp_id == body.sp_id, SpRegistration.pseudonym == body.pseudonym)
        .first()
    )
    if not reg:
        raise HTTPException(status_code=400, detail="Pseudonym not registered for this SP")

    # 2. Check challenge valid
    chal_record = (
        db.query(AuthChallenge)
        .filter(
            AuthChallenge.sp_id == body.sp_id,
            AuthChallenge.pseudonym == body.pseudonym,
            AuthChallenge.challenge == body.challenge,
        )
        .first()
    )
    if not chal_record:
        raise HTTPException(status_code=400, detail="Invalid or unknown challenge")
    expires_at = cast(datetime | None, chal_record.expires_at)
    if expires_at and expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Challenge expired")
    if getattr(chal_record, "used", 0) != 0:
        raise HTTPException(status_code=400, detail="Challenge already used")

    # 3. Verify Ed25519 signature (detached: message + signature)
    try:
        from nacl.signing import VerifyKey

        pk_bytes = bytes.fromhex(body.pseudonym)
        sig_bytes = bytes.fromhex(body.signature)
        msg_bytes = bytes.fromhex(body.challenge)
        vk = VerifyKey(pk_bytes)
        vk.verify(msg_bytes, signature=sig_bytes)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid signature")

    # 4. Mark challenge used
    setattr(chal_record, "used", 1)
    db.commit()

    return VerifyResponse(verified=True, message="Authentication successful")


@router.post("/credential", response_model=VerifyResponse)
def verify_credential(body: VerifyRequest, db: Session = Depends(get_db)):
    """
    Legacy: single-flow credential verification (registration + auth combined).
    Kept for backward compatibility.
    """
    from app.models.registry import Nullifier

    # 1. Check commitment exists in registry (on-chain IdR only)
    if not _commitment_exists(body.commitment):
        raise HTTPException(status_code=400, detail="Commitment not found in registry")

    # 2. Verify proof format
    if not verify_proof(body.commitment, body.proof, body.sp_id, body.nonce):
        raise HTTPException(status_code=400, detail="Invalid proof format")

    # 3. Check nullifier not already used
    existing_nullifier = (
        db.query(Nullifier)
        .filter(Nullifier.sp_id == body.sp_id, Nullifier.nullifier == body.nullifier)
        .first()
    )
    if existing_nullifier:
        raise HTTPException(status_code=400, detail="Nullifier already used for this SP")

    # 4. Check nonce valid
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