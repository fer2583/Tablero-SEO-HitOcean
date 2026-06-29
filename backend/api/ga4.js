// =============================================================
// API Endpoint: /api/ga4
// =============================================================
import { fetchGA4Daily, getLatestData, getTopPages } from '../services/ga4.js';

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
  const days = parseInt(searchParams.get('days')) || 7;
  const mode = searchParams.get('mode') || 'trends';

  try {
    let data;

    switch (mode) {
      case 'latest':
        data = await getLatestData({ days });
        break;
      case 'pages':
        data = await getTopPages({ days });
        break;
      case 'trends':
      default:
        data = await fetchGA4Daily({ days });
        break;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true, mode, days, ...data }));
  } catch (err) {
    console.error('[GA4 API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
