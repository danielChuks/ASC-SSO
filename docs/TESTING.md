# How to Test Lantra

This guide explains how to test the U2SSO flow (ZK registration + Gauth login) and DAO voting.

---

## Prerequisites

1. **Contracts** — Deploy CommitmentRegistry and DAOVoting; see [contracts/README.md](../contracts/README.md). Add `IDR_CONTRACT_ADDRESS`, `DAO_VOTING_CONTRACT_ADDRESS`, `DAO_VOTE_RELAYER`, `ETH_RPC_URL` to `backend/.env`. Keep `npx hardhat node` running.

2. **Backend**
   ```bash
   cd backend
   source venv/bin/activate   # or: source .venv/bin/activate
   pip install -r requirements.txt
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

3. **Semaphore verifier** (for ZK proof verification)
   ```bash
   cd backend/semaphore-verifier
   npm install
   ```

4. **Database** — PostgreSQL running, `DATABASE_URL` in `backend/.env`

5. **Frontend**
   ```bash
   cd frontend/master-wallet
   npm install
   npm run dev
   ```

6. **Base URL** — Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`

---

## Key Terms

| Term | Description |
|------|-------------|
| **Identity** | Semaphore identity (trapdoor, nullifier, commitment). Stored client-side. |
| **commitment** | Poseidon hash from Semaphore. Stored in registry; part of anonymity set. |
| **nullifier** | From ZK proof (scope = sp_id). Prevents Sybil attacks (one identity per SP). |
| **proof** | Semaphore ZK proof of membership in anonymity set. |
| **pseudonym (ϕ)** | Ed25519 public key from child credential. Per-SP identifier. |

---

## Test Flow Overview

1. **Create identity** — User creates Semaphore identity, registers commitments on-chain (IdR contract)
2. **Register with SP** — User fetches group from IdR, generates ZK proof, sends to `POST /verify/register`
3. **Login** — User gets challenge, signs with child credential, sends to `POST /verify/auth`
4. **DAO Voting** — User fetches proposals from `GET /dao/proposals`, generates vote proof, sends to `POST /dao/vote`

---

## Method 1: End-to-End via Master Wallet (Recommended)

1. Open `http://localhost:3000`
2. Click **Create Identity** — creates Semaphore identity, registers in backend
3. Click **Login to a Site**
4. Enter SP URL (e.g. `https://demo.example.com`)
5. Click **Register with SP (first time)** — generates ZK proof, registers
6. Click **Login (subsequent visits)** — Gauth signature, authenticates
7. Click **DAO Voting** (nav or Home) — view proposals, vote Yes/No/Abstain with ZK proof

**Expected:** Success messages at each step.

---

## Method 2: Manual API Testing

### Registry endpoints

```bash
# Register a commitment (e.g. from Semaphore Identity)
curl -X POST http://localhost:8000/api/v1/registry/register \
  -H "Content-Type: application/json" \
  -d '{"commitment": "1234567890123456789012345678901234567890123456789012345678901234"}'

# Get anonymity group (for ZK proof)
curl "http://localhost:8000/api/v1/registry/group"
```

### ZK registration (requires valid ZK proof from frontend)

The `POST /verify/register` endpoint expects a Semaphore ZK proof. Use the Master Wallet to generate and send it.

### Auth flow (after registration)

```bash
# Get challenge (replace PSEUDONYM with hex Ed25519 public key)
curl "http://localhost:8000/api/v1/verify/auth/challenge?sp_id=https://demo.example.com&pseudonym=PSEUDONYM_HEX"

# Authenticate (replace with values from challenge + signature)
curl -X POST http://localhost:8000/api/v1/verify/auth \
  -H "Content-Type: application/json" \
  -d '{"sp_id":"https://demo.example.com","pseudonym":"...","challenge":"...","signature":"..."}'
```

---

## Method 3: Swagger UI

Open **http://localhost:8000/docs** to explore endpoints:

- `POST /api/v1/registry/register` — Register commitment
- `GET /api/v1/registry/group` — Get anonymity set
- `POST /api/v1/verify/register` — ZK registration (needs proof from frontend)
- `GET /api/v1/verify/auth/challenge` — Get auth challenge
- `POST /api/v1/verify/auth` — Authenticate with signature
- `GET /api/v1/dao/proposals` — List proposals
- `POST /api/v1/dao/vote` — Cast vote (needs proof from frontend)

---

## Validation Tests (Error Cases)

| Test | How to trigger | Expected response |
|------|----------------|-------------------|
| Invalid ZK proof | Send malformed proof to `/verify/register` | `400` — "Invalid ZK proof" |
| Duplicate nullifier | Register twice with same SP | `400` — "Nullifier already used for this SP" |
| Unregistered pseudonym | Get challenge for unknown pseudonym | `400` — "Pseudonym not registered for this SP" |
| Invalid signature | Wrong signature in auth | `400` — "Invalid signature" |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registry/register` | Register a commitment |
| GET | `/api/v1/registry/check/{commitment}` | Check if commitment exists |
| GET | `/api/v1/registry/group` | Get anonymity set (Semaphore commitments) |
| POST | `/api/v1/verify/register` | ZK registration (one-time per SP) |
| GET | `/api/v1/verify/auth/challenge` | Get challenge for Gauth |
| POST | `/api/v1/verify/auth` | Authenticate (Ed25519 signature) |
| GET | `/api/v1/dao/proposals` | List DAO proposals |
| POST | `/api/v1/dao/vote` | Cast vote with ZK proof |

---

## Troubleshooting

- **Connection refused** — Ensure the server is running on port 8000
- **503 IdR not configured** — Deploy the contract, add env vars, keep `npx hardhat node` running
- **Database connection failed** — Check `DATABASE_URL` in `.env` and that PostgreSQL is running
- **Import errors** — Run from `backend/` directory and ensure venv is activated
- **Invalid ZK proof** — Ensure `backend/semaphore-verifier` has `npm install` run; `@semaphore-protocol/proof` must be installed
- **Leaf at index -1** — Your identity's commitment is not in the registry; create a new identity (Home → Create new identity)



