/**
 * Logger utility for debugging MCP server operations
 * Set DEBUG=true environment variable to enable debug logging
 */

const DEBUG = process.env.DEBUG === "true";

export const logger = {
  debug: (...args: any[]) => {
    if (DEBUG) {
      console.error("[DEBUG]", new Date().toISOString(), ...args);
    }
  },

  info: (...args: any[]) => {
    console.error("[INFO]", new Date().toISOString(), ...args);
  },

  error: (...args: any[]) => {
    console.error("[ERROR]", new Date().toISOString(), ...args);
  },

  warn: (...args: any[]) => {
    console.error("[WARN]", new Date().toISOString(), ...args);
  }
};
