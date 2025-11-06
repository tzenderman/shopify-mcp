import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import { readFile } from "fs/promises";
import { resolve } from "path";
import type { StoreManager } from "../stores/storeManager.js";

// Base schema shape (for MCP tool registration)
const CreateProductImageInputShape = {
  storeId: z.string().min(1).describe("The store ID to create image in"),
  productId: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  src: z.string().optional().describe("URL of the image (for URL-based images)"),
  filePath: z.string().optional().describe("Local file path to the image (most token-efficient method)"),
  attachment: z.string().optional().describe("Base64-encoded image data (for direct upload)"),
  altText: z.string().optional().describe("Alt text for the image"),
  filename: z.string().optional().describe("Filename for the image (optional, will be inferred from filePath if not provided)"),
};

// Full schema with validation (for runtime validation)
const CreateProductImageInputSchema = z.object(CreateProductImageInputShape).refine(
  (data) => data.src || data.attachment || data.filePath,
  {
    message: "Either src (URL), filePath (local file), or attachment (base64 data) must be provided",
  }
);

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

      // Handle filePath: read file and convert to base64
      let base64Data: string | undefined = imageInput.attachment;
      let inferredFilename: string | undefined = imageInput.filename;

      if (imageInput.filePath) {
        try {
          // Resolve the file path (handles relative paths)
          const absolutePath = resolve(imageInput.filePath);

          // Read the file
          const fileBuffer = await readFile(absolutePath);

          // Convert to base64
          base64Data = fileBuffer.toString('base64');

          // Infer filename from path if not provided
          if (!inferredFilename) {
            inferredFilename = absolutePath.split('/').pop() || 'image';
          }
        } catch (fileError) {
          throw new Error(
            `Failed to read file at path "${imageInput.filePath}": ${
              fileError instanceof Error ? fileError.message : String(fileError)
            }`
          );
        }
      }

      // Use productCreateMedia for base64 uploads, productAppendImages for URLs
      if (base64Data) {
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
              originalSource: base64Data,
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

export { createProductImage, CreateProductImageInputShape };
