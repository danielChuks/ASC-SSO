"""Hash-based ASC primitives for PoC (simplified, not cryptographically unlinkable)."""
import hashlib
import hmac
import secrets
from typing import Optional


def _hkdf_extract_expand(key_material: bytes, salt: bytes, info: bytes, length: int = 32) -> bytes:
    """Simple HKDF-like derivation using SHA256."""
    prk = hmac.new(salt, key_material, hashlib.sha256).digest()
    okm = b""
    prev = b""
    for i in range((length + 31) // 32):
        prev = hmac.new(prk, prev + info + bytes([i + 1]), hashlib.sha256).digest()
        okm += prev
    return okm[:length]


def commitment_from_secret(msk: str) -> str:
    """Compute commitment (public identity) from master secret. C = SHA256(msk)."""
    return hashlib.sha256(msk.encode()).hexdigest()


def derive_nullifier(msk: str, sp_id: str) -> str:
    """Derive nullifier for (msk, sp_id). One per SP for Sybil resistance."""
    salt = b"shieldlogin-nullifier-v1"
    info = sp_id.encode()
    out = _hkdf_extract_expand(msk.encode(), salt, info)
    return out.hex()


def create_proof(msk: str, sp_id: str, nonce: str) -> str:
    """Create proof (HMAC) over (nonce, sp_id) using derived child key."""
    child_key = _hkdf_extract_expand(
        msk.encode(),
        b"shieldlogin-proof-v1",
        sp_id.encode(),
    )
    message = f"{nonce}:{sp_id}".encode()
    proof = hmac.new(child_key, message, hashlib.sha256).digest()
    return proof.hex()


def verify_proof(
    commitment: str,
    proof: str,
    sp_id: str,
    nonce: str,
    msk_for_verify: Optional[str] = None,
) -> bool:
    """
    Verify proof. In hash-based PoC the commitment is one-way (SHA256), so we cannot
    cryptographically verify the proof without msk. For backend PoC we check:
    - Format: 64 hex chars (SHA256 output)
    - If msk_for_verify provided (e.g. tests): verify HMAC matches
    Real ASC uses ZK proofs; backend trusts valid flow when commitment exists + nullifier fresh.
    """
    if msk_for_verify:
        expected = create_proof(msk_for_verify, sp_id, nonce)
        return hmac.compare_digest(proof, expected)
    if len(proof) != 64 or not all(c in "0123456789abcdef" for c in proof.lower()):
        return False
    return True


def generate_nonce() -> str:
    """Generate a random nonce for challenge."""
    return secrets.token_hex(32)
