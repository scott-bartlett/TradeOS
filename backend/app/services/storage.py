"""
Storage Service — Cloudflare R2
--------------------------------
All media storage goes through this interface.
Photos never touch PostgreSQL — only the R2 URL is stored in the database.

Swappable: change to AWS S3 by updating this file only.
"""

import boto3
import uuid
import httpx
from botocore.config import Config
from app.config import get_settings

settings = get_settings()


def _get_client():
    """
    R2 uses the S3-compatible API.
    boto3 works with R2 by pointing at Cloudflare's endpoint.
    """
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_photo(
    file_bytes: bytes,
    content_type: str,
    job_id: str,
    photo_type: str = "equipment"
) -> dict:
    """
    Upload a photo to Cloudflare R2.
    
    Args:
        file_bytes:   Raw image bytes
        content_type: MIME type (image/jpeg, image/png, etc.)
        job_id:       Job UUID — used to organize photos in R2
        photo_type:   equipment|site|completed|change_order
    
    Returns:
        dict with r2_key and public_url
    """
    client = _get_client()

    # Generate a unique key: jobs/{job_id}/{photo_type}/{uuid}.jpg
    extension = content_type.split("/")[-1]
    r2_key = f"jobs/{job_id}/{photo_type}/{uuid.uuid4()}.{extension}"

    client.put_object(
        Bucket=settings.r2_bucket_name,
        Key=r2_key,
        Body=file_bytes,
        ContentType=content_type,
    )

    public_url = f"{settings.r2_public_url}/{r2_key}"

    return {
        "r2_key": r2_key,
        "public_url": public_url,
    }


def delete_photo(r2_key: str) -> bool:
    """
    Delete a photo from R2.
    Called when a job photo is removed.
    
    Returns:
        True if deleted, False if error
    """
    try:
        client = _get_client()
        client.delete_object(
            Bucket=settings.r2_bucket_name,
            Key=r2_key
        )
        return True
    except Exception:
        return False


def get_presigned_upload_url(
    job_id: str,
    photo_type: str,
    content_type: str,
    expires_in: int = 300
) -> dict:
    """
    Generate a presigned URL for direct browser-to-R2 upload.
    The frontend uses this URL to upload directly — the file never passes through the API.
    Much faster for large photos.
    
    Args:
        job_id:       Job UUID
        photo_type:   equipment|site|completed|change_order
        content_type: image/jpeg or image/png
        expires_in:   Seconds until URL expires (default 5 minutes)
    
    Returns:
        dict with upload_url and r2_key
    """
    client = _get_client()

    extension = content_type.split("/")[-1]
    r2_key = f"jobs/{job_id}/{photo_type}/{uuid.uuid4()}.{extension}"

    upload_url = client.generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.r2_bucket_name,
            "Key": r2_key,
            "ContentType": content_type,
        },
        ExpiresIn=expires_in,
    )

    return {
        "upload_url": upload_url,
        "r2_key": r2_key,
        "public_url": f"{settings.r2_public_url}/{r2_key}",
    }
