# Problem Statement: Anonymous Self-Credentials and U2SSO

*Source: Alupotha, Barbaraci, Kaklamanis, Rawat, Cachin, Zhang — "Anonymous Self-Credentials and their Application to Single-Sign-On" (ePrint 2025/618)*

---

## 1. Why Do Most Online Accounts Require Email or Phone?

**Sybil resistance** — mitigating a single user appearing as many different users.

### Why Sybil Resistance?

- Optimized resource allocation for service providers
- Fair distribution of limited resources
- Prevention of fraud and abuse

### How It's Achieved Today

- Financial constraints (e.g., payment per account)
- Time limitations (e.g., creating email addresses)
- Trusted anchor (e.g., centralized Identity Provider)

---

## 2. Outcome: Data Linkability

Current solutions create **linkability** across services:

- Same email/phone used across Learning, Marketing, Selling → all linkable
- Centralized Identity Provider has complete visibility
- User tracking becomes trivial for colluding parties

---

## 3. Proposed Decentralized Solutions — The Trust Problem

Decentralized identity systems (DIDKit, Hyperledger Aries, CanDID, etc.) replace the IdP with a decentralized issuer or registry. But:

- **"Offered privacy"** — users rely on someone else to offer privacy
- **Trust assumption** — identity issuer/registry must not track users
- **Question:** Can we build Sybil-resistant identity where users gain their own privacy without relying on someone to offer it?

---

## 4. Solution: Cryptography

**Anonymous Self-Credentials (ASC)** — a cryptographic protocol that enables:

1. Users to self-generate identities
2. Sybil resistance without a trusted Identity Provider
3. Unlinkability across service providers
4. User-centric privacy (cryptographic, not "offered")

---

## 5. Anonymous Self-Credentials (ASC) — Requirements

### Entities

- **N provers** with identities `ID1, ..., IDN` (anonymity set)
- **L verifiers** with unique names `V1, ..., VL` (service providers)

### Primitives

| Primitive | Description |
|-----------|-------------|
| `Setup()` | Outputs CRS including verifier names |
| `Gen(crs)` | Prover self-generates `(ID, sk)` |
| `Prove([ID1..IDN], skj, a, Vi)` | Prover creates `(π, nul)` for pseudonym `a` at verifier `Vi` |
| `Verify([ID1..IDN], a, Vi, π, nul)` | Verifier checks proof and nullifier |

### Key Concepts

- **Pseudonym (a)** — username, email, or any identifier chosen for the verifier
- **Nullifier (nul)** — unique to `(skj, Vi)`; enables Sybil resistance
- **Proof (π)** — proves pseudonym came from a prover in the anonymity set without revealing which one

### Security Properties

1. **Correctness** — Honest provers can register valid pseudonyms for all verifiers; different provers have different nullifiers for the same verifier
2. **Robustness** — Malicious provers cannot hinder honest provers' registration
3. **Sybil resistance** — Same prover cannot generate different nullifiers for the same verifier (any two pseudonyms from same prover for same verifier are linkable)
4. **Unforgeability** — Adversary without honest prover's secret cannot forge proofs, even with access to previous proofs for adversary-picked pseudonyms
5. **Anonymity** — Adversary cannot identify which prover created a proof (given ≥2 honest provers)
6. **Unlinkability** — Adversary cannot tell if two proofs for different verifiers came from the same prover or different provers

---

## 6. User-Issued Unlinkable Single Sign-On (U2SSO)

### Model

- **User** — Self-generates master identity; manages one set of credentials; maintains privacy across services
- **Service Provider** — Wants Sybil resistance; assigns unique identifier (service name, origin)
- **Identity Registry (IdR)** — Immutable, stores master identities; does not issue credentials or keep secrets; may collude with SPs

### U2SSO Workflow (from paper)

1. **Master identity registration** — User registers `ID` with IdR; IdR stores in anonymity sets of size N
2. **Pseudonym derivation** — User derives child credential `ck = HKDF(r, vl)` per SP
3. **Registration** — User sends `(a, π, nul)` to SP; ASC proof proves membership; nullifier ensures one identity per SP
4. **Authentication** — After registration, user authenticates by proving ownership of `ck` (e.g., BLS/Schnorr signature) — **no ASC proof per login**
5. **Revocation/update** — User can revoke or update pseudonyms

### Key Distinction

- **Registration** — Uses ASC proof + nullifier (one-time per SP)
- **Authentication** — Uses Gauth (signature over challenge) with child credential; no IdR interaction

---

## 7. Implementation Options

| Construction | ASC Source | ID Size | Proof Size | Child Credential | Setup |
|--------------|------------|---------|------------|------------------|-------|
| **SRS-U2SSO** | zk-SNARK (Semaphore) | 96 bytes | 328 bytes | BLS | Trusted |
| **CRS-U2SSO** | Double Blind PoE | 33 bytes | O(log N + L) | Schnorr | Transparent |

---

## 8. Federated SSO vs U2SSO

| Aspect | Federated SSO | U2SSO |
|--------|---------------|-------|
| IdP interaction | Frequent | Minimal (only at registration) |
| Child credential | Chosen by IdP | Plug-and-play (BLS, Schnorr, etc.) |
| Privacy | Offered by IdP | User-centric (cryptographic) |

---

## References

- [Paper](https://eprint.iacr.org/2025/618) — Anonymous Self-Credentials and their Application to Single-Sign-On
- [BoquilaID/U2SSO](https://github.com/BoquilaID/U2SSO) — IC3 hackathon implementation
