import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../config/env.js";
import { registerGscTools } from "./gsc.tools.js";
import { registerGa4Tools } from "./ga4.tools.js";
import { registerGithubTools } from "./github.tools.js";
import { VERSION } from "../server.js";

export function getEnabledIntegrations(): string[] {
  const integrations: string[] = [];
  if (env.isGscConfigured) integrations.push("gsc");
  if (env.isGa4Configured) integrations.push("ga4");
  if (env.isGithubConfigured) integrations.push("github");
  return integrations;
}

export function registerAllTools(server: McpServer) {
  if (env.isGscConfigured) {
    registerGscTools(server);
  }

  if (env.isGa4Configured) {
    registerGa4Tools(server);
  }

  if (env.isGithubConfigured) {
    registerGithubTools(server);
  }

  server.registerTool(
    "health_check",
    {
      title: "Health Check",
      description: "Check the health and configuration status of the MCP server.",
      inputSchema: z.object({}),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const integrations = getEnabledIntegrations();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                server: "wingolf-ai-mcp",
                version: VERSION,
                enabledIntegrations: integrations,
                transport: process.env.MCP_TRANSPORT || "stdio",
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
