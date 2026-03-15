# ASC-SSO: Anonymous DAO Governance & Voting

> *Private votes. Verifiable outcomes. No surveillance.*

---

## Elevator Pitch

ASC-SSO applies the Anonymous Self-Credentials (ASC) cryptographic framework — introduced in the research paper ["Anonymous Self-Credentials and their Application to Single-Sign-On"](https://eprint.iacr.org/2025/618) and prototyped in the U2SSO reference implementation — to a high-stakes real-world problem: **anonymous, Sybil-resistant voting in decentralized autonomous organizations (DAOs)**. A token holder proves they belong to the eligible voter set using a zero-knowledge membership proof, casts a vote anonymously, and the DAO contract enforces one-vote-per-member via a cryptographic nullifier — all without ever revealing which wallet cast which vote.

---

## Problem Statement

In most DAO governance systems today, votes are **fully public on-chain**. Every wallet address, every vote choice, every timestamp is visible to everyone. This creates:

- **Fear of retaliation** from whales, delegates, or protocol teams
- **Social herding** — voters copy the majority or powerful actors rather than voting independently
- **Strategic silence** — informed participants abstain to avoid controversy
- **Bribery vulnerability** — vote-buying markets can verify compliance cheaply

The result is a governance layer that is decentralized in name only. The voters who would push back on bad proposals are often the ones least likely to speak up publicly.

---

## Proposed Solution

ASC-SSO replaces public vote attribution with **cryptographic anonymity** while preserving the properties that governance actually requires:

| Property | How ASC-SSO Achieves It |
|---|---|
| **Eligible voters only** | ZK membership proof against a token-snapshot anonymity set |
| **One vote per member** | Nullifier derived from `(voter_secret, proposal_id)` — unique and deterministic |
| **No identity leakage** | Proof reveals only "I am in the set" — never which member |
| **Unlinkable across proposals** | Different nullifier per proposal; cross-proposal correlation is cryptographically prevented |
| **Verifiable tally** | Vote content and nullifier are public; only authorship is hidden |

---

## What ASC-SSO Is

ASC-SSO is our project-specific adaptation of the U2SSO identity system, repurposed for DAO governance. We replace the original use case (logging in to web services) with the governance use case (casting votes in a DAO). The core cryptographic machinery — Semaphore-based ZK membership proofs, HKDF-based child credential derivation, Poseidon-hash nullifiers, and an on-chain commitment registry — is preserved and adapted.

**Origin chain:**
1. **Paper**: Introduces ASC notion and U2SSO protocol (CRS-ASC via Double-Blind PoE, SRS-ASC via Semaphore/Circom)
2. **U2SSO-main.zip**: Reference PoC — Go CLI, Solidity IdR, Semaphore circuits, CRS crypto library
3. **ASC-SSO-main**: Our adaptation — FastAPI backend, Next.js frontend, CommitmentRegistry contract, Semaphore ZK integration adapted to support DAO voting flows

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         VOTER (Browser)                             │
│  Semaphore Identity + r (localStorage)                              │
│  ┌──────────┐  ┌──────────────┐  ┌─────────────────┐               │
│  │ Identity │  │  ZK Prover   │  │  Child Cred      │               │
│  │ (secret) │  │  (Semaphore) │  │  HKDF(r,prop_id) │               │
│  └──────────┘  └──────────────┘  └─────────────────┘               │
└────────────────────┬──────────────────────────┬─────────────────────┘
                     │ ZK proof + nullifier      │ vote + nullifier
                     ▼                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                   BACKEND (FastAPI + PostgreSQL)                    │
│  ┌──────────────────────┐   ┌────────────────────────────────────┐  │
│  │ /verify/register     │   │ /dao/vote                          │  │
│  │  - verify ZK proof   │   │  - verify ZK proof                 │  │
│  │  - check nullifier   │   │  - check nullifier (double-vote)   │  │
│  │  - store pseudonym   │   │  - store (nullifier, vote_choice)  │  │
│  └──────────────────────┘   └────────────────────────────────────┘  │
└────────────────────┬──────────────────────────────────────────────--┘
                     │ read anonymity set (commitments)
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│               BLOCKCHAIN (Ethereum / Local Hardhat)                 │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  CommitmentRegistry.sol                                      │    │
│  │  - addCommitment(commitment, isSemaphore)                   │    │
│  │  - getSemaphoreCommitments() → anonymity set                │    │
│  │  - revoke(index)                                            │    │
│  └─────────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  DAOVoting.sol  [PROPOSED for PoC extension]                │    │
│  │  - createProposal(id, snapshot_root)                        │    │
│  │  - castVote(proposal_id, vote, nullifier, proof)            │    │
│  │  - tallyVotes(proposal_id)                                  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Key Features

- **Zero-knowledge membership proof** — Semaphore circuit proves voter is in the anonymity set without revealing which commitment
- **Nullifier-based double-vote prevention** — `nullifier = Poseidon(scope=proposal_id, secret)` is deterministic; reuse is rejected
- **On-chain anonymity set** — `CommitmentRegistry.sol` stores voter commitments; read by backend for proof construction
- **Unlinkable across proposals** — different `proposal_id` → different nullifier → cross-proposal identity correlation is cryptographically prevented
- **Authenticated but anonymous tally** — vote content is public, authorship is private
- **Separation of registration and voting** — identity registration is a one-time on-chain event; voting requires only a ZK proof

---

## Repository / Documentation Map

```
TODO
```

---

## Demo Flow 

1. **Voter registers** — creates Semaphore identity, posts commitment to `CommitmentRegistry.sol`
2. **DAO creates proposal** — proposal ID is frozen; eligibility snapshot is the current commitment set
3. **Voter casts ballot** — browser generates ZK proof of membership, nullifier for this proposal, vote choice
4. **Backend verifies** — checks ZK proof, rejects if nullifier already used, stores `(nullifier, vote_choice)`
5. **Tally** — sum votes by choice; nullifiers are public so anyone can audit uniqueness; voter identity stays hidden

---

## What Makes This Novel

Most DAO privacy tools offer anonymization after the fact (e.g., tornado cash-style mixing) or rely on off-chain trusted talliers (e.g., Snapshot + IPFS). ASC-SSO is different:

- **Self-sovereign identity** — no identity provider issues credentials; voters generate their own
- **Cryptographic privacy** — privacy does not depend on anyone keeping a secret
- **Nullifier-native Sybil resistance** — prevents double voting at the protocol level, not the app level
- **Based on peer-reviewed cryptography** — the ASC construction (paper, April 2025) provides formal security proofs for unforgeability, anonymity, and multi-verifier unlinkability

---

## Hackathon Value Proposition -- **REVIEW**

| Dimension | Score |
|---|---|
| **Real problem** | DAOs lose billions in governance value due to public voting coercion |
| **Novel crypto** | Adapts ASC/U2SSO — peer-reviewed 2025 paper — to a new domain |
| **Working code** | ASC-SSO-main provides the full stack: contract, backend, frontend |
| **Extensibility** | DAO voting is one use case; the same primitives work for grants, elections, polls |
| **Production path** | Clear upgrade path: on-chain verifier, Merkle snapshots, threshold tallying |

---

## How This Could Evolve Into Production -- **REVIEW**

- **On-chain ZK verifier** — replace the Node.js subprocess verifier with a Solidity Groth16 verifier generated from the Semaphore circuit; votes become fully on-chain
- **ERC-20 snapshot integration** — tie anonymity set construction to ERC-20 `balanceOf` snapshots at a fixed block
- **Multi-choice and ranked voting** — extend vote encoding beyond binary; the nullifier mechanism is choice-agnostic
- **Accountability escape hatch** — implement the optional committee-based decryption mechanism described in the paper (Section 8) for dispute resolution
- **Cross-DAO identity** — the same master identity can vote in multiple DAOs without linking registrations across them

---

## References

- **Paper**: Alupotha, Barbaraci, Kaklamanis, Rawat, Cachin, Zhang — [Anonymous Self-Credentials and their Application to Single-Sign-On](https://eprint.iacr.org/2025/618), April 2025
- **U2SSO Reference Impl**: [BoquilaID/U2SSO](https://github.com/BoquilaID/U2SSO)
- **Semaphore Protocol**: [semaphore-protocol/semaphore](https://github.com/semaphore-protocol/semaphore)
- **Circom / SnarkJS**: [iden3/circom](https://github.com/iden3/circom)
