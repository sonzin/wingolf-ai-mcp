import { BetaAnalyticsDataClient } from "@google-analytics/data";
import { google } from "googleapis";
import { env } from "../config/env.js";

let client: BetaAnalyticsDataClient | null = null;

function createGa4RestAuth() {
  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is missing. Set it in .env");
  }

  return new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/analytics.readonly"],
  });
}

let restAuth: ReturnType<typeof createGa4RestAuth> | null = null;

export function getGa4Client(): BetaAnalyticsDataClient {
  if (client) return client;

  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is missing. Set it in .env");
  }

  client = new BetaAnalyticsDataClient({
    keyFile,
  });

  return client;
}

export function getGa4RestAuth(): ReturnType<typeof createGa4RestAuth> {
  if (restAuth) return restAuth;
  restAuth = createGa4RestAuth();
  return restAuth;
}

export async function callGa4Api<T = unknown>(
  url: string,
  options: { method?: "GET" | "POST"; body?: unknown } = {}
): Promise<T> {
  const auth = getGa4RestAuth();
  const authClient = await auth.getClient();
  const response = await authClient.request<T>({
    url,
    method: options.method || "GET",
    data: options.body,
  });

  return response.data;
}

export async function runReport(params: {
  propertyId: string;
  startDate: string;
  endDate: string;
  dimensions: string[];
  metrics: string[];
  limit: number;
  offset?: number;
}) {
  const ga4 = getGa4Client();

  const [response] = await ga4.runReport({
    property: `properties/${params.propertyId}`,
    dateRanges: [
      {
        startDate: params.startDate,
        endDate: params.endDate,
      },
    ],
    dimensions: params.dimensions.map((name) => ({ name })),
    metrics: params.metrics.map((name) => ({ name })),
    limit: params.limit,
    offset: params.offset || 0,
    returnPropertyQuota: false,
  });

  const dimensionHeaders = (response.dimensionHeaders || []).map((h) => h.name || "");
  const metricHeaders = (response.metricHeaders || []).map((h) => h.name || "");

  const rows = (response.rows || []).map((row) => {
    const dims: Record<string, string> = {};
    row.dimensionValues?.forEach((dv, i) => {
      dims[dimensionHeaders[i] || `dim${i}`] = dv.value || "";
    });

    const mets: Record<string, string> = {};
    row.metricValues?.forEach((mv, i) => {
      mets[metricHeaders[i] || `met${i}`] = mv.value || "0";
    });

    return { dimensions: dims, metrics: mets, raw: row };
  });

  return {
    dimensionHeaders,
    metricHeaders,
    rows,
    rowCount: response.rowCount || rows.length,
    metadata: response.metadata,
  };
}
