# Slim base keeps the image small while still providing a full Python runtime.
FROM python:3.11-slim

# Avoid .pyc files and force unbuffered stdout/stderr so logs show up immediately in Railway/Docker.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# All app files and the process working directory live here.
WORKDIR /app

# Install dependencies in their own layer first so code-only changes reuse the cache.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source after deps so rebuilds stay fast when only code changes.
COPY . .

# Run as a non-root user — compromised processes should not have root inside the container.
RUN useradd --create-home --uid 1000 appuser \
    && chown -R appuser:appuser /app
USER appuser

# Uvicorn listens on this port inside the container.
EXPOSE 8000

# Single worker is enough for this portfolio service; scale with more containers if needed.
# Secrets/API keys are injected at runtime (e.g. Railway), never baked into the image.
# Railway injects PORT — fall back to 8000 for local docker runs.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --workers 1
