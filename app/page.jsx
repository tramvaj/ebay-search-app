// Path: app/page.jsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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

const BUYING_OPTIONS_PRESETS = [
  { value: "", label: "(leave as is)" },
  { value: "FIXED_PRICE", label: "Fixed price only" },
  { value: "AUCTION", label: "Auction only" },
  { value: "FIXED_PRICE|AUCTION", label: "Fixed price + Auction" }
];

// Common eBay condition ids used across many categories
// Users can still override using raw filter
const CONDITION_PRESETS = [
  { value: "", label: "(any)" },
  { value: "1000", label: "New (1000)" },
  { value: "1500", label: "New other (1500)" },
  { value: "3000", label: "Used (3000)" },
  { value: "4000", label: "Very Good (4000)" },
  { value: "5000", label: "Good (5000)" },
  { value: "6000", label: "Acceptable (6000)" }
];

function toggleInArray(arr, value) {
  if (arr.includes(value)) return arr.filter((x) => x !== value);
  return [...arr, value];
}

function normalizeSpaces(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}

function filterHasClause(filterStr, clauseKey) {
  const re = new RegExp(`(^|,)\\s*${clauseKey}\\s*:`);
  return re.test(String(filterStr || ""));
}

function upsertBuyingOptionsFilter(filterStr, buyingOptionsValue) {
  const base = normalizeSpaces(filterStr);
  const v = String(buyingOptionsValue || "").trim();
  if (!v) return base;

  const bo = `buyingOptions:{${v}}`;

  // If user already has buyingOptions in the raw filter, do not override it
  if (filterHasClause(base, "buyingOptions")) return base;

  if (!base) return bo;
  return `${bo},${base}`;
}

function buildGuidedFilter({
  priceMin,
  priceMax,
  conditionId,
  freeShippingOnly,
  returnsAcceptedOnly
}) {
  const parts = [];

  const min = String(priceMin || "").trim();
  const max = String(priceMax || "").trim();
  if (min || max) {
    const left = min ? min : "";
    const right = max ? max : "";
    parts.push(`price:[${left}..${right}]`);
  }

  const cid = String(conditionId || "").trim();
  if (cid) {
    parts.push(`conditionIds:{${cid}}`);
  }

  if (freeShippingOnly) {
    parts.push("shippingOptions:{FREE_SHIPPING}");
  }

  if (returnsAcceptedOnly) {
    parts.push("returnsAccepted:{true}");
  }

  return parts.join(",");
}

function safeB64EncodeUnicode(str) {
  try {
    return btoa(unescape(encodeURIComponent(str)));
  } catch {
    return "";
  }
}

function safeB64DecodeUnicode(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return "";
  }
}

function clampInt(v, min, max, fallback) {
  const n = Number.parseInt(String(v), 10);
  if (Number.isNaN(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readLsJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeLsJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

const LS_SAVED_KEY = "dd_ebay_saved_searches_v1";

export default function Page() {
  // Official query params
  const [q, setQ] = useState("NASA Patches");
  const [gtin, setGtin] = useState("");
  const [epid, setEpid] = useState("");
  const [charityIds, setCharityIds] = useState("");
  const [categoryIds, setCategoryIds] = useState("");
  const [rawFilter, setRawFilter] = useState("");
  const [aspectFilter, setAspectFilter] = useState("");
  const [compatibilityFilter, setCompatibilityFilter] = useState("");
  const [autoCorrect, setAutoCorrect] = useState("KEYWORD");
  const [fieldgroupsSelected, setFieldgroupsSelected] = useState([]);
  const [sort, setSort] = useState("newlyListed");
  const [limit, setLimit] = useState(50);
  const [offset, setOffset] = useState(0);

  // Buying options (auto adds to filter if missing)
  const [buyingOptionsPreset, setBuyingOptionsPreset] = useState("FIXED_PRICE|AUCTION");

  // Guided filter builder state
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [conditionId, setConditionId] = useState("");
  const [freeShippingOnly, setFreeShippingOnly] = useState(false);
  const [returnsAcceptedOnly, setReturnsAcceptedOnly] = useState(false);

  // Headers
  const [marketplaceId, setMarketplaceId] = useState("EBAY_US");
  const [ctxCountry, setCtxCountry] = useState("US");
  const [ctxZip, setCtxZip] = useState("");

  // Extra arbitrary params
  const [extraParams, setExtraParams] = useState([{ key: "", value: "" }]);

  // Saved searches
  const [savedSearches, setSavedSearches] = useState([]);
  const [saveName, setSaveName] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState("");

  // Watch mode
  const [watchOn, setWatchOn] = useState(false);
  const [watchEverySec, setWatchEverySec] = useState(15);
  const [showOnlyNew, setShowOnlyNew] = useState(false);
  const seenIdsRef = useRef(new Set());
  const [newIds, setNewIds] = useState(new Set());
  const lastPayloadRef = useRef(null);

  // Request + response state
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
      const packed = `contextualLocation=${encodeURIComponent(`country=${country},zip=${zip}`)}`;
      h["X-EBAY-C-ENDUSERCTX"] = packed;
    }

    return h;
  }, [marketplaceId, ctxCountry, ctxZip]);

  const guidedFilter = useMemo(() => {
    return buildGuidedFilter({
      priceMin,
      priceMax,
      conditionId,
      freeShippingOnly,
      returnsAcceptedOnly
    });
  }, [priceMin, priceMax, conditionId, freeShippingOnly, returnsAcceptedOnly]);

  const effectiveFilter = useMemo(() => {
    // Compose: buyingOptions + guided clauses + raw filter
    // Rule: if raw filter already contains buyingOptions, do not inject buyingOptions
    const raw = normalizeSpaces(rawFilter);

    let composed = raw;

    if (guidedFilter) {
      composed = composed ? `${guidedFilter},${composed}` : guidedFilter;
    }

    composed = upsertBuyingOptionsFilter(composed, buyingOptionsPreset);

    return normalizeSpaces(composed);
  }, [rawFilter, guidedFilter, buyingOptionsPreset]);

  const queryParams = useMemo(() => {
    const qp = {};

    if (q) qp.q = q;
    if (gtin) qp.gtin = gtin;
    if (epid) qp.epid = epid;
    if (charityIds) qp.charity_ids = charityIds;
    if (fieldgroupsValue) qp.fieldgroups = fieldgroupsValue;
    if (compatibilityFilter) qp.compatibility_filter = compatibilityFilter;
    if (autoCorrect) qp.auto_correct = autoCorrect;
    if (categoryIds) qp.category_ids = categoryIds;
    if (effectiveFilter) qp.filter = effectiveFilter;
    if (sort) qp.sort = sort;

    qp.limit = String(limit);
    qp.offset = String(offset);

    if (aspectFilter) qp.aspect_filter = aspectFilter;

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
    effectiveFilter,
    sort,
    limit,
    offset,
    aspectFilter,
    extraParams
  ]);

  const pageIndex = useMemo(() => {
    const l = Math.max(1, Number(limit) || 1);
    return Math.floor((Number(offset) || 0) / l) + 1;
  }, [limit, offset]);

  // Saved searches init
  useEffect(() => {
    const initial = readLsJson(LS_SAVED_KEY, []);
    if (Array.isArray(initial)) setSavedSearches(initial);
  }, []);

  // Load from URL on first render
  useEffect(() => {
    const url = new URL(window.location.href);
    const sp = url.searchParams;

    const nq = sp.get("q");
    const nsort = sp.get("sort");
    const nlimit = sp.get("limit");
    const noffset = sp.get("offset");
    const nmp = sp.get("mp");
    const nbo = sp.get("bo");

    const npriceMin = sp.get("pmin");
    const npriceMax = sp.get("pmax");
    const ncond = sp.get("cond");
    const nfree = sp.get("free");
    const nret = sp.get("ret");
    const nraw = sp.get("rf");

    const ncat = sp.get("cat");
    const nac = sp.get("ac");
    const nfg = sp.get("fg");
    const nasp = sp.get("asp");
    const ncomp = sp.get("comp");
    const nepid = sp.get("epid");
    const ngtin = sp.get("gtin");
    const nchar = sp.get("char");

    const x = sp.get("x");

    if (nq !== null) setQ(nq);
    if (nsort !== null) setSort(nsort);
    if (nlimit !== null) setLimit(clampInt(nlimit, 1, 200, 50));
    if (noffset !== null) setOffset(clampInt(noffset, 0, 9999, 0));
    if (nmp !== null) setMarketplaceId(nmp);
    if (nbo !== null) setBuyingOptionsPreset(nbo);

    if (npriceMin !== null) setPriceMin(npriceMin);
    if (npriceMax !== null) setPriceMax(npriceMax);
    if (ncond !== null) setConditionId(ncond);
    if (nfree !== null) setFreeShippingOnly(nfree === "1");
    if (nret !== null) setReturnsAcceptedOnly(nret === "1");
    if (nraw !== null) setRawFilter(nraw);

    if (ncat !== null) setCategoryIds(ncat);
    if (nac !== null) setAutoCorrect(nac);
    if (nasp !== null) setAspectFilter(nasp);
    if (ncomp !== null) setCompatibilityFilter(ncomp);
    if (nepid !== null) setEpid(nepid);
    if (ngtin !== null) setGtin(ngtin);
    if (nchar !== null) setCharityIds(nchar);

    if (nfg !== null) {
      const parts = nfg.split(",").map((s) => s.trim()).filter(Boolean);
      setFieldgroupsSelected(parts.filter((p) => FIELDGROUPS.includes(p)));
    }

    if (x) {
      const decoded = safeB64DecodeUnicode(x);
      try {
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed)) setExtraParams(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  async function runSearch(nextOffset) {
    const finalOffset = typeof nextOffset === "number" ? nextOffset : offset;

    setLoading(true);
    setErrorText("");
    setApiStatus(null);
    setRequestUrl("");
    setData(null);

    const qp = { ...queryParams, offset: String(finalOffset) };
    const payload = { queryParams: qp, headers };

    lastPayloadRef.current = payload;

    try {
      const resp = await fetch("/api/ebay/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const json = await resp.json().catch(() => ({}));

      setApiStatus(resp.status);
      setRequestUrl(json.requestUrl || "");
      setData(json.data || null);

      if (!resp.ok) {
        const msg = json?.error || json?.data?.errors?.[0]?.message || "Request failed";
        setErrorText(String(msg));
      } else {
        const items = Array.isArray(json?.data?.itemSummaries) ? json.data.itemSummaries : [];
        const newlySeen = new Set();
        const newOnes = new Set();

        for (const it of items) {
          const id = it?.itemId ? String(it.itemId) : "";
          if (!id) continue;
          newlySeen.add(id);
          if (!seenIdsRef.current.has(id)) {
            newOnes.add(id);
          }
        }

        // Update seen set
        for (const id of newlySeen) seenIdsRef.current.add(id);

        // Update new id highlights (keep latest batch only)
        setNewIds(newOnes);

        // Keep offset state in sync if caller passed it
        if (typeof nextOffset === "number") setOffset(nextOffset);
      }
    } catch (err) {
      setErrorText(err?.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  function onSearchSubmit(e) {
    e.preventDefault();
    runSearch(offset);
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

  function makeShareUrl() {
    const url = new URL(window.location.href);
    url.search = "";
    const sp = url.searchParams;

    sp.set("q", q || "");
    sp.set("sort", sort || "");
    sp.set("limit", String(limit));
    sp.set("offset", String(offset));
    sp.set("mp", marketplaceId || "EBAY_US");
    sp.set("bo", buyingOptionsPreset || "");

    if (categoryIds) sp.set("cat", categoryIds);
    if (autoCorrect) sp.set("ac", autoCorrect);
    if (fieldgroupsValue) sp.set("fg", fieldgroupsValue);
    if (aspectFilter) sp.set("asp", aspectFilter);
    if (compatibilityFilter) sp.set("comp", compatibilityFilter);
    if (epid) sp.set("epid", epid);
    if (gtin) sp.set("gtin", gtin);
    if (charityIds) sp.set("char", charityIds);

    if (priceMin) sp.set("pmin", priceMin);
    if (priceMax) sp.set("pmax", priceMax);
    if (conditionId) sp.set("cond", conditionId);
    if (freeShippingOnly) sp.set("free", "1");
    if (returnsAcceptedOnly) sp.set("ret", "1");
    if (rawFilter) sp.set("rf", rawFilter);

    // Extras packed
    const extrasClean = (extraParams || []).filter((r) => String(r?.key || "").trim() && String(r?.value || "").trim());
    if (extrasClean.length) {
      const b64 = safeB64EncodeUnicode(JSON.stringify(extrasClean));
      if (b64) sp.set("x", b64);
    }

    return url.toString();
  }

  async function onShareLink() {
    const u = makeShareUrl();
    try {
      window.history.replaceState(null, "", u);
      await navigator.clipboard.writeText(u);
    } catch {
      // ignore
    }
  }

  function saveCurrentSearch() {
    const name = normalizeSpaces(saveName);
    if (!name) return;

    const id = `s_${Date.now()}`;
    const entry = {
      id,
      name,
      state: {
        q,
        sort,
        limit,
        offset,
        marketplaceId,
        buyingOptionsPreset,
        categoryIds,
        autoCorrect,
        fieldgroupsSelected,
        aspectFilter,
        compatibilityFilter,
        epid,
        gtin,
        charityIds,
        priceMin,
        priceMax,
        conditionId,
        freeShippingOnly,
        returnsAcceptedOnly,
        rawFilter,
        extraParams,
        ctxCountry,
        ctxZip
      }
    };

    const next = [entry, ...savedSearches];
    setSavedSearches(next);
    writeLsJson(LS_SAVED_KEY, next);
    setSaveName("");
    setSelectedSavedId(id);
  }

  function deleteSelectedSearch() {
    const id = selectedSavedId;
    if (!id) return;
    const next = savedSearches.filter((s) => s.id !== id);
    setSavedSearches(next);
    writeLsJson(LS_SAVED_KEY, next);
    setSelectedSavedId("");
  }

  function loadSelectedSearch() {
    const id = selectedSavedId;
    if (!id) return;
    const found = savedSearches.find((s) => s.id === id);
    if (!found?.state) return;

    const st = found.state;

    setQ(st.q ?? "");
    setSort(st.sort ?? "newlyListed");
    setLimit(clampInt(st.limit ?? 50, 1, 200, 50));
    setOffset(clampInt(st.offset ?? 0, 0, 9999, 0));
    setMarketplaceId(st.marketplaceId ?? "EBAY_US");
    setBuyingOptionsPreset(st.buyingOptionsPreset ?? "FIXED_PRICE|AUCTION");

    setCategoryIds(st.categoryIds ?? "");
    setAutoCorrect(st.autoCorrect ?? "KEYWORD");
    setFieldgroupsSelected(Array.isArray(st.fieldgroupsSelected) ? st.fieldgroupsSelected : []);
    setAspectFilter(st.aspectFilter ?? "");
    setCompatibilityFilter(st.compatibilityFilter ?? "");
    setEpid(st.epid ?? "");
    setGtin(st.gtin ?? "");
    setCharityIds(st.charityIds ?? "");

    setPriceMin(st.priceMin ?? "");
    setPriceMax(st.priceMax ?? "");
    setConditionId(st.conditionId ?? "");
    setFreeShippingOnly(Boolean(st.freeShippingOnly));
    setReturnsAcceptedOnly(Boolean(st.returnsAcceptedOnly));
    setRawFilter(st.rawFilter ?? "");

    setExtraParams(Array.isArray(st.extraParams) ? st.extraParams : [{ key: "", value: "" }]);

    setCtxCountry(st.ctxCountry ?? "US");
    setCtxZip(st.ctxZip ?? "");

    // Reset watch highlights
    setNewIds(new Set());
  }

  function resetToDefaults() {
    setQ("NASA Patches");
    setSort("newlyListed");
    setLimit(50);
    setOffset(0);

    setBuyingOptionsPreset("FIXED_PRICE|AUCTION");
    setCategoryIds("");
    setAutoCorrect("KEYWORD");
    setFieldgroupsSelected([]);
    setAspectFilter("");
    setCompatibilityFilter("");
    setEpid("");
    setGtin("");
    setCharityIds("");

    setPriceMin("");
    setPriceMax("");
    setConditionId("");
    setFreeShippingOnly(false);
    setReturnsAcceptedOnly(false);
    setRawFilter("");

    setMarketplaceId("EBAY_US");
    setCtxCountry("US");
    setCtxZip("");

    setExtraParams([{ key: "", value: "" }]);

    setNewIds(new Set());
  }

  // Watch loop
  useEffect(() => {
    if (!watchOn) return;

    const everyMs = Math.max(5, clampInt(watchEverySec, 5, 600, 15)) * 1000;
    const t = setInterval(() => {
      // Only re-run if a user has done at least one search, or we run initial default search
      const hasPayload = Boolean(lastPayloadRef.current);
      if (!hasPayload) {
        runSearch(offset);
        return;
      }
      runSearch(offset);
    }, everyMs);

    return () => clearInterval(t);
  }, [watchOn, watchEverySec, offset]); // keep simple, watch uses current offset

  const itemsAll = Array.isArray(data?.itemSummaries) ? data.itemSummaries : [];
  const items = useMemo(() => {
    if (!showOnlyNew) return itemsAll;
    return itemsAll.filter((it) => it?.itemId && newIds.has(String(it.itemId)));
  }, [itemsAll, showOnlyNew, newIds]);

  const hasNext = useMemo(() => {
    // Basic guardrail: offset + limit under 10000
    const l = Math.max(1, Number(limit) || 1);
    const o = Number(offset) || 0;
    return o + l <= 9999;
  }, [limit, offset]);

  const hasPrev = useMemo(() => {
    return (Number(offset) || 0) > 0;
  }, [offset]);

  async function nextPage() {
    const l = Math.max(1, Number(limit) || 1);
    const o = Number(offset) || 0;
    const n = Math.min(9999, o + l);
    await runSearch(n);
  }

  async function prevPage() {
    const l = Math.max(1, Number(limit) || 1);
    const o = Number(offset) || 0;
    const n = Math.max(0, o - l);
    await runSearch(n);
  }

  const stickyBarStyle = {
    position: "sticky",
    top: 0,
    zIndex: 10,
    background: "white",
    borderBottom: "1px solid #eee"
  };

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: 18, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={stickyBarStyle}>
        <div style={{ padding: "12px 0 10px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
            <h1 style={{ margin: 0 }}>eBay Browse search</h1>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={onShareLink}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
              >
                Share link
              </button>
              <button
                type="button"
                onClick={resetToDefaults}
                style={{ padding: "8px 10px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
              >
                Reset
              </button>

              <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", border: "1px solid #eee", borderRadius: 10 }}>
                <input type="checkbox" checked={watchOn} onChange={(e) => setWatchOn(e.target.checked)} />
                <span>Watch</span>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <span style={{ fontSize: 12, opacity: 0.8 }}>Every</span>
                <input
                  type="number"
                  min={5}
                  max={600}
                  value={watchEverySec}
                  onChange={(e) => setWatchEverySec(clampInt(e.target.value, 5, 600, 15))}
                  style={{ width: 70, padding: 8, borderRadius: 10, border: "1px solid #ccc" }}
                />
                <span style={{ fontSize: 12, opacity: 0.8 }}>sec</span>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", border: "1px solid #eee", borderRadius: 10 }}>
                <input type="checkbox" checked={showOnlyNew} onChange={(e) => setShowOnlyNew(e.target.checked)} />
                <span>New only</span>
              </label>

              <div style={{ fontSize: 12, opacity: 0.8 }}>
                New: {newIds.size}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr", gap: 10 }}>
            <label style={{ display: "grid", gap: 6 }}>
              Keywords
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="NASA Patches"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              Marketplace
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

            <label style={{ display: "grid", gap: 6 }}>
              Buying options
              <select
                value={buyingOptionsPreset}
                onChange={(e) => setBuyingOptionsPreset(e.target.value)}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                {BUYING_OPTIONS_PRESETS.map((opt) => (
                  <option key={opt.value || "leave"} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
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
              Limit
              <select
                value={limit}
                onChange={(e) => setLimit(clampInt(e.target.value, 1, 200, 50))}
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              >
                {[10, 25, 50, 100, 200].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div style={{ marginTop: 10, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => runSearch(offset)}
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

            <button
              type="button"
              onClick={prevPage}
              disabled={loading || !hasPrev}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
            >
              Prev
            </button>

            <button
              type="button"
              onClick={nextPage}
              disabled={loading || !hasNext}
              style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white" }}
            >
              Next
            </button>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Page {pageIndex} - Offset {offset}
            </div>

            <div style={{ fontSize: 12, opacity: 0.8 }}>
              Params {Object.keys(queryParams).length} - Headers {Object.keys(headers).length}
            </div>
          </div>

          {apiStatus !== null ? (
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.9 }}>
              <div>HTTP status: {apiStatus}</div>
              {requestUrl ? <div style={{ wordBreak: "break-all" }}>Request: {requestUrl}</div> : null}
            </div>
          ) : null}

          {errorText ? (
            <div style={{ marginTop: 10, padding: 12, borderRadius: 12, border: "1px solid #f2c0c0", background: "#fff6f6" }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Error</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{errorText}</div>
            </div>
          ) : null}
        </div>
      </div>

      <section style={{ marginTop: 14 }}>
        <details style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Saved searches</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Pick saved
                <select
                  value={selectedSavedId}
                  onChange={(e) => setSelectedSavedId(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  <option value="">(none)</option>
                  {savedSearches.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={loadSelectedSearch}
                disabled={!selectedSavedId}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white", height: 42, alignSelf: "end" }}
              >
                Load
              </button>

              <button
                type="button"
                onClick={deleteSelectedSearch}
                disabled={!selectedSavedId}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white", height: 42, alignSelf: "end" }}
              >
                Delete
              </button>

              <div style={{ fontSize: 12, opacity: 0.8, alignSelf: "end" }}>
                Stored locally
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Save name
                <input
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Example NASA patches both auction and fixed"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <button
                type="button"
                onClick={saveCurrentSearch}
                disabled={!normalizeSpaces(saveName)}
                style={{ padding: "10px 12px", borderRadius: 10, border: "1px solid #ccc", background: "white", height: 42, alignSelf: "end" }}
              >
                Save current
              </button>
            </div>
          </div>
        </details>

        <details style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>Guided filters</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Price min
                <input
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  placeholder="10"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Price max
                <input
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  placeholder="50"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Condition
                <select
                  value={conditionId}
                  onChange={(e) => setConditionId(e.target.value)}
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                >
                  {CONDITION_PRESETS.map((c) => (
                    <option key={c.value || "any"} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                category_ids
                <input
                  value={categoryIds}
                  onChange={(e) => setCategoryIds(e.target.value)}
                  placeholder="Example 220"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", border: "1px solid #eee", borderRadius: 10 }}>
                <input type="checkbox" checked={freeShippingOnly} onChange={(e) => setFreeShippingOnly(e.target.checked)} />
                <span>Free shipping only</span>
              </label>

              <label style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 10px", border: "1px solid #eee", borderRadius: 10 }}>
                <input type="checkbox" checked={returnsAcceptedOnly} onChange={(e) => setReturnsAcceptedOnly(e.target.checked)} />
                <span>Returns accepted only</span>
              </label>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ fontWeight: 650 }}>Raw filter input (optional)</div>
              <input
                value={rawFilter}
                onChange={(e) => setRawFilter(e.target.value)}
                placeholder="Example itemLocationCountry:US"
                style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
              />
              <div style={{ fontSize: 12, opacity: 0.8 }}>
                Effective filter (sent to API)
              </div>
              <div style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc", background: "#fafafa", fontSize: 12, wordBreak: "break-word" }}>
                {effectiveFilter || "(empty)"}
              </div>
            </div>
          </div>
        </details>

        <details style={{ marginTop: 12, border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
          <summary style={{ cursor: "pointer", fontWeight: 650 }}>More params and headers</summary>

          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
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
                fieldgroups (multi select)
                <div style={{ display: "flex", gap: 12, flexWrap: "wrap", padding: 10, borderRadius: 10, border: "1px solid #ccc" }}>
                  {FIELDGROUPS.map((fg) => (
                    <label key={fg} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={fieldgroupsSelected.includes(fg)}
                        onChange={() => setFieldgroupsSelected((prev) => toggleInArray(prev, fg))}
                      />
                      <span style={{ fontSize: 12 }}>{fg}</span>
                    </label>
                  ))}
                </div>
                <div style={{ fontSize: 12, opacity: 0.8 }}>
                  Selected: {fieldgroupsValue || "(none)"}
                </div>
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                aspect_filter
                <input
                  value={aspectFilter}
                  onChange={(e) => setAspectFilter(e.target.value)}
                  placeholder="Example categoryId:15724,Color:{Red}"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                compatibility_filter
                <input
                  value={compatibilityFilter}
                  onChange={(e) => setCompatibilityFilter(e.target.value)}
                  placeholder="Example Year:2018;Make:BMW"
                  style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }}
                />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                epid
                <input value={epid} onChange={(e) => setEpid(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                gtin
                <input value={gtin} onChange={(e) => setGtin(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                charity_ids
                <input value={charityIds} onChange={(e) => setCharityIds(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <label style={{ display: "grid", gap: 6 }}>
                Context country
                <input value={ctxCountry} onChange={(e) => setCtxCountry(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>

              <label style={{ display: "grid", gap: 6 }}>
                Context zip
                <input value={ctxZip} onChange={(e) => setCtxZip(e.target.value)} style={{ padding: 10, borderRadius: 10, border: "1px solid #ccc" }} />
              </label>
            </div>

            <details style={{ border: "1px solid #eee", borderRadius: 12, padding: 12 }}>
              <summary style={{ cursor: "pointer", fontWeight: 650 }}>Extra query params</summary>

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
          </div>
        </details>
      </section>

      <section style={{ marginTop: 16 }}>
        {items.length > 0 ? (
          <>
            <h2 style={{ margin: "14px 0 10px" }}>Items ({items.length})</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {items.map((it) => {
                const id = it?.itemId ? String(it.itemId) : "";
                const isNew = id && newIds.has(id);

                return (
                  <article
                    key={id || Math.random()}
                    style={{
                      border: isNew ? "2px solid #111" : "1px solid #ddd",
                      borderRadius: 12,
                      padding: 12,
                      background: isNew ? "#fffbe6" : "white"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ fontWeight: 700, marginBottom: 8 }}>{it.title}</div>
                      {isNew ? (
                        <div style={{ fontSize: 12, fontWeight: 700 }}>
                          NEW
                        </div>
                      ) : null}
                    </div>

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
                );
              })}
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

      {/* Hidden form to allow Enter key behavior in some browsers */}
      <form onSubmit={onSearchSubmit} style={{ display: "none" }} />
    </main>
  );
}

