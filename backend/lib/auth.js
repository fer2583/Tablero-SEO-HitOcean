// =============================================================
// Autenticación Google Service Account
// Soporta: archivo local o variable de entorno GOOGLE_CREDENTIALS
// =============================================================
import { google } from 'googleapis';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let ga4Auth = null;
let gscAuth = null;
let gtmAuth = null;

/**
 * Obtiene las credenciales de Service Account
 * Prioridad:
 *   1. Variable de entorno GOOGLE_CREDENTIALS (JSON string)
 *   2. Archivo local backend/credentials/ga4-service-account.json
 */
function getServiceAccountKey() {
  // Opción 1: Variable de entorno
  const envCreds = process.env.GOOGLE_CREDENTIALS;
  if (envCreds) {
    try {
      return JSON.parse(envCreds);
    } catch (e) {
      console.warn('[Auth] GOOGLE_CREDENTIALS env var is not valid JSON, trying file...');
    }
  }

  // Opción 2: archivo local
  const paths = [
    process.env.GOOGLE_SERVICE_ACCOUNT_PATH,
    join(__dirname, '..', 'credentials', 'ga4-service-account.json'),
    join(process.cwd(), 'credentials', 'ga4-service-account.json'),
  ];

  for (const p of paths) {
    if (!p) continue;
    try {
      if (existsSync(p)) {
        return JSON.parse(readFileSync(p, 'utf-8'));
      }
    } catch (e) {
      // seguir
    }
  }

  return null;
}

/**
 * Obtiene auth para GA4 / GSC
 */
export function getGoogleAuth(scopes = []) {
  const key = getServiceAccountKey();
  if (!key) {
    console.error('[Auth] No service account credentials found');
    return null;
  }

  return new google.auth.JWT(
    key.client_email,
    null,
    key.private_key,
    scopes,
    null
  );
}

/**
 * Auth para GSC (Webmasters API)
 */
export function getGSCAuth() {
  if (gscAuth) return gscAuth;
  gscAuth = getGoogleAuth(['https://www.googleapis.com/auth/webmasters.readonly']);
  return gscAuth;
}

/**
 * Auth para GA4 (Analytics Data API)
 */
export function getGA4Auth() {
  if (ga4Auth) return ga4Auth;
  ga4Auth = getGoogleAuth(['https://www.googleapis.com/auth/analytics.readonly']);
  return ga4Auth;
}

/**
 * Auth para GTM (Tag Manager API)
 */
export function getGTMAuth() {
  if (gtmAuth) return gtmAuth;

  const key = getServiceAccountKey();
  if (!key) return null;

  try {
    gtmAuth = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      ['https://www.googleapis.com/auth/tagmanager.readonly'],
      null
    );
    return gtmAuth;
  } catch (err) {
    console.warn('[Auth] GTM auth error:', err.message);
    return null;
  }
}

/**
 * Tiempo de ejecución con logging
 */
export function time(label, fn) {
  const start = Date.now();
  return fn().then(result => {
    console.log(`[Timing] ${label}: ${Date.now() - start}ms`);
    return result;
  });
}
