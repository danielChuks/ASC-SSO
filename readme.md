# ShieldLogin (U2SSO)

## The Core Idea

You want to log in to websites **without** giving them your real identity. ShieldLogin does this by:

1. Creating a secret only you know (the **master secret key**, `msk`)
2. Deriving public values from it that prove you know `msk`, without revealing it

---

## What Each Side Knows

| Who | What they know |
|-----|----------------|
| **You (browser)** | Your `msk` – the secret only you have |
| **Backend server** | Public values you send it – commitment, nullifier, proof – but **never** your `msk` |

The backend is not trusted with your secret. It only checks that the values you send are valid.

---

## Step-by-Step Flow

### 1. Registration (create identity)

```
You (browser):  msk = "random secret 123..."  (stored only on your device)
You (browser):  commitment = SHA256(msk)      → "a1b2c3d4..."
You (browser):  Send commitment to backend
Backend:        Stores commitment in database
```

- The backend only ever sees `commitment`, not `msk`.
- It cannot reverse `commitment` to get `msk`.

### 2. Login to a site (e.g. demo.example.com)

```
You (browser):  Get nonce from backend (a random challenge)
You (browser):  nullifier = derive(msk, "demo.example.com")   → unique per site
You (browser):  proof = sign(msk, nonce, "demo.example.com")  → proves you know msk
You (browser):  Send nullifier, proof, commitment to backend
Backend:        Checks: commitment exists? proof format OK? nullifier not reused?
Backend:        If all OK → "logged in"
```

- All crypto that uses `msk` happens in your browser.
- The backend only checks the values you send; it never computes them from `msk`.

---

## Why the Frontend Needs Crypto

If the frontend didn't have crypto:

- The backend would need `msk` to compute nullifier and proof.
- That would mean sending `msk` to the server.
- Anyone who compromises the server would get everyone's secrets.

**So the design is:**

- **Frontend:** Has `msk`, computes commitment, nullifier, proof.
- **Backend:** Never sees `msk`, only verifies what you send.

---

## Why Both Sides Have Similar Code

- **Backend (Python):** Defines the rules (how commitment, nullifier, proof are computed) and verifies them.
- **Frontend (TypeScript):** Implements the same rules so it can produce values the backend will accept.

They must use the same algorithms (e.g. SHA256, HKDF, HMAC) so the backend's checks succeed.

---

## Simple Analogy

| Term | Meaning |
|------|---------|
| `msk` | Your house key (only you have it) |
| `commitment` | A public "fingerprint" of that key (you can show it, but no one can get the key from it) |
| `proof` | A signature that shows you know the key, without handing it over |

The frontend crypto is what lets you create that fingerprint and signature without ever giving the key to the server.
