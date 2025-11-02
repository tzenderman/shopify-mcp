import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for creating a product variant
const CreateProductVariantInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to create variant in"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  price: z.string().optional().describe("Price of the variant"),
  compareAtPrice: z.string().optional().describe("Compare at price for the variant"),
  sku: z.string().optional().describe("SKU of the variant"),
  barcode: z.string().optional().describe("Barcode of the variant"),
  inventoryPolicy: z.enum(["DENY", "CONTINUE"]).optional().describe("Whether to allow purchases when inventory is zero"),
  inventoryQuantities: z.array(z.object({
    availableQuantity: z.number(),
    locationId: z.string().describe("Location ID (GID format)")
  })).optional().describe("Inventory quantities at different locations"),
  options: z.array(z.string()).optional().describe("Variant option values (e.g., ['Red', 'Large'])"),
  weight: z.number().optional().describe("Weight of the variant"),
  weightUnit: z.enum(["KILOGRAMS", "GRAMS", "POUNDS", "OUNCES"]).optional().describe("Unit of weight measurement"),
  taxable: z.boolean().optional().describe("Whether the variant is taxable"),
  requiresShipping: z.boolean().optional().describe("Whether the variant requires shipping"),
});

type CreateProductVariantInput = z.infer<typeof CreateProductVariantInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const createProductVariant = {
  name: "create-product-variant",
  description: "Create a new variant for an existing product in a specific store",
  schema: CreateProductVariantInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: CreateProductVariantInput) => {
    try {
      const { storeId, productId, options, ...variantInput } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      // Transform options array to optionValues format if provided
      const optionValues = options?.map((value, index) => ({
        optionName: `Option${index + 1}`,
        name: value
      }));

      const query = gql`
        mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
          productVariantsBulkCreate(productId: $productId, variants: $variants) {
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
          ...variantInput,
          ...(optionValues && { optionValues })
        }],
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productVariantsBulkCreate: {
          productVariants: any[];
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.productVariantsBulkCreate.userErrors.length > 0) {
        throw new Error(
          `Failed to create product variant: ${data.productVariantsBulkCreate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      // Return the first (and only) variant created
      return { productVariant: data.productVariantsBulkCreate.productVariants[0] };
    } catch (error) {
      console.error("Error creating product variant:", error);
      throw new Error(
        `Failed to create product variant: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { createProductVariant };
