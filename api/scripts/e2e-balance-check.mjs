/**
 * Prueba de aceptación E2E para M5 — Reportes.
 *
 * Objetivo: verificar que el reporte de balance cuadra contra los datos
 * reales de la base de datos (pagos aprobados, egresos, otros ingresos,
 * gastos fijos).
 *
 * Uso:
 *   node api/scripts/e2e-balance-check.mjs
 *
 * Requisitos:
 * - API corriendo en http://localhost:8787 (npm run dev -w api)
 * - Sesión válida de Better Auth (cookie better-auth.session_token)
 * - MariaDB corriendo en XAMPP (puerto 3306)
 */

import { createPool } from 'mysql2/promise';
import 'dotenv/config';

const API_BASE = 'http://localhost:8787';
const SESSION_TOKEN = process.env.SESSION_TOKEN; // cookie de Better Auth

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
});

let pruebasPasadas = 0;
let pruebasFalladas = 0;

function assert(condicion, mensaje) {
  if (condicion) {
    pruebasPasadas++;
    console.log(`  ✅ ${mensaje}`);
  } else {
    pruebasFalladas++;
    console.error(`  ❌ ${mensaje}`);
  }
}

async function api(path, init = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      cookie: `better-auth.session_token=${SESSION_TOKEN}`,
      ...(init.headers ?? {}),
    },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`API ${path} → ${res.status}: ${body.error ?? res.statusText}`);
  }
  return res.json();
}

async function main() {
  if (!SESSION_TOKEN) {
    console.error('❌ Falta SESSION_TOKEN. Exporta la cookie de Better Auth:');
    console.error('   export SESSION_TOKEN=<valor de la cookie>');
    process.exit(1);
  }

  console.log('🧪 E2E Balance Check — M5\n');

  // ------------------------------------------------------------
  // 1. Limpiar datos de prueba anteriores (por RUT de prueba)
  // ------------------------------------------------------------
  const rutPrueba = '99999999K';
  await pool.query('DELETE FROM pago_mes WHERE pagoId IN (SELECT id FROM pago WHERE rut = ?)', [rutPrueba]);
  await pool.query('DELETE FROM comprobante WHERE pagoId IN (SELECT id FROM pago WHERE rut = ?)', [rutPrueba]);
  await pool.query('DELETE FROM pago WHERE rut = ?', [rutPrueba]);
  await pool.query('DELETE FROM egreso WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM otro_ingreso WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM gasto_fijo WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM movimiento_bancario WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM socio WHERE rut = ?', [rutPrueba]);

  // ------------------------------------------------------------
  // 2. Crear socio de prueba
  // ------------------------------------------------------------
  const ts = Math.floor(Date.now() / 1000);
  await pool.query(
    `INSERT INTO socio (rut, nombre, anio, sexo, estado, email, telefono, activo, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [rutPrueba, 'Socio E2E', 2026, 'M', 'ACTIVO', 'e2e@test.cl', '+56900000000', 1, ts, ts]
  );

  const [socioCreado] = await pool.query('SELECT id FROM socio WHERE rut = ?', [rutPrueba]);
  const socioId = socioCreado[0].id;

  // ------------------------------------------------------------
  // 3. Crear pago aprobado (ingreso)
  // ------------------------------------------------------------
  const montoPago = 50000;
  const fechaPago = '2026-11-15';
  await pool.query(
    `INSERT INTO pago (socioId, rut, nombreSnapshot, anio, sexo, estado, situacion, fechaPago, totalPago, valorCuota, tipoCuota, mesesCantidad, mesesDetalle, observacion, origen, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [socioId, rutPrueba, 'Socio E2E', 2026, 'M', 'APROBADO', null, fechaPago, montoPago, montoPago, 'ACTIVO', 1, 'Nov 2026', 'Pago prueba E2E', 'manual', ts, ts]
  );

  const [pagoCreado] = await pool.query('SELECT id FROM pago WHERE rut = ? AND estado = ?', [rutPrueba, 'APROBADO']);
  const pagoId = pagoCreado[0].id;

  // ------------------------------------------------------------
  // 4. Crear pago_mes (vincular pago a período)
  // ------------------------------------------------------------
  const [periodo] = await pool.query("SELECT id FROM periodo_cuota WHERE periodo = '2026-11' LIMIT 1");
  if (periodo.length > 0) {
    await pool.query(
      'INSERT INTO pago_mes (pagoId, socioId, periodo, createdAt) VALUES (?, ?, ?, ?)',
      [pagoId, socioId, '2026-11', ts]
    );
  }

  // ------------------------------------------------------------
  // 5. Crear egreso (gasto variable)
  // ------------------------------------------------------------
  const montoEgreso = 15000;
  const fechaEgreso = '2026-11-10';
  await pool.query(
    `INSERT INTO egreso (categoriaId, fecha, monto, descripcion, boletaRuta, createdAt)
     VALUES (NULL, ?, ?, ?, NULL, ?)`,
    [fechaEgreso, montoEgreso, 'Egreso de prueba E2E', ts]
  );

  // ------------------------------------------------------------
  // 6. Crear otro ingreso
  // ------------------------------------------------------------
  const montoOtroIngreso = 10000;
  const fechaOtroIngreso = '2026-11-12';
  await pool.query(
    `INSERT INTO otro_ingreso (fecha, monto, descripcion, origen, createdAt)
     VALUES (?, ?, ?, ?, ?)`,
    [fechaOtroIngreso, montoOtroIngreso, 'Rifa de prueba E2E', 'Rifa', ts]
  );

  // ------------------------------------------------------------
  // 7. Crear gasto fijo (activo, mensual)
  // ------------------------------------------------------------
  const montoGastoFijo = 30000;
  await pool.query(
    `INSERT INTO gasto_fijo (descripcion, monto, periodicidad, activo, createdAt)
     VALUES (?, ?, 'mensual', 1, ?)`,
    ['Arriendo de prueba E2E', montoGastoFijo, ts]
  );

  // ------------------------------------------------------------
  // 8. Llamar al endpoint de balance
  // ------------------------------------------------------------
  const balance = await api('/reportes/balance', {
    method: 'GET',
  });

  console.log('\n📊 Reporte de balance obtenido:');
  console.log(`   Período: ${balance.periodo}`);
  console.log(`   Ingresos totales: ${formatClp(balance.ingresos.total)}`);
  console.log(`   Egresos totales: ${formatClp(balance.egresos.total)}`);
  console.log(`   Saldo: ${formatClp(balance.saldo)}`);

  // ------------------------------------------------------------
  // 9. Verificaciones
  // ------------------------------------------------------------
  console.log('\n🔍 Verificaciones:');

  // Ingresos = pagos aprobados + otros ingresos
  const ingresosEsperados = montoPago + montoOtroIngreso;
  assert(balance.ingresos.total === ingresosEsperados,
    `Ingresos totales = ${formatClp(ingresosEsperados)} (pago ${formatClp(montoPago)} + otro ingreso ${formatClp(montoOtroIngreso)})`);

  // Pagos aprobados
  assert(balance.ingresos.pagosAprobados === montoPago,
    `Pagos aprobados = ${formatClp(montoPago)}`);

  // Otros ingresos
  assert(balance.ingresos.otrosIngresos === montoOtroIngreso,
    `Otros ingresos = ${formatClp(montoOtroIngreso)}`);

  // Egresos = egresos variables + gastos fijos mensuales
  const egresosEsperados = montoEgreso + montoGastoFijo;
  assert(balance.egresos.total === egresosEsperados,
    `Egresos totales = ${formatClp(egresosEsperados)} (variable ${formatClp(montoEgreso)} + fijo mensual ${formatClp(montoGastoFijo)})`);

  // Egresos variables
  assert(balance.egresos.variables === montoEgreso,
    `Egresos variables = ${formatClp(montoEgreso)}`);

  // Gastos fijos mensuales
  assert(balance.egresos.fijosMensuales === montoGastoFijo,
    `Gastos fijos mensuales = ${formatClp(montoGastoFijo)}`);

  // Saldo = ingresos - egresos
  const saldoEsperado = ingresosEsperados - egresosEsperados;
  assert(balance.saldo === saldoEsperado,
    `Saldo = ${formatClp(saldoEsperado)} (${formatClp(ingresosEsperados)} - ${formatClp(egresosEsperados)})`);

  // Detalle de pagos contiene el pago creado
  const pagoEnDetalle = balance.detalle.pagos.find((p) => p.id === pagoId);
  assert(pagoEnDetalle !== undefined, 'Pago creado aparece en el detalle de pagos');

  // Detalle de egresos contiene el egreso creado
  const egresoEnDetalle = balance.detalle.egresos.find((e) => e.monto === montoEgreso && e.descripcion === 'Egreso de prueba E2E');
  assert(egresoEnDetalle !== undefined, 'Egreso creado aparece en el detalle de egresos');

  // Detalle de otros ingresos contiene el creado
  const otroEnDetalle = balance.detalle.otrosIngresos.find((o) => o.monto === montoOtroIngreso && o.descripcion === 'Rifa de prueba E2E');
  assert(otroEnDetalle !== undefined, 'Otro ingreso creado aparece en el detalle');

  // ------------------------------------------------------------
  // 10. Limpiar datos de prueba
  // ------------------------------------------------------------
  await pool.query('DELETE FROM pago_mes WHERE pagoId = ?', [pagoId]);
  await pool.query('DELETE FROM comprobante WHERE pagoId = ?', [pagoId]);
  await pool.query('DELETE FROM pago WHERE id = ?', [pagoId]);
  await pool.query('DELETE FROM egreso WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM otro_ingreso WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM gasto_fijo WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM movimiento_bancario WHERE descripcion LIKE ?', ['%E2E%']);
  await pool.query('DELETE FROM socio WHERE rut = ?', [rutPrueba]);

  await pool.end();

  // ------------------------------------------------------------
  // Resumen
  // ------------------------------------------------------------
  console.log(`\n📋 Resultado: ${pruebasPasadas} pasadas, ${pruebasFalladas} falladas`);
  if (pruebasFalladas > 0) {
    process.exit(1);
  }
  console.log('✅ E2E Balance Check — TODAS LAS PRUEBAS PASARON');
}

function formatClp(n) {
  return `$${n.toLocaleString('es-CL')}`;
}

main().catch((err) => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});