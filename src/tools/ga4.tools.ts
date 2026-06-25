import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { env } from "../config/env.js";
import { callGa4Api, runReport } from "../clients/ga4.js";
import { parseDateRange } from "../utils/dates.js";
import { normalizeError } from "../utils/errors.js";

function asTextResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }],
  };
}

function normalizePropertyId(propertyId: string): string {
  return propertyId.startsWith("properties/") ? propertyId : `properties/${propertyId}`;
}

function normalizeAccountId(accountId: string): string {
  return accountId.startsWith("accounts/") ? accountId : `accounts/${accountId}`;
}

function parseJson(value: string, fallback: unknown): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function ga4NotConfigured() {
  return {
    content: [{ type: "text" as const, text: "GA4 is not configured. Set GOOGLE_APPLICATION_CREDENTIALS and GA4_PROPERTY_ID in .env" }],
  };
}

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
          return ga4NotConfigured();
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
          return ga4NotConfigured();
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
          return ga4NotConfigured();
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

  server.registerTool(
    "ga4_list_account_summaries",
    {
      title: "GA4 List Account Summaries",
      description: "List all GA4 accounts and properties accessible to the configured Google credentials.",
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async () => {
      try {
        if (!env.GOOGLE_APPLICATION_CREDENTIALS) return ga4NotConfigured();
        return asTextResult(await callGa4Api("https://analyticsadmin.googleapis.com/v1beta/accountSummaries?pageSize=200"));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_list_properties",
    {
      title: "GA4 List Properties",
      description: "List GA4 properties belonging to a Google Analytics account.",
      inputSchema: z.object({
        accountId: z.string().describe("GA4 account ID, with or without accounts/ prefix."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ accountId }) => {
      try {
        if (!env.GOOGLE_APPLICATION_CREDENTIALS) return ga4NotConfigured();
        const account = normalizeAccountId(accountId);
        return asTextResult(await callGa4Api(`https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:${account}&pageSize=200`));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_get_property_details",
    {
      title: "GA4 Get Property Details",
      description: "Get details about a GA4 property such as timezone, currency, industry, and service level.",
      inputSchema: z.object({
        propertyId: z.string().describe("GA4 property ID, with or without properties/ prefix."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId }) => {
      try {
        if (!env.GOOGLE_APPLICATION_CREDENTIALS) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId);
        return asTextResult(await callGa4Api(`https://analyticsadmin.googleapis.com/v1beta/${property}`));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_list_data_streams",
    {
      title: "GA4 List Data Streams",
      description: "List web, iOS, and Android data streams configured on a GA4 property.",
      inputSchema: z.object({ propertyId: z.string().describe("GA4 property ID, with or without properties/ prefix.") }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId }) => {
      try {
        if (!env.GOOGLE_APPLICATION_CREDENTIALS) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId);
        return asTextResult(await callGa4Api(`https://analyticsadmin.googleapis.com/v1beta/${property}/dataStreams?pageSize=200`));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_get_metadata",
    {
      title: "GA4 Get Metadata",
      description: "List all GA4 dimensions and metrics available for a property, including custom dimensions and metrics.",
      inputSchema: z.object({ propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env.") }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId }) => {
      try {
        if (!env.isGa4Configured) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
        return asTextResult(await callGa4Api(`https://analyticsdata.googleapis.com/v1beta/${property}/metadata`));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_check_compatibility",
    {
      title: "GA4 Check Compatibility",
      description: "Check which GA4 dimensions and metrics are compatible before running a report.",
      inputSchema: z.object({
        propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env."),
        dimensions: z.array(z.string()).optional(),
        metrics: z.array(z.string()).optional(),
        compatibilityFilter: z.enum(["COMPATIBLE", "INCOMPATIBLE", "UNSPECIFIED"]).default("COMPATIBLE"),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId, dimensions, metrics, compatibilityFilter }) => {
      try {
        if (!env.isGa4Configured) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
        const body: Record<string, unknown> = { compatibilityFilter };
        if (dimensions?.length) body.dimensions = dimensions.map((name) => ({ name }));
        if (metrics?.length) body.metrics = metrics.map((name) => ({ name }));
        return asTextResult(await callGa4Api(`https://analyticsdata.googleapis.com/v1beta/${property}:checkCompatibility`, { method: "POST", body }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_run_realtime_report",
    {
      title: "GA4 Run Realtime Report",
      description: "Run a GA4 realtime report for active user data from the last 30 minutes.",
      inputSchema: z.object({
        propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env."),
        dimensions: z.array(z.string()).optional(),
        metrics: z.array(z.string()).default(["activeUsers"]).describe("Realtime metrics, e.g. activeUsers."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId, dimensions, metrics }) => {
      try {
        if (!env.isGa4Configured) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
        const body: Record<string, unknown> = { metrics: metrics.map((name) => ({ name })) };
        if (dimensions?.length) body.dimensions = dimensions.map((name) => ({ name }));
        return asTextResult(await callGa4Api(`https://analyticsdata.googleapis.com/v1beta/${property}:runRealtimeReport`, { method: "POST", body }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_run_pivot_report",
    {
      title: "GA4 Run Pivot Report",
      description: "Run a GA4 pivot report using a JSON pivots array.",
      inputSchema: z.object({
        propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env."),
        startDate: z.string().describe("Start date in YYYY-MM-DD format or GA4 relative date."),
        endDate: z.string().describe("End date in YYYY-MM-DD format or GA4 relative date."),
        dimensions: z.array(z.string()),
        metrics: z.array(z.string()),
        pivotsJson: z.string().describe("JSON array of GA4 pivot objects."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId, startDate, endDate, dimensions, metrics, pivotsJson }) => {
      try {
        if (!env.isGa4Configured) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
        const body = {
          dateRanges: [{ startDate, endDate }],
          dimensions: dimensions.map((name) => ({ name })),
          metrics: metrics.map((name) => ({ name })),
          pivots: parseJson(pivotsJson, []),
        };
        return asTextResult(await callGa4Api(`https://analyticsdata.googleapis.com/v1beta/${property}:runPivotReport`, { method: "POST", body }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  server.registerTool(
    "ga4_batch_run_reports",
    {
      title: "GA4 Batch Run Reports",
      description: "Run up to 5 GA4 report requests in a single batchRunReports API call.",
      inputSchema: z.object({
        propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env."),
        requestsJson: z.string().describe("JSON array of up to 5 GA4 RunReportRequest objects."),
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    },
    async ({ propertyId, requestsJson }) => {
      try {
        if (!env.isGa4Configured) return ga4NotConfigured();
        const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
        const requests = parseJson(requestsJson, []);
        if (!Array.isArray(requests) || requests.length === 0 || requests.length > 5) {
          return { isError: true, content: [{ type: "text", text: "requestsJson must be a JSON array with 1 to 5 report requests." }] };
        }
        return asTextResult(await callGa4Api(`https://analyticsdata.googleapis.com/v1beta/${property}:batchRunReports`, { method: "POST", body: { requests } }));
      } catch (error) {
        return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
      }
    }
  );

  const ga4AdminListTools = [
    ["ga4_list_key_events", "GA4 List Key Events", "List key events/conversions configured on a GA4 property.", "keyEvents", "v1beta"],
    ["ga4_list_conversion_events", "GA4 List Conversion Events", "List legacy conversion events configured on a GA4 property.", "conversionEvents", "v1beta"],
    ["ga4_list_custom_dimensions", "GA4 List Custom Dimensions", "List custom dimensions configured on a GA4 property.", "customDimensions", "v1beta"],
    ["ga4_list_custom_metrics", "GA4 List Custom Metrics", "List custom metrics configured on a GA4 property.", "customMetrics", "v1beta"],
    ["ga4_list_audiences", "GA4 List Audiences", "List audiences configured on a GA4 property.", "audiences", "v1alpha"],
    ["ga4_list_google_ads_links", "GA4 List Google Ads Links", "List Google Ads accounts linked to a GA4 property.", "googleAdsLinks", "v1beta"],
    ["ga4_list_firebase_links", "GA4 List Firebase Links", "List Firebase projects linked to a GA4 property.", "firebaseLinks", "v1beta"],
  ] as const;

  for (const [toolName, title, description, collection, apiVersion] of ga4AdminListTools) {
    server.registerTool(
      toolName,
      {
        title,
        description,
        inputSchema: z.object({ propertyId: z.string().optional().describe("GA4 property ID. Defaults to GA4_PROPERTY_ID from env.") }),
        annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true },
      },
      async ({ propertyId }) => {
        try {
          if (!env.isGa4Configured) return ga4NotConfigured();
          const property = normalizePropertyId(propertyId || env.GA4_PROPERTY_ID);
          return asTextResult(await callGa4Api(`https://analyticsadmin.googleapis.com/${apiVersion}/${property}/${collection}?pageSize=200`));
        } catch (error) {
          return { isError: true, content: [{ type: "text", text: `GA4 Error: ${normalizeError(error)}` }] };
        }
      }
    );
  }
}
