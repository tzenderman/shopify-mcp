#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import dotenv from "dotenv";
import minimist from "minimist";
import { z } from "zod";

// Import store management
import { StoreManager } from "./stores/storeManager.js";
import { parseStoreConfigs } from "./stores/configParser.js";

// Import tools
import { getCustomerOrders } from "./tools/getCustomerOrders.js";
import { getCustomers } from "./tools/getCustomers.js";
import { getCustomerById } from "./tools/getCustomerById.js";
import { createCustomer } from "./tools/createCustomer.js";
import { getOrderById } from "./tools/getOrderById.js";
import { getOrders } from "./tools/getOrders.js";
import { getProductById } from "./tools/getProductById.js";
import { getProducts } from "./tools/getProducts.js";
import { updateCustomer } from "./tools/updateCustomer.js";
import { updateOrder } from "./tools/updateOrder.js";
import { createProduct } from "./tools/createProduct.js";
import { updateProduct } from "./tools/updateProduct.js";
import { createProductVariant } from "./tools/createProductVariant.js";
import { updateProductVariant } from "./tools/updateProductVariant.js";
import { createProductImage } from "./tools/createProductImage.js";
import { updateProductImage } from "./tools/updateProductImage.js";
import { deleteProductImage } from "./tools/deleteProductImage.js";
import { getCollections } from "./tools/getCollections.js";
import { getCollectionById } from "./tools/getCollectionById.js";
import { createCollection } from "./tools/createCollection.js";
import { updateCollection } from "./tools/updateCollection.js";
import { addProductsToCollection } from "./tools/addProductsToCollection.js";
import { removeProductsFromCollection } from "./tools/removeProductsFromCollection.js";
import { getDraftOrders } from "./tools/getDraftOrders.js";
import { getDraftOrderById } from "./tools/getDraftOrderById.js";
import { createDraftOrder } from "./tools/createDraftOrder.js";
import { updateDraftOrder } from "./tools/updateDraftOrder.js";
import { createMenu } from "./tools/createMenu.js";
import { updateMenu } from "./tools/updateMenu.js";
import { deleteMenu } from "./tools/deleteMenu.js";
import { getMenu } from "./tools/getMenu.js";
import { getMenus } from "./tools/getMenus.js";
import { getJobStatus } from "./tools/getJobStatus.js";

// Parse command line arguments
const argv = minimist(process.argv.slice(2));

// Load environment variables from .env file (if it exists)
dotenv.config();

// Parse store configurations (supports both multi-store and legacy single-store)
let storeConfigs;
try {
  storeConfigs = parseStoreConfigs(argv);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

// Create store manager with all configured stores
const storeManager = new StoreManager(storeConfigs);

console.error(`Initialized ${storeManager.getStoreCount()} store(s):`);
for (const store of storeManager.listStores()) {
  console.error(`  - ${store.id}: ${store.domain} (API ${store.apiVersion})`);
}

// Initialize tools with store manager
getProducts.initialize(storeManager);
getProductById.initialize(storeManager);
getCustomers.initialize(storeManager);
getCustomerById.initialize(storeManager);
createCustomer.initialize(storeManager);
getOrders.initialize(storeManager);
getOrderById.initialize(storeManager);
updateOrder.initialize(storeManager);
getCustomerOrders.initialize(storeManager);
updateCustomer.initialize(storeManager);
createProduct.initialize(storeManager);
updateProduct.initialize(storeManager);
createProductVariant.initialize(storeManager);
updateProductVariant.initialize(storeManager);
createProductImage.initialize(storeManager);
updateProductImage.initialize(storeManager);
deleteProductImage.initialize(storeManager);
getCollections.initialize(storeManager);
getCollectionById.initialize(storeManager);
createCollection.initialize(storeManager);
updateCollection.initialize(storeManager);
addProductsToCollection.initialize(storeManager);
removeProductsFromCollection.initialize(storeManager);
getDraftOrders.initialize(storeManager);
getDraftOrderById.initialize(storeManager);
createDraftOrder.initialize(storeManager);
updateDraftOrder.initialize(storeManager);
createMenu.initialize(storeManager);
updateMenu.initialize(storeManager);
deleteMenu.initialize(storeManager);
getMenu.initialize(storeManager);
getMenus.initialize(storeManager);
getJobStatus.initialize(storeManager);

// Set up MCP server
const server = new McpServer({
  name: "shopify",
  version: "1.0.0",
  description:
    "MCP Server for Shopify API, enabling interaction with store data through GraphQL API"
});

// Add tools individually, using their schemas directly
server.tool(
  "get-products",
  getProducts.schema.shape,
  async (args) => {
    const result = await getProducts.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-product-by-id",
  {
    storeId: z.string().min(1).describe("The store ID to query"),
    productId: z.string().min(1)
  },
  async (args) => {
    const result = await getProductById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-customers",
  {
    storeId: z.string().min(1).describe("The store ID to query"),
    searchQuery: z.string().optional(),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getCustomers.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-customer-by-id",
  getCustomerById.schema.shape,
  async (args) => {
    const result = await getCustomerById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "create-customer",
  createCustomer.schema.shape,
  async (args) => {
    const result = await createCustomer.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

server.tool(
  "get-orders",
  {
    storeId: z.string().min(1).describe("The store ID to query"),
    status: z.enum(["any", "open", "closed", "cancelled"]).default("any"),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getOrderById tool
server.tool(
  "get-order-by-id",
  {
    storeId: z.string().min(1).describe("The store ID to query"),
    orderId: z.string().min(1)
  },
  async (args) => {
    const result = await getOrderById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateOrder tool
server.tool(
  "update-order",
  {
    storeId: z.string().min(1).describe("The store ID to update order in"),
    id: z.string().min(1),
    tags: z.array(z.string()).optional(),
    email: z.string().email().optional(),
    note: z.string().optional(),
    customAttributes: z
      .array(
        z.object({
          key: z.string(),
          value: z.string()
        })
      )
      .optional(),
    metafields: z
      .array(
        z.object({
          id: z.string().optional(),
          namespace: z.string().optional(),
          key: z.string().optional(),
          value: z.string(),
          type: z.string().optional()
        })
      )
      .optional(),
    shippingAddress: z
      .object({
        address1: z.string().optional(),
        address2: z.string().optional(),
        city: z.string().optional(),
        company: z.string().optional(),
        country: z.string().optional(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        phone: z.string().optional(),
        province: z.string().optional(),
        zip: z.string().optional()
      })
      .optional()
  },
  async (args) => {
    const result = await updateOrder.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getCustomerOrders tool
server.tool(
  "get-customer-orders",
  {
    storeId: z.string().min(1).describe("The store ID to query"),
    customerId: z
      .string()
      .regex(/^\d+$/, "Customer ID must be numeric")
      .describe("Shopify customer ID, numeric excluding gid prefix"),
    limit: z.number().default(10)
  },
  async (args) => {
    const result = await getCustomerOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateCustomer tool
server.tool(
  "update-customer",
  {
    storeId: z.string().min(1).describe("The store ID to update customer in"),
    id: z
      .string()
      .regex(/^\d+$/, "Customer ID must be numeric")
      .describe("Shopify customer ID, numeric excluding gid prefix"),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    tags: z.array(z.string()).optional(),
    note: z.string().optional(),
    taxExempt: z.boolean().optional(),
    metafields: z
      .array(
        z.object({
          id: z.string().optional(),
          namespace: z.string().optional(),
          key: z.string().optional(),
          value: z.string(),
          type: z.string().optional()
        })
      )
      .optional()
  },
  async (args) => {
    const result = await updateCustomer.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createProduct tool
server.tool(
  "create-product",
  {
    storeId: z.string().min(1).describe("The store ID to create product in"),
    title: z.string().min(1),
    descriptionHtml: z.string().optional(),
    vendor: z.string().optional(),
    productType: z.string().optional(),
    tags: z.array(z.string()).optional(),
    status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).default("DRAFT"),
  },
  async (args) => {
    const result = await createProduct.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the list-stores tool
server.tool(
  "list-stores",
  {},
  async () => {
    const stores = storeManager.listStores();
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            stores,
            count: stores.length
          })
        }
      ]
    };
  }
);

// Add the updateProduct tool
server.tool(
  "update-product",
  updateProduct.schema.shape,
  async (args) => {
    const result = await updateProduct.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createProductVariant tool
server.tool(
  "create-product-variant",
  createProductVariant.schema.shape,
  async (args) => {
    const result = await createProductVariant.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateProductVariant tool
server.tool(
  "update-product-variant",
  updateProductVariant.schema.shape,
  async (args) => {
    const result = await updateProductVariant.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createProductImage tool
server.tool(
  "create-product-image",
  {
    storeId: z.string().min(1).describe("The store ID to create image in"),
    productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
    src: z.string().optional().describe("URL of the image (for URL-based images)"),
    attachment: z.string().optional().describe("Base64-encoded image data (for direct upload)"),
    altText: z.string().optional().describe("Alt text for the image"),
    filename: z.string().optional().describe("Filename for the image (required when using attachment)"),
  },
  async (args: any) => {
    const result = await createProductImage.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateProductImage tool
server.tool(
  "update-product-image",
  updateProductImage.schema.shape,
  async (args) => {
    const result = await updateProductImage.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the deleteProductImage tool
server.tool(
  "delete-product-image",
  deleteProductImage.schema.shape,
  async (args) => {
    const result = await deleteProductImage.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getCollections tool
server.tool(
  "get-collections",
  getCollections.schema.shape,
  async (args) => {
    const result = await getCollections.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getCollectionById tool
server.tool(
  "get-collection-by-id",
  getCollectionById.schema.shape,
  async (args) => {
    const result = await getCollectionById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createCollection tool
server.tool(
  "create-collection",
  createCollection.schema.shape,
  async (args) => {
    const result = await createCollection.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateCollection tool
server.tool(
  "update-collection",
  updateCollection.schema.shape,
  async (args) => {
    const result = await updateCollection.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the addProductsToCollection tool
server.tool(
  "add-products-to-collection",
  addProductsToCollection.schema.shape,
  async (args) => {
    const result = await addProductsToCollection.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the removeProductsFromCollection tool
server.tool(
  "remove-products-from-collection",
  removeProductsFromCollection.schema.shape,
  async (args) => {
    const result = await removeProductsFromCollection.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getDraftOrders tool
server.tool(
  "get-draft-orders",
  getDraftOrders.schema.shape,
  async (args) => {
    const result = await getDraftOrders.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getDraftOrderById tool
server.tool(
  "get-draft-order-by-id",
  getDraftOrderById.schema.shape,
  async (args) => {
    const result = await getDraftOrderById.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createDraftOrder tool
server.tool(
  "create-draft-order",
  createDraftOrder.schema.shape,
  async (args) => {
    const result = await createDraftOrder.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateDraftOrder tool
server.tool(
  "update-draft-order",
  updateDraftOrder.schema.shape,
  async (args) => {
    const result = await updateDraftOrder.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the createMenu tool
server.tool(
  "create-menu",
  createMenu.schema.shape,
  async (args) => {
    const result = await createMenu.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the updateMenu tool
server.tool(
  "update-menu",
  updateMenu.schema.shape,
  async (args) => {
    const result = await updateMenu.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the deleteMenu tool
server.tool(
  "delete-menu",
  deleteMenu.schema.shape,
  async (args) => {
    const result = await deleteMenu.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getMenu tool
server.tool(
  "get-menu",
  getMenu.schema.shape,
  async (args) => {
    const result = await getMenu.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getMenus tool
server.tool(
  "get-menus",
  getMenus.schema.shape,
  async (args) => {
    const result = await getMenus.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Add the getJobStatus tool
server.tool(
  "get-job-status",
  getJobStatus.schema.shape,
  async (args) => {
    const result = await getJobStatus.execute(args);
    return {
      content: [{ type: "text", text: JSON.stringify(result) }]
    };
  }
);

// Start the server
const transport = new StdioServerTransport();
server
  .connect(transport)
  .then(() => {})
  .catch((error: unknown) => {
    console.error("Failed to start Shopify MCP Server:", error);
  });
