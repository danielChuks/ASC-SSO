# ShieldLogin Backend

FastAPI backend for U2SSO credential verification and OIDC/SIOP auth.

## Setup

```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate   # Linux/macOS
# .venv\Scripts\activate    # Windows

# Install dependencies
pip install -r requirements.txt

# Optional: copy env template
cp .env.example .env
```

## Run

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

- **API docs:** http://localhost:8000/docs
- **Health:** http://localhost:8000/health

## Endpoints

| Path | Description |
|------|-------------|
| `GET /` | Root |
| `GET /health` | Health check |
| `GET /ready` | Readiness check |
| `POST /api/v1/registry/register` | Register a commitment |
| `GET /api/v1/registry/check/{commitment}` | Check if commitment exists |
| `GET /api/v1/verify/nonce?sp_id=...` | Get nonce for auth flow |
| `POST /api/v1/verify/credential` | Verify child credential |
| `GET /api/v1/auth/config` | OIDC/SIOP config |
| `POST /api/v1/verify/credential` | Credential verification |

## Database

Uses PostgreSQL. Set `DATABASE_URL` in `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/shieldlogin
```

Create the database before first run:

```sql
CREATE DATABASE shieldlogin;
```
