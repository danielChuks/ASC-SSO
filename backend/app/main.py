"""ShieldLogin Backend - FastAPI application entry point."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import Settings
from app.database import lifespan
from app.api.routes import auth, dao, health, verify, registry

settings = Settings.load()



app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    description="U2SSO credential verification and OIDC/SIOP auth",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(auth.router, prefix=f"{settings.api_prefix}/auth", tags=["auth"])
app.include_router(verify.router, prefix=f"{settings.api_prefix}/verify", tags=["verify"])
app.include_router(registry.router, prefix=f"{settings.api_prefix}/registry", tags=["registry"])
app.include_router(dao.router, prefix=f"{settings.api_prefix}/dao", tags=["dao"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {"message": "ShieldLogin Backend", "docs": "/docs"}
