import{CONFIG}from'../config.js';
import{uploadSemrushCSV,fetchSiteHealth}from'../services/api.js';

export const meta={title:'Setup técnico',subtitle:'Estado de conexión, endpoints, arquitectura y publicación.'};

export function render(s){return`
<!-- Estado de la DB -->
<article class="card" style="margin-bottom:12px">
  <div class="detailRow"><span>🏗️ Arquitectura</span><p><strong>PostgreSQL + Vercel</strong> (reemplazó Google Sheets)</p></div>
  <div class="detailRow"><span>API principal</span><p><code>${CONFIG.BACKEND_URL}/api/master</code></p></div>
  <div class="detailRow"><span>Base de datos</span><p>Vercel Postgres (Neon) · 12 tablas</p></div>
  <div class="detailRow"><span>Datos cargados</span><p>${s.data.master.length} URLs master · ${s.data.redirects.length} redirects · ${s.data.protected.length} protegidas · ${s.data.checklist.length} tareas</p></div>
  <div class="detailRow"><span>Última actualización</span><p>${s.external.lastUpdated ? new Date(s.external.lastUpdated).toLocaleString('es-AR') : '—'}</p></div>
</article>

<!-- Site Health Score -->
<article class="card" style="margin-bottom:12px">
  <div class="detailRow"><span>🟢 Site Health Score</span><p><strong id="healthScore">Cargando...</strong></p></div>
  <div id="healthDetails" style="padding:8px 0"></div>
  <button class="btn ghost small" id="refreshHealth">↻ Refrescar health score</button>
</article>

<!-- Importación SEMrush -->
<article class="card" style="margin-bottom:12px">
  <div class="detailRow"><span>📤 Importar CSV de SEMrush</span><p>Exportá desde SEMrush → Organic Research → CSV y subilo acá. Se importa automáticamente a la base de datos.</p></div>
  <div style="padding:12px 0;display:flex;gap:12px;align-items:center;flex-wrap:wrap">
    <input type="file" id="semrushFile" accept=".csv" style="flex:1;min-width:200px;padding:8px;border:1px solid var(--border);border-radius:6px;background:var(--bg)">
    <button class="btn" id="uploadSemrush">⬆ Subir e importar</button>
  </div>
  <div id="semrushStatus" class="muted" style="padding:4px 0;font-size:0.9em"></div>
</article>

<!-- Endpoints -->
<article class="card">
  <div class="detailRow"><span>BACKEND_URL</span><p><code>${CONFIG.BACKEND_URL}</code></p></div>
  <div class="detailRow"><span>GET /api/master</span><p>Master URLs + Metadata + Keywords + Redirects + Protected + Checklist</p></div>
  <div class="detailRow"><span>POST /api/updateRow</span><p>Actualizar registro en DB (reemplaza doPost)</p></div>
  <div class="detailRow"><span>POST /api/semrush/upload</span><p>Subir CSV de SEMrush → DB</p></div>
  <div class="detailRow"><span>GET /api/site-health</span><p>Site Health Score calculado con datos en vivo</p></div>
  <div class="detailRow"><span>GET /api/dashboard</span><p>KPIs consolidados de GSC + GA4 + Clarity</p></div>
  <div class="detailRow"><span>Legacy DATA_URL</span><p><code style="opacity:0.5">${CONFIG.DATA_URL}</code> (descontinuado)</p></div>
  <div class="detailRow"><span>Legacy SHEET_URL</span><p><a href="${CONFIG.SHEET_URL}" target="_blank" style="opacity:0.5">Abrir Google Sheet</a> (descontinuado)</p></div>
</article>`}

export function bindComponent(){
  // Health Score
  loadHealthScore();
  document.getElementById('refreshHealth')?.addEventListener('click', loadHealthScore);

  // Upload SEMrush CSV
  document.getElementById('uploadSemrush')?.addEventListener('click', async () => {
    const fileInput = document.getElementById('semrushFile');
    const status = document.getElementById('semrushStatus');
    if (!fileInput?.files?.length) {
      status.textContent = '⚠️ Seleccioná un archivo CSV primero';
      status.style.color = 'var(--amber)';
      return;
    }
    const file = fileInput.files[0];
    status.textContent = '⏳ Subiendo e importando...';
    status.style.color = 'var(--text)';
    try {
      const result = await uploadSemrushCSV(file);
      status.textContent = `✅ ${result.rows_imported} keywords importadas correctamente desde SEMrush`;
      status.style.color = 'var(--green)';
      fileInput.value = '';
    } catch (err) {
      status.textContent = `❌ Error: ${err.message}`;
      status.style.color = 'var(--red)';
    }
  });
}

async function loadHealthScore() {
  const scoreEl = document.getElementById('healthScore');
  const detailsEl = document.getElementById('healthDetails');
  if (!scoreEl) return;
  try {
    const health = await fetchSiteHealth();
    const score = health.score || 0;
    const icon = score >= 80 ? '🟢' : score >= 50 ? '🟡' : '🔴';
    scoreEl.textContent = `${icon} ${score}/100`;

    detailsEl.innerHTML = Object.entries(health.scores || {}).map(([key, val]) =>
      `<div class="detailRow" style="padding:2px 0"><span>${key}</span><p>${val}/100</p></div>`
    ).join('');
  } catch (err) {
    scoreEl.textContent = '❌ Error al cargar';
    detailsEl.textContent = err.message;
  }
}
