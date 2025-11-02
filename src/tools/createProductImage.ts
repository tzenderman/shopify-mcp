import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for creating a product image
const CreateProductImageInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to create image in"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  src: z.string().optional().describe("URL of the image (for URL-based images)"),
  attachment: z.string().optional().describe("Base64-encoded image data (for direct upload)"),
  altText: z.string().optional().describe("Alt text for the image"),
  filename: z.string().optional().describe("Filename for the image (required when using attachment)"),
}).refine((data) => data.src || data.attachment, {
  message: "Either src (URL) or attachment (base64 data) must be provided",
});

type CreateProductImageInput = z.infer<typeof CreateProductImageInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const createProductImage = {
  name: "create-product-image",
  description: "Create a new image for a product in a specific store (supports URL or base64 upload)",
  schema: CreateProductImageInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: CreateProductImageInput) => {
    try {
      const { storeId, productId, ...imageInput } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      // Use productCreateMedia for base64 uploads, productAppendImages for URLs
      if (imageInput.attachment) {
        // Base64 upload
        const query = gql`
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
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
              originalSource: imageInput.attachment,
              alt: imageInput.altText || "",
              mediaContentType: "IMAGE",
            },
          ],
        };

        const data = (await shopifyClient.request(query, variables)) as {
          productCreateMedia: {
            media: any[];
            mediaUserErrors: Array<{
              field: string;
              message: string;
            }>;
          };
        };

        if (data.productCreateMedia.mediaUserErrors.length > 0) {
          throw new Error(
            `Failed to create product image: ${data.productCreateMedia.mediaUserErrors
              .map((e) => `${e.field}: ${e.message}`)
              .join(", ")}`
          );
        }

        return { image: data.productCreateMedia.media[0] };
      } else {
        // URL-based upload - use productCreateMedia with external URL
        const query = gql`
          mutation productCreateMedia($productId: ID!, $media: [CreateMediaInput!]!) {
            productCreateMedia(productId: $productId, media: $media) {
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
              originalSource: imageInput.src,
              alt: imageInput.altText || "",
              mediaContentType: "IMAGE",
            },
          ],
        };

        const data = (await shopifyClient.request(query, variables)) as {
          productCreateMedia: {
            media: any[];
            mediaUserErrors: Array<{
              field: string;
              message: string;
            }>;
          };
        };

        if (data.productCreateMedia.mediaUserErrors.length > 0) {
          throw new Error(
            `Failed to create product image: ${data.productCreateMedia.mediaUserErrors
              .map((e) => `${e.field}: ${e.message}`)
              .join(", ")}`
          );
        }

        return { image: data.productCreateMedia.media[0] };
      }
    } catch (error) {
      console.error("Error creating product image:", error);
      throw new Error(
        `Failed to create product image: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { createProductImage };
