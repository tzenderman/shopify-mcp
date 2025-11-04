import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getMenu
const GetMenuInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  menuId: z.string().min(1).describe("Menu ID (GID format: gid://shopify/Menu/...)"),
});

type GetMenuInput = z.infer<typeof GetMenuInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getMenu = {
  name: "get-menu",
  description: "Get a single navigation menu by ID from a specific store",
  schema: GetMenuInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetMenuInput) => {
    try {
      const { storeId, menuId } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetMenu($id: ID!) {
          menu(id: $id) {
            id
            handle
            title
            isDefault
            items {
              id
              title
              url
              type
              resourceId
              tags
              items {
                id
                title
                url
                type
                resourceId
                tags
                items {
                  id
                  title
                  url
                  type
                  resourceId
                  tags
                }
              }
            }
          }
        }
      `;

      const variables = {
        id: menuId,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        menu: any;
      };

      if (!data.menu) {
        throw new Error(`Menu with ID ${menuId} not found`);
      }

      return { menu: data.menu };
    } catch (error) {
      console.error("Error fetching menu:", error);
      throw new Error(
        `Failed to fetch menu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getMenu };
