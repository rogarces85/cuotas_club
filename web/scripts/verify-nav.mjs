/**
 * Verifica el contrato de navegación del shell:
 *  - cada clave del sidebar ('key: ...') debe tener una vista renderizada
 *    ('activeItem === ...') o caer en el Panel por defecto;
 *  - cada clave debe existir en las vistas conocidas de App.tsx.
 *
 * Uso: node web/scripts/verify-nav.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const shellPath = join(here, '..', 'src', 'components', 'Shell.tsx');
const appPath = join(here, '..', 'src', 'App.tsx');

const shell = readFileSync(shellPath, 'utf8');
const app = readFileSync(appPath, 'utf8');

const uniq = (xs) => [...new Set(xs)];

const keys = uniq([...shell.matchAll(/key:\s*'([^']+)'/g)].map((m) => m[1]));
const rendered = uniq([...shell.matchAll(/activeItem === '([^']+)'/g)].map((m) => m[1]));

const viewsBlock = app.match(/const VIEWS[^=]*=\s*\[([\s\S]*?)\]/);
if (!viewsBlock) {
  console.error('No se encontró VIEWS en App.tsx');
  process.exit(1);
}
const views = uniq([...viewsBlock[1].matchAll(/'([^']+)'/g)].map((m) => m[1]));

const faltanEnApp = keys.filter((k) => !views.includes(k));
const sinRender = keys.filter((k) => k !== 'panel' && !rendered.includes(k));
const vistasHuerfanas = views.filter((v) => !keys.includes(v));

const rows = keys.map((k) => ({
  clave: k,
  enApp: views.includes(k) ? 'sí' : 'NO',
  render: k === 'panel' ? 'Panel (default)' : rendered.includes(k) ? 'sí' : 'NO',
}));

console.table(rows);

let ok = true;
if (faltanEnApp.length) {
  ok = false;
  console.error('Claves del sidebar ausentes en VIEWS:', faltanEnApp.join(', '));
}
if (sinRender.length) {
  ok = false;
  console.error('Claves del sidebar sin vista renderizada:', sinRender.join(', '));
}
if (vistasHuerfanas.length) {
  ok = false;
  console.error('Vistas de App sin ítem en el sidebar:', vistasHuerfanas.join(', '));
}

if (!ok) process.exit(1);
console.log('Navegación OK: todas las claves del sidebar abren una vista.');
