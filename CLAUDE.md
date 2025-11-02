# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a fork of the Shopify MCP server with added multi-store support. It's a Model Context Protocol (MCP) server that enables AI assistants to interact with Shopify stores through GraphQL queries. The key enhancement is the ability to manage multiple Shopify stores from a single MCP server instance.

## Development Commands

### Build and Run
```bash
npm run build           # Compile TypeScript to dist/
npm run clean          # Remove dist/ directory
npm start              # Run the compiled server from dist/
npm run dev            # Run with ts-node for development (no build needed)
```

### Testing and Linting
```bash
npm test               # Run Jest tests
npm run lint           # Run ESLint on src/**/*.ts
```

### Local Development Setup

**With Environment Variables** (create a `.env` file):

Multi-store:
```
SHOPIFY_STORES='[{"id":"store1","domain":"store1.myshopify.com","accessToken":"token1"},{"id":"store2","domain":"store2.myshopify.com","accessToken":"token2"}]'
```

Single-store (legacy):
```
SHOPIFY_ACCESS_TOKEN=your_access_token
MYSHOPIFY_DOMAIN=your-store.myshopify.com
```

Then run: `npm run dev`

**With Command Line Arguments**:
```bash
npm run build
node dist/index.js --stores='[{"id":"store1","domain":"store1.myshopify.com","accessToken":"token1"}]'
```

## Architecture

### Core Components

**Store Management** (`src/stores/`)
- `StoreManager` - Central manager that maintains a Map of GraphQL clients, one per configured store
- `configParser.ts` - Parses store configurations from CLI args or environment variables, supporting both multi-store JSON arrays and legacy single-store format
- `types.ts` - TypeScript interfaces for store configuration

**Tool Pattern** (`src/tools/`)
Each tool follows a consistent pattern:
1. Export an object with `name`, `description`, `schema` (Zod), and `execute` function
2. Include an `initialize(manager: StoreManager)` method called from index.ts
3. Accept `storeId` as first parameter to specify which store to query
4. Use `storeManager.getClient(storeId)` to get the appropriate GraphQL client
5. Execute GraphQL queries using `graphql-request`
6. Transform and return formatted results

**Main Entry** (`src/index.ts`)
- Parses configuration and initializes StoreManager
- Initializes all tools with the StoreManager instance
- Registers tools with the MCP server using Zod schemas
- Sets up stdio transport and starts the server

### Key Patterns

**Multi-Store Architecture**: All tools require a `storeId` parameter. The StoreManager maps store IDs to configured GraphQL clients, enabling the same tool to operate across different Shopify stores.

**Tool Registration**: Tools are registered in index.ts twice:
1. Call `tool.initialize(storeManager)` to inject dependencies
2. Call `server.tool(name, schema, handler)` to register with MCP server

**GraphQL Integration**: Uses `graphql-request` library with `gql` template literals. Each tool constructs GraphQL queries specific to its operation (products, customers, orders).

**Error Handling**: Tools catch errors and throw descriptive messages. StoreManager validates store IDs and provides clear error messages listing available stores.

## Adding New Tools

When creating a new tool:

1. Create a file in `src/tools/` (e.g., `newTool.ts`)
2. Follow the tool pattern with `initialize()` and `execute()` methods
3. Define Zod schema including `storeId: z.string().min(1)`
4. Import and initialize in `src/index.ts`:
   ```typescript
   import { newTool } from "./tools/newTool.js";
   newTool.initialize(storeManager);
   ```
5. Register with server in `src/index.ts`:
   ```typescript
   server.tool("new-tool", { ...schema }, async (args) => {
     const result = await newTool.execute(args);
     return { content: [{ type: "text", text: JSON.stringify(result) }] };
   });
   ```

## Important Details

**Module System**: Uses ES modules (`.js` extensions in imports, `"type": "module"` in package.json, `NodeNext` module resolution)

**TypeScript Configuration**: Targets ES2020, strict mode enabled, outputs to `dist/`

**API Versions**: Default Shopify API version is "2023-07", configurable per store

**ID Formats**:
- Customer IDs in update operations use numeric format (e.g., "6276879810626")
- Order IDs use full Shopify GID format (e.g., "gid://shopify/Order/6090960994370")
- Product IDs use full GID format

**Binary**: Entry point is `dist/index.js` with shebang for CLI execution
