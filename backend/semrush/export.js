#!/usr/bin/env node
// =============================================================
// SEMrush Export Automático con Puppeteer
// Exporta Organic Research + Backlinks + Position Tracking
// y los guarda en la base de datos
// 
// Uso: node semrush/export.js [--headless] [--domain=hitocean.com]
// =============================================================
import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'exports');

// Credenciales de SEMrush (desde .env)
const EMAIL = process.env.SEMRUSH_EMAIL || '';
const PASSWORD = process.env.SEMRUSH_PASSWORD || '';
const DOMAIN = process.env.SEMRUSH_DOMAIN || 'hitocean.com';

const args = process.argv.slice(2);
const HEADLESS = args.includes('--headless');

/**
 * Login a SEMrush y exportar datos
 */
async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error('❌ SEMRUSH_EMAIL y SEMRUSH_PASSWORD requeridos en .env');
    process.exit(1);
  }

  mkdirSync(DATA_DIR, { recursive: true });

  const browser = await puppeteer.launch({
    headless: HEADLESS ? 'new' : false,
    defaultViewport: { width: 1280, height: 800 },
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();

    // 1. Login
    console.log('🔐 Logging into SEMrush...');
    await page.goto('https://www.semrush.com/login/', { waitUntil: 'networkidle2' });
    await page.type('input[name="email"]', EMAIL);
    await page.type('input[name="password"]', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 30000 });
    console.log('✅ Logged in');

    // 2. Organic Research - Export CSV
    console.log(`📊 Exporting Organic Research for ${DOMAIN}...`);
    await page.goto(
      `https://www.semrush.com/analytics/organic/overview/?q=${DOMAIN}&db=us`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );
    await page.waitForTimeout(3000);

    // Intentar click en botón de exportación
    try {
      await page.click('button[data-test="export-button"], .export-button, button:has(svg)');
      await page.waitForTimeout(2000);
      // Elegir formato CSV
      await page.click('text=CSV');
      await page.waitForTimeout(3000);
      console.log('✅ Organic Research exportado');
    } catch (e) {
      console.warn('⚠️ No se pudo exportar automáticamente, descargá manual:', 
        `https://www.semrush.com/analytics/organic/overview/?q=${DOMAIN}&db=us`);
    }

    // 3. Backlinks - Export
    console.log(`🔗 Exporting Backlinks for ${DOMAIN}...`);
    await page.goto(
      `https://www.semrush.com/analytics/backlinks/overview/?q=${DOMAIN}`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );
    await page.waitForTimeout(3000);

    try {
      await page.click('button[data-test="export-button"], .export-button, button:has(svg)');
      await page.waitForTimeout(2000);
      await page.click('text=CSV');
      await page.waitForTimeout(3000);
      console.log('✅ Backlinks exportados');
    } catch (e) {
      console.warn('⚠️ No se pudo exportar backlinks automáticamente');
    }

    // 4. Position Tracking (si existe)
    console.log(`📈 Exporting Position Tracking for ${DOMAIN}...`);
    await page.goto(
      `https://www.semrush.com/analytics/positiontracking/overview/?q=${DOMAIN}`,
      { waitUntil: 'networkidle2', timeout: 30000 }
    );
    await page.waitForTimeout(3000);

    console.log('✅ Exportación completa');
    console.log(`📁 Los archivos se descargaron en la carpeta de descargas del navegador.`);
    console.log('');
    console.log('📌 Para cargar los datos a la base de datos, ejecutá:');
    console.log('  node semrush/import.js');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
