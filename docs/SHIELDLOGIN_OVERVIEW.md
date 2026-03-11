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

### 2. Cryptographic Primitives (ZK)

| Function | Purpose |
|----------|---------|
| Semaphore Identity | Self-generated identity; commitment = Poseidon hash |
| Semaphore Group | Anonymity set from registry commitments |
| `generateSemaphoreProof(identity, group, sp_id)` | ZK proof of membership + nullifier |
| `deriveChildSecret(r, sp_id)` | HKDF for child credential (Gauth) |
| `signWithSeed(cskl, challenge)` | Ed25519 signature for authentication |

### 3. Storage

| Component | Purpose |
|-----------|---------|
| **IdR (commitments)** | On-chain only — Solidity CommitmentRegistry; stores Semaphore commitments for anonymity set |
| **sp_registrations** | PostgreSQL; pseudonym, nullifier per SP; Sybil resistance |
| **auth_challenges** | PostgreSQL; one-time challenges for Gauth; 5 min expiry |

Commitments require `IDR_CONTRACT_ADDRESS`, `ETH_RPC_URL`, and `IDR_DEPLOYER_KEY` in `.env`. See [contracts/README.md](../contracts/README.md).

---

## U2SSO Flow (per Paper)

### Registration (one-time per SP)

1. User fetches anonymity group from `GET /registry/group`
2. User builds Semaphore Group, generates ZK proof (π, nullifier_hash, merkle_root)
3. User derives cskl = HKDF(r, sp_id), ϕ = Ed25519 public key
4. User sends (ϕ, nullifier_hash, proof, merkle_tree_root) to `POST /verify/register`
5. Backend verifies ZK proof, stores in `sp_registrations`

### Authentication (repeated visits)

1. User derives cskl, ϕ from stored r
2. User gets challenge from `GET /verify/auth/challenge`
3. User signs challenge with cskl (Ed25519)
4. User sends (ϕ, challenge, signature) to `POST /verify/auth`
5. Backend verifies Ed25519 signature; no ASC proof needed

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Root; returns app info |
| GET | `/health` | Health check |
| GET | `/ready` | Readiness check |
| POST | `/api/v1/registry/register` | Register a commitment |
| GET | `/api/v1/registry/check/{commitment}` | Check if commitment exists |
| GET | `/api/v1/registry/group` | Get anonymity set (Semaphore commitments) for ZK |
| POST | `/api/v1/verify/register` | U2SSO registration (ZK proof, one-time per SP) |
| GET | `/api/v1/verify/auth/challenge?sp_id=...&pseudonym=...` | Get challenge for auth |
| POST | `/api/v1/verify/auth` | U2SSO authentication (Gauth) |
| POST | `/api/v1/verify/credential` | Legacy single-flow (backward compat) |
| GET | `/api/v1/auth/config` | OIDC config (placeholder) |
| GET | `/api/v1/auth/authorize` | SIOP authorize (placeholder) |
| POST | `/api/v1/auth/token` | Token endpoint (placeholder) |

---

## Key Concepts Explained

### Commitment

A **commitment** is the public representation of a user's master identity. We use Semaphore (Poseidon hash). The backend stores it in the registry and includes it in the anonymity set for ZK proofs. The commitment is never revealed in the proof.

### Nullifier

A **nullifier** is a value from the Semaphore ZK proof (scope = sp_id) that is unique per user per SP. It enables Sybil resistance: each user can register only once per SP. Different SPs get different nullifiers, so activity is not linkable across SPs.

### Proof

A **proof** is a Semaphore ZK proof that proves membership in the anonymity set without revealing which commitment. The proof proves "I am one of the registered users" and binds the nullifier to sp_id.

### Sybil Resistance

**Sybil resistance** means preventing one person from creating multiple identities. We achieve it via nullifiers: one nullifier per (user, SP). Reusing the same nullifier is rejected.

### Unlinkability

**Unlinkability** means different SPs cannot tell if two logins came from the same user. The ZK proof hides the commitment; different nullifiers per sp_id ensure unlinkability across SPs.

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
│   │   │   ├── registry.py      # IdR — register, check, group (on-chain)
│   │   │   ├── verify.py        # ZK registration, auth
│   │   │   └── auth.py          # OIDC placeholders
│   │   ├── services/
│   │   │   └── idr_contract.py  # Web3 client for CommitmentRegistry
│   │   ├── core/crypto/
│   │   │   └── hash_based.py    # Legacy (hash-based PoC)
│   │   └── models/
│   │       └── registry.py      # SpRegistration, AuthChallenge, etc.
│   ├── semaphore-verifier/      # Node.js ZK proof verification
│   ├── requirements.txt
│   ├── .env.example
│   └── README.md
├── contracts/
│   ├── contracts/
│   │   └── CommitmentRegistry.sol  # On-chain IdR
│   ├── scripts/deploy.js
│   ├── hardhat.config.js
│   └── README.md
├── docs/
│   ├── SHIELDLOGIN_OVERVIEW.md  # This document
│   ├── PROBLEM_STATEMENT.md     # ASC/U2SSO requirements
│   ├── CURRENT_SOLUTION_AND_GAPS.md
│   ├── FRONTEND_ROADMAP.md
│   └── TESTING.md              # How to test
├── frontend/
│   ├── shared/crypto/           # Semaphore ZK, Gauth, HKDF
│   └── master-wallet/           # Next.js app (create identity + login)
└── readme.md
```

---

## What Is Not Yet Built

| Component | Status |
|-----------|--------|
| Master Wallet (frontend) | ✅ Built — ZK identity, registration, login |
| Revocation/update | ❌ Not implemented |
| OIDC/SIOP auth flow | Placeholder only |
| Blockchain IdR | ✅ Required — Solidity CommitmentRegistry (on-chain only) |

---

## Next Steps

1. **Revocation/update** — Allow users to revoke or change pseudonyms at an SP
2. **End-to-end verification** — Ensure Semaphore verifier path and dependencies work
3. **Blockchain IdR** — Required; see [contracts/README.md](../contracts/README.md) for deployment

---

## References

- **Paper**: [Anonymous Self-Credentials and their Application to Single-Sign-On](https://eprint.iacr.org/2025/618) (Alupotha, Barbaraci, Kaklamanis, Rawat, Cachin, Zhang, 2025)
- **Testing**: See [TESTING.md](TESTING.md)
