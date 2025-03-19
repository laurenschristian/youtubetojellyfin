FROM node:20-slim

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3001

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    atomicparsley \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp
RUN wget https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -O /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Copy package files
COPY api/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY api/ .

# Create required directories with proper permissions
RUN mkdir -p /config /downloads /completed /app/logs && \
    chown -R node:node /config /downloads /completed /app/logs

# Switch to non-root user
USER node

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/api/health || exit 1

# Volume configuration
VOLUME ["/config", "/downloads", "/completed", "/app/logs"]

# Expose API port
EXPOSE ${PORT}

# Start the application
CMD ["npm", "start"] 