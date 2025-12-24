// Path: app/page.jsx
"use client";

import { useMemo, useState } from "react";

const SORT_OPTIONS = [
  { value: "", label: "(default) Best Match" },
  { value: "newlyListed", label: "newlyListed (newest first)" },
  { value: "endingSoonest", label: "endingSoonest" },
  { value: "price", label: "price (low to high, total cost)" },
  { value: "-price", label: "-price (high to low, total cost)" },
  { value: "distance", label: "distance (nearest first)" }
];

const AUTO_CORRECT_OPTIONS = [
  { value: "", label: "(off)" },
  { value: "KEYWORD", label: "KEYWORD" }
];

const FIELDGROUPS = [
  "ASPECT_REFINEMENTS",
  "BUYING_OPTION_REFINEMENTS",
  "CATEGORY_REFINEMENTS",
  "CONDITION_REFINEMENTS",
  "EXTENDED",
  "MATCHING_ITEMS",
  "FULL"
];

const MARKETPLACE_IDS = [
  "EBAY_US",
  "EBAY_GB",
  "EBAY_DE",
  "EBAY_FR",
  "EBAY_IT",
  "EBAY_ES",
  "EBAY_AU",
  "EBAY_CA",
  "EBAY_AT",
  "EBAY_BE",
  "EBAY_CH",
  "EBAY_DK",
  "EBAY_FI",
  "EBAY_GR",
  "EBAY_HK",
  "EBAY_HU",
  "EBAY_IE",
  "EBAY_IL",
  "EBAY_JP",
  "EBAY_MY",
  "EBAY_NL",
  "EBAY_NO",
  "EBAY_NZ",
  "EBAY_PH",
  "EBAY_PL",
  "EBAY_PR",
  "EBAY_PT",
  "EBAY_SE",
  "EBAY_SG",
  "EBAY_TH",
  "EBAY_TW",
  "EBAY_VN",
  "EBAY_ZA",
  "EBAY_MOTORS_US"
];

function toggleInArray(arr, value) {
  if (arr.includes(value)) return arr.filter((x) => x !== value);
  return [...arr, value];
}

export default function Page() {
  // Official query params for GET /buy/browse/v1/item_summary/search
  const [q, setQ] = useState("NASA Patches");
  const [gtin, setGtin] = useState("");
  const [epid, setEpid] = useState("");
  const [charityIds, setCharityIds] = useState("");
  const [categoryIds, setCategoryIds] = useState("");
  const [filter, setFilter] = useState("");
  const [aspectFilter, setAspectFilter] = useState("");
  const [compatibilityFilter, setCompatibilityFilter] = useState("");
  const [autoCorrect, setAutoCorrect] = useState("KEYWORD");
  const [fieldgroupsSelected, setFieldgroupsSelected] = useState([]);
  const [sort, setSort] = useState("newlyListed");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Headers users can set
  const [marketplaceId, setMarketplaceId] = useState("EBAY_US");

  // X-EBAY-C-ENDUSERCTX helper (contextualLocation=country=US,zip=19406)
  const [ctxCountry, setCtxCountry] = useState("US");
  const [ctxZip, setCtxZip] = useState("");

  // Extra arbitrary query params (in case eBay adds more, or for experiments)
  const [extraParams, setExtraParams] = useState([{ key: "", value: "" }]);

  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState(null);
  const [requestUrl, setRequestUrl] = useState("");
  const [data, setData] = useState(null);
  const [errorText, setErrorText] = useState("");

  const fieldgroupsValue = useMemo(() => {
    const chosen = [...fieldgroupsSelected].filter(Boolean);
    if (chosen.length === 0) return "";
    return chosen.join(",");
  }, [fieldgroupsSelected]);

  const headers = useMemo(() => {
    const h = {
      "X-EBAY-C-MARKETPLACE-ID": marketplaceId
    };

    const country = String(ctxCountry || "").trim();
    const zip = String(ctxZip || "").trim();

    if (country && zip) {
      // eBay expects URL encoded packed header value
      // Example: contextualLocation=country%3DUS%2Czip%3D19406
      const packed = `contextualLocation=${encodeURIComponent(`country=${country},zip=${zip}`)}`;
      h["X-EBAY-C-ENDUSERCTX"] = packed;
    }

    return h;
  }, [marketplaceId, ctxCountry, ctxZip]);

  const queryParams = useMemo(() => {
    const qp = {};

    // Official params
    if (q) qp.q = q;
    if (gtin) qp.gtin = gtin;
    if (epid) qp.epid = epid;
    if (charityIds) qp.charity_ids = charityIds;
    if (fieldgroupsValue) qp.fieldgroups = fieldgroupsValue;
    if (compatibilityFilter) qp.compatibility_filter = compatibilityFilter;
    if (autoCorrect) qp.auto_correct = autoCorrect;
    if (categoryIds) qp.category_ids = categoryIds;
    if (filter) qp.filter = filter;
    if (sort) qp.sort = sort;

    qp.limit = String(limit);
    qp.offset = String(offset);

    if (aspectFilter) qp.aspect_filter = aspectFilter;

    // Extra params
    for (const row of extraParams) {
      const k = String(row.key || "").trim();
      const v = String(row.value || "").trim();
      if (!k || !v) continue;
      qp[k] = v;
    }

    return qp;
  }, [
    q,
    gtin,
    epid,
    charityIds,
    fieldgroupsValue,
    compatibilityFilter,
    autoCorrect,
    categoryIds,
    filter,
    sort,
    limit,
    offset,
    aspectFilter,
    extraParams
  ]);

  async function onSearch(e) {
    e.preventDefault();
    setLoading(true);
    setErrorText("");
    setApiStatus(null);
    setRequestUrl("");
    setData(null);

    try {
      const resp = await fetch("/api/ebay/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryParams,
          headers
        })
      });

      const json = await resp.json().catch(() => ({}));
      setApiStatus(resp.status);
      setRequestUrl(json.requestUrl || "");
      setData(json.data || null);

      if (!resp.ok) {
        const msg = json?.error || json?.data?.errors?.[0]?.message || "Request failed";
        setErrorText(String(msg));
      }
    } catch (err) {
      setErrorText(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function updateExtra(i, field, value) {
    setExtraParams((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  }

  function addExtraRow() {
    setExtraParams((prev) => [...prev, { key: "", value: "" }]);
  }

  function removeExtraRow(i) {
    setExtraParams((prev) => prev.filter((_, idx) => idx !== i));
  }

  const items = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];

  return (
    <main style={{ maxWidth: 1120, margin: "0 auto", padding: 18, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1 style={{ margin: "6px 0 10px" }}>eBay Browse search</h1>

      <form
        onSubmit={onSearch}
        style={{
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 14,
          display: "grid",
          gap: 12
        }}
      >
        <section style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Keywords (q)
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="NASA Patches"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Sort
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value || "default"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Limit (1 to 200)
              <input
                type="number"
                value={limit}
                min={1}
                max={200}
                onChange={(e) => setLimit(Number(e.target.value))}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Offset (0 to 9999)
              <input
                type="number"
                value={offset}
                min={0}
                max={9999}
                onChange={(e) => setOffset(Number(e.target.value))}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>
          </div>
        </section>

        <details style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Official query params</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                category_ids (currently 1 category is recommended)
                <input
                  value={categoryIds}
                  onChange={(e) => setCategoryIds(e.target.value)}
                  placeholder="Example: 220"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                charity_ids (comma separated, US or UK marketplace)
                <input
                  value={charityIds}
                  onChange={(e) => setCharityIds(e.target.value)}
                  placeholder="Example: 530196605"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                epid (eBay product ID)
                <input
                  value={epid}
                  onChange={(e) => setEpid(e.target.value)}
                  placeholder="Example: 1234567890"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                gtin (UPC, EAN, ISBN)
                <input
                  value={gtin}
                  onChange={(e) => setGtin(e.target.value)}
                  placeholder="Example: 099482432621"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                auto_correct
                <select
                  value={autoCorrect}
                  onChange={(e) => setAutoCorrect(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  {AUTO_CORRECT_OPTIONS.map((opt) => (
                    <option key={opt.value || "off"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                compatibility_filter
                <input
                  value={compatibilityFilter}
                  onChange={(e) => setCompatibilityFilter(e.target.value)}
                  placeholder="Example: Year:2018;Make:BMW"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <label style={{ display: "grid", gap: 6 }}>
              filter (Buy API Field Filters syntax)
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Example: price:[10..50],buyingOptions:{FIXED_PRICE|AUCTION}"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              aspect_filter
              <input
                value={aspectFilter}
                onChange={(e) => setAspectFilter(e.target.value)}
                placeholder="Example: categoryId:15724,Color:{Red}"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>

            <div style={{ display: "grid", gap: 8 }}>
              <div style={{ fontWeight: 650 }}>fieldgroups (multi select)</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                {FIELDGROUPS.map((fg) => (
                  <label key={fg} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={fieldgroupsSelected.includes(fg)}
                      onChange={() => setFieldgroupsSelected((prev) => toggleInArray(prev, fg))}
                    />
                    <span>{fg}</span>
                  </label>
                ))}
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>
                Selected: {fieldgroupsValue || "(none, API default)"}
              </div>
            </div>
          </div>
        </details>

        <details style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Headers</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              X-EBAY-C-MARKETPLACE-ID
              <select
                value={marketplaceId}
                onChange={(e) => setMarketplaceId(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                {MARKETPLACE_IDS.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Context country (for X-EBAY-C-ENDUSERCTX)
                <input
                  value={ctxCountry}
                  onChange={(e) => setCtxCountry(e.target.value)}
                  placeholder="US"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Context zip (optional)
                <input
                  value={ctxZip}
                  onChange={(e) => setCtxZip(e.target.value)}
                  placeholder="19406"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <div style={{ fontSize: 12, opacity: 0.75 }}>
              X-EBAY-C-ENDUSERCTX is only sent when both country and zip are provided.
            </div>
          </div>
        </details>

        <details style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Extra query params (free form)</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {extraParams.map((row, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto", gap: 8 }}>
                <input
                  value={row.key}
                  onChange={(e) => updateExtra(i, "key", e.target.value)}
                  placeholder="param name"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
                <input
                  value={row.value}
                  onChange={(e) => updateExtra(i, "value", e.target.value)}
                  placeholder="param value"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
                <button
                  type="button"
                  onClick={() => removeExtraRow(i)}
                  style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
                >
                  Remove
                </button>
              </div>
            ))}

            <div>
              <button
                type="button"
                onClick={addExtraRow}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
              >
                Add param
              </button>
            </div>
          </div>
        </details>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              border: "1px solid #222",
              background: "#111",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer"
            }}
          >
            {loading ? "Searching..." : "Search"}
          </button>

          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Params: {Object.keys(queryParams).length} - Headers: {Object.keys(headers).length}
          </div>
        </div>
      </form>

      <section style={{ marginTop: 16 }}>
        {errorText ? (
          <div style={{ padding: 12, borderRadius: 12, border: "1px solid #f2c0c0", background: "#fff6f6" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
            <div style={{ whiteSpace: "pre-wrap" }}>{errorText}</div>
          </div>
        ) : null}

        {apiStatus !== null ? (
          <div style={{ marginTop: 12, fontSize: 12, opacity: 0.85 }}>
            <div>HTTP status: {apiStatus}</div>
            {requestUrl ? <div style={{ wordBreak: "break-all" }}>Request: {requestUrl}</div> : null}
          </div>
        ) : null}

        {items.length > 0 ? (
          <>
            <h2 style={{ margin: "14px 0 10px" }}>Items ({items.length})</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {items.map((it) => (
                <article key={it.itemId} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.title}</div>

                  {it.image?.imageUrl ? (
                    <img
                      src={it.image.imageUrl}
                      alt={it.title}
                      style={{
                        width: "100%",
                        height: 180,
                        objectFit: "contain",
                        background: "#fafafa",
                        borderRadius: 10,
                        border: "1px solid #eee"
                      }}
                    />
                  ) : null}

                  <div style={{ marginTop: 10, display: "grid", gap: 4, fontSize: 14 }}>
                    {it.price ? (
                      <div>
                        Price: {it.price.value} {it.price.currency}
                      </div>
                    ) : null}

                    {it.itemOriginDate ? (
                      <div style={{ opacity: 0.8 }}>
                        Listed: {new Date(it.itemOriginDate).toLocaleString()}
                      </div>
                    ) : null}

                    {it.seller?.username ? <div style={{ opacity: 0.8 }}>Seller: {it.seller.username}</div> : null}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap" }}>
                    {it.itemWebUrl ? (
                      <a href={it.itemWebUrl} target="_blank" rel="noreferrer">
                        Open on eBay
                      </a>
                    ) : null}
                    {it.itemHref ? (
                      <a href={it.itemHref} target="_blank" rel="noreferrer">
                        API link
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : null}

        {data ? (
          <details style={{ marginTop: 14 }}>
            <summary style={{ cursor: "pointer", fontWeight: 650 }}>Raw JSON</summary>
            <pre
              style={{
                marginTop: 10,
                overflow: "auto",
                padding: 12,
                borderRadius: 12,
                background: "#0b0b0b",
                color: "#eaeaea"
              }}
            >
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        ) : null}

        <details style={{ marginTop: 14 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Effective request payload</summary>
          <pre style={{ marginTop: 10, overflow: "auto", padding: 12, borderRadius: 12, background: "#fafafa" }}>
            {JSON.stringify({ headers, queryParams }, null, 2)}
          </pre>
        </details>
      </section>
    </main>
  );
}
