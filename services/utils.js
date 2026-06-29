export const fmt=new Intl.NumberFormat('es-AR');
export const COLORS=['var(--primary)','var(--green)','var(--amber)','var(--red)','var(--purple)','var(--teal)','var(--muted)'];
export const n=v=>(v??'').toString().trim();
export const num=v=>typeof v==='number'?v:Number(n(v).replace(/\./g,'').replace(',','.').replace('%','')||0)||0;
export const esc=s=>n(s).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
export const path=u=>{try{return new URL(u).pathname||'/'}catch(e){return u||'—'}};
export const pill=(t,c='gray')=>`<span class="pill ${c}">${esc(t||'—')}</span>`;
export const pclass=p=>{p=n(p).toLowerCase();if(p.includes('alta')||p.includes('high'))return'alta';if(p.includes('media')||p.includes('medium'))return'media';if(p.includes('baja')||p.includes('low'))return'baja';return'gray'};
export const countBy=(rows,key)=>{const m={};rows.forEach(r=>{const k=n(typeof key==='function'?key(r):r[key])||'Sin dato';m[k]=(m[k]||0)+1});return Object.entries(m).sort((a,b)=>b[1]-a[1])};
export const bar=entries=>{entries=entries.slice(0,7);const max=Math.max(...entries.map(e=>e[1]),1);return entries.map((e,i)=>`<div class="chartrow"><div class="chartlabel" title="${esc(e[0])}">${esc(e[0])}</div><div class="track"><div class="fill" style="width:${Math.max(3,e[1]/max*100)}%;background:${COLORS[i%COLORS.length]}"></div></div><div class="value">${fmt.format(e[1])}</div></div>`).join('')};
export const list=(rows,sub)=>rows.length?rows.map(r=>`<div class="item" data-select-url="${encodeURIComponent(r.url)}"><b>${esc(path(r.url))}</b><span>${sub(r)}</span></div>`).join(''):'<div class="muted">Sin datos para esta vista.</div>';
export const pct=(part,total)=>Math.max(0,Math.min(100,total?Math.round(part/total*100):0));
export const donuts=items=>`<div class="donutWrap">${items.map(i=>`<div class="donutCard"><div class="donutCircle" style="--pct:${pct(i.value,i.total)}" data-label="${pct(i.value,i.total)}%"></div><div><span>${esc(i.label)}</span><strong>${fmt.format(i.value)}</strong><small class="muted">de ${fmt.format(i.total)}</small></div></div>`).join('')}</div>`;
export const miniRows=(entries)=>`<div class="miniTable">${entries.slice(0,8).map(e=>`<div class="miniRow"><b title="${esc(e[0])}">${esc(e[0])}</b><span>${fmt.format(e[1])}</span></div>`).join('')}</div>`;

// ─── SVG Chart Utilities ──────────────────────────────

/**
 * Generar polyline de datos SVG
 */
function svgPolyline(data, xScale, yScale) {
  return data.map((d, i) => `${xScale(i)},${yScale(d)}`).join(' ');
}

/**
 * Sparkline miniatura (80x24) para KPIs
 */
export function sparkline(data, { color = 'var(--primary)', width = 80, height = 24 } = {}) {
  if (!data || data.length < 2) return '';
  const vals = data.map(d => d.value ?? d[1] ?? d);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pad = 2;
  const w = width - pad * 2;
  const h = height - pad * 2;
  const x = i => pad + (i / (vals.length - 1)) * w;
  const y = v => pad + h - ((v - min) / range) * h;
  const points = svgPolyline(vals, x, y);
  const trend = vals[vals.length - 1] > vals[0] ? '📈' : vals[vals.length - 1] < vals[0] ? '📉' : '➡️';
  return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="vertical-align:middle;margin-left:6px">
    <polyline fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" points="${points}"/>
  </svg>`;
}

/**
 * Trend chart completo (SVG) para período de días
 */
export function trendChart(data, {
  lines = [{ key: 'clicks', color: 'var(--primary)', label: 'Clicks' }],
  width = 700, height = 220,
  showAxis = true, showLegend = true,
} = {}) {
  if (!data || data.length < 2) return '<p class="muted" style="text-align:center;padding:20px">No hay suficientes datos para el gráfico</p>';

  const pad = { top: 16, right: 16, bottom: 32, left: 52 };
  const cw = width - pad.left - pad.right;
  const ch = height - pad.top - pad.bottom;

  // Encontrar valores máximos por línea
  let globalMax = 0, globalMin = Infinity;
  const maxPerLine = {};
  for (const line of lines) {
    let mx = 0, mn = Infinity;
    for (const d of data) {
      const v = d[line.key] ?? 0;
      mx = Math.max(mx, v);
      if (v > 0) mn = Math.min(mn, v);
    }
    maxPerLine[line.key] = mx;
    globalMax = Math.max(globalMax, mx);
    if (mn < globalMin) globalMin = mn;
  }
  if (globalMin === Infinity) globalMin = 0;
  // Redondear eje Y
  const yMax = globalMax * 1.1;
  const yMin = 0;

  const xS = i => pad.left + (i / Math.max(data.length - 1, 1)) * cw;
  const yS = v => pad.top + ch - ((v - yMin) / (yMax - yMin || 1)) * ch;

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;width:100%;height:auto">`;

  // Grid horizontal
  if (showAxis) {
    const gridCount = 4;
    for (let i = 0; i <= gridCount; i++) {
      const y = pad.top + (i / gridCount) * ch;
      const val = yMax - (i / gridCount) * yMax;
      svg += `<line x1="${pad.left}" y1="${y}" x2="${width - pad.right}" y2="${y}" stroke="var(--line)" stroke-width="1" opacity="0.5"/>`;
      svg += `<text x="${pad.left - 6}" y="${y + 4}" text-anchor="end" fill="var(--muted)" font-size="10" font-family="JetBrains Mono">${fmt.format(Math.round(val))}</text>`;
    }
    // Fechas en eje X
    const step = Math.max(1, Math.floor(data.length / 12));
    for (let i = 0; i < data.length; i += step) {
      const x = xS(i);
      const lbl = (data[i].date || '').slice(5); // MM-DD
      svg += `<text x="${x}" y="${height - 6}" text-anchor="middle" fill="var(--muted)" font-size="9" font-family="sans-serif">${lbl}</text>`;
    }
  }

  // Líneas
  for (const line of lines) {
    const vals = data.map(d => d[line.key] ?? 0);
    const pts = svgPolyline(vals, xS, yS);
    svg += `<polyline fill="none" stroke="${line.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.85" points="${pts}"/>`;
    // Puntos en cada datapoint
    // Solo algunos puntos para no saturar
    const dotStep = Math.max(1, Math.floor(data.length / 20));
    for (let i = 0; i < data.length; i += dotStep) {
      const x = xS(i);
      const y = yS(vals[i]);
      svg += `<circle cx="${x}" cy="${y}" r="2.5" fill="${line.color}" stroke="var(--panel)" stroke-width="1.5"/>`;
    }
  }

  // Leyenda
  if (showLegend) {
    svg += `<g transform="translate(${pad.left}, ${height - 14})">`;
    let ox = 0;
    for (const line of lines) {
      const lbl = `${line.label}`;
      svg += `<rect x="${ox}" y="0" width="10" height="10" rx="2" fill="${line.color}"/>`;
      svg += `<text x="${ox + 14}" y="9" fill="var(--muted)" font-size="10" font-family="sans-serif">${esc(lbl)}</text>`;
      ox += 14 + lbl.length * 7 + 16;
    }
    svg += `</g>`;
  }

  svg += '</svg>';
  return svg;
}

/**
 * Comparativa entre primera mitad y segunda mitad del período
 */
export function calcPeriodChange(data, metric) {
  if (!data || data.length < 4) return null;
  const mid = Math.floor(data.length / 2);
  const first = data.slice(0, mid);
  const second = data.slice(mid);
  const avg = arr => arr.reduce((s, d) => s + (d[metric] ?? 0), 0) / Math.max(arr.length, 1);
  const v1 = avg(first);
  const v2 = avg(second);
  const change = v1 > 0 ? ((v2 - v1) / v1) * 100 : 0;
  return { first: v1, second: v2, change, direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat' };
}

/**
 * Badge de cambio porcentual
 */
export function changeBadge(change, { reverse = false, suffix = '' } = {}) {
  const isGood = reverse ? change < 0 : change > 0;
  const absChange = Math.abs(change);
  if (absChange < 1) return `<span class="change-badge flat">→ ${absChange.toFixed(1)}%${suffix}</span>`;
  const icon = isGood ? '↑' : '↓';
  const cls = isGood ? 'up' : 'down';
  return `<span class="change-badge ${cls}">${icon} ${absChange.toFixed(1)}%${suffix}</span>`;
}
