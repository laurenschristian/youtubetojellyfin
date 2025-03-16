# Docker and Video Processing Guide

## Overview

This guide covers the Docker configuration and video processing setup for the YouTube to Jellyfin integration. It includes container setup, video processing pipeline, and storage management.

## Docker Configuration

### Base Image Selection
```dockerfile
FROM node:20-slim

# Install ffmpeg and other dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg python3 python3-pip && \
    pip3 install yt-dlp && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*
```

### Container Resources

Configure resource limits in `docker-compose.yml`:
```yaml
services:
  api:
    build: .
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

### Volume Mapping

```yaml
volumes:
  - .:/app
  - /volume1/jellyfin/media:/media
  - /volume1/docker/youtube-jellyfin/config:/config
  - /volume1/docker/youtube-jellyfin/logs:/logs
```

### Network Configuration

```yaml
networks:
  youtube-jellyfin-net:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

## Video Processing Pipeline

### 1. Download Process

```javascript
const downloadOptions = {
  format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best',
  output: '%(title)s.%(ext)s',
  restrictFilenames: true,
  noPlaylist: true,
  writeSubtitles: true,
  writeAutomaticSub: true,
  subtitlesFormat: 'srt',
  embedSubs: true,
  embedThumbnail: true,
  writeThumbnail: true,
  writeDescription: true,
  writeInfoJson: true
};
```

### 2. FFmpeg Processing

```javascript
const ffmpegOptions = {
  videoBitrate: '4000k',
  audioBitrate: '320k',
  videoCodec: 'libx264',
  audioCodec: 'aac',
  format: 'mp4',
  preset: 'medium',
  crf: 22
};
```

### 3. Metadata Handling

```javascript
const metadataFields = {
  title: video.title,
  artist: video.uploader,
  date: video.upload_date,
  description: video.description,
  comment: `Downloaded from: ${video.webpage_url}`,
  genre: 'YouTube'
};
```

## Storage Management

### Directory Structure

```
/media/
├── movies/
│   ├── Movie1/
│   │   ├── Movie1.mp4
│   │   ├── Movie1.srt
│   │   └── metadata.json
│   └── Movie2/
├── shows/
│   └── Show1/
│       ├── Season 1/
│       └── metadata.json
└── temp/
    └── downloads/
```

### Cleanup Rules

```javascript
const cleanupRules = {
  tempFiles: {
    maxAge: '24h',
    pattern: '*.part'
  },
  failedDownloads: {
    maxAge: '7d',
    pattern: '*.failed'
  },
  logs: {
    maxAge: '30d',
    maxSize: '1GB'
  }
};
```

## Health Checks

### Container Health

```dockerfile
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```

### Process Monitoring

```javascript
const healthChecks = {
  disk: {
    threshold: '90%',
    path: '/media'
  },
  memory: {
    max: '80%'
  },
  cpu: {
    max: '90%'
  },
  queue: {
    maxSize: 100,
    maxWait: '1h'
  }
};
```

## Error Handling

### Download Failures

```javascript
const retryStrategy = {
  attempts: 3,
  delay: 5000,
  backoff: 2,
  maxDelay: 30000
};
```

### Processing Errors

```javascript
const errorHandling = {
  corrupted: {
    action: 'redownload',
    maxAttempts: 2
  },
  incomplete: {
    action: 'resume',
    maxAttempts: 3
  },
  conversion: {
    action: 'retry',
    maxAttempts: 2
  }
};
```

## Monitoring

### Logging Configuration

```javascript
const loggingConfig = {
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: '/logs/error.log',
      level: 'error'
    }),
    new winston.transports.File({
      filename: '/logs/combined.log'
    })
  ]
};
```

### Metrics

```javascript
const metrics = {
  counter: {
    downloads_total: 'Number of downloads',
    processing_errors: 'Processing errors count',
    successful_conversions: 'Successful video conversions'
  },
  gauge: {
    queue_size: 'Current queue size',
    processing_time: 'Video processing duration',
    storage_usage: 'Storage space usage'
  },
  histogram: {
    file_size: 'Distribution of file sizes',
    processing_duration: 'Distribution of processing times'
  }
};
```

## Maintenance

### Regular Tasks

1. Log Rotation
```bash
/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 node node
}
```

2. Temp Cleanup
```bash
find /media/temp -type f -mtime +1 -delete
```

3. Failed Downloads
```bash
find /media/temp -name "*.failed" -mtime +7 -delete
```

### Backup Strategy

```yaml
backup:
  config:
    frequency: daily
    retention: 7
    path: /volume1/backup/youtube-jellyfin
  data:
    frequency: weekly
    retention: 4
    excludes:
      - "*.part"
      - "*.temp"
      - "*.failed"
```

## Performance Tuning

### FFmpeg Optimization

```javascript
const ffmpegOptimization = {
  threads: 4,
  nice: 10,
  preset: 'medium',
  tune: 'film',
  movflags: '+faststart'
};
```

### Queue Management

```javascript
const queueConfig = {
  concurrency: 2,
  maxRetries: 3,
  timeout: 3600000,
  removeOnComplete: true,
  removeOnFail: false
};
``` 