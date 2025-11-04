import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getDraftOrderById
const GetDraftOrderByIdInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  draftOrderId: z.string().min(1).describe("Draft Order ID (GID format: gid://shopify/DraftOrder/...)"),
});

type GetDraftOrderByIdInput = z.infer<typeof GetDraftOrderByIdInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getDraftOrderById = {
  name: "get-draft-order-by-id",
  description: "Get a single draft order by ID from a specific store",
  schema: GetDraftOrderByIdInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetDraftOrderByIdInput) => {
    try {
      const { storeId, draftOrderId } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetDraftOrder($id: ID!) {
          draftOrder(id: $id) {
            id
            name
            email
            phone
            note2
            tags
            totalPrice
            subtotalPrice
            totalTax
            totalShippingPrice
            currencyCode
            taxExempt
            createdAt
            updatedAt
            completedAt
            status
            invoiceUrl
            invoiceSentAt
            lineItems(first: 50) {
              edges {
                node {
                  id
                  name
                  title
                  quantity
                  originalUnitPrice
                  discountedUnitPrice
                  sku
                  vendor
                  taxable
                  requiresShipping
                  weight {
                    value
                    unit
                  }
                }
              }
            }
            customer {
              id
              email
              firstName
              lastName
              phone
            }
            shippingAddress {
              address1
              address2
              city
              province
              provinceCode
              country
              countryCode
              zip
              phone
            }
            billingAddress {
              address1
              address2
              city
              province
              provinceCode
              country
              countryCode
              zip
              phone
            }
            shippingLine {
              title
              originalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
            }
            appliedDiscount {
              description
              value
              valueType
            }
          }
        }
      `;

      const variables = {
        id: draftOrderId,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        draftOrder: any;
      };

      if (!data.draftOrder) {
        throw new Error(`Draft Order with ID ${draftOrderId} not found`);
      }

      const draftOrder = data.draftOrder;

      // Format line items
      const lineItems = draftOrder.lineItems.edges.map((edge: any) => edge.node);

      return {
        draftOrder: {
          id: draftOrder.id,
          name: draftOrder.name,
          email: draftOrder.email,
          phone: draftOrder.phone,
          note: draftOrder.note2,
          tags: draftOrder.tags,
          totalPrice: draftOrder.totalPrice,
          subtotalPrice: draftOrder.subtotalPrice,
          totalTax: draftOrder.totalTax,
          totalShippingPrice: draftOrder.totalShippingPrice,
          currencyCode: draftOrder.currencyCode,
          taxExempt: draftOrder.taxExempt,
          createdAt: draftOrder.createdAt,
          updatedAt: draftOrder.updatedAt,
          completedAt: draftOrder.completedAt,
          status: draftOrder.status,
          invoiceUrl: draftOrder.invoiceUrl,
          invoiceSentAt: draftOrder.invoiceSentAt,
          lineItems,
          customer: draftOrder.customer,
          shippingAddress: draftOrder.shippingAddress,
          billingAddress: draftOrder.billingAddress,
          shippingLine: draftOrder.shippingLine,
          appliedDiscount: draftOrder.appliedDiscount,
        },
      };
    } catch (error) {
      console.error("Error fetching draft order:", error);
      throw new Error(
        `Failed to fetch draft order: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getDraftOrderById };
