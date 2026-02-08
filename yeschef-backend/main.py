import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ingest, live

app = FastAPI(
    title="YesChef Backend",
    version="1.0.0",
    description="AI-powered recipe extraction and cooking assistant API",
)

# CORS: only allow our frontend origins (+ localhost for dev)
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
_allowed_origins = [o.strip() for o in _allowed_origins if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "yeschef-backend"}


# Ingest router: /extract, /jobs/{id}, /recipes, /recipes/{id}, /demo/recipes
app.include_router(ingest.router)

# Live router: /live/token, /live/sessions/{id}/summary
app.include_router(live.router)

