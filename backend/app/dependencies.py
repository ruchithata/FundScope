from collections.abc import Generator

from sqlalchemy.orm import Session

from app.database import SessionLocal


def get_db() -> Generator[Session, None, None]:
    """
    Provide a database session for a single request.

    The session is always closed after the request completes.
    """
    db = SessionLocal()

    try:
        yield db
    finally:
        db.close()
