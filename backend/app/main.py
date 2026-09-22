from fastapi import FastAPI

from app.api.analytics import router as analytics_router


app = FastAPI(
    title="FundScope API",
    description=(
        "Evidence-first public finance explorer for "
        "Indian government spending."
    ),
    version="0.2.0",
)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(analytics_router)
