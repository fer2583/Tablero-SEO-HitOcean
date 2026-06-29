// =============================================================
// SEO Analytics — Queries, Páginas, y datos por plataforma
// =============================================================

export const meta = {
  title: 'SEO Analytics',
  subtitle: 'Rendimiento orgánico: consultas, URLs y métricas por plataforma.',
};

/**
 * Renderizar vista SEO con datos de GSC, GA4 y Clarity
 */
export function render(s) {
  const ext = s.external;
  const gscData = ext.gscData || {};
  const days = ext.daysRange || 180;

  if (ext.loading) {
    return `<div class="card"><p class="muted" style="padding:40px;text-align:center">⏳ Cargando datos SEO...</p></div>`;
  }

  if (!gscData.byQuery || gscData.byQuery.length === 0) {
    return `<div class="card"><p class="muted" style="padding:40px;text-align:center">📡 Apretá Live para cargar datos SEO</p></div>`;
  }

  // Procesar queries (byQuery: url=queryText, query=date)
  const queries = aggregateQueries(gscData.byQuery);
  const pages = aggregatePages(gscData.byUrl);

  // Top queries
  const topQueries = queries.slice(0, 50)
    .map((q, i) => `<tr>
      <td class="rank">${i + 1}</td>
      <td class="query-cell"><span class="query-text">${esc(q.query)}</span></td>
      <td class="num">${fmt(q.clicks)}</td>
      <td class="num">${fmt(q.impressions)}</td>
      <td class="num">${fmtPct(q.ctr)}</td>
      <td class="num">${fmtPos(q.position)}</td>
    </tr>`).join('');

  // Top pages
  const topPages = pages.slice(0, 50)
    .map((p, i) => `<tr>
      <td class="rank">${i + 1}</td>
      <td class="url-cell"><a href="${esc(p.url)}" target="_blank" class="url-link">${shortUrl(p.url)}</a></td>
      <td class="num">${fmt(p.clicks)}</td>
      <td class="num">${fmt(p.impressions)}</td>
      <td class="num">${fmtPct(p.ctr)}</td>
      <td class="num">${fmtPos(p.position)}</td>
    </tr>`).join('');

  // Query × URL intersections (detailed)
  const intersections = gscData.detailed || [];
  const topIntersections = intersections
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 30)
    .map((d, i) => `<tr>
      <td class="rank">${i + 1}</td>
      <td class="query-cell"><span class="query-text">${esc(d.url)}</span></td>
      <td class="url-cell"><a href="${esc(d.query)}" target="_blank" class="url-link">${shortUrl(d.query)}</a></td>
      <td class="num">${fmt(d.clicks)}</td>
      <td class="num">${fmt(d.impressions)}</td>
      <td class="num">${fmtPct(d.ctr)}</td>
      <td class="num">${fmtPos(d.position)}</td>
    </tr>`).join('');

  // Resumen KPIs
  const totalClicks = queries.reduce((a, q) => a + q.clicks, 0);
  const totalImpr = queries.reduce((a, q) => a + q.impressions, 0);
  const avgCTR = totalImpr > 0 ? totalClicks / totalImpr : 0;
  const avgPos = queries.reduce((a, q) => a + q.position * q.clicks, 0) / (totalClicks || 1);
  const uniqueQueries = queries.length;
  const uniquePages = pages.length;

  return `
    <!-- KPI summary -->
    <div class="kpis" style="grid-template-columns:repeat(6,1fr);margin-bottom:16px">
      <div class="kpi blue"><span>Consultas únicas</span><strong>${fmt(uniqueQueries)}</strong></div>
      <div class="kpi teal"><span>Páginas indexadas</span><strong>${fmt(uniquePages)}</strong></div>
      <div class="kpi green"><span>Clicks totales</span><strong>${fmt(totalClicks)}</strong></div>
      <div class="kpi purple"><span>Impresiones</span><strong>${fmt(totalImpr)}</strong></div>
      <div class="kpi amber"><span>CTR promedio</span><strong>${fmtPct(avgCTR)}</strong></div>
      <div class="kpi red"><span>Posición media</span><strong>${fmtPos(avgPos)}</strong></div>
    </div>

    <!-- Platform Tabs -->
    <div class="seo-tabs">
      <button class="seo-tab active" data-seo-tab="gsc">📊 Google Search Console</button>
      <button class="seo-tab" data-seo-tab="queries">🔍 Queries → URLs</button>
    </div>

    <!-- GSC View -->
    <div class="seo-panel" id="seo-gsc">
      <div class="grid2" style="margin-top:12px">
        <!-- Top Queries -->
        <div class="card">
          <div class="chartTitle">🏆 Top Queries</div>
          <div style="max-height:500px;overflow:auto">
            <table class="seo-table">
              <thead><tr>
                <th>#</th><th>Consulta</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th>
              </tr></thead>
              <tbody>${topQueries}</tbody>
            </table>
          </div>
        </div>

        <!-- Top Pages -->
        <div class="card">
          <div class="chartTitle">📄 Top Páginas</div>
          <div style="max-height:500px;overflow:auto">
            <table class="seo-table">
              <thead><tr>
                <th>#</th><th>URL</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th>
              </tr></thead>
              <tbody>${topPages}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- Queries → URLs View -->
    <div class="seo-panel hidden" id="seo-queries">
      <div class="card" style="margin-top:12px">
        <div class="chartTitle">🔗 Qué consultas traen tráfico a cada URL</div>
        <div style="max-height:600px;overflow:auto">
          <table class="seo-table">
            <thead><tr>
              <th>#</th><th>Consulta</th><th>URL</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th>
            </tr></thead>
            <tbody>${topIntersections}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

/**
 * Bind events for SEO view
 */
export function bindComponent() {
  document.querySelectorAll('.seo-tab').forEach(tab => {
    tab.onclick = () => {
      // Update tabs
      document.querySelectorAll('.seo-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Show panel
      const target = tab.dataset.seoTab;
      document.querySelectorAll('.seo-panel').forEach(p => p.classList.add('hidden'));
      const panel = document.getElementById(`seo-${target}`);
      if (panel) panel.classList.remove('hidden');
    };
  });
}

// ─── Helper functions ───────────────────────────

function aggregateQueries(rows) {
  const map = {};
  for (const r of rows) {
    const q = (r.url || '').trim().toLowerCase();
    if (!q) continue;
    if (!map[q]) map[q] = { query: r.url, clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
    map[q].clicks += r.clicks || 0;
    map[q].impressions += r.impressions || 0;
    map[q].ctrSum += r.ctr || 0;
    map[q].posSum += r.position || 0;
    map[q].count++;
  }
  return Object.values(map)
    .map(q => ({
      ...q,
      ctr: q.impressions > 0 ? q.clicks / q.impressions : 0,
      position: q.count > 0 ? q.posSum / q.count : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

function aggregatePages(rows) {
  const map = {};
  for (const r of rows) {
    const url = r.url || '';
    if (!url) continue;
    if (!map[url]) map[url] = { url, clicks: 0, impressions: 0, ctrSum: 0, posSum: 0, count: 0 };
    map[url].clicks += r.clicks || 0;
    map[url].impressions += r.impressions || 0;
    map[url].ctrSum += r.ctr || 0;
    map[url].posSum += r.position || 0;
    map[url].count++;
  }
  return Object.values(map)
    .map(p => ({
      ...p,
      ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
      position: p.count > 0 ? p.posSum / p.count : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

function shortUrl(url) {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s || '';
  return d.innerHTML;
}

function fmt(n) {
  if (n === 0 || n === null || n === undefined) return '0';
  return new Intl.NumberFormat('es-AR').format(Math.round(n));
}

function fmtPct(n) {
  if (!n && n !== 0) return '0%';
  return (n * 100).toFixed(1) + '%';
}

function fmtPos(n) {
  if (!n && n !== 0) return '—';
  return n.toFixed(1);
}
