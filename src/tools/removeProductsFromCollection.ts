import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for removing products from a collection
const RemoveProductsFromCollectionInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID"),
  id: z.string().min(1).describe("Collection ID (GID format: gid://shopify/Collection/...)"),
  productIds: z.array(z.string()).min(1).describe("Array of Product IDs to remove (GID format)"),
});

type RemoveProductsFromCollectionInput = z.infer<typeof RemoveProductsFromCollectionInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const removeProductsFromCollection = {
  name: "remove-products-from-collection",
  description: "Remove products from a manual collection in a specific store",
  schema: RemoveProductsFromCollectionInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: RemoveProductsFromCollectionInput) => {
    try {
      const { storeId, id, productIds } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation collectionRemoveProducts($id: ID!, $productIds: [ID!]!) {
          collectionRemoveProducts(id: $id, productIds: $productIds) {
            job {
              id
              done
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        id,
        productIds,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        collectionRemoveProducts: {
          job: {
            id: string;
            done: boolean;
          } | null;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.collectionRemoveProducts.userErrors.length > 0) {
        throw new Error(
          `Failed to remove products from collection: ${data.collectionRemoveProducts.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { job: data.collectionRemoveProducts.job };
    } catch (error) {
      console.error("Error removing products from collection:", error);
      throw new Error(
        `Failed to remove products from collection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { removeProductsFromCollection };
