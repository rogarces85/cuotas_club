/**
 * E2E de la página Reportes: pestañas Socios/Balance, filtros, gráficas,
 * descarga CSV y regreso al formulario de balance.
 *
 * Uso: node web/scripts/e2e-reportes.mjs
 * Requiere API y web corriendo y Chrome instalado.
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'Osorno2026!';
const CHROME =
  process.env.CHROME_PATH ??
  join(process.env.LOCALAPPDATA ?? '', 'Google', 'Chrome', 'Application', 'chrome.exe');
const PORT = 9342;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const userDataDir = mkdtempSync(join(tmpdir(), 'cdp-reportes-'));
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${PORT}`, `--user-data-dir=${userDataDir}`, 'about:blank',
], { stdio: 'ignore' });

async function wsUrl() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await r.json();
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl;
    } catch {}
    await sleep(250);
  }
  throw new Error('Chrome no expuso CDP');
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
        if (pending.has(msgId)) { pending.delete(msgId); reject(new Error(`timeout ${method}`)); }
      }, 25000);
    });
}

let passed = 0;
let failed = 0;
function check(nombre, ok, extra = '') {
  if (ok) { passed++; console.log('  ✅', nombre); }
  else { failed++; console.error('  ❌', nombre, extra); }
}

async function main() {
  console.log('E2E Reportes UI\n');
  const login = await fetch(`${BASE}/api/auth/sign-in/email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: BASE },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const cookie = (login.headers.getSetCookie?.() ?? [])
    .map((c) => c.split(';')[0])
    .find((c) => c.startsWith('better-auth.session_token='));
  const token = cookie.split('=')[1];

  const ws = new WebSocket(await wsUrl());
  await new Promise((res, rej) => {
    ws.addEventListener('open', res, { once: true });
    ws.addEventListener('error', () => rej(new Error('ws fail')), { once: true });
  });
  const send = makeClient(ws);
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false }, sessionId);
  const downloadDir = join(tmpdir(), 'reportes-downloads');
  rmSync(downloadDir, { recursive: true, force: true });
  mkdirSync(downloadDir, { recursive: true });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir, eventsEnabled: true });
  await send('Network.setCookie', {
    name: 'better-auth.session_token', value: token, domain: 'localhost', path: '/', httpOnly: true, sameSite: 'Lax',
  }, sessionId);

  const evaluar = async (expresion) => {
    const { result, exceptionDetails } = await send('Runtime.evaluate', { expression: expresion, returnByValue: true, awaitPromise: true }, sessionId);
    if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? 'error en página');
    return result?.value;
  };

  await send('Page.navigate', { url: `${BASE}/` }, sessionId);
  await sleep(4000);
  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').includes('Reportes'));
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(2200);

  let texto = await evaluar('document.body.innerText');
  check('abre Reportes con pestañas', texto.includes('Socios y pagos') && texto.includes('Balance'));
  check('métricas del reporte visibles', /Total socios/i.test(texto) && /Recaudación/i.test(texto) && /Socios pagadores/i.test(texto) && /Edad promedio/i.test(texto));
  check('gráficas y descarga visibles', /Socios por sexo/i.test(texto) && /Altas por mes/i.test(texto) && /Recaudación por mes/i.test(texto) && /Descargar pagos/i.test(texto));
  check('filtros disponibles', ['Activos', 'Inactivos', 'Hombres', 'Mujeres', 'Becado'].every((x) => texto.includes(x)));

  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Activos');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(1600);
  const activos = await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Activos');
    return { pressed: b?.getAttribute('aria-pressed'), texto: document.body.innerText };
  })()`);
  check('filtro Activos se marca y actualiza', activos.pressed === 'true', `→ ${activos.pressed}`);

  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Hombres');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(1600);
  const hombres = await evaluar(`(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Hombres')?.getAttribute('aria-pressed'))()`);
  check('filtro Hombres se combina', hombres === 'true', `→ ${hombres}`);

  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /Limpiar filtros/i.test(x.textContent || ''));
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(1400);
  const limpiado = await evaluar(`(() => [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Hombres')?.getAttribute('aria-pressed'))()`);
  check('limpiar filtros funciona', limpiado === 'false', `→ ${limpiado}`);

  await evaluar(`(() => {
    const select = document.querySelector('#reporte-periodo');
    if (!select) return false;
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
    setter.call(select, 'MES');
    select.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  })()`);
  await sleep(1600);
  texto = await evaluar('document.body.innerText');
  check('cambia a período Mes', texto.includes('Mes') && /a \d{4}-\d{2}-\d{2}/i.test(texto));

  const botonCsv = await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => /CSV/i.test(x.textContent || ''));
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(2200);
  const descargas = readdirSync(downloadDir);
  check(
    'el botón CSV descarga el archivo',
    Boolean(botonCsv) && descargas.some((archivo) => archivo.startsWith('pagos-') && archivo.endsWith('.csv')),
    `→ ${JSON.stringify(descargas)}`,
  );

  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Balance');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(900);
  texto = await evaluar('document.body.innerText');
  check('pestaña Balance muestra su formulario', texto.includes('Parámetros del reporte') && texto.includes('Generar reporte'));

  await send(
    'Emulation.setDeviceMetricsOverride',
    { width: 390, height: 900, deviceScaleFactor: 1, mobile: true },
    sessionId,
  );
  await sleep(500);
  await evaluar(`(() => {
    const b = [...document.querySelectorAll('button')].find(x => (x.textContent || '').trim() === 'Socios y pagos');
    b?.click();
    return Boolean(b);
  })()`);
  await sleep(1700);
  const anchoDocumento = await evaluar('document.documentElement.scrollWidth');
  check('390: el reporte no desborda horizontalmente', anchoDocumento <= 390, `→ ${anchoDocumento}`);

  const { data } = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
  const ruta = join(tmpdir(), 'reportes-ui.png');
  writeFileSync(ruta, Buffer.from(data, 'base64'));
  console.log('  📷', ruta);

  ws.close();
}

try {
  await main();
} catch (err) {
  failed++;
  console.error('Error:', err);
} finally {
  if (chrome.pid) {
    spawnSync('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
  } else {
    chrome.kill();
  }
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}
