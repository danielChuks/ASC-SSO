# ShieldLogin (U2SSO)

User-issued Unlinkable Single Sign-On — log in to sites without revealing your identity. Based on [ePrint 2025/618](https://eprint.iacr.org/2025/618).

---

## The Core Idea

1. You create a secret only you know (Semaphore identity + `r`)
2. You derive public values that prove you know it, without revealing it
3. Commitments live on-chain (Solidity); backend verifies proofs and stores registrations

---

## What Each Side Knows

| Who | What they know |
|-----|----------------|
| **You (browser)** | Semaphore identity and `r` — secrets only you have |
| **IdR (blockchain)** | Commitments only — no secrets |
| **Backend** | ZK proof, nullifier, pseudonym — **never** your identity |

---

## Step-by-Step Flow

### Phase 1: Create identity (Home page)

```
You (browser):  Create Semaphore Identity + bootstrap seed
You (browser):  POST /registry/register for both commitments
Backend:        Calls IdR contract addCommitment() — stores on-chain
You (browser):  Store identity, r in localStorage
```

### Phase 2: Register with a site (one-time per SP)

```
You (browser):  GET /registry/group → fetches commitments from IdR contract
You (browser):  Build Semaphore Group, generate ZK proof (membership + nullifier for sp_id)
You (browser):  Derive cskl = HKDF(r, sp_id), ϕ = Ed25519 public key
You (browser):  POST /verify/register (ϕ, nullifier_hash, proof, merkle_root)
Backend:        Verifies ZK proof, stores (pseudonym, nullifier) in PostgreSQL
```

### Phase 3: Login (subsequent visits)

```
You (browser):  GET /verify/auth/challenge (sp_id, pseudonym)
You (browser):  Sign challenge with cskl (Ed25519)
You (browser):  POST /verify/auth (ϕ, challenge, signature)
Backend:        Verifies Ed25519; no ZK proof needed
```

---

## Storage

| Data | Where |
|------|-------|
| **Commitments** | On-chain (Solidity CommitmentRegistry) |
| **sp_registrations** | PostgreSQL |
| **auth_challenges** | PostgreSQL |
| **identity, r** | Browser localStorage |

---

## Quick Start

1. **Deploy IdR contract** — See [contracts/README.md](contracts/README.md)
2. **Backend** — PostgreSQL + `.env` with `IDR_CONTRACT_ADDRESS`, `ETH_RPC_URL`, `IDR_DEPLOYER_KEY`
3. **Frontend** — `cd frontend/master-wallet && npm run dev`
4. **Create identity** → **Register with SP** → **Login**

---

## Documentation

- [Problem Statement](docs/PROBLEM_STATEMENT.md) — ASC/U2SSO requirements from the paper
- [ShieldLogin Overview](docs/SHIELDLOGIN_OVERVIEW.md) — Full system reference
- [Current Solution & Gaps](docs/CURRENT_SOLUTION_AND_GAPS.md) — Implemented vs pending
- [Testing](docs/TESTING.md) — How to test

---

## References

- [Paper](https://eprint.iacr.org/2025/618) — Anonymous Self-Credentials and their Application to Single-Sign-On
- [BoquilaID/U2SSO](https://github.com/BoquilaID/U2SSO) — IC3 hackathon implementation
