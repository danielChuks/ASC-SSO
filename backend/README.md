# Lantra Backend

FastAPI backend for U2SSO credential verification, OIDC/SIOP auth, and DAO voting.

## Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Optional: copy env template
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API docs:** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

## Endpoints

| Path | Description |
|------|-------------|
| `GET /` | Root |
| `GET /health` | Health check |
| `GET /ready` | Readiness check |
| `POST /api/v1/registry/register` | Register a commitment |
| `GET /api/v1/registry/check/{commitment}` | Check if commitment exists |
| `GET /api/v1/registry/group` | Get anonymity set for ZK proofs |
| `POST /api/v1/verify/register` | ZK registration (one-time per SP) |
| `GET /api/v1/verify/auth/challenge` | Get challenge for Gauth |
| `POST /api/v1/verify/auth` | Authenticate (Ed25519) |
| `GET /api/v1/dao/proposals` | List DAO proposals from contract |
| `POST /api/v1/dao/vote` | Cast vote with ZK proof |
| `GET /api/v1/auth/config` | OIDC/SIOP config (placeholder) |

## Semaphore Verifier

ZK proof verification runs via Node.js. Before first use:

```bash
cd semaphore-verifier
npm install
```

## Database

Uses PostgreSQL. Set `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/shieldlogin
```

Create the database before first run:

```sql
CREATE DATABASE shieldlogin;
```

## On-chain IdR (Required)

Commitments are stored on-chain via a Solidity contract (PostgreSQL is not used for commitments). See `contracts/README.md` for deployment. Add to `.env`:

```
IDR_CONTRACT_ADDRESS=0x...
ETH_RPC_URL=http://127.0.0.1:8545
IDR_DEPLOYER_KEY=0x...   # Required for registering commitments
```

Without these, registry endpoints return 503.

## DAO Voting (Optional)

When configured, DAO voting endpoints are enabled. Add to `.env`:

```
DAO_VOTING_CONTRACT_ADDRESS=0x...
DAO_VOTE_RELAYER_ADDRESS=0x...   # Address configured as voteRelayer in contract
DAO_VOTE_RELAYER=0x...           # Private key for vote relayer (castVote)
```

Requires `ETH_RPC_URL`. For Sepolia, use a Sepolia RPC URL. The `dao_votes` table stores nullifiers for one-vote-per-identity-per-proposal.
