import type { StoreConfig } from "./types.js";

export function parseStoreConfigs(argv: any): StoreConfig[] {
  // Option 1: New multi-store format via --stores JSON
  if (argv.stores) {
    try {
      const storesData = JSON.parse(argv.stores);

      if (!Array.isArray(storesData)) {
        throw new Error("--stores must be a JSON array");
      }

      return storesData.map((store: any, index: number) => {
        if (!store.id || typeof store.id !== "string") {
          throw new Error(`Store at index ${index} is missing required field "id"`);
        }
        if (!store.domain || typeof store.domain !== "string") {
          throw new Error(`Store "${store.id}" is missing required field "domain"`);
        }
        if (!store.accessToken || typeof store.accessToken !== "string") {
          throw new Error(`Store "${store.id}" is missing required field "accessToken"`);
        }

        return {
          id: store.id,
          domain: store.domain,
          accessToken: store.accessToken,
          apiVersion: store.apiVersion
        };
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in --stores parameter: ${error.message}`);
      }
      throw error;
    }
  }

  // Option 2: Try environment variable for multi-store
  const storesEnv = process.env.SHOPIFY_STORES;
  if (storesEnv) {
    try {
      const storesData = JSON.parse(storesEnv);

      if (!Array.isArray(storesData)) {
        throw new Error("SHOPIFY_STORES environment variable must be a JSON array");
      }

      return storesData.map((store: any, index: number) => {
        if (!store.id || typeof store.id !== "string") {
          throw new Error(`Store at index ${index} is missing required field "id"`);
        }
        if (!store.domain || typeof store.domain !== "string") {
          throw new Error(`Store "${store.id}" is missing required field "domain"`);
        }
        if (!store.accessToken || typeof store.accessToken !== "string") {
          throw new Error(`Store "${store.id}" is missing required field "accessToken"`);
        }

        return {
          id: store.id,
          domain: store.domain,
          accessToken: store.accessToken,
          apiVersion: store.apiVersion
        };
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Invalid JSON in SHOPIFY_STORES environment variable: ${error.message}`);
      }
      throw error;
    }
  }

  // No valid configuration found
  throw new Error(
    "Error: Store configuration is required.\n\n" +
    "Use the multi-store format:\n" +
    "  --stores='[{\"id\":\"store1\",\"domain\":\"store1.myshopify.com\",\"accessToken\":\"...\"}]'\n\n" +
    "Or set the SHOPIFY_STORES environment variable:\n" +
    "  SHOPIFY_STORES='[{\"id\":\"store1\",\"domain\":\"store1.myshopify.com\",\"accessToken\":\"...\"}]'\n\n" +
    "For a single store, use a JSON array with one store:\n" +
    "  --stores='[{\"id\":\"my-store\",\"domain\":\"my-store.myshopify.com\",\"accessToken\":\"...\"}]'"
  );
}
