import { betterAuth } from 'better-auth';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

// El generador no está en la superficie pública ("exports") del paquete.
// Se resuelve por ruta de archivo directa dentro de node_modules, igual que
// lo hace internamente la CLI de Better Auth.
const __dirname = dirname(fileURLToPath(import.meta.url));
const genPath = resolve(
  __dirname,
  '../../node_modules/@better-auth/drizzle-adapter/dist/generate-drizzle-schema-BLVzUOFk.mjs',
);
const { generateDrizzleSchema: generate } = await import(pathToFileURL(genPath).href);

/**
 * Genera api/src/db/auth-schema.ts a partir de la configuración de Better Auth.
 * Usa el generador oficial de Better Auth (el mismo que la CLI), así el contrato
 * de tablas/campos/índices es exactamente el que el adaptador espera.
 *
 * Ejecutar una sola vez (o tras cambiar la config de auth):
 *   node scripts/generate-auth-schema.mjs
 */
const options = {
  emailAndPassword: { enabled: true },
};

const auth = betterAuth(options);

const file = resolve(__dirname, '../src/db/auth-schema.ts');

const result = await generate({
  options: auth.options,
  provider: 'mysql',
  file,
});

// El generador devuelve { code, ... } y NO escribe el archivo (lo hace la CLI).
await writeFile(file, result.code, 'utf8');

console.log(`auth-schema.ts generado en ${file} (${result.code.length} bytes)`);
