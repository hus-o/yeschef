from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ingest, live

app = FastAPI(
    title="YesChef Backend",
    version="1.0.0",
    description="AI-powered recipe extraction and cooking assistant API",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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

