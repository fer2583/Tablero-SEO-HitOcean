#!/usr/bin/env node
// =============================================================
// Seed: Migrar datos de Google Sheets a PostgreSQL
// Se ejecuta UNA SOLA VEZ para la migración inicial.
// Después de esto, toda la data vive en la DB.
// =============================================================
import 'dotenv/config';
import { query, insertMany, getPool } from './client.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHEET_URL = process.env.DATA_URL || 'https://script.google.com/macros/s/AKfycbzUsfF3qMrqvI2rvGZdQfQZc1GaTMYkhWcpgvnkZ1Of7_BsAKEYj_hsKOtrGQLru0tpNA/exec';

function pick(row, keys) {
  for (const key of keys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') return row[key];
  }
  return '';
}

function num(v) {
  if (!v && v !== 0) return 0;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[^0-9.,-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

function path(url) {
  if (!url) return '';
  try { return new URL(url).pathname; } catch { return url; }
}

async function fetchSheetData() {
  console.log(`📡 Fetching data from Google Sheets: ${SHEET_URL}`);
  const res = await fetch(SHEET_URL, { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const raw = await res.json();
  const s = raw.sheets || raw;
  console.log('  Sheets encontradas:', Object.keys(s).join(', '));
  return s;
}

function normalizeMaster(row) {
  const url = pick(row, ['URL actual', 'URL', 'Address', 'Page URL', 'Landing Page']);
  const title = pick(row, ['Meta title actual', 'Title actual', 'Page Title', 'Title 1', 'Title']);
  const description = pick(row, ['Meta description actual', 'Description actual', 'Meta Description', 'Meta Description 1', 'Description']);
  return {
    url,
    path: pick(row, ['Path']) || path(url),
    type: pick(row, ['Tipo', 'Type', 'Page Type']),
    priority: pick(row, ['Prioridad SEO', 'Prioridad', 'Priority']),
    action: pick(row, ['Acción sugerida', 'Acción', 'Action']),
    target: pick(row, ['URL nueva / destino', 'URL nueva', 'Nueva URL', 'Destino', 'Target URL']),
    status: pick(row, ['HTTP status', 'HTTP Status', 'Status Code', 'Status']),
    clicks: num(pick(row, ['Clics GSC', 'Clicks', 'Clics'])),
    impressions: num(pick(row, ['Impresiones GSC', 'Impressions', 'Impresiones'])),
    ctr: num(pick(row, ['CTR GSC', 'CTR'])),
    position: num(pick(row, ['Posición GSC', 'Average Position', 'Position', 'Posición'])),
    kw: pick(row, ['KW real GSC/Semrush', 'KW principal inferida', 'Keyword principal', 'KW detectada', 'Top KW Semrush Landing', 'Top Keyword', 'Keyword']),
    kw_target: pick(row, ['KW objetivo nueva', 'Keyword objetivo', 'Target Keyword']),
    title,
    title_len: num(pick(row, ['Title length', 'Title Length', 'Title Len', 'Len Title']) || title.length),
    title_new: pick(row, ['Title nuevo Astro']),
    description,
    description_len: num(pick(row, ['Description length', 'Description Length', 'Len Description']) || description.length),
    description_new: pick(row, ['Description nueva Astro']),
    canonical: pick(row, ['Canonical actual', 'Canonical']),
    in_sitemap: num(pick(row, ['In sitemap'])),
    crawl_depth: num(pick(row, ['Crawl depth'])),
    incoming_links: num(pick(row, ['Incoming internal links'])),
    outgoing_links: num(pick(row, ['Outgoing internal links'])),
    jsonld: num(pick(row, ['JSON-LD'])),
    og: num(pick(row, ['Open Graph'])),
    twitter: num(pick(row, ['Twitter Cards'])),
    schema_type: pick(row, ['Schema recomendado', 'Schema', 'Structured Data', 'JSON-LD']),
    issues_count: num(pick(row, ['Issues count', 'Count'])),
    issues: pick(row, ['Top issues', 'Issues', 'Issue', 'Problemas', 'Notas SEO']),
    intent: pick(row, ['Intent KW', 'Intent', 'Intención']),
    meta_status: pick(row, ['Checklist metadata', 'Estado Metadata']),
    qa: pick(row, ['QA migración', 'QA', 'Estado QA']),
    notes: pick(row, ['Notas', 'Notas SEO', 'Notes']),
  };
}

async function seedMaster(sheets) {
  const mr = sheets['Master SEO Migración'] || sheets['Master SEO Metadata'] || sheets['URL Mapping Master'] || [];
  if (!mr.length) {
    console.log('  ⚠️ No se encontró la hoja Master SEO Migración');
    return 0;
  }

  console.log(`  📋 Procesando ${mr.length} registros...`);
  const rows = mr.map(normalizeMaster).filter(r => r.url);

  // Insertar en batches de 100
  let inserted = 0;
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    try {
      await insertMany('master_urls', batch);
      inserted += batch.length;
    } catch (err) {
      // Si falla por unique constraint, insertar uno por uno
      for (const row of batch) {
        try {
          await insertMany('master_urls', [row]);
          inserted++;
        } catch (e) {
          // Skip duplicados
        }
      }
    }
    process.stdout.write(`\r    ${inserted}/${rows.length} insertados...`);
  }
  console.log(`\n  ✅ ${inserted} URLs insertadas en master_urls`);
  return inserted;
}

async function seedMetadata(sheets) {
  const metar = sheets['Metadata Audit'] || [];
  if (!metar.length) return 0;

  const rows = metar.map(r => ({
    url: pick(r, ['URL actual', 'URL']) || '',
    title: pick(r, ['Title actual', 'Meta title actual']) || '',
    title_len: num(pick(r, ['Title length', 'Title Length'])) || 0,
    title_new: pick(r, ['Title nuevo Astro']) || '',
    description: pick(r, ['Description actual', 'Meta description actual']) || '',
    description_len: num(pick(r, ['Description length', 'Description Length'])) || 0,
    description_new: pick(r, ['Description nueva Astro']) || '',
    meta_status: pick(r, ['Checklist metadata', 'Estado Metadata']) || '',
    schema_type: pick(r, ['Schema recomendado', 'Schema']) || '',
    priority: pick(r, ['Prioridad']) || '',
    action: pick(r, ['Acción sugerida']) || '',
    kw_target: pick(r, ['KW objetivo nueva']) || '',
  })).filter(r => r.url);

  if (rows.length) {
    await insertMany('metadata_audit', rows);
    console.log(`  ✅ ${rows.length} registros en metadata_audit`);
  }
  return rows.length;
}

async function seedKeywords(sheets) {
  const kwr = sheets['Keyword Mapping'] || [];
  if (!kwr.length) return 0;

  const today = new Date().toISOString().split('T')[0];
  const rows = kwr.map(r => ({
    date: today,
    keyword: pick(r, ['Top KW Semrush Landing', 'Top KW Ranking Overview', 'KW real GSC/Semrush', 'Keyword', 'KW detectada']) || '',
    position: num(pick(r, ['Posición KW actual', 'Position'])),
    volume: num(pick(r, ['Volumen landing', 'Volume', 'Volumen'])),
    cpc: 0,
    traffic: 0,
    url: pick(r, ['URL actual', 'URL']) || '',
  })).filter(r => r.keyword);

  if (rows.length) {
    await insertMany('semrush_keywords', rows);
    console.log(`  ✅ ${rows.length} keywords en semrush_keywords`);
  }
  return rows.length;
}

async function seedRedirects(sheets) {
  const rr = sheets['Redirects Review'] || sheets['Redirects Draft'] || [];
  if (!rr.length) return 0;

  const rows = rr.map(r => ({
    url: pick(r, ['URL actual', 'URL', 'Address']) || '',
    priority: pick(r, ['Prioridad', 'Prioridad SEO']) || '',
    action: pick(r, ['Acción', 'Acción sugerida', 'Action']) || '',
    status: String(num(pick(r, ['HTTP status', 'HTTP Status', 'Status'])) || ''),
    target: pick(r, ['URL nueva / destino', 'Destino', 'URL nueva', 'Target URL']) || '',
    issues: pick(r, ['Top issues', 'Issues', 'Problemas']) || '',
    recommendation: pick(r, ['Recomendación', 'Notas SEO', 'Notes']) || 'Revisar destino final antes del deploy',
  })).filter(r => r.url);

  if (rows.length) {
    await insertMany('redirects_review', rows);
    console.log(`  ✅ ${rows.length} redirects en redirects_review`);
  }
  return rows.length;
}

async function seedProtected(sheets) {
  const pr = sheets['Top URLs Protegidas'] || [];
  if (!pr.length) return 0;

  const rows = pr.map(r => ({
    url: pick(r, ['URL actual', 'URL', 'Landing Page']) || '',
    clicks: num(pick(r, ['Clics GSC', 'Clicks', 'Clics'])),
    impressions: num(pick(r, ['Impresiones GSC', 'Impressions', 'Impresiones'])),
    position: num(pick(r, ['Posición GSC', 'Position', 'Posición'])),
    kw: pick(r, ['Top KW Semrush', 'Keyword', 'KW detectada']) || '',
    priority: pick(r, ['Prioridad']) || '',
    action: pick(r, ['Acción sugerida']) || '',
    notes: pick(r, ['Notas', 'Notas SEO', 'Notes']) || 'Validar en staging',
  })).filter(r => r.url);

  if (rows.length) {
    await insertMany('protected_urls', rows);
    console.log(`  ✅ ${rows.length} URLs protegidas en protected_urls`);
  }
  return rows.length;
}

async function seedChecklist(sheets) {
  const cr = sheets['Checklist Ejecución'] || sheets['Checklist Items'] || [];
  if (!cr.length) return 0;

  const rows = cr.map(r => ({
    title: pick(r, ['Tarea', 'Task', 'Item', 'Título', 'Title']) || 'Sin título',
    category: pick(r, ['Categoría', 'Category', 'Área']) || '',
    status: pick(r, ['Estado', 'Status', 'QA']) || 'pending',
    assignee: pick(r, ['Responsable', 'Assignee', 'Asignado']) || '',
    url: pick(r, ['URL']) || '',
    notes: pick(r, ['Notas', 'Notes']) || '',
    due_date: null,
  }));

  if (rows.length) {
    await insertMany('checklist_items', rows);
    console.log(`  ✅ ${rows.length} items en checklist_items`);
  }
  return rows.length;
}

async function main() {
  console.log('🚀 Migración: Google Sheets → PostgreSQL');
  console.log('==========================================');

  // 1. Inicializar schema
  console.log('\n📦 Inicializando tablas...');
  const { initSchema } = await import('./client.js');
  await initSchema();

  // 2. Fetch data de Sheets
  console.log('\n📡 Obteniendo datos de Google Sheets...');
  const sheets = await fetchSheetData();

  // 3. Seed cada tabla
  console.log('\n💾 Sembrando datos en PostgreSQL...');
  const results = {
    master: await seedMaster(sheets),
    metadata: await seedMetadata(sheets),
    keywords: await seedKeywords(sheets),
    redirects: await seedRedirects(sheets),
    protected: await seedProtected(sheets),
    checklist: await seedChecklist(sheets),
  };

  // 4. Resumen
  console.log('\n==========================================');
  console.log('📊 RESUMEN DE MIGRACIÓN:');
  console.log(`  master_urls:      ${results.master}`);
  console.log(`  metadata_audit:   ${results.metadata}`);
  console.log(`  semrush_keywords: ${results.keywords}`);
  console.log(`  redirects_review: ${results.redirects}`);
  console.log(`  protected_urls:   ${results.protected}`);
  console.log(`  checklist_items:  ${results.checklist}`);
  console.log('==========================================');
  console.log('✅ Migración completada. Google Sheets ya no es necesario.');

  const pool = getPool();
  await pool.end();
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
