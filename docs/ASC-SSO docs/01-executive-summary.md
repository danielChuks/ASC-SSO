# Executive Summary

## The Problem We Solve

Decentralized Autonomous Organizations (DAOs) govern billions of dollars in on-chain treasuries through token-weighted voting. But almost every major DAO — Compound, Uniswap, MakerDAO, Aave — records every vote publicly on a blockchain. Any observer can see exactly which wallet address voted which way on every proposal.

This is not a minor UX inconvenience. It is a structural governance failure:

- **Whale surveillance**: Large token holders can identify and pressure smaller holders who vote against them
- **Delegate herding**: Voters copy powerful delegates rather than form independent opinions, because independent votes are visible and attributable
- **Strategic abstention**: Informed participants with minority opinions stay silent rather than face social or economic retaliation
- **Vote markets**: Proof-of-vote systems enable direct bribery — a voter can prove their choice to a buyer precisely because votes are public

The result is that DAOs are decentralized in infrastructure but centralized in influence. The governance layer does not reflect the true preferences of the community.

## Why Privacy in DAO Voting Matters

This is not a theoretical concern. Research in political science and behavioral economics consistently shows that secret ballots produce more honest, more independent, and more representative outcomes than public ones. The secret ballot was one of the most important governance innovations of the 19th century — DAOs have regressed to pre-secret-ballot conditions.

At the protocol level, the absence of private voting also makes DAOs structurally vulnerable:

- **Governance attacks** become cheaper when attackers can monitor and respond to opposition votes in real time
- **Voter fatigue** increases when participation carries reputational risk
- **Regulatory exposure** in some jurisdictions may require that employees of DAO contributors not leave an auditable trail of their personal governance positions

A privacy-preserving voting system that does not sacrifice verifiability or Sybil resistance is a foundational primitive for legitimate DAO governance.

## Why the PoC Is Innovative

Most existing approaches to private DAO voting rely on one of two techniques, both of which have serious weaknesses:

**Off-chain tallying (e.g., Snapshot + trusted relayer)**: Moves votes off-chain to hide them from the chain — but requires trusting an off-chain relayer to tally correctly and keep votes secret. Privacy is social, not cryptographic.

**Mixer-based anonymization (e.g., Tornado Cash-style)**: Breaks on-chain transaction links — but was designed for asset transfers, not governance, and requires voters to move tokens through a mixer before voting, which creates traceability artifacts and regulatory risk.

ASC-SSO takes a fundamentally different approach grounded in peer-reviewed cryptography published in April 2025:

1. **Self-sovereign identity**: Voters generate their own cryptographic credentials. No identity provider, no trusted issuer, no oracle.
2. **Zero-knowledge membership proofs**: A voter proves they hold a valid token-holder credential without revealing which credential. The proof is generated entirely client-side.
3. **Nullifier-based Sybil resistance**: Each voter can cast exactly one vote per proposal. The enforcement mechanism is a cryptographic nullifier derived from the voter's secret and the proposal ID — not a smart contract check on a public wallet address.
4. **Formal security guarantees**: The underlying ASC construction has published security proofs for unforgeability, anonymity, Sybil resistance, and multi-verifier unlinkability.

## How U2SSO-Inspired Technology Enables It

The paper introduces Anonymous Self-Credentials (ASC), a cryptographic primitive that lets a group of N principals each hold a master credential, prove membership in the group, and generate a verifier-specific nullifier — all without revealing their identity within the group.

The paper then implements this as U2SSO (User-Issued Unlinkable Single Sign-On): a system where users log in to multiple web services from a single master identity, with cryptographic guarantees that the services cannot link the user's activity across them.

ASC-SSO adapts this mechanism by recognizing that the "service provider" in U2SSO maps directly to a "proposal" in DAO voting:

| U2SSO concept | ASC-SSO (DAO) adaptation |
|---|---|
| Service Provider (SP) | DAO Proposal |
| Master identity registration | Voter commits to `CommitmentRegistry.sol` |
| Pseudonym registration with SP | Vote submission with ZK proof |
| Nullifier per SP | Nullifier per proposal (prevents double voting) |
| SP-side nullifier registry | Backend `sp_registrations` table |
| HKDF child credential | Voter signing key per proposal (Gauth) |

The technical stack from ASC-SSO-main — Semaphore ZK circuits (from U2SSO's `crypto-snark/` module), a Solidity `CommitmentRegistry`, a FastAPI verification backend, and a Next.js voter wallet — is already partially built and directly applicable.

## Summary Scorecard

| Criterion | Assessment |
|---|---|
| Problem validity | High — affects every major DAO today |
| Technical novelty | High — adapts 2025 peer-reviewed cryptography |
| Implementation maturity | Medium — working stack, DAO voting extension is the next layer |
| Production viability | Medium-term — on-chain verifier is the main remaining step |
| Ecosystem fit | Web3-native — Ethereum, Solidity, ZK proofs |
