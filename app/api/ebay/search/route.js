import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// -------- eBay endpoints --------
function getEbayUrls() {
  const env = (process.env.EBAY_ENV || "PROD").toUpperCase();
  const isSandbox = env === "SANDBOX";

  return {
    tokenUrl: isSandbox
      ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
      : "https://api.ebay.com/identity/v1/oauth2/token",
    browseSearchUrl: isSandbox
      ? "https://api.sandbox.ebay.com/buy/browse/v1/item_summary/search"
      : "https://api.ebay.com/buy/browse/v1/item_summary/search"
  };
}

function base64(str) {
  return Buffer.from(str, "utf8").toString("base64");
}

// Simple in-memory token cache (helps when the function stays warm)
let cachedToken = null;
let cachedTokenExpiresAtMs = 0;

async function getAppAccessToken() {
  const clientId = process.env.EBAY_CLIENT_ID;
  const clientSecret = process.env.EBAY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing EBAY_CLIENT_ID or EBAY_CLIENT_SECRET");
  }

  const now = Date.now();
  if (cachedToken && now < cachedTokenExpiresAtMs - 60_000) {
    return cachedToken;
  }

  const { tokenUrl } = getEbayUrls();
  const basic = base64(`${clientId}:${clientSecret}`);

  const body = new URLSearchParams();
  body.set("grant_type", "client_credentials");
  body.set("scope", "https://api.ebay.com/oauth/api_scope");

  const resp = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: body.toString(),
    cache: "no-store"
  });

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Token request failed (${resp.status}): ${text}`);
  }

  const data = JSON.parse(text);
  cachedToken = data.access_token;
  cachedTokenExpiresAtMs = Date.now() + Number(data.expires_in || 0) * 1000;

  return cachedToken;
}

function buildSearchUrl(queryParams) {
  const { browseSearchUrl } = getEbayUrls();

  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(queryParams || {})) {
    if (v === undefined || v === null) continue;

    // Allow users to pass arrays (we join with commas, which matches how many eBay params are documented)
    if (Array.isArray(v)) {
      const joined = v.map((x) => String(x).trim()).filter(Boolean).join(",");
      if (joined) qs.set(k, joined);
      continue;
    }

    const s = String(v).trim();
    if (!s) continue;
    qs.set(k, s);
  }

  // Safe defaults
  if (!qs.get("q")) qs.set("q", "NASA Patches");
  if (!qs.get("sort")) qs.set("sort", "newlyListed");

  return `${browseSearchUrl}?${qs.toString()}`;
}

function pickEbayHeaders(clientHeaders) {
  // Allowlist only. Users can set these from the UI.
  const allowed = new Set([
    "x-ebay-c-marketplace-id",
    "x-ebay-c-enduserctx"
  ]);

  const headers = {};
  for (const [k, v] of Object.entries(clientHeaders || {})) {
    const key = String(k).toLowerCase();
    if (!allowed.has(key)) continue;
    const val = String(v).trim();
    if (!val) continue;
    headers[key] = val;
  }

  // Default marketplace if user does not specify
  if (!headers["x-ebay-c-marketplace-id"]) {
    headers["x-ebay-c-marketplace-id"] = "EBAY_US";
  }

  return headers;
}

export async function POST(req) {
  try {
    const payload = await req.json().catch(() => ({}));

    const queryParams = payload?.queryParams || {};
    const clientHeaders = payload?.headers || {};

    const requestUrl = buildSearchUrl(queryParams);
    const token = await getAppAccessToken();

    const ebayHeaders = pickEbayHeaders(clientHeaders);

    const ebayResp = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        ...ebayHeaders
      },
      cache: "no-store"
    });

    const raw = await ebayResp.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { raw };
    }

    return NextResponse.json(
      {
        ebayOk: ebayResp.ok,
        ebayStatus: ebayResp.status,
        requestUrl,
        marketplaceId: ebayHeaders["x-ebay-c-marketplace-id"],
        data
      },
      {
        // Forward eBay status code so the client can react (429, 400, etc.)
        status: ebayResp.status,
        headers: { "Cache-Control": "no-store" }
      }
    );
  } catch (err) {
    return NextResponse.json(
      {
        ebayOk: false,
        error: err?.message || "Unknown error"
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
