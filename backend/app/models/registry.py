"""Identity Registry models - stores master identity commitments and nullifiers."""
from datetime import datetime
import uuid

from sqlalchemy import Column, DateTime, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import declarative_base

Base = declarative_base()


class Commitment(Base):
    """Stores a commitment to a user's master identity."""

    __tablename__ = "commitments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    commitment = Column(String(256), unique=True, index=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class Nullifier(Base):
    """Stores used nullifiers per SP for Sybil resistance."""

    __tablename__ = "nullifiers"

    __table_args__ = (UniqueConstraint("sp_id", "nullifier", name="uq_nullifiers_sp_nullifier"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sp_id = Column(String(512), nullable=False, index=True)
    nullifier = Column(String(256), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class Nonce(Base):
    """Stores issued nonces for replay protection."""

    __tablename__ = "nonces"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nonce = Column(String(128), nullable=False, unique=True, index=True)
    sp_id = Column(String(512), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)  # 0 = unused, 1 = used
    created_at = Column(DateTime, default=datetime.utcnow)


class SpRegistration(Base):
    """Stores pseudonym registrations per SP (per U2SSO paper)."""

    __tablename__ = "sp_registrations"

    __table_args__ = (
        UniqueConstraint("sp_id", "nullifier", name="uq_sp_registrations_sp_nullifier"),
        UniqueConstraint("sp_id", "pseudonym", name="uq_sp_registrations_sp_pseudonym"),
    )

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sp_id = Column(String(512), nullable=False, index=True)
    pseudonym = Column(String(256), nullable=False, index=True)  # ϕ = public key (hex)
    nullifier = Column(String(256), nullable=False, index=True)
    commitment = Column(String(256), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AuthChallenge(Base):
    """Stores auth challenges for Gauth flow (replay protection)."""

    __tablename__ = "auth_challenges"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    sp_id = Column(String(512), nullable=False, index=True)
    challenge = Column(String(256), nullable=False, index=True)
    pseudonym = Column(String(256), nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class DaoVote(Base):
    """Stores DAO votes per proposal for nullifier uniqueness (one vote per identity per proposal)."""

    __tablename__ = "dao_votes"

    __table_args__ = (UniqueConstraint("proposal_id", "nullifier_hash", name="uq_dao_votes_proposal_nullifier"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    proposal_id = Column(Integer, nullable=False, index=True)
    nullifier_hash = Column(String(256), nullable=False, index=True)
    vote_choice = Column(Integer, nullable=False)  # 0=Yes, 1=No, 2=Abstain
    created_at = Column(DateTime, default=datetime.utcnow)
