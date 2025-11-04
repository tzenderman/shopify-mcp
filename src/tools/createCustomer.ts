import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for creating a customer
const CreateCustomerInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to create customer in"),
  firstName: z.string().min(1).describe("Customer's first name"),
  lastName: z.string().min(1).describe("Customer's last name"),
  email: z.string().email().describe("Customer's email address"),
  phone: z.string().optional().describe("Customer's phone number"),
  tags: z.array(z.string()).optional().describe("Tags to associate with the customer"),
  note: z.string().optional().describe("Note about the customer"),
  taxExempt: z.boolean().optional().describe("Whether the customer is exempt from taxes"),
  addresses: z
    .array(
      z.object({
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
      })
    )
    .optional()
    .describe("Customer addresses"),
  metafields: z
    .array(
      z.object({
        namespace: z.string(),
        key: z.string(),
        value: z.string(),
        type: z.string(),
      })
    )
    .optional()
    .describe("Metafields to associate with the customer"),
});

type CreateCustomerInput = z.infer<typeof CreateCustomerInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const createCustomer = {
  name: "create-customer",
  description: "Create a new customer in a specific store",
  schema: CreateCustomerInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: CreateCustomerInput) => {
    try {
      const { storeId, ...customerInput } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        mutation customerCreate($input: CustomerInput!) {
          customerCreate(input: $input) {
            customer {
              id
              firstName
              lastName
              email
              phone
              tags
              note
              taxExempt
              createdAt
              updatedAt
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
              metafields(first: 10) {
                edges {
                  node {
                    id
                    namespace
                    key
                    value
                  }
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
        input: customerInput,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        customerCreate: {
          customer: any;
          userErrors: Array<{
            field: string;
            message: string;
          }>;
        };
      };

      // If there are user errors, throw an error
      if (data.customerCreate.userErrors.length > 0) {
        throw new Error(
          `Failed to create customer: ${data.customerCreate.userErrors
            .map((e) => `${e.field}: ${e.message}`)
            .join(", ")}`
        );
      }

      // Format and return the created customer
      const customer = data.customerCreate.customer;

      // Format metafields if they exist
      const metafields =
        customer.metafields?.edges.map((edge: any) => edge.node) || [];

      return {
        customer: {
          id: customer.id,
          firstName: customer.firstName,
          lastName: customer.lastName,
          email: customer.email,
          phone: customer.phone,
          tags: customer.tags,
          note: customer.note,
          taxExempt: customer.taxExempt,
          createdAt: customer.createdAt,
          updatedAt: customer.updatedAt,
          defaultAddress: customer.defaultAddress,
          addresses: customer.addresses,
          metafields,
        },
      };
    } catch (error) {
      console.error("Error creating customer:", error);
      throw new Error(
        `Failed to create customer: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { createCustomer };
