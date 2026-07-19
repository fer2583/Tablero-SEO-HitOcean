// =============================================================
// API: /api/site-health
// Calcula el Site Health Score con datos en vivo de la DB
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

  try {
    // 1. Indexación (GSC)
    const indexingResult = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status IN ('indexed', 'submitted') THEN 1 ELSE 0 END) as indexed
      FROM gsc_indexing
      WHERE date = (SELECT MAX(date) FROM gsc_indexing)
    `).catch(() => ({ rows: [{ total: 0, indexed: 0 }] }));
    const indexingPct = indexingResult.rows[0]?.total > 0
      ? (indexingResult.rows[0].indexed / indexingResult.rows[0].total) * 100
      : 0;

    // 2. Core Web Vitals (PageSpeed - último score)
    const cwvResult = await query(`
      SELECT value FROM snapshots 
      WHERE data->>'type' = 'pagespeed' 
      ORDER BY date DESC LIMIT 1
    `).catch(() => ({ rows: [] }));
    const cwvScore = cwvResult.rows[0]?.value || 0;

    // 3. CTR promedio vs benchmark (~3.5%)
    const ctrResult = await query(`
      SELECT AVG(ctr) as avg_ctr FROM gsc_daily
      WHERE date >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ avg_ctr: 0 }] }));
    const avgCtr = parseFloat(ctrResult.rows[0]?.avg_ctr || 0) * 100;
    const ctrScore = Math.min(100, (avgCtr / 3.5) * 100);

    // 4. Posición promedio
    const posResult = await query(`
      SELECT AVG(position) as avg_pos FROM gsc_daily
      WHERE date >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ avg_pos: 0 }] }));
    const avgPos = parseFloat(posResult.rows[0]?.avg_pos || 10);
    const posScore = Math.max(0, 100 - (avgPos - 1) * 10);

    // 5. Engagement rate (GA4)
    const engagementResult = await query(`
      SELECT AVG(engagement_rate) as avg_engagement FROM ga4_daily
      WHERE date >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ avg_engagement: 0 }] }));
    const engagementRate = parseFloat(engagementResult.rows[0]?.avg_engagement || 0) * 100;

    // 6. UX (Clarity - menos rage/dead clicks es mejor)
    const uxResult = await query(`
      SELECT 
        COALESCE(SUM(rage_clicks), 0) as total_rage,
        COALESCE(SUM(dead_clicks), 0) as total_dead,
        COALESCE(SUM(recordings), 0) as total_recordings
      FROM clarity_daily
      WHERE date >= NOW() - INTERVAL '30 days'
    `).catch(() => ({ rows: [{ total_rage: 0, total_dead: 0, total_recordings: 0 }] }));
    const uxData = uxResult.rows[0];
    const uxIssueRate = uxData.total_recordings > 0
      ? ((uxData.total_rage + uxData.total_dead) / uxData.total_recordings) * 100
      : 0;
    const uxScore = Math.max(0, 100 - uxIssueRate * 10);

    // 7. Keywords en Top 10 (SEMrush)
    const kwResult = await query(`
      SELECT COUNT(*) as top10 FROM semrush_keywords
      WHERE position > 0 AND position <= 10
        AND date = (SELECT MAX(date) FROM semrush_keywords)
    `).catch(() => ({ rows: [{ top10: 0 }] }));
    const keywordsTop10 = parseInt(kwResult.rows[0]?.top10 || 0);

    // Calcular score general (ponderado)
    const scores = {
      indexing: Math.round(indexingPct),
      cwv: Math.min(100, Math.max(0, cwvScore)),
      ctr: Math.round(ctrScore),
      position: Math.round(posScore),
      engagement: Math.round(engagementRate),
      ux: Math.round(uxScore),
      keywords: Math.min(100, Math.round(keywordsTop10 * 2)),
    };

    const weights = {
      indexing: 0.20,
      cwv: 0.20,
      ctr: 0.15,
      position: 0.10,
      engagement: 0.15,
      ux: 0.10,
      keywords: 0.10,
    };

    const totalScore = Math.round(
      Object.keys(scores).reduce((acc, key) => acc + (scores[key] * weights[key]), 0)
    );

    // Guardar snapshot
    await query(`
      INSERT INTO site_health_snapshots 
        (week_start, score, indexing_pct, cwv_score, ctr_vs_benchmark, avg_position, engagement_rate, ux_score, keywords_top10, breakdown)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      getWeekStart(),
      totalScore,
      indexingPct,
      cwvScore,
      avgCtr,
      avgPos,
      engagementRate,
      uxScore,
      keywordsTop10,
      JSON.stringify(scores),
    ]).catch(() => {});

    // Obtener histórico
    const historyResult = await query(`
      SELECT week_start, score FROM site_health_snapshots 
      ORDER BY week_start DESC LIMIT 12
    `).catch(() => ({ rows: [] }));

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      score: totalScore,
      scores,
      weights,
      metrics: {
        indexing_pct: Math.round(indexingPct * 100) / 100,
        avg_ctr: Math.round(avgCtr * 100) / 100,
        avg_position: Math.round(avgPos * 100) / 100,
        engagement_rate: Math.round(engagementRate * 100) / 100,
        ux_issue_rate: Math.round(uxIssueRate * 100) / 100,
        keywords_top10: keywordsTop10,
      },
      history: historyResult.rows.reverse(),
      generatedAt: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[SiteHealth Error]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}

function getWeekStart() {
  const now = new Date();
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(now.setDate(diff));
  return monday.toISOString().split('T')[0];
}
