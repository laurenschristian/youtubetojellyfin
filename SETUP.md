# YouTube to Jellyfin Downloader - Setup Guide

This guide will help you set up the YouTube to Jellyfin downloader on your Synology NAS using Docker.

## Prerequisites

- Synology NAS with Docker package installed
- Basic knowledge of Docker and terminal commands
- SSH access to your NAS (optional but recommended)
- Shared folder on your NAS for storing downloaded videos

## Installation Steps

### 1. Prepare the Storage

1. Create a shared folder on your NAS for storing downloaded videos:
   - Open Synology DSM
   - Go to Control Panel > Shared Folder
   - Click "Create" and name it (e.g., "youtube_downloads")
   - Set appropriate permissions

2. Note down the absolute path to this folder:
   ```
   /volume1/youtube_downloads
   ```

### 2. Set Up Docker

1. Install Docker Package from Synology Package Center if not already installed

2. Create a docker-compose.yml file:
   ```yaml
   version: '3.8'
   services:
     youtubetojellyfin:
       image: ghcr.io/your-username/youtubetojellyfin:latest
       container_name: youtubetojellyfin
       ports:
         - "3001:3001"  # Adjust port if needed
       environment:
         - API_KEY=your_secure_api_key_here  # Change this!
         - OUTPUT_DIR=/downloads
         - MAX_CONCURRENT_DOWNLOADS=2
         - JELLYFIN_HOST=http://your.jellyfin.host  # Optional
         - JELLYFIN_API_KEY=your_jellyfin_api_key   # Optional
       volumes:
         - /volume1/youtube_downloads:/downloads
       restart: unless-stopped
   ```

### 3. Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `API_KEY` | Secure key for API authentication | Yes | - |
| `OUTPUT_DIR` | Directory where videos are saved | Yes | /downloads |
| `MAX_CONCURRENT_DOWNLOADS` | Maximum parallel downloads | No | 2 |
| `JELLYFIN_HOST` | Your Jellyfin server URL | No | - |
| `JELLYFIN_API_KEY` | Jellyfin API key for auto-import | No | - |

### 4. Deployment

1. SSH into your Synology NAS or use the Docker UI

2. Using SSH:
   ```bash
   # Create a directory for the project
   mkdir -p /volume1/docker/youtubetojellyfin
   cd /volume1/docker/youtubetojellyfin
   
   # Create docker-compose.yml (paste content from step 2)
   nano docker-compose.yml
   
   # Pull the latest image
   docker-compose pull
   
   # Start the container
   docker-compose up -d
   ```

3. Using Synology Docker UI:
   - Open Docker package
   - Go to Registry
   - Search for ghcr.io/your-username/youtubetojellyfin
   - Download the image
   - Create container with the settings from docker-compose.yml

### 5. Verify Installation

1. Check if the container is running:
   ```bash
   docker ps | grep youtubetojellyfin
   ```

2. Check container logs:
   ```bash
   docker logs youtubetojellyfin
   ```

3. Test the API:
   ```bash
   curl -X GET http://your.nas.ip:3001/api/health \
     -H "X-API-Key: your_api_key_here"
   ```

4. Verify folder permissions:
   ```bash
   # Check if the container can write to the output directory
   docker exec youtubetojellyfin ls -la /downloads
   ```

### 6. Chrome Extension Setup

1. Install the Chrome extension
2. Open extension settings
3. Configure:
   - API URL: `http://your.nas.ip:3001/api`
   - API Key: The same key set in docker-compose.yml

### 7. Troubleshooting

1. Permission Issues:
   ```bash
   # Fix permissions on the downloads directory
   chmod -R 755 /volume1/youtube_downloads
   chown -R your_user:users /volume1/youtube_downloads
   ```

2. Network Issues:
   - Ensure port 3001 is accessible
   - Check your NAS firewall settings
   - Verify Docker network settings

3. Common Problems:
   - If downloads fail, check container logs
   - Ensure enough disk space is available
   - Verify API key is correctly set in both server and extension

### 8. Maintenance

1. Update the container:
   ```bash
   cd /volume1/docker/youtubetojellyfin
   docker-compose pull
   docker-compose up -d
   ```

2. Monitor disk usage:
   ```bash
   du -sh /volume1/youtube_downloads
   ```

3. Clean up old containers:
   ```bash
   docker system prune
   ```

## Security Considerations

1. Use a strong API key
2. Keep your Docker container updated
3. Use HTTPS if exposing the service to the internet
4. Regularly check container logs for suspicious activity
5. Limit access to the downloads directory

## Additional Tips

1. Set up automatic Jellyfin library scanning
2. Configure download quality preferences
3. Set up disk space monitoring
4. Create backup procedures for your configuration
5. Monitor container resource usage

For more information or support, visit the GitHub repository or open an issue. 