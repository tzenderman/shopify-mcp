import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";
import { executeWithTimeout } from "../utils/graphqlHelpers.js";
import { logger } from "../utils/logger.js";

// Input schema for getCollections
const GetCollectionsInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  query: z.string().optional().describe("Search query to filter collections"),
  limit: z.number().default(10).describe("Number of collections to retrieve (default: 10)"),
});

type GetCollectionsInput = z.infer<typeof GetCollectionsInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getCollections = {
  name: "get-collections",
  description: "Get all collections or search collections from a specific store",
  schema: GetCollectionsInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetCollectionsInput) => {
    try {
      const { storeId, query: searchQuery, limit } = input;

      logger.debug(`[getCollections] Fetching collections for store: ${storeId}`, {
        searchQuery,
        limit,
      });

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetCollections($first: Int!, $query: String) {
          collections(first: $first, query: $query) {
            edges {
              node {
                id
                title
                handle
                description(truncateAt: 200)
                descriptionHtml
                sortOrder
                updatedAt
                image {
                  id
                  url
                  altText
                }
                productsCount {
                  count
                }
                ruleSet {
                  appliedDisjunctively
                  rules {
                    column
                    relation
                    condition
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
        query: searchQuery,
      };

      const data = await executeWithTimeout<{
        collections: {
          edges: Array<{
            node: any;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
          };
        };
      }>(shopifyClient, query, variables, {
        operation: "getCollections",
        storeId,
      });

      // Extract and format collection data
      const collections = data.collections.edges.map((edge: any) => {
        const collection = edge.node;
        return {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          description: collection.description,
          descriptionHtml: collection.descriptionHtml,
          sortOrder: collection.sortOrder,
          updatedAt: collection.updatedAt,
          image: collection.image,
          productsCount: collection.productsCount?.count || 0,
          ruleSet: collection.ruleSet,
        };
      });

      logger.debug(`[getCollections] Successfully fetched ${collections.length} collections`);

      return {
        collections,
        pageInfo: data.collections.pageInfo,
      };
    } catch (error) {
      logger.error("[getCollections] Failed to fetch collections:", error);

      // Re-throw the error with context (it may already have helpful details from executeWithTimeout)
      if (error instanceof Error) {
        throw error;
      }

      throw new Error(
        `Failed to fetch collections: ${String(error)}`
      );
    }
  },
};

export { getCollections };
