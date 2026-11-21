/**
 * E2E de la UI de Socios: formulario modernizado, campos nuevos, validación
 * de dirección con sugerencias y modal de importación masiva.
 *
 * - Abre Chrome headless con CDP, inicia sesión por la API e inyecta la cookie.
 * - Crea un socio desde el formulario (incluye fecha de nacimiento, fecha de
 *   ingreso, sexo y dirección validada contra OpenStreetMap).
 * - Verifica la ficha y que la tabla muestre los datos nuevos.
 * - Abre el modal de importación y comprueba su contenido.
 * - Guarda capturas en 02-DOCS/preview/.
 * - Limpia el socio de prueba al final (API + fila física).
 *
 * Uso: node api/scripts/e2e-socios-form.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPool } from 'mysql2/promise';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';
const CHROME =
  process.env.CHROME_PATH ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9337;
const RUT_TEST = '17682512K';
const RUT_IMPORTADO = '152426674';
const NOMBRE_TEST = 'Prueba Formulario Moderno';
const NOMBRE_IMPORTADO = 'Importada E2E';
const DIRECCION_TEST = 'Av. Juan Mackenna 1234, Osorno';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const pool = createPool({
  host: process.env.DB_HOST ?? '127.0.0.1',
  port: Number(process.env.DB_PORT ?? 3306),
  user: process.env.DB_USER ?? 'osorno_app',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'osorno_runners_v2',
});

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

// ---------------------------------------------------------------------------
// CDP
// ---------------------------------------------------------------------------

const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-socios-form-'));
const chrome = spawn(
  CHROME,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--no-default-browser-check',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
);

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {
      /* arrancando */
    }
    await sleep(250);
  }
  throw new Error('Chrome no expuso el puerto de depuración');
}

function makeClient(ws) {
  let id = 0;
  const pendientes = new Map();
  ws.addEventListener('message', (evento) => {
    const msg = JSON.parse(evento.data);
    if (msg.id && pendientes.has(msg.id)) {
      const { resolve, reject } = pendientes.get(msg.id);
      pendientes.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pendientes.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
      setTimeout(() => {
        if (pendientes.has(msgId)) {
          pendientes.delete(msgId);
          reject(new Error(`timeout en ${method}`));
        }
      }, 25000);
    });
}

async function main() {
  console.log('E2E de la UI de Socios (formulario + importación)\n');

  // Limpieza defensiva por si quedó una corrida anterior.
  await pool.query('DELETE FROM socio WHERE rut IN (?, ?)', [RUT_TEST, RUT_IMPORTADO]);

  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('better-auth.session_token='));
  check('login tesorero (200)', login.ok && Boolean(cookie), `→ ${login.status}`);
  const token = cookie?.split('=')[1] ?? '';

  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('falló el WebSocket')), { once: true });
  });
  const send = makeClient(ws);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false },
    sessionId,
  );
  await send(
    'Network.setCookie',
    {
      name: 'better-auth.session_token',
      value: token,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    sessionId,
  );

  const evaluar = async (expresion) => {
    const { result, exceptionDetails } = await send(
      'Runtime.evaluate',
      { expression: expresion, returnByValue: true, awaitPromise: true },
      sessionId,
    );
    if (exceptionDetails) {
      throw new Error(exceptionDetails.exception?.description ?? 'Error evaluando en la página');
    }
    return result?.value;
  };

  const capturar = async (nombre) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const dir = resolve('02-DOCS/preview');
    mkdirSync(dir, { recursive: true });
    const ruta = join(dir, nombre);
    writeFileSync(ruta, Buffer.from(data, 'base64'));
    console.log(`  📷 ${ruta}`);
  };

  // Helpers que se ejecutan en la página.
  const helpers = `
    window.__e2e = {
      norm: (s) => (s || '').replace(/[\\s•]/g, '').toLowerCase(),
      boton: (texto) => [...document.querySelectorAll('button')]
        .find((b) => __e2e.norm(b.textContent).includes(__e2e.norm(texto))),
      setValor: (selector, valor) => {
        const el = document.querySelector(selector);
        if (!el) return false;
        const proto = el instanceof HTMLSelectElement
          ? HTMLSelectElement.prototype
          : el instanceof HTMLTextAreaElement
            ? HTMLTextAreaElement.prototype
            : HTMLInputElement.prototype;
        const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setter.call(el, valor);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        return el.value;
      },
    };
  `;

  await send('Page.navigate', { url: `${BASE}/` }, sessionId);
  await sleep(4500);
  await evaluar(helpers);

  // 1) Abrir Socios y el formulario.
  await evaluar(`__e2e.boton('Socios')?.click(); true`);
  await sleep(1200);
  await evaluar(`__e2e.boton('Nuevo socio')?.click(); true`);
  await sleep(700);

  const modal = await evaluar(`document.body.innerText`);
  const modalMayus = modal.toUpperCase();
  check(
    'modal con secciones y ejemplos',
    ['IDENTIFICACIÓN', 'DATOS PERSONALES', 'CONTACTO', 'MEMBRESÍA'].every((t) =>
      modalMayus.includes(t),
    ) &&
      modal.includes('12.345.678-9') &&
      modal.includes('Camila Andrea Rojas Muñoz') &&
      modal.includes('15-03-1990'),
    `→ ${modal.slice(0, 400)}`,
  );
  check(
    'sexo es un select Hombre/Mujer/Indefinido',
    (await evaluar(`(() => {
      const s = document.querySelector('#sexo');
      return s ? [...s.options].map(o => o.textContent).join('|') : 'SIN_SELECT';
    })()`)) === 'Sin especificar|Hombre|Mujer|Indefinido',
    '→ revisar opciones',
  );
  check(
    'existen fecha de nacimiento, fecha de ingreso y dirección',
    Boolean(
      await evaluar(
        `Boolean(document.querySelector('#fechaNacimiento') && document.querySelector('#fechaIngreso') && document.querySelector('#direccion'))`,
      ),
    ),
  );

  await capturar('socios-modal-nuevo.png');

  // 2) Llenar el formulario.
  await evaluar(`__e2e.setValor('#rut', '17.682.512-K')`);
  await evaluar(`__e2e.setValor('#nombre', ${JSON.stringify(NOMBRE_TEST)})`);
  await evaluar(`__e2e.setValor('#sexo', 'MUJER')`);
  await evaluar(`__e2e.setValor('#fechaNacimiento', '1990-03-15')`);
  await evaluar(`__e2e.setValor('#fechaIngreso', '2021-03-01')`);
  await evaluar(`__e2e.setValor('#direccion', ${JSON.stringify(DIRECCION_TEST)})`);

  // La búsqueda de direcciones espera 550 ms + red.
  let sugerencias = 0;
  for (let intento = 0; intento < 20; intento++) {
    await sleep(400);
    sugerencias = await evaluar(
      `document.querySelectorAll('ul[aria-label="Sugerencias de dirección"] button').length`,
    );
    if (sugerencias > 0) break;
  }
  check('la dirección muestra sugerencias de OpenStreetMap/Google', sugerencias > 0, `→ ${sugerencias}`);

  if (sugerencias > 0) {
    await evaluar(
      `document.querySelector('ul[aria-label="Sugerencias de dirección"] button')?.click(); true`,
    );
    await sleep(500);
    const validada = await evaluar(`document.body.innerText`);
    check('al elegir la sugerencia queda como dirección validada', validada.includes('Dirección validada'));
    await capturar('socios-modal-direccion-validada.png');
  }
  await evaluar(`__e2e.setValor('#email', 'prueba.formulario@correo.cl')`);
  await evaluar(`__e2e.setValor('#telefono', '+56 9 5555 6666')`);
  await evaluar(`__e2e.setValor('#anio', '2026')`);
  await evaluar(`__e2e.setValor('#estado', 'ACTIVO')`);
  await evaluar(`__e2e.boton('Crear socio')?.click(); true`);
  await sleep(2200);

  // 3) Verificar tabla y ficha.
  const listado = await evaluar(`document.body.innerText`);
  check(
    'el socio creado aparece en la tabla con sexo e ingreso',
    listado.includes(NOMBRE_TEST) && listado.includes('Mujer') && listado.includes('01-03-2021'),
    `→ ${listado.slice(0, 500)}`,
  );
  const edadTabla = await evaluar(`(() => {
    const fila = [...document.querySelectorAll('tbody tr')].find(tr => tr.textContent.includes(${JSON.stringify(NOMBRE_TEST)}));
    return fila ? fila.querySelectorAll('td')[3]?.textContent.trim() : 'SIN_FILA';
  })()`);
  check('la tabla muestra la edad derivada de la fecha de nacimiento', edadTabla === '36', `→ ${edadTabla}`);
  await capturar('socios-tabla.png');

  await evaluar(`(() => {
    const fila = [...document.querySelectorAll('tr')].find(tr => tr.textContent.includes(${JSON.stringify(NOMBRE_TEST)}));
    const boton = fila && [...fila.querySelectorAll('button')].find(b => __e2e.norm(b.textContent) === 'ficha');
    boton?.click();
    return Boolean(boton);
  })()`);
  await sleep(900);
  const ficha = await evaluar(`document.body.innerText`);
  const fichaMayus = ficha.toUpperCase();
  check(
    'la ficha muestra nacimiento, ingreso y dirección',
    fichaMayus.includes('NACIMIENTO') &&
      ficha.includes('15-03-1990') &&
      ficha.includes('01-03-2021') &&
      fichaMayus.includes('DIRECCIÓN') &&
      ficha.includes('Mackenna'),
    `→ ${ficha.slice(0, 500)}`,
  );
  await capturar('socios-ficha.png');
  await evaluar(`document.querySelector('button[aria-label="Cerrar ficha"]')?.click(); true`);
  await sleep(400);

  // 4) Modal de importación.
  await evaluar(`__e2e.boton('Importar')?.click(); true`);
  await sleep(600);
  const importar = await evaluar(`document.body.innerText`);
  check(
    'modal de importación con plantilla, carga y opción de actualizar',
    importar.includes('Descarga la plantilla limpia') &&
      importar.includes('Sube la planilla llena') &&
      importar.includes('Actualizar socios que ya existen') &&
      importar.includes('rut') &&
      importar.includes('anio'),
    `→ ${importar.slice(0, 500)}`,
  );
  await capturar('socios-importar.png');

  // 4b) Subir una planilla real y confirmar la importación desde la UI.
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    libro,
    XLSX.utils.aoa_to_sheet([
      ['rut', 'nombre', 'anio', 'sexo', 'fecha_nacimiento', 'fecha_ingreso', 'direccion', 'email', 'telefono', 'estado', 'activo'],
      [RUT_IMPORTADO, NOMBRE_IMPORTADO, 2026, 'Mujer', '1995-07-20', '2022-04-01', 'Los Carrera 555, Osorno', 'importada.e2e@correo.cl', '+56 9 7777 8888', 'ACTIVO', '1'],
    ]),
    'Socios',
  );
  const rutaLibro = join(tmpdir(), `socios-e2e-${Date.now()}.xlsx`);
  XLSX.writeFile(libro, rutaLibro);

  await send('DOM.enable', {}, sessionId);
  const { root } = await send('DOM.getDocument', {}, sessionId);
  const { nodeId } = await send(
    'DOM.querySelector',
    { nodeId: root.nodeId, selector: 'input[type=file]' },
    sessionId,
  );
  await send('DOM.setFileInputFiles', { nodeId, files: [rutaLibro] }, sessionId);

  let previewTexto = '';
  for (let intento = 0; intento < 20; intento++) {
    await sleep(400);
    previewTexto = await evaluar(`document.body.innerText`);
    if (previewTexto.includes('Revisión previa')) break;
  }
  check(
    'la planilla se valida y muestra el resumen antes de importar',
    previewTexto.includes('Revisión previa') && previewTexto.includes('Importar 1 socio'),
    `→ ${previewTexto.slice(-400)}`,
  );
  await capturar('socios-importar-preview.png');

  await evaluar(`__e2e.boton('Importar 1 socio')?.click(); true`);
  let exito = '';
  for (let intento = 0; intento < 20; intento++) {
    await sleep(400);
    exito = await evaluar(`document.body.innerText`);
    if (exito.includes('Importación terminada')) break;
  }
  check('la importación desde la UI termina con resumen', exito.includes('Importación terminada'), `→ ${exito.slice(-400)}`);

  await evaluar(`__e2e.boton('Cerrar')?.click(); true`);
  await sleep(1200);
  const conImportado = await evaluar(`document.body.innerText`);
  check(
    'el socio importado aparece en el padrón',
    conImportado.includes(NOMBRE_IMPORTADO),
    `→ ${conImportado.slice(0, 400)}`,
  );
  await capturar('socios-tabla-importada.png');

  ws.close();
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('\nError inesperado:', err);
} finally {
  chrome.kill();
  try {
    await pool.query('DELETE FROM socio WHERE rut IN (?, ?)', [RUT_TEST, RUT_IMPORTADO]);
  } finally {
    await pool.end();
  }
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}
