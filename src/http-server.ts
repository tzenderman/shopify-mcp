#!/usr/bin/env node

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { createHash } from 'node:crypto';
import dotenv from 'dotenv';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { createShopifyMcpServer } from './index.js';

dotenv.config();

// Token validation cache
// Maps SHA256(token) -> (user_info, expiry_timestamp)
const _tokenCache: Map<string, { userInfo: any; expiry: number }> = new Map();
const TOKEN_CACHE_TTL = parseInt(process.env.TOKEN_CACHE_TTL_SECONDS || '120', 10) * 1000; // Convert to ms
const TOKEN_CACHE_MAX_SIZE = parseInt(process.env.TOKEN_CACHE_MAX_SIZE || '1000', 10);

// Auth0 OAuth Configuration
const AUTH0_DOMAIN = process.env.AUTH0_DOMAIN;
const AUTH0_AUDIENCE = process.env.AUTH0_AUDIENCE;
const AUTH0_CLIENT_ID = process.env.AUTH0_CLIENT_ID;
const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'https://shopify-mcp.onrender.com';

/**
 * Hash token using SHA256 to prevent plaintext storage in cache
 */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Extract expiry timestamp from JWT token if possible
 * Returns null if token is opaque (not JWT) or cannot be parsed
 */
function getTokenExpiry(token: string): number | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (add padding if needed)
    const payloadB64 = parts[1];
    const padding = '='.repeat((4 - (payloadB64.length % 4)) % 4);
    const payloadJson = Buffer.from(payloadB64 + padding, 'base64').toString();
    const payload = JSON.parse(payloadJson);

    // Extract exp claim if present
    const exp = payload.exp;
    if (exp && typeof exp === 'number') {
      return exp * 1000; // Convert to milliseconds
    }

    return null;
  } catch {
    // Token is opaque or encrypted (JWE) - cannot parse
    return null;
  }
}

/**
 * Verify Auth0 token using the /userinfo endpoint with caching
 */
async function verifyOAuthToken(token: string): Promise<any | null> {
  if (!AUTH0_DOMAIN) {
    console.error('AUTH0_DOMAIN not configured');
    return null;
  }

  // Hash token to prevent plaintext storage
  const tokenHash = hashToken(token);

  // Check if JWT has expired (if parseable)
  const tokenExpiry = getTokenExpiry(token);
  const now = Date.now();

  if (tokenExpiry && now >= tokenExpiry) {
    console.warn('Token has expired (JWT exp claim)');
    _tokenCache.delete(tokenHash);
    return null;
  }

  // Check cache
  const cached = _tokenCache.get(tokenHash);
  if (cached && now < cached.expiry) {
    console.debug(`Token validated from cache. User: ${cached.userInfo.email || cached.userInfo.sub || 'unknown'}`);
    return cached.userInfo;
  } else if (cached) {
    // Expired - remove from cache
    console.debug('Cached token expired, re-validating');
    _tokenCache.delete(tokenHash);
  }

  try {
    const userinfoUrl = `https://${AUTH0_DOMAIN}/userinfo`;

    const response = await fetch(userinfoUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      console.warn(`Token validation via /userinfo failed with status ${response.status}`);
      return null;
    }

    const userInfo = await response.json();
    console.log(`Token validated via Auth0. User: ${userInfo.email || userInfo.sub || 'unknown'}`);

    // Calculate cache expiry: minimum of cache TTL and token expiry
    const cacheExpiry = now + TOKEN_CACHE_TTL;
    const expiry = tokenExpiry ? Math.min(cacheExpiry, tokenExpiry) : cacheExpiry;

    // Cache the result
    _tokenCache.set(tokenHash, { userInfo, expiry });

    // Enforce cache size limit
    if (_tokenCache.size > TOKEN_CACHE_MAX_SIZE) {
      // Remove oldest (lowest expiry)
      const sorted = Array.from(_tokenCache.entries()).sort((a, b) => a[1].expiry - b[1].expiry);
      const toRemove = _tokenCache.size - TOKEN_CACHE_MAX_SIZE;
      for (let i = 0; i < toRemove; i++) {
        _tokenCache.delete(sorted[i][0]);
      }
      console.debug(`Evicted ${toRemove} tokens to enforce cache size limit`);
    }

    return userInfo;
  } catch (error) {
    console.error('OAuth verification error:', error);
    return null;
  }
}

/**
 * Auth middleware for protecting MCP endpoints
 */
async function authMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Skip auth for health check, OAuth discovery, and CORS preflight
  if (req.path === '/health' || req.path.startsWith('/.well-known/') || req.method === 'OPTIONS') {
    return next();
  }

  // Require OAuth for /mcp endpoints
  if (req.path.startsWith('/mcp')) {
    if (!AUTH0_DOMAIN) {
      console.error('AUTH0_DOMAIN not configured - OAuth required');
      res.status(500).send('Server misconfigured');
      return;
    }

    const authHeader = req.headers.authorization || '';
    const token = authHeader.replace('Bearer ', '').trim();

    if (!token) {
      console.warn('No authorization token provided');
      // RFC9728: Include WWW-Authenticate header with resource metadata URL
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${MCP_SERVER_URL}", resource_metadata="${MCP_SERVER_URL}/.well-known/oauth-protected-resource"`
      );
      res.status(401).send('Unauthorized - No token');
      return;
    }

    // Verify OAuth token
    console.debug(`Validating OAuth token for request from ${req.ip}`);
    const userInfo = await verifyOAuthToken(token);

    if (!userInfo) {
      console.warn(`✗ OAuth authentication failed from ${req.ip}`);
      // RFC9728: Include WWW-Authenticate header with resource metadata URL
      res.setHeader(
        'WWW-Authenticate',
        `Bearer realm="${MCP_SERVER_URL}", error="invalid_token", resource_metadata="${MCP_SERVER_URL}/.well-known/oauth-protected-resource"`
      );
      res.status(401).send('Unauthorized');
      return;
    }

    // Successfully authenticated
    const email = userInfo.email || 'unknown';
    console.log(`✓ OAuth authenticated: ${email}`);
    return next();
  }

  next();
}

// Create Express app
const app = express();
app.use(express.json());

// Add CORS middleware
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['*'],
  exposedHeaders: ['Mcp-Session-Id'],
}));

// Health check endpoint
app.get('/health', (req, res) => {
  const now = Date.now();
  const activeTokens = Array.from(_tokenCache.values()).filter(v => now < v.expiry).length;

  res.json({
    status: 'ok',
    transport: 'streamable-http',
    token_cache: {
      size: _tokenCache.size,
      active: activeTokens,
      ttl_seconds: TOKEN_CACHE_TTL / 1000,
      max_size: TOKEN_CACHE_MAX_SIZE,
    },
  });
});

// OAuth discovery endpoint
app.get('/.well-known/mcp-oauth', (req, res) => {
  if (!AUTH0_DOMAIN || !AUTH0_CLIENT_ID) {
    res.status(501).send('OAuth not configured on this server');
    return;
  }

  res.json({
    authorizationEndpoint: `https://${AUTH0_DOMAIN}/authorize`,
    tokenEndpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    clientId: AUTH0_CLIENT_ID,
    scopes: ['openid', 'profile', 'email', 'offline_access'],
  });
});

// RFC 8414 OAuth 2.0 metadata
app.get('/.well-known/oauth-authorization-server', (req, res) => {
  if (!AUTH0_DOMAIN) {
    res.status(501).send('OAuth not configured on this server');
    return;
  }

  res.json({
    issuer: `https://${AUTH0_DOMAIN}/`,
    authorization_endpoint: `https://${AUTH0_DOMAIN}/authorize`,
    token_endpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code'],
  });
});

app.get('/.well-known/oauth-authorization-server/mcp', (req, res) => {
  if (!AUTH0_DOMAIN) {
    res.status(501).send('OAuth not configured on this server');
    return;
  }

  res.json({
    issuer: `https://${AUTH0_DOMAIN}/`,
    authorization_endpoint: `https://${AUTH0_DOMAIN}/authorize`,
    token_endpoint: `https://${AUTH0_DOMAIN}/oauth/token`,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    response_types_supported: ['code'],
  });
});

app.get('/.well-known/oauth-protected-resource', (req, res) => {
  if (!AUTH0_DOMAIN) {
    res.status(501).send('OAuth not configured on this server');
    return;
  }

  res.json({
    resource: MCP_SERVER_URL,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    authorization_servers: [`https://${AUTH0_DOMAIN}/`],
  });
});

app.get('/.well-known/oauth-protected-resource/mcp', (req, res) => {
  if (!AUTH0_DOMAIN) {
    res.status(501).send('OAuth not configured on this server');
    return;
  }

  res.json({
    resource: MCP_SERVER_URL,
    scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
    authorization_servers: [`https://${AUTH0_DOMAIN}/`],
  });
});

// Apply auth middleware
app.use(authMiddleware);

// Map to store transports by session ID
const transports: Map<string, StreamableHTTPServerTransport> = new Map();

// MCP POST endpoint
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (sessionId) {
    console.log(`Received MCP request for session: ${sessionId}`);
  }

  try {
    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.has(sessionId)) {
      // Reuse existing transport
      transport = transports.get(sessionId)!;
    } else if (!sessionId && isInitializeRequest(req.body)) {
      // New initialization request
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId: string) => {
          console.log(`Session initialized with ID: ${sessionId}`);
          transports.set(sessionId, transport);
        },
      });

      // Set up onclose handler
      transport.onclose = () => {
        const sid = transport.sessionId;
        if (sid && transports.has(sid)) {
          console.log(`Transport closed for session ${sid}`);
          transports.delete(sid);
        }
      };

      // Connect the transport to the MCP server
      const server = createShopifyMcpServer();
      await server.connect(transport);
      await transport.handleRequest(req as any, res as any, req.body);
      return;
    } else {
      // Invalid request
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32000,
          message: 'Bad Request: No valid session ID provided',
        },
        id: null,
      });
      return;
    }

    // Handle the request with existing transport
    await transport.handleRequest(req as any, res as any, req.body);
  } catch (error) {
    console.error('Error handling MCP request:', error);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: 'Internal server error',
        },
        id: null,
      });
    }
  }
});

// MCP GET endpoint for SSE streams
app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const lastEventId = req.headers['last-event-id'] as string | undefined;
  if (lastEventId) {
    console.log(`Client reconnecting with Last-Event-ID: ${lastEventId}`);
  } else {
    console.log(`Establishing new SSE stream for session ${sessionId}`);
  }

  const transport = transports.get(sessionId)!;
  await transport.handleRequest(req as any, res as any);
});

// MCP DELETE endpoint for session termination
app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;

  if (!sessionId || !transports.has(sessionId)) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  console.log(`Received session termination request for session ${sessionId}`);

  try {
    const transport = transports.get(sessionId)!;
    await transport.handleRequest(req as any, res as any);
  } catch (error) {
    console.error('Error handling session termination:', error);
    if (!res.headersSent) {
      res.status(500).send('Error processing session termination');
    }
  }
});

// Start server
const PORT = parseInt(process.env.PORT || '8000', 10);

app.listen(PORT, () => {
  console.log(`Shopify MCP HTTP Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');

  for (const [sessionId, transport] of transports.entries()) {
    try {
      console.log(`Closing transport for session ${sessionId}`);
      await transport.close();
      transports.delete(sessionId);
    } catch (error) {
      console.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }

  console.log('Server shutdown complete');
  process.exit(0);
});
