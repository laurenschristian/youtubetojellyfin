# Cloudflare Integration Guide

## Overview

This guide explains how to securely expose your YouTube to Jellyfin API using Cloudflare as a reverse proxy. This setup provides:
- SSL/TLS encryption
- DDoS protection
- Access control
- Rate limiting
- Web Application Firewall (WAF)

## Prerequisites

1. Domain name with DNS managed by Cloudflare
2. Cloudflare account
3. API running in Docker on Synology NAS

## Setup Steps

### 1. Cloudflare DNS Configuration

1. Add DNS record:
```
Type: A
Name: api
Content: Your Synology NAS IP
Proxy status: Proxied
```

2. Configure SSL/TLS:
- Set SSL/TLS encryption mode to "Full (strict)"
- Enable "Always Use HTTPS"
- Enable "Minimum TLS Version" (TLS 1.2)

### 2. Security Settings

#### SSL/TLS Configuration
```yaml
# Recommended SSL/TLS settings
SSL/TLS: Full (strict)
Min TLS Version: 1.2
TLS 1.3: Enabled
HSTS: Enabled
  - Max Age: 1 year
  - Include subdomains: Yes
  - Preload: Yes
```

#### Firewall Rules

1. Basic Protection:
```
# Block non-API paths
IF (http.request.uri.path not contains "/api")
THEN
  Block
```

2. Rate Limiting:
```
# Limit requests per IP
IF (ip.src in {known_api_users})
THEN
  Rate limit (100 requests per minute)
ELSE
  Rate limit (10 requests per minute)
```

3. Origin Protection:
```
# Allow only extension requests
IF (not http.request.headers["Origin"] contains "chrome-extension://")
THEN
  Block
```

### 3. Access Rules

Create these rules in Cloudflare's Security settings:

1. IP Access Rules:
```
# Block suspicious IPs
Action: Block
Scope: IP Range
Value: Known malicious IP ranges

# Allow trusted IPs
Action: Allow
Scope: IP Address
Value: Your trusted IP addresses
```

2. User Agent Blocking:
```
# Block common bot user agents
Expression: http.user_agent contains "bot|crawler|spider"
Action: Block
```

### 4. API Configuration

Update your API's CORS settings to work with Cloudflare:

```javascript
app.use(cors({
  origin: [
    'chrome-extension://your-extension-id',
    'https://your-domain.com'
  ],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // 24 hours
}));
```

### 5. Cloudflare Workers (Optional)

Use this Worker script for additional security:

```javascript
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // Verify request origin
  const origin = request.headers.get('Origin')
  if (!origin?.includes('chrome-extension://')) {
    return new Response('Unauthorized', { status: 403 })
  }

  // Rate limiting
  const ip = request.headers.get('CF-Connecting-IP')
  const rateLimitKey = `rate_limit:${ip}`
  
  // Add custom headers
  let response = await fetch(request)
  response = new Response(response.body, response)
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}
```

## Security Best Practices

### 1. API Protection

- Enable Cloudflare's WAF
- Set up rate limiting
- Use Cloudflare Access for admin endpoints
- Enable logging and monitoring

### 2. SSL/TLS Security

- Force HTTPS
- Use TLS 1.2 or higher
- Enable HSTS
- Configure secure cipher suites

### 3. CORS Configuration

- Limit allowed origins
- Restrict HTTP methods
- Set appropriate max age
- Validate headers

### 4. Rate Limiting

- Set appropriate limits
- Different limits for authenticated users
- Monitor and adjust as needed

## Monitoring

### 1. Analytics

Enable Cloudflare Analytics to monitor:
- Request volume
- Error rates
- Cache performance
- Security events

### 2. Alerts

Set up alerts for:
- High error rates
- DDoS attacks
- SSL/TLS issues
- Origin server problems

## Troubleshooting

### Common Issues

1. CORS Errors
```
Solution: Verify Cloudflare Worker is properly handling CORS headers
```

2. Rate Limiting
```
Solution: Adjust rate limits in Cloudflare dashboard
```

3. SSL/TLS Errors
```
Solution: Check certificate configuration and TLS version
```

### Debug Tools

1. Cloudflare Ray ID
- Found in response headers
- Use for tracking requests

2. Development Mode
- Temporarily bypass cache
- Test configuration changes

## Maintenance

### Regular Tasks

1. Certificate rotation
2. Rule updates
3. IP allowlist maintenance
4. Security policy review

### Monitoring

1. Check analytics dashboard
2. Review security events
3. Update blocked IPs
4. Verify rate limits 