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

-- =============================================================
-- TABLAS PARA REEMPLAZAR GOOGLE SHEETS
-- =============================================================

-- 13. Master URLs - Tabla principal de migración SEO
CREATE TABLE IF NOT EXISTS master_urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  path TEXT,
  type VARCHAR(50),
  priority VARCHAR(20),
  action VARCHAR(100),
  target TEXT,
  status VARCHAR(50),
  clicks INT DEFAULT 0,
  impressions INT DEFAULT 0,
  ctr FLOAT DEFAULT 0,
  position FLOAT DEFAULT 0,
  kw TEXT,
  kw_target TEXT,
  title TEXT,
  title_len INT DEFAULT 0,
  title_new TEXT,
  description TEXT,
  description_len INT DEFAULT 0,
  description_new TEXT,
  canonical TEXT,
  in_sitemap INT DEFAULT 0,
  crawl_depth INT DEFAULT 0,
  incoming_links INT DEFAULT 0,
  outgoing_links INT DEFAULT 0,
  jsonld INT DEFAULT 0,
  og INT DEFAULT 0,
  twitter INT DEFAULT 0,
  schema_type TEXT,
  issues_count INT DEFAULT 0,
  issues TEXT,
  intent VARCHAR(50),
  meta_status VARCHAR(30),
  qa VARCHAR(30),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_master_urls_url ON master_urls(url);
CREATE INDEX IF NOT EXISTS idx_master_urls_priority ON master_urls(priority);
CREATE INDEX IF NOT EXISTS idx_master_urls_action ON master_urls(action);
CREATE INDEX IF NOT EXISTS idx_master_urls_meta_status ON master_urls(meta_status);

-- 14. Metadata Audit
CREATE TABLE IF NOT EXISTS metadata_audit (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  title_len INT DEFAULT 0,
  title_new TEXT,
  description TEXT,
  description_len INT DEFAULT 0,
  description_new TEXT,
  meta_status VARCHAR(30),
  schema_type TEXT,
  priority VARCHAR(20),
  action VARCHAR(100),
  kw_target TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metadata_url ON metadata_audit(url);

-- 15. Redirects Review
CREATE TABLE IF NOT EXISTS redirects_review (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  priority VARCHAR(20),
  action VARCHAR(100),
  status VARCHAR(50),
  target TEXT,
  issues TEXT,
  recommendation TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_redirects_url ON redirects_review(url);

-- 16. Protected URLs
CREATE TABLE IF NOT EXISTS protected_urls (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  clicks INT DEFAULT 0,
  impressions INT DEFAULT 0,
  position FLOAT DEFAULT 0,
  kw TEXT,
  priority VARCHAR(20),
  action VARCHAR(100),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_protected_url ON protected_urls(url);

-- 17. Checklist Items
CREATE TABLE IF NOT EXISTS checklist_items (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  category VARCHAR(50),
  status VARCHAR(30) DEFAULT 'pending',  -- 'pending', 'in_progress', 'approved'
  assignee TEXT,
  url TEXT,
  notes TEXT,
  due_date DATE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 18. Site Health Snapshots (historial semanal)
CREATE TABLE IF NOT EXISTS site_health_snapshots (
  id SERIAL PRIMARY KEY,
  week_start DATE NOT NULL,
  score INT DEFAULT 0,
  indexing_pct FLOAT DEFAULT 0,
  cwv_score INT DEFAULT 0,
  ctr_vs_benchmark FLOAT DEFAULT 0,
  avg_position FLOAT DEFAULT 0,
  engagement_rate FLOAT DEFAULT 0,
  ux_score INT DEFAULT 0,
  keywords_top10 INT DEFAULT 0,
  breakdown JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_week ON site_health_snapshots(week_start);

-- =============================================================
-- TABLAS PARA INGESTA SEMRUSH (CSV semanal manual)
-- =============================================================

-- 19. SEMrush keyword export (Organic Positions)
CREATE TABLE IF NOT EXISTS semrush_keywords (
  id SERIAL PRIMARY KEY,
  export_date DATE NOT NULL,
  keyword TEXT NOT NULL,
  position INT,
  previous_position INT,
  search_volume INT,
  keyword_difficulty INT,
  cpc FLOAT,
  url TEXT,
  traffic INT,
  traffic_pct FLOAT,
  traffic_cost FLOAT,
  competition FLOAT,
  num_results INT,
  trends TEXT,
  serp_features TEXT,
  keyword_intents TEXT,
  position_type VARCHAR(30),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (export_date, keyword, url)
);

CREATE INDEX IF NOT EXISTS idx_semrush_kw ON semrush_keywords(keyword);
CREATE INDEX IF NOT EXISTS idx_semrush_kw_url ON semrush_keywords(url);

-- 20. Site Audit export (mega export de issues por URL)
CREATE TABLE IF NOT EXISTS site_audit (
  id SERIAL PRIMARY KEY,
  export_date DATE NOT NULL,
  page_url TEXT NOT NULL,
  http_status_code INT,
  crawl_depth INT,
  load_time_ms FLOAT,
  title TEXT,
  description TEXT,
  canonicalization TEXT,
  in_sitemap BOOLEAN,
  incoming_internal_links INT,
  outgoing_internal_links INT,
  outgoing_external_links INT,
  schema_jsonld BOOLEAN,
  schema_og BOOLEAN,
  schema_twitter BOOLEAN,
  schema_microformats BOOLEAN,
  hreflang TEXT,
  amp BOOLEAN,
  blocked_ai BOOLEAN,
  issues JSONB,
  raw_issues JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (export_date, page_url)
);

CREATE INDEX IF NOT EXISTS idx_site_audit_url ON site_audit(page_url);

-- 21. Sitemap crawl (páginas descubiertas en el crawl de SEMrush)
CREATE TABLE IF NOT EXISTS sitemap_crawl (
  id SERIAL PRIMARY KEY,
  export_date DATE NOT NULL,
  page_url TEXT NOT NULL UNIQUE,
  http_status_code INT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sitemap_crawl_url ON sitemap_crawl(page_url);

-- Columnas extra para auditoría SEMrush en master_urls (idempotente)
ALTER TABLE master_urls ADD COLUMN IF NOT EXISTS outgoing_external_links INT DEFAULT 0;
ALTER TABLE master_urls ADD COLUMN IF NOT EXISTS load_time_ms FLOAT;
ALTER TABLE master_urls ADD COLUMN IF NOT EXISTS hreflang TEXT;
ALTER TABLE master_urls ADD COLUMN IF NOT EXISTS blocked_ai BOOLEAN DEFAULT FALSE;
ALTER TABLE master_urls ADD COLUMN IF NOT EXISTS http_status_code INT;
