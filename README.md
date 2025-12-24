# eBay Browse API search - NASA Patches

Next.js app for Vercel that searches eBay using:
- Buy Browse API: `GET /buy/browse/v1/item_summary/search`

Defaults:
- q: `NASA Patches`
- sort: `newlyListed`

The UI lets users:
- Set common parameters via dropdowns or inputs
- Add any extra query params as free form key/value pairs
- Set key headers like marketplace

All eBay calls happen server side via `/api/ebay/search` so your client secret never reaches the browser.

## Environment variables

Set these in Vercel Project Settings - Environment Variables:

- `EBAY_CLIENT_ID`
- `EBAY_CLIENT_SECRET`
- `EBAY_ENV` (optional) - `PROD` or `SANDBOX` (defaults to PROD)

## Vercel config note

This repo includes a `vercel.json` that is intentionally just `{}`.
Reason:
- Older or incorrect function runtime entries can cause a build error like "Function Runtimes must have a valid version"
- Node is pinned using `package.json` `engines.node` instead

If you ever see that runtime error again, keep `vercel.json` empty and adjust `engines.node`.

## Manual upload workflow (no local git)

Option A - GitHub web upload:
1. Create a new repo on GitHub
2. Upload the project files using the GitHub web UI
3. In Vercel, import the GitHub repo and deploy
4. Add the environment variables in Vercel, then redeploy

Option B - Vercel upload:
1. Create a new Vercel project
2. Upload the folder
3. Add the environment variables
4. Deploy

## What the UI supports

Official query params for `item_summary/search` are exposed as inputs, including:
- `q`
- `category_ids`
- `filter`
- `sort`
- `limit`
- `offset`
- `fieldgroups`
- `auto_correct`
- `aspect_filter`
- `compatibility_filter`
- `epid`
- `gtin`
- `charity_ids`

Plus:
- Extra query params (free form) for anything else eBay accepts

Headers supported in the UI:
- `X-EBAY-C-MARKETPLACE-ID`
- `X-EBAY-C-ENDUSERCTX` (optional, built from country and zip)

## Quick sanity check

After deploy, open the site and click Search.
You should see results for NASA Patches, newest first.

If you get:
- 401 or 403: confirm your eBay keys are correct and set in Vercel
- 429: you are rate limited, reduce refresh frequency
