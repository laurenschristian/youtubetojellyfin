FROM python:3.11-alpine

# Build arguments
ARG VERSION
LABEL org.opencontainers.image.version=${VERSION}

# Install Node.js and other dependencies
RUN apk add --no-cache \
    nodejs \
    npm \
    ffmpeg \
    git \
    wget && \
    npm install -g npm@latest && \
    python3 -m pip install --no-cache-dir yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm ci --only=production

# Copy app source
COPY . .

# Create downloads directory with correct permissions
RUN mkdir -p /downloads && \
    adduser -D -h /app appuser && \
    chown -R appuser:appuser /downloads /app

# Set environment variables
ENV NODE_ENV=production \
    OUTPUT_DIR=/downloads \
    VERSION=${VERSION}

# Switch to non-root user
USER appuser

# Create volume mount point
VOLUME /downloads

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["npm", "start"] 