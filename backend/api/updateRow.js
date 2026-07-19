// =============================================================
// API: /api/updateRow
// Reemplaza a Apps Script doPost(e)
// Actualiza un registro en PostgreSQL directo
// =============================================================
import { query } from '../db/client.js';

// Mapeo de nombres de columnas del frontend → columnas de DB
const FIELD_MAP = {
  'Prioridad': 'priority',
  'Acción sugerida': 'action',
  'URL nueva / destino': 'target',
  'KW objetivo nueva': 'kw_target',
  'Title nuevo Astro': 'title_new',
  'Description nueva Astro': 'description_new',
  'Checklist metadata': 'meta_status',
  'QA migración': 'qa',
  'Notas': 'notes',
};

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
    // Leer body
    let body = '';
    for await (const chunk of req) body += chunk;
    const payload = JSON.parse(body);

    const key = payload.key || payload.url || '';
    const updates = payload.updates || {};

    if (!key) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: false, error: 'Missing key/url' }));
      return;
    }

    // Mapear campos editables a columnas de DB
    const dbUpdates = {};
    let touched = false;
    Object.keys(updates).forEach(field => {
      const dbCol = FIELD_MAP[field];
      if (dbCol) {
        dbUpdates[dbCol] = updates[field];
        touched = true;
      }
    });

    if (!touched) {
      res.writeHead(400, { 'Content-Type': 'application/json', ...corsHeaders });
      res.end(JSON.stringify({ ok: false, error: 'No editable fields' }));
      return;
    }

    // Agregar updated_at
    dbUpdates.updated_at = new Date().toISOString();

    // Construir SET clause
    const setEntries = Object.entries(dbUpdates);
    const setClauses = setEntries.map((_, i) => `${setEntries[i][0]} = $${i + 2}`);
    const values = setEntries.map(e => e[1]);

    // Actualizar master_urls
    const result = await query(
      `UPDATE master_urls SET ${setClauses.join(', ')} WHERE url = $1`,
      [key, ...values]
    );

    // También actualizar metadata_audit si aplica
    await query(
      `UPDATE metadata_audit SET meta_status = COALESCE($1, meta_status), title_new = COALESCE($2, title_new), description_new = COALESCE($3, description_new), kw_target = COALESCE($4, kw_target), updated_at = NOW() WHERE url = $5`,
      [dbUpdates.meta_status || null, dbUpdates.title_new || null, dbUpdates.description_new || null, dbUpdates.kw_target || null, key]
    ).catch(() => {}); // no falla si no existe

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      key,
      updatedFields: Object.keys(dbUpdates),
      touchedRows: result.rowCount,
      timestamp: new Date().toISOString(),
    }));
  } catch (err) {
    console.error('[UpdateRow Error]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({ ok: false, error: err.message }));
  }
}
