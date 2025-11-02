import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for updating a product variant
const UpdateProductVariantInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update variant in"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  id: z.string().min(1).describe("Variant ID (GID format: gid://shopify/ProductVariant/...)"),
  price: z.string().optional().describe("Price of the variant"),
  compareAtPrice: z.string().optional().describe("Compare at price for the variant"),
  sku: z.string().optional().describe("SKU of the variant"),
  barcode: z.string().optional().describe("Barcode of the variant"),
  inventoryPolicy: z.enum(["DENY", "CONTINUE"]).optional().describe("Whether to allow purchases when inventory is zero"),
  inventoryQuantities: z.array(z.object({
    availableQuantity: z.number(),
    locationId: z.string().describe("Location ID (GID format)")
  })).optional().describe("Inventory quantities at different locations"),
  optionValues: z.array(z.object({
    optionName: z.string(),
    name: z.string()
  })).optional().describe("Variant option values with option names"),
  taxable: z.boolean().optional().describe("Whether the variant is taxable"),
});

type UpdateProductVariantInput = z.infer<typeof UpdateProductVariantInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateProductVariant = {
  name: "update-product-variant",
  description: "Update an existing product variant's information in a specific store",
  schema: UpdateProductVariantInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateProductVariantInput) => {
    try {
      const { storeId, productId, id, ...variantFields } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkUpdate(productId: $productId, variants: $variants) {
            productVariants {
              id
              title
              price
              compareAtPrice
              sku
              barcode
              inventoryPolicy
              inventoryQuantity
              selectedOptions {
                name
                value
              }
              taxable
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        productId,
        variants: [{
          id,
          ...variantFields,
        }],
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productVariantsBulkUpdate: {
          productVariants: any[];
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.productVariantsBulkUpdate.userErrors.length > 0) {
        throw new Error(
          `Failed to update product variant: ${data.productVariantsBulkUpdate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      // Return the first (and only) variant updated
      return { productVariant: data.productVariantsBulkUpdate.productVariants[0] };
    } catch (error) {
      console.error("Error updating product variant:", error);
      throw new Error(
        `Failed to update product variant: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateProductVariant };
