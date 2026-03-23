"""
deploy/service.py — Deployment business logic.

Handles: Railway project creation, code deployment, health checks,
and rollback.  All Railway API calls use httpx (async).

Railway GraphQL API: https://docs.railway.app/reference/public-api
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime
from typing import Any

import httpx

from backend.config import settings

logger = logging.getLogger(__name__)

RAILWAY_API_URL = settings.RAILWAY_API_URL


# ── Helpers ───────────────────────────────────────────────────────────────────


def _railway_headers() -> dict[str, str]:
    """Build authorization headers for Railway API requests."""
    return {
        "Authorization": f"Bearer {settings.RAILWAY_API_KEY}",
        "Content-Type": "application/json",
    }


async def _railway_graphql(query: str, variables: dict[str, Any] | None = None) -> dict:
    """
    Execute a GraphQL request against the Railway API.

    Returns the parsed JSON body.
    Raises httpx.HTTPStatusError on non-2xx responses so callers can
    catch and surface a user-friendly error.
    """
    payload: dict[str, Any] = {"query": query}
    if variables:
        payload["variables"] = variables

    async with httpx.AsyncClient(timeout=30) as client:
        response = await client.post(
            RAILWAY_API_URL,
            headers=_railway_headers(),
            json=payload,
        )
        response.raise_for_status()
        body = response.json()

    if "errors" in body:
        logger.error("Railway API errors: %s", body["errors"])
        raise RuntimeError(body["errors"][0].get("message", "Railway API error"))

    return body.get("data", {})


# ── Public API ────────────────────────────────────────────────────────────────


async def create_railway_project(startup_name: str) -> dict:
    """
    Create a new project on Railway for the user's startup.

    Returns dict with keys: project_id, project_name.
    """
    query = """
    mutation($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
            id
            name
        }
    }
    """
    variables = {
        "input": {
            "name": f"dalkkak-{startup_name}",
            "description": f"DalkkakAI managed startup: {startup_name}",
        }
    }

    data = await _railway_graphql(query, variables)
    project = data["projectCreate"]
    logger.info("Created Railway project %s for startup '%s'", project["id"], startup_name)
    return {"project_id": project["id"], "project_name": project["name"]}


async def deploy_to_railway(repo_url: str, project_id: str, environment: str = "production") -> dict:
    """
    Deploy code from a GitHub repo to a Railway project.

    Steps:
        1. Get or create the target environment on the project.
        2. Create a service linked to the GitHub repo.
        3. Trigger a deployment.

    Returns dict with keys: deployment_id, service_id, environment_id.
    """
    # Step 1 — Fetch environments to find the matching one (or create it)
    env_id = await _get_or_create_environment(project_id, environment)

    # Step 2 — Create a service linked to the repo
    service_id = await _create_service(project_id, repo_url)

    # Step 3 — Trigger deployment via service deploy
    deployment_id = await _trigger_deployment(service_id, env_id)

    logger.info(
        "Deployed to Railway: project=%s env=%s deploy=%s",
        project_id, environment, deployment_id,
    )
    return {
        "deployment_id": deployment_id,
        "service_id": service_id,
        "environment_id": env_id,
    }


async def get_deploy_status(deployment_id: str) -> dict:
    """
    Check the current status of a Railway deployment.

    Returns dict with keys: status, url.
    Railway deployment statuses: BUILDING, DEPLOYING, SUCCESS, FAILED, CRASHED, REMOVED.
    We map these to our internal statuses.
    """
    query = """
    query($deploymentId: String!) {
        deployment(id: $deploymentId) {
            id
            status
            staticUrl
        }
    }
    """
    data = await _railway_graphql(query, {"deploymentId": deployment_id})
    deployment = data.get("deployment", {})

    railway_status = deployment.get("status", "UNKNOWN")
    internal_status = _map_railway_status(railway_status)
    url = deployment.get("staticUrl")
    deploy_url = f"https://{url}" if url else None

    return {
        "status": internal_status,
        "railway_status": railway_status,
        "deploy_url": deploy_url,
    }


async def rollback_deploy(project_id: str, service_id: str, target_deployment_id: str) -> dict:
    """
    Rollback a Railway service to a previous deployment.

    Triggers a re-deploy of the specified target deployment.
    Returns dict with keys: deployment_id.
    """
    query = """
    mutation($deploymentId: String!) {
        deploymentRedeploy(id: $deploymentId) {
            id
            status
        }
    }
    """
    data = await _railway_graphql(query, {"deploymentId": target_deployment_id})
    new_deploy = data.get("deploymentRedeploy", {})
    logger.info(
        "Rollback triggered: project=%s old_deploy=%s new_deploy=%s",
        project_id, target_deployment_id, new_deploy.get("id"),
    )
    return {"deployment_id": new_deploy.get("id", "")}


async def health_check(deploy_url: str, retries: int = 5, interval: float = 5.0) -> bool:
    """
    Check if a deployed app is healthy by hitting GET /health.

    Retries up to `retries` times with `interval` seconds between attempts.
    Returns True if a 200 response is received, False otherwise.
    """
    async with httpx.AsyncClient(timeout=10) as client:
        for attempt in range(retries):
            try:
                response = await client.get(f"{deploy_url}/health")
                if response.status_code == 200:
                    logger.info("Health check passed for %s (attempt %d)", deploy_url, attempt + 1)
                    return True
            except Exception:
                pass
            if attempt < retries - 1:
                await asyncio.sleep(interval)

    logger.warning("Health check FAILED for %s after %d attempts", deploy_url, retries)
    return False


# ── Internal helpers ──────────────────────────────────────────────────────────


async def _get_or_create_environment(project_id: str, environment: str) -> str:
    """
    Fetch the environment ID for a Railway project.
    Creates the environment if it does not exist.
    """
    # List existing environments
    query = """
    query($projectId: String!) {
        project(id: $projectId) {
            environments {
                edges {
                    node {
                        id
                        name
                    }
                }
            }
        }
    }
    """
    data = await _railway_graphql(query, {"projectId": project_id})
    edges = data.get("project", {}).get("environments", {}).get("edges", [])

    for edge in edges:
        node = edge.get("node", {})
        if node.get("name", "").lower() == environment.lower():
            return node["id"]

    # Environment does not exist — create it
    create_query = """
    mutation($input: EnvironmentCreateInput!) {
        environmentCreate(input: $input) {
            id
            name
        }
    }
    """
    create_data = await _railway_graphql(
        create_query,
        {"input": {"name": environment, "projectId": project_id}},
    )
    return create_data["environmentCreate"]["id"]


async def _create_service(project_id: str, repo_url: str) -> str:
    """
    Create a Railway service linked to the startup's GitHub repo.
    If a service already exists for this repo, returns its ID.
    """
    query = """
    mutation($input: ServiceCreateInput!) {
        serviceCreate(input: $input) {
            id
        }
    }
    """
    variables = {
        "input": {
            "projectId": project_id,
            "source": {"repo": repo_url},
        }
    }
    data = await _railway_graphql(query, variables)
    return data["serviceCreate"]["id"]


async def _trigger_deployment(service_id: str, environment_id: str) -> str:
    """
    Trigger a new deployment for a service in a given environment.
    """
    query = """
    mutation($input: DeploymentTriggerInput!) {
        deploymentTrigger(input: $input) {
            id
            status
        }
    }
    """
    variables = {
        "input": {
            "serviceId": service_id,
            "environmentId": environment_id,
        }
    }
    data = await _railway_graphql(query, variables)
    return data["deploymentTrigger"]["id"]


def _map_railway_status(railway_status: str) -> str:
    """
    Map Railway's deployment status to our internal status vocabulary.

    Railway:  BUILDING | DEPLOYING | SUCCESS | FAILED | CRASHED | REMOVED
    Internal: building | deploying | live    | failed | failed  | rolled_back
    """
    mapping = {
        "BUILDING": "building",
        "DEPLOYING": "deploying",
        "SUCCESS": "live",
        "FAILED": "failed",
        "CRASHED": "failed",
        "REMOVED": "rolled_back",
    }
    return mapping.get(railway_status, "building")
