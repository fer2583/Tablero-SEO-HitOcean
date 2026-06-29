// =============================================================
// Debug endpoint - verificar variables de entorno
// =============================================================
export default async function handler(req, res) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
  };

  const envVars = {
    DATABASE_URL: process.env.DATABASE_URL ? '✅ SET (starts with: ' + process.env.DATABASE_URL.substring(0, 20) + '...)' : '❌ NOT SET',
    GA4_PROPERTY_ID: process.env.GA4_PROPERTY_ID || '❌ NOT SET',
    GSC_SITE_URL: process.env.GSC_SITE_URL || '❌ NOT SET',
    CLARITY_PROJECT_ID: process.env.CLARITY_PROJECT_ID || '❌ NOT SET',
    CLARITY_TOKEN: process.env.CLARITY_TOKEN ? '✅ SET (length: ' + process.env.CLARITY_TOKEN.length + ')' : '❌ NOT SET',
    GOOGLE_CREDENTIALS: process.env.GOOGLE_CREDENTIALS ? '✅ SET (length: ' + process.env.GOOGLE_CREDENTIALS.length + ')' : '❌ NOT SET',
    NODE_ENV: process.env.NODE_ENV || '❌ NOT SET',
    VERCEL_ENV: process.env.VERCEL_ENV || '❌ NOT SET',
    ALL_ENV_KEYS: Object.keys(process.env).filter(k => !k.includes('KEY') && !k.includes('SECRET') && !k.includes('TOKEN') && !k.includes('CREDENTIAL')).sort(),
  };

  res.writeHead(200, { 'Content-Type': 'application/json', ...corsHeaders });
  res.end(JSON.stringify({ ok: true, env: envVars }, null, 2));
}
