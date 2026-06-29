import{kpis}from'./common.js';import{bar,countBy,fmt,num,list,esc,donuts,miniRows}from'../services/utils.js';
export const meta={title:'Analytics SEO',subtitle:'Análisis de oportunidades + tendencias en vivo GSC, GA4 y Clarity.'};const rate=(r,f)=>!r.length?0:Math.round(r.filter(x=>num(x[f])===1).length/r.length*100);
export function render(s){const r=s.filtered,e=s.external,opp=r.filter(x=>num(x.impressions)>=100&&num(x.position)>=4&&num(x.position)<=20&&num(x.ctr)<0.03).sort((a,b)=>num(b.impressions)-num(a.impressions)).slice(0,10),ctr=r.filter(x=>num(x.impressions)>=100&&num(x.ctr)<0.02).sort((a,b)=>num(b.impressions)-num(a.impressions)).slice(0,10),risk=r.filter(x=>num(x.issuesCount)>0||num(x.incomingLinks)<=2||(x.issues||'').length).slice(0,10);return`${kpis(r,s)}${renderLiveTrends(e)}${renderAlerts(e)}<div class="grid2"><article class="card"><div class="chartTitle">Cobertura técnica</div>${donuts([{label:'JSON-LD',value:r.filter(x=>num(x.jsonld)===1).length,total:r.length},{label:'Open Graph',value:r.filter(x=>num(x.og)===1).length,total:r.length},{label:'Sitemap',value:r.filter(x=>num(x.inSitemap)===1).length,total:r.length}])}</article><article class="card"><div class="chartTitle">Ranking buckets</div>${bar(countBy(r,x=>{const p=num(x.position);return!p?'Sin posición':p<=3?'Top 3':p<=10?'Top 10':p<=20?'Top 20':'20+'}))}</article></div><div class="grid4"><article class="metric"><span>JSON-LD</span><strong>${rate(r,'jsonld')}%</strong></article><article class="metric"><span>Open Graph</span><strong>${rate(r,'og')}%</strong></article><article class="metric"><span>Twitter Cards</span><strong>${rate(r,'twitter')}%</strong></article><article class="metric"><span>Sitemap</span><strong>${rate(r,'inSitemap')}%</strong></article></div><div class="grid2"><article class="card"><div class="chartTitle">Intención keyword</div>${bar(countBy(r,'intent'))}</article><article class="card"><div class="chartTitle">Top issues</div>${miniRows(countBy(r,x=>(x.issues||'').split(/\||,|;/)[0]||'Sin issue'))}</article></div><div class="grid3"><article class="card"><div class="chartTitle">Opportunity Finder</div>${list(opp,x=>`Pos. ${num(x.position).toFixed(2)} · CTR ${(num(x.ctr)*100).toFixed(2)}% · ${fmt.format(num(x.impressions))} imp · ${esc(x.kw||'Sin KW')}`)}</article><article class="card"><div class="chartTitle">CTR bajo</div>${list(ctr,x=>`CTR ${(num(x.ctr)*100).toFixed(2)}% · ${fmt.format(num(x.impressions))} imp`)}</article><article class="card"><div class="chartTitle">Risk / Internal Linking</div>${list(risk,x=>`${num(x.issuesCount)} issues · ${num(x.incomingLinks)} links internos · depth ${num(x.crawlDepth)||'—'}`)}</article></div>`}

/**
 * Renderizar tendencias en vivo (GSC + GA4 + Clarity)
 */
function renderLiveTrends(e) {
  if (!e.trends || !e.trends.gsc || !e.trends.gsc.length) {
    return `<div class="card"><div class="chartTitle">📡 Tendencias en vivo</div><p class="muted">Conectando con backend de APIs...</p></div>`;
  }

  const gsc = e.trends.gsc;
  const ga4 = e.trends.ga4;
  const clarity = e.trends.clarity;

  // Calcular variaciones vs período anterior
  const half = Math.floor(gsc.length / 2);
  const recent = gsc.slice(half);
  const previous = gsc.slice(0, half);
  const recentClicks = recent.reduce((a, r) => a + parseInt(r.clicks || 0), 0);
  const prevClicks = previous.reduce((a, r) => a + parseInt(r.clicks || 0), 0);
  const clickVar = prevClicks > 0 ? ((recentClicks - prevClicks) / prevClicks * 100).toFixed(1) : 0;

  const recentImp = recent.reduce((a, r) => a + parseInt(r.impressions || 0), 0);
  const prevImp = previous.reduce((a, r) => a + parseInt(r.impressions || 0), 0);
  const impVar = prevImp > 0 ? ((recentImp - prevImp) / prevImp * 100).toFixed(1) : 0;

  // Últimos valores de GA4
  const lastGa4 = ga4.length > 0 ? ga4[ga4.length - 1] : null;

  // Bar chart simple de clics (últimos 14 días)
  const trendBars = gsc.slice(-14).map(r => {
    const max = Math.max(...gsc.slice(-14).map(x => parseInt(x.clicks || 0)), 1);
    const pct = (parseInt(r.clicks || 0) / max * 100);
    return `<div class="trendBar" title="${r.date}: ${fmt.format(parseInt(r.clicks || 0))} clics">
      <div class="trendFill" style="height:${Math.max(3, pct)}%"></div>
      <small>${r.date.slice(5)}</small>
    </div>`;
  }).join('');

  return `<div class="card">
    <div class="chartTitle">📡 Tendencias GSC · últimos ${gsc.length} días</div>
    <div class="trendSummary">
      <span class="kpi"><small>Clics recientes</small><strong>${fmt.format(recentClicks)}</strong><small class="${clickVar > 0 ? 'green' : clickVar < 0 ? 'red' : ''}">${clickVar > 0 ? '▲' : clickVar < 0 ? '▼' : '—'} ${Math.abs(clickVar)}%</small></span>
      <span class="kpi"><small>Impresiones</small><strong>${fmt.format(recentImp)}</strong><small class="${impVar > 0 ? 'green' : impVar < 0 ? 'red' : ''}">${impVar > 0 ? '▲' : impVar < 0 ? '▼' : '—'} ${Math.abs(impVar)}%</small></span>
      <span class="kpi"><small>CTR promedio</small><strong>${(gsc.reduce((a,r) => a + parseFloat(r.ctr || 0), 0) / Math.max(gsc.length, 1)).toFixed(2)}%</strong></small></span>
      ${lastGa4 ? `<span class="kpi"><small>GA4 · Sesiones último</small><strong>${fmt.format(parseInt(lastGa4.sessions || 0))}</strong><small>${lastGa4.date}</small></span>` : ''}
    </div>
    <div class="trendChart">${trendBars}</div>
  </div>`;
}

/**
 * Renderizar alertas activas
 */
function renderAlerts(e) {
  if (!e.alerts || !e.alerts.length) {
    return `<div class="card"><div class="chartTitle">🔔 Alertas</div><p class="muted">Sin alertas activas.</p></div>`;
  }

  const severityClass = s => {
    if (s === 'critical') return 'red';
    if (s === 'high') return 'amber';
    if (s === 'medium') return 'blue';
    return 'gray';
  };

  return `<div class="card">
    <div class="chartTitle">🔔 Alertas activas (${e.alerts.length})</div>
    ${e.alerts.slice(0, 10).map(a => `
      <div class="alertRow ${severityClass(a.severity)}">
        <span class="pill ${severityClass(a.severity)}">${esc(a.severity)}</span>
        <strong>${esc(a.title)}</strong>
        <span class="muted">${esc(a.message)}</span>
        ${a.url ? `<a href="${esc(a.url)}" target="_blank" class="muted">${esc(a.url.slice(0, 60))}</a>` : ''}
      </div>
    `).join('')}
  </div>`;
}
