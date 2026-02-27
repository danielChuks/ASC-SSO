"""Database connection and session management."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker


from app.config import Settings
from app.models.registry import Base

settings = Settings.load()

engine = create_engine(settings.database_url,)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """Dependency that yields a database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        with engine.connect() as conn:
            print("Database connected successfully!")
        Base.metadata.create_all(bind=engine)
        print("Tables created (if not exist)")
    except Exception as e:
        print(f"Database connection failed: {e}")
        raise
    yield