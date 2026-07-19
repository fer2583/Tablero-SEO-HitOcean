// =============================================================
// Conexión a PostgreSQL (Neon / Vercel Postgres)
// =============================================================
import pg from 'pg';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

let pool = null;

export function getPool() {
  if (pool) return pool;

  const connectionString = process.env.PGDATABASE_URL || process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn('[DB] DATABASE_URL no configurada, usando mock en memoria');
    return createMockPool();
  }

  pool = new pg.Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
    max: 5,
    idleTimeoutMillis: 30000,
  });

  return pool;
}

// Mock pool para desarrollo local sin DB
function createMockPool() {
  const store = {
    gsc_daily: [],
    ga4_daily: [],
    clarity_daily: [],
    alerts: [],
    snapshots: [],
    sync_log: [],
  };

  return {
    query: async (text, params) => {
      console.log(`[DB MOCK] ${text.slice(0, 80)}...`);
      return { rows: [], rowCount: 0 };
    },
    end: async () => {},
    _store: store,
  };
}

export async function query(text, params) {
  const client = getPool();
  try {
    const result = await client.query(text, params);
    return result;
  } catch (err) {
    console.error('[DB Error]', err.message);
    throw err;
  }
}

export async function insert(table, data) {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = values.map((_, i) => `$${i + 1}`).join(', ');

  const text = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`;
  return query(text, values);
}

export async function insertMany(table, rows) {
  if (rows.length === 0) return { rowCount: 0 };
  const keys = Object.keys(rows[0]);
  const placeholders = rows.map((_, i) =>
    `(${keys.map((_, j) => `$${i * keys.length + j + 1}`).join(', ')})`
  ).join(', ');

  const values = rows.flatMap(r => Object.values(r));
  const text = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${placeholders} ON CONFLICT DO NOTHING`;
  return query(text, values);
}

// Inicializar schema
export async function initSchema() {
  const schema = readFileSync(
    join(__dirname, 'schema.sql'),
    'utf-8'
  );
  // Quitar comentarios de linea (--) y lineas vacias, luego split por ';'
  const cleaned = schema
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  const statements = cleaned
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const stmt of statements) {
    try {
      await query(stmt);
    } catch (err) {
      console.warn('[Schema]', err.message.slice(0, 100));
    }
  }
  console.log('[DB] Schema initialized');
}
