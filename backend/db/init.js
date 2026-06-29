#!/usr/bin/env node
// =============================================================
// Inicializar base de datos
// Crea todas las tablas del schema
// =============================================================
import 'dotenv/config';
import { initSchema } from './client.js';

async function main() {
  console.log('🚀 Initializing database schema...');
  try {
    await initSchema();
    console.log('✅ Schema created successfully');
  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main();
