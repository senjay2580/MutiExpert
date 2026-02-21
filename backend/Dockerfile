## ── Stage 1: Builder ──
FROM python:3.11-slim AS builder

WORKDIR /build

# Use Alibaba Cloud mirror for faster apt downloads
RUN sed -i 's|deb.debian.org|mirrors.aliyun.com|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get update && apt-get install -y --no-install-recommends \
    build-essential curl unzip \
    && rm -rf /var/lib/apt/lists/*

# Install Deno
RUN curl -fsSL https://deno.land/install.sh | DENO_INSTALL=/usr/local sh

# Install Python deps (compiled wheels stay in site-packages)
COPY pyproject.toml .
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ --trusted-host mirrors.aliyun.com .

## ── Stage 2: Runtime ──
FROM python:3.11-slim

WORKDIR /app

# Copy compiled Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy app source
COPY . .

RUN mkdir -p /app/uploads /app/skills

ENV SKILLS_DIR=/app/skills

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
