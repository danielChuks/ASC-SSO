"""OIDC/SIOP authentication endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/config")
async def auth_config():
    """Return OIDC/SIOP discovery configuration."""
    return {
        "issuer": "shieldlogin",
        "authorization_endpoint": "/api/v1/auth/authorize",
        "token_endpoint": "/api/v1/auth/token",
    }


@router.get("/authorize")
async def authorize():
    """SIOP authorization flow - placeholder."""
    return {"message": "SIOP authorize - to be implemented"}


@router.post("/token")
async def token():
    """Token endpoint - placeholder."""
    return {"message": "Token - to be implemented"}
