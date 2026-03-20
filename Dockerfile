FROM python:3.11-slim

WORKDIR /app

# Install system deps: git, curl, Node.js, tmux, Docker CLI
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends nodejs tmux docker-ce-cli \
    && rm -rf /var/lib/apt/lists/*

# Install Claude Code CLI globally (users run `claude` in web terminal)
RUN npm install -g @anthropic-ai/claude-code 2>/dev/null || echo "Claude Code CLI install skipped — may need manual install"

# Install Python dependencies (layer caching — only re-runs when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# tmux config (mouse, colors, vi keys, status bar)
COPY config/tmux.conf /root/.tmux.conf

# Copy source
COPY . .

EXPOSE 8000

# Production start command (docker-compose overrides this for dev)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
