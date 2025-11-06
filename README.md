# Shopify MCP Server

MCP Server for Shopify API, enabling interaction with store data through GraphQL API. This server provides tools for managing products, customers, orders, and more.

**📦 Package Name: `@tzenderman/shopify-mcp`**
**🚀 NPX Command: `npx @tzenderman/shopify-mcp`**

> **✅ Fully API Compliant**: All 34 tools have been validated against the Shopify Admin GraphQL API specification to ensure compatibility and reliability.

**🌐 Deployment Modes**: Now supports both local (stdio) and remote (HTTP) deployment:
- **Local Mode**: Run directly in Claude Desktop via stdio transport
- **Remote Mode**: Deploy as an HTTP server with OAuth 2.0 authentication on Render, Heroku, etc.
- **Documentation**: See [REMOTE_SERVER.md](REMOTE_SERVER.md) for remote deployment guide

## Features

- **Multi-Store Support**: Manage multiple Shopify stores from a single MCP server instance
- **Product Management**: Create, update products, manage variants and images
- **Collection Management**: Create, update collections and manage product associations
- **Customer Management**: Load customer data and manage customer tags
- **Order Management**: Advanced order querying and filtering, draft order creation
- **Menu Management**: Create, update, and delete navigation menus
- **GraphQL Integration**: Direct integration with Shopify's GraphQL Admin API
- **Comprehensive Error Handling**: Clear error messages for API and authentication issues

## Prerequisites

1. Node.js (version 16 or higher)
2. Shopify Custom App Access Token (see setup instructions below)

## Setup

### Shopify Access Token

To use this MCP server, you'll need to create a custom app in your Shopify store:

1. From your Shopify admin, go to **Settings** > **Apps and sales channels**
2. Click **Develop apps** (you may need to enable developer preview first)
3. Click **Create an app**
4. Set a name for your app (e.g., "Shopify MCP Server")
5. Click **Configure Admin API scopes**
6. Select the following scopes based on your needs:
   - `read_products`, `write_products` (for product, variant, image, and collection management)
   - `read_customers`, `write_customers` (for customer management)
   - `read_orders`, `write_orders` (for order and draft order management)
   - `read_online_store_navigation`, `write_online_store_navigation` (for menu management)
7. Click **Save**
8. Click **Install app**
9. Click **Install** to give the app access to your store data
10. After installation, you'll see your **Admin API access token**
11. Copy this token - you'll need it for configuration

### Usage with Claude Desktop

To manage Shopify stores, add this to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": [
        "@tzenderman/shopify-mcp",
        "--stores",
        "[{\"id\":\"store1\",\"domain\":\"store1.myshopify.com\",\"accessToken\":\"token1\"},{\"id\":\"store2\",\"domain\":\"store2.myshopify.com\",\"accessToken\":\"token2\"},{\"id\":\"store3\",\"domain\":\"store3.myshopify.com\",\"accessToken\":\"token3\"}]"
      ]
    }
  }
}
```

**Important:** Each store needs:
- `id`: A unique identifier for the store (e.g., "main", "eu-store", "store1")
- `domain`: The myshopify.com domain
- `accessToken`: The Shopify Admin API access token

All tools require a `storeId` parameter to specify which store to interact with. Use the `list-stores` tool to see available stores.

**For a single store**, use the same format with one store in the array:

```json
{
  "mcpServers": {
    "shopify": {
      "command": "npx",
      "args": [
        "@tzenderman/shopify-mcp",
        "--stores",
        "[{\"id\":\"my-store\",\"domain\":\"my-store.myshopify.com\",\"accessToken\":\"<YOUR_ACCESS_TOKEN>\"}]"
      ]
    }
  }
}
```

Locations for the Claude Desktop config file:

- MacOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%/Claude/claude_desktop_config.json`

### Alternative: Run Locally with Environment Variables

#### Multi-Store with Environment Variable

Create a `.env` file with your store configurations:

```
SHOPIFY_STORES='[{"id":"store1","domain":"store1.myshopify.com","accessToken":"token1"},{"id":"store2","domain":"store2.myshopify.com","accessToken":"token2"}]'
```

#### Single Store with Environment Variables

For a single store:

```
SHOPIFY_ACCESS_TOKEN=your_access_token
MYSHOPIFY_DOMAIN=your-store.myshopify.com
```

Then run:
```
npx @tzenderman/shopify-mcp
```

### Direct Installation (Optional)

If you want to install the package globally:

```
npm install -g @tzenderman/shopify-mcp
```

Then run it with the multi-store format:

```
@tzenderman/shopify-mcp --stores='[{"id":"my-store","domain":"my-store.myshopify.com","accessToken":"<YOUR_ACCESS_TOKEN>"}]'
```

## Available Tools

**Note:** All tools (except `list-stores`) require a `storeId` parameter to specify which store to interact with.

### Image Upload Best Practices

When uploading product images using the `create-product-image` tool, you have three options:

1. **File Path (Most Token-Efficient)**: Provide the local file path
   - When you drag-and-drop an image into Claude, acknowledge the image but provide the file path instead
   - Example: `/Users/username/Downloads/product-photo.jpg`
   - The MCP server reads the file directly, using minimal tokens

2. **External URL**: Provide a URL to an image hosted elsewhere
   - Example: `https://example.com/images/product.jpg`
   - Most efficient if the image is already hosted online

3. **Base64 (Fallback)**: Provide base64-encoded data
   - Uses significantly more tokens (~33% larger than binary)
   - Only recommended when file path is not available

**Recommended workflow in Claude Desktop:**
```
User: [drags image into chat]
Claude: "I can see the image. To upload it efficiently, what's the file path?"
User: "/Users/timz/Downloads/product-photo.jpg"
Claude: [uses filePath parameter to upload]
```

### Store Management

1. `list-stores`
   - List all configured stores
   - Returns store IDs, domains, and API versions
   - No inputs required

### Job Management

1. `get-job-status`
   - Check the status of an asynchronous job (e.g., from collection product operations)
   - Inputs:
     - `storeId` (string, required): The store ID
     - `jobId` (string, required): Job ID (GID format: gid://shopify/Job/...)
   - Returns: Job object with `id`, `done` (boolean), and status message
   - Use this to poll job completion after async operations like `add-products-to-collection` or `remove-products-from-collection`

### Product Management

1. `get-products`
   - Get all products or search by title or SKU from a specific store
   - Supports three modes: search by title, search by SKU, or get all products
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `searchTitle` (string, optional): Search products by title (supports wildcards). Example: 'shirt' finds products with 'shirt' in the title
     - `searchSku` (string, optional): Search products by variant SKU (supports wildcards with *). Examples: 'ABC-123' for exact match, or 'ABC-*' to find all SKUs starting with 'ABC-'. When provided, searchTitle is ignored
     - `limit` (number, default: 10): Maximum number of products to return
   - Returns:
     - When searching by SKU: Products with `matchedVariants` array containing variants that matched the search
     - When searching by title or getting all: Products with `variants` array (first 5 variants per product)
     - `searchMode` field indicates which mode was used: 'sku', 'title', or 'all'

2. `get-product-by-id`
   - Get a specific product by ID from a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `productId` (string): ID of the product to retrieve

3. `create-product`
    - Create new product in a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to create product in
        - `title` (string): Title of the product
        - `descriptionHtml` (string, optional): Description of the product
        - `vendor` (string, optional): Vendor of the product
        - `productType` (string, optional): Type of the product
        - `tags` (array of strings, optional): Tags of the product
        - `status` (string, optional): Status of the product "ACTIVE", "DRAFT", "ARCHIVED". Default "DRAFT"

4. `update-product`
    - Update an existing product's information
    - Inputs:
        - `storeId` (string, required): The store ID
        - `id` (string, required): Product ID (GID format)
        - `title` (string, optional): Title of the product
        - `descriptionHtml` (string, optional): Description of the product
        - `vendor` (string, optional): Vendor of the product
        - `productType` (string, optional): Type of the product
        - `tags` (array of strings, optional): Tags of the product
        - `status` (string, optional): Status of the product

5. `create-product-variant`
    - Create a new variant for an existing product
    - Inputs:
        - `storeId` (string, required): The store ID
        - `productId` (string, required): Product ID (GID format)
        - `price` (string, optional): Price of the variant
        - `compareAtPrice` (string, optional): Compare at price
        - `sku` (string, optional): SKU of the variant
        - `barcode` (string, optional): Barcode of the variant
        - `inventoryPolicy` (enum, optional): "DENY" or "CONTINUE"
        - `inventoryQuantities` (array, optional): Inventory quantities at locations
        - `optionValues` (array of objects, optional): Variant option values with option names (format: `[{optionName: "Size", name: "Large"}]`)
        - `taxable` (boolean, optional): Whether the variant is taxable

6. `update-product-variant`
    - Update an existing product variant
    - Inputs:
        - `storeId` (string, required): The store ID
        - `productId` (string, required): Product ID (GID format)
        - `id` (string, required): Variant ID (GID format)
        - `price` (string, optional): Price of the variant
        - `compareAtPrice` (string, optional): Compare at price
        - `sku` (string, optional): SKU of the variant
        - `barcode` (string, optional): Barcode of the variant
        - `inventoryPolicy` (enum, optional): "DENY" or "CONTINUE"
        - `inventoryQuantities` (array, optional): Inventory quantities at locations
        - `optionValues` (array of objects, optional): Variant option values with option names
        - `taxable` (boolean, optional): Whether the variant is taxable

7. `create-product-image`
    - Create a new image for a product (supports URL, file path, or base64 upload)
    - Inputs:
        - `storeId` (string, required): The store ID
        - `productId` (string, required): Product ID (GID format)
        - `src` (string, optional): URL of the image (external URL)
        - `filePath` (string, optional): Local file path to the image (most token-efficient)
        - `attachment` (string, optional): Base64-encoded image data (for backward compatibility)
        - `altText` (string, optional): Alt text for the image
        - `filename` (string, optional): Filename (optional, inferred from filePath if not provided)
    - Note: Either `src`, `filePath`, or `attachment` must be provided
    - **Recommended**: Use `filePath` for best token efficiency. When you drag-and-drop an image into Claude, provide the local file path instead of using the base64 data.

8. `update-product-image`
    - Update an existing product image's properties
    - Inputs:
        - `storeId` (string, required): The store ID
        - `productId` (string, required): Product ID (GID format)
        - `id` (string, required): Image ID (GID format)
        - `altText` (string, optional): Alt text for the image

9. `delete-product-image`
    - Delete a product image
    - Inputs:
        - `storeId` (string, required): The store ID
        - `productId` (string, required): Product ID (GID format)
        - `id` (string, required): Image ID (GID format)

### Collection Management

1. `get-collections`
    - Get all collections or search collections from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `query` (string, optional): Search query to filter collections
        - `limit` (number, default: 10): Number of collections to retrieve
    - Returns: Collections with product count, rules, images, and pagination info

2. `get-collection-by-id`
    - Get a single collection by ID from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `collectionId` (string, required): Collection ID (GID format: gid://shopify/Collection/...)
    - Returns: Full collection details including SEO, products (first 10), and rules

3. `create-collection`
    - Create a new collection (manual or automated/smart)
    - Inputs:
        - `storeId` (string, required): The store ID
        - `title` (string, required): Title of the collection
        - `descriptionHtml` (string, optional): HTML description
        - `handle` (string, optional): URL handle
        - `ruleSet` (object, optional): Rules for automated/smart collections
          - `appliedDisjunctively` (boolean): Use OR (true) or AND (false) logic
          - `rules` (array): Array of rule conditions
            - `column` (enum): Field to match (TITLE, TYPE, VENDOR, TAG, PRODUCT_METAFIELD_DEFINITION, etc.)
            - `relation` (enum): Comparison operator (EQUALS, CONTAINS, GREATER_THAN, etc.)
            - `condition` (string): Value to match
            - `conditionObjectId` (string, optional): Required for metafield-based rules
        - `products` (array of strings, optional): Product IDs for manual collections (GID format)
        - `image` (object, optional): Collection image
          - `src` (string): Source URL
          - `altText` (string, optional): Alt text
        - `sortOrder` (enum, optional): How products are sorted (BEST_SELLING, MANUAL, PRICE_ASC, etc.)
        - `templateSuffix` (string, optional): Template suffix
    - Note: Collection is unpublished by default. Use `publishablePublish` mutation to publish.

4. `update-collection`
    - Update an existing collection
    - Inputs: Same as create-collection, plus:
        - `id` (string, required): Collection ID (GID format)

5. `add-products-to-collection`
    - Add products to a manual collection (asynchronous operation)
    - Inputs:
        - `storeId` (string, required): The store ID
        - `id` (string, required): Collection ID (GID format)
        - `productIds` (array of strings, required): Product IDs to add (GID format, up to 250 products)
    - Returns: Job object with `id` and `done` status for tracking the async operation
    - Note: Uses `collectionAddProductsV2` mutation which processes asynchronously

6. `remove-products-from-collection`
    - Remove products from a manual collection (asynchronous operation)
    - Inputs:
        - `storeId` (string, required): The store ID
        - `id` (string, required): Collection ID (GID format)
        - `productIds` (array of strings, required): Product IDs to remove (GID format, up to 250 products)
    - Returns: Job object with `id` and `done` status for tracking the async operation
    - Note: Only works with manual collections (not smart/automated collections)

### Customer Management

1. `get-customers`
   - Get customers or search by name/email from a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `searchQuery` (optional string): Filter customers by name or email
     - `limit` (optional number, default: 10): Maximum number of customers to return

2. `get-customer-by-id`
   - Get a single customer by ID with detailed information
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `customerId` (string, required): Customer ID (GID format: gid://shopify/Customer/...)
   - Returns: Full customer details including addresses, state, tax exemption, spending history, and recent orders (first 10)

3. `create-customer`
   - Create a new customer in a specific store
   - Inputs:
     - `storeId` (string, required): The store ID
     - `firstName` (string, required): Customer's first name
     - `lastName` (string, required): Customer's last name
     - `email` (string, required): Customer's email address
     - `phone` (string, optional): Customer's phone number
     - `tags` (array of strings, optional): Tags to associate with the customer
     - `note` (string, optional): Note about the customer
     - `taxExempt` (boolean, optional): Whether the customer is exempt from taxes
     - `addresses` (array of objects, optional): Customer addresses with address1, address2, city, country, province, zip, etc.
     - `metafields` (array of objects, optional): Metafields to associate with the customer

4. `update-customer`
   - Update a customer's information in a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to update customer in
     - `id` (string, required): Shopify customer ID (numeric ID only, like "6276879810626")
     - `firstName` (string, optional): Customer's first name
     - `lastName` (string, optional): Customer's last name
     - `email` (string, optional): Customer's email address
     - `phone` (string, optional): Customer's phone number
     - `tags` (array of strings, optional): Tags to apply to the customer
     - `note` (string, optional): Note about the customer
     - `taxExempt` (boolean, optional): Whether the customer is exempt from taxes
     - `metafields` (array of objects, optional): Customer metafields for storing additional data

5. `get-customer-orders`
   - Get orders for a specific customer from a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `customerId` (string, required): Shopify customer ID (numeric ID only, like "6276879810626")
     - `limit` (optional number, default: 10): Maximum number of orders to return

### Order Management

1. `get-orders`
   - Get orders with optional filtering from a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `status` (optional string): Filter by order status
     - `limit` (optional number, default: 10): Maximum number of orders to return

2. `get-order-by-id`
   - Get a specific order by ID from a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to query
     - `orderId` (string, required): Full Shopify order ID (e.g., "gid://shopify/Order/6090960994370")

3. `update-order`
   - Update an existing order with new information in a specific store
   - Inputs:
     - `storeId` (string, required): The store ID to update order in
     - `id` (string, required): Shopify order ID
     - `tags` (array of strings, optional): New tags for the order
     - `email` (string, optional): Update customer email
     - `note` (string, optional): Order notes
     - `customAttributes` (array of objects, optional): Custom attributes for the order
     - `metafields` (array of objects, optional): Order metafields
     - `shippingAddress` (object, optional): Shipping address information

### Draft Order Management

1. `get-draft-orders`
    - Get all draft orders or search draft orders from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `query` (string, optional): Search query to filter draft orders
        - `limit` (number, default: 10): Number of draft orders to retrieve
    - Returns: Draft orders with line items (first 10), customer info, and pagination info

2. `get-draft-order-by-id`
    - Get a single draft order by ID from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `draftOrderId` (string, required): Draft Order ID (GID format: gid://shopify/DraftOrder/...)
    - Returns: Complete draft order details including line items (first 50), addresses, shipping, discounts, and full pricing breakdown

3. `create-draft-order`
    - Create a new draft order
    - Inputs:
        - `storeId` (string, required): The store ID
        - `lineItems` (array, required): Line items for the order
        - `customerId` (string, optional): Customer ID (GID format)
        - `email` (string, optional): Customer email
        - `phone` (string, optional): Customer phone
        - `shippingAddress` (object, optional): Shipping address
        - `billingAddress` (object, optional): Billing address
        - `note` (string, optional): Note for the draft order (input uses 'note', response returns 'note2')
        - `tags` (array of strings, optional): Tags
        - `taxExempt` (boolean, optional): Tax exemption status
        - `shippingLine` (object, optional): Shipping details

4. `update-draft-order`
    - Update an existing draft order
    - Inputs: Same as create-draft-order, plus:
        - `id` (string, required): Draft Order ID (GID format)

### Menu Management

1. `get-menus`
    - Get all navigation menus from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `limit` (number, default: 10): Number of menus to retrieve
    - Returns: Menus with nested items (up to 3 levels) and pagination info

2. `get-menu`
    - Get a single navigation menu by ID from a specific store
    - Inputs:
        - `storeId` (string, required): The store ID to query
        - `menuId` (string, required): Menu ID (GID format: gid://shopify/Menu/...)
    - Returns: Complete menu structure with nested items (up to 3 levels deep)

3. `create-menu`
    - Create a new navigation menu
    - Inputs:
        - `storeId` (string, required): The store ID
        - `title` (string, required): Title of the menu
        - `handle` (string, required): URL handle for the menu
        - `items` (array, required): Menu items with nested structure support
          - Each item must have:
            - `title` (string, required): Title of the menu item
            - `type` (enum, required): Type of menu item - "FRONTPAGE", "COLLECTIONS", "COLLECTION", "PRODUCT", "CATALOG", "PAGE", "BLOG", "ARTICLE", "POLICY", "HTTP", "SHOP_POLICY"
            - `url` (string, optional): URL for the menu item (can be relative or absolute)
            - `resourceId` (string, optional): Resource ID if linking to a product, collection, etc. (GID format)
            - `tags` (array of strings, optional): Tags to filter a collection
            - `items` (array, optional): Nested menu items for submenus

4. `update-menu`
    - Update an existing navigation menu
    - Inputs:
        - `storeId` (string, required): The store ID
        - `id` (string, required): Menu ID (GID format)
        - `title` (string, required): Title of the menu
        - `handle` (string, optional): URL handle for the menu
        - `items` (array, required): Menu items (replaces all existing items)
          - Same structure as create-menu items, plus:
            - `id` (string, optional): Menu item ID (GID format) - for updating existing items

5. `delete-menu`
    - Delete a navigation menu
    - Inputs:
        - `storeId` (string, required): The store ID
        - `id` (string, required): Menu ID (GID format)

## Debugging

If you encounter issues, check Claude Desktop's MCP logs:

```
tail -n 20 -f ~/Library/Logs/Claude/mcp*.log
```

## API Compliance

This server has been thoroughly validated against the Shopify Admin GraphQL API specification:

- ✅ **34 tools validated** - All GraphQL operations comply with current Shopify Admin API
- ✅ **API version 2023-07** - Default version, configurable per store
- ✅ **Comprehensive validation** - All mutations and queries have been verified using Shopify's schema validation tools

### Key API Changes Implemented

The following tools have been updated to use the latest Shopify API patterns:

- **Product Variants**: Uses `productVariantsBulkCreate` and `productVariantsBulkUpdate` mutations
- **Product Images**: Uses media-based API (`productCreateMedia`, `productUpdateMedia`, `productDeleteMedia`)
- **Menu Management**: Uses direct mutation arguments with `MenuItemCreateInput` and `MenuItemUpdateInput`
- **Collections**: Supports both manual and automated/smart collections with async operations

## Development

To contribute or modify this project:

```bash
# Clone the repository
git clone https://github.com/tzenderman/shopify-mcp.git
cd shopify-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev
```

### Project Structure

- `src/index.ts` - Main server initialization and tool registration
- `src/stores/` - Store management and configuration parsing
- `src/tools/` - Individual tool implementations for Shopify operations

## License

MIT
