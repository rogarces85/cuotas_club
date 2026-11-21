/**
 * Script CLI para importar socios desde CSV/Excel.
 *
 * Uso:
 *   node api/scripts/importar-socios.mjs <archivo.csv>
 *
 * Formato CSV esperado:
 *   rut,nombre,anio,sexo,estado,email,telefono,activo
 *   12345678-9,Juan Pérez,2026,M,ACTIVO,juan@email.cl,+56912345678,true
 *
 * El RUT se normaliza automáticamente (sin puntos ni guion, K mayúscula).
 * activo: true/false (default true)
 */

import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import { createPool } from 'mysql2/promise';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cargar .env
import 'dotenv/config';

const DB_HOST = process.env.DB_HOST || '127.0.0.1';
const DB_PORT = parseInt(process.env.DB_PORT || '3306', 10);
const DB_NAME = process.env.DB_NAME || 'osorno_runners_v2';
const DB_USER = process.env.DB_USER || 'osorno_app';
const DB_PASSWORD = process.env.DB_PASSWORD || '';

const pool = createPool({
  host: DB_HOST,
  port: DB_PORT,
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  waitForConnections: true,
  connectionLimit: 5,
});

/**
 * Normaliza RUT: quita puntos, guion, pone K en mayúscula.
 * Ej: "12.345.678-9" -> "123456789"
 *     "12345678-k" -> "12345678K"
 */
function normalizarRut(rut: string): string {
  return rut.replace(/[.-]/g, '').toUpperCase();
}

/**
 * Valida RUT chileno (algoritmo módulo 11).
 * Retorna true si el dígito verificador es correcto.
 */
function validarRut(rut: string): boolean {
  const normalizado = normalizarRut(rut);
  if (!/^\d{7,8}[0-9K]$/.test(normalizado)) return false;

  const cuerpo = normalizado.slice(0, -1);
  const dv = normalizado.slice(-1);

  let suma = 0;
  let multiplo = 2;
  for (let i = cuerpo.length - 1; i >= 0; i--) {
    suma += parseInt(cuerpo[i], 10) * multiplo;
    multiplo = multiplo === 7 ? 2 : multiplo + 1;
  }
  const dvCalculado = 11 - (suma % 11);
  const dvEsperado = dvCalculado === 11 ? '0' : dvCalculado === 10 ? 'K' : String(dvCalculado);

  return dv === dvEsperado;
}

/**
 * Genera hash SHA256 para deduplicación de importaciones.
 */
function hashImportacion(socios: any[]): string {
  const str = JSON.stringify(socios.map(s => ({ rut: s.rut, nombre: s.nombre, anio: s.anio })).sort((a, b) => a.rut.localeCompare(b.rut)));
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Uso: node importar-socios.mjs <archivo.csv>');
    console.error('Opciones:');
    console.error('  --dry-run    Solo valida, no inserta');
    console.error('  --force      Sobrescribe socios existentes (mismo RUT)');
    process.exit(1);
  }

  const archivo = args[0];
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');

  console.log(`📥 Importando socios desde: ${archivo}`);
  if (dryRun) console.log('🔍 MODO DRY-RUN: no se insertará nada');
  if (force) console.log('⚠️  MODO FORCE: sobrescribirá socios existentes');

  // Leer y parsear CSV
  let contenido: string;
  try {
    contenido = readFileSync(archivo, 'utf-8');
  } catch (err) {
    console.error(`❌ Error leyendo archivo: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  let registros: any[];
  try {
    registros = parse(contenido, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      delimiter: ',',
    });
  } catch (err) {
    console.error(`❌ Error parseando CSV: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  if (registros.length === 0) {
    console.error('❌ El archivo no contiene datos válidos');
    process.exit(1);
  }

  console.log(`📊 ${registros.length} registros leídos`);

  // Validar y normalizar
  const validos: any[] = [];
  const errores: string[] = [];

  for (let i = 0; i < registros.length; i++) {
    const r = registros[i];
    const fila = i + 2; // +1 header, +1 base 1

    try {
      // Campos requeridos
      if (!r.rut || !r.nombre || !r.anio) {
        errores.push(`Fila ${fila}: faltan campos requeridos (rut, nombre, anio)`);
        continue;
      }

      const rutNormalizado = normalizarRut(r.rut);
      if (!validarRut(rutNormalizado)) {
        errores.push(`Fila ${fila}: RUT inválido "${r.rut}"`);
        continue;
      }

      const anio = parseInt(r.anio, 10);
      if (isNaN(anio) || anio < 2020 || anio > 2100) {
        errores.push(`Fila ${fila}: año inválido "${r.anio}"`);
        continue;
      }

      const activo = r.activo === undefined || r.activo === '' ? true : (r.activo === 'true' || r.activo === '1' || r.activo === true);

      validos.push({
        rut: rutNormalizado,
        nombre: r.nombre.trim(),
        anio,
        sexo: r.sexo?.trim() || null,
        estado: r.estado?.trim() || 'ACTIVO',
        email: r.email?.trim() || null,
        telefono: r.telefono?.trim() || null,
        activo: activo ? 1 : 0,
      });
    } catch (err) {
      errores.push(`Fila ${fila}: ${err instanceof Error ? err.message : 'Error desconocido'}`);
    }
  }

  console.log(`✅ ${validos.length} registros válidos`);
  if (errores.length > 0) {
    console.log(`❌ ${errores.length} errores:`);
    for (const e of errores.slice(0, 20)) console.log(`   - ${e}`);
    if (errores.length > 20) console.log(`   ... y ${errores.length - 20} más`);
  }

  if (validos.length === 0) {
    console.error('❌ No hay registros válidos para importar');
    process.exit(1);
  }

  if (dryRun) {
    console.log('\n🔍 DRY-RUN completado. No se insertaron datos.');
    process.exit(0);
  }

  // Verificar duplicados en BD
  const ruts = validos.map(s => s.rut);
  const placeholders = ruts.map(() => '?').join(',');
  const [existentes] = await pool.query(
    `SELECT rut FROM socio WHERE rut IN (${placeholders})`,
    ruts
  );

  const rutsExistentes = new Set((existentes as any[]).map((r: any) => r.rut));

  let insertados = 0;
  let actualizados = 0;
  let saltados = 0;

  for (const s of validos) {
    if (rutsExistentes.has(s.rut)) {
      if (force) {
        await pool.query(
          `UPDATE socio SET nombre=?, anio=?, sexo=?, estado=?, email=?, telefono=?, activo=?, updatedAt=UNIX_TIMESTAMP()
           WHERE rut=?`,
          [s.nombre, s.anio, s.sexo, s.estado, s.email, s.telefono, s.activo, s.rut]
        );
        actualizados++;
      } else {
        saltados++;
      }
    } else {
      await pool.query(
        `INSERT INTO socio (rut, nombre, anio, sexo, estado, email, telefono, activo, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())`,
        [s.rut, s.nombre, s.anio, s.sexo, s.estado, s.email, s.telefono, s.activo]
      );
      insertados++;
    }
  }

  console.log('\n✅ Importación completada:');
  console.log(`   Insertados: ${insertados}`);
  console.log(`   Actualizados: ${actualizados}`);
  console.log(`   Saltados (ya existían): ${saltados}`);
  console.log(`   Errores de validación: ${errores.length}`);

  await pool.end();
}

main().catch(async (err) => {
  console.error('❌ Error fatal:', err);
  await pool.end();
  process.exit(1);
});