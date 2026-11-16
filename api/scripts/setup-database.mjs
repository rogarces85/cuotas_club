import 'dotenv/config';
import mysql from 'mysql2/promise';

/**
 * Prepara la base de datos en una máquina nueva.
 *
 * Crea (si no existen):
 *   - la base indicada en DB_NAME, con utf8mb4_unicode_ci
 *   - el usuario de aplicación DB_USER, con la clave DB_PASSWORD,
 *     para 'localhost' y '127.0.0.1', con permisos solo sobre esa base
 *
 * Necesita un usuario administrador de MySQL (por defecto root sin clave,
 * que es el default de XAMPP). Se configura con DB_ROOT_USER y DB_ROOT_PASSWORD.
 *
 * Uso:  npm run db:setup -w api
 *
 * No imprime la clave. Si DB_PASSWORD está vacía, aborta: no se crea un
 * usuario sin clave.
 */

const DB_ROOT_USER = process.env.DB_ROOT_USER ?? 'root';
const DB_ROOT_PASSWORD = process.env.DB_ROOT_PASSWORD ?? '';

const DB_NAME = process.env.DB_NAME ?? 'osorno_runners_v2';
const DB_USER = process.env.DB_USER ?? 'osorno_app';
const DB_PASSWORD = process.env.DB_PASSWORD ?? '';
const DB_HOST = process.env.DB_HOST ?? '127.0.0.1';
const DB_PORT = Number(process.env.DB_PORT ?? 3306);

// Los identificadores no se pueden parametrizar en MySQL, así que se validan.
const IDENT = /^[A-Za-z0-9_]{1,32}$/;

function fail(msg) {
  console.error(`\n  ${msg}\n`);
  process.exit(1);
}

if (!IDENT.test(DB_NAME)) fail(`DB_NAME inválido: "${DB_NAME}". Solo letras, números y guion bajo.`);
if (!IDENT.test(DB_USER)) fail(`DB_USER inválido: "${DB_USER}". Solo letras, números y guion bajo.`);
if (!DB_PASSWORD) {
  fail(
    'DB_PASSWORD está vacía.\n' +
      '  Edita api/.env y define una clave para el usuario de la aplicación.\n' +
      '  El script no crea usuarios de base de datos sin clave.',
  );
}

const quoteId = (s) => `\`${s}\``;
const quoteStr = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;

let conn;
try {
  conn = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_ROOT_USER,
    password: DB_ROOT_PASSWORD,
    multipleStatements: false,
  });

  const [[{ version }]] = await conn.query('SELECT VERSION() AS version');
  console.log(`  MariaDB/MySQL: ${version}`);

  await conn.query(
    `CREATE DATABASE IF NOT EXISTS ${quoteId(DB_NAME)} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  );
  console.log(`  Base ${DB_NAME}: lista`);

  for (const host of ['localhost', '127.0.0.1']) {
    await conn.query(`CREATE USER IF NOT EXISTS ${quoteStr(DB_USER)}@${quoteStr(host)} IDENTIFIED BY ${quoteStr(DB_PASSWORD)}`);
    await conn.query(
      `ALTER USER ${quoteStr(DB_USER)}@${quoteStr(host)} IDENTIFIED BY ${quoteStr(DB_PASSWORD)}`,
    );
    await conn.query(
      `GRANT ALL PRIVILEGES ON ${quoteId(DB_NAME)}.* TO ${quoteStr(DB_USER)}@${quoteStr(host)}`,
    );
  }
  await conn.query('FLUSH PRIVILEGES');
  console.log(`  Usuario ${DB_USER}: listo (clave no mostrada)`);

  // Comprobación real: conectar como el usuario de la app.
  const check = await mysql.createConnection({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
  });
  await check.query('SELECT 1');
  await check.end();
  console.log('  Conexión con el usuario de la app: verificada');

  console.log('\n  Siguiente paso:  npm run db:migrate -w api\n');
  process.exit(0);
} catch (err) {
  const hint =
    err.code === 'ER_ACCESS_DENIED_ERROR'
      ? 'Revisa DB_ROOT_USER / DB_ROOT_PASSWORD (en XAMPP, root suele no tener clave).'
      : err.code === 'ECONNREFUSED'
        ? 'MySQL no responde. Arráncalo en el panel de XAMPP.'
        : '';
  fail(`No se pudo preparar la base: ${err.message}${hint ? `\n  ${hint}` : ''}`);
} finally {
  if (conn) await conn.end().catch(() => {});
}
