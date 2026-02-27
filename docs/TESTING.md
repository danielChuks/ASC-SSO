# How to Test the ShieldLogin Backend

This guide explains how to test the backend API for the U2SSO credential flow.

---

## Prerequisites

1. **Start the backend server**
   ```bash
   cd backend
   source venv/bin/activate   # or: source .venv/bin/activate
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Database** — Ensure PostgreSQL is running and `DATABASE_URL` is set in `backend/.env`

3. **Base URL** — All examples use `http://localhost:8000`

---

## Key Terms

| Term | Description |
|------|-------------|
| **msk** | Master secret key — the user's root secret. Never sent to the backend. Used to derive commitment, nullifier, and proof. |
| **commitment** | Public hash of msk (`SHA256(msk)`). Stored in the Identity Registry. |
| **nullifier** | Per-SP value derived from msk. Prevents Sybil attacks (one identity per SP). |
| **proof** | HMAC over (nonce, sp_id) proving the user knows msk. Created per auth attempt. |
| **nonce** | One-time challenge from the backend. Expires in 5 minutes. |

---

## Test Flow Overview

The full authentication flow has 4 steps:

1. **Register** — User registers their commitment (public identity) in the Identity Registry
2. **Get nonce** — Service Provider requests a one-time challenge from the backend
3. **Create proof** — User creates proof + nullifier from their master secret
4. **Verify** — SP sends proof to backend; backend validates and stores nullifier

---

## Method 1: Automated Python Script

The simplest way to test the full flow:

```bash
cd backend
pip install -r requirements.txt
python test_flow.py
```

**What it does:**
- Registers a test commitment
- Gets a nonce
- Creates proof and nullifier using the crypto module
- Verifies the credential
- Tests Sybil resistance (second attempt with same nullifier is rejected)

**Expected output:** `✅ All tests passed!`

---

## Method 2: Manual Testing with curl

Follow these steps in order.

### Step 1: Generate commitment and nullifier

*Use the same `msk` value in all steps below.*

```bash
cd backend
python3 -c "
from app.core.crypto import commitment_from_secret, derive_nullifier
msk = 'my-secret-key'
sp_id = 'https://demo.example.com'
print('commitment:', commitment_from_secret(msk))
print('nullifier:', derive_nullifier(msk, sp_id))
"
```

Save the `commitment` and `nullifier` values.

### Step 2: Register the commitment

```bash
curl -X POST http://localhost:8000/api/v1/registry/register \
  -H "Content-Type: application/json" \
  -d '{"commitment": "PASTE_COMMITMENT_HERE"}'
```

Expected: `{"id":"...","commitment":"...","status":"registered"}`

### Step 3: Get a nonce

```bash
curl "http://localhost:8000/api/v1/verify/nonce?sp_id=https://demo.example.com"
```

Expected: `{"nonce":"...","sp_id":"https://demo.example.com","expires_in":300}`

Copy the `nonce` value.

### Step 4: Generate the proof

*Use the same `msk` as in Step 1. Replace `PASTE_NONCE_FROM_STEP3` with the nonce from Step 3.*

```bash
python3 -c "
from app.core.crypto import create_proof
msk = 'my-secret-key'
sp_id = 'https://demo.example.com'
nonce = 'PASTE_NONCE_FROM_STEP3'
print(create_proof(msk, sp_id, nonce))
"
```

Copy the proof value.

### Step 5: Verify the credential

```bash
curl -X POST http://localhost:8000/api/v1/verify/credential \
  -H "Content-Type: application/json" \
  -d '{
    "sp_id": "https://demo.example.com",
    "nonce": "PASTE_NONCE",
    "proof": "PASTE_PROOF",
    "nullifier": "PASTE_NULLIFIER",
    "commitment": "PASTE_COMMITMENT"
  }'
```

Expected: `{"verified":true,"message":"Credential verified successfully"}`

---

## Method 3: Swagger UI (Interactive Docs)

Open **http://localhost:8000/docs** and follow these steps:

### Step 1: Register commitment

- Endpoint: `POST /api/v1/registry/register`
- Request body:
  ```json
  {"commitment": "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae"}
  ```
- *(This commitment is for msk `test123`. For a custom msk, run: `python3 -c "from app.core.crypto import commitment_from_secret; print(commitment_from_secret('your-msk'))"`)*

### Step 2: Get nonce

- Endpoint: `GET /api/v1/verify/nonce`
- Add parameter: `sp_id` = `https://demo.example.com`
- Copy the `nonce` from the response

### Step 3: Generate proof and nullifier

Run in terminal (replace `PASTE_NONCE` with the nonce from Step 2):

```bash
cd backend
python3 -c "
from app.core.crypto import derive_nullifier, create_proof
msk = 'test123'
sp_id = 'https://demo.example.com'
nonce = 'PASTE_NONCE'
print('nullifier:', derive_nullifier(msk, sp_id))
print('proof:', create_proof(msk, sp_id, nonce))
"
```

### Step 4: Verify credential

- Endpoint: `POST /api/v1/verify/credential`
- Request body (paste values from Steps 1–3):
  ```json
  {
    "sp_id": "https://demo.example.com",
    "nonce": "<from Step 2>",
    "proof": "<from Step 3>",
    "nullifier": "<from Step 3>",
    "commitment": "ecd71870d1963316a97e3ac3408c9835ad8cf0f3c1bc703527c30265534f75ae"
  }
  ```
- Expected: `{"verified": true, "message": "Credential verified successfully"}`

---

## Validation Tests (Error Cases)

Verify the backend correctly rejects invalid requests:

| Test | How to trigger | Expected response |
|------|----------------|-------------------|
| Unknown commitment | Use a random commitment string | `400` — "Commitment not found in registry" |
| Duplicate nullifier | Run verify twice with same nullifier (get new nonce each time) | `400` — "Nullifier already used for this SP" |
| Reused nonce | Use same nonce in two verify requests | `400` — "Nonce already used (replay attack)" |
| Expired nonce | Wait 5+ minutes after getting nonce, then verify | `400` — "Nonce expired" |

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/registry/register` | Register a commitment |
| GET | `/api/v1/registry/check/{commitment}` | Check if commitment exists |
| GET | `/api/v1/verify/nonce?sp_id=...` | Get a nonce for auth (5 min TTL) |
| POST | `/api/v1/verify/credential` | Verify credential (proof + nullifier + commitment) |

---

## Troubleshooting

- **Connection refused** — Ensure the server is running on port 8000
- **Database connection failed** — Check `DATABASE_URL` in `.env` and that PostgreSQL is running
- **Import errors** — Run from `backend/` directory and ensure venv is activated



