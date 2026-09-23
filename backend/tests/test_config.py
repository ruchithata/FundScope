from app.config import Settings

def test_settings_parse_cors_origins():
    settings = Settings(DATABASE_URL="sqlite://", CORS_ORIGINS="http://localhost:5173, http://localhost:3000")
    assert [o.strip() for o in settings.cors_origins.split(",") if o.strip()] == ["http://localhost:5173", "http://localhost:3000"]

def test_settings_defaults():
    settings = Settings(DATABASE_URL="sqlite://")
    assert settings.api_prefix == "/api"
    assert settings.db_pool_size == 5
    assert settings.db_max_overflow == 10
