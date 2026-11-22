/**
 * E2E de navegación del dashboard.
 *
 * Abre la web en Chrome headless, inicia sesión por la API (para obtener la
 * cookie), y hace clic en cada ítem del sidebar verificando el <h1> de la vista.
 *
 * Uso: node web/scripts/e2e-nav.mjs [chromePath]
 */
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME =
  process.argv[2] ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe');

const BASE = 'http://localhost:5173';
const PORT = 9336;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const MENU = [
  { label: 'Panel', expected: 'Panel' },
  { label: 'Socios', expected: 'Socios' },
  { label: 'Cumpleaños', expected: 'Cumpleaños' },
  { label: 'Cuentas bancarias', expected: 'Cuentas bancarias' },
  { label: 'Cuotas', expected: 'Cuotas' },
  { label: 'Pagos', expected: 'Pagos' },
  { label: 'Becados', expected: 'Solicitudes de Becado' },
  { label: 'Morosidad', expected: 'Estado de cuenta' },
  { label: 'Bancos', expected: 'Bancos' },
  { label: 'Gastos', expected: 'Gastos e Ingresos' },
  { label: 'Reportes', expected: 'Reportes' },
  { label: 'Configuración', expected: 'Configuración' },
];

// 1) Token de sesión vía API
const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: BASE },
  body: JSON.stringify({ email: 'tesorero@osornorunners.cl', password: 'Osorno2026!' }),
});
if (!login.ok) {
  console.error('No se pudo iniciar sesión:', login.status, await login.text());
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? [])
  .map((c) => c.split(';')[0])
  .find((c) => c.startsWith('better-auth.session_token='));
if (!cookie) {
  console.error('La API no devolvió cookie de sesión');
  process.exit(1);
}
const token = cookie.split('=')[1];
console.log('Sesión obtenida');

// 2) Chrome headless + CDP
const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-nav-'));
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
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome no expuso el puerto de depuración');
}

function makeClient(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result);
    }
  });
  return (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params, sessionId }));
      setTimeout(() => {
        if (pending.has(msgId)) {
          pending.delete(msgId);
          reject(new Error(`timeout en ${method}`));
        }
      }, 20000);
    });
}

let fallos = 0;
try {
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
    { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false },
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

  await send('Page.navigate', { url: BASE + '/' }, sessionId);
  await sleep(4500);

  for (const item of MENU) {
    const click = await send(
      'Runtime.evaluate',
      {
        expression: `
          (() => {
            const norm = (s) => (s || '').replace(/[•\\s]/g, '').toLowerCase();
            const btns = Array.from(document.querySelectorAll('button'));
            const b = btns.find(x => norm(x.textContent) === norm(${JSON.stringify(item.label)}));
            if (!b) return 'NOT_FOUND';
            b.click();
            return 'OK';
          })()
        `,
        returnByValue: true,
      },
      sessionId,
    );
    await sleep(900);

    const { result } = await send(
      'Runtime.evaluate',
      {
        expression: `document.querySelector('main h1')?.innerText ?? '(sin h1)'`,
        returnByValue: true,
      },
      sessionId,
    );

    const got = (result?.value ?? '').trim();
    const ok = click.result?.value === 'OK' && got === item.expected;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FALLA'} ${item.label} → "${got}" (esperado "${item.expected}")`);
  }

  ws.close();
} catch (err) {
  console.error('Error E2E:', err.message);
  fallos++;
} finally {
  chrome.kill();
}

console.log(fallos === 0 ? '\nE2E_NAV_OK' : `\nE2E_NAV_FAIL (${fallos} fallos)`);
process.exit(fallos === 0 ? 0 : 1);
