from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def list_jobs():
    """List all jobs — stub, full implementation coming in Phase 1"""
    return {"jobs": [], "message": "Jobs endpoint ready"}

@router.get("/{job_id}")
async def get_job(job_id: str):
    """Get a single job by ID — stub"""
    return {"job_id": job_id, "message": "Job detail endpoint ready"}
