from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.config import get_settings

settings = get_settings()
engine_kwargs = {"pool_pre_ping": True, "pool_recycle": 1800}
if settings.database_url.startswith("sqlite"):
    engine = create_engine(settings.database_url, **engine_kwargs)
else:
    engine = create_engine(
        settings.database_url,
        pool_size=settings.db_pool_size,
        max_overflow=settings.db_max_overflow,
        **engine_kwargs,
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()
