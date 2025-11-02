import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for deleting a menu
const DeleteMenuInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to delete menu from"),
  id: z.string().min(1).describe("Menu ID (GID format: gid://shopify/Menu/...)"),
});

type DeleteMenuInput = z.infer<typeof DeleteMenuInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const deleteMenu = {
  name: "delete-menu",
  description: "Delete a navigation menu from a specific store",
  schema: DeleteMenuInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: DeleteMenuInput) => {
    try {
      const { storeId, id } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation menuDelete($id: ID!) {
          menuDelete(id: $id) {
            deletedMenuId
            userErrors {
              field
              message
            }
          }
        }
      `;

      const variables = {
        id,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        menuDelete: {
          deletedMenuId: string | null;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.menuDelete.userErrors.length > 0) {
        throw new Error(
          `Failed to delete menu: ${data.menuDelete.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return {
        success: true,
        deletedMenuId: data.menuDelete.deletedMenuId,
      };
    } catch (error) {
      console.error("Error deleting menu:", error);
      throw new Error(
        `Failed to delete menu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { deleteMenu };
