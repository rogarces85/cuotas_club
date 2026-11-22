/**
 * Verificación re-ejecutable del módulo Cumpleaños.
 *
 * - Siembra dos socios con cumpleaños en el mes actual (uno con correo y uno sin).
 * - Comprueba el listado, la edad, la antigüedad y la previa del correo.
 * - Verifica que no se envíe sin correo, que el envío sin SMTP configurado
 *   devuelva 503 y que un saludo ya registrado devuelva 409.
 * - Limpia los socios y felicitaciones de prueba.
 *
 * No envía correos reales: si MAIL_PASSWORD está configurado, omite la prueba
 * de envío real para no molestar a nadie.
 *
 * Uso: node api/scripts/verify-cumpleanos.mjs
 */

import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';

const RUT_CON_EMAIL = '123456785';
const RUT_SIN_EMAIL = '152426674';
const NOMBRE_CON_EMAIL = 'Cumpleaños Con Correo';
const NOMBRE_SIN_EMAIL = 'Cumpleaños Sin Correo';

const hoy = new Date();
const mm = String(hoy.getMonth() + 1).padStart(2, '0');
const anioActual = hoy.getFullYear();
const fechaNacimiento = `1992-${mm}-15`;
const fechaNacimientoSinEmail = `1988-${mm}-20`;

let passed = 0;
let failed = 0;

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

let cookie = '';
let idConEmail = null;
let idSinEmail = null;

async function api(path, { method = 'GET', body } = {}) {
  const headers = { Origin: BASE };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, data };
}

async function limpiar() {
  for (const rut of [RUT_CON_EMAIL, RUT_SIN_EMAIL]) {
    const [filas] = await pool.query('SELECT id_socio FROM socio WHERE rut = ?', [rut]);
    for (const fila of filas) {
      await pool.query('DELETE FROM felicitacion_cumpleanos WHERE id_socio = ?', [fila.id_socio]);
      await pool.query('DELETE FROM socio WHERE id_socio = ?', [fila.id_socio]);
    }
  }
}

async function main() {
  console.log('Verificación del módulo Cumpleaños\n');
  await limpiar();

  const loginRes = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  check('login tesorero (200)', loginRes.ok, `→ ${loginRes.status}`);
  cookie =
    (loginRes.headers.getSetCookie?.() ?? [])
      .map((c) => c.split(';')[0])
      .find((c) => c.startsWith('better-auth.session_token=')) ?? '';
  check('cookie de sesión recibida', Boolean(cookie));

  const altaCon = await api('/api/socios', {
    method: 'POST',
    body: {
      rut: RUT_CON_EMAIL,
      nombre: NOMBRE_CON_EMAIL,
      anio: anioActual,
      sexo: 'MUJER',
      fechaNacimiento,
      fechaIngreso: '2020-01-10',
      email: 'cumple.test@example.cl',
      estado: 'ACTIVO',
    },
  });
  idConEmail = altaCon.data?.id;
  check('alta socio con correo (201)', altaCon.status === 201, `→ ${altaCon.status} ${JSON.stringify(altaCon.data)}`);

  const altaSin = await api('/api/socios', {
    method: 'POST',
    body: {
      rut: RUT_SIN_EMAIL,
      nombre: NOMBRE_SIN_EMAIL,
      anio: anioActual,
      fechaNacimiento: fechaNacimientoSinEmail,
      estado: 'ACTIVO',
    },
  });
  idSinEmail = altaSin.data?.id;
  check('alta socio sin correo (201)', altaSin.status === 201, `→ ${altaSin.status}`);

  const lista = await api('/api/cumpleanos');
  const filaCon = lista.data?.filas?.find((f) => f.socioId === idConEmail);
  const filaSin = lista.data?.filas?.find((f) => f.socioId === idSinEmail);
  check(
    'listado del mes incluye a los dos socios',
    lista.status === 200 && Boolean(filaCon) && Boolean(filaSin),
    `→ ${lista.status} ${JSON.stringify(lista.data?.filas?.map((f) => f.nombre))}`,
  );
  check(
    'edad y antigüedad calculadas',
    filaCon?.edadCumple === anioActual - 1992 &&
      /años|meses/.test(filaCon?.membresia?.texto ?? ''),
    `→ edad=${filaCon?.edadCumple} membresia=${filaCon?.membresia?.texto}`,
  );
  check(
    'socio sin correo marcado como no enviable',
    filaSin?.email === null && filaSin?.puedeEnviar === false,
    `→ ${JSON.stringify(filaSin)}`,
  );

  const preview = await api(`/api/cumpleanos/${idConEmail}/preview`);
  check(
    'vista previa con asunto, texto y HTML',
    preview.status === 200 &&
      /cumpleaños/i.test(preview.data?.asunto ?? '') &&
      preview.data?.texto?.includes(NOMBRE_CON_EMAIL.split(' ')[0]) &&
      preview.data?.html?.includes('#df022f'),
    `→ ${preview.status} ${JSON.stringify(preview.data)?.slice(0, 200)}`,
  );

  const envioSinCorreo = await api(`/api/cumpleanos/${idSinEmail}/enviar`, { method: 'POST' });
  check('envío sin correo → 400', envioSinCorreo.status === 400, `→ ${envioSinCorreo.status}`);

  if (!process.env.MAIL_PASSWORD) {
    const envioSinSmtp = await api(`/api/cumpleanos/${idConEmail}/enviar`, { method: 'POST' });
    check(
      'envío sin SMTP configurado → 503 con mensaje claro',
      envioSinSmtp.status === 503 && /MAIL_PASSWORD/.test(envioSinSmtp.data?.error ?? ''),
      `→ ${envioSinSmtp.status} ${JSON.stringify(envioSinSmtp.data)}`,
    );
    const [sinRegistro] = await pool.query(
      'SELECT COUNT(*) AS total FROM felicitacion_cumpleanos WHERE id_socio = ? AND anio = ?',
      [idConEmail, anioActual],
    );
    check('el envío fallido no se registra', Number(sinRegistro[0].total) === 0);
  } else {
    console.log('  ⚠ MAIL_PASSWORD configurado: se omite el envío real para no molestar.');
  }

  // Un saludo ya registrado debe devolver 409 antes de intentar enviar.
  await pool.query(
    'INSERT INTO felicitacion_cumpleanos (id_socio, anio, email, enviado_at) VALUES (?, ?, ?, ?)',
    [idConEmail, anioActual, 'cumple.test@example.cl', Math.floor(Date.now() / 1000)],
  );
  const duplicado = await api(`/api/cumpleanos/${idConEmail}/enviar`, { method: 'POST' });
  check('saludo duplicado → 409', duplicado.status === 409, `→ ${duplicado.status}`);

  const listaEnviada = await api('/api/cumpleanos');
  const filaEnviada = listaEnviada.data?.filas?.find((f) => f.socioId === idConEmail);
  check(
    'el listado refleja el saludo enviado',
    Boolean(filaEnviada?.felicitacion) && filaEnviada?.puedeEnviar === false,
    `→ ${JSON.stringify(filaEnviada?.felicitacion)}`,
  );

  const sinSesion = await fetch(`${BASE}/api/cumpleanos`);
  check('listado sin sesión → 401', sinSesion.status === 401, `→ ${sinSesion.status}`);

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
