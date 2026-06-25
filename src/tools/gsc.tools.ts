import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../config/env.js";
import { getSitemap, inspectUrl, listSites, listSitemaps, querySearchAnalytics } from "../clients/gsc.js";
import { parseDateRange } from "../utils/dates.js";
import { normalizeError } from "../utils/errors.js";

const DimensionEnum = z.enum([
  "query",
  "page",
  "country",
  "device",
  "date",
  "searchAppearance",
]);

function asTextResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function gscNotConfigured() {
  return {
    content: [{ type: "text" as const, text: "GSC is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and GSC_SITE_URL in .env" }],
  };
}

function parseJson(value: string | undefined, fallback: unknown): unknown {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function parseDimensionFilterGroups(value: string | undefined) {
  const parsed = parseJson(value, undefined);
  return Array.isArray(parsed) ? (parsed as any) : undefined;
}

export function registerGscTools(server: McpServer) {
  server.registerTool(
    "gsc_search_analytics",
    {
      title: "GSC Search Analytics",
      description: `Fetch Google Search Console search analytics data for a date range.

Returns clicks, impressions, CTR, and average position grouped by the requested dimensions.
Use this to analyze search performance, track keyword rankings, and identify top-performing queries/pages.

Args:
  - siteUrl (string, optional): The GSC property URL. Defaults to GSC_SITE_URL from env.
  - startDate (string): Start date in YYYY-MM-DD format.
  - endDate (string): End date in YYYY-MM-DD format.
  - dimensions (string[]): Dimensions to group by — query, page, country, device, date, searchAppearance.
  - rowLimit (number, optional): Max rows to return (1-250, default 25).
  - startRow (number, optional): Pagination offset (default 0).

Returns:
  JSON with rows array (each containing keys, clicks, impressions, ctr, position) and summary totals.`,
      inputSchema: z.object({
        siteUrl: z.string().optional().describe("GSC property URL. Defaults to GSC_SITE_URL from env."),
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        dimensions: z.array(DimensionEnum).optional().describe("Dimensions to group results by."),
        rowLimit: z.number().int().min(1).max(250).default(25).describe("Max rows to return."),
        startRow: z.number().int().min(0).default(0).describe("Pagination offset."),
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
        if (!env.isGscConfigured) {
          return gscNotConfigured();
        }

        const siteUrl = params.siteUrl || env.GSC_SITE_URL;
        if (!siteUrl) {
          return {
            content: [{ type: "text", text: "GSC_SITE_URL is missing. Set it in .env or pass siteUrl parameter." }],
          };
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await querySearchAnalytics({
          siteUrl,
          startDate: start,
          endDate: end,
          dimensions: params.dimensions || ["query"],
          rowLimit: params.rowLimit,
          startRow: params.startRow,
        });

        const rows = (data.rows || []).map((r) => ({
          keys: r.keys || [],
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          ctr: r.ctr || 0,
          position: r.position || 0,
        }));

        let summary: string | null = null;
        if (rows.length > 0) {
          const totalClicks = rows.reduce((s, r) => s + r.clicks, 0);
          const totalImpressions = rows.reduce((s, r) => s + r.impressions, 0);
          const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions * 100) : 0;
          const avgPos = rows.reduce((s, r) => s + r.position, 0) / rows.length;

          summary = `Total clicks: ${totalClicks}, impressions: ${totalImpressions}, avg CTR: ${avgCtr.toFixed(2)}%, avg position: ${avgPos.toFixed(1)}`;
        }

        const result: Record<string, unknown> = {
          siteUrl,
          dateRange: { start, end },
          dimensions: params.dimensions || ["query"],
          rowCount: rows.length,
          totalRowsAvailable: data.responseAggregationType ? "auto" : "unknown",
          rows,
        };
        if (summary) {
          result.summary = summary;
        }

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "gsc_top_queries",
    {
      title: "GSC Top Queries",
      description: `Get the top search queries from Google Search Console for a date range, ranked by clicks.

Returns the most clicked and most impressed queries driving traffic to the site.`,
      inputSchema: z.object({
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        limit: z.number().int().min(1).max(100).default(20).describe("Number of top queries to return."),
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
        if (!env.isGscConfigured) {
          return gscNotConfigured();
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await querySearchAnalytics({
          siteUrl: env.GSC_SITE_URL,
          startDate: start,
          endDate: end,
          dimensions: ["query"],
          rowLimit: params.limit,
        });

        const queries = (data.rows || []).map((r) => ({
          query: r.keys?.[0] || "",
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          ctr: r.ctr || 0,
          position: r.position || 0,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ topQueries: queries, total: queries.length }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "gsc_top_pages",
    {
      title: "GSC Top Pages",
      description: `Get the top landing pages from Google Search Console for a date range, ranked by clicks.

Returns the best-performing pages in organic search.`,
      inputSchema: z.object({
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        limit: z.number().int().min(1).max(100).default(20).describe("Number of top pages to return."),
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
        if (!env.isGscConfigured) {
          return gscNotConfigured();
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await querySearchAnalytics({
          siteUrl: env.GSC_SITE_URL,
          startDate: start,
          endDate: end,
          dimensions: ["page"],
          rowLimit: params.limit,
        });

        const pages = (data.rows || []).map((r) => ({
          page: r.keys?.[0] || "",
          clicks: r.clicks || 0,
          impressions: r.impressions || 0,
          ctr: r.ctr || 0,
          position: r.position || 0,
        }));

        return {
          content: [{ type: "text", text: JSON.stringify({ topPages: pages, total: pages.length }, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "gsc_list_sites",
    {
      title: "GSC List Sites",
      description: "List all Search Console properties accessible to the configured Google credentials.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        if (!env.GOOGLE_APPLICATION_CREDENTIALS) return gscNotConfigured();
        return asTextResult(await listSites());
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "gsc_query_search_analytics",
    {
      title: "GSC Query Search Analytics",
      description: "Query Search Console search analytics with optional dimension filters and up to 25,000 rows.",
      inputSchema: z.object({
        siteUrl: z.string().optional().describe("GSC property URL. Defaults to GSC_SITE_URL from env."),
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        dimensions: z.array(DimensionEnum).optional(),
        rowLimit: z.number().int().min(1).max(25000).default(1000),
        startRow: z.number().int().min(0).default(0),
        dimensionFilterGroupsJson: z.string().optional().describe("Optional JSON array of GSC dimensionFilterGroups."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ siteUrl, startDate, endDate, dimensions, rowLimit, startRow, dimensionFilterGroupsJson }) => {
      try {
        if (!env.isGscConfigured) return gscNotConfigured();
        const resolvedSiteUrl = siteUrl || env.GSC_SITE_URL;
        const { start, end } = parseDateRange(startDate, endDate);
        return asTextResult(await querySearchAnalytics({
          siteUrl: resolvedSiteUrl,
          startDate: start,
          endDate: end,
          dimensions: dimensions || ["query"],
          rowLimit,
          startRow,
          dimensionFilterGroups: parseDimensionFilterGroups(dimensionFilterGroupsJson),
        }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "gsc_list_sitemaps",
    {
      title: "GSC List Sitemaps",
      description: "List sitemaps submitted to Search Console for a given property.",
      inputSchema: z.object({
        siteUrl: z.string().optional().describe("GSC property URL. Defaults to GSC_SITE_URL from env."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ siteUrl }) => {
      try {
        if (!env.isGscConfigured) return gscNotConfigured();
        return asTextResult(await listSitemaps(siteUrl || env.GSC_SITE_URL));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "gsc_get_sitemap",
    {
      title: "GSC Get Sitemap",
      description: "Get details for a specific sitemap submitted to Search Console.",
      inputSchema: z.object({
        siteUrl: z.string().optional().describe("GSC property URL. Defaults to GSC_SITE_URL from env."),
        feedpath: z.string().describe("Full sitemap URL, e.g. https://example.com/sitemap.xml"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ siteUrl, feedpath }) => {
      try {
        if (!env.isGscConfigured) return gscNotConfigured();
        return asTextResult(await getSitemap(siteUrl || env.GSC_SITE_URL, feedpath));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "gsc_inspect_url",
    {
      title: "GSC Inspect URL",
      description: "Inspect a URL in Search Console: indexation status, last crawl, robots status, and mobile usability where available.",
      inputSchema: z.object({
        siteUrl: z.string().optional().describe("GSC property URL. Defaults to GSC_SITE_URL from env."),
        inspectionUrl: z.string().describe("Full URL to inspect."),
        languageCode: z.string().default("en-US"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ siteUrl, inspectionUrl, languageCode }) => {
      try {
        if (!env.isGscConfigured) return gscNotConfigured();
        return asTextResult(await inspectUrl({
          siteUrl: siteUrl || env.GSC_SITE_URL,
          inspectionUrl,
          languageCode,
        }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GSC Error: ${normalizeError(error)}` }] };
      }
    }
  );
}
