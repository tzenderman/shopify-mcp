# Publishing Guide

This guide explains how to publish this package to npm so your team can use it.

## Pre-Publishing Checklist

- [x] Updated package name to `@jean-paul/shopify-mcp`
- [x] Updated version to `1.1.0` (includes 15 new tools)
- [x] Updated author information
- [x] Updated repository URLs
- [ ] Test the package locally
- [ ] Login to npm
- [ ] Publish to npm

## Step 1: Test the Build

Make sure everything compiles and works:

```bash
npm run build
npm test  # Run tests (if you have any)
node dist/index.js  # Quick smoke test
```

## Step 2: Login to npm

If you haven't logged in to npm yet:

```bash
npm login
```

Enter your npm username, password, and email when prompted.

If you don't have an npm account, create one at https://www.npmjs.com/signup

## Step 3: Publish to npm

### For Public Package (Free)

```bash
npm publish --access public
```

This makes `@jean-paul/shopify-mcp` publicly available.

### For Private Package (Requires npm Pro/Teams)

```bash
npm publish
```

This keeps it private to your organization.

## Step 4: Verify Publication

After publishing, verify it's available:

```bash
npm info @jean-paul/shopify-mcp
```

Or visit: https://www.npmjs.com/package/@jean-paul/shopify-mcp

## How Your Team Can Use It

After publishing, team members can use it in Claude Desktop:

### Installation

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": [
        "-y",
        "@jean-paul/shopify-mcp"
      ],
      "env": {
        "SHOPIFY_STORES": "[{\"id\":\"store1\",\"domain\":\"store1.myshopify.com\",\"accessToken\":\"token1\"}]"
      }
    }
  }
}
```

Or install globally:

```bash
npm install -g @jean-paul/shopify-mcp
```

## Publishing Updates

When you add new features or fix bugs:

1. Update the version in package.json:
   ```bash
   npm version patch  # For bug fixes (1.1.0 -> 1.1.1)
   npm version minor  # For new features (1.1.0 -> 1.2.0)
   npm version major  # For breaking changes (1.1.0 -> 2.0.0)
   ```

2. Build and publish:
   ```bash
   npm run build
   npm publish --access public
   ```

3. Team members get updates by restarting Claude Desktop (it will fetch the latest version)

## Alternative: Private GitHub Package Registry

If you want to keep it private without paying for npm Pro:

1. Update package.json:
   ```json
   "publishConfig": {
     "registry": "https://npm.pkg.github.com"
   }
   ```

2. Create `.npmrc` in project root:
   ```
   @jean-paul:registry=https://npm.pkg.github.com
   ```

3. Login to GitHub packages:
   ```bash
   npm login --registry=https://npm.pkg.github.com
   ```

4. Publish:
   ```bash
   npm publish
   ```

Team members will need to authenticate with GitHub to install.

## Changelog

### Version 1.1.0 (Current)

Added 15 new tools:
- Product management: update-product
- Variant management: create-product-variant, update-product-variant
- Image management: create-product-image, update-product-image, delete-product-image
- Collection management: create-collection, update-collection, add-products-to-collection, remove-products-from-collection
- Draft orders: create-draft-order, update-draft-order
- Menu management: create-menu, update-menu, delete-menu

Enhanced features:
- Base64 image upload support
- Partial update semantics for all update operations
- Improved multi-store support

### Version 1.0.7 (Original Fork)

Original shopify-mcp features with multi-store support.
