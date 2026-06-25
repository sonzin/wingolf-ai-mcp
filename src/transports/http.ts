import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../server.js";
import { env, validateEnv } from "../config/env.js";
import { validateBearer } from "../auth/bearer.js";
import { getEnabledIntegrations } from "../tools/index.js";
import { VERSION } from "../server.js";

export async function startHttpTransport() {
  const server = createMcpServer();

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);

  const warnings = validateEnv();
  for (const w of warnings) {
    console.error(`[WARNING] ${w}`);
  }

  const app = express();
  app.use(express.json());

  app.all("/mcp", async (req: Request, res: Response) => {
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      server: "wingolf-ai-mcp",
      version: VERSION,
    });
  });

  app.get("/ready", (req: Request, res: Response) => {
    if (!validateBearer(req)) {
      res.status(401).json({ error: "Unauthorized. Provide a valid Bearer token." });
      return;
    }
    res.json({
      ok: true,
      server: "wingolf-ai-mcp",
      version: VERSION,
      enabledIntegrations: getEnabledIntegrations(),
    });
  });

  const port = env.PORT;

  return new Promise<void>((resolve) => {
    app.listen(port, () => {
      console.error(`wingolf-ai-mcp HTTP server listening on port ${port}`);
      console.error(`  MCP endpoint: http://localhost:${port}/mcp`);
      console.error(`  Health:       http://localhost:${port}/health`);
      console.error(`  Ready:        http://localhost:${port}/ready`);
      resolve();
    });
  });
}
