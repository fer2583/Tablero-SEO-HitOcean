#!/usr/bin/env node
// =============================================================
// Importador de CSVs de SEMrush a la base de datos
// Procesa archivos exportados manualmente o por Puppeteer
// =============================================================
import { readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { query, insertMany } from '../db/client.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXPORTS_DIR = join(__dirname, '..', 'exports');

/**
 * Importar keywords desde CSV de SEMrush
 * Formato esperado: Keyword,Position,Volume,CPC,Traffic,URL
 */
async function importKeywords(filePath) {
  console.log(`📄 Importing keywords from ${filePath}...`);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const kwIdx = headers.findIndex(h => h.includes('keyword'));
  const posIdx = headers.findIndex(h => h.includes('position'));
  const volIdx = headers.findIndex(h => h.includes('volume') || h.includes('search volume'));
  const cpcIdx = headers.findIndex(h => h.includes('cpc'));
  const trafficIdx = headers.findIndex(h => h.includes('traffic'));
  const urlIdx = headers.findIndex(h => h.includes('url') || h.includes('page'));

  if (kwIdx === -1) {
    console.error('❌ No se encontró columna Keyword en el CSV');
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    rows.push({
      date: today,
      keyword: cols[kwIdx] || '',
      position: posIdx >= 0 ? parseInt(cols[posIdx]) || 0 : 0,
      volume: volIdx >= 0 ? parseInt(cols[volIdx]) || 0 : 0,
      cpc: cpcIdx >= 0 ? parseFloat(cols[cpcIdx]) || 0 : 0,
      traffic: trafficIdx >= 0 ? parseFloat(cols[trafficIdx]) || 0 : 0,
      url: urlIdx >= 0 ? cols[urlIdx] || '' : '',
    });
  }

  if (rows.length > 0) {
    await insertMany('semrush_keywords', rows);
    console.log(`✅ ${rows.length} keywords importadas`);
  }

  return rows.length;
}

/**
 * Importar backlinks desde CSV de SEMrush
 */
async function importBacklinks(filePath) {
  console.log(`📄 Importing backlinks from ${filePath}...`);
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

  const sourceIdx = headers.findIndex(h => h.includes('source') || h.includes('referring'));
  const targetIdx = headers.findIndex(h => h.includes('target') || h.includes('url'));
  const anchorIdx = headers.findIndex(h => h.includes('anchor'));
  const daIdx = headers.findIndex(h => h.includes('authority') || h.includes('da'));

  if (sourceIdx === -1) {
    console.error('❌ No se encontró columna Source URL');
    return 0;
  }

  const today = new Date().toISOString().split('T')[0];
  const rows = [];

  for (let i = 1; i < Math.min(lines.length, 1000); i++) { // max 1000 filas
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    rows.push({
      date: today,
      source_url: cols[sourceIdx] || '',
      target_url: targetIdx >= 0 ? cols[targetIdx] || '' : '',
      anchor: anchorIdx >= 0 ? cols[anchorIdx] || '' : '',
      domain_authority: daIdx >= 0 ? parseInt(cols[daIdx]) || 0 : 0,
      first_seen: today,
      last_seen: today,
    });
  }

  if (rows.length > 0) {
    await insertMany('semrush_backlinks', rows);
    console.log(`✅ ${rows.length} backlinks importados`);
  }

  return rows.length;
}

/**
 * Escanear carpeta de exports y procesar CSVs
 */
async function main() {
  console.log('🔍 Scanning exports directory...');

  try {
    const files = readdirSync(EXPORTS_DIR);
    const csvFiles = files.filter(f => f.endsWith('.csv'));

    if (csvFiles.length === 0) {
      console.log('📁 No hay CSVs en exports/. Exportá desde SEMrush manualmente o con Puppeteer.');
      console.log('');
      console.log('📌 Exportación manual:');
      console.log('  1. SEMrush > Domain Analytics > Organic Research > Export CSV');
      console.log(`  2. Guardar en: ${EXPORTS_DIR}/`);
      console.log('  3. Ejecutar: node semrush/import.js');
      return;
    }

    let totalKeywords = 0;
    let totalBacklinks = 0;

    for (const file of csvFiles) {
      const filePath = join(EXPORTS_DIR, file);
      const lower = file.toLowerCase();

      if (lower.includes('organic') || lower.includes('keyword')) {
        totalKeywords += await importKeywords(filePath);
      } else if (lower.includes('backlink')) {
        totalBacklinks += await importBacklinks(filePath);
      } else {
        console.log(`⚠️ Archivo no reconocido: ${file} (renombrar con "organic" o "backlinks")`);
      }
    }

    console.log('');
    console.log('📊 Resumen de importación:');
    console.log(`   Keywords: ${totalKeywords}`);
    console.log(`   Backlinks: ${totalBacklinks}`);
    console.log('✅ Importación completada');

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
