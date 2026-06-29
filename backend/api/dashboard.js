// =============================================================
// API Endpoint: /api/dashboard
// Todo consolidado para el frontend en una sola llamada
// =============================================================
import { getLatestData as getGSC } from '../services/gsc.js';
import { getLatestData as getGA4 } from '../services/ga4.js';
import { getLatestData as getClarity } from '../services/clarity.js';
import { detectAlerts } from '../services/gsc.js';

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

  try {
    const [gsc, ga4, clarity, alerts] = await Promise.all([
      getGSC({ days }),
      getGA4({ days }),
      getClarity({ days }),
      detectAlerts(),
    ]);

    // Consolidar KPIs principales
    const gscTotal = gsc.reduce((acc, r) => ({
      clicks: (acc.clicks || 0) + parseInt(r.total_clicks || 0),
      impressions: (acc.impressions || 0) + parseInt(r.total_impressions || 0),
    }), {});

    const ga4Total = ga4.reduce((acc, r) => ({
      users: (acc.users || 0) + parseInt(r.users || 0),
      sessions: (acc.sessions || 0) + parseInt(r.sessions || 0),
      pageViews: (acc.page_views || 0) + parseInt(r.page_views || 0),
    }), {});

    const clarityTotal = clarity.reduce((acc, r) => ({
      pageViews: (acc.pageViews || 0) + parseInt(r.page_views || 0),
      recordings: (acc.recordings || 0) + parseInt(r.recordings || 0),
      rageClicks: (acc.rage_clicks || 0) + parseInt(r.rage_clicks || 0),
    }), {});

    const today = new Date().toISOString().split('T')[0];
    const todayStr = today;

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
      alerts_count: alerts.length,
      alerts_critical: alerts.filter(a => a.severity === 'critical').length,
      alerts_high: alerts.filter(a => a.severity === 'high').length,
      period_days: days,
      last_updated: new Date().toISOString(),
    };

    const response = {
      ok: true,
      kpis,
      trends: {
        gsc,
        ga4,
        clarity,
      },
      alerts,
      generatedAt: new Date().toISOString(),
    };

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify(response));
  } catch (err) {
    console.error('[Dashboard API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
