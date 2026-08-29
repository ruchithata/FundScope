# FundScope

FundScope is a full-stack web application for government spending and development analysis.

## Current scope (PR 01 — Project Foundation)

This PR sets up the project foundation only:
- Frontend scaffold with React + Vite (`/frontend`)
- Backend scaffold with FastAPI (`/backend`)
- Basic health-check endpoint (`GET /health`)
- Environment variable templates (`.env.example`, `frontend/.env.example`, `backend/.env.example`)
- Basic backend health endpoint test

Out of scope for this PR:
- Real data ingestion
- Analytics/statistics pipeline
- Dashboard features
- Database models beyond initial dependency setup

## Repository structure

```text
frontend/            # React + Vite frontend foundation
backend/             # FastAPI backend foundation
  app/main.py        # API app and health endpoint
  tests/test_health.py
```

## Prerequisites

- Node.js 20+
- Python 3.12+

## Frontend setup

```bash
cd /home/runner/work/FundScope/FundScope/frontend
npm install
npm run dev
```

Frontend runs at `http://127.0.0.1:5173` by default.

## Backend setup

```bash
cd /home/runner/work/FundScope/FundScope
python -m pip install -r backend/requirements-dev.txt
cd backend
python -m uvicorn app.main:app --reload
```

Backend runs at `http://127.0.0.1:8000` by default.

## Health check

Once backend is running:

```bash
curl http://127.0.0.1:8000/health
```

Expected response:

```json
{"status":"ok"}
```

## Backend test

```bash
cd /home/runner/work/FundScope/FundScope/backend
python -m pytest tests/test_health.py
```
