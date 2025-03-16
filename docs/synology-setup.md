# Setting up YouTube to Jellyfin on Synology NAS

This guide will help you set up the YouTube to Jellyfin downloader on your Synology NAS using Docker.

## Prerequisites

1. A Synology NAS with Docker package installed
2. DSM 7.0 or later
3. At least 10GB of free space
4. Basic knowledge of using Synology DSM and Docker

## Installation Steps

### 1. Prepare the Environment

1. Open **File Station** and create the following directory structure:
   ```
   docker/
   └── youtube-to-jellyfin/
       ├── config/
       ├── downloads/
       └── completed/
   ```

2. Set appropriate permissions:
   - Navigate to the `youtube-to-jellyfin` folder
   - Right-click → Properties
   - Set owner to your admin user
   - Set group to `users`
   - Check "Apply to all subfolders"
   - Click "OK"

### 2. Install Docker

1. Open **Package Center**
2. Search for "Docker"
3. Click "Install"
4. Wait for installation to complete

### 3. Create Environment File

1. Using a text editor, create a file named `.env` in the `docker/youtube-to-jellyfin` directory with the following content:
   ```env
   API_KEY=your_secure_api_key_here
   DOWNLOAD_DIR=/downloads
   COMPLETED_DIR=/completed
   MAX_CONCURRENT_DOWNLOADS=2
   NODE_ENV=production
   ```

   Replace `your_secure_api_key_here` with a strong, random string.

### 4. Set Up Docker Container

1. Open **Docker** in DSM
2. Go to "Registry"
3. Search for your Docker image
4. Download the image by clicking "Download"

### 5. Create Container

1. In Docker, go to "Container"
2. Click "Create" → "Advanced Settings"
3. Configure the following:

   **Basic Settings:**
   - Container Name: youtube-to-jellyfin
   - Enable auto-restart

   **Volume Settings:**
   - Add the following folder mappings:
     ```
     docker/youtube-to-jellyfin/config → /config
     docker/youtube-to-jellyfin/downloads → /downloads
     docker/youtube-to-jellyfin/completed → /completed
     ```

   **Port Settings:**
   - Local Port: 3000
   - Container Port: 3000

   **Environment:**
   - Click "Import from file" and select your `.env` file

4. Click "Apply" to create the container

### 6. Start the Container

1. Select the container in the list
2. Click "Start"
3. Wait for the container to start (check logs for any errors)

## Testing the Setup

1. Test the API health endpoint:
   ```bash
   curl http://your-nas-ip:3000/api/health
   ```

2. Try downloading a video:
   ```bash
   curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-API-Key: your_api_key_here" \
     -d '{"url":"https://www.youtube.com/watch?v=example","type":"movie"}' \
     http://your-nas-ip:3000/api/videos
   ```

## Maintenance

### Updating the Container

1. In Docker, go to "Registry"
2. Find your image and click "Download"
3. Go to "Container"
4. Stop the existing container
5. Clear the container
6. Start the container again

### Monitoring

1. Check container logs in Docker UI
2. Monitor disk space usage
3. Review the logs in `config/video-service.log`

### Troubleshooting

Common issues and solutions:

1. **Container won't start:**
   - Check logs for errors
   - Verify environment variables
   - Ensure ports are not in use

2. **Permission errors:**
   - Check folder permissions
   - Verify user/group settings

3. **Download failures:**
   - Check available disk space
   - Verify network connectivity
   - Review log files for specific errors

4. **API connection issues:**
   - Verify firewall settings
   - Check if the container is running
   - Confirm port forwarding settings

## Security Considerations

1. **API Key:**
   - Use a strong, random API key
   - Keep your `.env` file secure
   - Don't expose the API to the internet without proper security measures

2. **Network Security:**
   - Use a reverse proxy if exposing to the internet
   - Enable HTTPS
   - Implement IP whitelisting if possible

3. **File Permissions:**
   - Keep permissions as restrictive as possible
   - Regularly audit access logs
   - Back up configuration files

## Backup

1. **Configuration:**
   - Back up the entire `docker/youtube-to-jellyfin` directory
   - Store `.env` file securely
   - Document any custom settings

2. **Data:**
   - Include the `completed` directory in your backup strategy
   - Consider using Synology's built-in backup tools

## Additional Tips

1. **Performance:**
   - Monitor resource usage
   - Adjust `MAX_CONCURRENT_DOWNLOADS` based on your NAS capabilities
   - Consider using SSD storage for the download directory

2. **Integration with Jellyfin:**
   - Configure Jellyfin to scan the `completed` directory
   - Set up appropriate libraries in Jellyfin
   - Use consistent naming conventions

3. **Automation:**
   - Consider setting up scheduled tasks for maintenance
   - Implement monitoring alerts
   - Use Docker's auto-restart feature 