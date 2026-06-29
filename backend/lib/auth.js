// =============================================================
// Autenticación Google Service Account
// =============================================================
import { google } from 'googleapis';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let ga4Auth = null;
let gscAuth = null;
let gtmAuth = null;

/**
 * Obtiene auth para GA4 / GSC
 * Ambas usan la misma Service Account (analytics-hitocean)
 */
export function getGoogleAuth(scopes = []) {
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_PATH
    || join(__dirname, '..', 'credentials', 'ga4-service-account.json');

  try {
    const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
    return new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      scopes,
      null
    );
  } catch (err) {
    console.error('[Auth] Error loading service account:', err.message);
    return null;
  }
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
  const keyPath = join(__dirname, '..', 'credentials', 'gtm-service-account.json');
  try {
    const key = JSON.parse(readFileSync(keyPath, 'utf-8'));
    gtmAuth = new google.auth.JWT(
      key.client_email,
      null,
      key.private_key,
      ['https://www.googleapis.com/auth/tagmanager.readonly'],
      null
    );
    return gtmAuth;
  } catch (err) {
    console.warn('[Auth] GTM key not found, skipping');
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
