# DEPLOY.md — Zero-Config Deployment System

> User clicks "Deploy." Everything else is our problem.

## What the User Sees

```
User clicks [🚀 Deploy]

  ✅ Building... (10s)
  ✅ Testing... 22/22 passed (5s)
  ✅ Deploying... (30s)
  ✅ Health check passed
  🟢 Live at: reviewpro.dalkkak.ai

Total time: ~45 seconds
User effort: one click
```

## What Happens Behind the Scenes

```
1. Git push to GitHub (main branch)
2. Detect stack from project files
3. Select Dockerfile template (or Nixpack auto-detect)
4. Build container image
5. Run test suite inside container
6. If tests fail → abort, notify user, suggest fix
7. Deploy to Railway/Fly.io
8. Wait for health check (GET /health → 200)
9. If health fails → auto-rollback to previous version
10. Update DNS if custom domain
11. Notify user: "Live at [url]"
12. Start monitoring
```

## Stack Detection (zero config)

```python
def detect_stack(file_list: list[str]) -> StackConfig:
    """
    Detect project stack from file presence.
    User never configures this.
    """
    
    if "requirements.txt" in file_list or "pyproject.toml" in file_list:
        if "main.py" in file_list or "app/main.py" in file_list:
            return StackConfig(
                language="python",
                framework="fastapi",
                build_cmd="pip install -r requirements.txt",
                start_cmd="uvicorn app.main:app --host 0.0.0.0 --port $PORT",
                port=8000,
            )
    
    if "package.json" in file_list:
        pkg = read_json("package.json")
        if "next" in pkg.get("dependencies", {}):
            return StackConfig(
                language="node",
                framework="nextjs",
                build_cmd="npm run build",
                start_cmd="npm start",
                port=3000,
            )
    
    # Fallback: Nixpack auto-detection (Railway built-in)
    return StackConfig(language="auto", framework="auto")
```

## Deployment Environments

```
Per startup:
  staging:    {name}-staging.dalkkak.ai  (auto-deploy on merge)
  production: {name}.dalkkak.ai          (manual deploy or auto)

User can toggle auto-deploy:
  ON:  every merge → auto-deploys to staging → if healthy, promote to production
  OFF: every merge → deploys to staging only → user clicks to promote
```

## Health Check

```python
async def health_check(deploy_url: str, retries: int = 5) -> bool:
    """
    Check if deployed app is healthy.
    Retry up to 5 times with 5s interval.
    """
    for attempt in range(retries):
        try:
            response = await httpx.get(f"{deploy_url}/health", timeout=10)
            if response.status_code == 200:
                return True
        except Exception:
            pass
        await asyncio.sleep(5)
    
    return False
```

## Auto-Rollback

```
If health check fails after deploy:
  1. Immediately rollback to previous version
  2. Notify user: "Deploy failed health check. Rolled back."
  3. AI analyzes build logs → suggests likely cause
  4. Create "fix" session automatically (optional)
```

## Data Model

```sql
CREATE TABLE deployments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    version         INTEGER NOT NULL,
    environment     VARCHAR(20) NOT NULL DEFAULT 'production',
    
    git_commit      VARCHAR(40) NOT NULL,
    git_branch      VARCHAR(100) DEFAULT 'main',
    
    status          VARCHAR(20) NOT NULL DEFAULT 'building',
    -- building, testing, deploying, live, failed, rolled_back
    
    deploy_url      VARCHAR(255),
    build_logs      TEXT,
    
    health_status   VARCHAR(20) DEFAULT 'pending',
    -- pending, healthy, degraded, down
    
    build_duration  INTEGER, -- seconds
    deploy_duration INTEGER, -- seconds
    
    previous_deploy_id UUID REFERENCES deployments(id),
    
    created_at      TIMESTAMP DEFAULT now(),
    completed_at    TIMESTAMP
);
```

## API Endpoints

```
POST   /api/startups/{id}/deploy
  Body: { environment?: "staging" | "production" }
  Returns: { deployment }
  WebSocket events: deploy.building → deploy.testing → deploy.deploying → deploy.live

GET    /api/startups/{id}/deployments
  Returns: [{ deployment }] (sorted by version desc)

POST   /api/deployments/{id}/rollback
  Returns: { new_deployment } (reverts to previous version)

GET    /api/deployments/{id}/logs
  Returns: { build_logs, runtime_logs }

POST   /api/deployments/{id}/promote
  Logic: Promote staging → production
  Returns: { new_deployment }
```

## Monitoring (post-deploy)

```
After every deploy, automatically:
  - Uptime check every 60 seconds
  - Response time tracking
  - Error rate monitoring (5xx responses)
  - If error rate > 5% for 5 minutes → alert user
  - If app goes down → alert user + auto-rollback option
```

## Domain Management

```
Default:     {name}.dalkkak.ai (free, automatic)
Custom:      user adds CNAME record → we provision SSL via Let's Encrypt
Subdomain:   {name}.dalkkak.ai → Railway/Fly.io subdomain → SSL automatic

API:
POST   /api/startups/{id}/domain
  Body: { custom_domain: "app.mycompany.com" }
  Returns: { dns_records_needed, ssl_status }

GET    /api/startups/{id}/domain
  Returns: { current_domain, custom_domain, ssl_status, dns_verified }
```
