// =============================================================
// API Endpoint: /api/clarity
// =============================================================
import { fetchClarityDaily, getLatestData } from '../services/clarity.js';

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
      case 'trends':
      default:
        data = await fetchClarityDaily({ days });
        break;
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true, mode, days, ...data }));
  } catch (err) {
    console.error('[Clarity API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
