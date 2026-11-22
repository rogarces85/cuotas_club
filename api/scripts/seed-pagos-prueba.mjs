/**
 * Siembra pagos de prueba para los socios existentes en la base principal.
 *
 * Crea pagos de 2026 (meses enero a noviembre) con mix de estados:
 * - APROBADO: la mayoría (cuentan para recaudación)
 * - PENDIENTE: algunos
 * - RECHAZADO: pocos
 *
 * El monto se toma del estado del socio:
 *   ACTIVO   -> 15000
 *   MEMBRESIA -> 10000
 *   BECADO   -> 0
 *
 * Es seguro correrlo varias veces: borra primero los pagos de prueba
 * (código_pago LIKE 'PRUEBA-%') y los vuelve a crear.
 *
 * Uso: node api/scripts/seed-pagos-prueba.mjs
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const MONTO_POR_ESTADO = {
  ACTIVO: 15000,
  MEMBRESIA: 10000,
  BECADO: 0,
};

const MESES_2026 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]; // hasta noviembre (mes actual)

const pool = createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'osorno_app',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'osorno_runners_v2',
});

const ts = Math.floor(Date.now() / 1000);

async function main() {
  // Socios activos con sus datos
  const [socios] = await pool.query(
    `SELECT id_socio, rut, nombre, anio, sexo, estado, fecha_nacimiento, fecha_ingreso
     FROM socio
     WHERE activo = 1
     ORDER BY nombre`,
  );

  if (!socios || socios.length === 0) {
    throw new Error('No hay socios activos en la base. Importá el padrón primero.');
  }

  // Borrar pagos de prueba anteriores por si se corre dos veces
  const [borrados] = await pool.query(
    `DELETE FROM pago WHERE codigo_pago LIKE 'PRUEBA-%'`,
  );
  console.log(`Pagos de prueba previos borrados: ${borrados.affectedRows}`);

  let insertados = 0;

  for (const socio of socios) {
    const montoBase = MONTO_POR_ESTADO[socio.estado] ?? 15000;

    for (const mes of MESES_2026) {
      // Decidir estado del pago: 70% aprobado, 20% pendiente, 10% rechazado
      const aleatorio = Math.random();
      let estadoPago = 'APROBADO';
      if (aleatorio > 0.7) estadoPago = 'PENDIENTE';
      if (aleatorio > 0.9) estadoPago = 'RECHAZADO';

      // Día de pago entre el 1 y el 28 (seguro para todos los meses)
      const dia = 1 + Math.floor(Math.random() * 28);
      const fechaPago = `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
      const codigoPago = `PRUEBA-${String(insertados + 1).padStart(5, '0')}`;
      const mesDetalle = `2026-${String(mes).padStart(2, '0')}`;
      const monto = estadoPago === 'RECHAZADO' ? 0 : montoBase;

      await pool.query(
        `INSERT INTO pago
          (id_socio, rut, nombre_snapshot, anio, sexo, estado, situacion, fecha_pago,
           total_pago, valor_cuota, tipo_cuota, meses_cantidad, meses_detalle, observacion,
           origen, codigo_pago, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          socio.id_socio,
          socio.rut,
          socio.nombre,
          socio.anio,
          socio.sexo,
          estadoPago,
          null,
          fechaPago,
          monto,
          montoBase,
          socio.estado,
          1,
          mesDetalle,
          `Pago de prueba ${fechaPago}`,
          'manual',
          codigoPago,
          ts,
          ts,
        ],
      );
      insertados++;
    }
  }

  // Verificación
  const [[total]] = await pool.query('SELECT COUNT(*) AS total FROM pago WHERE codigo_pago LIKE ?', ['PRUEBA-%']);
  const [[recaudado]] = await pool.query(
    `SELECT COALESCE(SUM(total_pago),0) AS total FROM pago WHERE codigo_pago LIKE 'PRUEBA-%' AND estado = 'APROBADO'`,
  );
  const [[pendientes]] = await pool.query(
    `SELECT COUNT(*) AS total FROM pago WHERE codigo_pago LIKE 'PRUEBA-%' AND estado = 'PENDIENTE'`,
  );
  const [[rechazados]] = await pool.query(
    `SELECT COUNT(*) AS total FROM pago WHERE codigo_pago LIKE 'PRUEBA-%' AND estado = 'RECHAZADO'`,
  );

  console.log(`Pagos de prueba insertados: ${insertados}`);
  console.log(`Total pagos de prueba en BD: ${total.total}`);
  console.log(`Recaudación aprobada de prueba: $${Number(recaudado.total).toLocaleString('es-CL')}`);
  console.log(`Pendientes: ${pendientes.total} | Rechazados: ${rechazados.total}`);

  await pool.end();
}

main().catch((err) => {
  console.error('Error sembrando pagos:', err);
  process.exit(1);
});
