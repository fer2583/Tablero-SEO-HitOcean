// =============================================================
// Google Analytics 4 - Data API v1
// Métricas: usuarios, sesiones, page views, engagement
// =============================================================
import { google } from 'googleapis';
import { getGA4Auth } from '../lib/auth.js';

const PROPERTY_ID = process.env.GA4_PROPERTY_ID || '448832584';

/**
 * Fetch métricas diarias de GA4
 */
export async function fetchGA4Daily({ days = 7, startDate, endDate } = {}) {
  const auth = getGA4Auth();
  if (!auth) {
    console.warn('[GA4] No auth available');
    return [];
  }

  const end = endDate || new Date().toISOString().split('T')[0];
  const start = startDate || new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const analyticsData = google.analyticsdata({ version: 'v1beta', auth });

  try {
    // 1. Métricas generales por día
    const generalRes = await analyticsData.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'date' }],
        metrics: [
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
          { name: 'screenPageViews' },
          { name: 'engagementRate' },
          { name: 'averageSessionDuration' },
          { name: 'bounceRate' },
        ],
      },
    });

    // 2. Páginas más visitadas
    const pagesRes = await analyticsData.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'pagePath' }, { name: 'date' }],
        metrics: [
          { name: 'screenPageViews' },
          { name: 'totalUsers' },
          { name: 'averageSessionDuration' },
        ],
        orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
        limit: 100,
      },
    });

    // 3. Tráfico por fuente
    const sourceRes = await analyticsData.properties.runReport({
      property: `properties/${PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: start, endDate: end }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [
          { name: 'sessions' },
          { name: 'totalUsers' },
        ],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 20,
      },
    });

    return {
      daily: parseReport(generalRes.data),
      pages: parseReport(pagesRes.data),
      sources: parseReport(sourceRes.data),
      period: { start, end },
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('[GA4] Fetch error:', err.message);
    return { error: err.message, daily: [], pages: [], sources: [] };
  }
}

/**
 * Parsear respuesta de GA4 a formato estándar
 */
function parseReport(data) {
  if (!data.rows) return [];

  return data.rows.map(row => {
    const dims = row.dimensionValues?.map(d => d.value) || [];
    const metrics = row.metricValues?.map(m => m.value) || [];

    const result = {};
    if (dims.length >= 1) result.date = dims[0];
    if (dims.length >= 2) result.pagePath = dims[1];
    if (dims.length >= 3) result.source = dims[2];

    // Mapear métricas por nombre (lo inferimos del orden en la request)
    if (metrics.length >= 1) result.totalUsers = parseInt(metrics[0]) || 0;
    if (metrics.length >= 2) result.newUsers = parseInt(metrics[1]) || 0;
    if (metrics.length >= 3) result.sessions = parseInt(metrics[2]) || 0;
    if (metrics.length >= 4) result.pageViews = parseInt(metrics[3]) || 0;
    if (metrics.length >= 5) result.engagementRate = parseFloat(metrics[4]) || 0;
    if (metrics.length >= 6) result.avgSessionDuration = parseFloat(metrics[5]) || 0;
    if (metrics.length >= 7) result.bounceRate = parseFloat(metrics[6]) || 0;

    return result;
  });
}

/**
 * Obtener últimos datos de GA4 desde DB (para el frontend)
 */
export async function getLatestData({ days = 7 } = {}) {
  const { query } = await import('../db/client.js');
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT 
      date,
      SUM(users) as users,
      SUM(sessions) as sessions,
      SUM(page_views) as page_views,
      AVG(engagement_rate) as engagement_rate,
      AVG(avg_session_duration) as avg_session_duration
    FROM ga4_daily 
    WHERE date >= $1 AND date <= $2
    GROUP BY date
    ORDER BY date DESC
  `, [start, end]);

  return result.rows;
}

/**
 * Obtener páginas populares desde DB
 */
export async function getTopPages({ days = 7 } = {}) {
  const { query } = await import('../db/client.js');
  const end = new Date().toISOString().split('T')[0];
  const start = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];

  const result = await query(`
    SELECT 
      url,
      SUM(page_views) as total_views,
      SUM(users) as total_users
    FROM ga4_pages 
    WHERE date >= $1 AND date <= $2
    GROUP BY url
    ORDER BY total_views DESC
    LIMIT 50
  `, [start, end]);

  return result.rows;
}
