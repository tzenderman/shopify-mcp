import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for deleting a product image
const DeleteProductImageInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to delete image from"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  id: z.string().min(1).describe("Image ID (GID format: gid://shopify/ProductImage/...)"),
});

type DeleteProductImageInput = z.infer<typeof DeleteProductImageInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const deleteProductImage = {
  name: "delete-product-image",
  description: "Delete a product image from a specific store",
  schema: DeleteProductImageInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: DeleteProductImageInput) => {
    try {
      const { storeId, productId, id } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation productDeleteMedia($productId: ID!, $mediaIds: [ID!]!) {
          productDeleteMedia(productId: $productId, mediaIds: $mediaIds) {
            deletedMediaIds
            deletedProductImageIds
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        productId,
        mediaIds: [id],
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productDeleteMedia: {
          deletedMediaIds: string[];
          deletedProductImageIds: string[];
          mediaUserErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.productDeleteMedia.mediaUserErrors.length > 0) {
        throw new Error(
          `Failed to delete product image: ${data.productDeleteMedia.mediaUserErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return {
        success: true,
        deletedMediaIds: data.productDeleteMedia.deletedMediaIds,
        deletedProductImageIds: data.productDeleteMedia.deletedProductImageIds
      };
    } catch (error) {
      console.error("Error deleting product image:", error);
      throw new Error(
        `Failed to delete product image: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { deleteProductImage };
