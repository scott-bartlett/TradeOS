from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, jobs, photos, customers, invoices

app = FastAPI(
    title="TradeOS API",
    description="AI-first operating system for skilled trades businesses",
    version="0.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(jobs.router,      prefix="/api/jobs",      tags=["jobs"])
app.include_router(photos.router,    prefix="/api/photos",    tags=["photos"])
app.include_router(customers.router, prefix="/api/customers", tags=["customers"])
app.include_router(invoices.router,  prefix="/api/invoices",  tags=["invoices"])

@app.get("/")
def root():
    return {"message": "TradeOS API is running", "version": "0.1.0"}
