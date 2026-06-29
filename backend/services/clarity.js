// =============================================================
// Microsoft Clarity Data Export API
// Documentación oficial:
// https://learn.microsoft.com/en-us/clarity/setup-and-installation/clarity-data-export-api
//
// Endpoint: GET https://www.clarity.ms/export-data/api/v1/project-live-insights
// Parámetros: numOfDays (1|2|3), dimension1, dimension2, dimension3
// Máximo 10 requests/día/proyecto
// Solo devuelve datos de los últimos 1-3 días
// =============================================================

const CLARITY_PROJECT_ID = process.env.CLARITY_PROJECT_ID || '';
const CLARITY_TOKEN = process.env.CLARITY_TOKEN || '';

const BASE_URL = 'https://www.clarity.ms';
const ENDPOINT = '/export-data/api/v1/project-live-insights';

/**
 * Fetch métricas de Clarity (últimos 1-3 días, es el máximo que ofrece la API)
 */
export async function fetchClarityDaily({ days = 1, startDate, endDate } = {}) {
  if (!CLARITY_TOKEN) {
    console.warn('[Clarity] No token configured');
    return { error: 'CLARITY_TOKEN not configured', daily: [], pages: [] };
  }

  // La API solo acepta 1, 2 o 3 días
  const numOfDays = Math.min(Math.max(days, 1), 3);

  try {
    // Una sola llamada con dimensión URL para obtener todo en 1 request (quota: 10/día)
    const apiRes = await fetchClarityAPI({
      numOfDays,
      dimension1: 'URL',
    });

    // Transformar respuesta a formato uniforme
    const daily = parseMetrics(apiRes);
    const pages = parsePages(apiRes);

    return {
      daily,
      pages,
      period: {
        start: new Date(Date.now() - numOfDays * 86400000).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0],
      },
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
async function fetchClarityAPI(params = {}) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, String(value));
    }
  });

  const url = `${BASE_URL}${ENDPOINT}?${query.toString()}`;
  console.log('[Clarity] Fetching:', url.replace(CLARITY_TOKEN, '***'));

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${CLARITY_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Clarity API ${response.status}: ${text.slice(0, 300)}`);
  }

  return response.json();
}

/**
 * Parsear respuesta de métricas a formato daily
 * Suma entre filas porque la respuesta viene dimensionada por URL
 */
function parseMetrics(data) {
  if (!Array.isArray(data)) return [];

  const totals = {};
  const today = new Date().toISOString().split('T')[0];

  data.forEach(metric => {
    const info = metric.information || [];

    info.forEach(row => {
      // Sumar todas las filas (cada fila = una URL)
      totals.totalSessionCount = (totals.totalSessionCount || 0) + (parseInt(row.totalSessionCount) || 0);
      totals.totalBotSessionCount = (totals.totalBotSessionCount || 0) + (parseInt(row.totalBotSessionCount) || 0);
      totals.distantUserCount = (totals.distantUserCount || 0) + (parseInt(row.distantUserCount) || 0);
    });
  });

  return [{
    date: today,
    page_views: totals.totalSessionCount || 0,
    users: totals.distantUserCount || 0,
    recordings: 0,
    rage_clicks: 0,
    dead_clicks: 0,
  }];
}

/**
 * Parsear respuesta de páginas
 */
function parsePages(data) {
  if (!Array.isArray(data)) return [];

  // Buscar el bloque de tráfico por URL
  const trafficMetric = data.find(m => m.metricName === 'Traffic');
  if (!trafficMetric || !trafficMetric.information) return [];

  return trafficMetric.information.map(row => ({
    url: row.URL || '(unknown)',
    sessions: parseInt(row.totalSessionCount) || 0,
    botSessions: parseInt(row.totalBotSessionCount) || 0,
    users: parseInt(row.distantUserCount) || 0,
    pagesPerSession: parseFloat(row.PagesPerSessionPercentage) || 0,
  })).sort((a, b) => b.sessions - a.sessions);
}

/**
 * Obtener últimos datos de Clarity desde DB (para el frontend)
 */
export async function getLatestData({ days = 7 } = {}) {
  try {
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
  } catch (err) {
    console.warn('[Clarity] DB not available:', err.message);
    return [];
  }
}
