#!/usr/bin/env node
import { startStdioTransport } from "./transports/stdio.js";
import { startHttpTransport } from "./transports/http.js";
import { validateEnv } from "./config/env.js";

async function main() {
  const args = process.argv.slice(2);
  const mode = args.includes("--http") ? "http" : "stdio";
  const envTransport = process.env.MCP_TRANSPORT;
  const transport = envTransport || mode;

  const warnings = validateEnv();
  for (const w of warnings) {
    console.error(`[WARNING] ${w}`);
  }

  if (transport === "http") {
    await startHttpTransport();
  } else {
    await startStdioTransport();
  }
}

main().catch((error) => {
  console.error("Fatal server error:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
