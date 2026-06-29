// =============================================================
// API Endpoint: /api/dashboard
// Todo consolidado para el frontend en una sola llamada
// =============================================================
import { getLatestData as getGSC, detectAlerts } from '../services/gsc.js';
import { getLatestData as getGA4 } from '../services/ga4.js';
import { getLatestData as getClarity } from '../services/clarity.js';
import { initSchema } from '../db/client.js';

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
  const days = parseInt(searchParams.get('days')) || 7;

  // Inicializar schema si no existe
  try { await initSchema(); } catch (e) {}

  let gsc = [], ga4 = [], clarity = [], alerts = [];
  let gscError = null, ga4Error = null, clarityError = null;

  // Cada fuente por separado para que no rompa todo
  try { gsc = await getGSC({ days }); } catch (e) { gscError = e.message; }
  try { ga4 = await getGA4({ days }); } catch (e) { ga4Error = e.message; }
  try { clarity = await getClarity({ days }); } catch (e) { clarityError = e.message; }
  try { alerts = await detectAlerts(); } catch (e) { /* alerts no crítico */ }

  // KPIs
  const gscTotal = (gsc || []).reduce((acc, r) => ({
    clicks: (acc.clicks || 0) + parseInt(r.total_clicks || r.clicks || 0),
    impressions: (acc.impressions || 0) + parseInt(r.total_impressions || r.impressions || 0),
  }), {});

  const ga4Total = (ga4 || []).reduce((acc, r) => ({
    users: (acc.users || 0) + parseInt(r.users || r.totalUsers || 0),
    sessions: (acc.sessions || 0) + parseInt(r.sessions || 0),
    pageViews: (acc.page_views || 0) + parseInt(r.page_views || r.pageViews || 0),
  }), {});

  const clarityTotal = (clarity || []).reduce((acc, r) => ({
    pageViews: (acc.pageViews || 0) + parseInt(r.page_views || r.pageViews || 0),
    recordings: (acc.recordings || 0) + parseInt(r.recordings || 0),
    rageClicks: (acc.rage_clicks || 0) + parseInt(r.rage_clicks || 0),
  }), {});

  const kpis = {
    gsc_clicks: gscTotal.clicks || 0,
    gsc_impressions: gscTotal.impressions || 0,
    gsc_avg_ctr: gscTotal.impressions > 0
      ? ((gscTotal.clicks / gscTotal.impressions) * 100).toFixed(2)
      : '0.00',
    ga4_users: ga4Total.users || 0,
    ga4_sessions: ga4Total.sessions || 0,
    ga4_page_views: ga4Total.pageViews || 0,
    clarity_recordings: clarityTotal.recordings || 0,
    clarity_rage_clicks: clarityTotal.rageClicks || 0,
    alerts_count: (alerts || []).length,
    alerts_critical: (alerts || []).filter(a => a.severity === 'critical').length,
    alerts_high: (alerts || []).filter(a => a.severity === 'high').length,
    period_days: days,
    last_updated: new Date().toISOString(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({
    ok: true, kpis, alerts,
    trends: { gsc, ga4, clarity },
    errors: { gsc: gscError, ga4: ga4Error, clarity: clarityError },
    generatedAt: new Date().toISOString(),
  }));
}
