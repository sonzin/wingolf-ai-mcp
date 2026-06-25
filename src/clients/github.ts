import { Octokit } from "@octokit/rest";
import { env } from "../config/env.js";

let client: Octokit | null = null;

export function getGithubClient(): Octokit {
  if (client) return client;

  if (!env.GITHUB_TOKEN) {
    throw new Error("GITHUB_TOKEN is missing. Set it in .env");
  }

  client = new Octokit({
    auth: env.GITHUB_TOKEN,
    userAgent: "wingolf-ai-mcp/1.0.0",
  });

  return client;
}

export async function searchCode(params: {
  query: string;
  owner: string;
  repo: string;
  limit?: number;
}) {
  const octokit = getGithubClient();

  let q = params.query;
  if (!q.includes("repo:")) {
    q = `${q} repo:${params.owner}/${params.repo}`;
  }

  const response = await octokit.rest.search.code({
    q,
    per_page: Math.min(params.limit || 10, 30),
    order: "desc",
  });

  return (response.data.items || []).map((item) => ({
    path: item.path,
    repository: item.repository?.full_name || `${params.owner}/${params.repo}`,
    html_url: item.html_url,
    score: item.score,
    text_matches: item.text_matches || undefined,
    sha: item.sha,
  }));
}

export async function getFileContents(params: {
  path: string;
  owner: string;
  repo: string;
  ref?: string;
}) {
  const octokit = getGithubClient();

  const response = await octokit.rest.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path: params.path,
    ref: params.ref || "main",
  });

  if (Array.isArray(response.data)) {
    throw new Error(`"${params.path}" is a directory, not a file.`);
  }

  const data = response.data as { content?: string; sha: string; html_url: string; size: number; encoding?: string };

  if (data.size > 500_000) {
    return {
      path: params.path,
      sha: data.sha,
      html_url: data.html_url,
      content: null,
      warning: `File is too large (${(data.size / 1024).toFixed(0)} KB). Use the html_url to view it in browser.`,
    };
  }

  let content = "";
  if (data.content && data.encoding === "base64") {
    content = Buffer.from(data.content, "base64").toString("utf-8");
  }

  return {
    path: params.path,
    sha: data.sha,
    content,
    html_url: data.html_url,
  };
}

export async function listRecentCommits(params: {
  owner: string;
  repo: string;
  branch?: string;
  limit?: number;
}) {
  const octokit = getGithubClient();

  const args: { owner: string; repo: string; sha?: string; per_page: number } = {
    owner: params.owner,
    repo: params.repo,
    per_page: Math.min(params.limit || 10, 30),
  };
  if (params.branch) {
    args.sha = params.branch;
  }

  const response = await octokit.rest.repos.listCommits(args);

  return (response.data || []).map((c) => ({
    sha: c.sha,
    message: c.commit?.message || "",
    author: c.commit?.author?.name || c.author?.login || "unknown",
    date: c.commit?.author?.date || "",
    html_url: c.html_url,
  }));
}

export async function listPullRequests(params: {
  owner: string;
  repo: string;
  state?: "open" | "closed" | "all";
  limit?: number;
}) {
  const octokit = getGithubClient();

  const response = await octokit.rest.pulls.list({
    owner: params.owner,
    repo: params.repo,
    state: params.state || "open",
    per_page: Math.min(params.limit || 10, 30),
    sort: "updated",
    direction: "desc",
  });

  return (response.data || []).map((pr) => ({
    number: pr.number,
    title: pr.title,
    state: pr.state,
    user: pr.user?.login || "unknown",
    created_at: pr.created_at,
    updated_at: pr.updated_at,
    html_url: pr.html_url,
  }));
}
