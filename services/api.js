import{CONFIG}from'../config.js';import{normalizeData}from'./normalize.js';

// Usar BACKEND_URL (Vercel) en vez de DATA_URL (Google Sheets)
const API = CONFIG.BACKEND_URL;

export async function fetchDashboardData(){
  // Desde DB (PostgreSQL en Vercel)
  const r = await fetch(`${API}/api/master`, { cache: 'no-store' });
  if (!r.ok) throw new Error('Backend HTTP ' + r.status);
  const data = await r.json();
  if (!data.ok || !data.sheets) throw new Error('Backend respondió sin datos');
  console.log('[API] Data desde PostgreSQL');
  return normalizeData(data);
}

export async function saveRowUpdate(url, updates){
  // Escribir en DB (PostgreSQL)
  const r = await fetch(`${API}/api/updateRow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key: url, updates }),
  });
  const data = await r.json();
  if (!data.ok) throw new Error(data.error || 'No se pudo guardar');
  console.log('[API] Guardado en PostgreSQL');
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