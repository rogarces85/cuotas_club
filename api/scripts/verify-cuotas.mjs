/**
 * Verificación re-ejecutable de cuotas (M2), AC2–AC7.
 *
 * Corre contra el sistema en marcha (API en :8787 vía proxy :5173). Siembra
 * sus propios niveles de cuota y socios de prueba, asevera cada resultado y
 * LIMPIA al inicio y al final (físico vía mysql2), de modo que es idempotente
 * y no contamina el padrón.
 *
 * Uso: node api/scripts/verify-cuotas.mjs
 * Requiere: la API corriendo (`npm run dev`) y credenciales de tesorero.
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Carga api/.env explícitamente (el script puede correr desde la raíz).
dotenv.config({ path: join(__dirname, '..', '.env') });

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'cuotas-osorno-2026';

const PERIODO = '2099-12'; // mes improbable, para no chocar con datos reales
const RUT_A = '11111111';
const RUT_B = '22222222';
const RUT_C = '33333333';
const RUT_D = '44444444'; // pagará el período (AC7)

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${extra}`);
  }
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = { Origin: BASE };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    redirect: 'manual',
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') ?? '' };
}

async function limpiarBD() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'osorno_runners_v2',
    user: process.env.DB_USER ?? 'osorno_app',
    password: process.env.DB_PASSWORD ?? '',
  });
  try {
    await conn.query(
      `DELETE FROM pago_mes WHERE id_pago >= 900000`,
    );
    await conn.query(
      `DELETE FROM socio WHERE rut IN (?, ?, ?, ?)`,
      [RUT_A, RUT_B, RUT_C, RUT_D],
    );
    await conn.query(`DELETE FROM periodo_cuota WHERE periodo = ?`, [PERIODO]);
    await conn.query(
      `DELETE FROM nivel_cuota WHERE codigo IN ('ACTIVO','MEMBRESIA','BECADO')`,
    );
  } finally {
    await conn.end();
  }
}

async function sembrarNiveles() {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'osorno_runners_v2',
    user: process.env.DB_USER ?? 'osorno_app',
    password: process.env.DB_PASSWORD ?? '',
  });
  try {
    await conn.query(
      `INSERT INTO nivel_cuota (codigo, nombre, monto_clp, tipo, activo) VALUES
       ('ACTIVO','Activo',15000,'ACTIVO',1),
       ('MEMBRESIA','Membresia',10000,'MEMBRESIA',1),
       ('BECADO','Becado',0,'BECADO',1)`,
    );
  } finally {
    await conn.end();
  }
}

async function sembrarPago(socioId, rut) {
  const conn = await mysql.createConnection({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    database: process.env.DB_NAME ?? 'osorno_runners_v2',
    user: process.env.DB_USER ?? 'osorno_app',
    password: process.env.DB_PASSWORD ?? '',
  });
  try {
    await conn.query(
      `INSERT INTO pago_mes (id_pago, id_socio, rut, periodo, created_at)
       VALUES (900001, ?, ?, ?, UNIX_TIMESTAMP())`,
      [socioId, rut, PERIODO],
    );
  } finally {
    await conn.end();
  }
}

async function main() {
  console.log('Verificación de cuotas (M2), AC2–AC7\n');

  await limpiarBD(); // idempotente: borra residuos de ejecuciones previas
  await sembrarNiveles();

  const login = await req('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  check('login tesorero (200)', login.status === 200, `→ ${login.status}`);
  const cookie = login.setCookie.split(';')[0];

  // Siembra: A activo, B activo (MEMBRESIA), C activo (será inactivo), D activo (pagará)
  const socios = [];
  for (const [rut, nombre, estado] of [
    [RUT_A, 'Socio A Prueba', 'ACTIVO'],
    [RUT_B, 'Socio B Prueba', 'MEMBRESIA'],
    [RUT_C, 'Socio C Prueba', 'ACTIVO'],
    [RUT_D, 'Socio D Prueba', 'ACTIVO'],
  ]) {
    const r = await req('/api/socios', {
      method: 'POST',
      cookie,
      body: { rut, nombre, anio: 2026, estado },
    });
    if (r.status === 201) socios.push({ rut, ...r.data });
  }
  // Inactivar al socio C (baja lógica) para AC5.
  const socioC = socios.find((s) => s.rut === RUT_C);
  if (socioC) await req(`/api/socios/${socioC.id}`, { method: 'DELETE', cookie });
  check('siembra: 4 socios creados (uno dado de baja)', socios.length === 4, `→ ${socios.length}`);

  // AC2 — crear período
  const crear = await req('/api/cuotas/periodos', {
    method: 'POST',
    cookie,
    body: { periodo: PERIODO, diaVencimiento: 10 },
  });
  check('AC2 crear período → 201', crear.status === 201, `→ ${crear.status} ${JSON.stringify(crear.data)}`);
  const periodoId = crear.data?.id;

  // AC3 — duplicado → 409
  const dup = await req('/api/cuotas/periodos', {
    method: 'POST',
    cookie,
    body: { periodo: PERIODO, diaVencimiento: 10 },
  });
  check('AC3 período duplicado → 409', dup.status === 409, `→ ${dup.status}`);

  // AC6 — mes inválido → 400
  const mal = await req('/api/cuotas/periodos', {
    method: 'POST',
    cookie,
    body: { periodo: '2026-13', diaVencimiento: 10 },
  });
  check('AC6 mes inválido → 400', mal.status === 400, `→ ${mal.status}`);

  // AC7 — el socio D pagó: sembrar pago_mes antes de calcular deuda.
  const socioD = socios.find((s) => s.rut === RUT_D);
  if (socioD) await sembrarPago(socioD.id, RUT_D);

  // AC4 — deuda = activos sin pago (A y B; C inactivo excluido, D pagó excluido)
  const deuda = await req(`/api/cuotas/periodos/${periodoId}/deuda`, { cookie });
  const ruts = (deuda.data?.filas ?? []).map((f) => f.rut);
  check(
    'AC4 deuda lista activos sin pago',
    deuda.status === 200 && deuda.data?.total === 2 && ruts.includes(RUT_A) && ruts.includes(RUT_B),
    `→ total=${deuda.data?.total} ruts=${JSON.stringify(ruts)}`,
  );

  // AC5 — el socio inactivo (C) no aparece
  check('AC5 socio inactivo excluido', !ruts.includes(RUT_C), `→ ruts=${JSON.stringify(ruts)}`);

  // AC7 — el socio pagado (D) no aparece
  check('AC7 socio pagado excluido', !ruts.includes(RUT_D), `→ ruts=${JSON.stringify(ruts)}`);

  // Monto por tipo: B (MEMBRESIA) → 10000
  const socioB = (deuda.data?.filas ?? []).find((f) => f.rut === RUT_B);
  check('monto por tipo (MEMBRESIA=10000)', socioB?.montoClp === 10000, `→ ${JSON.stringify(socioB)}`);

  await limpiarBD();
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron (base limpia)`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error('Error en la verificación:', err.message);
  try {
    await limpiarBD();
  } catch {
    /* limpieza best-effort */
  }
  process.exit(1);
});
