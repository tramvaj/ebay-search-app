# eBay keyword search (Browse API) - NASA Patches

A small Next.js app you can deploy on Vercel that searches eBay using the Buy Browse API endpoint:
- `GET /buy/browse/v1/item_summary/search`

Defaults:
- keyword: `NASA Patches`
- sort: `newlyListed`

UI goals:
- Users can set every official query parameter for `item_summary/search`:
  - `q`, `gtin`, `charity_ids`, `fieldgroups`, `compatibility_filter`, `auto_correct`, `category_ids`, `filter`, `sort`, `limit`, `offset`, `aspect_filter`, `epid`
- Users can also add any extra query params as free form key/value pairs
- Dropdowns are used where the API has clear enumerations (marketplaceId, sort, fieldgroups, auto_correct)

The app calls your own Next.js API route which:
- mints an Application access token (OAuth client credentials grant)
- forwards the request to eBay with your token
- returns the JSON to the browser

## 1) Create eBay keys
In the eBay Developer portal, create an app and get:
- Client ID
- Client Secret

You will put these in Vercel Environment Variables (server side only).

## 2) Environment variables (Vercel)
Set these in your Vercel Project Settings:
- `EBAY_CLIENT_ID` = your client id
- `EBAY_CLIENT_SECRET` = your client secret
- `EBAY_ENV` = `PROD` or `SANDBOX` (defaults to PROD if missing)

Notes:
- Production token endpoint: `https://api.ebay.com/identity/v1/oauth2/token`
- Sandbox token endpoint: `https://api.sandbox.ebay.com/identity/v1/oauth2/token`
- Browse search endpoint: `https://api.ebay.com/buy/browse/v1/item_summary/search`

## 3) Run locally (optional)
If you do run locally, create `.env.local` with the same variables, then:
- `npm install`
- `npm run dev`

## 4) Deploy (no local git)
If you do not use local git:
1. Create a GitHub repo in the browser
2. Upload the project files via the GitHub web UI
3. In Vercel, import that GitHub repo, or use Vercel's "Deploy from GitHub"

## 5) Important eBay details (why the UI has certain fields)
- Marketplace header `X-EBAY-C-MARKETPLACE-ID` is strongly recommended. If missing, eBay defaults to `EBAY_US`.
- Sort options shown in the UI include: `newlyListed`, `endingSoonest`, `price`, `-price`, `distance` (best match is default when sort is omitted).
- `limit` max is 200, default is 50.
- `offset` must be 0 or a multiple of `limit`.
- Only FIXED_PRICE items are returned by default unless you use a `buyingOptions` filter.

## 6) Security
Client secret never ships to the browser.
All eBay calls are made server side through `/api/ebay/search`.
