FROM node:20-alpine

# Build arguments
ARG VERSION
LABEL org.opencontainers.image.version=${VERSION}

# Install system dependencies
RUN apk update && \
    apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    git \
    wget \
    # AtomicParsley is not available in Alpine, we'll build it from source
    build-base \
    autoconf \
    automake \
    libtool \
    zlib-dev \
    && \
    # Build and install AtomicParsley
    cd /tmp && \
    git clone https://github.com/wez/atomicparsley.git && \
    cd atomicparsley && \
    ./autogen.sh && \
    ./configure && \
    make && \
    make install && \
    # Cleanup
    cd / && \
    rm -rf /tmp/atomicparsley && \
    apk del build-base autoconf automake libtool

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
    chown -R node:node /downloads /app

# Set environment variables
ENV NODE_ENV=production \
    OUTPUT_DIR=/downloads \
    VERSION=${VERSION}

# Switch to non-root user
USER node

# Create volume mount point
VOLUME /downloads

# Expose API port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["npm", "start"] 