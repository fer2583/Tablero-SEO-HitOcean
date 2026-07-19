import{kpis}from'./common.js';import{bar,countBy,fmt,num,donuts,miniRows,sparkline,calcPeriodChange,changeBadge}from'../services/utils.js';
import{fetchSiteHealth}from'../services/api.js';

export const meta={title:'Dashboard Ejecutivo',subtitle:'Vista gerencial del estado de migracion + metricas en vivo (GSC, GA4, Clarity).'};

let healthCache = null;
let healthLoading = false;

export function render(s){
  const r=s.filtered;const e=s.external;
  const done=Object.values(s.checkState).filter(Boolean).length,total=Math.max(s.data.checklist.length,1),ready=Math.round(done/total*100);
  const high=r.filter(x=>/alta|high/i.test(x.priority)).length,meta=r.filter(x=>/optim|falta|incompleto|revisar/i.test(x.metaStatus)).length;
  const redir=r.filter(x=>/301|redirect|redire/i.test(x.action)||num(x.status)===301).length,qa=r.filter(x=>!/aprobado/i.test(x.qa)).length;
  const clicks=r.reduce((a,x)=>a+num(x.clicks),0),imp=r.reduce((a,x)=>a+num(x.impressions),0);

  // Cargar health score una sola vez
  if (!healthCache && !healthLoading) {
    healthLoading = true;
    fetchSiteHealth().then(h => { healthCache = h; healthLoading = false; render(); }).catch(() => { healthLoading = false; });
  }

  return`${kpis(r,s)}${renderLiveKPIs(e)}${renderHealthWidget()}<div class="grid2"><article class="card readiness"><small>Readiness migracion</small><span class="big">${ready}%</span><p>${done} de ${s.data.checklist.length} tareas aprobadas.</p><div class="progress"><span style="width:${ready}%"></span></div></article><article class="card"><div class="chartTitle">Resumen ejecutivo</div><p class="sub">Hay <strong>${fmt.format(r.length)} URLs</strong>, <strong>${high}</strong> de prioridad alta, <strong>${meta}</strong> con metadata pendiente, <strong>${redir}</strong> redirects y <strong>${qa}</strong> tareas de QA pendientes. Acumulan <strong>${fmt.format(clicks)}</strong> clics y <strong>${fmt.format(imp)}</strong> impresiones.</p></article></div><div class="grid2"><article class="card"><div class="chartTitle">Indicadores circulares</div>${donuts([{label:'Alta prioridad',value:high,total:r.length},{label:'Metadata pendiente',value:meta,total:r.length},{label:'Redirects',value:redir,total:r.length}])}</article><article class="card"><div class="chartTitle">Top acciones</div>${miniRows(countBy(r,'action'))}</article></div><div class="grid2"><article class="card"><div class="chartTitle">Acciones</div>${bar(countBy(r,'action'))}</article><article class="card"><div class="chartTitle">Prioridad</div>${bar(countBy(r,'priority'))}</article><article class="card"><div class="chartTitle">Metadata</div>${bar(countBy(r,'metaStatus'))}</article><article class="card"><div class="chartTitle">Issues</div>${bar(countBy(r,x=>(x.issues||'').split(/\||,|;/)[0]||'Sin issue'))}</article></div>`}

function renderHealthWidget() {
  if (!healthCache) return '';
  const h = healthCache;
  const icon = h.score >= 80 ? '🟢' : h.score >= 50 ? '🟡' : '🔴';
  const items = Object.entries(h.scores || {}).map(([k, v]) =>
    `<span style="font-size:0.8em;display:inline-block;margin:0 8px 4px 0;padding:2px 8px;border-radius:12px;background:var(--bg2);border:1px solid var(--border)">${k}: ${v}/100</span>`
  ).join('');
  return `<div class="card" style="margin-bottom:12px"><div class="detailRow"><span>${icon} Site Health Score</span><strong style="font-size:1.4em">${h.score}/100</strong></div><div style="margin-top:4px">${items}</div></div>`;
}

function renderLiveKPIs(e) {
  if (!e.kpis || !e.kpis.gsc_clicks && e.kpis.gsc_clicks !== 0) {
    return `<div class="grid2"><article class="card"><div class="chartTitle">📡 Metricas en vivo</div><p class="muted">Conectando con backend de APIs... <button class="btn ghost small" onclick="this.closest('.card').innerHTML='<p class=muted>Hace clic en 📡 Live en el header para cargar datos.</p>'">📡 Cargar</button></p></article></div>`;
  }

  const k = e.kpis;
  const trends = e.trends || {};
  const gscTrend = trends.gsc || [];
  const ga4Trend = trends.ga4 || [];
  const updated = e.lastUpdated
    ? new Date(e.lastUpdated).toLocaleTimeString('es-AR')
    : '—';

  const gscClicksChange = calcPeriodChange(gscTrend, 'clicks');
  const gscImprChange = calcPeriodChange(gscTrend, 'impressions');
  const ga4UsersChange = calcPeriodChange(ga4Trend, 'users');
  const ga4PVChange = calcPeriodChange(ga4Trend, 'page_views');

  return `<div class="grid4">
    <article class="kpi green">
      <span>GSC · Clics (${k.period_days || 7}d)</span>
      <strong>${fmt.format(k.gsc_clicks)}</strong>
      <small>Search Console ${gscClicksChange ? changeBadge(gscClicksChange.change) : ''}</small>
      ${sparkline(gscTrend.map(d => ({ value: d.clicks })), { color: 'var(--green)' })}
    </article>
    <article class="kpi teal">
      <span>GSC · Impresiones</span>
      <strong>${fmt.format(k.gsc_impressions)}</strong>
      <small>${k.gsc_avg_ctr}% CTR ${gscImprChange ? changeBadge(gscImprChange.change) : ''}</small>
      ${sparkline(gscTrend.map(d => ({ value: d.impressions })), { color: 'var(--teal)' })}
    </article>
    <article class="kpi blue">
      <span>GA4 · Usuarios</span>
      <strong>${fmt.format(k.ga4_users)}</strong>
      <small>${fmt.format(k.ga4_sessions)} sesiones ${ga4UsersChange ? changeBadge(ga4UsersChange.change) : ''}</small>
      ${sparkline(ga4Trend.map(d => ({ value: d.users })), { color: 'var(--primary)' })}
    </article>
    <article class="kpi purple">
      <span>GA4 · Page Views</span>
      <strong>${fmt.format(k.ga4_page_views)}</strong>
      <small>Analytics ${ga4PVChange ? changeBadge(ga4PVChange.change) : ''}</small>
      ${sparkline(ga4Trend.map(d => ({ value: d.page_views })), { color: 'var(--purple)' })}
    </article>
    <article class="kpi amber">
      <span>Clarity · Grabaciones</span>
      <strong>${fmt.format(k.clarity_recordings)}</strong>
      <small>${fmt.format(k.clarity_rage_clicks)} rage clicks</small>
    </article>
    <article class="kpi ${(k.alerts_critical || 0) > 0 ? 'red' : 'gray'}">
      <span>Alertas activas</span>
      <strong>${k.alerts_count || 0}</strong>
      <small>${k.alerts_critical || 0} criticas · ${k.alerts_high || 0} altas</small>
    </article>
  </div>
  <div class="card" style="margin-bottom:0;padding:6px 12px;">
    <small class="muted">📡 Ultima actualizacion: ${updated} · Fuentes: GSC + GA4 + Clarity</small>
  </div>`;
}
