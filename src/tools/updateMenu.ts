import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Schema for menu items (using lazy for recursion)
const MenuItemSchema: z.ZodType<{
  title: string;
  type: "FRONTPAGE" | "COLLECTIONS" | "COLLECTION" | "PRODUCT" | "CATALOG" | "PAGE" | "BLOG" | "ARTICLE" | "POLICY" | "HTTP" | "SHOP_POLICY";
  url?: string;
  resourceId?: string;
  tags?: string[];
  id?: string;
  items?: Array<any>;
}> = z.object({
  title: z.string().min(1).describe("Title of the menu item"),
  type: z.enum(["FRONTPAGE", "COLLECTIONS", "COLLECTION", "PRODUCT", "CATALOG", "PAGE", "BLOG", "ARTICLE", "POLICY", "HTTP", "SHOP_POLICY"]).describe("Type of the menu item"),
  url: z.string().optional().describe("URL for the menu item (can be relative or absolute)"),
  resourceId: z.string().optional().describe("Resource ID if linking to a product, collection, etc. (GID format)"),
  tags: z.array(z.string()).optional().describe("Tags to filter a collection"),
  id: z.string().optional().describe("Menu item ID (GID format) - for updating existing items"),
  items: z.array(z.lazy(() => MenuItemSchema)).optional().describe("Nested menu items (for submenus)"),
});

// Input schema for updating a menu
const UpdateMenuInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update menu in"),
  id: z.string().min(1).describe("Menu ID (GID format: gid://shopify/Menu/...)"),
  title: z.string().min(1).describe("Title of the menu"),
  handle: z.string().optional().describe("URL handle for the menu"),
  items: z.array(MenuItemSchema).min(1).describe("Menu items (replaces all existing items)"),
});

type UpdateMenuInput = z.infer<typeof UpdateMenuInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateMenu = {
  name: "update-menu",
  description: "Update an existing navigation menu in a specific store",
  schema: UpdateMenuInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateMenuInput) => {
    try {
      const { storeId, id, ...menuFields } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation menuUpdate($id: ID!, $title: String!, $handle: String, $items: [MenuItemUpdateInput!]!) {
          menuUpdate(id: $id, title: $title, handle: $handle, items: $items) {
            menu {
              id
              title
              handle
              items {
                id
                title
                url
                type
                items {
                  id
                  title
                  url
                  type
                }
              }
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
        ...menuFields,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        menuUpdate: {
          menu: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.menuUpdate.userErrors.length > 0) {
        throw new Error(
          `Failed to update menu: ${data.menuUpdate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { menu: data.menuUpdate.menu };
    } catch (error) {
      console.error("Error updating menu:", error);
      throw new Error(
        `Failed to update menu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateMenu };
