import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";

export const VERSION = "1.0.0";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "wingolf-ai-mcp",
    version: VERSION,
  });

  registerAllTools(server);

  return server;
}
