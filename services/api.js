import{CONFIG}from'../config.js';import{normalizeData}from'./normalize.js';

// Usar BACKEND_URL (Vercel) en vez de DATA_URL (Google Sheets)
const API = CONFIG.BACKEND_URL;

export async function fetchDashboardData(){
  // Intentar desde DB (PostgreSQL en Vercel)
  try {
    const r = await fetch(`${API}/api/master`, { cache: 'no-store' });
    if (r.ok) {
      const data = await r.json();
      if (data.ok && data.sheets) {
        console.log('[API] Data desde PostgreSQL');
        return normalizeData(data);
      }
    }
  } catch (e) {
    console.warn('[API] DB no disponible, fallback a Google Sheets:', e.message);
  }

  // Fallback: Google Sheets (hasta que la DB esté lista)
  const r = await fetch(CONFIG.DATA_URL, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return normalizeData(await r.json());
}

export async function saveRowUpdate(url, updates){
  // Intentar escribir en DB (PostgreSQL)
  try {
    const r = await fetch(`${API}/api/updateRow`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: url, updates }),
    });
    const data = await r.json();
    if (data.ok) {
      console.log('[API] Guardado en PostgreSQL');
      return data;
    }
  } catch (e) {
    console.warn('[API] DB write fallback a Google Sheets:', e.message);
  }

  // Fallback: Google Sheets
  const payload = { action: 'updateRow', sheetName: 'Master SEO Migración', keyColumn: 'URL actual', key: url, updates };
  const r = await fetch(CONFIG.POST_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'No se pudo guardar');
  return data;
}

export async function uploadSemrushCSV(file){
  const formData = new FormData();
  formData.append('file', file);
  const r = await fetch(`${API}/api/semrush/upload`, {
    method: 'POST',
    body: formData,
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'Error al subir CSV');
  return data;
}

export async function fetchSiteHealth(){
  const r = await fetch(`${API}/api/site-health`, { cache: 'no-store' });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}