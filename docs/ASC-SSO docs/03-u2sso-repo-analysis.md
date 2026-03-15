# U2SSO Repository Analysis (U2SSO-main.zip)

*Source: https://github.com/BoquilaID/U2SSO — IC3 Hackathon reference implementation*

---

## 1. Repository Purpose

U2SSO-main is the official proof-of-concept implementation of the U2SSO protocol described in the paper. It demonstrates all five phases of the protocol: master identity creation, registration with a service, authentication, and the underlying ZK and cryptographic libraries. It is the starting point from which ASC-SSO derives its technical approach.

The repo is a monorepo with three independent modules, each implementing a different layer of the system.

---

## 2. Repository Structure

```
U2SSO-main/
├── crypto-dbpoe/          ← CRS-U2SSO: C library (libsecp256k1 extension + DBPoE)
├── crypto-snark/          ← SRS-U2SSO: Semaphore/Circom ZK circuits + JS prover
└── proof-of-concept/      ← Application layer: Go CLI + Go HTTP server + Solidity contract
```

---

## 3. Module: `crypto-dbpoe/`

**What it is**: A fork/extension of the Bitcoin Core `libsecp256k1` C library implementing the CRS-ASC construction from the paper. This is the "Double-Blind Proof of Existence" (DBPoE) construction.

**Key components**:
- `src/modules/ringcip/` — The core ring-CIP (ring commitments and inner product) module. This implements the Bootle et al. membership proof for multi-generator Pedersen commitments. The membership proof proves "my commitment is one of these N commitments" in O(log N) proof size.
- `src/modules/commitment/` — Pedersen commitment implementation over SECP256K1. The `pedersen_impl.h` file implements `secp256k1_pedersen_commit()` using the multi-generator variant needed for CRS-ASC.
- `src/modules/bulletproofs/` — Inner product arguments used inside the membership proof
- `src/tests_boquila.c` — Test vectors for the DBPoE construction specifically
- `include/secp256k1_ringcip.h` — Public API: `secp256k1_ringcip_prove()`, `secp256k1_ringcip_verify()`

**What it implements from the paper**: The CRS-ASC relation `R_{ASC_CRS, N, J_WEE}` — specifically the zero-knowledge argument that proves membership in an anonymity set of Pedersen commitments. The C library is called from the Go layer via CGO bindings in `proof-of-concept/`.

**Nullifier approach** (CRS-ASC): The nullifiers for all L verifiers are pre-committed inside the master identity `Φ = Com([nul_1, ..., nul_L], k)`. The proof opens only `nul_l` for verifier `l`, using the binding property of Pedersen commitments to ensure consistency.

---

## 4. Module: `crypto-snark/`

**What it is**: The SRS-ASC implementation using Semaphore (Circom/SnarkJS). This is the ZK-SNARK based construction from the paper.

**Key components**:
- `circuits/semaphore.circom` — The core Semaphore circuit, implementing the three-part ZK relation:
  1. Identity generation: derives `identityCommitment = Poseidon([Ax, Ay])` from a secret scalar using Baby Jubjub
  2. Membership proof: verifies that `identityCommitment` is a leaf in a Merkle tree (`BinaryMerkleRoot` template)
  3. Nullifier: computes `nullifier = Poseidon([scope, secret])` where `scope` is the verifier identifier
- `circuits/semaphore_{16,32,64,128,256,512,1024}.circom` — Pre-compiled variants for fixed Merkle tree depths (anonymity set sizes)
- `build/semaphore_{N}_js.zkey` — Pre-generated proving keys (from Groth16 trusted setup) for each N
- `src/index.js` — JavaScript wrapper: `generateProof(identity, group, message, scope, treeDepth)`
- `test/linkChildKeys.test.js` — Tests for HKDF child key derivation and unlinkability

**What it implements from the paper**: The SRS-ASC relation `R_{ASC_SRS, N, J_WEE}`:
- `C_j = Com_{srs}(sk_j)` maps to `identityCommitment = Poseidon(BabyJub_pubkey(secret))`
- `nul = Hash_{srs}(sk_j, v_l)` maps to `nullifier = Poseidon([scope=v_l, secret=sk_j])`
- The Merkle tree is the anonymity set; proof of membership is the Merkle path verification

**Critical mapping for ASC-SSO**: The Semaphore circuit's `scope` input is the "verifier identifier" `v_l` from the paper. For DAO voting, `scope = proposal_id` is the natural mapping. The circuit already supports this — no circuit modification is needed.

---

## 5. Module: `proof-of-concept/`

**What it is**: A complete working application demonstrating the full U2SSO flow. Contains a command-line interface (CLI) for users, an HTTP server simulating a service provider, and a Solidity smart contract as the IdR.

**Key components**:

`clientapp.go` — The user-side CLI. Three commands:
- `./clientapp -command create` — generates master credentials, posts `Φ` to the Ethereum contract, stores `(sk, r)` in a local keyfile
- `./clientapp -command register` — generates ZK proof and nullifier for a service, outputs the proof in hex for pasting into the SP website
- `./clientapp -command auth` — generates an authentication signature for a given challenge

`server.go` — The service provider HTTP server. Hosts static pages (`signup.html`, `login.html`) and implements:
- `POST /signup` — verifies the membership proof and nullifier, registers the user's pseudonym
- `POST /login` — issues a challenge, verifies the authentication signature

`u2sso/u2ssolib.go` — Core cryptographic logic in Go:
- Calls `crypto-dbpoe` via CGO for CRS-ASC proof generation/verification
- Calls `crypto-snark` via `exec.Command("node", ...)` subprocess for SRS-ASC proof generation
- Implements HKDF child key derivation: `csk_l = HKDF(r, v_l)`
- Implements Schnorr signature (CRS-U2SSO Gauth) and BLS signature (SRS-U2SSO Gauth)

`u2ssoContract/contracts/U2SSO.sol` — The Ethereum IdR contract. Stores a list of `ID` structs containing `(uint256 id, uint id33, bool active, address owner)`. The two-part ID format (`id` + `id33`) stores the 33-byte CRS-ASC commitment split across two `uint256` fields. Functions: `addID()`, `getIDs()`, `getState()`, `getIDSize()`, `getIDIndex()`.

`static/signup.html` and `static/login.html` — Web UI accepting hex-encoded proofs pasted from the CLI. This demonstrates the separation between the user-side prover and the SP-side verifier.

---

## 6. How the Repo Maps to the Paper

| Paper section | Implementation location |
|---|---|
| ASC.Gen — CRS-ASC | `crypto-dbpoe/src/modules/commitment/` + `u2ssolib.go` |
| ASC.Gen — SRS-ASC | `crypto-snark/src/index.js` (Semaphore identity creation) |
| ASC.Prove — CRS-ASC | `crypto-dbpoe/src/modules/ringcip/` (ring CIP proof) |
| ASC.Prove — SRS-ASC | `crypto-snark/circuits/semaphore.circom` + Groth16 prover |
| ASC.Verify | `server.go` via CGO (CRS) or Node.js subprocess (SRS) |
| Nullifier (CRS) | Pre-committed in `Φ`, revealed in proof |
| Nullifier (SRS) | `Poseidon([scope, secret])` in circuit |
| HKDF child derivation | `u2ssolib.go`: `HKDFextract()` + `HKDFexpand()` |
| IdR (smart contract) | `u2ssoContract/contracts/U2SSO.sol` |
| Registration flow | `clientapp.go` + `server.go /signup` |
| Authentication flow | `clientapp.go` + `server.go /login` |

---

## 7. What ASC-SSO Reuses

From `crypto-snark/`:
- The Semaphore circuit design (both the circom source and the compiled `.zkey` proving keys)
- The proof generation API: `generateProof(identity, group, message, scope, treeDepth)`
- The nullifier formula: `Poseidon([proposal_id, secret])`
- The pre-built proving keys for N ∈ {16, 32, 64, 128, 256, 512, 1024}

The ASC-SSO `frontend/shared/crypto/semaphoreZK.ts` is a direct TypeScript adaptation of the `crypto-snark/src/index.js` logic, wrapping the `@semaphore-protocol/proof` library.

From `u2ssoContract/contracts/U2SSO.sol`:
- The conceptual design of the on-chain IdR (flat array of identities, `addID`, `getIDs`, `getIDSize`)
- ASC-SSO's `CommitmentRegistry.sol` extends this with: Semaphore-specific commitment typing, `revoke()` for pseudonym revocation, and `getSemaphoreCommitments()` for bulk reads needed by the Merkle tree builder

From `clientapp.go` HKDF logic:
- ASC-SSO's `frontend/shared/crypto/hkdf.ts` implements the same HKDF-Extract + HKDF-Expand pattern in TypeScript using the WebCrypto API

---

## 8. What ASC-SSO Adapts

**Language/runtime migration**: U2SSO uses Go (CLI) and Node.js (subprocess). ASC-SSO moves all user-side logic to TypeScript in the browser (Next.js), which is more appropriate for a consumer-facing voting dApp.

**Architecture shift**: U2SSO is a CLI-first tool where the user manually pastes hex proofs into a web form. ASC-SSO integrates the proof generation into the browser UI, creating a seamless UX.

**Contract redesign**: U2SSO's `U2SSO.sol` stores two-part 33-byte CRS commitments. ASC-SSO's `CommitmentRegistry.sol` stores single `uint256` Semaphore commitments (Poseidon hashes), matches the Semaphore protocol format, and adds type-aware filtering (`isSemaphore` flag) for forward compatibility.

**Backend language**: U2SSO has no standalone backend — the SP logic is embedded in `server.go`. ASC-SSO introduces a proper FastAPI (Python) REST API with PostgreSQL persistence, enabling multi-SP deployment and proper nullifier registry management.

**DAO adaptation**: The SP identifier `v_l` (service name) maps to `proposal_id` in the DAO context. The backend's `sp_registrations` table maps to a `votes` table. The proposal registry is a new component specific to ASC-SSO that has no U2SSO equivalent.

---

## 9. Gaps Between Paper and U2SSO Repo

| Paper feature | U2SSO-main status |
|---|---|
| Fixed-size anonymity sets (N identities per set) | Implemented (Solidity `idList[]` with fixed batch logic) |
| CRS-ASC (DBPoE) | Fully implemented in C |
| SRS-ASC (Semaphore) | Fully implemented; circuits compiled |
| HKDF child derivation | Implemented in Go |
| Gauth (BLS / Schnorr) | Implemented in Go |
| Pseudonym revocation | Partially — `revokeID()` in contract, not wired to SP |
| Multi-SP unlinkability test | Not tested end-to-end |
| Performance benchmarks | Documented in paper; not in repo scripts |
| On-chain proof verification | Not implemented — Go subprocess only |
