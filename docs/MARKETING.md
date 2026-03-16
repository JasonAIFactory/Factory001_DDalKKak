# MARKETING.md — Auto-Marketing System

> Your startup markets itself. You just approve.

## What Users See

```
Marketing tab:
  📢 Active Campaigns
    Google Ads — Restaurant owners     🟢 Running  CTR 3.2%  $120/mo
    SEO Blog — Auto-publishing         🟢 Running  2 posts/week  $0
    Email — Welcome sequence           🟢 Running  Open 42%  $0
  
  🤖 AI Suggestion:
    "Your 'review management' ad group has $22 CPC. 
     I recommend pausing it and shifting budget to 
     'restaurant reputation' which has $6 CPC."
    
    [Approve] [Ignore] [Modify]
```

## Core Functions

### 1. Landing Page Generator (cost: Sonnet ~$0.15)
```
Input: startup description + target audience
Output: Complete landing page with:
  - Hero section with value proposition
  - Feature grid
  - Pricing table
  - Testimonial section (placeholder)
  - CTA buttons connected to signup
  - SEO meta tags
  - Open Graph tags for social sharing
```

### 2. SEO Auto-Optimization (cost: Haiku ~$0.01)
```
Automatic:
  - Generate meta title + description for every page
  - Generate sitemap.xml
  - Generate robots.txt
  - Structured data (JSON-LD)
  - Alt tags for images

Weekly (cron):
  - Suggest blog topics based on search trends
  - Generate blog post drafts (Sonnet)
  - User approves → auto-publish
```

### 3. Email Marketing (cost: Haiku ~$0.005 per email)
```
Auto-configured sequences:
  Welcome: Day 0 → Day 3 → Day 7 → Day 14
  Trial expiring: Day 12 → Day 13 → Day 14
  Churn prevention: After 7 days inactive
  
Template + personalization (NOT fully AI-generated):
  - Templates pre-built, stored in DB ($0)
  - AI fills in: user name, usage stats, relevant features ($0.005)
  - User can customize templates via chat
```

### 4. Ad Campaign Management (cost: Sonnet for creation ~$0.10)
```
Google Ads integration:
  - AI creates campaign structure
  - AI writes ad copy variants
  - AI sets initial bids and budget
  - AI monitors performance daily (DB queries, $0)
  - AI suggests optimizations (Haiku, $0.005)
  - User approves changes
  
  IMPORTANT: AI NEVER spends money without user approval.
  All budget changes require explicit user confirmation.
```

## Data Model

```sql
CREATE TABLE marketing_campaigns (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    type            VARCHAR(20) NOT NULL,
    -- google_ads, seo_blog, email_sequence, social_post
    
    name            VARCHAR(200) NOT NULL,
    status          VARCHAR(20) DEFAULT 'draft',
    -- draft, pending_approval, running, paused, completed
    
    config          JSONB NOT NULL,
    -- Type-specific config (ad copy, targeting, schedule, etc.)
    
    metrics         JSONB DEFAULT '{}',
    -- impressions, clicks, conversions, spend, ctr, cpc
    
    ai_managed      BOOLEAN DEFAULT true,
    monthly_budget  DECIMAL(10,2),
    total_spend     DECIMAL(10,2) DEFAULT 0,
    
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE blog_posts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    title           VARCHAR(300) NOT NULL,
    slug            VARCHAR(300) NOT NULL,
    content         TEXT NOT NULL,
    meta_description VARCHAR(160),
    
    status          VARCHAR(20) DEFAULT 'draft',
    -- draft, pending_review, published
    
    seo_score       INTEGER, -- 0-100
    generated_by    VARCHAR(20) DEFAULT 'sonnet',
    
    published_at    TIMESTAMP,
    created_at      TIMESTAMP DEFAULT now()
);

CREATE TABLE email_templates (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    name            VARCHAR(100) NOT NULL,
    trigger         VARCHAR(50) NOT NULL,
    -- welcome, trial_expiring, inactive, feature_announcement
    
    subject         VARCHAR(200) NOT NULL,
    body_html       TEXT NOT NULL,
    
    delay_days      INTEGER DEFAULT 0,
    enabled         BOOLEAN DEFAULT true,
    
    metrics         JSONB DEFAULT '{}',
    -- sent, opened, clicked, unsubscribed
    
    created_at      TIMESTAMP DEFAULT now()
);
```

## API Endpoints

```
GET    /api/startups/{id}/marketing/overview
  Returns: { campaigns, blog_posts, emails, total_spend, total_revenue_attributed }

POST   /api/startups/{id}/marketing/campaign
  Body: { type, name, budget?, targeting? }
  Returns: { campaign } (status: pending_approval)

POST   /api/startups/{id}/marketing/blog
  Body: { topic? }  (or AI suggests topic)
  Returns: { blog_post } (status: draft)

POST   /api/startups/{id}/marketing/email-template
  Body: { trigger, subject?, body? }
  Returns: { template }

POST   /api/marketing/campaigns/{id}/approve
  Returns: { campaign } (status: running)

GET    /api/startups/{id}/marketing/suggestions
  Returns: [{ suggestion, estimated_impact, cost }]
  # AI generates these using Haiku — cheap
```

## Safety Rules

1. NEVER auto-spend advertising money without user approval
2. NEVER send emails without user reviewing the first one
3. NEVER publish blog posts without user review (draft → approve → publish)
4. Always show estimated cost before any paid action
5. Daily spend limit per campaign (user configurable, default $10/day)
6. If any campaign ROI goes negative → auto-pause + notify user
