import 'dotenv/config';
import { migrate } from 'drizzle-orm/mysql2/migrator';
import { fileURLToPath } from 'node:url';
import { getDb } from '../src/db/client.js';

/**
 * Aplica las migraciones pendientes usando el migrator de drizzle-orm
 * contra el pool de la app (que ya está verificado).
 *
 * Preferido sobre `drizzle-kit migrate`, que en esta máquina falla sin
 * mostrar el error. Este script reporta el error real.
 *
 * Uso: npm run db:migrate -w api
 */
async function main() {
  const db = getDb();
  const migrationsFolder = fileURLToPath(new URL('../drizzle', import.meta.url));
  await migrate(db, { migrationsFolder });
  console.log('Migraciones aplicadas.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Error aplicando migraciones:', err);
  process.exit(1);
});
