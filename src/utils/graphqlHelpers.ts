import type { GraphQLClient } from "graphql-request";
import { ClientError } from "graphql-request";
import { logger } from "./logger.js";

/**
 * Default timeout for GraphQL requests (30 seconds)
 * Can be overridden with GRAPHQL_TIMEOUT_MS environment variable
 */
const DEFAULT_TIMEOUT_MS = 30000;
const TIMEOUT_MS = process.env.GRAPHQL_TIMEOUT_MS
  ? parseInt(process.env.GRAPHQL_TIMEOUT_MS, 10)
  : DEFAULT_TIMEOUT_MS;

/**
 * Execute a GraphQL request with timeout and enhanced error handling
 */
export async function executeWithTimeout<T>(
  client: GraphQLClient,
  query: string,
  variables: any,
  context: {
    operation: string;
    storeId: string;
  }
): Promise<T> {
  logger.debug(
    `[${context.operation}] Starting request for store: ${context.storeId}`,
    { variables }
  );

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(
        new Error(
          `GraphQL request timed out after ${TIMEOUT_MS}ms. This may indicate: ` +
            `1) Network issues, 2) Missing API permissions/scopes, or 3) Shopify API is slow. ` +
            `Check your app's scopes in Shopify Admin and verify network connectivity.`
        )
      );
    }, TIMEOUT_MS);
  });

  const requestPromise = client.request<T>(query, variables);

  try {
    const result = await Promise.race([requestPromise, timeoutPromise]);
    logger.debug(
      `[${context.operation}] Request completed successfully for store: ${context.storeId}`
    );
    return result;
  } catch (error) {
    // Enhanced error handling for GraphQL errors
    if (error instanceof ClientError) {
      const response = error.response;
      logger.error(
        `[${context.operation}] GraphQL error for store: ${context.storeId}`,
        {
          errors: response.errors,
          status: response.status,
        }
      );

      // Check for common permission-related errors
      const errors = response.errors || [];
      const hasPermissionError = errors.some(
        (err: any) =>
          err.message?.includes("access") ||
          err.message?.includes("permission") ||
          err.message?.includes("scope") ||
          err.extensions?.code === "ACCESS_DENIED"
      );

      if (hasPermissionError) {
        throw new Error(
          `Permission denied: Your Shopify app may be missing required API scopes. ` +
            `Error: ${errors.map((e: any) => e.message).join(", ")}. ` +
            `Please check your app's API scopes in Shopify Admin Settings > Apps and sales channels > [Your App] > Configuration.`
        );
      }

      // Re-throw with formatted error message
      throw new Error(
        `GraphQL error: ${errors.map((e: any) => e.message).join(", ")}`
      );
    }

    // For other errors (including timeout), log and re-throw
    logger.error(
      `[${context.operation}] Request failed for store: ${context.storeId}`,
      error
    );
    throw error;
  }
}
