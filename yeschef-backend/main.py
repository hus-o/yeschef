from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import ingest, live

app = FastAPI(title="YesChef Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health_check():
    return {"status": "ok"}

app.include_router(ingest.router)
app.include_router(live.router)

