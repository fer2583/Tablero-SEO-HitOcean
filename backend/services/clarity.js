// =============================================================
// Microsoft Clarity Data Export API
// Métricas: page views, recordings, rage clicks, dead clicks
// =============================================================

const CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID || 'W0cjMKViRA6uFxYmp-SLcg';
const CLARITY_TOKEN = process.env.CLARITY_TOKEN || '';

const BASE_URL = 'https://export-api.clarity.microsoft.com';

/**
 * Fetch métricas diarias de Clarity
 */
export async function fetchClarityDaily({ days = 7, startDate, endDate } = {}) {
  if (!CLARITY_TOKEN) {
    console.warn('[Clarity] No token configured');
    return { error: 'CLARITY_TOKEN not configured', daily: [], pages: [] };
  }

  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  try {
    // 1. Métricas generales del proyecto
    const dailyRes = await fetchClarityAPI('/api/v1/projects/daily', {
      startDate: start,
      endDate: end,
      granularity: 'day',
    });

    // 2. Páginas con más rage clicks / dead clicks
    const pagesRes = await fetchClarityAPI('/api/v1/projects/top-pages', {
      startDate: start,
      endDate: end,
      limit: 50,
      orderBy: 'recordings',
    });

    return {
      daily: dailyRes?.data || [],
      pages: pagesRes?.data || [],
      period: { start, end },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[Clarity] Fetch error:', err.message);
    return { error: err.message, daily: [], pages: [] };
  }
}

/**
 * Llamada a la API de Clarity
 */
async function fetchClarityAPI(endpoint, params = {}) {
  const query = new URLSearchParams({
    ...params,
    projectId: CLARITY_PROJECT_ID,
  }).toString();

  const response = await fetch(`${BASE_URL}${endpoint}?${query}`, {
    headers: {
      'Authorization': `Bearer ${CLARITY_TOKEN}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clarity API ${response.status}: ${text.slice(0, 200)}`);
  }

  return response.json();
}

/**
 * Obtener últimos datos de Clarity desde DB (para el frontend)
 */
export async function getLatestData({ days = 7 } = {}) {
  const { query } = await import('../db/client.js');
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT 
      date,
      SUM(page_views) as page_views,
      SUM(users) as users,
      SUM(recordings) as recordings,
      SUM(rage_clicks) as rage_clicks,
      SUM(dead_clicks) as dead_clicks
    FROM clarity_daily 
    WHERE date >= $1 AND date <= $2
    GROUP BY date
    ORDER BY date DESC
  `, [start, end]);

  return result.rows;
}
