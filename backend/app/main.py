from fastapi import FastAPI

app = FastAPI(
    title="FundScope API",
    description="Evidence-first public finance explorer for Indian government spending.",
    version="0.1.0",
)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
