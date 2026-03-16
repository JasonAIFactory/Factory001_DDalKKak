# BILLING.md — Billing & Subscription System

> Stripe auto-configured. User never sees a dashboard they didn't ask for.

## Two Billing Layers

### Layer 1: DalkkakAI billing (user pays US)
```
Plans:
  Free:      $0/mo   — 1 startup, 1 session, basic features
  Starter:   $29/mo  — 1 startup, 2 concurrent sessions, marketing
  Growth:    $49/mo  — 3 startups, 5 sessions, full features
  Scale:     $99/mo  — 10 startups, 10 sessions, priority support

Overage:
  Extra AI credits: $5 per 50 credits
  Extra startups: $10/mo each
```

### Layer 2: User's startup billing (their customers pay them)
```
DalkkakAI auto-configures Stripe for the user's startup:
  - Creates Stripe product + prices
  - Generates pricing page
  - Handles webhook for payment events
  - Tracks MRR, churn, LTV automatically

User just says: "My product costs $29/month"
DalkkakAI handles everything else.
```

## Auto-Configuration Flow

```
When user creates a startup that needs billing:

  1. Check if user has connected Stripe
     No → Show one-click Stripe Connect OAuth
     Yes → Continue
  
  2. AI asks: "What should you charge?"
     User: "$29/month with a 14-day free trial"
  
  3. DalkkakAI creates:
     - Stripe Product: "ReviewPro"
     - Stripe Price: $29/month recurring
     - Trial: 14 days
     - Customer portal link
     - Webhook endpoint for payment events
     - Pricing page component
  
  4. All payment events tracked in DalkkakAI dashboard
     - New subscription → activity feed
     - Payment received → revenue metric
     - Churn → alert + retention email trigger
```

## Data Model

```sql
CREATE TABLE billing_config (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    stripe_connected BOOLEAN DEFAULT false,
    stripe_account_id VARCHAR(100),
    stripe_product_id VARCHAR(100),
    
    plans           JSONB DEFAULT '[]',
    -- [{ name, price, interval, trial_days, stripe_price_id }]
    
    webhook_secret  VARCHAR(255),
    
    created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE payments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    stripe_payment_id  VARCHAR(100),
    customer_email  VARCHAR(255),
    amount          DECIMAL(10,2) NOT NULL,
    currency        VARCHAR(3) DEFAULT 'usd',
    status          VARCHAR(20) NOT NULL,
    -- succeeded, failed, refunded
    
    subscription_id VARCHAR(100),
    
    created_at      TIMESTAMP DEFAULT now()
);
-- Used to calculate MRR, churn, LTV
```

## API Endpoints

```
GET    /api/startups/{id}/billing/config
  Returns: { stripe_connected, plans, mrr, subscriber_count }

POST   /api/startups/{id}/billing/connect-stripe
  Returns: { stripe_oauth_url }
  # Redirect user to Stripe Connect

POST   /api/startups/{id}/billing/plans
  Body: { name, price, interval, trial_days }
  Returns: { plan with stripe_price_id }

GET    /api/startups/{id}/billing/revenue
  Query: ?period=30d
  Returns: { mrr, arr, total_revenue, growth_rate, churn_rate, ltv }

GET    /api/startups/{id}/billing/payments
  Returns: [{ payment }]

POST   /api/startups/{id}/billing/webhook
  # Stripe webhook receiver — handles all payment events
```
