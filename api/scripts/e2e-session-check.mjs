/**
 * Prueba E2E real contra el navegador, usando el Chrome DevTools Protocol.
 * Sin dependencias: usa fetch y WebSocket nativos de Node.
 *
 * Objetivo: comprobar que con una cookie de sesión válida, la app React
 * muestra el shell (useSession detecta la sesión) en vez del login.
 *
 * Uso: node scripts/e2e-session-check.mjs <sessionToken> <chromePath>
 */
const [, , token, chromePath] = process.argv;

if (!token || !chromePath) {
  console.error('Uso: node e2e-session-check.mjs <sessionToken> <chromePath>');
  process.exit(1);
}

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9333;
const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-'));

const chrome = spawn(
  chromePath,
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {
      /* aún arrancando */
    }
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

try {
  const wsUrl = await getWsUrl();
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('fallo el WebSocket')), { once: true });
  });

  const send = makeClient(ws);

  // Pestaña nueva con sesión propia de CDP
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);

  // Inyecta la cookie de sesión que emitió Better Auth
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

  await send('Page.navigate', { url: 'http://localhost:5173/' }, sessionId);
  await sleep(5000);

  const { result } = await send(
    'Runtime.evaluate',
    { expression: 'document.body.innerText', returnByValue: true },
    sessionId,
  );

  const text = result?.value ?? '';
  const checks = {
    shell_visible: text.includes('Panel') && text.includes('Socios morosos'),
    login_oculto: !text.includes('Sistema de cuotas'),
    usuario_en_cabecera: text.includes('tesorero@osornorunners.cl'),
    boton_salir: text.includes('Salir'),
  };

  console.log(JSON.stringify({ checks, extracto: text.slice(0, 200) }, null, 2));

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'E2E_SESION_OK' : 'E2E_SESION_FALLO');
  ws.close();
  chrome.kill();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error('Error E2E:', err.message);
  chrome.kill();
  process.exit(1);
}
