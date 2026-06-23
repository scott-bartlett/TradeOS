from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, jobs, photos

app = FastAPI(
    title="TradeOS API",
    description="AI-first operating system for skilled trades businesses",
    version="0.1.0"
)

# CORS — allows the frontend to talk to the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Lock this down before production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routes
app.include_router(health.router)
app.include_router(jobs.router, prefix="/api/jobs", tags=["jobs"])
app.include_router(photos.router, prefix="/api/photos", tags=["photos"])

@app.get("/")
def root():
    return {"message": "TradeOS API is running", "version": "0.1.0"}
