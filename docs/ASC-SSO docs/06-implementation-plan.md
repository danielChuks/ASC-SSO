# Implementation Plan

---

## 1. What Already Exists (ASC-SSO-main) -->> **keep updating**

The following components are fully implemented and require no modification for the core cryptographic flow:

**Smart Contract** (`contracts/contracts/CommitmentRegistry.sol`):
- `addCommitment(commitment, isSemaphore)` — voter registration
- `getSemaphoreCommitments()` — returns full anonymity set
- `hasCommitment(commitment)` — membership check
- `revoke(index)` — soft revocation (sets `isSemaphore=false`)

**Backend** (`backend/`):
- FastAPI app with PostgreSQL
- `POST /api/v1/registry/register` — adds commitment to IdR
- `GET /api/v1/registry/group` — reads anonymity set from chain
- `POST /api/v1/verify/register` — verifies ZK proof + nullifier, stores registration
- `GET /api/v1/verify/auth/challenge` + `POST /api/v1/verify/auth` — Gauth flow
- `backend/semaphore-verifier/verify.js` — Node.js Semaphore proof verifier

**Frontend cryptographic primitives** (`frontend/shared/crypto/`):
- `semaphoreZK.ts` — `generateSemaphoreProof()` wrapping `@semaphore-protocol/proof`
- `hkdf.ts` — `hkdfExtractExpand()` using WebCrypto API
- `nullifier.ts` — `deriveNullifier()` using HKDF
- `gauth.ts` — Ed25519 sign and verify
- `childCredential.ts` — `deriveChildSecret()` = `HKDF(r, sp_id)`
- `commitment.ts` — Semaphore identity creation

**Frontend wallet** (`frontend/master-wallet/`):
- Next.js app with identity creation + registration page
- Login page using Gauth

---

## 2. What we Built during the Hackaton Documentation 

### Phase 1: Minimal Viable Voting (Hackathon MVP)

**1.1 — Backend: Proposal Registry**

---

## 3. MVP Scope for Hackathon


