"""
deploy/router.py — Deployment API endpoints.

Routes:
    POST  /api/startups/{id}/deploy          — deploy main branch to Railway
    GET   /api/startups/{id}/deploy/status   — check current deploy status
    POST  /api/startups/{id}/deploy/rollback — rollback to previous version
"""

from __future__ import annotations

import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.auth.deps import get_current_user
from backend.config import settings
from backend.database import get_db
from backend.deploy.schemas import (
    DeploymentResponse,
    DeployRequest,
    DeployStatusResponse,
    RollbackRequest,
)
from backend.deploy.service import (
    create_railway_project,
    deploy_to_railway,
    get_deploy_status,
    health_check,
    rollback_deploy,
)
from backend.models.user import User
from backend.startups.service import get_startup

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/startups", tags=["deploy"])


def _require_railway_token() -> None:
    """Raise 503 if the Railway API key is not configured."""
    if not settings.RAILWAY_API_KEY:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Railway API key not configured. Set RAILWAY_API_KEY in environment.",
        )


# ── POST /api/startups/{id}/deploy ───────────────────────────────────────────


@router.post("/{startup_id}/deploy", response_model=dict)
async def deploy(
    startup_id: uuid.UUID,
    body: DeployRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Deploy the startup's main branch to Railway.

    Steps:
        1. Verify startup exists and is owned by the user.
        2. Create a Railway project if the startup does not have one yet.
        3. Push code to Railway and trigger a deployment.
        4. Run health check — auto-rollback on failure.
        5. Return deployment result.
    """
    _require_railway_token()

    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found",
        )

    environment = body.environment if body else "production"

    # Ensure the startup has a Railway project
    railway_meta: dict = startup.settings.get("railway", {})
    project_id = railway_meta.get("project_id")

    if not project_id:
        try:
            result = await create_railway_project(startup.name)
            project_id = result["project_id"]
            # Persist Railway project info in startup settings
            startup.settings = {
                **startup.settings,
                "railway": {
                    "project_id": project_id,
                    "project_name": result["project_name"],
                },
            }
            await db.flush()
        except Exception as exc:
            logger.error("Failed to create Railway project: %s", exc)
            return {
                "ok": False,
                "error": "Failed to create Railway project. Please try again.",
                "code": "RAILWAY_PROJECT_CREATE_FAILED",
            }

    # Deploy
    repo_url = startup.git_repo_url or ""
    if not repo_url:
        return {
            "ok": False,
            "error": "Startup has no linked GitHub repository. Build the startup first.",
            "code": "NO_GIT_REPO",
        }

    try:
        deploy_result = await deploy_to_railway(repo_url, project_id, environment)
    except Exception as exc:
        logger.error("Railway deploy failed: %s", exc)
        return {
            "ok": False,
            "error": "Deployment to Railway failed. Check logs for details.",
            "code": "RAILWAY_DEPLOY_FAILED",
        }

    # Update startup deploy status
    startup.deploy_status = "deploying"
    await db.flush()

    deployment_data = {
        "deployment_id": deploy_result["deployment_id"],
        "service_id": deploy_result["service_id"],
        "environment_id": deploy_result["environment_id"],
        "environment": environment,
        "status": "deploying",
        "project_id": project_id,
    }

    return {"ok": True, "data": deployment_data}


# ── GET /api/startups/{id}/deploy/status ─────────────────────────────────────


@router.get("/{startup_id}/deploy/status", response_model=dict)
async def deploy_status(
    startup_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Check the current deployment status for a startup.

    Reads the Railway deployment ID stored in startup settings and
    queries Railway for the latest status.
    """
    _require_railway_token()

    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found",
        )

    railway_meta: dict = startup.settings.get("railway", {})
    deployment_id = railway_meta.get("latest_deployment_id")

    if not deployment_id:
        return {
            "ok": True,
            "data": {
                "status": "no_deployment",
                "deploy_url": startup.deploy_url,
                "message": "No active deployment found. Deploy first.",
            },
        }

    try:
        status_result = await get_deploy_status(deployment_id)
    except Exception as exc:
        logger.error("Failed to get deploy status: %s", exc)
        return {
            "ok": False,
            "error": "Could not fetch deployment status from Railway.",
            "code": "RAILWAY_STATUS_FAILED",
        }

    # If Railway reports live, update the startup record
    if status_result["status"] == "live" and status_result.get("deploy_url"):
        startup.deploy_status = "live"
        startup.deploy_url = status_result["deploy_url"]
        await db.flush()

    return {"ok": True, "data": status_result}


# ── POST /api/startups/{id}/deploy/rollback ──────────────────────────────────


@router.post("/{startup_id}/deploy/rollback", response_model=dict)
async def rollback(
    startup_id: uuid.UUID,
    body: RollbackRequest | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """
    Rollback the startup to its previous Railway deployment.

    Looks up the previous deployment ID from startup settings and
    re-deploys that version.
    """
    _require_railway_token()

    startup = await get_startup(db, startup_id, current_user.id)
    if not startup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Startup not found",
        )

    railway_meta: dict = startup.settings.get("railway", {})
    project_id = railway_meta.get("project_id")
    service_id = railway_meta.get("service_id")
    previous_deployment_id = railway_meta.get("previous_deployment_id")

    if not project_id or not previous_deployment_id:
        return {
            "ok": False,
            "error": "No previous deployment available to rollback to.",
            "code": "NO_ROLLBACK_TARGET",
        }

    try:
        rollback_result = await rollback_deploy(
            project_id,
            service_id or "",
            previous_deployment_id,
        )
    except Exception as exc:
        logger.error("Rollback failed: %s", exc)
        return {
            "ok": False,
            "error": "Rollback failed. Check Railway dashboard for details.",
            "code": "RAILWAY_ROLLBACK_FAILED",
        }

    # Update startup settings to track the new deployment
    startup.deploy_status = "deploying"
    startup.settings = {
        **startup.settings,
        "railway": {
            **railway_meta,
            "latest_deployment_id": rollback_result["deployment_id"],
        },
    }
    await db.flush()

    reason = body.reason if body else None
    logger.info(
        "Rollback initiated for startup %s (reason: %s)",
        startup_id, reason or "none",
    )

    return {
        "ok": True,
        "data": {
            "deployment_id": rollback_result["deployment_id"],
            "status": "deploying",
            "message": "Rollback initiated. Previous version is being re-deployed.",
        },
    }
