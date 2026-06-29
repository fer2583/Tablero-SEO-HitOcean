// =============================================================
// API Endpoint: /api/alerts
// Alertas automáticas desde detección en vivo
// =============================================================
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

  try {
    let alerts = [];

    if (mode === 'detect' || mode === 'active') {
      // Detección en vivo desde GSC
      try {
        const result = await detectAlerts();
        alerts = result?.alerts || [];
      } catch (e) {
        console.warn('[Alerts] Detection error:', e.message);
      }
    }

    // Limitar cantidad de alertas
    alerts = alerts.slice(0, 50);

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true, count: alerts.length, alerts }));
  } catch (err) {
    console.error('[Alerts API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
