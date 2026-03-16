# ANALYTICS.md — Business Analytics System

> Every metric a solo founder needs. Zero setup.

## Auto-Tracked Metrics (cost: $0 — all database queries)

### Revenue Metrics
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- MRR growth rate (month over month)
- Revenue per user (ARPU)
- Lifetime value (LTV)
- Churn rate (monthly)
- Net revenue retention

### User Metrics
- Total users (registered)
- Active users (daily / weekly / monthly)
- New signups per day
- Signup conversion rate (visitors → signups)
- Trial → paid conversion rate
- DAU/MAU ratio (engagement)

### Product Metrics
- Page views per page
- Session duration
- Feature usage (which features are used most)
- Error encounters per user

### Marketing Metrics
- Traffic by source (organic, paid, direct, referral, social)
- Ad spend and ROI per campaign
- Email open rates and click rates
- SEO rankings for target keywords

### Funnel
```
Visit → Signup → Activate → Trial → Paid → Retained
  Each step tracked with conversion rate and drop-off reason
```

## Data Collection

```
Tracking script (auto-injected into user's startup):

<script src="https://dalkkak.ai/analytics/track.js"
        data-startup-id="uuid"></script>

Events tracked:
  - page_view (url, referrer, device)
  - signup (method: email/google/github)
  - login
  - feature_use (feature_name)
  - purchase (amount, plan)
  - churn (reason if provided)

Privacy: 
  - No PII in events
  - IP anonymized (last octet zeroed)
  - Cookie-less option available
  - GDPR consent banner auto-included
```

## Data Model

```sql
CREATE TABLE analytics_events (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    event_type      VARCHAR(50) NOT NULL,
    session_hash    VARCHAR(64), -- anonymized session ID
    
    properties      JSONB DEFAULT '{}',
    -- url, referrer, device, country, feature_name, etc.
    
    created_at      TIMESTAMP DEFAULT now()
);

-- Partition by month for performance
-- Auto-aggregate daily into analytics_daily table

CREATE TABLE analytics_daily (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    date            DATE NOT NULL,
    
    page_views      INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    signups         INTEGER DEFAULT 0,
    active_users    INTEGER DEFAULT 0,
    revenue         DECIMAL(10,2) DEFAULT 0,
    new_customers   INTEGER DEFAULT 0,
    churned         INTEGER DEFAULT 0,
    
    traffic_sources JSONB DEFAULT '{}',
    -- { organic: 120, paid: 45, direct: 30, social: 15 }
    
    top_pages       JSONB DEFAULT '[]',
    -- [{ url, views }]
    
    UNIQUE(startup_id, date)
);
```

## API Endpoints

```
GET    /api/startups/{id}/analytics/overview
  Returns: {
    mrr, users, uptime, signup_rate, churn_rate,
    mrr_chart: [{ date, value }],
    users_chart: [{ date, value }],
  }

GET    /api/startups/{id}/analytics/revenue
  Query: ?period=30d|90d|1y
  Returns: { mrr, arr, growth, churn, ltv, arpu, chart_data }

GET    /api/startups/{id}/analytics/users
  Query: ?period=30d
  Returns: { total, active, new_today, dau, wau, mau, chart_data }

GET    /api/startups/{id}/analytics/funnel
  Returns: { steps: [{ name, count, conversion_rate }] }

GET    /api/startups/{id}/analytics/traffic
  Returns: { sources: [{ name, count, percentage }] }

POST   /api/startups/{id}/analytics/insights
  Returns: [{ insight, impact, recommendation }]
  # Uses Haiku to analyze metrics — $0.01
```

## AI Insights (Haiku — cheap)

```
Weekly cron job per startup:
  1. Pull last 7 days metrics from analytics_daily ($0)
  2. Compare to previous 7 days ($0)
  3. Send summary to Haiku with prompt:
     "Analyze these metrics and give 3 actionable insights" ($0.01)
  4. Store insights for dashboard display
  5. Send weekly email report to founder ($0)
```
