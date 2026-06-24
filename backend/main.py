from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import health, jobs, photos, customers, invoices, change_orders, users, van_inventory

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
app.include_router(jobs.router,          prefix="/api/jobs",          tags=["jobs"])
app.include_router(photos.router,        prefix="/api/photos",        tags=["photos"])
app.include_router(customers.router,     prefix="/api/customers",     tags=["customers"])
app.include_router(invoices.router,      prefix="/api/invoices",      tags=["invoices"])
app.include_router(change_orders.router, prefix="/api/change-orders", tags=["change-orders"])
app.include_router(users.router,         prefix="/api/users",         tags=["users"])
app.include_router(van_inventory.router, prefix="/api/van-inventory", tags=["van-inventory"])

@app.get("/")
def root():
    return {"message": "TradeOS API is running", "version": "0.1.0"}
