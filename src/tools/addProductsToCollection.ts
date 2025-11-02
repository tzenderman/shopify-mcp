import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for adding products to a collection
const AddProductsToCollectionInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID"),
  id: z.string().min(1).describe("Collection ID (GID format: gid://shopify/Collection/...)"),
  productIds: z.array(z.string()).min(1).describe("Array of Product IDs to add (GID format)"),
});

type AddProductsToCollectionInput = z.infer<typeof AddProductsToCollectionInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const addProductsToCollection = {
  name: "add-products-to-collection",
  description: "Add products to a manual collection in a specific store",
  schema: AddProductsToCollectionInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: AddProductsToCollectionInput) => {
    try {
      const { storeId, id, productIds } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation collectionAddProductsV2($id: ID!, $productIds: [ID!]!) {
          collectionAddProductsV2(id: $id, productIds: $productIds) {
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
        collectionAddProductsV2: {
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
      if (data.collectionAddProductsV2.userErrors.length > 0) {
        throw new Error(
          `Failed to add products to collection: ${data.collectionAddProductsV2.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { job: data.collectionAddProductsV2.job };
    } catch (error) {
      console.error("Error adding products to collection:", error);
      throw new Error(
        `Failed to add products to collection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { addProductsToCollection };
