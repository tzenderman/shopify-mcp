import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getCustomerById
const GetCustomerByIdInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  customerId: z.string().min(1).describe("Customer ID (GID format: gid://shopify/Customer/...)"),
});

type GetCustomerByIdInput = z.infer<typeof GetCustomerByIdInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getCustomerById = {
  name: "get-customer-by-id",
  description: "Get a single customer by ID from a specific store",
  schema: GetCustomerByIdInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetCustomerByIdInput) => {
    try {
      const { storeId, customerId } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query GetCustomer($id: ID!) {
          customer(id: $id) {
            id
            firstName
            lastName
            email
            phone
            createdAt
            updatedAt
            tags
            note
            state
            taxExempt
            defaultAddress {
              id
              address1
              address2
              city
              provinceCode
              zip
              country
              phone
            }
            addresses {
              id
              address1
              address2
              city
              provinceCode
              zip
              country
              phone
            }
            amountSpent {
              amount
              currencyCode
            }
            numberOfOrders
            orders(first: 10) {
              edges {
                node {
                  id
                  name
                  createdAt
                  totalPriceSet {
                    shopMoney {
                      amount
                      currencyCode
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        id: customerId,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        customer: any;
      };

      if (!data.customer) {
        throw new Error(`Customer with ID ${customerId} not found`);
      }

      const customer = data.customer;

      // Format orders
      const orders = customer.orders.edges.map((edge: any) => ({
        id: edge.node.id,
        name: edge.node.name,
        createdAt: edge.node.createdAt,
        totalPrice: edge.node.totalPriceSet.shopMoney,
      }));

      return {
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          tags: customer.tags,
          note: customer.note,
          state: customer.state,
          taxExempt: customer.taxExempt,
          defaultAddress: customer.defaultAddress,
          addresses: customer.addresses,
          amountSpent: customer.amountSpent,
          numberOfOrders: customer.numberOfOrders,
          recentOrders: orders,
        },
      };
    } catch (error) {
      console.error("Error fetching customer:", error);
      throw new Error(
        `Failed to fetch customer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getCustomerById };
