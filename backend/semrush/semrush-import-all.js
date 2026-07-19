// =============================================================
// Runner: importa todos los CSVs de SEMrush locales a PostgreSQL
// =============================================================
import { loadCSV } from './csv-utils.js';
import { importKeywords, importSiteAudit, importSitemapCrawl } from './import-logic.js';
import { query } from '../db/client.js';

// Fecha del export (del nombre de archivo: 2026-07-19)
const EXPORT_DATE = process.env.EXPORT_DATE || '2026-07-19';

const FILES = {
  keywords: 'hitocean.com-organic.Positions-ar-20260718-2026-07-19T21_32_07Z.csv',
  pages: 'hitocean.com_pages_20260719.csv',
  mega: 'hitocean.com_mega_export_20260719.csv',
  structured: 'hitocean.com_pages_structured_data_20260719.csv',
};

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('[ERROR] DATABASE_URL no configurada.');
    console.error('  Seteala asi (PowerShell):');
    console.error('  $env:DATABASE_URL="postgres://user:pass@host/db"');
    console.error('  (la encontras en Vercel: Storage / Environment Variables)');
    process.exit(1);
  }

  console.log(`[INIT] Fecha de export: ${EXPORT_DATE}`);
  const syncStart = await query(
    `INSERT INTO sync_log (source, status, started_at) VALUES ('semrush_csv', 'running', NOW()) RETURNING id`
  );
  const syncId = syncStart.rows[0].id;

  let totalInserted = 0;
  try {
    // 1. Keywords
    const kw = loadCSV(FILES.keywords);
    const nKw = await importKeywords(kw.rows, EXPORT_DATE);
    console.log(`[OK] semrush_keywords: ${nKw} filas`);
    totalInserted += nKw;

    // 2. Site audit (pages + mega + structured)
    const pages = loadCSV(FILES.pages);
    const mega = loadCSV(FILES.mega);
    const structured = loadCSV(FILES.structured);
    const { inserted, updatedMaster } = await importSiteAudit(pages.rows, mega.rows, structured.rows, EXPORT_DATE);
    console.log(`[OK] site_audit: ${inserted} filas | master_urls upsert: ${updatedMaster}`);
    totalInserted += inserted;

    // 3. Sitemap crawl
    const nSitemap = await importSitemapCrawl(pages.rows, EXPORT_DATE);
    console.log(`[OK] sitemap_crawl: ${nSitemap} filas`);
    totalInserted += nSitemap;

    await query(
      `UPDATE sync_log SET status='success', finished_at=NOW(), rows_inserted=$1 WHERE id=$2`,
      [totalInserted, syncId]
    );
    console.log(`\n[DONE] Import completo. Total filas afectadas: ${totalInserted}`);
  } catch (err) {
    console.error('[FATAL]', err.message);
    await query(
      `UPDATE sync_log SET status='error', finished_at=NOW(), error_message=$1 WHERE id=$2`,
      [String(err.message).slice(0, 500), syncId]
    );
    process.exit(1);
  }
}

main();
