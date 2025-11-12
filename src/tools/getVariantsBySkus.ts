import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getVariantsBySkus
const GetVariantsBySkusInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  skus: z.array(z.string()).min(1).max(250).describe("Array of SKUs to search for (max 250 per request)"),
});

type GetVariantsBySkusInput = z.infer<typeof GetVariantsBySkusInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getVariantsBySkus = {
  name: "get-variants-by-skus",
  description: "Efficiently fetch multiple product variants by their SKUs in a single API call. Returns a mapping of SKU to variant ID and other variant details. Useful for batch operations like creating draft orders with many line items. Maximum 250 SKUs per request.",
  schema: GetVariantsBySkusInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetVariantsBySkusInput) => {
    try {
      const { storeId, skus } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      // Build the OR query for multiple SKUs
      const skuQuery = skus.map(sku => `sku:${sku}`).join(" OR ");

      const query = gql`
        query GetVariantsBySkus($first: Int!, $query: String!) {
          productVariants(first: $first, query: $query) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
                displayName
                product {
                  id
                  title
                  handle
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: skus.length,
        query: skuQuery
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productVariants: {
          edges: Array<{
            node: {
              id: string;
              title: string;
              sku: string;
              price: string;
              inventoryQuantity: number;
              displayName: string;
              product: {
                id: string;
                title: string;
                handle: string;
              };
            };
          }>;
        };
      };

      // Create a map of SKU -> variant data
      const skuToVariant: Record<string, any> = {};
      const foundSkus: string[] = [];
      const notFoundSkus: string[] = [];

      // Process all found variants
      data.productVariants.edges.forEach((edge) => {
        const variant = edge.node;
        if (variant.sku) {
          foundSkus.push(variant.sku);
          skuToVariant[variant.sku] = {
            variantId: variant.id,
            variantTitle: variant.title,
            displayName: variant.displayName,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity,
            productId: variant.product.id,
            productTitle: variant.product.title,
            productHandle: variant.product.handle,
          };
        }
      });

      // Determine which SKUs were not found
      skus.forEach(sku => {
        if (!foundSkus.includes(sku)) {
          notFoundSkus.push(sku);
        }
      });

      return {
        variants: skuToVariant,
        summary: {
          requested: skus.length,
          found: foundSkus.length,
          notFound: notFoundSkus.length,
        },
        notFoundSkus,
      };
    } catch (error) {
      console.error("Error fetching variants by SKUs:", error);
      throw new Error(
        `Failed to fetch variants by SKUs: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getVariantsBySkus };
