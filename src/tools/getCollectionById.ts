import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getCollectionById
const GetCollectionByIdInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  collectionId: z.string().min(1).describe("Collection ID (GID format: gid://shopify/Collection/...)"),
});

type GetCollectionByIdInput = z.infer<typeof GetCollectionByIdInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getCollectionById = {
  name: "get-collection-by-id",
  description: "Get a single collection by ID from a specific store",
  schema: GetCollectionByIdInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetCollectionByIdInput) => {
    try {
      const { storeId, collectionId } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetCollection($id: ID!) {
          collection(id: $id) {
            id
            title
            handle
            description
            descriptionHtml
            sortOrder
            templateSuffix
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
            seo {
              description
              title
            }
            products(first: 10) {
              edges {
                node {
                  id
                  title
                  handle
                }
              }
            }
          }
        }
      `;

      const variables = {
        id: collectionId,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        collection: any;
      };

      if (!data.collection) {
        throw new Error(`Collection with ID ${collectionId} not found`);
      }

      const collection = data.collection;

      // Format products
      const products = collection.products.edges.map((edge: any) => edge.node);

      return {
        collection: {
          id: collection.id,
          title: collection.title,
          handle: collection.handle,
          description: collection.description,
          descriptionHtml: collection.descriptionHtml,
          sortOrder: collection.sortOrder,
          templateSuffix: collection.templateSuffix,
          updatedAt: collection.updatedAt,
          image: collection.image,
          productsCount: collection.productsCount?.count || 0,
          ruleSet: collection.ruleSet,
          seo: collection.seo,
          products,
        },
      };
    } catch (error) {
      console.error("Error fetching collection:", error);
      throw new Error(
        `Failed to fetch collection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getCollectionById };
