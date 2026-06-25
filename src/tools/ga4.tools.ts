import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../config/env.js";
import { runReport } from "../clients/ga4.js";
import { parseDateRange } from "../utils/dates.js";
import { normalizeError } from "../utils/errors.js";

const COMMON_METRICS = [
  "sessions",
  "activeUsers",
  "newUsers",
  "screenPageViews",
  "engagementRate",
  "averageSessionDuration",
  "totalUsers",
  "bounceRate",
  "eventCount",
] as const;

export function registerGa4Tools(server: McpServer) {
  server.registerTool(
    "ga4_run_report",
    {
      title: "GA4 Run Report",
      description: `Run a flexible Google Analytics 4 report for a date range.

Specify any combination of dimensions and metrics supported by the GA4 Data API.
Common dimensions: date, sessionDefaultChannelGroup, pagePathPlusQueryString, country, deviceCategory.
Common metrics: sessions, activeUsers, newUsers, screenPageViews, engagementRate, averageSessionDuration.

Args:
  - propertyId (string, optional): GA4 property ID. Defaults to GA4_PROPERTY_ID from env.
  - startDate (string): Start date in YYYY-MM-DD format.
  - endDate (string): End date in YYYY-MM-DD format.
  - dimensions (string[]): Dimension names (default ['date']).
  - metrics (string[]): Metric names (default ['sessions','activeUsers','screenPageViews']).
  - limit (number): Max rows (1-250, default 25).

Returns:
  JSON with dimensionHeaders, metricHeaders, and rows array with parsed dimension/metric values.`,
      inputSchema: z.object({
        propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env."),
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
        dimensions: z.array(z.string()).default(["date"]).describe("Dimension names."),
        metrics: z.array(z.string()).default(["sessions", "activeUsers", "screenPageViews"]).describe("Metric names."),
        limit: z.number().int().min(1).max(250).default(25).describe("Max rows to return."),
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
        if (!env.isGa4Configured) {
          return {
            content: [{ type: "text", text: "GA4 is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and GA4_PROPERTY_ID in .env" }],
          };
        }

        const propertyId = params.propertyId || env.GA4_PROPERTY_ID;
        if (!propertyId) {
          return {
            content: [{ type: "text", text: "GA4_PROPERTY_ID is missing. Set it in .env or pass propertyId parameter." }],
          };
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await runReport({
          propertyId,
          startDate: start,
          endDate: end,
          dimensions: params.dimensions,
          metrics: params.metrics,
          limit: params.limit,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ga4_traffic_summary",
    {
      title: "GA4 Traffic Summary",
      description: `Get a traffic summary from Google Analytics 4 grouped by session default channel group.

Returns sessions, active users, new users, page views, engagement rate, and average session duration per channel.
Use this to understand traffic sources (Organic Search, Direct, Referral, Social, etc.).

Args:
  - startDate (string): Start date in YYYY-MM-DD format.
  - endDate (string): End date in YYYY-MM-DD format.`,
      inputSchema: z.object({
        startDate: z.string().describe("Start date in YYYY-MM-DD format."),
        endDate: z.string().describe("End date in YYYY-MM-DD format."),
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
        if (!env.isGa4Configured) {
          return {
            content: [{ type: "text", text: "GA4 is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and GA4_PROPERTY_ID in .env" }],
          };
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await runReport({
          propertyId: env.GA4_PROPERTY_ID,
          startDate: start,
          endDate: end,
          dimensions: ["sessionDefaultChannelGroup"],
          metrics: [
            "sessions",
            "activeUsers",
            "newUsers",
            "screenPageViews",
            "engagementRate",
            "averageSessionDuration",
          ],
          limit: 50,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }],
        };
      }
    }
  );

  server.registerTool(
    "ga4_top_pages",
    {
      title: "GA4 Top Pages",
      description: `Get the top pages from Google Analytics 4 by page views.

Returns the most-viewed pages with active users and sessions.

Args:
  - startDate (string): Start date in YYYY-MM-DD format.
  - endDate (string): End date in YYYY-MM-DD format.
  - limit (number): Max pages to return (1-100, default 20).`,
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
        if (!env.isGa4Configured) {
          return {
            content: [{ type: "text", text: "GA4 is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and GA4_PROPERTY_ID in .env" }],
          };
        }

        const { start, end } = parseDateRange(params.startDate, params.endDate);

        const data = await runReport({
          propertyId: env.GA4_PROPERTY_ID,
          startDate: start,
          endDate: end,
          dimensions: ["pagePathPlusQueryString"],
          metrics: ["screenPageViews", "activeUsers", "sessions"],
          limit: params.limit,
        });

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (error) {
        return {
          isError: true,
          content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }],
        };
      }
    }
  );
}
