"""
startups/router.py — Startup CRUD API endpoints.

Routes:
    POST   /startups/         → create startup
    GET    /startups/         → list user's startups
    GET    /startups/{id}     → get one startup
    PATCH  /startups/{id}     → update startup
    DELETE /startups/{id}     → soft-delete startup
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.database import get_db
from backend.models.user import User
from backend.startups.schemas import (
    CreateStartupRequest,
    StartupResponse,
    UpdateStartupRequest,
)
from backend.startups.service import (
    create_startup,
    delete_startup,
    get_startup,
    list_startups,
    update_startup,
)

router = APIRouter(prefix="/startups", tags=["startups"])


@router.post("/", response_model=dict, status_code=status.HTTP_201_CREATED)
async def create(
    body: CreateStartupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Create a new startup for the authenticated user."""
    startup = await create_startup(db, current_user.id, body.name, body.description)
    return {
        "ok": True,
        "data": StartupResponse.model_validate(startup).model_dump(),
    }


@router.get("/", response_model=dict)
async def list_all(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List all startups owned by the authenticated user, paginated."""
    startups, total = await list_startups(db, current_user.id, page, limit)
    return {
        "ok": True,
        "data": [StartupResponse.model_validate(s).model_dump() for s in startups],
        "total": total,
        "page": page,
    }


@router.get("/{startup_id}", response_model=dict)
async def get_one(
    startup_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get a single startup by ID. Returns 404 if not found or not owned."""
    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")
    return {
        "ok": True,
        "data": StartupResponse.model_validate(startup).model_dump(),
    }


@router.patch("/{startup_id}", response_model=dict)
async def update(
    startup_id: uuid.UUID,
    body: UpdateStartupRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Partially update a startup. Only provided fields are changed."""
    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")

    updated = await update_startup(
        db,
        startup,
        name=body.name,
        description=body.description,
        custom_domain=body.custom_domain,
        settings=body.settings,
    )
    await db.refresh(updated)
    return {
        "ok": True,
        "data": StartupResponse.model_validate(updated).model_dump(),
    }


@router.delete("/{startup_id}", response_model=dict)
async def delete(
    startup_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Soft-delete a startup. Data is retained for audit trail."""
    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Startup not found")

    await delete_startup(db, startup)
    return {"ok": True}
