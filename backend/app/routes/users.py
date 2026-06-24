"""
User Routes
-----------
User management — owners, office managers, technicians.

  POST /api/users/                  — create user
  GET  /api/users/                  — list all users
  GET  /api/users/{user_id}         — get user detail
  GET  /api/users/role/{role}       — get users by role
  PATCH /api/users/{user_id}        — update user
"""

from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
import uuid

from app.database import get_db
from app.models.user import User, UserRole

router = APIRouter()


class UserCreate(BaseModel):
    clerk_id: str
    email: str
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: str = "tech"


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.post("/")
async def create_user(
    data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create a new user."""
    # Check if clerk_id already exists
    existing = await db.execute(
        select(User).where(User.clerk_id == data.clerk_id)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="User with this clerk_id already exists")

    user = User(
        clerk_id=data.clerk_id,
        email=data.email,
        first_name=data.first_name,
        last_name=data.last_name,
        phone=data.phone,
        role=UserRole(data.role),
        is_active=True
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {
        "user_id": str(user.id),
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "message": "User created successfully"
    }


@router.get("/")
async def list_users(
    db: AsyncSession = Depends(get_db)
):
    """List all active users."""
    result = await db.execute(
        select(User)
        .where(User.is_active == True)
        .order_by(User.first_name)
    )
    users = result.scalars().all()

    return {
        "users": [
            {
                "user_id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "phone": u.phone,
                "is_active": u.is_active,
            }
            for u in users
        ],
        "total": len(users)
    }


@router.get("/role/{role}")
async def get_users_by_role(
    role: str,
    db: AsyncSession = Depends(get_db)
):
    """Get all users with a specific role."""
    try:
        user_role = UserRole(role)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid role '{role}'. Valid roles: owner, office, tech"
        )

    result = await db.execute(
        select(User)
        .where(User.role == user_role, User.is_active == True)
        .order_by(User.first_name)
    )
    users = result.scalars().all()

    return {
        "role": role,
        "users": [
            {
                "user_id": str(u.id),
                "email": u.email,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "phone": u.phone,
            }
            for u in users
        ],
        "total": len(users)
    }


@router.get("/{user_id}")
async def get_user(
    user_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Get user detail."""
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return {
        "user_id": str(user.id),
        "clerk_id": user.clerk_id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "role": user.role,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat()
    }


@router.patch("/{user_id}")
async def update_user(
    user_id: str,
    data: UserUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Update user fields."""
    result = await db.execute(
        select(User).where(User.id == uuid.UUID(user_id))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = data.model_dump(exclude_none=True)
    if "role" in update_data:
        update_data["role"] = UserRole(update_data["role"])

    for field, value in update_data.items():
        setattr(user, field, value)

    await db.commit()

    return {
        "user_id": user_id,
        "message": "User updated successfully"
    }
