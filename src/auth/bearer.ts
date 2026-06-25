import { IncomingMessage } from "http";
import { env } from "../config/env.js";

export function extractBearerToken(req: IncomingMessage): string | null {
  const header = req.headers.authorization;
  if (!header) return null;

  const parts = header.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    return null;
  }

  return parts[1];
}

export function validateBearer(req: IncomingMessage): boolean {
  if (!env.MCP_BEARER_TOKEN || env.MCP_BEARER_TOKEN === "change-me") {
    return true;
  }
  const token = extractBearerToken(req);
  return token === env.MCP_BEARER_TOKEN;
}
