/**
 * Prueba E2E real contra el navegador para M2 - Cuotas.
 * Usa el protocolo de depuración de Chrome (sin dependencias adicionales).
 *
 * Objetivo: verificar que con una cookie de sesión válida, al hacer clic
 * en "Cuotas" del sidebar, la app muestra la página de Cuotas con períodos
 * y deuda.
 *
 * Uso: node e2e-cuotas-check.mjs <sessionToken> <chromePath>
 */
const [, , token, chromePath] = process.argv;

if (!token || !chromePath) {
  console.error('Uso: node e2e-cuotas-check.mjs <sessionToken> <chromePath>');
  process.exit(1);
}

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9334;
const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-cuotas-'));

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

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });

  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);

  // Inyectar cookie de sesión de Better Auth
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

  // Navegar a la página principal
  await send('Page.navigate', { url: 'http://localhost:5173/' }, sessionId);
  await sleep(5000);

  // Hacer clic en el elemento del sidebar que contiene el texto "Cuotas"
  // Usar dispatchEvent para simular un clic real de mouse
  const clickResult = await send(
    'Runtime.evaluate',
    {
      expression: `
        const btns = Array.from(document.querySelectorAll('button, a'));
        const cuotasBtn = btns.find(b => b.textContent && b.textContent.trim() === 'Cuotas');
        if (cuotasBtn) {
          // Simular clic completo de mouse
          cuotasBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
          cuotasBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
          cuotasBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          cuotasBtn.click();
          'CLICK_OK';
        } else {
          const btnTexts = btns.map(b => b.textContent?.trim()).filter(t => t);
          'BUTTON_NOT_FOUND: ' + JSON.stringify(btnTexts);
        }
      `,
      returnByValue: true,
    },
    sessionId,
  );
  await sleep(5000);

  const { result } = await send(
    'Runtime.evaluate',
    { expression: 'document.body.innerText', returnByValue: true },
    sessionId,
  );

  const text = result?.value ?? '';
  const checks = {
    cuotas_visible: text.includes('Cuotas') && text.includes('Nuevo período'),
    mes_input: text.includes('Mes (AAAA-MM)'),
    crear_btn: text.includes('Crear período'),
    periodo_2026_11: text.includes('2026-11'),
    periodo_2026_12: text.includes('2026-12'),
    no_login: !text.includes('Acceso para la directiva'),
  };

  console.log(JSON.stringify({ checks, extracto: text.slice(0, 600) }, null, 2));

  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'E2E_CUOTAS_OK' : 'E2E_CUOTAS_FAIL');
  ws.close();
  chrome.kill();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error('Error E2E:', err.message);
  chrome.kill();
  process.exit(1);
}
