import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Schema for draft order line items
const DraftOrderLineItemSchema = z.object({
  variantId: z.string().optional().describe("Product variant ID (GID format)"),
  quantity: z.number().min(1).describe("Quantity of the item"),
  title: z.string().optional().describe("Custom title (for custom line items without a variant)"),
  originalUnitPrice: z.string().optional().describe("Price per item"),
  taxable: z.boolean().optional().describe("Whether the item is taxable"),
  requiresShipping: z.boolean().optional().describe("Whether the item requires shipping"),
});

// Schema for shipping address
const MailingAddressSchema = z.object({
  address1: z.string().optional(),
  address2: z.string().optional(),
  city: z.string().optional(),
  company: z.string().optional(),
  country: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  province: z.string().optional(),
  zip: z.string().optional(),
});

// Input schema for updating a draft order
const UpdateDraftOrderInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to update draft order in"),
  id: z.string().min(1).describe("Draft Order ID (GID format: gid://shopify/DraftOrder/...)"),
  lineItems: z.array(DraftOrderLineItemSchema).optional().describe("Line items for the draft order"),
  customerId: z.string().optional().describe("Customer ID (GID format: gid://shopify/Customer/...)"),
  email: z.string().email().optional().describe("Customer email"),
  phone: z.string().optional().describe("Customer phone number"),
  shippingAddress: MailingAddressSchema.optional().describe("Shipping address"),
  billingAddress: MailingAddressSchema.optional().describe("Billing address"),
  note: z.string().optional().describe("Note for the draft order (input uses 'note', response uses 'note2')"),
  tags: z.array(z.string()).optional().describe("Tags for the draft order"),
  taxExempt: z.boolean().optional().describe("Whether the order is tax exempt"),
  shippingLine: z.object({
    title: z.string(),
    price: z.string(),
  }).optional().describe("Shipping line details"),
});

type UpdateDraftOrderInput = z.infer<typeof UpdateDraftOrderInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const updateDraftOrder = {
  name: "update-draft-order",
  description: "Update an existing draft order in a specific store",
  schema: UpdateDraftOrderInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: UpdateDraftOrderInput) => {
    try {
      const { storeId, id, ...draftOrderFields } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
          draftOrderUpdate(id: $id, input: $input) {
            draftOrder {
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
              lineItems(first: 50) {
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
        input: draftOrderFields,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        draftOrderUpdate: {
          draftOrder: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.draftOrderUpdate.userErrors.length > 0) {
        throw new Error(
          `Failed to update draft order: ${data.draftOrderUpdate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      return { draftOrder: data.draftOrderUpdate.draftOrder };
    } catch (error) {
      console.error("Error updating draft order:", error);
      throw new Error(
        `Failed to update draft order: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { updateDraftOrder };
