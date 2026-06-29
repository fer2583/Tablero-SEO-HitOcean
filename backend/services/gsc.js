// =============================================================
// Google Search Console API v1
// Métricas: clics, impresiones, CTR, posición, indexación
// =============================================================
import { google } from 'googleapis';
import { getGSCAuth } from '../lib/auth.js';

const SITE_URL = process.env.GSC_SITE_URL || 'https://hitocean.com';

/**
 * Fetch datos de rendimiento de GSC (últimos N días)
 */
export async function fetchGSCTrends({ days = 7, startDate, endDate } = {}) {
  const auth = getGSCAuth();
  if (!auth) {
    console.warn('[GSC] No auth available');
    return [];
  }

  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const webmasters = google.webmasters({ version: 'v3', auth });

  // 1. Datos por URL (top 5000)
  const urlData = await fetchPaginated(webmasters, {
    siteUrl: SITE_URL,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ['page', 'date'],
      rowLimit: 5000,
    },
  });

  // 2. Datos por query (top 500)
  const queryData = await fetchPaginated(webmasters, {
    siteUrl: SITE_URL,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ['query', 'date'],
      rowLimit: 500,
    },
  });

  // 3. Datos por query + URL (top 1000)
  const detailedData = await fetchPaginated(webmasters, {
    siteUrl: SITE_URL,
    requestBody: {
      startDate: start,
      endDate: end,
      dimensions: ['query', 'page', 'date'],
      rowLimit: 1000,
    },
  });

  return {
    byUrl: urlData.map(normalizeRow),
    byQuery: queryData.map(normalizeRow),
    detailed: detailedData.map(normalizeRow),
    period: { start, end },
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Fetch cobertura de indexación
 */
export async function fetchIndexCoverage() {
  const auth = getGSCAuth();
  if (!auth) return [];

  const webmasters = google.webmasters({ version: 'v3', auth });

  try {
    const res = await webmasters.sites.get({
      siteUrl: SITE_URL,
    });

    // El API de cobertura requiere sitemaps
    const sitemaps = await webmasters.sitemaps.list({
      siteUrl: SITE_URL,
    });

    return {
      site: res.data,
      sitemaps: sitemaps.data?.sitemap || [],
    };
  } catch (err) {
    console.error('[GSC] Index coverage error:', err.message);
    return { error: err.message };
  }
}

/**
 * Fetch con paginación automática
 */
async function fetchPaginated(webmasters, params, maxPages = 4) {
  let allRows = [];
  let startRow = 0;

  for (let page = 0; page < maxPages; page++) {
    try {
      const res = await webmasters.searchanalytics.query({
        ...params,
        requestBody: {
          ...params.requestBody,
          startRow,
        },
      });

      const rows = res.data.rows || [];
      if (rows.length === 0) break;

      allRows = allRows.concat(rows);
      startRow += rows.length;

      if (rows.length < 25000) break; // última página
    } catch (err) {
      console.error('[GSC] Pagination error:', err.message);
      break;
    }
  }

  return allRows;
}

/**
 * Normalizar fila de GSC a formato estándar
 */
function normalizeRow(row) {
  const [dim1, dim2, dim3] = row.keys || [];

  return {
    url: dim1 || '',
    query: dim2 || dim1 || '',
    date: dim3 || dim2 || '',
    clicks: row.clicks || 0,
    impressions: row.impressions || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  };
}

/**
 * Obtener últimos datos de GSC desde DB (para el frontend)
 */
export async function getLatestData({ days = 7 } = {}) {
  const { query } = await import('../db/client.js');
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT 
      url,
      SUM(clicks) as total_clicks,
      SUM(impressions) as total_impressions,
      CASE WHEN SUM(impressions) > 0 
        THEN ROUND(SUM(clicks)::FLOAT / SUM(impressions) * 100, 2)
        ELSE 0 END as avg_ctr,
      ROUND(AVG(position), 1) as avg_position,
      COUNT(*) as days_with_data
    FROM gsc_daily 
    WHERE date >= $1 AND date <= $2
    GROUP BY url
    ORDER BY total_clicks DESC
    LIMIT 500
  `, [start, end]);

  return result.rows;
}

/**
 * Alertas basadas en datos de GSC
 */
export async function detectAlerts() {
  const { query } = await import('../db/client.js');
  const alerts = [];

  // 1. URLs con caída de CTR > 20% vs semana anterior
  const ctrAlerts = await query(`
    WITH current AS (
      SELECT url, AVG(ctr) as avg_ctr, AVG(position) as avg_pos
      FROM gsc_daily WHERE date >= CURRENT_DATE - 7
      GROUP BY url
    ),
    previous AS (
      SELECT url, AVG(ctr) as avg_ctr, AVG(position) as avg_pos
      FROM gsc_daily WHERE date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7
      GROUP BY url
    )
    SELECT 
      c.url, c.avg_ctr as current_ctr, p.avg_ctr as previous_ctr,
      c.avg_pos as current_pos, p.avg_pos as previous_pos
    FROM current c JOIN previous p ON c.url = p.url
    WHERE p.avg_ctr > 0 
      AND (c.avg_ctr - p.avg_ctr) / p.avg_ctr < -0.2
    ORDER BY (c.avg_ctr - p.avg_ctr) / p.avg_ctr ASC
    LIMIT 20
  `);

  for (const row of ctrAlerts.rows) {
    alerts.push({
      type: 'drop_ctr',
      severity: 'high',
      title: 'Caída de CTR detectada',
      message: `CTR bajó de ${(row.previous_ctr * 100).toFixed(1)}% a ${(row.current_ctr * 100).toFixed(1)}%`,
      url: row.url,
      current_value: row.current_ctr,
      previous_value: row.previous_ctr,
    });
  }

  // 2. URLs que perdieron posición
  const posAlerts = await query(`
    WITH current AS (
      SELECT url, AVG(position) as avg_pos
      FROM gsc_daily WHERE date >= CURRENT_DATE - 7
      GROUP BY url
    ),
    previous AS (
      SELECT url, AVG(position) as avg_pos
      FROM gsc_daily WHERE date >= CURRENT_DATE - 14 AND date < CURRENT_DATE - 7
      GROUP BY url
    )
    SELECT c.url, c.avg_pos as current_pos, p.avg_pos as previous_pos
    FROM current c JOIN previous p ON c.url = p.url
    WHERE p.avg_pos > 0 AND c.avg_pos > p.avg_pos + 5
    ORDER BY (c.avg_pos - p.avg_pos) DESC
    LIMIT 20
  `);

  for (const row of posAlerts.rows) {
    alerts.push({
      type: 'drop_position',
      severity: 'medium',
      title: 'Pérdida de posición',
      message: `Pasó de posición #${Math.round(row.previous_pos)} a #${Math.round(row.current_pos)}`,
      url: row.url,
      current_value: row.current_pos,
      previous_value: row.previous_pos,
    });
  }

  return alerts;
}
