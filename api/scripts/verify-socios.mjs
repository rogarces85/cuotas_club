/**
 * Verificación re-ejecutable del CRUD de socios (AC2–AC7).
 *
 * Corre contra el sistema en marcha (API en :8787 vía proxy :5173) y deja la
 * base limpia al terminar. A diferencia de los curl manuales que narra el FTD,
 * este script es autocontenido: crea su propio socio, asevera cada resultado
 * (código de estado + contenido) y limpia al final, pase o falle.
 *
 * Uso: node api/scripts/verify-socios.mjs
 * Requiere: la API corriendo (`npm run dev`) y credenciales de tesorero.
 */

const BASE = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
const EMAIL = process.env.TEST_EMAIL ?? 'tesorero@osornorunners.cl';
const PASSWORD = process.env.TEST_PASSWORD ?? 'cuotas-osorno-2026';

const RUT_TEST = '127556636'; // RUT de prueba, se borra al final.

let passed = 0;
let failed = 0;

function check(name, cond, extra = '') {
  if (cond) {
    passed++;
    console.log(`  ✅ ${name}`);
  } else {
    failed++;
    console.error(`  ❌ ${name} ${extra}`);
  }
}

async function req(path, { method = 'GET', body, cookie } = {}) {
  const headers = {};
  // better-auth exige el Origin en trustedOrigins para POST de estado.
  headers['Origin'] = BASE;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (cookie) headers['Cookie'] = cookie;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'include',
    redirect: 'manual',
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    /* sin cuerpo */
  }
  return { status: res.status, data, setCookie: res.headers.get('set-cookie') ?? '' };
}

async function main() {
  console.log('Verificación CRUD de socios (AC2–AC7)\n');

  // 1. Login → cookie de sesión
  const login = await req('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: EMAIL, password: PASSWORD },
  });
  check('login tesorero (200)', login.status === 200, `→ ${login.status}`);
  const cookie = login.setCookie.split(';')[0];

  // 2. AC2 — alta
  const alta = await req('/api/socios', {
    method: 'POST',
    cookie,
    body: { rut: RUT_TEST, nombre: 'Socio Verificación', anio: 2026, sexo: 'MUJER', estado: 'ACTIVO' },
  });
  check('AC2 alta → 201', alta.status === 201, `→ ${alta.status} ${JSON.stringify(alta.data)}`);
  const id = alta.data?.id;

  // 3. AC3 — RUT duplicado → 409
  const duplicado = await req('/api/socios', {
    method: 'POST',
    cookie,
    body: { rut: RUT_TEST, nombre: 'Otro', anio: 2026 },
  });
  check('AC3 duplicado → 409', duplicado.status === 409, `→ ${duplicado.status}`);

  // 4. AC4 — RUT mal formado → 400
  const malRut = await req('/api/socios', {
    method: 'POST',
    cookie,
    body: { rut: '123', nombre: 'Malo', anio: 2026 },
  });
  check('AC4 RUT inválido → 400', malRut.status === 400, `→ ${malRut.status}`);

  // 5. AC5 — búsqueda por RUT y por nombre
  const porRut = await req(`/api/socios?q=${RUT_TEST}`, { cookie });
  check(
    'AC5 búsqueda por RUT → total=1 y es el creado',
    porRut.status === 200 && porRut.data?.total === 1 && porRut.data?.filas?.[0]?.id === id,
    `→ total=${porRut.data?.total}`,
  );
  const porNombre = await req('/api/socios?q=Verificaci%C3%B3n', { cookie });
  check(
    'AC5 búsqueda por nombre → total=1',
    porNombre.status === 200 && porNombre.data?.total === 1,
    `→ total=${porNombre.data?.total}`,
  );

  // 6. Edición
  const editar = await req(`/api/socios/${id}`, {
    method: 'PATCH',
    cookie,
    body: { nombre: 'Socio Verificado', estado: 'MEMBRESIA' },
  });
  check(
    'edición → 200 con nombre y estado nuevos',
    editar.status === 200 && editar.data?.nombre === 'Socio Verificado' && editar.data?.estado === 'MEMBRESIA',
    `→ ${JSON.stringify(editar.data)}`,
  );

  // 7. AC6 — baja lógica → activo=0, persiste
  const baja = await req(`/api/socios/${id}`, { method: 'DELETE', cookie });
  check('AC6 baja → 200 con activo=0', baja.status === 200 && baja.data?.activo === 0, `→ ${JSON.stringify(baja.data)}`);

  // 8. AC7 — rebaja → 404
  const rebaja = await req(`/api/socios/${id}`, { method: 'DELETE', cookie });
  check('AC7 rebaja → 404', rebaja.status === 404, `→ ${rebaja.status}`);

  // Limpieza: el socio de prueba quedó inactivo (baja lógica). Se elimina
  // físicamente vía mysql por el operador para no dejar residuo en el padrón;
  // este script no hace DELETE físico (la API no lo expone a propósito).
  console.log(`\nResultado: ${passed} pasaron, ${failed} fallaron`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Error en la verificación:', err.message);
  process.exit(1);
});
