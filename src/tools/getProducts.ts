import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getProducts
const GetProductsInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query"),
  searchTitle: z.string().optional().describe("Search products by title (supports wildcards). Example: 'shirt' will find products with 'shirt' in the title"),
  searchSku: z.string().optional().describe("Search products by variant SKU (supports wildcards with *). Example: 'ABC-*' will find all SKUs starting with 'ABC-'. When provided, searchTitle is ignored."),
  limit: z.number().default(10).describe("Number of results to return (default: 10)")
});

type GetProductsInput = z.infer<typeof GetProductsInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getProducts = {
  name: "get-products",
  description: "Get products from a store. Supports two search modes: 1) Search by TITLE using searchTitle parameter (e.g., 'shirt' finds products with 'shirt' in title), or 2) Search by SKU using searchSku parameter (e.g., 'ABC-123' or 'ABC-*' for wildcard). If searchSku is provided, it takes priority and returns products with matching variant SKUs. If neither search parameter is provided, returns all products up to the limit.",
  schema: GetProductsInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetProductsInput) => {
    try {
      const { storeId, searchTitle, searchSku, limit } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      // If searching by SKU, use productVariants query
      if (searchSku) {
        const variantsQuery = gql`
          query GetProductsBySku($first: Int!, $query: String!) {
            productVariants(first: $first, query: $query) {
              edges {
                node {
                  id
                  title
                  price
                  sku
                  inventoryQuantity
                  product {
                    id
                    title
                    description
                    handle
                    status
                    createdAt
                    updatedAt
                    totalInventory
                    priceRangeV2 {
                      minVariantPrice {
                        amount
                        currencyCode
                      }
                      maxVariantPrice {
                        amount
                        currencyCode
                      }
                    }
                    images(first: 1) {
                      edges {
                        node {
                          url
                          altText
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        `;

        const variables = {
          first: limit,
          query: `sku:${searchSku}`
        };

        const data = (await shopifyClient.request(variantsQuery, variables)) as {
          productVariants: any;
        };

        // Group variants by product and format the response
        const productsMap = new Map<string, any>();

        data.productVariants.edges.forEach((edge: any) => {
          const variant = edge.node;
          const product = variant.product;

          if (!productsMap.has(product.id)) {
            // Get first image if it exists
            const imageUrl =
              product.images.edges.length > 0
                ? product.images.edges[0].node.url
                : null;

            productsMap.set(product.id, {
              id: product.id,
              title: product.title,
              description: product.description,
              handle: product.handle,
              status: product.status,
              createdAt: product.createdAt,
              updatedAt: product.updatedAt,
              totalInventory: product.totalInventory,
              priceRange: {
                minPrice: {
                  amount: product.priceRangeV2.minVariantPrice.amount,
                  currencyCode: product.priceRangeV2.minVariantPrice.currencyCode
                },
                maxPrice: {
                  amount: product.priceRangeV2.maxVariantPrice.amount,
                  currencyCode: product.priceRangeV2.maxVariantPrice.currencyCode
                }
              },
              imageUrl,
              matchedVariants: []
            });
          }

          // Add the matched variant to this product
          productsMap.get(product.id).matchedVariants.push({
            id: variant.id,
            title: variant.title,
            price: variant.price,
            inventoryQuantity: variant.inventoryQuantity,
            sku: variant.sku
          });
        });

        const products = Array.from(productsMap.values());
        return { products, searchMode: 'sku' };
      }

      // Otherwise, use standard products query (search by title or get all)
      const query = gql`
        query GetProducts($first: Int!, $query: String) {
          products(first: $first, query: $query) {
            edges {
              node {
                id
                title
                description
                handle
                status
                createdAt
                updatedAt
                totalInventory
                priceRangeV2 {
                  minVariantPrice {
                    amount
                    currencyCode
                  }
                  maxVariantPrice {
                    amount
                    currencyCode
                  }
                }
                images(first: 1) {
                  edges {
                    node {
                      url
                      altText
                    }
                  }
                }
                variants(first: 5) {
                  edges {
                    node {
                      id
                      title
                      price
                      inventoryQuantity
                      sku
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const variables = {
        first: limit,
        query: searchTitle ? `title:*${searchTitle}*` : undefined
      };

      const data = (await shopifyClient.request(query, variables)) as {
        products: any;
      };

      // Extract and format product data
      const products = data.products.edges.map((edge: any) => {
        const product = edge.node;

        // Format variants
        const variants = product.variants.edges.map((variantEdge: any) => ({
          id: variantEdge.node.id,
          title: variantEdge.node.title,
          price: variantEdge.node.price,
          inventoryQuantity: variantEdge.node.inventoryQuantity,
          sku: variantEdge.node.sku
        }));

        // Get first image if it exists
        const imageUrl =
          product.images.edges.length > 0
            ? product.images.edges[0].node.url
            : null;

        return {
          id: product.id,
          title: product.title,
          description: product.description,
          handle: product.handle,
          status: product.status,
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
          totalInventory: product.totalInventory,
          priceRange: {
            minPrice: {
              amount: product.priceRangeV2.minVariantPrice.amount,
              currencyCode: product.priceRangeV2.minVariantPrice.currencyCode
            },
            maxPrice: {
              amount: product.priceRangeV2.maxVariantPrice.amount,
              currencyCode: product.priceRangeV2.maxVariantPrice.currencyCode
            }
          },
          imageUrl,
          variants
        };
      });

      return { products, searchMode: searchTitle ? 'title' : 'all' };
    } catch (error) {
      console.error("Error fetching products:", error);
      throw new Error(
        `Failed to fetch products: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
};

export { getProducts };
