/**
 * Verificación re-ejecutable del Reporte de Socios y la descarga de pagos.
 *
 * Siembra 3 socios y 4 pagos en el trimestre actual, llama a los endpoints
 * reales y comprueba métricas, filtros repetidos, CSV y XLSX. Limpia todo.
 *
 * Uso: node api/scripts/verify-reportes-socios.mjs
 */

import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';

const RUT_A = '99000011';
const RUT_B = '99000012';
const RUT_C = '99000013';
const RUTS = [RUT_A, RUT_B, RUT_C];

const hoy = new Date();
const anio = hoy.getFullYear();
const trimestre = Math.floor(hoy.getMonth() / 3) + 1;
const mesInicioTrimestre = (trimestre - 1) * 3;
const fechaPagoA = `${anio}-${String(mesInicioTrimestre + 1).padStart(2, '0')}-15`;
const fechaPagoB = `${anio}-${String(mesInicioTrimestre + 2).padStart(2, '0')}-10`;

let passed = 0;
let failed = 0;
let cookie = '';

function check(nombre, condicion, extra = '') {
  if (condicion) {
    passed++;
    console.log(`  ✅ ${nombre}`);
  } else {
    failed++;
    console.error(`  ❌ ${nombre} ${extra}`);
  }
}

const pool = createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'osorno_app',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'osorno_runners_v2',
});

async function api(path, opciones = {}) {
  const headers = { Origin: BASE, ...(opciones.headers ?? {}) };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, { ...opciones, headers });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* binario o vacío */
  }
  return { res, data };
}

async function limpiar() {
  const [socios] = await pool.query('SELECT id_socio FROM socio WHERE rut IN (?)', [RUTS]);
  const ids = socios.map((s) => s.id_socio);
  if (ids.length > 0) {
    await pool.query('DELETE FROM pago WHERE id_socio IN (?)', [ids]);
    await pool.query('DELETE FROM socio WHERE id_socio IN (?)', [ids]);
  }
}

async function sembrar() {
  await limpiar();
  const ts = Math.floor(Date.now() / 1000);

  const [a] = await pool.query(
    `INSERT INTO socio (rut, nombre, anio, sexo, fecha_nacimiento, fecha_ingreso, estado, activo, email, created_at, updated_at)
     VALUES (?, 'Reporte A Hombre Activo', ?, 'HOMBRE', '1990-03-15', '2020-01-10', 'ACTIVO', 1, 'rep.a@test.cl', ?, ?)`,
    [RUT_A, anio, ts, ts],
  );
  const [b] = await pool.query(
    `INSERT INTO socio (rut, nombre, anio, sexo, fecha_nacimiento, fecha_ingreso, estado, activo, email, created_at, updated_at)
     VALUES (?, 'Reporte B Mujer Activa', ?, 'MUJER', '2000-06-20', '2025-06-01', 'MEMBRESIA', 1, 'rep.b@test.cl', ?, ?)`,
    [RUT_B, anio, ts, ts],
  );
  const [c] = await pool.query(
    `INSERT INTO socio (rut, nombre, anio, sexo, fecha_nacimiento, fecha_ingreso, estado, activo, email, created_at, updated_at)
     VALUES (?, 'Reporte C Mujer Inactiva', ?, 'MUJER', '1970-01-01', '2015-01-01', 'BECADO', 0, 'rep.c@test.cl', ?, ?)`,
    [RUT_C, anio, ts, ts],
  );

  const pagos = [
    [a.insertId, RUT_A, fechaPagoA, 10000, 'APROBADO'],
    [a.insertId, RUT_A, fechaPagoB, 5000, 'APROBADO'],
    [b.insertId, RUT_B, fechaPagoB, 8000, 'PENDIENTE'],
    [c.insertId, RUT_C, fechaPagoA, 3000, 'APROBADO'],
  ];
  for (const [socioId, rut, fecha, total, estado] of pagos) {
    await pool.query(
      `INSERT INTO pago
        (id_socio, rut, nombre_snapshot, anio, estado, fecha_pago, total_pago, valor_cuota, tipo_cuota, meses_cantidad, meses_detalle, origen, created_at, updated_at)
       VALUES (?, ?, 'Snapshot', ?, ?, ?, ?, ?, 'ACTIVO', 1, '2026-03', 'manual', ?, ?)`,
      [socioId, rut, anio, estado, fecha, total, total, ts, ts],
    );
  }
}

async function main() {
  console.log('Verificación del Reporte de Socios\n');
  await limpiar();

  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check('login tesorero (200)', login.ok, `→ ${login.status}`);
  cookie =
    (login.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('better-auth.session_token=')) ?? '';
  check('cookie de sesión recibida', Boolean(cookie));

  const query = `anio=${anio}&trimestre=${trimestre}`;
  const antes = await api(`/api/reportes/socios?periodo=Trimestre&${query}`);
  const filtradoAntes = await api(
    `/api/reportes/socios?periodo=Trimestre&${query}&socios=Activos&socios=Hombres`,
  );

  await sembrar();

  const despues = await api(`/api/reportes/socios?periodo=Trimestre&${query}`);
  const delta = (clave) =>
    (despues.data?.resumen?.[clave] ?? 0) - (antes.data?.resumen?.[clave] ?? 0);

  check(
    'el reporte suma 3 socios y $18.000 al período',
    delta('totalSocios') === 3 &&
      delta('activos') === 2 &&
      delta('inactivos') === 1 &&
      delta('recaudacionPeriodo') === 18000 &&
      delta('pagosAprobados') === 3 &&
      delta('sociosPagadores') === 2,
    `→ deltas ${JSON.stringify({
      total: delta('totalSocios'),
      activos: delta('activos'),
      inactivos: delta('inactivos'),
      recaudado: delta('recaudacionPeriodo'),
      pagos: delta('pagosAprobados'),
      pagadores: delta('sociosPagadores'),
    })}`,
  );
  check(
    'estructura para gráficas: sexo, estado, edad, altas y meses de pago',
    Array.isArray(despues.data?.porSexo) &&
      Array.isArray(despues.data?.porEstado) &&
      Array.isArray(despues.data?.porRangoEdad) &&
      Array.isArray(despues.data?.nuevosPorMes) &&
      despues.data?.pagos?.porMes?.length === 3,
  );

  const filtradoDespues = await api(
    `/api/reportes/socios?periodo=Trimestre&${query}&socios=Activos&socios=Hombres`,
  );
  check(
    'filtros repetidos Activos + Hombres → suma 1 socio y $15.000',
    filtradoDespues.data?.resumen?.totalSocios - filtradoAntes.data?.resumen?.totalSocios === 1 &&
      filtradoDespues.data?.resumen?.recaudacionPeriodo -
        filtradoAntes.data?.resumen?.recaudacionPeriodo ===
        15000,
    `→ ${JSON.stringify(filtradoDespues.data?.resumen)}`,
  );

  const malo = await api(`/api/reportes/socios?${query}&socios=Marcianos`);
  check('filtro desconocido → 400', malo.res.status === 400 && /desconocido/i.test(malo.data?.error ?? ''), `→ ${malo.res.status}`);

  const csv = await fetch(
    `${BASE}/api/reportes/descarga/pagos?anio=${anio}&socios=Activos&formato=csv`,
    { headers: { Cookie: cookie, Origin: BASE } },
  );
  const csvBuffer = Buffer.from(await csv.arrayBuffer());
  const tieneBom =
    csvBuffer[0] === 0xef && csvBuffer[1] === 0xbb && csvBuffer[2] === 0xbf;
  const csvTexto = csvBuffer.toString('utf8').replace(/^\uFEFF/, '');
  const lineas = csvTexto.split('\r\n').filter(Boolean);
  check(
    'CSV: 200, BOM, encabezado y filas de prueba',
    csv.status === 200 &&
      csv.headers.get('content-type')?.includes('text/csv') &&
      tieneBom &&
      lineas[0].includes('"RUT"') &&
      lineas.slice(1).some((linea) => linea.includes('99000011')) &&
      lineas.slice(1).some((linea) => linea.includes('99000012')),
    `→ ${csv.status}, ${lineas.length} líneas`,
  );

  const xlsxRes = await fetch(
    `${BASE}/api/reportes/descarga/pagos?anio=${anio}&socios=Activos&estadoPago=APROBADO&formato=xlsx`,
    { headers: { Cookie: cookie, Origin: BASE } },
  );
  const xlsxBuffer = Buffer.from(await xlsxRes.arrayBuffer());
  const libro = XLSX.read(xlsxBuffer, { type: 'buffer' });
  const filasPagos = XLSX.utils.sheet_to_json(libro.Sheets.Pagos, { header: 1, defval: '' });
  check(
    'XLSX: hojas Pagos/Filtros y pagos aprobados del socio de prueba',
    xlsxRes.status === 200 &&
      libro.SheetNames.includes('Pagos') &&
      libro.SheetNames.includes('Filtros') &&
      filasPagos.slice(1).some((fila) => String(fila[4]) === '99000011'),
    `→ ${xlsxRes.status}, ${filasPagos.length} filas`,
  );

  const sinSesion = await fetch(`${BASE}/api/reportes/socios?${query}`);
  check('sin sesión → 401', sinSesion.status === 401, `→ ${sinSesion.status}`);

  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('\nError inesperado:', err);
} finally {
  await limpiar();
  await pool.end();
  process.exit(failed === 0 ? 0 : 1);
}
