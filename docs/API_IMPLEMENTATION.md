# YouTube to Jellyfin API Implementation Plan

## Overview
This document outlines the implementation plan for the YouTube to Jellyfin API server, which will be deployed as a Docker container on a Synology NAS. The server will handle YouTube video downloads, transcoding, and integration with Jellyfin's media library.

## Architecture

### Components
1. **Docker Container**
   - Base image: Node.js 20 (Alpine-based for smaller size)
   - Additional components:
     - yt-dlp (YouTube downloader)
     - FFmpeg (transcoding)
     - Required system libraries

2. **API Server**
   - Framework: Express.js
   - Key features:
     - RESTful endpoints
     - Authentication middleware
     - Request validation
     - Error handling
     - Logging system

3. **Storage Management**
   - Volume mappings:
     - Download directory
     - Jellyfin media directory
     - Configuration files
   - Temporary storage for downloads
   - Organized media folders

4. **Cloudflare Integration**
   - Reverse proxy setup
   - SSL/TLS termination
   - Access control
   - Rate limiting
   - DDoS protection

## API Endpoints

### Core Endpoints
1. `POST /api/videos`
   - Request: YouTube URL, quality preferences, media type
   - Response: Download ID, status
   - Initiates download process

2. `GET /api/videos/:id`
   - Get download/processing status
   - Returns progress information

3. `GET /api/health`
   - Health check endpoint
   - Returns server status

4. `POST /api/auth`
   - Authentication endpoint
   - Validates Jellyfin credentials

### Administrative Endpoints
1. `GET /api/settings`
   - Retrieve server configuration

2. `PUT /api/settings`
   - Update server configuration

3. `GET /api/queue`
   - View download queue

## Implementation Phases

### Phase 1: Base Setup
1. Create Docker configuration
   - Dockerfile
   - docker-compose.yml
   - Environment configuration
   - Volume mappings

2. Set up Express.js server
   - Project structure
   - Basic middleware
   - Error handling
   - Logging

3. Implement authentication
   - Jellyfin integration
   - Token management
   - Middleware

### Phase 2: Core Functionality
1. YouTube download integration
   - yt-dlp wrapper
   - Quality selection
   - Progress tracking
   - Error handling

2. Media processing
   - FFmpeg integration
   - Transcoding options
   - Format standardization
   - Metadata extraction

3. Jellyfin integration
   - Media organization
   - Library updates
   - Metadata management

### Phase 3: Advanced Features
1. Queue management
   - Priority system
   - Concurrent downloads
   - Rate limiting

2. Error recovery
   - Failed download retry
   - Corrupt file detection
   - Cleanup routines

3. Monitoring
   - Resource usage
   - Download statistics
   - Health metrics

## Docker Configuration

### Environment Variables
```yaml
# Server configuration
PORT=3000
NODE_ENV=production
API_KEY=your_secure_key

# Jellyfin configuration
JELLYFIN_URL=http://your-jellyfin-server:8096
JELLYFIN_API_KEY=your_jellyfin_api_key

# Storage paths
DOWNLOAD_DIR=/downloads
MEDIA_DIR=/media
CONFIG_DIR=/config
COMPLETED_DIR=/media/completed  # Final destination for processed videos

# Processing options
MAX_CONCURRENT_DOWNLOADS=2
TRANSCODE_THREADS=4
VIDEO_QUALITY=bestvideo+bestaudio/best  # yt-dlp format string for highest quality
PREFERRED_FORMAT=mkv  # Output container format
```

### Volume Mappings
```yaml
volumes:
  - /volume1/docker/ytjf/config:/config
  - /volume1/docker/ytjf/downloads:/downloads
  - /volume1/media:/media
```

## Security Considerations

1. **Authentication**
   - JWT-based authentication
   - Rate limiting per user
   - API key validation

2. **Data Protection**
   - Secure storage of credentials
   - Encrypted communication
   - Input validation

3. **Resource Control**
   - Download size limits
   - Storage quotas
   - CPU/memory limits

4. **Network Security**
   - Cloudflare WAF rules
   - IP filtering
   - Request validation

## Monitoring and Maintenance

1. **Logging**
   - Application logs
   - Access logs
   - Error tracking
   - Performance metrics

2. **Backup Strategy**
   - Configuration backup
   - Database backup (if used)
   - Recovery procedures

3. **Updates**
   - Automated yt-dlp updates
   - Security patches
   - Dependency updates

## Development Workflow

1. **Local Development**
   - Development environment setup
   - Testing procedures
   - Code quality tools

2. **Deployment**
   - Build process
   - Testing
   - Rollback procedures

3. **Maintenance**
   - Monitoring setup
   - Update procedures
   - Troubleshooting guides

## Next Steps

1. Review and approve architecture and implementation plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Create test cases and documentation
5. Plan deployment strategy

## Questions for Review

1. Are there specific quality preferences or transcoding requirements?
2. Should we implement a user management system or rely solely on Jellyfin authentication?
3. Are there specific Synology NAS resource constraints to consider?
4. Should we implement a web interface for monitoring and management?
5. Are there specific logging or monitoring requirements?

## Media Processing Specifications

### Video Quality Settings
1. **Download Quality**
   - Use highest available quality from YouTube
   - Format string: `bestvideo+bestaudio/best`
   - Prefer VP9/OPUS codecs when available
   - Download separate video/audio streams and merge if necessary

2. **Processing Pipeline**
   - Download phase:
     - Download highest quality video stream
     - Download highest quality audio stream
     - Merge if downloaded separately
   - Post-processing:
     - Container format: MKV
     - Preserve original video codec when possible
     - Copy streams without re-encoding when format is compatible
     - Extract and embed metadata

3. **File Organization**
   - Downloads go to temporary directory (`DOWNLOAD_DIR`)
   - Processed files moved to completion directory (`COMPLETED_DIR`)
   - Organized by content type (movies/shows)
   - Metadata files stored alongside media

4. **Quality Verification**
   - Verify download integrity
   - Check video/audio stream quality
   - Validate final file format
   - Ensure metadata is properly embedded 