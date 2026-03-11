"""Identity Registry endpoints - register and check commitments. Uses on-chain IdR only."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import Settings
from app.services.idr_contract import IdRContract, is_hmac_commitment

router = APIRouter()
settings = Settings.load()


class RegisterRequest(BaseModel):
    """Request body for registering a commitment."""

    commitment: str


def _get_idr_client() -> IdRContract:
    """Return IdR contract client. Raises if not configured."""
    if not settings.use_idr_contract:
        raise HTTPException(
            status_code=503,
            detail="IdR contract not configured. Set IDR_CONTRACT_ADDRESS and ETH_RPC_URL in .env",
        )
    try:
        return IdRContract(
            rpc_url=settings.eth_rpc_url,
            contract_address=settings.idr_contract_address,
            deployer_private_key=settings.idr_deployer_key or None,
        )
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Cannot connect to IdR: {e}") from e


@router.post("/register")
def register_commitment(body: RegisterRequest):
    """Register a new master identity commitment. Uses on-chain IdR only."""
    commitment = body.commitment
    is_semaphore = not is_hmac_commitment(commitment)

    client = _get_idr_client()
    if client.has_commitment(commitment):
        raise HTTPException(status_code=400, detail="Commitment already registered")
    try:
        idx = client.add_commitment(commitment, is_semaphore)
        return {"id": str(idx), "commitment": commitment, "status": "registered", "source": "contract"}
    except ValueError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Contract error: {e}")


@router.get("/check/{commitment}")
def check_commitment(commitment: str):
    """Check if a commitment exists in the registry."""
    client = _get_idr_client()
    return {"exists": client.has_commitment(commitment)}


@router.get("/group")
def get_anonymity_group():
    """Get commitments for anonymity set (Merkle tree) for ZK proofs."""
    client = _get_idr_client()
    commitments = client.get_semaphore_commitments()
    return {"commitments": commitments, "count": len(commitments)}
