# Shopify MCP - Remote Server Setup

This document explains how to deploy and use the Shopify MCP server as a remote HTTP server with OAuth authentication.

> **Note**: Deployment configuration files (like `render.yaml`, `Dockerfile`, etc.) are intentionally not included in the npm package. This guide provides examples you can create in your own deployment repository.

## Overview

The Shopify MCP server can run in two modes:

1. **Local (stdio)** - Original mode for local Claude Desktop integration
2. **Remote (HTTP)** - New mode for web-based access with OAuth authentication

## Architecture

The remote server implementation follows the MCP Streamable HTTP transport specification:

- **HTTP Server**: Express.js server wrapping the MCP server
- **Authentication**: OAuth 2.0 via Auth0 with token caching
- **Session Management**: Stateful sessions with UUID identifiers
- **Transport**: Supports both SSE streaming and JSON responses
- **Endpoints**:
  - `POST /mcp` - MCP JSON-RPC requests
  - `GET /mcp` - SSE stream for notifications
  - `DELETE /mcp` - Session termination
  - `GET /health` - Health check (no auth)
  - `GET /.well-known/mcp-oauth` - OAuth discovery (no auth)

## Deployment on Render

### Prerequisites

1. A Render.com account
2. An Auth0 account with an application configured
3. Your Shopify store credentials

### Step 1: Fork/Clone Repository

```bash
git clone https://github.com/tzenderman/shopify-mcp.git
cd shopify-mcp
```

### Step 2: Configure Auth0

#### Create Application

1. Create an Auth0 application (Regular Web Application)
2. Note your:
   - Domain (e.g., `dev-abc123.us.auth0.com`)
   - Client ID
   - Audience (create an API in Auth0 if needed)

#### Configure for 30-Day Sessions

**CRITICAL**: To enable 30-day sessions and prevent daily logouts, configure these settings in the Auth0 application whose `client_id` you'll use:

**Application > Settings > Application URIs:**
- Add `https://claude.ai/api/mcp/auth_callback` to **Allowed Callback URLs**
- Add your server URL to **Allowed Web Origins** (e.g., `https://shopify-mcp.onrender.com`)

**Application > Settings > Advanced Settings > Grant Types:**
- ✅ Enable **Authorization Code**
- ✅ Enable **Refresh Token**

**Application > Settings > Advanced Settings > OAuth:**
- **Refresh Token Rotation**: Enable (toggle ON)
- **Refresh Token Expiration**: Set to `2592000` seconds (30 days)
- **Absolute Lifetime**: Enable (toggle ON)

**Why These Settings Matter:**
- Without **Refresh Token Rotation** enabled, access tokens expire after 24 hours with no way to refresh
- The `offline_access` scope (included in all OAuth endpoints) requests refresh tokens
- With these settings, Claude Desktop automatically refreshes tokens for 30 days without re-authentication
- The server does NOT advertise dynamic client registration, so Claude Desktop uses your configured `AUTH0_CLIENT_ID`

### Step 3: Create Render Configuration

Create a `render.yaml` file in your project root (this file is gitignored and not in the npm package):

```yaml
services:
  - type: web
    name: shopify-mcp
    env: node
    buildCommand: npm install && npm run build
    startCommand: npm run start:http
    envVars:
      # Shopify Store Configuration (managed in Render dashboard)
      - key: SHOPIFY_STORES
        sync: false
      # Auth0 OAuth Configuration
      - key: AUTH0_DOMAIN
        sync: false
      - key: AUTH0_CLIENT_ID
        sync: false
      - key: AUTH0_AUDIENCE
        sync: false
      - key: MCP_SERVER_URL
        sync: false
      # Server Configuration
      - key: PORT
        value: "8000"
      - key: TOKEN_CACHE_TTL_SECONDS
        value: "120"
      - key: TOKEN_CACHE_MAX_SIZE
        value: "1000"
      - key: NODE_ENV
        value: production
```

### Step 4: Deploy to Render

1. Push your code to GitHub
2. Create a new Web Service in Render
3. Connect your repository
4. Render will automatically detect `render.yaml`
5. Configure environment variables in Render dashboard:

#### Required Environment Variables

**Shopify Configuration:**
- `SHOPIFY_STORES` - JSON array of store configurations:
  ```json
  [
    {
      "id": "my-store",
      "domain": "my-store.myshopify.com",
      "accessToken": "shpat_...",
      "apiVersion": "2024-01"
    }
  ]
  ```

  OR use legacy single-store format:
  - `SHOPIFY_STORE_DOMAIN` - Your store domain (e.g., `my-store.myshopify.com`)
  - `SHOPIFY_ACCESS_TOKEN` - Your Shopify access token
  - `SHOPIFY_API_VERSION` - API version (default: `2024-01`)

**Auth0 Configuration:**
- `AUTH0_DOMAIN` - Your Auth0 domain
- `AUTH0_CLIENT_ID` - Your Auth0 client ID
- `AUTH0_AUDIENCE` - Your Auth0 API audience
- `MCP_SERVER_URL` - Your deployed server URL (e.g., `https://shopify-mcp.onrender.com`)

**Optional:**
- `PORT` - Server port (default: 8000)
- `TOKEN_CACHE_TTL_SECONDS` - Token cache duration (default: 120)
- `TOKEN_CACHE_MAX_SIZE` - Max cached tokens (default: 1000)

### Step 5: Verify Deployment

Once deployed, test the health endpoint:

```bash
curl https://your-app.onrender.com/health
```

Expected response:
```json
{
  "status": "ok",
  "transport": "streamable-http",
  "token_cache": {
    "size": 0,
    "active": 0,
    "ttl_seconds": 120,
    "max_size": 1000
  }
}
```

## Local Development

### Running the HTTP Server Locally

```bash
# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your configuration

# Run in development mode
npm run dev:http

# Or build and run
npm run build
npm run start:http
```

The server will start on `http://localhost:8000`.

### Testing with MCP Inspector

```bash
# Install MCP Inspector
npx @modelcontextprotocol/inspector http://localhost:8000/mcp
```

## OAuth Authentication

The server implements OAuth 2.1 with Auth0 following the MCP Authorization specification:

### Token Flow

1. **Discovery**: MCP clients discover OAuth endpoints via `/.well-known/oauth-protected-resource` (RFC9728)
2. **Authorization**: Uses Authorization Code flow with PKCE
3. **Resource Binding**: Tokens are bound to `MCP_SERVER_URL` via the `resource` parameter (RFC8707)
4. **Validation**: Tokens validated via Auth0's `/userinfo` endpoint
5. **Caching**: Valid tokens cached (SHA256 hashed) for 2 minutes by default

### Token Caching

- Tokens are hashed (SHA256) before caching - never stored in plaintext
- JWT expiry claims are validated if present
- Cache TTL is minimum of `TOKEN_CACHE_TTL_SECONDS` and JWT expiry
- Default 2-minute cache window balances security (revocation delay) and performance
- Cache statistics available at `/health` endpoint
- Cache size capped at 1000 tokens (configurable via `TOKEN_CACHE_MAX_SIZE`)

### Security Features

**Token Security:**
- Tokens hashed (SHA256) before caching - never stored in plaintext
- JWT expiry claims validated if present
- Cache TTL is minimum of `TOKEN_CACHE_TTL_SECONDS` and JWT expiry
- Automatic cache eviction for expired and oldest tokens
- Token audience validation via `resource` parameter (RFC8707)
- WWW-Authenticate headers on 401 responses (RFC9728)

**Protocol Compliance:**
- OAuth 2.1 with PKCE (Proof Key for Code Exchange)
- RFC9728: OAuth 2.0 Protected Resource Metadata
- RFC8707: Resource Indicators for OAuth 2.0
- RFC8414: OAuth 2.0 Authorization Server Metadata

**Additional Security:**
- CORS enabled with credential support
- Host/Origin validation available (DNS rebinding protection)
- No dynamic client registration (uses pre-configured client_id)
- Refresh token rotation for 30-day sessions

## Connecting from Claude Desktop

Add to your Claude Desktop configuration:

```json
{
  "mcpServers": {
    "shopify": {
      "url": "https://your-app.onrender.com/mcp",
      "transport": "http",
      "oauth": {
        "authorizationEndpoint": "https://YOUR_DOMAIN.auth0.com/authorize",
        "tokenEndpoint": "https://YOUR_DOMAIN.auth0.com/oauth/token",
        "clientId": "YOUR_CLIENT_ID",
        "scopes": ["openid", "profile", "email"]
      }
    }
  }
}
```

Claude Desktop will:
1. Discover OAuth configuration via `/.well-known/mcp-oauth`
2. Initiate OAuth flow when first connecting
3. Store and refresh tokens automatically
4. Include Bearer token in all MCP requests

## API Reference

### Health Check

```http
GET /health
```

No authentication required. Returns server status and token cache statistics.

### OAuth Discovery

```http
GET /.well-known/mcp-oauth
```

Returns OAuth configuration for MCP clients.

### MCP Endpoint

```http
POST /mcp
Authorization: Bearer <token>
Mcp-Session-Id: <session-id>
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "method": "tools/list",
  "id": 1
}
```

Requires OAuth authentication. Session ID is returned in response headers for initialization requests.

## Monitoring

Check the Render dashboard for:
- Logs and error messages
- Health check status
- Resource usage
- Token cache statistics (via `/health` endpoint)

## Troubleshooting

### 401 Unauthorized

- Verify Auth0 configuration is correct
- Check token is being sent in Authorization header
- Verify token hasn't expired
- Check Auth0 dashboard for token introspection errors

### 400 Bad Request

- Ensure session ID is included for non-initialization requests
- Verify request body is valid JSON-RPC
- Check MCP protocol version compatibility

### 500 Internal Server Error

- Check Render logs for detailed error messages
- Verify all environment variables are set correctly
- Ensure Shopify credentials are valid

## Differences from Local Mode

| Feature | Local (stdio) | Remote (HTTP) |
|---------|---------------|---------------|
| Transport | stdio | HTTP + SSE |
| Authentication | None | OAuth 2.0 |
| Session Management | None | UUID-based |
| Multi-user | No | Yes |
| Deployment | Local only | Cloud-hosted |
| Access | Single user | Multiple users |

## Performance Considerations

- Token validation is cached for 2 minutes by default
- Increase `TOKEN_CACHE_TTL_SECONDS` for better performance (lower security)
- Decrease for more frequent token revalidation (higher security)
- Cache size limit prevents memory exhaustion
- SSE streams are more efficient than polling for notifications

## Security Best Practices

1. Use HTTPS in production (Render provides this automatically)
2. Keep `TOKEN_CACHE_TTL_SECONDS` reasonable (120s default)
3. Rotate Shopify access tokens regularly
4. Use Auth0 token rotation
5. Monitor `/health` endpoint for unusual cache patterns
6. Enable DNS rebinding protection if needed:
   ```env
   ENABLE_DNS_REBINDING_PROTECTION=true
   ALLOWED_HOSTS=your-app.onrender.com
   ALLOWED_ORIGINS=https://claude.ai
   ```

## License

MIT - See LICENSE file for details
