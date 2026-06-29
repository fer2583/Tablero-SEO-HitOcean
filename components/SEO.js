// =============================================================
// SEO Analytics — Queries, Páginas, Insights por plataforma
// =============================================================

export const meta = {
  title: 'SEO Analytics',
  subtitle: 'Rendimiento orgánico: consultas, URLs, posición y oportunidades.',
};

// Estado interno de ordenamiento
let sortState = {
  queries: { col: 'clicks', dir: 'desc' },
  pages: { col: 'clicks', dir: 'desc' },
  intersections: { col: 'clicks', dir: 'desc' },
};

export function render(s) {
  const ext = s.external;
  const gscData = ext.gscData || {};
  const days = ext.daysRange || 180;

  if (ext.loading) {
    return `<div class="card"><p class="muted" style="padding:60px;text-align:center;font-size:18px">⏳ Cargando datos SEO...</p></div>`;
  }

  if (!gscData.byQuery || gscData.byQuery.length === 0) {
    return `<div class="card"><p class="muted" style="padding:60px;text-align:center;font-size:18px">📡 Apretá <strong>📡 Live</strong> para cargar datos SEO</p></div>`;
  }

  // ── Procesar datos ────────────────────────────────
  const queries = aggregateQueries(gscData.byQuery);
  const pages = aggregatePages(gscData.byUrl);
  const intersections = (gscData.detailed || [])
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50);

  // Totals
  const totalClicks = queries.reduce((a, q) => a + q.clicks, 0);
  const totalImpr = queries.reduce((a, q) => a + q.impressions, 0);
  const avgCTR = totalImpr > 0 ? totalClicks / totalImpr : 0;
  const avgPos = queries.reduce((a, q) => a + q.position * q.clicks, 0) / (totalClicks || 1);

  // ── Posición distribution ──────────────────────────
  const dist = { p1_3: 0, p4_10: 0, p11_20: 0, p21_50: 0, p50plus: 0 };
  pages.forEach(p => {
    const pos = p.position || 999;
    if (pos <= 3) dist.p1_3++;
    else if (pos <= 10) dist.p4_10++;
    else if (pos <= 20) dist.p11_20++;
    else if (pos <= 50) dist.p21_50++;
    else dist.p50plus++;
  });
  const distTotal = Object.values(dist).reduce((a, b) => a + b, 0) || 1;

  // ── Quick Wins: alta impresión, bajo CTR ──────────
  const quickWins = pages
    .filter(p => p.impressions >= 100 && p.ctr < 0.05)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 15);

  // ── Brand vs Non-brand ────────────────────────────
  const brandTerms = ['hit ocean', 'hitocean', 'hito', 'hit ocean empresa', 'hit ocean servicios', 'hit ocean soluciones'];
  let brandClicks = 0, brandImpr = 0, nonBrandClicks = 0, nonBrandImpr = 0;
  queries.forEach(q => {
    const isBrand = brandTerms.some(t => q.query.toLowerCase().includes(t));
    if (isBrand) { brandClicks += q.clicks; brandImpr += q.impressions; }
    else { nonBrandClicks += q.clicks; nonBrandImpr += q.impressions; }
  });
  const brandPct = totalClicks > 0 ? (brandClicks / totalClicks) * 100 : 0;

  // ── Render ────────────────────────────────────────

  // KPIs superiores
  const kpis = `
    <div class="kpis" style="grid-template-columns:repeat(6,1fr);margin-bottom:16px">
      <div class="kpi blue"><span>Consultas únicas</span><strong>${fmt(queries.length)}</strong><small>en ${days} días</small></div>
      <div class="kpi teal"><span>Páginas indexadas</span><strong>${fmt(pages.length)}</strong><small>con tráfico orgánico</small></div>
      <div class="kpi green"><span>Clicks totales</span><strong>${fmt(totalClicks)}</strong><small>+${fmt(brandClicks)} brand / ${fmt(nonBrandClicks)} no-brand</small></div>
      <div class="kpi purple"><span>Impresiones</span><strong>${fmt(totalImpr)}</strong><small>en Google</small></div>
      <div class="kpi amber"><span>CTR promedio</span><strong>${fmtPct(avgCTR)}</strong><small>${fmtPct(brandPct/100)} es brand</small></div>
      <div class="kpi red"><span>Posición media</span><strong>${fmtPos(avgPos)}</strong><small>ponderada por clicks</small></div>
    </div>`;

  // Quick Wins bar
  const quickWinsHtml = quickWins.length > 0 ? `
    <div class="card quickwins-card" style="margin-bottom:12px">
      <div class="chartTitle">⚡ Quick Wins — páginas con alta impresión pero bajo CTR</div>
      <div class="quickwins-grid">
        ${quickWins.map(p => {
          const potential = Math.round(p.impressions * 0.05 - p.clicks); // qué pasaría con CTR 5%
          return `<div class="quickwin-item">
            <div class="quickwin-url"><a href="${esc(p.url)}" target="_blank">${shortUrl(p.url)}</a></div>
            <div class="quickwin-metrics">
              <span><strong>${fmt(p.impressions)}</strong> impresiones</span>
              <span><strong>${fmt(p.clicks)}</strong> clicks</span>
              <span><strong>${fmtPct(p.ctr)}</strong> CTR</span>
              <span class="quickwin-potential">+${fmt(potential)} potenciales</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>` : '';

  // Position distribution chart
  const posChartHtml = `
    <div class="card pos-chart-card" style="margin-bottom:12px">
      <div class="chartTitle">📊 Distribución de posiciones</div>
      <div class="pos-bars">
        ${[
          { key: 'p1_3', label: 'Top 3', color: 'var(--green)' },
          { key: 'p4_10', label: '4-10', color: 'var(--primary)' },
          { key: 'p11_20', label: '11-20', color: 'var(--amber)' },
          { key: 'p21_50', label: '21-50', color: 'var(--purple)' },
          { key: 'p50plus', label: '50+', color: 'var(--red)' },
        ].map(b => {
          const pct = (dist[b.key] / distTotal) * 100;
          return `<div class="pos-bar-item">
            <small>${b.label}</small>
            <div class="pos-track"><div class="pos-fill" style="width:${pct}%;background:${b.color}"></div></div>
            <span class="pos-val">${fmt(dist[b.key])} <small>(${pct.toFixed(1)}%)</small></span>
          </div>`;
        }).join('')}
      </div>
    </div>`;

  // Tabla de Queries
  const queriesSorted = sortData(queries, sortState.queries.col, sortState.queries.dir);
  const queriesHtml = queriesSorted.slice(0, 60).map((q, i) => {
    const delta = q.position < 5 ? 'green' : q.position < 15 ? 'amber' : 'red';
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="query-cell"><span class="query-text">${esc(q.query)}</span></td>
      <td class="num">${fmt(q.clicks)}</td>
      <td class="num">${fmt(q.impressions)}</td>
      <td class="num">${fmtPct(q.ctr)}</td>
      <td class="num"><span class="pos-indicator ${delta}">${fmtPos(q.position)}</span></td>
    </tr>`;
  }).join('');

  // Tabla de Páginas
  const pagesSorted = sortData(pages, sortState.pages.col, sortState.pages.dir);
  const pagesHtml = pagesSorted.slice(0, 60).map((p, i) => {
    const delta = p.position < 5 ? 'green' : p.position < 15 ? 'amber' : 'red';
    return `<tr>
      <td class="rank">${i + 1}</td>
      <td class="url-cell"><a href="${esc(p.url)}" target="_blank" class="url-link">${shortUrl(p.url)}</a></td>
      <td class="num">${fmt(p.clicks)}</td>
      <td class="num">${fmt(p.impressions)}</td>
      <td class="num">${fmtPct(p.ctr)}</td>
      <td class="num"><span class="pos-indicator ${delta}">${fmtPos(p.position)}</span></td>
    </tr>`;
  }).join('');

  // Tabla Query → URL
  const interSorted = sortData(intersections, sortState.intersections.col, sortState.intersections.dir);
  const interHtml = interSorted.map((d, i) => `
    <tr>
      <td class="rank">${i + 1}</td>
      <td class="query-cell"><span class="query-text">${esc(d.url)}</span></td>
      <td class="url-cell"><a href="${esc(d.query)}" target="_blank" class="url-link">${shortUrl(d.query)}</a></td>
      <td class="num">${fmt(d.clicks)}</td>
      <td class="num">${fmt(d.impressions)}</td>
      <td class="num">${fmtPct(d.ctr)}</td>
      <td class="num">${fmtPos(d.position)}</td>
    </tr>`).join('');

  // Sort arrows helper
  const sortArrow = (table, col) => {
    const st = sortState[table];
    if (st.col !== col) return '';
    return st.dir === 'desc' ? ' ↓' : ' ↑';
  };

  const makeSortable = (table, col, label) =>
    `<th class="sortable" data-sort-table="${table}" data-sort-col="${col}">${label}${sortArrow(table, col)}</th>`;

  return `
    ${kpis}

    <!-- Platform Tabs -->
    <div class="seo-tabs">
      <button class="seo-tab active" data-seo-tab="gsc">📊 Google Search Console</button>
      <button class="seo-tab" data-seo-tab="queries">🔗 Queries → URLs</button>
      <button class="seo-tab" data-seo-tab="insights">💡 Insights</button>
    </div>

    <!-- ─── GSC View ─── -->
    <div class="seo-panel" id="seo-gsc">
      ${quickWinsHtml}
      ${posChartHtml}
      <div class="grid2" style="margin-top:0">
        <!-- Top Queries -->
        <div class="card">
          <div class="chartTitle">🏆 Top Queries <span class="badge">${fmt(queries.length)}</span></div>
          <div class="table-scroll">
            <table class="seo-table" data-sort-table="queries">
              <thead><tr>
                <th>#</th>
                <th>Consulta</th>
                ${makeSortable('queries', 'clicks', 'Clicks')}
                ${makeSortable('queries', 'impressions', 'Impr.')}
                ${makeSortable('queries', 'ctr', 'CTR')}
                ${makeSortable('queries', 'position', 'Pos.')}
              </tr></thead>
              <tbody>${queriesHtml}</tbody>
            </table>
          </div>
        </div>

        <!-- Top Pages -->
        <div class="card">
          <div class="chartTitle">📄 Top Páginas <span class="badge">${fmt(pages.length)}</span></div>
          <div class="table-scroll">
            <table class="seo-table" data-sort-table="pages">
              <thead><tr>
                <th>#</th>
                <th>URL</th>
                ${makeSortable('pages', 'clicks', 'Clicks')}
                ${makeSortable('pages', 'impressions', 'Impr.')}
                ${makeSortable('pages', 'ctr', 'CTR')}
                ${makeSortable('pages', 'position', 'Pos.')}
              </tr></thead>
              <tbody>${pagesHtml}</tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <!-- ─── Queries → URLs View ─── -->
    <div class="seo-panel hidden" id="seo-queries">
      <div class="card" style="margin-top:12px">
        <div class="chartTitle">🔗 Qué consultas traen tráfico a cada URL <span class="badge">${fmt(intersections.length)}</span></div>
        <div class="table-scroll">
          <table class="seo-table" data-sort-table="intersections">
            <thead><tr>
              <th>#</th>
              <th>Consulta</th>
              <th>URL</th>
              ${makeSortable('intersections', 'clicks', 'Clicks')}
              ${makeSortable('intersections', 'impressions', 'Impr.')}
              ${makeSortable('intersections', 'ctr', 'CTR')}
              ${makeSortable('intersections', 'position', 'Pos.')}
            </tr></thead>
            <tbody>${interHtml}</tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ─── Insights View ─── -->
    <div class="seo-panel hidden" id="seo-insights">
      <div class="grid2" style="margin-top:12px">
        <div class="card">
          <div class="chartTitle">📊 Distribución de posiciones</div>
          <div class="pos-bars" style="margin-top:8px">
            ${[
              { key: 'p1_3', label: 'Top 3', color: 'var(--green)' },
              { key: 'p4_10', label: '4-10', color: 'var(--primary)' },
              { key: 'p11_20', label: '11-20', color: 'var(--amber)' },
              { key: 'p21_50', label: '21-50', color: 'var(--purple)' },
              { key: 'p50plus', label: '50+', color: 'var(--red)' },
            ].map(b => {
              const pct = (dist[b.key] / distTotal) * 100;
              return `<div class="pos-bar-item">
                <small>${b.label}</small>
                <div class="pos-track"><div class="pos-fill" style="width:${pct}%;background:${b.color}"></div></div>
                <span class="pos-val">${fmt(dist[b.key])} (${pct.toFixed(1)}%)</span>
              </div>`;
            }).join('')}
          </div>
        </div>
        <div class="card">
          <div class="chartTitle">🏷️ Brand vs No-Brand</div>
          <div style="margin-top:12px">
            <div class="pie-chart" style="--brand:${brandPct}%;--nonbrand:${100-brandPct}%">
              <div class="pie-segment brand"></div>
              <div class="pie-segment nonbrand"></div>
              <div class="pie-label">${fmtPct(brandPct/100)}</div>
            </div>
            <div style="display:flex;gap:16px;justify-content:center;margin-top:12px">
              <div><span class="color-dot" style="background:var(--primary)"></span> Brand: ${fmt(brandClicks)} clicks</div>
              <div><span class="color-dot" style="background:var(--amber)"></span> No-brand: ${fmt(nonBrandClicks)} clicks</div>
            </div>
          </div>
        </div>
      </div>
      ${quickWins.length > 0 ? `<div class="card" style="margin-top:12px">
        <div class="chartTitle">⚡ Quick Wins — mejora el CTR de estas páginas</div>
        <div class="quickwins-grid">${quickWins.map(p => {
          const potential = Math.round(p.impressions * 0.05 - p.clicks);
          return `<div class="quickwin-item">
            <div class="quickwin-url"><a href="${esc(p.url)}" target="_blank">${shortUrl(p.url)}</a></div>
            <div class="quickwin-metrics">
              <span>${fmt(p.impressions)} impresiones</span>
              <span>${fmt(p.clicks)} clicks</span>
              <span>CTR ${fmtPct(p.ctr)}</span>
              <span class="quickwin-potential">+${fmt(potential)} potenciales con CTR 5%</span>
            </div>
          </div>`;
        }).join('')}</div>
      </div>` : ''}
    </div>
  `;
}

// ─── Bind events ────────────────────────────────
export function bindComponent() {
  // Tab switching
  document.querySelectorAll('.seo-tab').forEach(tab => {
    tab.onclick = () => {
      document.querySelectorAll('.seo-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      document.querySelectorAll('.seo-panel').forEach(p => p.classList.add('hidden'));
      const panel = document.getElementById(`seo-${tab.dataset.seoTab}`);
      if (panel) panel.classList.remove('hidden');
    };
  });

  // Sortable columns — usamos window.__seoRender para re-renderizar
  document.querySelectorAll('.seo-table th.sortable').forEach(th => {
    th.onclick = () => {
      const table = th.dataset.sortTable;
      const col = th.dataset.sortCol;
      const st = sortState[table];
      if (st.col === col) {
        st.dir = st.dir === 'desc' ? 'asc' : 'desc';
      } else {
        st.col = col;
        st.dir = 'desc';
      }
      // Re-render usando el cache guardado
      if (typeof window.__seoRender === 'function') {
        window.__seoRender();
      }
    };
  });
}

// ─── Data processing ────────────────────────────

function aggregateQueries(rows) {
  const map = {};
  for (const r of rows) {
    const q = (r.url || '').trim();
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
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      ctr: q.impressions > 0 ? q.clicks / q.impressions : 0,
      position: q.count > 0 ? q.posSum / q.count : 999,
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
      url: p.url,
      clicks: p.clicks,
      impressions: p.impressions,
      ctr: p.impressions > 0 ? p.clicks / p.impressions : 0,
      position: p.count > 0 ? p.posSum / p.count : 999,
    }))
    .sort((a, b) => b.clicks - a.clicks);
}

function sortData(data, col, dir) {
  const sorted = [...data];
  sorted.sort((a, b) => {
    let va = a[col] || 0;
    let vb = b[col] || 0;
    if (typeof va === 'string') {
      va = va.toLowerCase();
      vb = (vb || '').toLowerCase();
      return dir === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
    }
    return dir === 'desc' ? vb - va : va - vb;
  });
  return sorted;
}

// ─── Helpers ────────────────────────────────────

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
