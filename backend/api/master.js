// =============================================================
// API: /api/master
// Reemplaza a Google Sheets como fuente de datos principal
// Devuelve el mismo formato que normalizeData() espera
// =============================================================
import { query } from '../db/client.js';

export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders);
    res.end();
    return;
  }

  try {
    // Obtener todas las URLs del master
    const masterResult = await query('SELECT * FROM master_urls ORDER BY url');
    const metadataResult = await query('SELECT * FROM metadata_audit ORDER BY url');
    const keywordsResult = await query('SELECT * FROM semrush_keywords ORDER BY export_date DESC');
    const redirectsResult = await query('SELECT * FROM redirects_review ORDER BY url');
    const protectedResult = await query('SELECT * FROM protected_urls ORDER BY clicks DESC');
    const checklistResult = await query('SELECT * FROM checklist_items ORDER BY id');
    const debugCount = await query('SELECT COUNT(*)::int n FROM master_urls');

    // Mapear columnas de DB a nombres que el frontend espera (compatibilidad con normalizeData)
    const master = masterResult.rows.map(r => ({
      'URL actual': r.url,
      'Path': r.path,
      'Tipo': r.type,
      'Prioridad SEO': r.priority,
      'Acción sugerida': r.action,
      'URL nueva / destino': r.target,
      'HTTP status': r.status,
      'Clics GSC': r.clicks,
      'Impresiones GSC': r.impressions,
      'CTR GSC': r.ctr,
      'Posición GSC': r.position,
      'KW real GSC/Semrush': r.kw,
      'KW objetivo nueva': r.kw_target,
      'Meta title actual': r.title,
      'Title length': r.title_len,
      'Title nuevo Astro': r.title_new,
      'Meta description actual': r.description,
      'Description length': r.description_len,
      'Description nueva Astro': r.description_new,
      'Canonical actual': r.canonical,
      'In sitemap': r.in_sitemap,
      'Crawl depth': r.crawl_depth,
      'Incoming internal links': r.incoming_links,
      'Outgoing internal links': r.outgoing_links,
      'JSON-LD': r.jsonld,
      'Open Graph': r.og,
      'Twitter Cards': r.twitter,
      'Schema recomendado': r.schema_type,
      'Issues count': r.issues_count,
      'Top issues': r.issues,
      'Intent KW': r.intent,
      'Checklist metadata': r.meta_status,
      'QA migración': r.qa,
      'Notas': r.notes,
    }));

    const metadata = metadataResult.rows.map(r => ({
      'URL actual': r.url,
      'Meta title actual': r.title,
      'Title length': r.title_len,
      'Title nuevo Astro': r.title_new,
      'Meta description actual': r.description,
      'Description length': r.description_len,
      'Description nueva Astro': r.description_new,
      'Checklist metadata': r.meta_status,
      'Schema recomendado': r.schema_type,
      'Prioridad': r.priority,
      'Acción sugerida': r.action,
      'KW objetivo nueva': r.kw_target,
    }));

    const keywordsMap = {};
    keywordsResult.rows.forEach(r => {
      const key = r.url || '';
      if (!keywordsMap[key]) {
        keywordsMap[key] = {
          'URL actual': r.url,
          'Top KW Semrush Landing': r.keyword,
          'Posición KW actual': r.position,
          'Volumen landing': r.search_volume,
        };
      }
    });

    const redirects = redirectsResult.rows.map(r => ({
      'URL actual': r.url,
      'Prioridad SEO': r.priority,
      'Acción sugerida': r.action,
      'HTTP status': r.status,
      'URL nueva / destino': r.target,
      'Top issues': r.issues,
      'Recomendación': r.recommendation,
    }));

    const protectedUrls = protectedResult.rows.map(r => ({
      'URL actual': r.url,
      'Clics GSC': r.clicks,
      'Impresiones GSC': r.impressions,
      'Posición GSC': r.position,
      'Top KW Semrush': r.kw,
      'Prioridad': r.priority,
      'Acción sugerida': r.action,
      'Notas': r.notes,
    }));

    const checklist = checklistResult.rows.map(r => ({
      'Tarea': r.title,
      'Categoría': r.category,
      'Estado': r.status,
      'Responsable': r.assignee,
      'URL': r.url,
      'Notas': r.notes,
    }));

    // Issues derivados (inline)
    const issues = master.filter(r => r['Issues count'] > 0 || r['Top issues']).map(r => ({
      'URL actual': r['URL actual'],
      'Issues count': r['Issues count'],
      'Top issues': r['Top issues'],
    }));

    res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: true,
      generatedAt: new Date().toISOString(),
      source: 'postgresql',
      _debugMasterCount: debugCount.rows[0].n,
      _debugMasterRowsLen: masterResult.rows ? masterResult.rows.length : 'undefined',
      _debugMasterFirstUrl: masterResult.rows && masterResult.rows[0] ? masterResult.rows[0].url : 'none',
      sheets: {
        'Master SEO Migración': master,
        'Metadata Audit': metadata,
        'Keyword Mapping': Object.values(keywordsMap),
        'Redirects Review': redirects,
        'Top URLs Protegidas': protectedUrls,
        'Issues Summary': issues,
        'Checklist Ejecución': checklist,
      },
    }));
  } catch (err) {
    console.error('[Master API Error]', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json', ...corsHeaders });
    res.end(JSON.stringify({
      ok: false,
      error: err.message,
      source: 'postgresql',
      sheets: {},
    }));
  }
}
