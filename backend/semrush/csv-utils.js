// =============================================================
// Import local SEMrush CSVs -> PostgreSQL
// Lee los CSVs descargados de SEMrush desde C:\Users\ferna\Downloads\
// y hace UPSERT a las tablas semrush_keywords, site_audit,
// sitemap_crawl y master_urls.
//
// Uso:
//   DATABASE_URL=postgres://... node semrush-import-all.js
// =============================================================
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOWNLOADS = 'C:\\Users\\ferna\\Downloads';

// -------------------------------------------------------------
// Parser CSV robusto (maneja comillas, comas embebidas, "" escapado)
// -------------------------------------------------------------
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === ',') {
      row.push(field);
      field = '';
      i++;
      continue;
    }
    if (c === '\r') {
      i++;
      continue;
    }
    if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
      i++;
      continue;
    }
    field += c;
    i++;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadCSV(filename) {
  const path = join(DOWNLOADS, filename);
  if (!existsSync(path)) {
    console.warn(`[WARN] No existe: ${path}`);
    return { headers: [], rows: [] };
  }
  const text = readFileSync(path, 'utf-8');
  const all = parseCSV(text);
  const nonEmpty = all.filter(r => r.some(c => c !== null && c !== undefined && String(c).trim() !== ''));
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map(h => h.trim());
  const rows = nonEmpty.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] !== undefined ? r[idx].trim() : '';
    });
    return obj;
  });
  console.log(`[CSV] ${filename}: ${rows.length} filas, ${headers.length} columnas`);
  return { headers, rows };
}

// -------------------------------------------------------------
// Helpers de conversion
// -------------------------------------------------------------
const toInt = (v) => {
  if (v === '' || v === '-' || v === 'n/a' || v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  return isNaN(n) ? null : n;
};
const toFloat = (v) => {
  if (v === '' || v === '-' || v === 'n/a' || v === null || v === undefined) return null;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? null : n;
};
const toBool = (v) => {
  if (v === '1' || v === 'true' || v === 'yes' || v === 'Y') return true;
  if (v === '0' || v === 'false' || v === 'no' || v === 'N' || v === '-' || v === '') return false;
  return null;
};

export { parseCSV, loadCSV, toInt, toFloat, toBool, DOWNLOADS };
