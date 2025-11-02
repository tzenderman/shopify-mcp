import type { GraphQLClient } from "graphql-request";
import { gql } from "graphql-request";
import { z } from "zod";
import type { StoreManager } from "../stores/storeManager.js";

// Input schema for getting job status
const GetJobStatusInputSchema = z.object({
  storeId: z.string().min(1).describe("The store ID to query job status in"),
  jobId: z.string().min(1).describe("Job ID (GID format: gid://shopify/Job/...)"),
});

type GetJobStatusInput = z.infer<typeof GetJobStatusInputSchema>;

// Will be initialized in index.ts
let storeManager: StoreManager;

const getJobStatus = {
  name: "get-job-status",
  description: "Get the status of an asynchronous job (e.g., from collection product operations) in a specific store",
  schema: GetJobStatusInputSchema,

  // Add initialize method to set up the store manager
  initialize(manager: StoreManager) {
    storeManager = manager;
  },

  execute: async (input: GetJobStatusInput) => {
    try {
      const { storeId, jobId } = input;

      // Get the appropriate client for this store
      const shopifyClient = storeManager.getClient(storeId);

      const query = gql`
        query getJob($id: ID!) {
          job(id: $id) {
            id
            done
          }
        }
      `;

      const variables = {
        id: jobId,
      };

      const data = (await shopifyClient.request(query, variables)) as {
        job: {
          id: string;
          done: boolean;
        } | null;
      };

      if (!data.job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      return {
        job: data.job,
        message: data.job.done
          ? "Job completed successfully"
          : "Job is still in progress",
      };
    } catch (error) {
      console.error("Error getting job status:", error);
      throw new Error(
        `Failed to get job status: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  },
};

export { getJobStatus };
