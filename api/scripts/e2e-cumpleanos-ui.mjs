/**
 * E2E de la UI de Cumpleaños.
 *
 * Abre Chrome headless con CDP, navega a Cumpleaños y comprueba que se listen
 * los cumpleaños del mes, que la tarjeta abra la vista previa y que el modal
 * muestre el correo renderizado. No envía correos reales.
 *
 * Las capturas se guardan en la carpeta temporal del sistema, fuera del
 * repositorio, porque la pantalla muestra datos personales del club.
 *
 * Uso: node api/scripts/e2e-cumpleanos-ui.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';
const CHROME =
  process.env.CHROME_PATH ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9338;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-cumpleanos-'));
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
      const data = await res.json();
      if (data.webSocketDebuggerUrl) return data.webSocketDebuggerUrl;
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
  console.log('E2E de la UI de Cumpleaños\n');

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
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('falló el WebSocket')), { once: true });
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
    const ruta = join(tmpdir(), nombre);
    writeFileSync(ruta, Buffer.from(data, 'base64'));
    console.log(`  📷 ${ruta}`);
  };

  await send('Page.navigate', { url: `${BASE}/` }, sessionId);
  await sleep(4500);
  await evaluar(`
    window.__e2e = {
      norm: (s) => (s || '').replace(/[\\s•]/g, '').toLowerCase(),
      boton: (texto) => [...document.querySelectorAll('button')]
        .find((b) => __e2e.norm(b.textContent).includes(__e2e.norm(texto))),
    };
  `);

  await evaluar(`__e2e.boton('Cumpleaños')?.click(); true`);
  await sleep(1600);

  const h1 = await evaluar(`document.querySelector('main h1')?.innerText ?? ''`);
  check('la sección Cumpleaños abre con su título', h1 === 'Cumpleaños', `→ "${h1}"`);

  const texto = await evaluar(`document.body.innerText`);
  check(
    'muestra el mes y los contadores',
    /Cumpleaños este mes/i.test(texto) &&
      /Con correo registrado/i.test(texto) &&
      /Saludos enviados/i.test(texto),
    `→ ${texto.slice(0, 400)}`,
  );

  const tarjetas = await evaluar(
    `document.querySelectorAll('main h2').length`,
  );
  check('hay tarjetas de cumpleaños listadas', Number(tarjetas) >= 1, `→ ${tarjetas}`);

  const botonesSaludar = await evaluar(
    `[...document.querySelectorAll('main button')].filter(b => /saludar|ver saludo/i.test(b.textContent)).length`,
  );
  check('cada cumpleaños tiene acción de saludo', Number(botonesSaludar) >= 1, `→ ${botonesSaludar}`);

  await capturar('cumpleanos-ui.png');

  await evaluar(
    `[...document.querySelectorAll('main button')].find(b => /saludar|ver saludo/i.test(b.textContent))?.click(); true`,
  );
  await sleep(1200);

  const modal = await evaluar(`document.body.innerText`);
  const tieneIframe = await evaluar(
    `Boolean(document.querySelector('iframe[title*="Vista previa"]'))`,
  );
  check(
    'la vista previa abre con asunto y correo renderizado',
    /Saludo para/i.test(modal) && /Asunto/i.test(modal) && tieneIframe === true,
    `→ iframe=${tieneIframe}`,
  );
  check(
    'el modal permite copiar el texto',
    /Copiar texto/i.test(modal),
  );

  const estadoEnvio = await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /enviar saludo/i.test(x.textContent));
    return b ? (b.disabled ? 'deshabilitado' : 'habilitado') : 'sin botón';
  })()`);
  console.log(`  ℹ Botón Enviar saludo: ${estadoEnvio}`);

  await capturar('cumpleanos-preview.png');

  await evaluar(`document.querySelector('button[aria-label="Cerrar saludo"]')?.click(); true`);
  await sleep(400);

  ws.close();
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('\nError inesperado:', err);
} finally {
  chrome.kill();
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}
