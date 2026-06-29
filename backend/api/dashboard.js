// =============================================================
// API Endpoint: /api/dashboard
// Todo consolidado desde APIs directas (GSC, GA4, Clarity)
// =============================================================
import { fetchGSCTrends } from '../services/gsc.js';
import { fetchGA4Daily } from '../services/ga4.js';
import { fetchClarityDaily } from '../services/clarity.js';

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const days = parseInt(searchParams.get('days')) || 30;
  let gsc = null, ga4 = null, clarity = null;

  // Llamar a las APIs directamente (no desde DB)
  try { gsc = await fetchGSCTrends({ days }); } catch (e) { gsc = { error: e.message, byUrl: [] }; }
  try { ga4 = await fetchGA4Daily({ days }); } catch (e) { ga4 = { error: e.message, daily: [] }; }
  try { clarity = await fetchClarityDaily({ days }); } catch (e) { clarity = { error: e.message, daily: [] }; }

  // Calcular KPIs desde GSC
  const gscRows = gsc?.byUrl || [];
  const gscTotal = {
    clicks: gscRows.reduce((a, r) => a + (r.clicks || 0), 0),
    impressions: gscRows.reduce((a, r) => a + (r.impressions || 0), 0),
    avgPosition: gscRows.length > 0
      ? (gscRows.reduce((a, r) => a + (r.position || 0), 0) / gscRows.length).toFixed(1)
      : '0.0',
  };

  // Calcular KPIs desde GA4
  const ga4Rows = ga4?.daily || [];
  const ga4Total = ga4Rows.reduce((a, r) => ({
    users: a.users + (r.totalUsers || r.users || 0),
    sessions: a.sessions + (r.sessions || 0),
    pageViews: a.pageViews + (r.pageViews || r.page_views || 0),
  }), { users: 0, sessions: 0, pageViews: 0 });

  // Calcular KPIs desde Clarity
  const clarityRows = clarity?.daily || [];
  const clarityTotal = clarityRows.reduce((a, r) => ({
    pageViews: a.pageViews + (r.pageViews || r.page_views || 0),
    recordings: a.recordings + (r.recordings || 0),
    rageClicks: a.rageClicks + (r.rageClicks || r.rage_clicks || 0),
  }), { pageViews: 0, recordings: 0, rageClicks: 0 });

  // Top URLs por clics
  const topUrls = gscRows
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 20)
    .map(r => ({ url: r.url, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position }));

  // Top queries
  const topQueries = (gsc?.byQuery || [])
    .sort((a, b) => (b.clicks || 0) - (a.clicks || 0))
    .slice(0, 30);

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({
    ok: true,
    kpis: {
      gsc_clicks: gscTotal.clicks,
      gsc_impressions: gscTotal.impressions,
      gsc_avg_position: gscTotal.avgPosition,
      gsc_avg_ctr: gscTotal.impressions > 0
        ? ((gscTotal.clicks / gscTotal.impressions) * 100).toFixed(2)
        : '0.00',
      gsc_urls: gscRows.length,
      ga4_users: ga4Total.users,
      ga4_sessions: ga4Total.sessions,
      ga4_page_views: ga4Total.pageViews,
      clarity_recordings: clarityTotal.recordings,
      clarity_rage_clicks: clarityTotal.rageClicks,
      period_days: days,
      last_updated: new Date().toISOString(),
    },
    top_urls: topUrls,
    top_queries: topQueries,
    trends: {
      gsc: gsc?.byUrl || [],
      ga4: ga4?.daily || [],
      clarity: clarity?.daily || [],
    },
    alerts: [],
    period: gsc?.period || { start: '', end: '' },
    generatedAt: new Date().toISOString(),
  }));
}
