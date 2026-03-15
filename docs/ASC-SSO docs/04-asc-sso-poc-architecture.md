# ASC-SSO PoC Architecture: Anonymous DAO Governance & Voting

---

## 1. Purpose and Scope  -- **REVIEW**

ASC-SSO-main is a hackathon-grade proof of concept that demonstrates:

1. A voter can prove eligibility to vote without revealing their on-chain identity
2. Double-voting is prevented at the cryptographic level via nullifiers
3. The vote tally is publicly verifiable while individual vote attribution is hidden
4. The system requires no trusted identity provider — credentials are self-generated

The PoC builds on top of the existing ASC-SSO-main codebase (FastAPI backend, Next.js frontend, CommitmentRegistry contract) and proposes a DAO voting extension layer.

---

## 2. Actors  -- **REVIEW**

**Voter (User)**: A DAO token holder who wants to cast a vote. Holds a Semaphore identity (secret + commitment) and a bootstrap seed `r`. All secrets live in browser `localStorage`. No server ever sees the secret.

**DAO / Proposal Creator**: Creates proposals with a unique `proposal_id`. Defines the eligibility snapshot (which anonymity set of commitments constitutes eligible voters). In the PoC, this is the backend admin or a hardcoded configuration.

**Backend (Verifier)**: Verifies ZK proofs and manages the nullifier registry. Enforces one-vote-per-member per proposal. Stores vote choices associated with nullifiers (not with voter identities). Implemented as FastAPI + PostgreSQL.

**Identity Registry (IdR)**: The on-chain `CommitmentRegistry.sol`. Stores voter commitments (Semaphore Poseidon hashes). Serves as the source of truth for the anonymity set. Read by the backend and frontend to build the Merkle group for proof generation.

**Smart Contract (DAO voting — proposed)**: `DAOVoting.sol` — stores proposals, accepts votes, maintains nullifier registry on-chain. In the hackathon PoC, this role is partly played by the backend PostgreSQL; the smart contract is proposed as the production upgrade path.

---

## 3. Components

```
┌───────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js / TypeScript)                                    │
│                                                                       │
│  frontend/master-wallet/        ← Identity management UI             │
│    src/app/page.tsx             ← Create identity / register          │
│    src/app/login/page.tsx       ← Login / vote submission             │
│    src/lib/api.ts               ← API client                          │
│                                                                       │
│  frontend/shared/crypto/        ← ZK + key derivation primitives     │
│    semaphoreZK.ts               ← generateSemaphoreProof()           │
│    hkdf.ts                      ← hkdfExtractExpand()                │
│    nullifier.ts                 ← deriveNullifier()                  │
│    childCredential.ts           ← deriveChildSecret()                │
│    gauth.ts                     ← Ed25519 sign/verify                │
│    commitment.ts                ← Semaphore identity commitment       │
└───────────────────────────────────────────────────────────────────────┘
                    │  HTTPS REST API calls
                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  BACKEND  (FastAPI + PostgreSQL)                                      │
│                                                                       │
│  backend/app/api/routes/                                              │
│    registry.py     GET /registry/group         ← anonymity set       │
│                    POST /registry/register     ← add commitment       │
│    verify.py       POST /verify/register       ← ZK registration     │
│                    GET  /verify/auth/challenge  ← Gauth challenge     │
│                    POST /verify/auth            ← Gauth verify        │
│  [proposed]        POST /dao/vote               ← cast vote           │
│  [proposed]        GET  /dao/proposals          ← list proposals      │
│  [proposed]        GET  /dao/tally/{id}         ← vote tally          │
│                                                                       │
│  backend/semaphore-verifier/verify.js  ← Node.js ZK proof verifier   │
│                                                                       │
│  PostgreSQL tables:                                                   │
│    commitments       ← voter identity commitments                    │
│    sp_registrations  ← (pseudonym, nullifier) per SP/proposal        │
│    auth_challenges   ← one-time Gauth challenges                     │
│  [proposed]                                                           │
│    proposals         ← (proposal_id, description, eligibility_set)  │
│    votes             ← (nullifier, proposal_id, vote_choice)         │
└───────────────────────────────────────────────────────────────────────┘
                    │  Web3 calls (web3.py)
                    ▼
┌───────────────────────────────────────────────────────────────────────┐
│  BLOCKCHAIN  (Ethereum / Local Hardhat)                               │
│                                                                       │
│  contracts/contracts/CommitmentRegistry.sol                           │
│    addCommitment(commitment, isSemaphore)                            │
│    getSemaphoreCommitments() → uint256[]    ← anonymity set          │
│    hasCommitment(commitment) → bool                                  │
│    revoke(index)                                                      │
│                                                                       │
│  [proposed] contracts/contracts/DAOVoting.sol                         │
│    createProposal(id, description, snapshot_root)                    │
│    castVote(proposal_id, vote_choice, nullifier, proof)              │
│    tallyVotes(proposal_id) → (yes, no, abstain)                      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 4. Eligibility Flow (Identity Registration)

This is a one-time operation. It corresponds to U2SSO master identity registration.

```
VOTER (browser)                    BACKEND              BLOCKCHAIN

1. Generate Semaphore identity
   secret = random scalar
   commitment = Poseidon(BabyJub_pubkey(secret))
   Store (secret, r) in localStorage

2. POST /registry/register
   { commitment, isSemaphore: true }
                                  3. Call addCommitment()
                                     on CommitmentRegistry.sol
                                                           4. Commitment stored
                                                              in contract array
                                  5. Return { index }

6. Store commitment index locally
```

**What happens**: The voter's cryptographic commitment is recorded on-chain. This is their "master identity" in the anonymity set. The secret never leaves the browser.

---

## 5. Anonymous Voting Flow

This happens once per proposal. It corresponds to U2SSO pseudonym registration with an SP, where `sp_id = proposal_id`.

```
VOTER (browser)                    BACKEND              BLOCKCHAIN

1. GET /registry/group
                                  2. Call getSemaphoreCommitments()
                                                           3. Returns all commitments
                                  4. Return commitment array

5. Build Semaphore Group (Merkle tree)
   from commitment array

6. Generate ZK proof:
   generateSemaphoreProof(
     identity,        ← private
     group,           ← public (Merkle tree of all commitments)
     message="0",     ← public (vote content — see note)
     scope=proposal_id,← public (determines nullifier)
     treeDepth=20
   )
   → { proof, nullifierHash, merkleTreeRoot }

7. Derive child credential:
   csk_proposal = HKDF(r, proposal_id)
   vote_pubkey  = Ed25519_pubkey(csk_proposal)
   (used as pseudonym ϕ in the DAO context)

8. POST /dao/vote (proposed) or POST /verify/register:
   {
     proposal_id,
     vote_choice: "yes" | "no" | "abstain",
     nullifier_hash,
     proof,
     merkle_tree_root,
     pseudonym: vote_pubkey
   }
                                  9. Verify ZK proof via Node.js:
                                     scope=proposal_id matches
                                     merkleTreeRoot is valid
                                     proof is valid

                                  10. Check nullifier not used
                                      for this proposal_id

                                  11. Store:
                                      (proposal_id, nullifier_hash,
                                       vote_choice, pseudonym)

12. Vote confirmed ✓
```

**Note on vote encoding**: In the current PoC, the `message` field in the Semaphore proof is set to `"0"` (a dummy value) and the actual vote choice is sent alongside the proof. This means the vote choice is not cryptographically bound to the proof. The production upgrade is to encode `vote_choice` in the `message` field so the vote cannot be altered in transit.

---

## 6. Nullifier Flow

The nullifier is the mechanism that prevents double voting. It is the most critical component.

**Derivation** (inside Semaphore circuit, private computation):
```
nullifier = Poseidon([scope, secret])
          = Poseidon([proposal_id, voter_secret])
```

**Properties**:
- `proposal_id` is the "scope" in Semaphore terminology, equivalent to the "verifier identifier" `v_l` in the paper
- Same voter, same proposal → always same nullifier → second vote is rejected
- Same voter, different proposal → different nullifier → votes across proposals are unlinkable
- Different voters, same proposal → different nullifiers → all coexist in the registry
- The nullifier is public in the proof output — the backend checks it without knowing who generated it

**Storage**: The backend `sp_registrations` table (or proposed `votes` table) stores `(proposal_id, nullifier_hash)`. On vote submission, it checks whether `(proposal_id, nullifier_hash)` already exists. If yes → reject. If no → store and accept.

---

## 7. Authentication Flow (Post-Registration)

After a voter has registered (submitted their ZK proof), they can perform lightweight authenticated operations (e.g., updating a vote before the deadline, or accessing proposal-specific content) using only their child credential — no ZK proof needed.

```
VOTER (browser)                    BACKEND

1. GET /verify/auth/challenge?sp_id=proposal_id&pseudonym=vote_pubkey
                                  2. Generate random 32-byte challenge
                                     Store with 5-min TTL
                                  3. Return { challenge }

4. csk = HKDF(r, proposal_id)
5. sig = Ed25519.sign(csk, challenge)
6. POST /verify/auth:
   { proposal_id, pseudonym, challenge, signature }
                                  7. Verify Ed25519 signature
                                     against stored pseudonym
                                  8. Authenticated ✓
```

---

## 8. Storage and State Assumptions

| Data | Where stored | Who can read | Notes |
|---|---|---|---|
| Voter secret (`secret`, `r`) | Browser localStorage | Voter only | Never sent to server |
| Voter commitment | On-chain contract | Public | This is the "master identity" |
| ZK proof | Sent once, not stored | Backend verifies then discards | Proof itself reveals nothing |
| Nullifier hash | Backend PostgreSQL | Backend admin | Public in principle — auditable |
| Vote choice | Backend PostgreSQL | Backend admin | Associated with nullifier, not identity |
| Pseudonym (vote_pubkey) | Backend PostgreSQL | Backend admin | Ed25519 public key — not linked to wallet |
| Proposals | Backend PostgreSQL | Public (via API) | Proposal metadata |

**Important assumption**: In this PoC, the backend is trusted not to publish the `(nullifier, vote_choice)` mapping in a way that allows de-anonymization. In production, this moves on-chain where the vote tally is computed by the smart contract.

---

## 9. End-to-End Architecture: What Is Implemented vs Proposed

| Component | Status | Source |
|---|---|---|
| Semaphore identity creation | ✅ Implemented | `frontend/shared/crypto/commitment.ts` |
| CommitmentRegistry.sol | ✅ Implemented | `contracts/contracts/CommitmentRegistry.sol` |
| ZK proof generation (browser) | ✅ Implemented | `frontend/shared/crypto/semaphoreZK.ts` |
| ZK proof verification (backend) | ✅ Implemented | `backend/semaphore-verifier/verify.js` |
| Nullifier uniqueness check | ✅ Implemented | `backend/app/api/routes/verify.py` |
| HKDF child credential | ✅ Implemented | `frontend/shared/crypto/hkdf.ts` |
| Ed25519 Gauth | ✅ Implemented | `frontend/shared/crypto/gauth.ts` |
| Vote choice storage | 🔧 Requires adaptation | Adapt `sp_registrations` table |
| Proposal registry | 🔧 Requires addition | New `proposals` table + API routes |
| DAO vote tally | 🔧 Requires addition | New `/dao/tally/{id}` endpoint |
| Vote choice bound to proof | ❌ Not yet (PoC shortcut) | Encode vote in Semaphore `message` |
| On-chain vote verification | ❌ Not yet | Solidity Groth16 verifier needed |
| DAOVoting.sol | ❌ Proposed | New contract |
