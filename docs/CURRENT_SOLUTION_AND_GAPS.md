# ShieldLogin: Current Solution and Gaps

This document compares ShieldLogin's implementation against the ASC/U2SSO problem statement. See [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) for the full requirements.

---

## What ShieldLogin Has

### 1. Master Identity

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Self-generated identity | Semaphore `Identity` (Poseidon commitment) | ✅ |
| Stored in registry | `commitments` table (PostgreSQL) | ✅ |
| Master secret stays on device | Identity in `localStorage` only | ✅ |
| `r` for child derivation | Generated at identity creation | ✅ |

### 2. Identity Registry

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Immutable storage of identities | PostgreSQL `commitments` table | ✅ |
| No credential issuing | Backend only stores/verifies | ✅ |
| Check commitment exists | `GET /registry/check/{commitment}` | ✅ |

### 3. Nullifier

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Unique per (user, verifier) | Semaphore nullifier hash (scope = sp_id) | ✅ |
| Sybil resistance | Backend rejects if nullifier already used for SP | ✅ |
| Stored per SP | `sp_registrations` table | ✅ |

### 4. Proof (Registration)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Proves knowledge of master secret | Semaphore ZK proof (membership in anonymity set) | ✅ |
| Bound to scope | sp_id as external nullifier; one proof per SP | ✅ |
| Verifier checks proof | Node.js subprocess verifies ZK proof | ✅ |

### 5. Pseudonym (ϕ)

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| Pseudonym per SP | `ϕ = Ed25519 public key` from `cskl` | ✅ |
| Stored at registration | `sp_registrations.pseudonym` | ✅ |

### 6. Child Credential & Gauth

| Requirement | Implementation | Status |
|-------------|----------------|--------|
| `cskl = HKDF(r, sp_id)` | `deriveChildSecret(r, sp_id)` | ✅ |
| Gauth (Ed25519) for auth | `signWithSeed(cskl, challenge)` | ✅ |
| Auth without ASC proof | `POST /verify/auth` | ✅ |

### 7. Registration vs Authentication

| Step | Implementation | Status |
|------|----------------|--------|
| **Registration** (one-time) | `POST /verify/register` — ZK proof + nullifier + pseudonym | ✅ |
| **Authentication** (repeated) | `GET /auth/challenge` + `POST /verify/auth` — Gauth signature | ✅ |

---

## Remaining Gaps

### Gap 1: Anonymity Set — ✅ Resolved (ZK mode)

| Requirement | ShieldLogin | Status |
|-------------|-------------|--------|
| Anonymity set `[ID1,...,IDN]` | Semaphore group from registry | ✅ |
| Proof hides identity within set | ZK proof proves membership | ✅ |

---

### Gap 2: ZK Proof — ✅ Resolved

| Requirement | ShieldLogin | Status |
|-------------|-------------|--------|
| ZK proof (ASC) | Semaphore ZK proof | ✅ |
| Verifier checks proof | Node.js subprocess verifies | ✅ |

---

### Gap 3: No Revocation/Update

| Requirement | ShieldLogin | Gap |
|-------------|-------------|-----|
| Revoke pseudonym | No | ❌ |
| Update pseudonym | No | ❌ |

**Impact:** User cannot revoke or change a registered identity at an SP.

---

## Summary Table

| Aspect | Status | Notes |
|--------|--------|-------|
| Master identity | ✅ | Semaphore ZK |
| Identity registry | ✅ | PostgreSQL |
| Nullifier | ✅ | HKDF, per SP |
| Sybil resistance | ✅ | Nullifier reuse rejected |
| Proof | ✅ | Semaphore ZK |
| Pseudonym | ✅ | Ed25519 public key |
| Child credential | ✅ | HKDF(r, sp_id) |
| Registration vs auth | ✅ | Separate flows |
| Gauth | ✅ | Ed25519 |
| Anonymity set | ✅ | Semaphore group |
| ZK proof | ✅ | Semaphore |
| Revocation/update | ❌ | Missing |

---

## API Endpoints (U2SSO Flow)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/verify/register` | Register with SP (one-time) |
| GET | `/api/v1/verify/auth/challenge` | Get challenge for auth |
| POST | `/api/v1/verify/auth` | Authenticate (Gauth) |
| POST | `/api/v1/verify/credential` | Legacy single-flow (backward compat) |

---

## References

- [PROBLEM_STATEMENT.md](PROBLEM_STATEMENT.md) — Full requirements
- [SHIELDLOGIN_OVERVIEW.md](SHIELDLOGIN_OVERVIEW.md) — Current system overview
- [FRONTEND_ROADMAP.md](FRONTEND_ROADMAP.md) — Frontend phases
