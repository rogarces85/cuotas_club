/**
 * Smoke test de la UI de Cuotas (M2), con el mismo patrón CDP que el de socios.
 * Inyecta la cookie, navega, hace clic en "Cuotas" y comprueba que la página
 * (formulario de período + lista) se renderiza.
 *
 * Uso: node api/scripts/e2e-cuotas-ui.mjs <sessionToken> <chromePath>
 */
const [, , token, chromePath] = process.argv;

if (!token || !chromePath) {
  console.error('Uso: node e2e-cuotas-ui.mjs <sessionToken> <chromePath>');
  process.exit(1);
}

import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const PORT = 9335;
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
      /* arrancando */
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
    ws.addEventListener('error', () => rej(new Error('falló el WebSocket')), { once: true });
  });
  const send = makeClient(ws);

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Network.enable', {}, sessionId);
  await send('Page.enable', {}, sessionId);

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
  await sleep(4500);

  // Clic en "Cuotas" (el botón de la sidebar, cuyo texto incluye el bullet)
  const click = await send(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const btns = [...document.querySelectorAll('button')];
        const cuotas = btns.find(b => b.textContent.includes('Cuotas'));
        if (!cuotas) return 'NO_ENCONTRADO';
        cuotas.click();
        return 'CLIC_OK';
      })()`,
      returnByValue: true,
    },
    sessionId,
  );

  await sleep(1500);

  const { result } = await send(
    'Runtime.evaluate',
    { expression: 'document.body.innerText', returnByValue: true },
    sessionId,
  );

  const text = result?.value ?? '';
  const checks = {
    clic_cuotas: click.result.value === 'CLIC_OK',
    titulo_cuotas: text.includes('Períodos de cobro'),
    formulario: text.includes('Nuevo período') && text.includes('Vence el día'),
    lista_o_vacio: text.includes('No hay períodos') || /Vence el \d+/.test(text),
  };

  console.log(
    JSON.stringify({ checks, clic: click.result.value, extracto: text.slice(0, 400) }, null, 2),
  );
  const ok = Object.values(checks).every(Boolean);
  console.log(ok ? 'E2E_CUOTAS_UI_OK' : 'E2E_CUOTAS_UI_FALLO');
  ws.close();
  chrome.kill();
  process.exit(ok ? 0 : 1);
} catch (err) {
  console.error('Error E2E cuotas:', err.message);
  chrome.kill();
  process.exit(1);
}
