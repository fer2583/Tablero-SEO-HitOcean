// =============================================================
// API Endpoint: /api/pagespeed
// PageSpeed Insights — Auditoría Lighthouse de URLs
// =============================================================
import { auditPage, auditMultiple } from '../services/pagespeed.js';

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
  const url = searchParams.get('url');
  const strategy = searchParams.get('strategy') || 'mobile';
  const mode = searchParams.get('mode') || 'single';

  try {
    let data;

    if (mode === 'single' && url) {
      data = await auditPage(url, strategy);
    } else if (mode === 'homepage') {
      // Auditar homepage
      data = await auditPage('https://hitocean.com', strategy);
    } else {
      return res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders })
        .end(JSON.stringify({ ok: false, error: 'Especificá ?url= o mode=homepage' }));
    }

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: true, ...data }));
  } catch (err) {
    console.error('[PageSpeed API]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
