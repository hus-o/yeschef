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


from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

class ClientSecretMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        # 1. Allow health check without auth (optional, but good for load balancers)
        if request.url.path == "/health":
            return await call_next(request)

        # 2. Check for Origin header (Browser/CORS request)
        origin = request.headers.get("origin")
        if origin and any(allowed in origin for allowed in _allowed_origins):
             # Handled by CORSMiddleware
            return await call_next(request)

        # 3. If no valid Origin, require X-Client-Secret (Mobile/Backend-to-Backend)
        client_secret = os.environ.get("CLIENT_SECRET")
        if not client_secret:
            # If no secret is configured, we might decide to fail open or closed.
            # Closed is safer.
            return JSONResponse(status_code=500, content={"detail": "Server misconfiguration: CLIENT_SECRET not set"})
        
        request_secret = request.headers.get("x-client-secret")
        if request_secret != client_secret:
            return JSONResponse(status_code=403, content={"detail": "Forbidden: Invalid Client Secret"})

        return await call_next(request)

app.add_middleware(ClientSecretMiddleware)


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "yeschef-backend"}


# Ingest router: /extract, /jobs/{id}, /recipes, /recipes/{id}, /demo/recipes
app.include_router(ingest.router)

# Live router: /live/token, /live/sessions/{id}/summary
app.include_router(live.router)

