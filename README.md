# wingolf-ai-mcp

MCP server for **wingolf.vn** — integrates Google Search Console, Google Analytics 4, and GitHub into a single MCP endpoint for AI clients (Claude, ChatGPT, Cursor, Codex).

## Features

- **Google Search Console** — search analytics, top queries, top pages
- **Google Analytics 4** — flexible reports, traffic summary, top pages
- **GitHub** — code search, file contents, recent commits, pull requests
- Dual transport: **stdio** (local) and **Streamable HTTP** (deploy)
- Bearer token auth on HTTP transport
- Read-only by design — no data deletion or modification

## Quick Start (local)

### 1. Prerequisites

- Node.js 20+
- A Google Cloud project with Search Console API and Analytics Data API enabled
- A GitHub fine-grained personal access token

### 2. Clone and install

```bash
cd wingolf-ai-mcp
cp .env.example .env
npm install
```

### 3. Configure environment

Edit `.env` and fill in your credentials (see sections below).

### 4. Run

```bash
# stdio mode (for Claude Desktop / Cursor / Codex)
npm run start:stdio

# HTTP mode (for remote clients or testing)
npm run start:http

# Dev with auto-reload
npm run dev
```

---

## Google Setup

### Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Note the **Project ID**

### Enable APIs

1. Go to **APIs & Services → Library**
2. Search for and enable:
   - **Google Search Console API**
   - **Google Analytics Data API**

### Create a Service Account

1. Go to **IAM & Admin → Service Accounts**
2. Click **Create Service Account**
3. Give it a name (e.g., `mcp-server`)
4. Assign role: **Viewer** (or create a custom role with minimal permissions)
5. Click **Done**
6. Click the service account → **Keys** → **Add Key** → **Create New Key** → **JSON**
7. Save the downloaded JSON file to `secrets/google-service-account.json`

> **Never commit this file!** The `.env.example` path is `/app/secrets/google-service-account.json` which is mounted read-only via Docker.

### Add Service Account to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select your property (e.g., `https://wingolf.vn/`)
3. Go to **Settings → Users and permissions**
4. Click **Add user**
5. Enter the service account email (found in the JSON key file, looks like `name@project.iam.gserviceaccount.com`)
6. Set permission to **Restricted** (or **Full** — Restricted is enough for read-only)
7. Click **Add**

### Add Service Account to GA4

1. Go to [Google Analytics](https://analytics.google.com/)
2. Select your GA4 property
3. Go to **Admin → Property Access Management**
4. Click **+** → **Add users**
5. Enter the service account email
6. Select role: **Viewer** (or Analyst)
7. Click **Add**

### Find your GA4 Property ID

1. In GA4 Admin, under **Property Settings → Property Details**
2. Copy the numeric **Property ID** (e.g., `123456789`)
3. Set `GA4_PROPERTY_ID=123456789` in your `.env`

---

## GitHub Setup

### Create Fine-Grained PAT

1. Go to [GitHub Settings → Developer settings → Personal access tokens → Fine-grained tokens](https://github.com/settings/tokens?type=beta)
2. Click **Generate new token**
3. Set:
   - **Token name**: `wingolf-ai-mcp`
   - **Expiration**: as needed
   - **Resource owner**: your org or user
   - **Repository access**: Only select repositories → choose your repo
4. Under **Permissions → Repository permissions**, set:
   - **Contents**: Read-only
   - **Metadata**: Read-only (auto-selected)
   - **Pull requests**: Read-only
5. Click **Generate token** and copy it

Set in `.env`:
```
GITHUB_TOKEN=github_pat_xxx
GITHUB_OWNER=your-org-or-user
GITHUB_REPO=your-repo
```

---

## Docker Deployment

### Build and run

```bash
# Build
docker compose build

# Run
docker compose up -d

# View logs
docker compose logs -f
```

### Directory structure on VPS

```
~/wingolf-ai-mcp/
├── docker-compose.yml
├── .env
└── secrets/
    └── google-service-account.json   # ro-mounted
```

### Behind Nginx / Cloudflare

For production, put the container behind Nginx or Cloudflare Tunnel with HTTPS:

```nginx
location /mcp {
    proxy_pass http://127.0.0.1:8787;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

## Connecting AI Clients

### Claude Desktop

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "wingolf-ai-mcp": {
      "command": "node",
      "args": ["path/to/wingolf-ai-mcp/dist/index.js"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/secrets/google-service-account.json",
        "GSC_SITE_URL": "https://wingolf.vn/",
        "GA4_PROPERTY_ID": "123456789",
        "GITHUB_TOKEN": "github_pat_xxx",
        "GITHUB_OWNER": "your-org",
        "GITHUB_REPO": "your-repo"
      }
    }
  }
}
```

### Cursor / Codex / Other AI Clients

If deployed via HTTP:

```
URL: https://mcp.example.com/mcp
Authorization: Bearer your-token-here
```

### ChatGPT (via Custom GPT / Plugin)

Use the Streamable HTTP endpoint with Bearer token in headers.

---

## Testing with curl

```bash
# Health (no auth needed)
curl https://mcp.example.com/health

# Ready (needs auth)
curl -H "Authorization: Bearer your-token" https://mcp.example.com/ready

# MCP endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your-token" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' \
  https://mcp.example.com/mcp
```

---

## Available Tools

| Tool | Description |
|------|-------------|
| `gsc_search_analytics` | Full GSC search analytics query with dimensions, filters, pagination |
| `gsc_top_queries` | Top search queries by clicks/impressions |
| `gsc_top_pages` | Top landing pages by clicks/impressions |
| `ga4_run_report` | Flexible GA4 report with custom dimensions and metrics |
| `ga4_traffic_summary` | Traffic summary by channel group |
| `ga4_top_pages` | Top pages by page views |
| `github_search_code` | Search code in repository |
| `github_get_file` | Fetch file contents with decoded text |
| `github_list_recent_commits` | List recent commits |
| `github_list_pull_requests` | List pull requests by state |
| `health_check` | Server health and configuration status |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `8787` | HTTP server port |
| `MCP_BEARER_TOKEN` | Yes | — | Bearer token for HTTP transport auth |
| `GOOGLE_APPLICATION_CREDENTIALS` | For GSC/GA4 | — | Path to service account JSON key file |
| `GSC_SITE_URL` | For GSC | — | Search Console property URL |
| `GA4_PROPERTY_ID` | For GA4 | — | GA4 property numeric ID |
| `GITHUB_TOKEN` | For GitHub | — | GitHub fine-grained PAT |
| `GITHUB_OWNER` | For GitHub | — | GitHub org or username |
| `GITHUB_REPO` | For GitHub | — | GitHub repository name |
| `ENABLE_GITHUB_WRITE_TOOLS` | No | `false` | Enable GitHub write tools (future) |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode (`stdio` or `http`) |

---

## Security Notes

- **Rotate tokens regularly** — use unique bearer tokens per environment
- **Never commit secrets** — `.env` and `secrets/` are excluded from git
- **Read-only by design** — all tools are annotated `readOnlyHint: true`
- **Use HTTPS** — put behind Cloudflare, Nginx, or Caddy in production
- **IP allowlist** — restrict access to known IPs if possible
- **GitHub write tools** are disabled by default (`ENABLE_GITHUB_WRITE_TOOLS=false`)
- **No shell commands** are executed by any tool
- **No arbitrary file reading** — only the configured service account JSON is read

---

## Project Structure

```
wingolf-ai-mcp/
├── package.json
├── tsconfig.json
├── Dockerfile
├── docker-compose.yml
├── .env.example
├── README.md
└── src/
    ├── index.ts              # Entry point
    ├── server.ts             # McpServer factory
    ├── transports/
    │   ├── stdio.ts          # Stdio transport
    │   └── http.ts           # HTTP transport with Bearer auth
    ├── config/
    │   └── env.ts            # Environment config & validation
    ├── auth/
    │   └── bearer.ts         # Bearer token extraction & validation
    ├── clients/
    │   ├── gsc.ts            # Google Search Console API client
    │   ├── ga4.ts            # Google Analytics 4 API client
    │   └── github.ts         # GitHub API client (Octokit)
    ├── tools/
    │   ├── gsc.tools.ts      # GSC tool registrations
    │   ├── ga4.tools.ts      # GA4 tool registrations
    │   ├── github.tools.ts   # GitHub tool registrations
    │   └── index.ts          # Tool registration aggregator + health_check
    └── utils/
        ├── dates.ts          # Date parsing & validation
        └── errors.ts         # Error normalization
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Watch mode with tsx |
| `npm run build` | Compile TypeScript to dist/ |
| `npm run start` | Run compiled server (default: stdio) |
| `npm run start:stdio` | Force stdio transport |
| `npm run start:http` | Force HTTP transport |

## License

MIT
