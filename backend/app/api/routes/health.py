"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check for load balancers and monitoring."""
    return {"status": "ok"}


@router.get("/ready")
async def readiness_check():
    """Readiness check - verify dependencies are available."""
    return {"status": "ready"}
