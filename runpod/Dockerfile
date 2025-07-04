# MeloTTS RunPod Dockerfile
# Optimized for serverless deployment with fast cold starts

FROM python:3.9-slim AS base

# Set environment variables
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1
ENV DEBIAN_FRONTEND=noninteractive

# Install system dependencies
RUN apt-get update && apt-get install -y \
    git \
    build-essential \
    libsndfile1 \
    ffmpeg \
    wget \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Clone and install MeloTTS
RUN git clone https://github.com/myshell-ai/MeloTTS.git /tmp/MeloTTS

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install MeloTTS
RUN cd /tmp/MeloTTS && pip install --no-cache-dir -e .

# Download required language data
RUN python -m unidic download

# Pre-download models to speed up cold starts - all English accents
RUN python -c "from melo.api import TTS; TTS(language='EN-US', device='cpu')" || true
RUN python -c "from melo.api import TTS; TTS(language='EN-BR', device='cpu')" || true  
RUN python -c "from melo.api import TTS; TTS(language='EN-IN', device='cpu')" || true

# Copy handler
COPY handler.py .

# Create non-root user for security
RUN useradd --create-home --shell /bin/bash app
RUN chown -R app:app /app
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD python -c "import sys; sys.path.append('/app'); from handler import health_check; result = health_check(); sys.exit(0 if result['status'] == 'healthy' else 1)"

# Default command
CMD ["python", "handler.py"]