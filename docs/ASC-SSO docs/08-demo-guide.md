# Demo Guide

This guide walks through a complete hackathon demonstration of ASC-SSO anonymous DAO voting.

---

## 1. Demo Scenario

"TODO"

## 2. Prerequisites

**Infrastructure**:
- Node.js 18+ and npm
- Python 3.11+ and pip
- PostgreSQL running locally


**Environment**:
```bash
TODO
```

---

## 3. Step-by-Step Demo Script

### Scene 1: The Problem 

Open Tally.xyz or Snapshot in a browser and show a real DAO vote.

> "Here's a typical DAO vote. See how every wallet address is public? Imagine you're a major token holder and you want to vote against the whales' preferred proposal. You can see the consequences."

### Scene 2: Create Voter Identity 

Open `http://localhost:3000` in three separate browser tabs (representing Voter A, B, C — use incognito windows for isolation).

In Tab 1 (Voter A):
1. Click "Create Identity"
2. Watch the browser generate a Semaphore identity
3. Show: "Your secret stays here — it never leaves your browser"
4. Click "Register Identity" — this calls `POST /registry/register` and posts to the smart contract

Expected output in browser console:
```
commitment = 0x14f3...  ← Poseidon hash posted to CommitmentRegistry.sol
Identity stored in localStorage ✓
```

**Talking point**: "This commitment is like a locked box. Only I have the key. Anyone can see the box on the blockchain, but they can't tell it's mine."

Repeat in Tab 2 and Tab 3 (fast — just click buttons). Show the smart contract accumulating commitments.

### Scene 3: Cast a Vote — Voter A 

**Talking point**: "The backend verified that Voter A is in the anonymity set. It stored the nullifier and vote choice. But it has no idea which commitment this was. It just knows: someone eligible voted YES."

### Scene 4: Attempt Double-Vote 

**Talking point**: "Same voter, same proposal, same nullifier. The cryptography prevents double voting. Not a password, not a session — math."

### Scene 5: Other Voters Vote Differently 

Show in the backend logs that three different nullifiers are stored — each looks like random noise — no pattern reveals who voted what.


**Talking point**: "The tally is public. The votes are counted correctly. But we cannot go backwards — we cannot find out which voter cast which vote. That's not a limitation. That's the design."



**Concrete evidence**:
1. The `CommitmentRegistry.sol` on the blockchain — voter identities visible, but just hashes
2. The ZK proof generation in the browser — real cryptography, not simulation
3. The nullifier rejection on double-vote — enforcement without identity revelation
4. The tally page — correct count, no attribution

**The paper connection**: Show the paper (ePrint 2025/618) and highlight:
- Definition 10 (Sybil Resistance) → nullifier rejection you just showed
- Definition 11 (Anonymity) → the adversary cannot identify which commitment voted
- Definition 12 (Multi-verifier Unlinkability) → cross-proposal unlinkability you just showed

---

## 5. Key Talking Points

- "Most DAO privacy tools move votes off-chain, which means trusting an off-chain relayer. We keep the verification on the ZK proof — math doesn't lie."
- "The cryptographic primitives come from a peer-reviewed paper published in April 2025. This isn't homebrewed crypto."
- "One voter, one vote — enforced by Poseidon hashing, not by a smart contract ACL on wallet addresses. You cannot get around it with a second wallet."
- "The vote choice is separated from the identity at the protocol level. Even the DAO backend admin cannot build a voter profile."
- "The anonymity set means you're hidden in a crowd. The bigger the crowd, the stronger the privacy."

---

## 6. Expected Outputs


---
