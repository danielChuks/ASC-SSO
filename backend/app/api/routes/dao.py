"""DAO voting endpoints."""
import json
import threading

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, field_validator
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from web3.exceptions import ContractLogicError

from app.config import Settings
from app.core.semaphore import verify_semaphore_proof
from app.database import get_db
from app.models.registry import DaoVote
from app.services.dao_contract import DaoVotingContract

router = APIRouter()

# Serialize cast_vote calls to avoid nonce collision when concurrent votes use same relayer
_cast_vote_lock = threading.Lock()


class ProposalResponse(BaseModel):
    """Proposal data for frontend."""

    id: int
    description: str
    start_time: int
    end_time: int
    finalized: bool
    yes_votes: int
    no_votes: int
    abstain_votes: int
    voting_open: bool


@router.get("/proposals", response_model=list[ProposalResponse])
def list_proposals():
    """List all proposals from the DAOVoting contract."""
    s = Settings.load()
    if not s.dao_voting_contract_address or not s.eth_rpc_url:
        raise HTTPException(status_code=503, detail="DAO voting not configured")
    try:
        client = DaoVotingContract(
            rpc_url=s.eth_rpc_url,
            contract_address=s.dao_voting_contract_address,
            relayer_private_key=None,
        )
        proposal_ids = client.get_proposal_ids()
    except (ValueError, Exception) as e:
        raise HTTPException(status_code=503, detail=f"Cannot connect to DAO contract: {e}")
    result = []
    for pid in proposal_ids:
        try:
            desc, _, start, end, finalized, yes_v, no_v, abstain_v = client.get_proposal(pid)
            is_open = client.is_voting_open(pid)
            result.append(
                ProposalResponse(
                    id=pid,
                    description=desc,
                    start_time=start,
                    end_time=end,
                    finalized=finalized,
                    yes_votes=yes_v,
                    no_votes=no_v,
                    abstain_votes=abstain_v,
                    voting_open=is_open,
                )
            )
        except ContractLogicError:
            continue
        except Exception:
            # Skip proposal on RPC/connection errors (e.g. mid-loop timeout)
            continue
    return result


class DaoVoteRequest(BaseModel):
    """Request body for DAO vote."""

    proposal_id: int
    vote_choice: int  # 0=Yes, 1=No, 2=Abstain
    proof: str  # JSON string of ZK proof
    nullifier_hash: str
    merkle_tree_root: str

    @field_validator("proposal_id")
    @classmethod
    def proposal_id_non_negative(cls, v: int) -> int:
        if v < 0:
            raise ValueError("proposal_id must be non-negative")
        return v

    @field_validator("proof", "nullifier_hash", "merkle_tree_root")
    @classmethod
    def non_empty_string(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Cannot be empty")
        return v


class DaoVoteResponse(BaseModel):
    """Response for DAO vote."""

    success: bool
    message: str
    tx_hash: str | None = None


@router.post("/vote", response_model=DaoVoteResponse)
def cast_dao_vote(body: DaoVoteRequest, db: Session = Depends(get_db)):
    """
    Cast a DAO vote with Semaphore ZK proof.
    Verifies proof (scope=proposalId, message=voteChoice), checks nullifier uniqueness,
    then relays vote to on-chain DAOVoting contract.
    """
    s = Settings.load()
    if not s.dao_voting_contract_address or not s.eth_rpc_url or not s.dao_vote_relayer:
        raise HTTPException(status_code=503, detail="DAO voting not configured")

    if body.vote_choice not in (0, 1, 2):
        raise HTTPException(status_code=400, detail="Invalid vote choice (0=Yes, 1=No, 2=Abstain)")

    # 1. Ensure proof is bound to this proposal and vote choice (scope/message in proof must match)
    try:
        proof_obj = json.loads(body.proof)
        # Semaphore may use scope/message or externalNullifier; handle both
        proof_scope = str(proof_obj.get("scope", proof_obj.get("externalNullifier", "")))
        proof_message = str(proof_obj.get("message", ""))
        if proof_scope != str(body.proposal_id) or proof_message != str(body.vote_choice):
            raise HTTPException(
                status_code=400,
                detail="Proof scope/message must match proposal_id and vote_choice",
            )
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid proof format")

    # 2. Verify ZK proof (scope=proposalId, message=voteChoice)
    scope = str(body.proposal_id)
    message = str(body.vote_choice)
    try:
        verified = verify_semaphore_proof(
            body.proof,
            body.nullifier_hash,
            body.merkle_tree_root,
            scope=scope,
            message=message,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"Proof verifier unavailable: {e}")
    if not verified:
        raise HTTPException(status_code=400, detail="Invalid ZK proof")

    # 3. Check nullifier not already used for this proposal
    existing = (
        db.query(DaoVote)
        .filter(
            DaoVote.proposal_id == body.proposal_id,
            DaoVote.nullifier_hash == body.nullifier_hash,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Already voted on this proposal")

    # 4. Reserve nullifier (store first) to prevent race-condition double voting
    vote_record = DaoVote(
        proposal_id=body.proposal_id,
        nullifier_hash=body.nullifier_hash,
        vote_choice=body.vote_choice,
    )
    db.add(vote_record)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Already voted on this proposal")

    # 5. Check proposal exists and voting is open (on-chain)
    try:
        client = DaoVotingContract(
            rpc_url=s.eth_rpc_url,
            contract_address=s.dao_voting_contract_address,
            relayer_private_key=s.dao_vote_relayer,
        )
    except ValueError as e:
        db.delete(vote_record)
        db.commit()
        raise HTTPException(status_code=503, detail=str(e))

    try:
        is_open = client.is_voting_open(body.proposal_id)
    except ContractLogicError:
        db.delete(vote_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Proposal not found")

    if not is_open:
        db.delete(vote_record)
        db.commit()
        raise HTTPException(status_code=400, detail="Voting is not open for this proposal")

    # 6. Submit vote on-chain (serialized to avoid nonce collision)
    try:
        with _cast_vote_lock:
            tx_hash = client.cast_vote(
                body.proposal_id,
                body.vote_choice,
                body.nullifier_hash,
                b"",
            )
    except (RuntimeError, ValueError, Exception) as e:
        db.delete(vote_record)
        db.commit()
        raise HTTPException(status_code=502, detail=f"On-chain vote failed: {e}")

    return DaoVoteResponse(success=True, message="Vote cast successfully", tx_hash=tx_hash)
