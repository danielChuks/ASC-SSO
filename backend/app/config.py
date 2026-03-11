"""Application configuration using Pydantic Settings."""
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings loaded from environment variables."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @classmethod
    def load(cls) -> "Settings":
        """Load and return settings instance."""
        return cls()

    app_name: str = "ShieldLogin Backend"
    debug: bool = False

    # API
    api_prefix: str = "/api/v1"

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    # Database - from DATABASE_URL env var (set in .env)
    database_url: str = ""

    # On-chain IdR (optional). When set, commitments use Solidity contract instead of PostgreSQL.
    idr_contract_address: str = ""
    eth_rpc_url: str = "http://127.0.0.1:8545"
    idr_deployer_key: str = ""  # Private key for addCommitment (write) transactions

    @field_validator("database_url", mode="after")
    @classmethod
    def database_url_required(cls, v: str) -> str:
        if not v:
            raise ValueError("DATABASE_URL must be set in .env")
        return v

    @property
    def use_idr_contract(self) -> bool:
        """True if on-chain IdR is configured."""
        return bool(self.idr_contract_address and self.eth_rpc_url)
