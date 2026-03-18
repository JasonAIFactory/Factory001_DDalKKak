FROM python:3.11-slim

WORKDIR /app

# Install system deps: git (worktrees), curl (health checks), Node.js (Claude Code CLI)
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs tmux \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally (users run `claude` in web terminal)
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || echo "Claude Code CLI install skipped — may need manual install"

# Install Python dependencies (layer caching — only re-runs when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000

# Production start command (docker-compose overrides this for dev)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
