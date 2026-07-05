// Free web search — multiple methods for reliability from Cloudflare Workers.
// Every backend fetch is time-boxed so a slow/blocked source can't hang the bot.

// fetch with an abort timeout (default 6s).
async function fetchT(url, opts = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try { return await fetch(url, { ...opts, signal: ctrl.signal }); }
  finally { clearTimeout(timer); }
}

export async function webSearch(query, maxResults = 5, env) {
  // 1) Google Custom Search if configured
  if (env && env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_SEARCH_CX) {
    try {
      const g = await googleSearch(env.GOOGLE_SEARCH_API_KEY, env.GOOGLE_SEARCH_CX, query, maxResults);
      if (g.length) return g;
    } catch (e) { /* fall through */ }
  }

  // 2) Jina AI Search — ONLY if an API key is set. The keyless endpoint now
  //    returns HTTP 401, so don't waste a round-trip on it without a key.
  if (env && env.JINA_API_KEY) {
    try {
      const j = await jinaSearch(query, maxResults, env);
      if (j.length) return j;
    } catch (e) { /* fall through */ }
  }

  // 3) DuckDuckGo HTML (best-effort; time-boxed so it can't hang)
  try {
    const html = await ddgHtml(query, maxResults);
    if (html.length) return html;
  } catch (e) { /* fall through */ }

  // 4) Wikipedia (keyless, reliable — encyclopedic, tries FA then EN)
  try {
    const w = await wikiSearch(query, maxResults);
    if (w.length) return w;
  } catch (e) { /* fall through */ }

  // 5) DuckDuckGo Instant Answer API (JSON, fast but limited)
  try {
    const ia = await ddgInstant(query, maxResults);
    if (ia.length) return ia;
  } catch (e) { /* fall through */ }

  return [];
}
// (DuckDuckGo Lite dropped from the chain — slowest & usually blocked.)

// Wikipedia full-text search via the MediaWiki API (no key needed).
async function wikiSearch(query, maxResults) {
  const langs = /[\u0600-\u06FF]/.test(query) ? ["fa", "en"] : ["en"];
  for (const lang of langs) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srsearch=` +
      encodeURIComponent(query) + `&format=json&srlimit=${maxResults}&origin=*`;
    const res = await fetchT(url, { headers: { "User-Agent": "TG-Bot/1.0" } });
    if (!res.ok) continue;
    const data = await res.json();
    const hits = data?.query?.search || [];
    if (hits.length) {
      return hits.slice(0, maxResults).map(h => ({
        title: h.title,
        url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(h.title.replace(/ /g, "_"))}`,
        snippet: clean(h.snippet || ""),
      }));
    }
  }
  return [];
}

// ── Crypto prices via CoinGecko (keyless, reliable from any IP) ──────────────
export async function cryptoPrice(query) {
  const id = await resolveCoinId(query);
  if (!id) return null;
  const r = await fetchT(`https://api.coingecko.com/api/v3/coins/${id}` +
    `?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false`);
  if (!r.ok) return null;
  const d = await r.json();
  const md = d.market_data || {};
  if (md.current_price?.usd == null) return null;
  return {
    id,
    name: d.name || id,
    symbol: (d.symbol || "").toUpperCase(),
    usd: md.current_price.usd,
    change24: md.price_change_percentage_24h,
    high24: md.high_24h?.usd,
    low24: md.low_24h?.usd,
    mcap: md.market_cap?.usd,
    url: `https://www.coingecko.com/en/coins/${id}`,
  };
}

async function resolveCoinId(query) {
  const q = query.toLowerCase();
  const alias = {
    "بیت کوین": "bitcoin", "بیت‌کوین": "bitcoin", "بیتکوین": "bitcoin", "btc": "bitcoin", "bitcoin": "bitcoin",
    "اتریوم": "ethereum", "اتر": "ethereum", "eth": "ethereum", "ethereum": "ethereum",
    "تتر": "tether", "usdt": "tether", "tether": "tether",
    "دوج": "dogecoin", "دوج کوین": "dogecoin", "doge": "dogecoin",
    "بایننس": "binancecoin", "bnb": "binancecoin",
    "کاردانو": "cardano", "ada": "cardano",
    "سولانا": "solana", "sol": "solana",
    "ریپل": "ripple", "xrp": "ripple",
    "شیبا": "shiba-inu", "shib": "shiba-inu",
    "ترون": "tron", "trx": "tron",
    "لایت کوین": "litecoin", "لایت‌کوین": "litecoin", "ltc": "litecoin",
    "پولکادات": "polkadot", "dot": "polkadot",
  };
  for (const k of Object.keys(alias)) if (q.includes(k)) return alias[k];
  try {
    const r = await fetchT("https://api.coingecko.com/api/v3/search?query=" + encodeURIComponent(query));
    if (r.ok) { const d = await r.json(); if (d.coins && d.coins.length) return d.coins[0].id; }
  } catch { /* ignore */ }
  return null;
}

async function googleSearch(apiKey, cx, query, maxResults) {
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&num=${maxResults}`;
  const res = await fetchT(url);
  if (!res.ok) throw new Error(`Google HTTP ${res.status}`);
  const data = await res.json();
  return (data.items || []).slice(0, maxResults).map(item => ({
    title: item.title || "",
    url: item.link || "",
    snippet: item.snippet || "",
  }));
}

// Jina AI Search — returns clean JSON with title/url/description.
// Works reliably from Cloudflare Workers where DuckDuckGo scraping is blocked.
async function jinaSearch(query, maxResults, env) {
  const headers = {
    "Accept": "application/json",
    "X-Respond-With": "no-content", // metadata only → faster & smaller
    "User-Agent": "Mozilla/5.0 (compatible; TG-Bot/1.0)",
  };
  if (env && env.JINA_API_KEY) headers["Authorization"] = "Bearer " + env.JINA_API_KEY;

  const res = await fetchT("https://s.jina.ai/?q=" + encodeURIComponent(query), { headers });
  if (!res.ok) throw new Error(`Jina HTTP ${res.status}`);
  const data = await res.json();
  const items = Array.isArray(data?.data) ? data.data : [];
  return items.slice(0, maxResults).map(it => ({
    title: it.title || "",
    url: it.url || "",
    snippet: clean(it.description || it.content || "").slice(0, 300),
  })).filter(r => r.title || r.url);
}

// DuckDuckGo Lite — POST form, simple HTML table structure
async function ddgLite(query, maxResults) {
  const res = await fetchT("https://lite.duckduckgo.com/lite/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
    },
    body: "q=" + encodeURIComponent(query),
  });
  const html = await res.text();
  const results = [];

  // Links in lite are <a rel="nofollow" href="...">title</a> inside result rows
  const linkRe = /<a[^>]*class="result-link"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  const snipRe = /<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/g;

  const snippets = [];
  let sm;
  while ((sm = snipRe.exec(html))) snippets.push(clean(sm[1]));

  let m, idx = 0;
  while ((m = linkRe.exec(html)) && results.length < maxResults) {
    let url = decodeDdg(m[1]);
    const title = clean(m[2]);
    if (title && url) results.push({ title, url, snippet: snippets[idx] || "" });
    idx++;
  }
  return results;
}

// DuckDuckGo HTML endpoint
async function ddgHtml(query, maxResults) {
  const res = await fetchT("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9,fa;q=0.8",
    },
  });
  const html = await res.text();
  const results = [];

  const snipRe = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  const snippets = [];
  let s;
  while ((s = snipRe.exec(html))) snippets.push(clean(s[1]));

  const linkRe = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let m, idx = 0;
  while ((m = linkRe.exec(html)) && results.length < maxResults) {
    let url = decodeDdg(m[1]);
    const title = clean(m[2]);
    if (title) results.push({ title, url, snippet: snippets[idx] || "" });
    idx++;
  }
  return results;
}

// DuckDuckGo Instant Answer JSON API — reliable fallback
async function ddgInstant(query, maxResults) {
  const res = await fetchT("https://api.duckduckgo.com/?q=" + encodeURIComponent(query) + "&format=json&no_html=1&skip_disambig=1", {
    headers: { "User-Agent": "Mozilla/5.0 TG-Bot" },
  });
  const data = await res.json();
  const results = [];

  if (data.AbstractText) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL || "",
      snippet: data.AbstractText,
    });
  }
  const topics = data.RelatedTopics || [];
  for (const t of topics) {
    if (results.length >= maxResults) break;
    if (t.Text && t.FirstURL) {
      results.push({ title: t.Text.split(" - ")[0], url: t.FirstURL, snippet: t.Text });
    } else if (t.Topics) {
      for (const sub of t.Topics) {
        if (results.length >= maxResults) break;
        if (sub.Text && sub.FirstURL) results.push({ title: sub.Text.split(" - ")[0], url: sub.FirstURL, snippet: sub.Text });
      }
    }
  }
  return results;
}

function decodeDdg(url) {
  const uddg = url.match(/[?&]uddg=([^&]+)/);
  if (uddg) { try { return decodeURIComponent(uddg[1]); } catch { return url; } }
  if (url.startsWith("//")) return "https:" + url;
  return url;
}

function clean(s) {
  return s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'")
          .replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

export function formatSearchForLLM(query, results) {
  if (!results.length) return `NO_RESULTS`;
  let out = `Web search results for "${query}":\n\n`;
  results.forEach((r, i) => {
    out += `[${i + 1}] ${r.title}\n${r.snippet || ""}\n${r.url}\n\n`;
  });
  return out;
}
