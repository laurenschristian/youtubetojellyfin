# YouTube to Jellyfin Integration

A secure system for downloading YouTube videos directly to your Jellyfin media server running on a Synology NAS.

## Features

- Chrome extension for easy video saving from YouTube
- Secure backend API with JWT authentication
- Automatic video download and transcoding
- Direct integration with Jellyfin media libraries
- Cloudflare-ready for secure remote access
- Docker-based deployment

## Prerequisites

- Synology NAS with Docker installed
- Jellyfin Media Server
- Node.js 20+ (for development)
- Chrome/Chromium-based browser
- ffmpeg
- yt-dlp

## Installation

### Backend API

1. Clone this repository to your Synology NAS
2. Copy `.env.example` to `.env` and configure your settings
3. Build and run using Docker Compose:

```bash
docker-compose up -d
```

### Chrome Extension

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode"
3. Click "Load unpacked" and select the `extension` directory
4. Configure the extension with your API endpoint

## Configuration

### Environment Variables

- `JWT_SECRET`: Secret key for JWT token generation
- `CORS_ORIGIN`: Chrome extension ID for CORS
- `MEDIA_PATH`: Base path for media storage
- `API_RATE_LIMIT`: Request limit per window

### Media Paths

Configure your Jellyfin media paths in the `docker-compose.yml` file:

```yaml
volumes:
  - /volume1/media:/media
```

## Security

- All API endpoints are HTTPS-only
- JWT-based authentication
- Rate limiting enabled
- Input validation on all endpoints
- Minimal container privileges

## Development

1. Install dependencies:
```bash
npm install
```

2. Start development server:
```bash
npm run dev
```

3. Load the extension in Chrome developer mode

## Contributing

1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## License

MIT License

## Support

Create an issue in the GitHub repository for support requests. 