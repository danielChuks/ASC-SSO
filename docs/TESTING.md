# How to Test Lantra

This guide explains how to test the U2SSO flow (ZK registration + Gauth login) and DAO voting, including the admin create-proposal and finalize features.

---

## Prerequisites

1. **Contracts** — Deploy CommitmentRegistry and DAOVoting; see [contracts/README.md](../contracts/README.md).
   - **Local:** `npm run deploy:local` (requires `npx hardhat node`). Add addresses to `backend/.env`.
   - **Sepolia:** `npm run deploy:dao:sepolia` (requires `contracts/.env` with `SEPOLIA_DEPLOYER_PRIVATE_KEY` = 0x + 64 hex chars, `DAO_VOTE_RELAYER_ADDRESS`, `SEPOLIA_RPC_URL`). See [contracts/README.md](../contracts/README.md#deploy-to-sepolia).

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

6. **Frontend env** — Create `.env.local` with `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS`, and `NEXT_PUBLIC_DAO_CHAIN_ID` (`31337` for local Hardhat, `11155111` for Sepolia).

7. **Base URL** — Backend: `http://localhost:8000`, Frontend: `http://localhost:3000`

---

## Quick Checklist

### Local

| # | Service | Command | Port |
|---|---------|---------|------|
| 1 | Hardhat node | `cd contracts && npx hardhat node` | 8545 |
| 2 | Deploy contracts | `cd contracts && npm run deploy:local` | — |
| 3 | Backend | `cd backend && uvicorn app.main:app --reload --port 8000` | 8000 |
| 4 | Frontend | `cd frontend/master-wallet && npm run dev` | 3000 |

Set `NEXT_PUBLIC_DAO_CHAIN_ID=31337` for local.

### Sepolia

| # | Step | Command / Action |
|---|------|------------------|
| 1 | contracts/.env | `SEPOLIA_RPC_URL`, `SEPOLIA_DEPLOYER_PRIVATE_KEY` (0x+64 hex), `DAO_VOTE_RELAYER_ADDRESS` |
| 2 | Fund deployer | Get Sepolia ETH from faucet |
| 3 | Deploy | `cd contracts && npm run deploy:dao:sepolia` |
| 4 | backend/.env | Update with deploy output (addresses, RPC, keys) |
| 5 | frontend/.env.local | `NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS`, `NEXT_PUBLIC_DAO_CHAIN_ID=11155111` |

PostgreSQL must be running for both.

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
5. **Admin (owner only)** — Create proposals, finalize proposals via wallet-connected sidebar

---

## Method 1: End-to-End via Master Wallet (Recommended)

### Step 1: Create identity

1. Open `http://localhost:3000`
2. Click **Create Identity** — creates Semaphore identity, registers in backend
3. Message: "Login to Lantra to access DAO voting"
4. Click **Login to Lantra**

### Step 2: Register and login

5. On Login page, SP URL defaults to app origin (e.g. `http://localhost:3000`)
6. Click **Register with SP (first time)** — generates ZK proof, registers with Lantra
7. On success, you are redirected to the DAO page
8. For subsequent visits: click **Login (subsequent visits)** — Gauth signature, then redirect to DAO

**Note:** Anonymity set must have at least 2 commitments. Create another identity (e.g. in incognito) if needed.

### Step 3: DAO voting

9. On **DAO** page — view proposals, vote Yes/No/Abstain with ZK proof
10. **Wallet required for voting** — Connect MetaMask (or similar) and switch to the expected chain (31337 for local, 11155111 for Sepolia)
11. Click Yes/No/Abstain on an open proposal → confirm → vote is submitted via backend relayer

### Step 4: Admin — create proposal (owner only)

12. In the **Admin Panel** sidebar, click **Connect Wallet**
13. Connect the wallet that owns the DAOVoting contract (deployer account for local)
14. If `connected account === owner`, the **Create Proposal** form appears
15. Fill: Proposal ID, description, start time, end time (use datetime-local format)
16. Click **Create Proposal** — sign the transaction in your wallet

### Step 5: Admin — finalize proposal (owner only)

17. After the voting window has ended, the owner sees a **Finalize** button on each proposal
18. Click **Finalize** — sign the transaction in your wallet

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
# Get challenge (replace PSEUDONYM with hex Ed25519 public key, SP_ID with app origin)
curl "http://localhost:8000/api/v1/verify/auth/challenge?sp_id=http://localhost:3000&pseudonym=PSEUDONYM_HEX"

# Authenticate (replace with values from challenge + signature)
curl -X POST http://localhost:8000/api/v1/verify/auth \
  -H "Content-Type: application/json" \
  -d '{"sp_id":"http://localhost:3000","pseudonym":"...","challenge":"...","signature":"..."}'
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
| Already voted | Vote twice on same proposal | `400` — "Already voted on this proposal" |

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

## Environment Summary

### Backend (`.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `IDR_CONTRACT_ADDRESS` | Yes | CommitmentRegistry contract |
| `ETH_RPC_URL` | Yes | RPC URL (e.g. `http://127.0.0.1:8545` for local) |
| `IDR_DEPLOYER_KEY` | Yes | Private key for addCommitment |
| `DAO_VOTING_CONTRACT_ADDRESS` | For DAO | DAOVoting contract |
| `DAO_VOTE_RELAYER` | For DAO | Private key for vote relayer (castVote) |

### Frontend (`.env.local`)

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Yes | Backend URL (e.g. `http://localhost:8000`) |
| `NEXT_PUBLIC_APP_URL` | No | App origin (defaults to `window.location.origin`) |
| `NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS` | For DAO | Same as backend DAO address |
| `NEXT_PUBLIC_DAO_CHAIN_ID` | For DAO | `31337` for local Hardhat, `11155111` for Sepolia |

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Connection refused** | Ensure backend is running on port 8000 |
| **503 IdR not configured** | Deploy contracts, add env vars, keep `npx hardhat node` running |
| **Database connection failed** | Check `DATABASE_URL` and that PostgreSQL is running |
| **Invalid ZK proof** | Run `npm install` in `backend/semaphore-verifier` |
| **Anonymity set too small** | Create at least 2 identities (e.g. one in incognito) |
| **Leaf at index -1** | Your identity is not in the registry; create a new identity (Home → Create new identity) |
| **DAO redirects to login** | You must login first; DAO is gated behind authentication |
| **Wrong network** | Connect wallet and switch to chain 31337 (local) or 11155111 (Sepolia) |
| **Owner required** | Only the contract owner can create/finalize; connect the deployer wallet |
| **No contract at address** | Ensure `NEXT_PUBLIC_DAO_VOTING_CONTRACT_ADDRESS` matches the deployed contract and chain |
| **Private key too short** | `SEPOLIA_DEPLOYER_PRIVATE_KEY` must be 0x + 64 hex chars (private key). An address (40 chars) will not work. Export from MetaMask: Account details → Show private key |



