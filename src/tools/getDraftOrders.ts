import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getDraftOrders
const GetDraftOrdersInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  query: z.string().optional().describe("Search query to filter draft orders"),
  limit: z.number().default(10).describe("Number of draft orders to retrieve (default: 10)"),
});

type GetDraftOrdersInput = z.infer<typeof GetDraftOrdersInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getDraftOrders = {
  name: "get-draft-orders",
  description: "Get all draft orders or search draft orders from a specific store",
  schema: GetDraftOrdersInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetDraftOrdersInput) => {
    try {
      const { storeId, query: searchQuery, limit } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetDraftOrders($first: Int!, $query: String) {
          draftOrders(first: $first, query: $query) {
            edges {
              node {
                id
                name
                email
                note2
                tags
                totalPrice
                currencyCode
                taxExempt
                createdAt
                updatedAt
                status
                invoiceUrl
                lineItems(first: 10) {
                  edges {
                    node {
                      id
                      name
                      quantity
                      sku
                      vendor
                    }
                  }
                }
                customer {
                  id
                  email
                  firstName
                  lastName
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

      const data = (await shopifyClient.request(query, variables)) as {
        draftOrders: {
          edges: Array<{
            node: any;
          }>;
          pageInfo: {
            hasNextPage: boolean;
            hasPreviousPage: boolean;
          };
        };
      };

      // Extract and format draft order data
      const draftOrders = data.draftOrders.edges.map((edge: any) => {
        const draftOrder = edge.node;

        // Format line items
        const lineItems = draftOrder.lineItems.edges.map((itemEdge: any) => itemEdge.node);

        return {
          id: draftOrder.id,
          name: draftOrder.name,
          email: draftOrder.email,
          note: draftOrder.note2,
          tags: draftOrder.tags,
          totalPrice: draftOrder.totalPrice,
          currencyCode: draftOrder.currencyCode,
          taxExempt: draftOrder.taxExempt,
          createdAt: draftOrder.createdAt,
          updatedAt: draftOrder.updatedAt,
          status: draftOrder.status,
          invoiceUrl: draftOrder.invoiceUrl,
          lineItems,
          customer: draftOrder.customer,
        };
      });

      return {
        draftOrders,
        pageInfo: data.draftOrders.pageInfo,
      };
    } catch (error) {
      console.error("Error fetching draft orders:", error);
      throw new Error(
        `Failed to fetch draft orders: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getDraftOrders };
