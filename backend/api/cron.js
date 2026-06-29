// =============================================================
// API Endpoint: /api/cron/*  (Vercel Cron Jobs)
// - /api/cron/daily  → 6 AM cada día
// - /api/cron/weekly → 7 AM cada domingo
// =============================================================
import { fetchGSCTrends } from '../services/gsc.js';
import { fetchGA4Daily } from '../services/ga4.js';
import { fetchClarityDaily } from '../services/clarity.js';
import { insertMany, query, initSchema } from '../db/client.js';

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  // Verificar CRON_SECRET (opcional, para seguridad)
  const { searchParams } = new URL(req.url, `http://${req.headers.host}`);
  const secret = searchParams.get('secret');
  const expectedSecret = process.env.CRON_SECRET;

  if (expectedSecret && secret !== expectedSecret) {
    res.writeHead(401, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: 'Unauthorized' }));
    return;
  }

  const path = req.url.split('?')[0];
  const task = path.split('/').pop();

  try {
    switch (task) {
      case 'daily':
        return await runDaily(res, corsHeaders);
      case 'weekly':
        return await runWeekly(res, corsHeaders);
      default:
        res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
        res.end(JSON.stringify({ ok: false, error: `Unknown task: ${task}` }));
    }
  } catch (err) {
    console.error('[Cron] Error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

/**
 * Cron diario: 6 AM
 * Fetch de todas las fuentes y guardar en DB
 */
async function runDaily(res, headers) {
  console.log('[Cron] Starting daily sync...');
  const results = { gsc: null, ga4: null, clarity: null };
  const errors = [];

  // 1. Inicializar schema si no existe
  try {
    await initSchema();
  } catch (e) {
    console.warn('[Cron] Schema init:', e.message);
  }

  // 2. GSC - últimos 7 días (para tener datos aunque falte un día)
  try {
    console.log('[Cron] Fetching GSC...');
    const gscData = await fetchGSCTrends({ days: 7 });
    if (gscData.byUrl?.length > 0) {
      const rows = gscData.byUrl.map(r => ({
        url: r.url,
        query: r.query,
        date: r.date || new Date().toISOString().split('T')[0],
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));
      await insertMany('gsc_daily', rows);
      results.gsc = rows.length;
      console.log(`[Cron] GSC: ${rows.length} rows inserted`);
    }
  } catch (e) {
    errors.push(`GSC: ${e.message}`);
    console.error('[Cron] GSC error:', e.message);
  }

  // 3. GA4
  try {
    console.log('[Cron] Fetching GA4...');
    const ga4Data = await fetchGA4Daily({ days: 7 });
    if (ga4Data.daily?.length > 0) {
      const rows = ga4Data.daily.map(r => ({
        date: r.date || new Date().toISOString().split('T')[0],
        users: r.totalUsers || 0,
        new_users: r.newUsers || 0,
        sessions: r.sessions || 0,
        page_views: r.pageViews || 0,
        engagement_rate: r.engagementRate || 0,
        avg_session_duration: r.avgSessionDuration || 0,
        bounce_rate: r.bounceRate || 0,
      }));
      await insertMany('ga4_daily', rows);
      results.ga4 = rows.length;
      console.log(`[Cron] GA4: ${rows.length} rows inserted`);
    }

    // Páginas populares
    if (ga4Data.pages?.length > 0) {
      const pageRows = ga4Data.pages.map(r => ({
        date: r.date || new Date().toISOString().split('T')[0],
        url: r.pagePath || '',
        page_views: r.pageViews || 0,
        users: r.totalUsers || 0,
        avg_time_on_page: r.avgSessionDuration || 0,
      }));
      await insertMany('ga4_pages', pageRows);
    }
  } catch (e) {
    errors.push(`GA4: ${e.message}`);
    console.error('[Cron] GA4 error:', e.message);
  }

  // 4. Clarity
  try {
    console.log('[Cron] Fetching Clarity...');
    const clarityData = await fetchClarityDaily({ days: 7 });
    if (clarityData.daily?.length > 0) {
      const rows = clarityData.daily.map(r => ({
        date: r.date || new Date().toISOString().split('T')[0],
        project_id: process.env.CLARITY_PROJECT_ID || '',
        page_views: r.pageViews || r.page_views || 0,
        users: r.users || 0,
        recordings: r.recordings || 0,
        rage_clicks: r.rageClicks || r.rage_clicks || 0,
        dead_clicks: r.deadClicks || r.dead_clicks || 0,
        avg_time_on_page: r.avgTimeOnPage || 0,
      }));
      await insertMany('clarity_daily', rows);
      results.clarity = rows.length;
      console.log(`[Cron] Clarity: ${rows.length} rows inserted`);
    }
  } catch (e) {
    errors.push(`Clarity: ${e.message}`);
    console.error('[Cron] Clarity error:', e.message);
  }

  // 5. Log de sincronización
  try {
    await query(`
      INSERT INTO sync_log (source, status, started_at, finished_at, rows_inserted, error_message)
      VALUES ('daily_cron', $1, NOW() - interval '5 minutes', NOW(), $2, $3)
    `, [
      errors.length > 0 ? 'error' : 'success',
      (results.gsc || 0) + (results.ga4 || 0) + (results.clarity || 0),
      errors.join('; ') || null,
    ]);
  } catch (e) {
    console.warn('[Cron] Log error:', e.message);
  }

  res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
  res.end(JSON.stringify({
    ok: errors.length === 0,
    results,
    errors: errors.length > 0 ? errors : undefined,
    timestamp: new Date().toISOString(),
  }));
}

/**
 * Cron semanal: Domingo 7 AM
 * Generar snapshot del estado completo del sitio
 */
async function runWeekly(res, headers) {
  console.log('[Cron] Generating weekly snapshot...');

  try {
    // Obtener datos agregados de la semana
    const weekStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const [gscAgg, ga4Agg, clarityAgg] = await Promise.all([
      query(`
        SELECT 
          SUM(clicks) as total_clicks,
          SUM(impressions) as total_impressions,
          AVG(ctr) as avg_ctr,
          AVG(position) as avg_position,
          COUNT(DISTINCT url) as total_urls
        FROM gsc_daily WHERE date >= $1 AND date <= $2
      `, [weekStart, today]),
      query(`
        SELECT 
          SUM(users) as total_users,
          SUM(sessions) as total_sessions,
          SUM(page_views) as total_page_views
        FROM ga4_daily WHERE date >= $1 AND date <= $2
      `, [weekStart, today]),
      query(`
        SELECT 
          SUM(page_views) as total_page_views,
          SUM(recordings) as total_recordings,
          SUM(rage_clicks) as total_rage_clicks
        FROM clarity_daily WHERE date >= $1 AND date <= $2
      `, [weekStart, today]),
    ]);

    const snapshot = {
      week_start: weekStart,
      week_end: today,
      gsc: gscAgg.rows[0] || {},
      ga4: ga4Agg.rows[0] || {},
      clarity: clarityAgg.rows[0] || {},
      generated_at: new Date().toISOString(),
    };

    await query(`
      INSERT INTO snapshots (week_start, data) VALUES ($1, $2)
    `, [weekStart, JSON.stringify(snapshot)]);

    console.log('[Cron] Weekly snapshot saved');

    res.writeHead(200, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify({
      ok: true,
      message: 'Weekly snapshot generated',
      snapshot,
    }));
  } catch (err) {
    console.error('[Cron] Weekly error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...headers });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
