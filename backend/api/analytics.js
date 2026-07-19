// =============================================================
// API consolida: /api/analytics
// Maneja dashboard, trends, gsc, ga4, clarity, alerts, pagespeed, debug
// (Vercel Hobby limita a 12 Serverless Functions: consolidamos aca)
// =============================================================
import { fetchGSCTrends, fetchIndexCoverage, getLatestData, detectAlerts } from '../services/gsc.js';
import { fetchGA4Daily, getLatestData as ga4Latest, getTopPages } from '../services/ga4.js';
import { fetchClarityDaily, getLatestData as clarityLatest } from '../services/clarity.js';
import { auditPage } from '../services/pagespeed.js';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function send(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify(obj));
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname.replace(/\.js$/, ''); // /api/pagespeed.js -> /api/pagespeed
  const sp = url.searchParams;
  const days = parseInt(sp.get('days')) || 30;
  const mode = sp.get('mode') || 'trends';

  try {
    // ─── /api/dashboard ───────────────────────────────
    if (path.endsWith('/dashboard')) {
      let gsc = null, ga4 = null, clarity = null;
      try { gsc = await fetchGSCTrends({ days }); } catch (e) { gsc = { error: e.message, byUrl: [] }; }
      try { ga4 = await fetchGA4Daily({ days }); } catch (e) { ga4 = { error: e.message, daily: [] }; }
      try { clarity = await fetchClarityDaily({ days }); } catch (e) { clarity = { error: e.message, daily: [] }; }

      const gscRows = gsc?.byUrl || [];
      const gscTotal = {
        clicks: gscRows.reduce((a, r) => a + (r.clicks || 0), 0),
        impressions: gscRows.reduce((a, r) => a + (r.impressions || 0), 0),
        avgPosition: gscRows.length > 0 ? (gscRows.reduce((a, r) => a + (r.position || 0), 0) / gscRows.length).toFixed(1) : '0.0',
      };
      const ga4Rows = ga4?.daily || [];
      const ga4Total = ga4Rows.reduce((a, r) => ({
        users: a.users + (r.totalUsers || r.users || 0),
        sessions: a.sessions + (r.sessions || 0),
        pageViews: a.pageViews + (r.pageViews || r.page_views || 0),
      }), { users: 0, sessions: 0, pageViews: 0 });
      const clarityRows = clarity?.daily || [];
      const clarityTotal = clarityRows.reduce((a, r) => ({
        pageViews: a.pageViews + (r.pageViews || r.page_view || 0),
        recordings: a.recordings + (r.recordings || 0),
        rageClicks: a.rageClicks + (r.rageClicks || r.rage_clicks || 0),
      }), { pageViews: 0, recordings: 0, rageClicks: 0 });

      const topUrls = gscRows.sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 20)
        .map(r => ({ url: r.url, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));
      const topQueries = (gsc?.byQuery || []).sort((a, b) => (b.clicks || 0) - (a.clicks || 0)).slice(0, 30);

      return send(res, 200, {
        ok: true,
        kpis: {
          gsc_clicks: gscTotal.clicks, gsc_impressions: gscTotal.impressions, gsc_avg_position: gscTotal.avgPosition,
          gsc_avg_ctr: gscTotal.impressions > 0 ? ((gscTotal.clicks / gscTotal.impressions) * 100).toFixed(2) : '0.00',
          gsc_urls: gscRows.length, ga4_users: ga4Total.users, ga4_sessions: ga4Total.sessions, ga4_page_views: ga4Total.pageViews,
          clarity_recordings: clarityTotal.recordings, clarity_rage_clicks: clarityTotal.rageClicks,
          period_days: days, last_updated: new Date().toISOString(),
        },
        top_urls: topUrls, top_queries: topQueries,
        trends: { gsc: gsc?.byUrl || [], ga4: ga4?.daily || [], clarity: clarity?.daily || [] },
        alerts: [], period: gsc?.period || { start: '', end: '' }, generatedAt: new Date().toISOString(),
      });
    }

    // ─── /api/trends ───────────────────────────────────
    if (path.endsWith('/trends')) {
      const end = new Date().toISOString().split('T')[0];
      const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
      let gsc = [], ga4 = [], clarity = [];
      try {
        const gscData = await fetchGSCTrends({ days });
        const allRows = [...(gscData.byUrl || []), ...(gscData.byQuery || []), ...(gscData.detailed || [])];
        const byDate = {};
        for (const row of allRows) {
          if (!row.date) continue;
          if (!byDate[row.date]) byDate[row.date] = { clicks: 0, impressions: 0 };
          byDate[row.date].clicks += row.clicks || 0;
          byDate[row.date].impressions += row.impressions || 0;
        }
        gsc = Object.entries(byDate).map(([date, v]) => ({
          date, clicks: v.clicks, impressions: v.impressions,
          ctr: v.impressions > 0 ? +((v.clicks / v.impressions) * 100).toFixed(2) : 0,
        })).sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) { console.warn('[Trends] GSC:', e.message); }
      try {
        const ga4Data = await fetchGA4Daily({ days });
        const daily = Array.isArray(ga4Data) ? [] : (ga4Data.daily || []);
        ga4 = daily.map(d => ({ date: d.date || '', users: parseInt(d.totalUsers) || 0, sessions: parseInt(d.sessions) || 0, page_views: parseInt(d.screenPageViews) || 0 }))
          .filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) { console.warn('[Trends] GA4:', e.message); }
      try {
        const clarityData = await fetchClarityDaily({ days });
        clarity = (clarityData?.daily || []).map(d => ({ date: d.date || '', page_views: d.page_views || 0, recordings: d.recordings || 0, rage_clicks: d.rage_clicks || 0 }))
          .filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
      } catch (e) { console.warn('[Trends] Clarity:', e.message); }
      return send(res, 200, { ok: true, days, period: { start, end }, gsc, ga4, clarity });
    }

    // ─── /api/gsc ──────────────────────────────────────
    if (path.endsWith('/gsc')) {
      let data;
      if (mode === 'indexing') data = await fetchIndexCoverage();
      else if (mode === 'latest') data = await getLatestData({ days });
      else data = await fetchGSCTrends({ days });
      return send(res, 200, { ok: true, mode, days, ...data });
    }

    // ─── /api/ga4 ──────────────────────────────────────
    if (path.endsWith('/ga4')) {
      let data;
      if (mode === 'latest') data = await ga4Latest({ days });
      else if (mode === 'pages') data = await getTopPages({ days });
      else data = await fetchGA4Daily({ days });
      return send(res, 200, { ok: true, mode, days, ...data });
    }

    // ─── /api/clarity ──────────────────────────────────
    if (path.endsWith('/clarity')) {
      let data;
      if (mode === 'latest') data = await clarityLatest({ days });
      else data = await fetchClarityDaily({ days });
      return send(res, 200, { ok: true, mode, days, ...data });
    }

    // ─── /api/alerts ───────────────────────────────────
    if (path.endsWith('/alerts')) {
      let alerts = [];
      if (mode === 'detect' || mode === 'active') {
        try { const result = await detectAlerts(); alerts = result?.alerts || []; } catch (e) { console.warn('[Alerts]:', e.message); }
      }
      return send(res, 200, { ok: true, count: alerts.slice(0, 50).length, alerts: alerts.slice(0, 50) });
    }

    // ─── /api/pagespeed ────────────────────────────────
    if (path.endsWith('/pagespeed')) {
      const psUrl = sp.get('url');
      const strategy = sp.get('strategy') || 'mobile';
      const psMode = sp.get('mode') || 'single';
      let data;
      if (psMode === 'single' && psUrl) data = await auditPage(psUrl, strategy);
      else if (psMode === 'homepage') data = await auditPage('https://hitocean.com', strategy);
      else return send(res, 400, { ok: false, error: 'Especificá ?url= o mode=homepage' });
      return send(res, 200, { ok: true, ...data });
    }

    // ─── /api/debug ────────────────────────────────────
    if (path.endsWith('/debug')) {
      const envVars = {
        DATABASE_URL: process.env.DATABASE_URL ? '✅ SET' : '❌ NOT SET',
        GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID || '❌ NOT SET',
        GSC_SITE_URL: process.env.GSC_SITE_URL || '❌ NOT SET',
        CLARITY_PROJECT_ID: process.env.CLARITY_PROJECT_ID || '❌ NOT SET',
        VERCEL_ENV: process.env.VERCEL_ENV || '❌ NOT SET',
      };
      return send(res, 200, { ok: true, env: envVars });
    }

    return send(res, 404, { ok: false, error: 'Ruta no encontrada: ' + path });
  } catch (err) {
    console.error('[Analytics API]', err.message);
    return send(res, 500, { ok: false, error: err.message });
  }
}
