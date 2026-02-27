# ShieldLogin Frontend Implementation Roadmap

A step-by-step guide to build the Master Wallet and Demo SP frontends.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND COMPONENTS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────────────┐              ┌─────────────────────┐              │
│   │   Master Wallet      │              │   Demo SP           │              │
│   │   (User app)         │              │   (Service Provider) │              │
│   │                      │              │                     │              │
│   │ • Generate msk       │   credential │ • ShieldLogin btn   │              │
│   │ • Register           │ ───────────► │ • Get nonce         │              │
│   │ • Create proof       │              │ • Call verify       │              │
│   │ • Store credentials  │              │ • Show logged-in    │              │
│   └─────────────────────┘              └─────────────────────┘              │
│            │                                        │                        │
│            │                                        │                        │
│            └────────────────┬───────────────────────┘                        │
│                             │                                                 │
│                             ▼                                                 │
│                    ┌─────────────────┐                                        │
│                    │  Backend API    │                                        │
│                    │  (FastAPI)      │                                        │
│                    └─────────────────┘                                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

| Choice | Purpose |
|--------|---------|
| **Next.js** | React framework, SSR, routing |
| **Tailwind CSS** | Styling |
| **Lucide React** | Icons |
| **Shared crypto** | Port hash-based logic to TypeScript/JavaScript |

---

## Phase 1: Shared Crypto Library

**Goal:** Reuse backend crypto logic in the browser.

| Step | Task | Details |
|------|------|---------|
| 1.1 | Create `frontend/shared/crypto/` | Shared package or folder |
| 1.2 | Port `commitment_from_secret` | SHA256 in browser: `crypto.subtle.digest` or `crypto-js` |
| 1.3 | Port `derive_nullifier` | HKDF: use `crypto.subtle` or `@noble/hashes` |
| 1.4 | Port `create_proof` | HMAC: `crypto.subtle.sign` or equivalent |
| 1.5 | Port `generate_nonce` | `crypto.getRandomValues` → hex string |

**Output:** Browser can compute commitment, nullifier, proof from msk.

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

## Phase 3: Master Wallet — Registration Flow

**Goal:** User can create identity and register.

| Step | Task | Details |
|------|------|---------|
| 3.1 | Generate msk | `crypto.getRandomValues()` → 32 bytes → hex or base64 |
| 3.2 | Compute commitment | Call `commitment_from_secret(msk)` |
| 3.3 | Call `POST /registry/register` | Send `{ commitment }` to backend |
| 3.4 | Store msk securely | Encrypt with user password, save to localStorage/IndexedDB |
| 3.5 | Registration UI | Page: "Create identity" → generate → register → store → success |

**Output:** User can register a new identity.

---

## Phase 4: Master Wallet — Login to SP Flow

**Goal:** User can authenticate to a site.

| Step | Task | Details |
|------|------|---------|
| 4.1 | "Login to SP" UI | Input: SP URL or sp_id (e.g. `https://demo-sp.example.com`) |
| 4.2 | Fetch nonce | `GET /verify/nonce?sp_id=...` |
| 4.3 | Load msk | Decrypt from storage (user enters password if encrypted) |
| 4.4 | Create proof + nullifier | `create_proof(msk, sp_id, nonce)`, `derive_nullifier(msk, sp_id)` |
| 4.5 | Return credential to SP | PostMessage, URL params, or redirect with credential payload |

**Output:** User can produce credential for any sp_id.

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

## Project Structure (Target)

```
frontend/
├── shared/
│   └── crypto/
│       ├── commitment.ts
│       ├── nullifier.ts
│       ├── proof.ts
│       └── index.ts
├── master-wallet/
│   ├── app/
│   │   ├── page.tsx          # Dashboard / Register
│   │   ├── login/page.tsx    # Login to SP flow
│   │   └── layout.tsx
│   ├── components/
│   └── lib/
│       └── storage.ts
└── demo-sp/
    ├── app/
    │   ├── page.tsx          # Landing + ShieldLogin
    │   └── layout.tsx
    └── components/
        └── ShieldLoginButton.tsx
```

---

## References

- **Backend API**: See [SHIELDLOGIN_OVERVIEW.md](SHIELDLOGIN_OVERVIEW.md)
- **Testing**: See [TESTING.md](TESTING.md)
