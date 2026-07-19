// =============================================================
// API: /api/semrush/upload
// Recibe un CSV de SEMrush y lo importa a la DB
// Uso: curl -F "file=@organic.csv" https://.../api/semrush/upload
// O desde el frontend con FormData
// =============================================================
import { insertMany } from '../db/client.js';

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: 'Method not allowed' }));
    return;
  }

  try {
    // Leer el body crudo (CSV)
    let body = '';
    for await (const chunk of req) body += chunk;

    // Detectar si es multipart (form-data) o raw CSV
    let csvContent = body;
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
      // Extraer CSV del multipart manualmente (sin librerías pesadas)
      const boundary = contentType.split('boundary=')[1]?.split(';')[0]?.trim();
      if (boundary) {
        const parts = body.split(`--${boundary}`);
        for (const part of parts) {
          if (part.includes('filename=') || part.includes('Content-Type')) {
            const lines = part.split('\n');
            // Saltar headers del multipart, tomar el resto como CSV
            const csvLines = [];
            let inHeaders = true;
            for (const line of lines) {
              if (inHeaders && line.includes('Content-Type')) { inHeaders = false; continue; }
              if (!inHeaders && line.trim()) csvLines.push(line.trim());
            }
            csvContent = csvLines.join('\n');
            break;
          }
        }
      }
    }

    if (!csvContent || csvContent.length < 10) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: false, error: 'CSV vacío o inválido' }));
      return;
    }

    // Parsear CSV
    const lines = csvContent.split('\n').filter(l => l.trim());
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/^"|"$/g, ''));

    const kwIdx = headers.findIndex(h => h.includes('keyword'));
    const posIdx = headers.findIndex(h => h.includes('position'));
    const volIdx = headers.findIndex(h => h.includes('volume') || h.includes('search volume'));
    const cpcIdx = headers.findIndex(h => h.includes('cpc'));
    const trafficIdx = headers.findIndex(h => h.includes('traffic'));
    const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('page'));

    if (kwIdx === -1) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: false, error: 'No se encontró columna Keyword en el CSV. Las columnas son: ' + headers.join(', ') }));
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const rows = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
      if (cols.length < 2) continue;

      rows.push({
        export_date: today,
        keyword: cols[kwIdx] || '',
        position: posIdx >= 0 ? parseInt(cols[posIdx]) || null : null,
        previous_position: null,
        search_volume: volIdx >= 0 ? parseInt(cols[volIdx]) || null : null,
        keyword_difficulty: null,
        cpc: cpcIdx >= 0 ? parseFloat(cols[cpcIdx]) || null : null,
        url: urlIdx >= 0 ? cols[urlIdx] || null : null,
        traffic: trafficIdx >= 0 ? parseInt(cols[trafficIdx]) || null : null,
        traffic_pct: null,
        traffic_cost: null,
        competition: null,
        num_results: null,
        trends: null,
        serp_features: null,
        keyword_intents: null,
        position_type: null,
      });
    }

    if (rows.length === 0) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: false, error: 'No se encontraron filas válidas en el CSV' }));
      return;
    }

    // Insertar en DB (UPSERT por export_date+keyword+url)
    const { query } = await import('../db/client.js');
    const colsKeys = Object.keys(rows[0]);
    const placeholders = rows.map((_, i) =>
      `(${colsKeys.map((_, j) => `$${i * colsKeys.length + j + 1}`).join(', ')})`
    ).join(', ');
    const values = rows.flatMap(r => Object.values(r));
    const text = `INSERT INTO semrush_keywords (${colsKeys.join(', ')}) VALUES ${placeholders}
      ON CONFLICT (export_date, keyword, url) DO UPDATE SET
        position = EXCLUDED.position,
        search_volume = EXCLUDED.search_volume,
        cpc = EXCLUDED.cpc,
        traffic = EXCLUDED.traffic,
        url = EXCLUDED.url`;
    await query(text, values);

    // Log de sincronización
    const { query } = await import('../db/client.js');
    await query(
      `INSERT INTO sync_log (source, status, started_at, finished_at, rows_inserted) VALUES ($1, $2, NOW(), NOW(), $3)`,
      ['semrush_upload', 'success', rows.length]
    ).catch(() => {});

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      rows_imported: rows.length,
      date: today,
      message: `✅ ${rows.length} keywords importadas desde SEMrush`,
    }));
  } catch (err) {
    console.error('[SEMrush Upload Error]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
