// =============================================================
// Servicio de conexión a APIs externas (Backend Vercel)
// GSC, GA4, Clarity, Dashboard consolidado
// =============================================================
import { CONFIG } from '../config.js';

const BACKEND = CONFIG.BACKEND_URL;

/**
 * Fetch del dashboard consolidado (todo en 1 llamada)
 */
export async function fetchDashboard() {
  const res = await fetch(`${BACKEND}/api/dashboard?days=7`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Dashboard API: ${res.status}`);
  return res.json();
}

/**
 * Fetch de tendencias históricas
 */
export async function fetchTrends(days = 30) {
  const res = await fetch(`${BACKEND}/api/trends?days=${days}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Trends API: ${res.status}`);
  return res.json();
}

/**
 * Fetch de GSC
 */
export async function fetchGSC({ days = 7, mode = 'trends' } = {}) {
  const res = await fetch(`${BACKEND}/api/gsc?days=${days}&mode=${mode}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GSC API: ${res.status}`);
  return res.json();
}

/**
 * Fetch de GA4
 */
export async function fetchGA4({ days = 7, mode = 'trends' } = {}) {
  const res = await fetch(`${BACKEND}/api/ga4?days=${days}&mode=${mode}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`GA4 API: ${res.status}`);
  return res.json();
}

/**
 * Fetch de Clarity
 */
export async function fetchClarity({ days = 7, mode = 'trends' } = {}) {
  const res = await fetch(`${BACKEND}/api/clarity?days=${days}&mode=${mode}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Clarity API: ${res.status}`);
  return res.json();
}

/**
 * Fetch de alertas
 */
export async function fetchAlerts(mode = 'active') {
  const res = await fetch(`${BACKEND}/api/alerts?mode=${mode}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Alerts API: ${res.status}`);
  return res.json();
}

/**
 * Formatear número para display
 */
export function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return new Intl.NumberFormat('es-AR').format(n);
}

/**
 * Formatear porcentaje
 */
export function fmtPct(n) {
  if (!n && n !== 0) return '—';
  return `${(n * 100).toFixed(2)}%`;
}
