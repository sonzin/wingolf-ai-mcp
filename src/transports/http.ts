import express, { Request, Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer, VERSION } from "../server.js";
import { env, validateEnv } from "../config/env.js";
import { getEnabledIntegrations } from "../tools/index.js";

export async function startHttpTransport() {
  const warnings = validateEnv();
  for (const w of warnings) {
    console.error(`[WARNING] ${w}`);
  }

  const app = express();

  app.use(
    express.json({
      type: ["application/json", "application/*+json"],
    })
  );

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS,DELETE");
    res.setHeader(
      "Access-Control-Allow-Headers",
      "Content-Type, Authorization, MCP-Protocol-Version, Mcp-Session-Id, Last-Event-ID"
    );
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version");

    next();
  });

  app.options("*", (_req: Request, res: Response) => {
    res.status(204).end();
  });

  app.post("/mcp", async (req: Request, res: Response) => {
    const server = createMcpServer();

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("MCP request error:", error instanceof Error ? error.message : String(error));
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    } finally {
      res.on("close", () => {
        transport.close().catch(() => {});
        server.close().catch(() => {});
      });
    }
  });

  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed. Use POST for MCP requests." },
      id: null,
    });
  });

  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  });

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      server: "wingolf-ai-mcp",
      version: VERSION,
    });
  });

  app.get("/ready", (_req: Request, res: Response) => {
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
