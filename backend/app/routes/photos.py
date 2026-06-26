"""
Photo Routes
------------
Handles photo upload to Cloudflare R2 and AI analysis via Claude Vision.

Flow 0 — Win the Job:
  POST /api/photos/upload/{job_id}     — upload photo to R2
  POST /api/photos/analyze/{job_id}    — trigger AI analysis on job photos
  GET  /api/photos/presigned/{job_id}  — get direct upload URL for browser
  GET  /api/photos/{job_id}            — list all photos for a job
  DELETE /api/photos/{photo_id}        — remove a photo
"""

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import uuid

from app.database import get_db
from app.models.supply_and_field import JobPhoto, PhotoType
from app.models.job import Job
from app.services import storage, ai_provider

router = APIRouter()

ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/jpg"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/upload/{job_id}")
async def upload_photo(
    job_id: str,
    photo_type: str = "equipment",
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """Upload a photo to Cloudflare R2 and create a JobPhoto record."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if file.content_type not in ALLOWED_CONTENT_TYPES:
        raise HTTPException(status_code=400, detail=f"File type {file.content_type} not allowed.")

    file_bytes = await file.read()

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")

    upload_result = storage.upload_photo(
        file_bytes=file_bytes,
        content_type=file.content_type,
        job_id=job_id,
        photo_type=photo_type
    )

    photo = JobPhoto(
        job_id=uuid.UUID(job_id),
        r2_key=upload_result["r2_key"],
        public_url=upload_result["public_url"],
        photo_type=PhotoType(photo_type),
        client_uuid=str(uuid.uuid4()),
        ai_analyzed=False
    )
    db.add(photo)
    await db.commit()
    await db.refresh(photo)

    return {
        "photo_id": str(photo.id),
        "r2_key": photo.r2_key,
        "public_url": photo.public_url,
        "photo_type": photo_type,
        "message": "Photo uploaded successfully"
    }


@router.get("/presigned/{job_id}")
async def get_presigned_url(
    job_id: str,
    photo_type: str = "equipment",
    content_type: str = "image/jpeg",
    db: AsyncSession = Depends(get_db)
):
    """Get a presigned URL for direct browser-to-R2 upload."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    presigned = storage.get_presigned_upload_url(
        job_id=job_id,
        photo_type=photo_type,
        content_type=content_type
    )
    return presigned


@router.post("/analyze/{job_id}")
async def analyze_job_photos(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Trigger AI analysis on all unanalyzed equipment photos for a job."""
    result = await db.execute(select(Job).where(Job.id == uuid.UUID(job_id)))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    photos_result = await db.execute(
        select(JobPhoto).where(
            JobPhoto.job_id == uuid.UUID(job_id),
            JobPhoto.photo_type == PhotoType.equipment,
            JobPhoto.ai_analyzed == False
        )
    )
    photos = photos_result.scalars().all()

    if not photos:
        if job.ai_analysis:
            return {"analysis": job.ai_analysis, "message": "Using existing analysis"}
        raise HTTPException(status_code=404, detail="No equipment photos found for this job")

    primary_photo = photos[0]
    analysis = await ai_provider.analyze_photo(primary_photo.public_url)

    job.ai_analysis = analysis
    await db.commit()

    for photo in photos:
        photo.ai_analyzed = True
    await db.commit()

    return {
        "job_id": job_id,
        "photos_analyzed": len(photos),
        "analysis": analysis
    }


@router.get("/{job_id}")
async def list_job_photos(
    job_id: str,
    db: AsyncSession = Depends(get_db)
):
    """List all photos for a job."""
    result = await db.execute(
        select(JobPhoto).where(JobPhoto.job_id == uuid.UUID(job_id))
    )
    photos = result.scalars().all()

    return {
        "job_id": job_id,
        "photos": [
            {
                "photo_id": str(p.id),
                "public_url": p.public_url,
                "photo_type": p.photo_type,
                "ai_analyzed": p.ai_analyzed,
                "created_at": p.created_at.isoformat()
            }
            for p in photos
        ]
    }


@router.delete("/{photo_id}")
async def delete_photo(
    photo_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Delete a photo from R2 and remove the database record."""
    result = await db.execute(
        select(JobPhoto).where(JobPhoto.id == uuid.UUID(photo_id))
    )
    photo = result.scalar_one_or_none()
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")

    storage.delete_photo(photo.r2_key)
    await db.delete(photo)
    await db.commit()

    return {"message": "Photo deleted successfully"}
