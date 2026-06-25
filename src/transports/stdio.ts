import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "../server.js";

export async function startStdioTransport() {
  const server = createMcpServer();

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("wingolf-ai-mcp running via stdio");
}
