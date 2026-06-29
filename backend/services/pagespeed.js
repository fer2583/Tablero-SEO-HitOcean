// =============================================================
// Google PageSpeed Insights API v5
// Auditoría Lighthouse: performance, accesibilidad, SEO, mejores prácticas
// =============================================================

const API_KEY = process.env.GOOGLE_API_KEY || '';
const BASE_URL = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

/**
 * Auditar una URL con PageSpeed Insights
 * @param {string} url - URL a auditar
 * @param {'mobile'|'desktop'} strategy - Estrategia de dispositivo
 */
export async function auditPage(url, strategy = 'mobile') {
  if (!url) {
    return { error: 'URL requerida' };
  }

  try {
    const params = new URLSearchParams({
      url,
      strategy,
    });
    if (API_KEY) params.set('key', API_KEY);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

    const response = await fetch(`${BASE_URL}?${params}`, {
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (response.status === 429) {
      return {
        error: 'La cuota diaria de PageSpeed Insights se agotó. Volvé a intentar mañana o configurá una API Key propia.',
        url,
        strategy,
        scores: {},
        issues: { errors: [], warnings: [], passed: [] },
      };
    }

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`PageSpeed API ${response.status}: ${text.slice(0, 200)}`);
    }

    const data = await response.json();
    return parseLighthouse(data, url, strategy);
  } catch (err) {
    if (err.name === 'AbortError') {
      return { error: 'Timeout — la API tardó más de 20s en responder', url, strategy, scores: {}, issues: { errors: [], warnings: [], passed: [] } };
    }
    console.error(`[PageSpeed] Error auditing ${url}:`, err.message);
    return { error: err.message, url, strategy, scores: {}, issues: { errors: [], warnings: [], passed: [] } };
  }
}

/**
 * Auditar múltiples URLs (top N)
 */
export async function auditMultiple(urls, strategy = 'mobile') {
  const results = [];
  for (const url of urls.slice(0, 10)) { // máximo 10 URLs
    console.log(`[PageSpeed] Auditing ${url}...`);
    const result = await auditPage(url, strategy);
    results.push(result);
    // Pequeña pausa para no rate-limit
    await new Promise(r => setTimeout(r, 500));
  }
  return results;
}

/**
 * Parsear respuesta de Lighthouse a formato simplificado
 */
function parseLighthouse(data, url, strategy) {
  const lighthouse = data?.lighthouseResult || {};
  const categories = lighthouse?.categories || {};
  const audits = lighthouse?.audits || {};

  // Debug: log categorías disponibles
  console.log(`[PageSpeed] Categories for ${url} (${strategy}):`, Object.keys(categories));

  // Scores por categoría (0-1)
  const scores = {};
  for (const [key, cat] of Object.entries(categories)) {
    scores[key] = cat.score || 0; // 0-1
  }

  // Auditorías agrupadas por tipo
  const issues = { errors: [], warnings: [], passed: [] };

  for (const [id, audit] of Object.entries(audits)) {
    // Solo auditorías con scoreDisplayMode
    const mode = audit.scoreDisplayMode || '';
    const score = audit.score; // null | 0 | 1

    // Ignorar items no informativos
    if (mode === 'notApplicable' || mode === 'manual') continue;

    const item = {
      id,
      title: audit.title || id,
      description: audit.description || '',
      score: score,
      mode,
      group: getGroup(id, categories),
      details: audit.details || null,
      numericValue: audit.numericValue || null,
      displayValue: audit.displayValue || '',
      recommendations: getRecommendation(id, audit),
    };

    if (score === 0 || mode === 'error') {
      issues.errors.push(item);
    } else if (score === null || score < 1 || mode === 'informative') {
      issues.warnings.push(item);
    } else {
      issues.passed.push(item);
    }
  }

  // Ordenar errores por impacto estimado
  issues.errors.sort((a, b) => (b.numericValue || 0) - (a.numericValue || 0));

  // Top 15 errores + top 15 warnings
  issues.errors = issues.errors.slice(0, 20);
  issues.warnings = issues.warnings.slice(0, 15);

  return {
    url,
    strategy,
    scores,
    issues,
    loadingExperience: data?.loadingExperience || null,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Determinar grupo de una auditoría
 */
function getGroup(id, categories) {
  // Mapeo rápido de categorías según el id de auditoría
  const perfPrefix = ['bootup', 'uses-', 'render-', 'offscreen', 'unminified', 'enable-', 'efficient', 'defer', 'preload', 'prioritize', 'server', 'total-', 'main-', 'interactive', 'speed-', 'font-', 'third-party', 'dom-', 'network-', 'large-', 'long-', 'max-', 'min-', 'no-', 'non-', 'optimized', 'preconnect', 'redirects', 'render-blocking', 'script-', 'style-', 'sprite', 'text-', 'time-', 'total-', 'uses-', 'user-', 'video-'];
  const a11yPrefix = ['aria-', 'accesskey', 'button-', 'color-', 'definition-', 'dl-', 'document-', 'duplicate-', 'empty-', 'frame-', 'heading-', 'html-', 'image-', 'input-', 'label-', 'link-', 'list-', 'meta-', 'object-', 'tab-', 'table-', 'td-', 'th-', 'video-', 'visual-'];

  if (a11yPrefix.some(p => id.startsWith(p))) return 'accessibility';
  if (id.startsWith('seo-') || id === 'crawlable' || id === 'canonical' || id === 'robots' || id === 'http-status') return 'seo';
  if (id.includes('https') || id.includes('security') || id.includes('errors')) return 'best-practices';
  return 'performance';
}

/**
 * Generar recomendación humana para una auditoría
 */
function getRecommendation(id, audit) {
  const recs = {
    'render-blocking-resources': 'Eliminá recursos que bloquean el renderizado. Usá <link rel="preload"> o diferí CSS/JS no crítico.',
    'uses-responsive-images': 'Usá imágenes responsive con srcset y sizes. Serví imágenes en WebP/AVIF.',
    'offscreen-images': 'Diferí imágenes fuera de pantalla con loading="lazy".',
    'unminified-css': 'Minificá CSS usando un build tool (Vite, esbuild) o un plugin.',
    'unminified-javascript': 'Minificá JS. En producción usá terser o esbuild.',
    'uses-optimized-images': 'Comprimí imágenes. Apuntá a <100KB por imagen.',
    'uses-text-compression': 'Habilitá Gzip/Brotli en tu servidor para texto, CSS, JS.',
    'uses-rel-preconnect': 'Agregá <link rel="preconnect"> a orígenes críticos de terceros.',
    'uses-rel-preload': 'Usá <link rel="preload"> para recursos críticos que tardan en descubrirse.',
    'server-response-time': 'Mejorá el tiempo de respuesta del servidor (<200ms). Usá cache y CDN.',
    'efficient-animated-content': 'Convertí GIF pesados a video (MP4/WebM).',
    'total-byte-weight': 'Reducí el peso total de la página. Apuntá a <1MB.',
    'dom-size': 'Reducí el tamaño del DOM. Apuntá a <1500 nodos.',
    'bootup-time': 'Reducí el tiempo de ejecución de JS. Dividí código en chunks.',
    'mainthread-work-breakdown': 'Optimizá el trabajo del hilo principal. Reducí JS no crítico.',
    'third-party-summary': 'Minimizá el impacto de scripts de terceros. Cargalos con async o diferilos.',
    'largest-contentful-paint': 'Optimizá LCP. Priorizá la carga de la imagen/texto principal.',
    'first-contentful-paint': 'Mejorá FCP. Reducí recursos bloqueantes y optimizá el render inicial.',
    'interactive': 'Optimizá TTI. Reducí JS y dividí en chunks.',
    'speed-index': 'Mejorá el Speed Index. Optimizá la carga visual progresiva.',
    'meta-description': 'Agregá una meta description única y atractiva para mejorar el CTR.',
    'document-title': 'Usá un title descriptivo y único (<60 caracteres).',
    'crawlable': 'Asegurate de que la página sea rastreable. Revisá robots.txt y meta robots.',
    'canonical': 'Agregá una URL canónica para evitar contenido duplicado.',
    'font-display': 'Usá font-display: swap para evitar FOIT (Flash of Invisible Text).',
    'errors-in-console': 'Corregí errores de la consola de JavaScript.',
    'no-document-write': 'Evitá document.write(). Usá métodos modernos de inyección.',
    'image-alt': 'Agregá texto alternativo (alt) a todas las imágenes para accesibilidad y SEO.',
    'link-text': 'Usá texto de enlace descriptivo. Evitá "click aquí" o "leer más".',
    'is-crawlable': 'Asegurate de que la página no esté bloqueada para robots.',
    'tap-targets': 'Aumentá el tamaño de los objetivos táctiles a mínimo 48x48px.',
    'color-contrast': 'Mejorá el contraste de color para cumplir con WCAG AA (mínimo 4.5:1).',
    'aria-valid-attr': 'Corregí atributos ARIA inválidos.',
    'button-name': 'Agregá nombres accesibles a los botones.',
  };

  return recs[id] || audit.description || 'Revisá las mejores prácticas para este aspecto.';
}
