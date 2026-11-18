from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine

try:
    with engine.connect() as connection:
        result = connection.execute(text("SELECT 1"))
        print("Database connection successful!")
        print("Result:", result.scalar())

except SQLAlchemyError as e:
    print("Database connection failed!")
    print(e)
