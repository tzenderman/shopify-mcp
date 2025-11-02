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
  items?: Array<any>;
}> = z.object({
  title: z.string().min(1).describe("Title of the menu item"),
  type: z.enum(["FRONTPAGE", "COLLECTIONS", "COLLECTION", "PRODUCT", "CATALOG", "PAGE", "BLOG", "ARTICLE", "POLICY", "HTTP", "SHOP_POLICY"]).describe("Type of the menu item"),
  url: z.string().optional().describe("URL for the menu item (can be relative or absolute)"),
  resourceId: z.string().optional().describe("Resource ID if linking to a product, collection, etc. (GID format)"),
  tags: z.array(z.string()).optional().describe("Tags to filter a collection"),
  items: z.array(z.lazy(() => MenuItemSchema)).optional().describe("Nested menu items (for submenus)"),
});

// Input schema for creating a menu
const CreateMenuInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to create menu in"),
  title: z.string().min(1).describe("Title of the menu"),
  handle: z.string().min(1).describe("URL handle for the menu"),
  items: z.array(MenuItemSchema).min(1).describe("Menu items"),
});

type CreateMenuInput = z.infer<typeof CreateMenuInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const createMenu = {
  name: "create-menu",
  description: "Create a new navigation menu in a specific store",
  schema: CreateMenuInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: CreateMenuInput) => {
    try {
      const { storeId, ...menuInput } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation menuCreate($title: String!, $handle: String!, $items: [MenuItemCreateInput!]!) {
          menuCreate(title: $title, handle: $handle, items: $items) {
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

      const variables = menuInput;

      const data = (await shopifyClient.request(query, variables)) as {
        menuCreate: {
          menu: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.menuCreate.userErrors.length > 0) {
        throw new Error(
          `Failed to create menu: ${data.menuCreate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { menu: data.menuCreate.menu };
    } catch (error) {
      console.error("Error creating menu:", error);
      throw new Error(
        `Failed to create menu: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { createMenu };
