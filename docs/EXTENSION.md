# Chrome Extension Documentation

## Overview

The YouTube to Jellyfin Chrome extension provides a seamless way to save YouTube videos directly to your Jellyfin media server. It integrates with YouTube's interface and provides a simple, user-friendly way to download and organize videos.

## Features

- Direct integration with YouTube's interface
- Custom "Save to Jellyfin" button on video pages
- Context menu integration for video links
- Video quality selection
- Custom title support
- Progress tracking
- Authentication management
- Configurable API endpoint

## Installation

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked" and select the `extension` directory
4. Configure the extension with your API endpoint in the options page

## Configuration

### API Settings
1. Click the extension icon and select "Configure API Settings"
2. Enter your API endpoint URL (e.g., `https://your-domain.com/api`)
3. Click "Save Settings"

### Download Settings
- **Video Quality**: Choose from Best, 1080p, 720p, or 480p
- **Default Content Type**: Select Movie or TV Show as default
- **Custom Titles**: Optionally specify custom titles for videos

## Usage

### From Video Pages
1. Navigate to a YouTube video
2. Click the "Save to Jellyfin" button below the video
3. Configure download options
4. Click "Save"

### From Context Menu
1. Right-click any YouTube video link
2. Select "Save to Jellyfin"
3. Configure download options
4. Click "Save"

## Authentication

The extension requires authentication with your Jellyfin API:
1. First-time setup requires logging in
2. Authentication token is securely stored
3. Token automatically refreshes when needed

## Files

### Main Components
- `manifest.json`: Extension configuration
- `popup.html/js`: Main interface
- `options.html/js`: Settings page
- `login.html/js`: Authentication
- `background.js`: Background processes
- `content.js`: YouTube page integration

### Key Functions

#### Content Script (`content.js`)
- Injects "Save to Jellyfin" button
- Monitors page navigation
- Extracts video information

#### Background Script (`background.js`)
- Handles context menu
- Manages authentication
- Coordinates popups

#### Popup (`popup.js`)
- Handles video downloads
- Shows progress
- Manages settings

## Security

- Secure token storage
- HTTPS-only API communication
- Input validation
- Error handling

## Troubleshooting

### Common Issues

1. Button not appearing
   - Refresh the page
   - Check if on a valid YouTube video page

2. Download fails
   - Verify API endpoint configuration
   - Check authentication
   - Confirm network connectivity

3. Settings not saving
   - Check permissions
   - Clear extension storage and reconfigure

### Error Messages

- "Please navigate to a YouTube video page"
  - Only appears on non-video pages
  
- "API endpoint not configured"
  - Configure API endpoint in settings

- "Authentication required"
  - Log in again through the extension

## Development

### Building
```bash
# Install dependencies
npm install

# Build extension
npm run build
```

### Testing
```bash
# Run tests
npm test

# Lint code
npm run lint
```

### Contributing
1. Fork the repository
2. Create a feature branch
3. Submit a pull request

## Support

For issues and feature requests:
1. Check the troubleshooting guide
2. Search existing issues
3. Create a new issue if needed 