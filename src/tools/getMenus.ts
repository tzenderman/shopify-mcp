import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getMenus
const GetMenusInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  limit: z.number().default(10).describe("Number of menus to retrieve (default: 10)"),
});

type GetMenusInput = z.infer<typeof GetMenusInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getMenus = {
  name: "get-menus",
  description: "Get all navigation menus from a specific store",
  schema: GetMenusInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetMenusInput) => {
    try {
      const { storeId, limit } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetMenus($first: Int!) {
          menus(first: $first) {
            edges {
              node {
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
            pageInfo {
              hasNextPage
              hasPreviousPage
            }
          }
        }
      `;

      const variables = {
        first: limit,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        menus: {
          edges: Array<{
            node: any;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
          };
        };
      };

      // Extract and format menu data
      const menus = data.menus.edges.map((edge: any) => edge.node);

      return {
        menus,
        pageInfo: data.menus.pageInfo,
      };
    } catch (error) {
      console.error("Error fetching menus:", error);
      throw new Error(
        `Failed to fetch menus: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getMenus };
