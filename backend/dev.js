#!/usr/bin/env node
// =============================================================
// Servidor de desarrollo local
// Corre las APIs como Express para testeo local
// =============================================================
import 'dotenv/config';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

// Importar handlers
import gscHandler from './api/gsc.js';
import ga4Handler from './api/ga4.js';
import clarityHandler from './api/clarity.js';
import dashboardHandler from './api/dashboard.js';
import trendsHandler from './api/trends.js';
import alertsHandler from './api/alerts.js';
import cronHandler from './api/cron.js';

// Wrapper para convertir handlers de Vercel a Express
function wrap(handler) {
  return (req, res) => {
    // Simular req.url con query string
    const baseUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    const mockReq = {
      url: req.originalUrl,
      headers: req.headers,
      method: req.method,
    };
    const mockRes = {
      writeHead: (status, headers) => {
        res.status(status);
        if (headers) {
          Object.entries(headers).forEach(([k, v]) => res.set(k, v));
        }
      },
      end: (data) => {
        if (typeof data === 'string') {
          try { res.json(JSON.parse(data)); }
          catch { res.send(data); }
        } else {
          res.json(data);
        }
      },
    };
    handler(mockReq, mockRes);
  };
}

app.get('/api/gsc', wrap(gscHandler));
app.get('/api/gsc/:mode', wrap(gscHandler));
app.get('/api/ga4', wrap(ga4Handler));
app.get('/api/ga4/:mode', wrap(ga4Handler));
app.get('/api/clarity', wrap(clarityHandler));
app.get('/api/clarity/:mode', wrap(clarityHandler));
app.get('/api/dashboard', wrap(dashboardHandler));
app.get('/api/trends', wrap(trendsHandler));
app.get('/api/alerts', wrap(alertsHandler));
app.get('/api/cron/:task', wrap(cronHandler));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
🚀 HitOcean SEO Backend - Dev Server
   http://localhost:${PORT}
   
   Endpoints:
   ──────────────────────────────────
   📊 GET /api/dashboard          → KPIs consolidados
   📈 GET /api/trends?days=30     → Tendencias históricas
   🔍 GET /api/gsc?days=7         → Google Search Console
   📊 GET /api/ga4?days=7         → Google Analytics 4
   🖱️  GET /api/clarity?days=7    → Microsoft Clarity
   🔔 GET /api/alerts             → Alertas activas
   ⏰ GET /api/cron/daily         → Sync diario manual
  `);
});
