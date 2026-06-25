import { google, searchconsole_v1, webmasters_v3 } from "googleapis";
import { env } from "../config/env.js";

let client: webmasters_v3.Webmasters | null = null;
let searchConsoleClient: searchconsole_v1.Searchconsole | null = null;

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

export function getSearchConsoleClient(): searchconsole_v1.Searchconsole {
  if (searchConsoleClient) return searchConsoleClient;

  const keyFile = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!keyFile) {
    throw new Error("GOOGLE_APPLICATION_CREDENTIALS is missing. Set it in .env");
  }

  const auth = new google.auth.GoogleAuth({
    keyFile,
    scopes: ["https://www.googleapis.com/auth/webmasters.readonly"],
  });

  searchConsoleClient = google.searchconsole({ version: "v1", auth });
  return searchConsoleClient;
}

export async function listSites() {
  const gsc = getGscClient();
  const response = await gsc.sites.list();
  return response.data;
}

export async function listSitemaps(siteUrl: string) {
  const gsc = getGscClient();
  const response = await gsc.sitemaps.list({ siteUrl });
  return response.data;
}

export async function getSitemap(siteUrl: string, feedpath: string) {
  const gsc = getGscClient();
  const response = await gsc.sitemaps.get({ siteUrl, feedpath });
  return response.data;
}

export async function inspectUrl(params: {
  siteUrl: string;
  inspectionUrl: string;
  languageCode?: string;
}) {
  const searchConsole = getSearchConsoleClient();
  const response = await searchConsole.urlInspection.index.inspect({
    requestBody: {
      siteUrl: params.siteUrl,
      inspectionUrl: params.inspectionUrl,
      languageCode: params.languageCode || "en-US",
    },
  });
  return response.data;
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
      rowLimit: Math.min(params.rowLimit || 25, 25000),
      startRow: params.startRow || 0,
      dimensionFilterGroups: params.dimensionFilterGroups,
      aggregationType: "auto",
    },
  });

  return response.data;
}
