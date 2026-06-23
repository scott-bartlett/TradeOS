from fastapi import APIRouter

router = APIRouter()

@router.post("/upload")
async def upload_photo():
    """Photo upload to R2 — stub, full implementation coming in Phase 1"""
    return {"message": "Photo upload endpoint ready"}

@router.post("/analyze/{job_id}")
async def analyze_photos(job_id: str):
    """Trigger AI photo analysis for a job — stub"""
    return {"job_id": job_id, "message": "Photo analysis endpoint ready"}
