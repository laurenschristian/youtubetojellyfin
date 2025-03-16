FROM node:20-alpine

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    py3-pip \
    ffmpeg \
    atomicparsley

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install app dependencies
RUN npm ci

# Copy app source
COPY . .

# Create downloads directory
RUN mkdir -p /downloads && \
    chown -R node:node /downloads

# Set environment variables
ENV NODE_ENV=production \
    OUTPUT_DIR=/downloads

# Switch to non-root user
USER node

# Expose API port
EXPOSE 3001

# Start the server
CMD ["npm", "start"] 