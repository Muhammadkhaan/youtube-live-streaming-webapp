# CloudCast Production Dockerfile
# Cloud-Native 24/7 Multi-Stream Broadcasting Platform
FROM node:22-bookworm-slim

# Install system dependencies: FFmpeg, FFprobe, and networking tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install production and build dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build Vite frontend for production SPA serving
RUN npm run build

# Ensure persistent storage directories exist
RUN mkdir -p /app/data /app/uploads/.chunks

# Environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Expose HTTP port
EXPOSE 3000

# Start server using tsx
CMD ["npm", "start"]
