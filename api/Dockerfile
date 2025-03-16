FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    ffmpeg \
    curl \
    bash

# Install yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && \
    chmod a+rx /usr/local/bin/yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --production=false

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /config /downloads /completed

# Set permissions
RUN chown -R node:node /app /config /downloads /completed

# Switch to non-root user
USER node

# Expose port
EXPOSE 3001

# Start the server
CMD ["npm", "start"] 