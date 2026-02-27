# ShieldLogin: Comprehensive Overview

A complete reference for what we have built, including all terms and abbreviations.

---

## Abbreviations & Full Meanings

| Abbreviation | Full Form | Meaning |
|--------------|-----------|---------|
| **ASC** | Anonymous Self-Credentials | Cryptographic notion enabling users to prove identity without revealing it; from the IC3 research paper |
| **U2SSO** | User-issued Unlinkable Single Sign-On | Login system where users issue their own credentials; activity across sites cannot be linked |
| **SP** | Service Provider | A website or app that users log into (e.g. a store, social platform) |
| **IdP** | Identity Provider | Central service that issues identities (e.g. Google, Apple); we avoid trusting one |
| **IdR** | Identity Registry | Backend that stores commitments; does not store secrets or track users |
| **msk** | Master Secret Key | User's root secret; never leaves their device; used to derive commitment, nullifier, proof |
| **HKDF** | Hash-based Key Derivation Function | Algorithm to derive keys from a secret + salt; produces unlinkable outputs |
| **HMAC** | Hash-based Message Authentication Code | Algorithm to create a proof/signature over a message using a key |
| **SHA256** | Secure Hash Algorithm 256-bit | One-way hash function; used for commitment |
| **ZK** | Zero-Knowledge (proof) | Proof that reveals only "true/false" without revealing the secret |
| **ZKP** | Zero-Knowledge Proof | Cryptographic proof of knowledge without disclosure |
| **BLS** | Boneh–Lynn–Shacham | Signature scheme used for production-grade unlinkability (future) |
| **PoC** | Proof of Concept | Working demo; not production-hardened |
| **OIDC** | OpenID Connect | Standard protocol for authentication |
| **SIOP** | Self-Issued OpenID Provider | OIDC variant where users issue their own credentials |
| **API** | Application Programming Interface | Endpoints the backend exposes for clients to call |
| **TTL** | Time To Live | How long something is valid (e.g. nonce expires after 5 minutes) |

---

## What We Have Built

### 1. Backend (FastAPI + PostgreSQL)

A REST API that provides:

- **Identity Registry** — Store and look up user commitments (public identities)
- **Credential Verification** — Verify that a user has a valid credential for a Service Provider
- **Nonce Issuance** — Issue one-time challenges for authentication
- **Nullifier Tracking** — Enforce one identity per user per SP (Sybil resistance)

### 2. Cryptographic Primitives (Hash-based PoC)

| Function | Purpose |
|----------|---------|
| `commitment_from_secret(msk)` | Compute public commitment = SHA256(msk) |
| `derive_nullifier(msk, sp_id)` | Derive unique nullifier per SP using HKDF |
| `create_proof(msk, sp_id, nonce)` | Create HMAC proof over (nonce, sp_id) |
| `verify_proof(...)` | Check proof format (full verification needs ZK in production) |
| `generate_nonce()` | Generate random 64-char hex string |

### 3. Database (PostgreSQL)

| Table | Purpose |
|-------|---------|
| **commitments** | Stores user commitments (public identities); one per user |
| **nullifiers** | Stores used nullifiers per SP; prevents same user registering twice at one SP |
| **nonces** | Stores issued nonces; prevents replay attacks; 5 min expiry |

---

## Authentication Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   User      │     │  Backend    │     │  SP (Site)  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  1. Register      │                   │
       │  commitment ────►│                   │
       │                   │                   │
       │                   │  2. Get nonce ◄───│
       │                   │  (sp_id)          │
       │                   │                   │
       │  3. Create proof, nullifier           │
       │  (from msk + nonce + sp_id)           │
       │                   │                   │
       │  4. Send proof, nullifier, commitment │
       │  ──────────────────────────────────►│
       │                   │                   │
       │                   │  5. Verify ◄───────│
       │                   │  (check all)      │
       │                   │                   │
       │                   │  6. Success ──────►│
       │                   │                   │
```

**Step-by-step:**

1. **Register** — User generates msk, computes commitment, sends to backend. Backend stores in `commitments`.
2. **Get nonce** — SP requests nonce from backend for its `sp_id`. Backend generates, stores in `nonces`, returns to SP.
3. **Create proof** — User derives nullifier and proof from msk + sp_id + nonce (client-side).
4. **Send to SP** — User sends proof, nullifier, commitment to the SP.
5. **Verify** — SP sends these to backend. Backend checks: commitment exists, proof format valid, nullifier not used, nonce valid.
6. **Success** — Backend stores nullifier, marks nonce used, returns success. SP logs user in.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root; returns app info |
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| POST | `/api/v1/registry/register` | Register a commitment |
| GET | `/api/v1/registry/check/{commitment}` | Check if commitment exists |
| GET | `/api/v1/verify/nonce?sp_id=...` | Get nonce (5 min TTL) |
| POST | `/api/v1/verify/credential` | Verify credential |
| GET | `/api/v1/auth/config` | OIDC config (placeholder) |
| GET | `/api/v1/auth/authorize` | SIOP authorize (placeholder) |
| POST | `/api/v1/auth/token` | Token endpoint (placeholder) |

---

## Key Concepts Explained

### Commitment

A **commitment** is the public representation of a user's master identity. It is computed as `SHA256(msk)` — a one-way hash. The backend stores it but cannot reverse it to get the msk. Same msk always produces the same commitment.

### Nullifier

A **nullifier** is a value derived from (msk, sp_id) that is unique per user per SP. It enables Sybil resistance: each user can register only once per SP. If they try again with the same nullifier, the backend rejects. Different SPs get different nullifiers from the same msk, so activity is not linkable across SPs.

### Proof

A **proof** is evidence that the user knows the msk. In our PoC it is an HMAC over (nonce, sp_id). The nonce ensures the proof is fresh and prevents replay. In production, this would be a Zero-Knowledge proof.

### Sybil Resistance

**Sybil resistance** means preventing one person from creating multiple identities. We achieve it via nullifiers: one nullifier per (user, SP). Reusing the same nullifier is rejected.

### Unlinkability

**Unlinkability** means different SPs cannot tell if two logins came from the same user. We derive different nullifiers per sp_id, so each SP sees a different value. Colluding SPs could theoretically link via the commitment; full unlinkability requires ZK (future).

---

## Project Structure

```
rotaion-virtual-hk/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI app
│   │   ├── config.py            # Settings from env
│   │   ├── database.py          # SQLAlchemy, PostgreSQL
│   │   ├── api/routes/
│   │   │   ├── health.py        # Health checks
│   │   │   ├── registry.py      # Register, check commitment
│   │   │   ├── verify.py        # Nonce, credential verification
│   │   │   └── auth.py         # OIDC placeholders
│   │   ├── core/crypto/
│   │   │   └── hash_based.py   # Commitment, nullifier, proof
│   │   └── models/
│   │       └── registry.py     # Commitment, Nullifier, Nonce models
│   ├── requirements.txt
│   ├── .env.example
│   ├── test_flow.py            # Automated test script
│   └── README.md
├── docs/
│   ├── SHIELDLOGIN_OVERVIEW.md  # This document
│   └── TESTING.md              # How to test
├── frontend/                   # (To be built)
└── readme.md
```

---

## What Is Not Yet Built

| Component | Status |
|-----------|--------|
| Master Wallet (frontend) | Not started |
| Demo SP (frontend) | Not started |
| OIDC/SIOP auth flow | Placeholder only |
| BLS / ZK crypto | Future; for production privacy |

---

## Next Steps

1. **Master Wallet** — Frontend app for users to generate msk, register commitment, create proof/nullifier
2. **Demo SP** — Example site with ShieldLogin button that calls verify endpoint
3. **BLS/ZK** (optional) — Replace hash-based crypto for production-grade unlinkability

---

## References

- **Paper**: [Anonymous Self-Credentials and their Application to Single-Sign-On](https://eprint.iacr.org/2025/618) (Alupotha, Barbaraci, Kaklamanis, Rawat, Cachin, Zhang, 2025)
- **Testing**: See [TESTING.md](TESTING.md)
