# ShieldLogin Frontend Implementation Roadmap

Implementation guide for the Master Wallet (ZK-only flow).

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND COMPONENTS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐                                                    │
│   │   Master Wallet      │                                                    │
│   │   (User app)         │                                                    │
│   │                      │                                                    │
│   │ • Create ZK identity │ ───────────► Backend API (FastAPI)                 │
│   │ • Register with SP   │              • Registry (commitments, group)       │
│   │ • Login (Gauth)      │              • Verify (ZK proof, auth)              │
│   └─────────────────────┘                                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Choice | Purpose |
|--------|---------|
| **Next.js** | React framework, SSR, routing |
| **Tailwind CSS** | Styling |
| **Lucide React** | Icons |
| **Semaphore** | ZK identity, group, proof |
| **@noble/ed25519** | Gauth (child credential signing) |

---

## Implementation Status (ZK-only)

| Phase | Status | Description |
|-------|--------|-------------|
| **1. Shared Crypto** | ✅ Done | Semaphore ZK, Gauth (Ed25519), HKDF |
| **2. Master Wallet Scaffold** | ✅ Done | Next.js, Tailwind |
| **3. Create Identity** | ✅ Done | Semaphore Identity + bootstrap seed |
| **4. Register with SP** | ✅ Done | ZK proof via `POST /verify/register` |
| **5. Login (Gauth)** | ✅ Done | Challenge + Ed25519 signature |

---

## Phase 1: Shared Crypto Library

**Goal:** ZK and Gauth primitives in the browser.

| Step | Task | Details |
|------|------|---------|
| 1.1 | Semaphore ZK | `generateSemaphoreProof(identity, group, sp_id)` |
| 1.2 | Child credential | `deriveChildSecret(r, sp_id)` via HKDF |
| 1.3 | Gauth | `getPseudonymWithSeed`, `signWithSeed` (Ed25519) |

**Output:** Browser can generate ZK proofs and sign challenges.

---

## Phase 2: Master Wallet — Scaffold

**Goal:** Basic Next.js app structure.

| Step | Task | Details |
|------|------|---------|
| 2.1 | Create `frontend/master-wallet/` | `npx create-next-app` |
| 2.2 | Add Tailwind, Lucide | Configure styling |
| 2.3 | Add shared crypto | Import from `../shared/crypto` or package |
| 2.4 | Configure API base URL | Env var for backend (e.g. `NEXT_PUBLIC_API_URL`) |

**Output:** Master Wallet app runs, can import crypto.

---

## Phase 3: Master Wallet — Create Identity

**Goal:** User creates Semaphore identity and registers.

| Step | Task | Details |
|------|------|---------|
| 3.1 | Create Semaphore Identity | `new Identity()` |
| 3.2 | Register commitments | User + bootstrap seed → `POST /registry/register` |
| 3.3 | Store identity | `shieldlogin_zk_identity`, `shieldlogin_r` in localStorage |

**Output:** User has ZK identity in anonymity set.

---

## Phase 4: Master Wallet — Register & Login to SP

**Goal:** User registers with SP (first time) and logs in (subsequent visits).

| Step | Task | Details |
|------|------|---------|
| 4.1 | Register (first time) | Fetch group → ZK proof → `POST /verify/register` |
| 4.2 | Login (subsequent) | Get challenge → sign with cskl → `POST /verify/auth` |

**Output:** User can register and authenticate to any sp_id.

---

## Phase 5: Master Wallet — Storage & UX

**Goal:** Secure storage and basic UX.

| Step | Task | Details |
|------|------|---------|
| 5.1 | Encrypt msk | Use password-derived key (PBKDF2) + AES or similar |
| 5.2 | Persist to IndexedDB | Or localStorage (simpler, less storage) |
| 5.3 | "Unlock" flow | Password prompt to decrypt msk when needed |
| 5.4 | Dashboard | Show "Registered", "Login to SP" button, maybe list of SPs used |

**Output:** Credentials stored securely, user can unlock and use.

---

## Phase 6: Demo SP — Scaffold

**Goal:** Example Service Provider app.

| Step | Task | Details |
|------|------|---------|
| 6.1 | Create `frontend/demo-sp/` | `npx create-next-app` |
| 6.2 | Add Tailwind, Lucide | Same as Master Wallet |
| 6.3 | Configure API URL | Point to backend |
| 6.4 | Define sp_id | e.g. `http://localhost:3001` (Demo SP's origin) |

**Output:** Demo SP app runs.

---

## Phase 7: Demo SP — ShieldLogin Button

**Goal:** SP can trigger auth flow.

| Step | Task | Details |
|------|------|---------|
| 7.1 | ShieldLogin button component | "Login with ShieldLogin" |
| 7.2 | Open Master Wallet | `window.open()` to Master Wallet with `?sp_id=...&return_url=...` |
| 7.3 | Or embedded flow | Iframe or popup; Master Wallet posts credential back |
| 7.4 | Receive credential | `postMessage` or URL callback with `{ proof, nullifier, commitment }` |

**Output:** Clicking button opens Master Wallet, user approves, credential returns to SP.

---

## Phase 8: Demo SP — Verify & Logged-in State

**Goal:** SP verifies credential and shows logged-in UI.

| Step | Task | Details |
|------|------|---------|
| 8.1 | Call `POST /verify/credential` | Send proof, nullifier, commitment, nonce, sp_id |
| 8.2 | Handle success | Store "logged in" state (e.g. React state, cookie) |
| 8.3 | Handle failure | Show error message |
| 8.4 | Logged-in UI | Show user as authenticated (e.g. "Welcome", logout button) |

**Output:** Full end-to-end flow working.

---

## Phase 9: Integration & Polish

**Goal:** Wire everything together.

| Step | Task | Details |
|------|------|---------|
| 9.1 | Nonce flow | SP gets nonce before opening Master Wallet; passes to Master Wallet |
| 9.2 | CORS | Ensure backend allows frontend origins |
| 9.3 | Error handling | User-friendly messages |
| 9.4 | Loading states | Spinners, disabled buttons during API calls |

**Output:** Smooth, working demo.

---

## Dependency Graph

```
Phase 1 (Crypto) ──────┬──────────────────────────────────────┐
                      │                                      │
                      ▼                                      ▼
Phase 2 (MW scaffold) ──► Phase 3 (Register) ──► Phase 4 (Login flow)
                      │                                      │
                      │                                      │
Phase 6 (SP scaffold) ──► Phase 7 (Button) ──► Phase 8 (Verify)
                      │                                      │
                      └──────────────┬───────────────────────┘
                                     │
                                     ▼
                            Phase 9 (Integration)
```

---

## Suggested Execution Order

1. **Phase 1** — Shared crypto (needed by both apps)
2. **Phase 2 + 3** — Master Wallet scaffold + registration
3. **Phase 4** — Master Wallet login flow
4. **Phase 5** — Storage & UX (can overlap with 4)
5. **Phase 6 + 7** — Demo SP scaffold + ShieldLogin button
6. **Phase 8** — Verify & logged-in state
7. **Phase 9** — Integration & polish

---

## Project Structure (Current)

```
frontend/
├── shared/
│   └── crypto/
│       ├── semaphoreZK.ts    # ZK proof generation
│       ├── gauth.ts          # Ed25519, pseudonym
│       ├── childCredential.ts
│       ├── hkdf.ts
│       ├── utils.ts
│       └── index.ts
└── master-wallet/
    ├── app/
    │   ├── page.tsx          # Create identity
    │   ├── login/page.tsx    # Register + Login to SP
    │   └── layout.tsx
    └── lib/
        └── api.ts
```

---

## References

- **Backend API**: See [SHIELDLOGIN_OVERVIEW.md](SHIELDLOGIN_OVERVIEW.md)
- **Testing**: See [TESTING.md](TESTING.md)
