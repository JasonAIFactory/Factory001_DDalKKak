# SUPPORT.md — Customer Support System

> 87% of tickets resolved without bothering the founder.

## How It Works

```
Customer sends message → 

  1. Check knowledge base (RAG lookup) — $0
     Found answer? → Reply with cached answer → Done
     
  2. Classify intent with Haiku — $0.002
     Password reset? → Trigger reset flow → $0
     Billing question? → Pull billing data → Reply with Haiku → $0.005
     Bug report? → Create issue + notify founder → $0
     Feature request? → Log + categorize → $0
     
  3. Generate response with Haiku — $0.005
     Confidence > 80%? → Send automatically
     Confidence < 80%? → Queue for founder review
     
  4. Angry customer or refund request?
     → Always escalate to founder. Never auto-handle.
```

## Knowledge Base (RAG — per startup)

```
Auto-indexed from:
  - Product README/docs
  - FAQ page content
  - Previous resolved tickets
  - Changelog / release notes
  
Storage: Qdrant (vector DB) with per-startup namespace
Embedding: text-embedding-3-small (OpenAI, cheapest)
Cost: ~$0.0001 per query (practically free)

When RAG finds a match with >90% similarity:
  → Return cached answer directly ($0)
  → No AI generation needed
```

## Data Model

```sql
CREATE TABLE support_tickets (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    customer_email  VARCHAR(255) NOT NULL,
    customer_name   VARCHAR(100),
    
    subject         VARCHAR(300) NOT NULL,
    
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    -- open, ai_handling, ai_resolved, needs_owner, closed
    
    priority        VARCHAR(10) DEFAULT 'medium',
    -- low, medium, high, urgent
    
    category        VARCHAR(50),
    -- billing, bug, feature_request, how_to, account, other
    
    messages        JSONB DEFAULT '[]',
    -- [{ role: "customer"|"ai"|"owner", content, timestamp }]
    
    ai_confidence   DECIMAL(3,2),
    resolution_type VARCHAR(20),
    -- auto_resolved, owner_resolved, escalated
    
    first_response_ms INTEGER,
    resolution_ms   INTEGER,
    
    created_at      TIMESTAMP DEFAULT now(),
    resolved_at     TIMESTAMP
);

CREATE TABLE knowledge_base (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    startup_id      UUID NOT NULL REFERENCES startups(id),
    
    source          VARCHAR(50) NOT NULL,
    -- docs, faq, ticket_resolution, changelog
    
    title           VARCHAR(300),
    content         TEXT NOT NULL,
    embedding       VECTOR(1536),
    
    created_at      TIMESTAMP DEFAULT now(),
    updated_at      TIMESTAMP DEFAULT now()
);
```

## API Endpoints

```
GET    /api/startups/{id}/support/overview
  Returns: { open_tickets, ai_resolution_rate, avg_response_time }

GET    /api/startups/{id}/support/tickets
  Query: ?status=needs_owner&priority=high
  Returns: [{ ticket }]

GET    /api/support/tickets/{id}
  Returns: { ticket with full message history }

POST   /api/support/tickets/{id}/reply
  Body: { content }
  Logic: Owner sends reply → mark ticket appropriately

POST   /api/support/tickets/{id}/resolve
  Body: { resolution_note? }

POST   /api/startups/{id}/support/chatbot/embed
  Returns: { script_tag }
  # Embeddable chat widget for the startup's website
```

## Embeddable Chat Widget

```
User's customers see a chat bubble on the startup's website.
Generated as a simple script tag:

<script src="https://dalkkak.ai/support/widget.js" 
        data-startup-id="uuid"></script>

The widget:
  - Floating bubble in bottom-right corner
  - Opens chat panel
  - Messages go to DalkkakAI support system
  - AI responds in real-time
  - If AI can't handle → "A team member will reply shortly"
```
