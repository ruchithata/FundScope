from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.analytics import router as analytics_router
from app.config import get_settings
from app.schemas import ErrorResponse, HealthResponse

settings = get_settings()
app = FastAPI(title=settings.app_name, description="Evidence-first public finance explorer for Indian government spending.", version=settings.app_version, responses={400: {"model": ErrorResponse}, 422: {"model": ErrorResponse}, 500: {"model": ErrorResponse}})

cors_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if cors_origins:
    app.add_middleware(CORSMiddleware, allow_origins=cors_origins, allow_credentials=True, allow_methods=["GET", "OPTIONS"], allow_headers=["*"])

@app.get("/health", response_model=HealthResponse, tags=["system"])
def health_check() -> HealthResponse:
    return HealthResponse(status="ok")

app.include_router(analytics_router)
