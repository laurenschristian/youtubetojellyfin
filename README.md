# YouTube to Jellyfin Downloader

A service that downloads YouTube videos and organizes them for Jellyfin media server.

## Features

- Download YouTube videos directly to your Jellyfin media server
- Organize downloads as movies or TV shows
- Chrome extension for easy downloading
- API key authentication
- Progress tracking and download history
- Detailed logging for monitoring and debugging

## Production Deployment Guide

### Prerequisites

- Docker and Docker Compose installed on your server
- Git for cloning the repository
- A domain name (optional but recommended)

### Deployment Steps

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/youtubetojellyfin.git
   cd youtubetojellyfin
   ```

2. Create production environment file:
   ```bash
   cp .env.production .env
   ```

3. Edit the `.env` file with your production settings:
   - Generate a secure API key
   - Set your Chrome extension ID in CORS_ORIGIN
   - Configure media paths
   - Adjust logging level if needed

4. Build and start the container:
   ```bash
   docker-compose up -d --build
   ```

5. Monitor the logs:
   ```bash
   docker-compose logs -f
   ```

### Directory Structure

- `/config` - Configuration files
- `/downloads` - Temporary download directory
- `/completed` - Completed downloads
- `/logs` - Application logs
  - `combined.log` - All logs
  - `error.log` - Error logs only

### Logging

The application uses Winston for logging with the following levels:
- `error` - Error messages
- `warn` - Warning messages
- `info` - General information
- `debug` - Detailed debugging information

Logs are written to:
- Console (colored output)
- `/app/logs/combined.log` (all levels)
- `/app/logs/error.log` (error level only)

Docker container logs are also configured with:
- Max size: 10MB per file
- Max files: 3 (rotation)

### Health Checks

The application provides two health check endpoints:
- `/health` - Basic health check
- `/api/health` - API health check with additional information

### Environment Variables

Key environment variables for production:
- `NODE_ENV` - Set to "production"
- `API_KEY` - Your secure API key
- `CORS_ORIGIN` - Your Chrome extension ID
- `LOG_LEVEL` - Logging level (default: "info")

### Monitoring

1. Check application status:
   ```bash
   docker-compose ps
   ```

2. View logs:
   ```bash
   # All logs
   docker-compose logs -f

   # API service logs only
   docker-compose logs -f api

   # Last 100 lines
   docker-compose logs --tail=100 -f
   ```

3. Check the health endpoint:
   ```bash
   curl http://localhost:3001/api/health
   ```

### Troubleshooting

1. If the container fails to start:
   ```bash
   docker-compose logs api
   ```

2. Check error logs:
   ```bash
   tail -f logs/error.log
   ```

3. Verify permissions:
   ```bash
   ls -la downloads/ completed/ logs/
   ```

4. Restart the service:
   ```bash
   docker-compose restart api
   ```

### Security Considerations

1. Always use a strong API key
2. Keep your `.env` file secure
3. Regularly update dependencies
4. Monitor logs for suspicious activity
5. Use HTTPS in production

## Support

For issues and feature requests, please create an issue in the GitHub repository. 