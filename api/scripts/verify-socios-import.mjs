/**
 * Verificación re-ejecutable de la importación masiva de socios.
 *
 * Cubre:
 * - Descarga de la plantilla Excel limpia (hojas Socios / Ejemplos / Instrucciones).
 * - Alta manual con los campos nuevos (fechas, dirección, sexo cerrado).
 * - Validación previa (dryRun) sin escribir en la base.
 * - Importación real de Excel: inserta, actualiza y reporta filas inválidas.
 * - Las celdas vacías no borran datos existentes al actualizar.
 * - Endpoint de validación de direcciones (OpenStreetMap / Google).
 * - Limpieza física de los socios de prueba.
 *
 * Uso: node api/scripts/verify-socios-import.mjs
 * Requiere la API corriendo y MariaDB arriba.
 */

import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';

const RUT_EXISTENTE = '127556636';
const RUT_NUEVO = '17682512K';
const RUT_MALO = '12345678-9';

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

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = { Origin: BASE };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers.Cookie = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: form ?? (body !== undefined ? JSON.stringify(body) : undefined),
    redirect: 'manual',
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* respuesta binaria o vacía */
  }
  return { status: res.status, data, res };
}

function libroDePrueba() {
  const encabezados = [
    'rut',
    'nombre',
    'anio',
    'sexo',
    'fecha_nacimiento',
    'fecha_ingreso',
    'direccion',
    'email',
    'telefono',
    'estado',
    'activo',
  ];

  const filas = [
    // Nueva socia: todos los campos nuevos.
    [
      RUT_NUEVO,
      'Camila Importada',
      2026,
      'Mujer',
      '15-03-1990',
      '01-03-2021',
      'Av. Juan Mackenna 1234, Osorno',
      'CAMILA.IMPORTADA@Correo.CL',
      '+56 9 1111 2222',
      'ACTIVO',
      '1',
    ],
    // Socia existente: solo cambia nombre/estado; las celdas vacías no borran.
    [RUT_EXISTENTE, 'Renombrada Por Import', 2026, '', '', '', '', '', '', 'MEMBRESIA', '1'],
    // RUT inválido: debe quedar reportado y no escribir nada.
    [RUT_MALO, 'RUT Malo', 2026, '', '', '', '', '', '', '', ''],
    // RUT repetido dentro del archivo: también es error.
    [RUT_NUEVO, 'Duplicada', 2026, '', '', '', '', '', '', '', ''],
  ];

  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([encabezados, ...filas]),
    'Socios',
  );
  return XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' });
}

async function subir(contenido, nombre, { force = false, dryRun = false } = {}) {
  const form = new FormData();
  form.append('archivo', new Blob([contenido]), nombre);
  form.append('force', String(force));
  form.append('dryRun', String(dryRun));
  return api('/api/socios/importar', { method: 'POST', form });
}

async function limpiar() {
  try {
    await pool.query('DELETE FROM socio WHERE rut IN (?, ?)', [RUT_EXISTENTE, RUT_NUEVO]);
  } catch (err) {
    console.error('No se pudo limpiar la base:', err.message);
  }
  await pool.end();
}

async function main() {
  console.log('Verificación de campos nuevos + importación de socios\n');

  const login = await api('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  check('login tesorero (200)', login.status === 200, `→ ${login.status}`);
  cookie = (login.res.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('better-auth.session_token=')) ?? '';
  check('cookie de sesión recibida', Boolean(cookie));

  // ---- Plantilla ---------------------------------------------------------
  const plantillaRes = await fetch(`${BASE}/api/socios/plantilla`, {
    headers: { Cookie: cookie, Origin: BASE },
  });
  const plantilla = Buffer.from(await plantillaRes.arrayBuffer());
  check(
    'plantilla xlsx (200, > 5 KB)',
    plantillaRes.status === 200 && plantilla.length > 5000,
    `→ ${plantillaRes.status}, ${plantilla.length} bytes`,
  );
  let hojas = [];
  if (plantilla.length > 0) {
    hojas = XLSX.read(plantilla, { type: 'buffer' }).SheetNames;
  }
  check(
    'plantilla con hojas Socios / Ejemplos / Instrucciones',
    ['Socios', 'Ejemplos', 'Instrucciones'].every((h) => hojas.includes(h)),
    `→ ${JSON.stringify(hojas)}`,
  );

  const importacionVacia = await subir(plantilla, 'plantilla-vacia.xlsx', { force: false });
  check(
    'importar plantilla sin datos → error claro (400/422)',
    [400, 422].includes(importacionVacia.status) &&
      /fila|datos|válid/i.test(importacionVacia.data?.error ?? ''),
    `→ ${importacionVacia.status} ${JSON.stringify(importacionVacia.data)}`,
  );

  // ---- Alta manual con los campos nuevos --------------------------------
  const alta = await api('/api/socios', {
    method: 'POST',
    body: {
      rut: RUT_EXISTENTE,
      nombre: 'Socia Existente',
      anio: 2026,
      sexo: 'MUJER',
      fechaNacimiento: '1985-05-20',
      fechaIngreso: '2019-04-10',
      direccion: 'Los Carrera 555, Osorno',
      estado: 'ACTIVO',
      email: 'existente@test.cl',
      telefono: '+56 9 3333 4444',
    },
  });
  check(
    'alta manual guarda sexo, fechas y dirección',
    alta.status === 201 &&
      alta.data?.sexo === 'MUJER' &&
      alta.data?.fechaNacimiento === '1985-05-20' &&
      alta.data?.fechaIngreso === '2019-04-10' &&
      alta.data?.direccion === 'Los Carrera 555, Osorno',
    `→ ${alta.status} ${JSON.stringify(alta.data)}`,
  );

  // Sexo fuera del catálogo debe rechazarse.
  const altaSexoMalo = await api('/api/socios', {
    method: 'POST',
    body: { rut: '111111118', nombre: 'Sexo Malo', anio: 2026, sexo: 'OTRO_VALOR' },
  });
  check('sexo fuera del catálogo → 400', altaSexoMalo.status === 400, `→ ${altaSexoMalo.status}`);

  // Fecha futura debe rechazarse.
  const anioFuturo = new Date().getFullYear() + 1;
  const altaFechaFutura = await api('/api/socios', {
    method: 'POST',
    body: {
      rut: '111111118',
      nombre: 'Fecha Futura',
      anio: 2026,
      fechaNacimiento: `${anioFuturo}-01-01`,
    },
  });
  check('fecha de nacimiento futura → 400', altaFechaFutura.status === 400, `→ ${altaFechaFutura.status}`);

  // ---- Dry run -----------------------------------------------------------
  const libro = libroDePrueba();
  const preview = await subir(libro, 'socios-prueba.xlsx', { force: true, dryRun: true });
  check(
    'dryRun valida sin escribir (1 alta, 1 actualización, 2 errores)',
    preview.status === 200 &&
      preview.data?.simulado === true &&
      preview.data?.insertados === 1 &&
      preview.data?.actualizados === 1 &&
      preview.data?.errores === 2,
    `→ ${preview.status} ${JSON.stringify(preview.data)}`,
  );

  const antesDeImportar = await api(`/api/socios?q=${RUT_NUEVO}`);
  check(
    'dryRun no creó al socio nuevo',
    antesDeImportar.status === 200 && antesDeImportar.data?.total === 0,
    `→ total=${antesDeImportar.data?.total}`,
  );

  // ---- Importación real --------------------------------------------------
  const importacion = await subir(libro, 'socios-prueba.xlsx', { force: true, dryRun: false });
  check(
    'importación real (1 insertado, 1 actualizado, 2 errores)',
    importacion.status === 200 &&
      importacion.data?.simulado === false &&
      importacion.data?.insertados === 1 &&
      importacion.data?.actualizados === 1 &&
      importacion.data?.errores === 2,
    `→ ${importacion.status} ${JSON.stringify(importacion.data)}`,
  );
  check(
    'errores de importación explican fila y motivo',
    (importacion.data?.detalleErrores ?? []).some((e) => /Fila 4/.test(e) && /RUT/.test(e)) &&
      (importacion.data?.detalleErrores ?? []).some((e) => /Fila 5/.test(e) && /repetido/.test(e)),
    `→ ${JSON.stringify(importacion.data?.detalleErrores)}`,
  );

  const nueva = await api(`/api/socios?q=${RUT_NUEVO}`);
  const filaNueva = nueva.data?.filas?.[0];
  check(
    'socio importado con sexo, fechas y dirección normalizados',
    nueva.data?.total === 1 &&
      filaNueva?.sexo === 'MUJER' &&
      filaNueva?.fechaNacimiento === '1990-03-15' &&
      filaNueva?.fechaIngreso === '2021-03-01' &&
      /Mackenna/.test(filaNueva?.direccion ?? '') &&
      filaNueva?.email === 'camila.importada@correo.cl',
    `→ ${JSON.stringify(filaNueva)}`,
  );

  const existente = await api(`/api/socios?q=${RUT_EXISTENTE}`);
  const filaExistente = existente.data?.filas?.[0];
  check(
    'actualización conserva lo que la celda vacía no trae',
    filaExistente?.nombre === 'Renombrada Por Import' &&
      filaExistente?.estado === 'MEMBRESIA' &&
      filaExistente?.fechaNacimiento === '1985-05-20' &&
      filaExistente?.direccion === 'Los Carrera 555, Osorno',
    `→ ${JSON.stringify(filaExistente)}`,
  );

  // ---- Validación de direcciones ----------------------------------------
  const direccion = await api(
    '/api/geocoding/buscar?q=' + encodeURIComponent('Av. Juan Mackenna 1234, Osorno'),
  );
  check(
    'validación de dirección devuelve sugerencias',
    direccion.status === 200 && (direccion.data?.resultados?.length ?? 0) > 0,
    `→ ${direccion.status} ${JSON.stringify(direccion.data)?.slice(0, 300)}`,
  );

  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('\nError inesperado:', err);
} finally {
  await limpiar();
  process.exit(failed === 0 ? 0 : 1);
}
