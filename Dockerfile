FROM python:3.11-slim

WORKDIR /app

# Install git (required for worktree-based session isolation)
RUN apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*

# Install dependencies first (layer caching — only re-runs when requirements change)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source
COPY . .

EXPOSE 8000

# Production start command (docker-compose overrides this for dev)
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
