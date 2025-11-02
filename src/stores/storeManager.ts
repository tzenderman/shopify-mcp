import { GraphQLClient } from "graphql-request";
import type { StoreConfig, StoreInfo } from "./types.js";

export class StoreManager {
  private stores: Map<string, GraphQLClient>;
  private storeConfigs: Map<string, StoreConfig>;

  constructor(configs: StoreConfig[]) {
    this.stores = new Map();
    this.storeConfigs = new Map();

    if (configs.length === 0) {
      throw new Error("At least one store configuration is required");
    }

    for (const config of configs) {
      this.addStore(config);
    }
  }

  private addStore(config: StoreConfig): void {
    // Validate config
    if (!config.id || config.id.trim() === "") {
      throw new Error("Store ID is required");
    }
    if (!config.domain || config.domain.trim() === "") {
      throw new Error(`Store domain is required for store "${config.id}"`);
    }
    if (!config.accessToken || config.accessToken.trim() === "") {
      throw new Error(`Access token is required for store "${config.id}"`);
    }

    // Check for duplicate IDs
    if (this.stores.has(config.id)) {
      throw new Error(`Duplicate store ID: "${config.id}"`);
    }

    const apiVersion = config.apiVersion || "2023-07";

    // Create GraphQL client for this store
    const client = new GraphQLClient(
      `https://${config.domain}/admin/api/${apiVersion}/graphql.json`,
      {
        headers: {
          "X-Shopify-Access-Token": config.accessToken,
          "Content-Type": "application/json"
        }
      }
    );

    this.stores.set(config.id, client);
    this.storeConfigs.set(config.id, { ...config, apiVersion });
  }

  getClient(storeId: string): GraphQLClient {
    const client = this.stores.get(storeId);
    if (!client) {
      const availableStores = Array.from(this.stores.keys()).join(", ");
      throw new Error(
        `Store "${storeId}" not found. Available stores: ${availableStores}`
      );
    }
    return client;
  }

  hasStore(storeId: string): boolean {
    return this.stores.has(storeId);
  }

  listStores(): StoreInfo[] {
    const storeList: StoreInfo[] = [];
    for (const [id, config] of this.storeConfigs.entries()) {
      storeList.push({
        id: config.id,
        domain: config.domain,
        apiVersion: config.apiVersion || "2023-07"
      });
    }
    return storeList;
  }

  getStoreCount(): number {
    return this.stores.size;
  }
}
