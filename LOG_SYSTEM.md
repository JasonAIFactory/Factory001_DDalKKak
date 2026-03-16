# LOG_SYSTEM.md — Project Learning Logs

> Every project has its own logs/. One file per day. Never edited after the day ends.

## Directory Structure

```
logs/
├── learning/                  ← Technical concepts, decisions, new knowledge
│   ├── 2026-03-16.md
│   ├── 2026-03-17.md
│   └── ...
│
├── english/                   ← English corrections and dev phrases
│   ├── 2026-03-16.md
│   ├── 2026-03-17.md
│   └── ...
│
└── troubleshooting/           ← One file per bug (named by date + topic)
    ├── 2026-03-16_cors-error.md
    ├── 2026-03-17_railway-deploy-fail.md
    └── ...
```

## Rules

### File creation
- One file per day per category (learning, english)
- One file per bug (troubleshooting)
- If today's file doesn't exist yet, CREATE it
- If today's file exists, APPEND to it
- Never edit previous days' files — they are immutable history

### File naming
```
learning:        YYYY-MM-DD.md
english:         YYYY-MM-DD.md
troubleshooting: YYYY-MM-DD_short-description.md
```

### File size
- Daily learning: max 150 lines (if you learn that much in a day, great)
- Daily english: max 100 lines
- Troubleshooting: max 80 lines per bug
- No archiving needed — each file is already small

### How Claude Code manages this
```
At the START of every work session:
  1. Check if logs/learning/YYYY-MM-DD.md exists for today
  2. If not, create it with the header template
  3. Append entries throughout the session

At the END of every work session:
  git add logs/
  git commit -m "logs: YYYY-MM-DD learnings"
```
