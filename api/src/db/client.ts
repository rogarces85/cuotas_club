import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import type { MySql2Database } from 'drizzle-orm/mysql2';
import { env } from '../env.js';

/**
 * Pool y cliente Drizzle creados de forma perezosa.
 * Así no dependen del orden de importación de `.env`: se resuelven
 * la primera vez que se usan, no al evaluar el módulo.
 */

let _pool: mysql.Pool | null = null;
let _db: MySql2Database<Record<string, never>> | null = null;

function createPool(): mysql.Pool {
  // charset utf8mb4 + collation utf8mb4_unicode_ci: lo que MariaDB 10.4 soporta.
  return mysql.createPool({
    host: env.host,
    port: env.port,
    database: env.dbName,
    user: env.dbUser,
    password: env.dbPassword,
    charset: 'utf8mb4',
    connectionLimit: 10,
  });
}

export function getPool(): mysql.Pool {
  if (!_pool) {
    _pool = createPool();
  }
  return _pool;
}

export function getDb() {
  if (!_db) {
    _db = drizzle(getPool());
  }
  return _db;
}

export const db = getDb();
export const pool = getPool();
