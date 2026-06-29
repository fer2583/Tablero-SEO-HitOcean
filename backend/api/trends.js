// =============================================================
// API Endpoint: /api/trends
// Tendencia histórica desde APIs en vivo (GSC, GA4, Clarity)
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
  const days = parseInt(searchParams.get('days')) || 180;
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    console.log(`[Trends] Fetching ${days} days from ${start} to ${end}`);

    // ─── GSC trends ───────────────────────────────────
    let gsc = [];
    try {
      const gscData = await fetchGSCTrends({ days });
      // GSC retorna { byUrl, byQuery, detailed } con rows que tienen { date, clicks, impressions, ctr }
      const allRows = [
        ...(gscData.byUrl || []),
        ...(gscData.byQuery || []),
        ...(gscData.detailed || []),
      ];
      // Agrupar por fecha
      const byDate = {};
      for (const row of allRows) {
        if (!row.date) continue;
        if (!byDate[row.date]) byDate[row.date] = { clicks: 0, impressions: 0 };
        byDate[row.date].clicks += row.clicks || 0;
        byDate[row.date].impressions += row.impressions || 0;
      }
      gsc = Object.entries(byDate)
        .map(([date, vals]) => ({
          date,
          clicks: vals.clicks,
          impressions: vals.impressions,
          ctr: vals.impressions > 0 ? +((vals.clicks / vals.impressions) * 100).toFixed(2) : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      console.warn('[Trends] GSC error:', e.message);
    }

    // ─── GA4 trends ───────────────────────────────────
    let ga4 = [];
    try {
      const ga4Data = await fetchGA4Daily({ days });
      const daily = Array.isArray(ga4Data) ? [] : (ga4Data.daily || []);
      ga4 = daily.map(d => ({
        date: d.date || '',
        users: parseInt(d.totalUsers) || 0,
        sessions: parseInt(d.sessions) || 0,
        page_views: parseInt(d.screenPageViews) || 0,
      })).filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      console.warn('[Trends] GA4 error:', e.message);
    }

    // ─── Clarity trends ───────────────────────────────
    let clarity = [];
    try {
      const clarityData = await fetchClarityDaily({ days });
      clarity = (clarityData?.daily || []).map(d => ({
        date: d.date || '',
        page_views: d.page_views || 0,
        recordings: d.recordings || 0,
        rage_clicks: d.rage_clicks || 0,
      })).filter(d => d.date).sort((a, b) => a.date.localeCompare(b.date));
    } catch (e) {
      console.warn('[Trends] Clarity error:', e.message);
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      days,
      period: { start, end },
      gsc,
      ga4,
      clarity,
    }));
  } catch (err) {
    console.error('[Trends API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
