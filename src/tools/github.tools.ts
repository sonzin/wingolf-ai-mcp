import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../config/env.js";
import {
  searchCode,
  getFileContents,
  listRecentCommits,
  listPullRequests,
} from "../clients/github.js";
import { normalizeError } from "../utils/errors.js";

export function registerGithubTools(server: McpServer) {
  server.registerTool(
    "github_search_code",
    {
      title: "GitHub Search Code",
      description: `Search for code within the configured GitHub repository using GitHub's code search.

The search query is automatically scoped to the configured repo (owner/repo) if not already included.

Args:
  - query (string): Search query (e.g., "function getAuth" or "import express").
  - owner (string, optional): Repo owner. Defaults to GITHUB_OWNER from env.
  - repo (string, optional): Repo name. Defaults to GITHUB_REPO from env.
  - limit (number): Max results (1-30, default 10).

Returns:
  JSON array of matched files with path, repository, html_url, score, and text_matches.`,
      inputSchema: z.object({
        query: z.string().min(1).describe("Search query for code search."),
        owner: z.string().optional().describe("Repository owner. Defaults to GITHUB_OWNER from env."),
        repo: z.string().optional().describe("Repository name. Defaults to GITHUB_REPO from env."),
        limit: z.number().int().min(1).max(30).default(10).describe("Max results to return."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        if (!env.isGithubConfigured) {
          return {
            content: [{ type: "text", text: "GitHub is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env" }],
          };
        }

        const owner = params.owner || env.GITHUB_OWNER;
        const repo = params.repo || env.GITHUB_REPO;

        const results = await searchCode({
          query: params.query,
          owner,
          repo,
          limit: params.limit,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ results, total: results.length }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GitHub Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "github_get_file",
    {
      title: "GitHub Get File",
      description: `Fetch the contents of a file from the configured GitHub repository.

Returns the decoded UTF-8 text content, SHA, and HTML URL.
Files larger than 500KB will return a warning instead of content.

Args:
  - path (string): File path within the repository (e.g., "src/index.ts").
  - owner (string, optional): Repo owner. Defaults to GITHUB_OWNER from env.
  - repo (string, optional): Repo name. Defaults to GITHUB_REPO from env.
  - ref (string, optional): Branch/tag/commit SHA. Defaults to "main".`,
      inputSchema: z.object({
        path: z.string().min(1).describe("File path within the repository."),
        owner: z.string().optional().describe("Repository owner. Defaults to GITHUB_OWNER from env."),
        repo: z.string().optional().describe("Repository name. Defaults to GITHUB_REPO from env."),
        ref: z.string().optional().default("main").describe("Branch, tag, or commit SHA."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        if (!env.isGithubConfigured) {
          return {
            content: [{ type: "text", text: "GitHub is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env" }],
          };
        }

        const owner = params.owner || env.GITHUB_OWNER;
        const repo = params.repo || env.GITHUB_REPO;

        const result = await getFileContents({
          path: params.path,
          owner,
          repo,
          ref: params.ref,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GitHub Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "github_list_recent_commits",
    {
      title: "GitHub List Recent Commits",
      description: `List recent commits from the configured GitHub repository.

Args:
  - owner (string, optional): Repo owner. Defaults to GITHUB_OWNER from env.
  - repo (string, optional): Repo name. Defaults to GITHUB_REPO from env.
  - branch (string, optional): Filter by branch name.
  - limit (number): Max commits (1-30, default 10).`,
      inputSchema: z.object({
        owner: z.string().optional().describe("Repository owner. Defaults to GITHUB_OWNER from env."),
        repo: z.string().optional().describe("Repository name. Defaults to GITHUB_REPO from env."),
        branch: z.string().optional().describe("Filter by branch name."),
        limit: z.number().int().min(1).max(30).default(10).describe("Max commits to return."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        if (!env.isGithubConfigured) {
          return {
            content: [{ type: "text", text: "GitHub is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env" }],
          };
        }

        const owner = params.owner || env.GITHUB_OWNER;
        const repo = params.repo || env.GITHUB_REPO;

        const commits = await listRecentCommits({
          owner,
          repo,
          branch: params.branch,
          limit: params.limit,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ commits, total: commits.length }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GitHub Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "github_list_pull_requests",
    {
      title: "GitHub List Pull Requests",
      description: `List pull requests from the configured GitHub repository.

Args:
  - owner (string, optional): Repo owner. Defaults to GITHUB_OWNER from env.
  - repo (string, optional): Repo name. Defaults to GITHUB_REPO from env.
  - state (string): open, closed, or all (default "open").
  - limit (number): Max PRs (1-30, default 10).`,
      inputSchema: z.object({
        owner: z.string().optional().describe("Repository owner. Defaults to GITHUB_OWNER from env."),
        repo: z.string().optional().describe("Repository name. Defaults to GITHUB_REPO from env."),
        state: z.enum(["open", "closed", "all"]).default("open").describe("State filter: open, closed, or all."),
        limit: z.number().int().min(1).max(30).default(10).describe("Max PRs to return."),
      }),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (params) => {
      try {
        if (!env.isGithubConfigured) {
          return {
            content: [{ type: "text", text: "GitHub is not configured. Set GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO in .env" }],
          };
        }

        const owner = params.owner || env.GITHUB_OWNER;
        const repo = params.repo || env.GITHUB_REPO;

        const prs = await listPullRequests({
          owner,
          repo,
          state: params.state,
          limit: params.limit,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ pull_requests: prs, total: prs.length }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GitHub Error: ${normalizeError(error)}` }],
        };
      }
    }
  );
}
