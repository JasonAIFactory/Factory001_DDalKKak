# MONITORING.md — Monitoring & Auto-Healing

> Your startup never sleeps. Neither does DalkkakAI's monitoring.

## What Users See

```
Dashboard Health Panel:
  🟢 Uptime: 99.97%  │  0 errors  │  45ms avg  │  1.2K req/day
  
Push notification (when something breaks):
  "⚠️ ReviewPro: Error rate spiked to 8%. AI is investigating..."
  
  [2 minutes later]
  "✅ ReviewPro: Auto-fixed. Database connection pool was exhausted. 
   Increased pool size from 5 to 20. Deployed fix automatically."
```

## Monitoring Stack

```
┌─ DalkkakAI Monitor ─────────────────────────┐
│                                               │
│  Health Checker (every 60s)                   │
│  ├── GET /health → 200?                       │
│  ├── Response time < 2s?                      │
│  └── Report to monitoring DB                  │
│                                               │
│  Error Tracker                                │
│  ├── Catch 5xx responses from app logs        │
│  ├── Categorize by type (DB, auth, API, etc.) │
│  └── If threshold exceeded → trigger alert    │
│                                               │
│  Metrics Collector                            │
│  ├── Requests per minute                      │
│  ├── Average response time                    │
│  ├── Error rate (5xx / total)                 │
│  ├── Active users (from analytics events)     │
│  └── Store in time-series format              │
│                                               │
│  Alert Engine                                 │
│  ├── Error rate > 5% for 5 min → WARN        │
│  ├── Error rate > 15% for 2 min → CRITICAL   │
│  ├── App down for 1 min → CRITICAL            │
│  ├── Response time > 5s avg → WARN            │
│  └── Send via: push notification + email      │
│                                               │
│  Auto-Healer (AI-powered)                     │
│  ├── Analyze error pattern                    │
│  ├── Match to known fixes (cached)            │
│  ├── If known fix → apply + redeploy          │
│  ├── If unknown → escalate to user            │
│  └── Log all auto-fixes for learning          │
└───────────────────────────────────────────────┘
```

## Data Model

```sql
CREATE TABLE health_checks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    status          VARCHAR(10) NOT NULL, -- healthy, degraded, down
    response_time   INTEGER, -- milliseconds
    status_code     INTEGER,
    error_message   TEXT,
    checked_at      TIMESTAMP DEFAULT now()
);
-- Partition by month, auto-delete after 90 days

CREATE TABLE alerts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    severity        VARCHAR(10) NOT NULL, -- info, warning, critical
    type            VARCHAR(50) NOT NULL,
    message         TEXT NOT NULL,
    resolved        BOOLEAN DEFAULT false,
    resolved_by     VARCHAR(20), -- 'auto', 'user', 'timeout'
    resolution      TEXT,
    created_at      TIMESTAMP DEFAULT now(),
    resolved_at     TIMESTAMP
);
```

## Auto-Heal Rules (cost: $0 for known fixes, Haiku for diagnosis)

```python
KNOWN_FIXES = {
    "connection_pool_exhausted": {
        "fix": "increase_pool_size",
        "config_change": {"DB_POOL_SIZE": "current * 4"},
        "restart_required": True,
        "ai_needed": False,  # $0
    },
    "memory_limit_exceeded": {
        "fix": "increase_memory",
        "api_call": "railway.scale_memory(512)",
        "restart_required": False,
        "ai_needed": False,  # $0
    },
    "rate_limit_hit": {
        "fix": "add_rate_limit_middleware",
        "ai_needed": True,  # Haiku for simple code change
        "model": "haiku",
    },
    "ssl_expired": {
        "fix": "renew_certificate",
        "api_call": "letsencrypt.renew(domain)",
        "ai_needed": False,  # $0
    },
}

# If error not in known_fixes:
#   → Use Haiku to analyze logs ($0.005)
#   → If Haiku suggests a fix → apply
#   → If unclear → escalate to user
```

## API Endpoints

```
GET    /api/startups/{id}/health
  Returns: { status, uptime_pct, avg_response_ms, error_rate, last_check }

GET    /api/startups/{id}/health/history
  Query: ?period=24h|7d|30d
  Returns: [{ timestamp, status, response_time }]

GET    /api/startups/{id}/alerts
  Query: ?resolved=false
  Returns: [{ alert }]

POST   /api/alerts/{id}/resolve
  Body: { resolution_note? }

GET    /api/startups/{id}/metrics
  Query: ?metric=requests|response_time|errors&period=24h
  Returns: { data_points: [{ timestamp, value }] }
```
