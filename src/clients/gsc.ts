import { google, webmasters_v3 } from "googleapis";
import { env } from "../config/env.js";

let client: webmasters_v3.Webmasters | null = null;

export function getGscClient(): webmasters_v3.Webmasters {
  if (client) return client;

  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is missing. Set it in .env");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  client = google.webmasters({ version: "v3", auth });
  return client;
}

export async function querySearchAnalytics(params: {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
  dimensionFilterGroups?: webmasters_v3.Schema$ApiDimensionFilterGroup[];
}) {
  const gsc = getGscClient();

  const response = await gsc.searchanalytics.query({
    siteUrl: params.siteUrl,
    requestBody: {
      startDate: params.startDate,
      endDate: params.endDate,
      dimensions: params.dimensions || ["query"],
      rowLimit: Math.min(params.rowLimit || 25, 250),
      startRow: params.startRow || 0,
      dimensionFilterGroups: params.dimensionFilterGroups,
      aggregationType: "auto",
    },
  });

  return response.data;
}
