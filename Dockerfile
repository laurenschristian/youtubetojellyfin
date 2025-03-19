FROM node:20-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    atomicparsley \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY api/package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY api/ .

# Create config directory
RUN mkdir -p /config && chown -R node:node /config

# Switch to non-root user
USER node

# Expose API port
EXPOSE 3001

# Start the application
CMD ["npm", "run", "dev"] 