import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for updating a product
const UpdateProductInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update product in"),
  id: z.string().min(1).describe("Product ID (GID format: gid://shopify/Product/...)"),
  title: z.string().optional(),
  descriptionHtml: z.string().optional(),
  vendor: z.string().optional(),
  productType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  status: z.enum(["ACTIVE", "DRAFT", "ARCHIVED"]).optional(),
});

type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateProduct = {
  name: "update-product",
  description: "Update an existing product's information in a specific store",
  schema: UpdateProductInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateProductInput) => {
    try {
      const { storeId, id, ...productFields } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation productUpdate($input: ProductInput!) {
          productUpdate(input: $input) {
            product {
              id
              title
              descriptionHtml
              vendor
              productType
              status
              tags
            }
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        input: {
          id,
          ...productFields,
        },
      };

      const data = (await shopifyClient.request(query, variables)) as {
        productUpdate: {
          product: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.productUpdate.userErrors.length > 0) {
        throw new Error(
          `Failed to update product: ${data.productUpdate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { product: data.productUpdate.product };
    } catch (error) {
      console.error("Error updating product:", error);
      throw new Error(
        `Failed to update product: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateProduct };
