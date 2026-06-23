from fastapi import APIRouter
from datetime import datetime

router = APIRouter()

@router.get("/health", tags=["health"])
async def health_check():
    """
    Railway uses this endpoint to confirm the app is running.
    Always returns 200 if the API is up.
    """
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "service": "TradeOS API",
        "version": "0.1.0"
    }
