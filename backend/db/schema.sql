-- =============================================================
-- HitOcean SEO Control Center - Database Schema
-- PostgreSQL (Vercel Postgres / Neon)
-- =============================================================

-- 1. GSC - Datos diarios por URL (detallado)
CREATE TABLE IF NOT EXISTS gsc_daily (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  query TEXT,
  date DATE NOT NULL,
  clicks INT DEFAULT 0,
  impressions INT DEFAULT 0,
  ctr FLOAT DEFAULT 0,
  position FLOAT DEFAULT 0,
  device VARCHAR(10) DEFAULT 'ALL',
  country VARCHAR(5) DEFAULT 'usa',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_daily_url ON gsc_daily(url);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_date ON gsc_daily(date);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_url_date ON gsc_daily(url, date);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_query ON gsc_daily(query);

-- 2. GSC - Datos agregados por URL (histórico permanente)
CREATE TABLE IF NOT EXISTS gsc_aggregated (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  date DATE NOT NULL,
  total_clicks INT DEFAULT 0,
  total_impressions INT DEFAULT 0,
  avg_ctr FLOAT DEFAULT 0,
  avg_position FLOAT DEFAULT 0,
  top_queries JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_agg_url ON gsc_aggregated(url);
CREATE INDEX IF NOT EXISTS idx_gsc_agg_date ON gsc_aggregated(date);

-- 3. GSC - Cobertura de indexación
CREATE TABLE IF NOT EXISTS gsc_indexing (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(30) NOT NULL,        -- 'submitted', 'indexed', 'error', 'warning'
  error_type TEXT,
  crawled_ats TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gsc_idx_url ON gsc_indexing(url);
CREATE INDEX IF NOT EXISTS idx_gsc_idx_status ON gsc_indexing(status);

-- 4. GA4 - Métricas diarias de tráfico
CREATE TABLE IF NOT EXISTS ga4_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  users INT DEFAULT 0,
  new_users INT DEFAULT 0,
  sessions INT DEFAULT 0,
  page_views INT DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  avg_session_duration FLOAT DEFAULT 0,
  bounce_rate FLOAT DEFAULT 0,
  source VARCHAR(50) DEFAULT 'ALL',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ga4_date ON ga4_daily(date);

-- 5. GA4 - Páginas populares por día
CREATE TABLE IF NOT EXISTS ga4_pages (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  url TEXT NOT NULL,
  page_views INT DEFAULT 0,
  users INT DEFAULT 0,
  avg_time_on_page FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ga4_pages_date ON ga4_pages(date);
CREATE INDEX IF NOT EXISTS idx_ga4_pages_url ON ga4_pages(url);

-- 6. Clarity - Métricas de comportamiento
CREATE TABLE IF NOT EXISTS clarity_daily (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  project_id TEXT NOT NULL,
  page_views INT DEFAULT 0,
  users INT DEFAULT 0,
  recordings INT DEFAULT 0,
  rage_clicks INT DEFAULT 0,
  dead_clicks INT DEFAULT 0,
  avg_time_on_page FLOAT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clarity_date ON clarity_daily(date);

-- 7. Clarity - Páginas con problemas de UX
CREATE TABLE IF NOT EXISTS clarity_issues (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  url TEXT NOT NULL,
  issue_type VARCHAR(50) NOT NULL,   -- 'rage_click', 'dead_click', 'quick_back'
  count INT DEFAULT 0,
  severity VARCHAR(10) DEFAULT 'low',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clarity_issues_url ON clarity_issues(url);

-- 8. SEMrush - Keywords orgánicas (desde Sheets o export)
CREATE TABLE IF NOT EXISTS semrush_keywords (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  keyword TEXT NOT NULL,
  position INT DEFAULT 0,
  volume INT DEFAULT 0,
  cpc FLOAT DEFAULT 0,
  traffic FLOAT DEFAULT 0,
  url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semrush_kw_date ON semrush_keywords(date);
CREATE INDEX IF NOT EXISTS idx_semrush_kw_keyword ON semrush_keywords(keyword);

-- 9. SEMrush - Backlinks
CREATE TABLE IF NOT EXISTS semrush_backlinks (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  source_url TEXT NOT NULL,
  target_url TEXT NOT NULL,
  anchor TEXT,
  domain_authority INT DEFAULT 0,
  first_seen DATE,
  last_seen DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_semrush_bl_target ON semrush_backlinks(target_url);

-- 10. Snapshots semanales (estado completo del sitio)
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP DEFAULT NOW(),
  week_start DATE NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_snapshots_week ON snapshots(week_start);

-- 11. Alertas automáticas
CREATE TABLE IF NOT EXISTS alerts (
  id SERIAL PRIMARY KEY,
  date TIMESTAMP DEFAULT NOW(),
  type VARCHAR(30) NOT NULL,         -- 'drop_ctr', 'drop_traffic', 'desindexada', 'drop_position'
  severity VARCHAR(10) NOT NULL,     -- 'low', 'medium', 'high', 'critical'
  title TEXT NOT NULL,
  message TEXT,
  url TEXT,
  current_value FLOAT,
  previous_value FLOAT,
  threshold FLOAT,
  metadata JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_date ON alerts(date);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts(type);

-- 12. Log de sincronización
CREATE TABLE IF NOT EXISTS sync_log (
  id SERIAL PRIMARY KEY,
  source VARCHAR(30) NOT NULL,
  status VARCHAR(20) NOT NULL,       -- 'success', 'error', 'running'
  started_at TIMESTAMP DEFAULT NOW(),
  finished_at TIMESTAMP,
  rows_inserted INT DEFAULT 0,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_log_source ON sync_log(source);
