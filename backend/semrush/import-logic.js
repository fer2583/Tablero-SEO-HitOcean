// =============================================================
// Logica de import SEMrush -> PostgreSQL
// =============================================================
import { loadCSV, toInt, toFloat, toBool } from './csv-utils.js';
import { query } from '../db/client.js';

// 1. SEMrush Organic Positions -> semrush_keywords
async function importKeywords(rows, exportDate) {
  if (rows.length === 0) return 0;
  // Dedupe por (keyword, url) dentro del lote (el CSV puede repetir filas)
  const seen = new Set();
  const deduped = [];
  for (const r of rows) {
    const key = `${r['Keyword']}||${r['URL']}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
  }
  rows = deduped;
  const cols = ['export_date','keyword','position','previous_position','search_volume','keyword_difficulty','cpc','url','traffic','traffic_pct','traffic_cost','competition','num_results','trends','serp_features','keyword_intents','position_type'];
  const values = [];
  const placeholders = [];
  let p = 1;
  for (const r of rows) {
    const arr = [
      exportDate,
      r['Keyword'] || '',
      toInt(r['Position']),
      toInt(r['Previous position']),
      toInt(r['Search Volume']),
      toInt(r['Keyword Difficulty']),
      toFloat(r['CPC']),
      r['URL'] || null,
      toInt(r['Traffic']),
      toFloat(r['Traffic (%)']),
      toFloat(r['Traffic Cost']),
      toFloat(r['Competition']),
      toInt(r['Number of Results']),
      r['Trends'] || null,
      r['SERP Features by Keyword'] || null,
      r['Keyword Intents'] || null,
      r['Position Type'] || null,
    ];
    const ph = arr.map(() => `$${p++}`).join(', ');
    placeholders.push(`(${ph})`);
    values.push(...arr);
  }
  const text = `INSERT INTO semrush_keywords (${cols.join(', ')}) VALUES ${placeholders.join(', ')}
    ON CONFLICT (export_date, keyword, url) DO UPDATE SET
      position = EXCLUDED.position,
      previous_position = EXCLUDED.previous_position,
      search_volume = EXCLUDED.search_volume,
      keyword_difficulty = EXCLUDED.keyword_difficulty,
      cpc = EXCLUDED.cpc,
      traffic = EXCLUDED.traffic,
      traffic_pct = EXCLUDED.traffic_pct,
      traffic_cost = EXCLUDED.traffic_cost,
      competition = EXCLUDED.competition,
      num_results = EXCLUDED.num_results,
      trends = EXCLUDED.trends,
      serp_features = EXCLUDED.serp_features,
      keyword_intents = EXCLUDED.keyword_intents,
      position_type = EXCLUDED.position_type`;
  const res = await query(text, values);
  return res.rowCount;
}

// 2. Pages + Mega Export + Structured Data -> site_audit + master_urls
async function importSiteAudit(pagesRows, megaRows, structRows, exportDate) {
  const megaByUrl = {};
  for (const r of megaRows) {
    const u = r['Page URL'];
    if (!u) continue;
    const issues = {};
    for (const k of Object.keys(r)) {
      if (['Page URL','# HTTP Status Code','HTTP Status Code','Crawled','# Crawled','Page Title'].includes(k)) continue;
      const v = r[k];
      if (v === '1' || v === 'true' || v === 'Yes' || v === 'Y' || v === 'yes') issues[k] = true;
    }
    megaByUrl[u] = { issues };
  }

  const structByUrl = {};
  for (const r of structRows) {
    const u = r['Page URL'];
    if (!u) continue;
    structByUrl[u] = r;
  }

  let inserted = 0;
  let updatedMaster = 0;

  const cols = ['export_date','page_url','http_status_code','crawl_depth','load_time_ms','title','description','canonicalization','in_sitemap','incoming_internal_links','outgoing_internal_links','outgoing_external_links','schema_jsonld','schema_og','schema_twitter','schema_microformats','hreflang','amp','blocked_ai','issues','raw_issues'];
  const values = [];
  const placeholders = [];
  let p = 1;

  for (const r of pagesRows) {
    const url = r['Page URL'];
    if (!url) continue;
    const mega = megaByUrl[url] || {};
    const struct = structByUrl[url] || {};

    const httpStatus = toInt(r['HTTP Status Code']) ?? toInt(r['# HTTP Status Code']);
    const crawlDepth = toInt(r['Crawl Depth']);
    const loadTime = toFloat(r['Page (HTML) Load Time, sec']) !== null
      ? toFloat(r['Page (HTML) Load Time, sec']) * 1000
      : null;
    const title = r['Page Title'] || null;
    const description = r['Description'] || null;
    const canonical = r['Canonicalization'] && r['Canonicalization'] !== '-' ? r['Canonicalization'] : null;
    const inSitemap = toBool(r['In sitemap']);
    const inLinks = toInt(r['Incoming Internal Links']) ?? 0;
    const outLinks = toInt(r['Outgoing Internal Links']) ?? 0;
    const outExtLinks = toInt(r['Outgoing External Links']) ?? 0;
    const jsonld = toBool(struct['Schema.org (JSON-LD)'] ?? r['Schema.org (JSON-LD)']);
    const og = toBool(struct['Open Graph'] ?? r['Open Graph']);
    const twitter = toBool(struct['Twitter Cards'] ?? r['Twitter Cards']);
    const micro = toBool(struct['Microformats'] ?? r['Microformats']);
    const hreflang = r['Hreflang Links'] && r['Hreflang Links'] !== '-' ? r['Hreflang Links'] : null;
    const amp = toBool(r['AMP link']);
    const blockedAi = toBool(r['Blocked AI search bots']);

    const issuesObj = { ...(mega.issues || {}) };
    if (r['Issues'] && r['Issues'] !== '-' && r['Issues'] !== '0') issuesObj['pages_issues'] = r['Issues'];
    if (r['Hreflang Issues'] && r['Hreflang Issues'] !== '-') issuesObj['hreflang_issues'] = r['Hreflang Issues'];

    const arr = [
      exportDate, url, httpStatus, crawlDepth, loadTime, title, description, canonical,
      inSitemap, inLinks, outLinks, outExtLinks, jsonld, og, twitter, micro, hreflang, amp, blockedAi,
      JSON.stringify(issuesObj), JSON.stringify(r)
    ];
    const ph = arr.map(() => `$${p++}`).join(', ');
    placeholders.push(`(${ph})`);
    values.push(...arr);

    const muRes = await query(
      `INSERT INTO master_urls (url, title, description, canonical, in_sitemap, crawl_depth,
        incoming_links, outgoing_links, outgoing_external_links, jsonld, og, twitter,
        hreflang, blocked_ai, http_status_code, load_time_ms, issues, issues_count, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18, NOW())
       ON CONFLICT (url) DO UPDATE SET
         title = COALESCE(EXCLUDED.title, master_urls.title),
         description = COALESCE(EXCLUDED.description, master_urls.description),
         canonical = COALESCE(EXCLUDED.canonical, master_urls.canonical),
         in_sitemap = COALESCE(EXCLUDED.in_sitemap, master_urls.in_sitemap),
         crawl_depth = COALESCE(EXCLUDED.crawl_depth, master_urls.crawl_depth),
         incoming_links = GREATEST(EXCLUDED.incoming_links, master_urls.incoming_links),
         outgoing_links = GREATEST(EXCLUDED.outgoing_links, master_urls.outgoing_links),
         outgoing_external_links = GREATEST(EXCLUDED.outgoing_external_links, master_urls.outgoing_external_links),
         jsonld = COALESCE(EXCLUDED.jsonld, master_urls.jsonld),
         og = COALESCE(EXCLUDED.og, master_urls.og),
         twitter = COALESCE(EXCLUDED.twitter, master_urls.twitter),
         hreflang = COALESCE(EXCLUDED.hreflang, master_urls.hreflang),
         blocked_ai = COALESCE(EXCLUDED.blocked_ai, master_urls.blocked_ai),
         http_status_code = COALESCE(EXCLUDED.http_status_code, master_urls.http_status_code),
         load_time_ms = COALESCE(EXCLUDED.load_time_ms, master_urls.load_time_ms),
         issues = COALESCE(EXCLUDED.issues, master_urls.issues),
         issues_count = COALESCE(EXCLUDED.issues_count, master_urls.issues_count),
         updated_at = NOW()`,
      [url, title, description, canonical, inSitemap ? 1 : 0, crawlDepth, inLinks, outLinks, outExtLinks,
       jsonld ? 1 : 0, og ? 1 : 0, twitter ? 1 : 0, hreflang, blockedAi ? true : false, httpStatus, loadTime,
       JSON.stringify(issuesObj), Object.keys(issuesObj).length]
    );
    updatedMaster += muRes.rowCount || 0;
  }

  if (placeholders.length > 0) {
    const text = `INSERT INTO site_audit (${cols.join(', ')}) VALUES ${placeholders.join(', ')}
      ON CONFLICT (export_date, page_url) DO UPDATE SET
        http_status_code = EXCLUDED.http_status_code,
        crawl_depth = EXCLUDED.crawl_depth,
        load_time_ms = EXCLUDED.load_time_ms,
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        canonicalization = EXCLUDED.canonicalization,
        in_sitemap = EXCLUDED.in_sitemap,
        incoming_internal_links = EXCLUDED.incoming_internal_links,
        outgoing_internal_links = EXCLUDED.outgoing_internal_links,
        outgoing_external_links = EXCLUDED.outgoing_external_links,
        schema_jsonld = EXCLUDED.schema_jsonld,
        schema_og = EXCLUDED.schema_og,
        schema_twitter = EXCLUDED.schema_twitter,
        schema_microformats = EXCLUDED.schema_microformats,
        hreflang = EXCLUDED.hreflang,
        amp = EXCLUDED.amp,
        blocked_ai = EXCLUDED.blocked_ai,
        issues = EXCLUDED.issues,
        raw_issues = EXCLUDED.raw_issues`;
    const res = await query(text, values);
    inserted = res.rowCount;
  }
  return { inserted, updatedMaster };
}

// 3. Sitemap / Crawl export -> sitemap_crawl
async function importSitemapCrawl(pagesRows, exportDate) {
  const cols = ['export_date','page_url','http_status_code'];
  const values = [];
  const placeholders = [];
  let p = 1;
  for (const r of pagesRows) {
    const url = r['Page URL'];
    if (!url) continue;
    const arr = [exportDate, url, toInt(r['HTTP Status Code'])];
    const ph = arr.map(() => `$${p++}`).join(', ');
    placeholders.push(`(${ph})`);
    values.push(...arr);
  }
  if (placeholders.length === 0) return 0;
  const text = `INSERT INTO sitemap_crawl (${cols.join(', ')}) VALUES ${placeholders.join(', ')}
    ON CONFLICT (page_url) DO UPDATE SET export_date = EXCLUDED.export_date, http_status_code = EXCLUDED.http_status_code`;
  const res = await query(text, values);
  return res.rowCount;
}

export { importKeywords, importSiteAudit, importSitemapCrawl };
