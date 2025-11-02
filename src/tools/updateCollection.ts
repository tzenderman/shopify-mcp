import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Schema for collection rule conditions
const CollectionRuleConditionSchema = z.object({
  column: z.enum([
    "TITLE", "TYPE", "VENDOR", "VARIANT_TITLE", "VARIANT_COMPARE_AT_PRICE",
    "VARIANT_WEIGHT", "VARIANT_INVENTORY", "VARIANT_PRICE", "TAG", "IS_PRICE_REDUCED",
    "PRODUCT_METAFIELD_DEFINITION", "VARIANT_METAFIELD_DEFINITION"
  ]),
  relation: z.enum([
    "EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "STARTS_WITH",
    "ENDS_WITH", "CONTAINS", "NOT_CONTAINS"
  ]),
  condition: z.string(),
  conditionObjectId: z.string().optional().describe("Required for metafield-based rules (GID format)"),
});

// Schema for collection rules
const CollectionRuleSetSchema = z.object({
  appliedDisjunctively: z.boolean().describe("Whether to use OR logic (true) or AND logic (false)"),
  rules: z.array(CollectionRuleConditionSchema).min(1),
});

// Schema for collection image
const CollectionImageSchema = z.object({
  src: z.string().optional().describe("Source URL of the image"),
  altText: z.string().optional().describe("Alt text for the image"),
});

// Input schema for updating a collection
const UpdateCollectionInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update collection in"),
  id: z.string().min(1).describe("Collection ID (GID format: gid://shopify/Collection/...)"),
  title: z.string().optional().describe("Title of the collection"),
  descriptionHtml: z.string().optional().describe("HTML description of the collection"),
  handle: z.string().optional().describe("URL handle for the collection"),
  ruleSet: CollectionRuleSetSchema.optional().describe("Rules for automated/smart collections"),
  image: CollectionImageSchema.optional().describe("Collection image"),
  sortOrder: z.enum([
    "ALPHA_ASC", "ALPHA_DESC", "BEST_SELLING", "CREATED", "CREATED_DESC",
    "MANUAL", "PRICE_ASC", "PRICE_DESC"
  ]).optional().describe("How products are sorted in the collection"),
  templateSuffix: z.string().optional().describe("Template suffix for the collection page"),
});

type UpdateCollectionInput = z.infer<typeof UpdateCollectionInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateCollection = {
  name: "update-collection",
  description: "Update an existing collection's information in a specific store",
  schema: UpdateCollectionInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateCollectionInput) => {
    try {
      const { storeId, id, ...collectionFields } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation collectionUpdate($input: CollectionInput!) {
          collectionUpdate(input: $input) {
            collection {
              id
              title
              descriptionHtml
              handle
              sortOrder
              image {
                id
                url
                altText
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
          ...collectionFields,
        },
      };

      const data = (await shopifyClient.request(query, variables)) as {
        collectionUpdate: {
          collection: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.collectionUpdate.userErrors.length > 0) {
        throw new Error(
          `Failed to update collection: ${data.collectionUpdate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { collection: data.collectionUpdate.collection };
    } catch (error) {
      console.error("Error updating collection:", error);
      throw new Error(
        `Failed to update collection: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateCollection };
