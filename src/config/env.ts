import { config } from "dotenv";
import { resolve } from "path";

config();

function requireEnv(key: string, defaultValue?: string): string {
  const value = process.env[key] || defaultValue;
  if (value === undefined) {
    return "";
  }
  return value;
}

function requireEnvStrict(key: string): string {
  const value = process.env[key];
  if (!value) {
    return "";
  }
  return value;
}

function toBool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  const lowered = value.toLowerCase();
  return lowered === "true" || lowered === "1" || lowered === "yes";
}

export const env = {
  PORT: parseInt(requireEnv("PORT", "8787"), 10),
  MCP_BEARER_TOKEN: requireEnv("MCP_BEARER_TOKEN", "change-me"),

  GOOGLE_APPLICATION_CREDENTIALS: requireEnv("GOOGLE_APPLICATION_CREDENTIALS", ""),
  GSC_SITE_URL: requireEnv("GSC_SITE_URL", ""),
  GA4_PROPERTY_ID: requireEnv("GA4_PROPERTY_ID", ""),

  GITHUB_TOKEN: requireEnv("GITHUB_TOKEN", ""),
  GITHUB_OWNER: requireEnv("GITHUB_OWNER", ""),
  GITHUB_REPO: requireEnv("GITHUB_REPO", ""),

  ENABLE_GITHUB_WRITE_TOOLS: toBool(process.env.ENABLE_GITHUB_WRITE_TOOLS, false),

  get isGscConfigured(): boolean {
    return !!this.GOOGLE_APPLICATION_CREDENTIALS && !!this.GSC_SITE_URL;
  },

  get isGa4Configured(): boolean {
    return !!this.GOOGLE_APPLICATION_CREDENTIALS && !!this.GA4_PROPERTY_ID;
  },

  get isGithubConfigured(): boolean {
    return !!this.GITHUB_TOKEN && !!this.GITHUB_OWNER && !!this.GITHUB_REPO;
  }
};

export function validateEnv(): string[] {
  const warnings: string[] = [];

  if (!env.GOOGLE_APPLICATION_CREDENTIALS) {
    warnings.push("GOOGLE_APPLICATION_CREDENTIALS is missing. GSC and GA4 tools will be unavailable.");
  }
  if (!env.GSC_SITE_URL) {
    warnings.push("GSC_SITE_URL is missing. GSC tools will be unavailable.");
  }
  if (!env.GA4_PROPERTY_ID) {
    warnings.push("GA4_PROPERTY_ID is missing. GA4 tools will be unavailable.");
  }
  if (!env.GITHUB_TOKEN) {
    warnings.push("GITHUB_TOKEN is missing. GitHub tools will be unavailable.");
  }
  if (!env.GITHUB_OWNER) {
    warnings.push("GITHUB_OWNER is missing. GitHub tools will be unavailable.");
  }
  if (!env.GITHUB_REPO) {
    warnings.push("GITHUB_REPO is missing. GitHub tools will be unavailable.");
  }

  return warnings;
}
