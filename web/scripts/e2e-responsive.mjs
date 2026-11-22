/**
 * E2E responsive del shell: sidebar de escritorio, cajón móvil y riel plegado.
 *
 * Comprueba:
 * - 1280 px: sidebar visible (264 px), sin hamburguesa; el control de plegado
 *   la deja en 76 px y la vuelve a expandir.
 * - 768 px: sidebar visible y sin desborde horizontal.
 * - 390 px: sidebar fuera de pantalla, hamburguesa visible, sin desborde.
 *   Al abrir el cajón aparecen las etiquetas y el fondo; al elegir una sección
 *   el cajón se cierra y navega. Escape también lo cierra.
 *
 * Uso: node web/scripts/e2e-responsive.mjs
 */

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';
const CHROME =
  process.env.CHROME_PATH ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9341;

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

const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-responsive-'));
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

const ESTADO = `(() => {
  const aside = document.querySelector('#sidebar');
  const rect = aside.getBoundingClientRect();
  const hamburger = document.querySelector('button[aria-label="Abrir menú"]');
  const hRect = hamburger?.getBoundingClientRect();
  return {
    innerW: window.innerWidth,
    scrollW: document.documentElement.scrollWidth,
    asideX: Math.round(rect.x),
    asideW: Math.round(rect.width),
    hamburgerVisible: Boolean(hRect && hRect.width > 0),
    labelsText: aside.innerText.replace(/\\s+/g, ' ').trim(),
    backdrop: Boolean(document.querySelector('#sidebar-backdrop')),
    bodyOverflow: document.body.style.overflow,
    titulo: document.querySelector('main h1')?.innerText ?? '',
  };
})()`;

async function main() {
  console.log('E2E responsive del shell\n');

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
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Network.setCookie', {
    name: 'better-auth.session_token',
    value: token,
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }, sessionId);

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

  const vista = async (width, height, mobile) => {
    await send(
      'Emulation.setDeviceMetricsOverride',
      { width, height, deviceScaleFactor: 1, mobile },
      sessionId,
    );
    await send('Page.navigate', { url: `${BASE}/` }, sessionId);
    await sleep(3800);
    return evaluar(ESTADO);
  };

  // ---------- Escritorio ----------
  let estado = await vista(1280, 900, false);
  check(
    '1280: sidebar visible de 264px y sin hamburguesa',
    estado.asideX >= 0 && estado.asideW === 264 && !estado.hamburgerVisible,
    JSON.stringify(estado),
  );
  check('1280: sin desborde horizontal', estado.scrollW <= 1280, `→ ${estado.scrollW}`);

  await evaluar(`document.querySelector('button[aria-label="Contraer menú"]')?.click(); true`);
  await sleep(600);
  estado = await evaluar(ESTADO);
  check(
    '1280: el control deja la sidebar en riel de 76px',
    estado.asideW === 76 && !estado.labelsText.includes('Configuración'),
    JSON.stringify(estado),
  );

  await evaluar(`document.querySelector('button[aria-label="Expandir menú"]')?.click(); true`);
  await sleep(600);
  estado = await evaluar(ESTADO);
  check('1280: el control vuelve a expandir a 264px', estado.asideW === 264, `→ ${estado.asideW}`);

  // ---------- Tablet ----------
  estado = await vista(768, 900, false);
  check(
    '768: sidebar visible y sin hamburguesa',
    estado.asideX >= 0 && estado.asideW === 264 && !estado.hamburgerVisible,
    JSON.stringify(estado),
  );
  check('768: sin desborde horizontal', estado.scrollW <= 768, `→ ${estado.scrollW}`);

  // ---------- Móvil ----------
  estado = await vista(390, 800, true);
  check(
    '390: sidebar fuera de pantalla y hamburguesa visible',
    estado.asideX < 0 && estado.hamburgerVisible && !estado.backdrop,
    JSON.stringify(estado),
  );
  check('390: sin desborde horizontal', estado.scrollW <= 390, `→ ${estado.scrollW}`);

  await evaluar(`document.querySelector('button[aria-label="Abrir menú"]')?.click(); true`);
  await sleep(500);
  estado = await evaluar(ESTADO);
  check(
    '390: el cajón se abre con etiquetas y fondo',
    estado.asideX >= 0 && estado.asideW === 264 && estado.backdrop && estado.labelsText.includes('Socios'),
    JSON.stringify(estado),
  );
  check(
    '390: con el cajón abierto el fondo no hace scroll',
    estado.bodyOverflow === 'hidden',
    `→ "${estado.bodyOverflow}"`,
  );

  await evaluar(`(() => {
    const b = [...document.querySelectorAll('#sidebar button')]
      .find(x => (x.textContent || '').replace(/[\\s•]/g, '').toLowerCase() === 'socios');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(700);
  estado = await evaluar(ESTADO);
  check(
    '390: elegir una sección cierra el cajón y navega',
    estado.asideX < 0 && estado.titulo === 'Socios' && !estado.backdrop,
    JSON.stringify(estado),
  );
  check('390: al cerrar se restaura el scroll', estado.bodyOverflow !== 'hidden');

  await evaluar(`document.querySelector('button[aria-label="Abrir menú"]')?.click(); true`);
  await sleep(450);
  await evaluar(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); true`);
  await sleep(450);
  estado = await evaluar(ESTADO);
  check('390: Escape cierra el cajón', estado.asideX < 0 && !estado.backdrop);

  ws.close();
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('\nError inesperado:', err);
  chrome.kill();
  process.exit(1);
} finally {
  chrome.kill();
}
