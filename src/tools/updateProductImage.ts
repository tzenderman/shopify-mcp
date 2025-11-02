import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for updating a product image
const UpdateProductImageInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update image in"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  id: z.string().min(1).describe("Image ID (GID format: gid://shopify/ProductImage/...)"),
  altText: z.string().optional().describe("Alt text for the image"),
});

type UpdateProductImageInput = z.infer<typeof UpdateProductImageInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateProductImage = {
  name: "update-product-image",
  description: "Update an existing product image's properties in a specific store",
  schema: UpdateProductImageInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateProductImageInput) => {
    try {
      const { storeId, productId, id, altText } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation productUpdateMedia($productId: ID!, $media: [UpdateMediaInput!]!) {
          productUpdateMedia(productId: $productId, media: $media) {
            media {
              ... on MediaImage {
                id
                alt
                image {
                  url
                }
              }
            }
            mediaUserErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        productId,
        media: [
          {
            id,
            alt: altText,
          },
        ],
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productUpdateMedia: {
          media: any[];
          mediaUserErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.productUpdateMedia.mediaUserErrors.length > 0) {
        throw new Error(
          `Failed to update product image: ${data.productUpdateMedia.mediaUserErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { image: data.productUpdateMedia.media[0] };
    } catch (error) {
      console.error("Error updating product image:", error);
      throw new Error(
        `Failed to update product image: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateProductImage };
