// =============================================================
// API Endpoint: /api/alerts
// Alertas automáticas del dashboard
// =============================================================
import { query } from '../db/client.js';
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
  const mode = searchParams.get('mode') || 'active';
  const limit = parseInt(searchParams.get('limit')) || 20;

  try {
    let alerts;

    if (mode === 'detect') {
      // Ejecutar detección de alertas en vivo
      alerts = await detectAlerts();
    } else {
      // Alertas desde DB
      const result = await query(`
        SELECT * FROM alerts 
        WHERE resolved = false 
        ORDER BY 
          CASE severity 
            WHEN 'critical' THEN 1 
            WHEN 'high' THEN 2 
            WHEN 'medium' THEN 3 
            WHEN 'low' THEN 4 
          END,
          date DESC
        LIMIT $1
      `, [limit]);
      alerts = result.rows;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true, count: alerts.length, alerts }));
  } catch (err) {
    console.error('[Alerts API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
