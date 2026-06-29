// =============================================================
// API Endpoint: /api/trends
// Datos de tendencia histórica (7, 30, 90 días)
// =============================================================
import { query } from '../db/client.js';

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
    // GSC trends por día
    const gscTrend = await query(`
      SELECT 
        date,
        SUM(clicks) as clicks,
        SUM(impressions) as impressions,
        CASE WHEN SUM(impressions) > 0 
          THEN ROUND(SUM(clicks)::FLOAT / SUM(impressions) * 100, 2)
          ELSE 0 END as ctr
      FROM gsc_daily 
      WHERE date >= $1 AND date <= $2
      GROUP BY date
      ORDER BY date ASC
    `, [start, end]);

    // GA4 trends por día
    const ga4Trend = await query(`
      SELECT 
        date,
        SUM(users) as users,
        SUM(sessions) as sessions,
        SUM(page_views) as page_views
      FROM ga4_daily 
      WHERE date >= $1 AND date <= $2
      GROUP BY date
      ORDER BY date ASC
    `, [start, end]);

    // Clarity trends por día
    const clarityTrend = await query(`
      SELECT 
        date,
        SUM(page_views) as page_views,
        SUM(recordings) as recordings,
        SUM(rage_clicks) as rage_clicks
      FROM clarity_daily 
      WHERE date >= $1 AND date <= $2
      GROUP BY date
      ORDER BY date ASC
    `, [start, end]);

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      days,
      period: { start, end },
      gsc: gscTrend.rows,
      ga4: ga4Trend.rows,
      clarity: clarityTrend.rows,
    }));
  } catch (err) {
    console.error('[Trends API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
