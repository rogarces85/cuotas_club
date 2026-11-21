import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import {
  actualizarConfigClubSchema,
  crearUsuarioRolSchema,
  actualizarUsuarioRolSchema,
  subirLogoSchema,
} from '@cuotas-club/shared';
import { requireSession } from '../middleware/auth.js';
import { ErrorImportacion, importarDesdeFormData } from '../socios/import.js';
import { createHash } from 'node:crypto';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

const {
  configClub,
  logoClub,
  usuarioRol,
} = clubSchema;

const nowSec = () => Math.floor(Date.now() / 1000);

const MIME_PERMITIDOS_LOGO = new Set(['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']);
const MAX_BYTES_LOGO = 2 * 1024 * 1024; // 2 MB
const UPLOAD_DIR_LOGOS = join(process.cwd(), 'uploads', 'logos');

// Claves de configuración permitidas
const CLAVES_CONFIG = [
  'nombre_club',
  'logo_url',
  'direccion',
  'telefono',
  'email',
  'email_tesoreria',
  'meta_mensual',
] as const;

type ClaveConfig = typeof CLAVES_CONFIG[number];

/**
 * Rutas de configuración (M5).
 *
 * GET    /api/config                    — obtener toda la configuración
 * PATCH  /api/config                    — actualizar configuración (clave-valor)
 * GET    /api/config/logo               — obtener logo activo
 * POST   /api/config/logo               — subir logo (multipart)
 * GET    /api/config/usuarios           — listar usuarios con roles
 * POST   /api/config/usuarios           — asignar rol a usuario
 * PATCH  /api/config/usuarios/:userId   — actualizar rol de usuario
 * DELETE /api/config/usuarios/:userId   — quitar rol a usuario
 */

export const config = new Hono();

config.use('*', requireSession);

// ==================== CONFIGURACIÓN GENERAL ====================

config.get('/', async (c) => {
  const configs = await db
    .select()
    .from(configClub)
    .orderBy(configClub.clave);

  // Convertir a objeto clave-valor
  const resultado: Record<string, string | null> = {};
  for (const clave of CLAVES_CONFIG) {
    resultado[clave] = null;
  }
  for (const cfg of configs) {
    if (CLAVES_CONFIG.includes(cfg.clave as ClaveConfig)) {
      resultado[cfg.clave] = cfg.valor;
    }
  }

  return c.json(resultado);
});

config.patch('/', zValidator('json', actualizarConfigClubSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  for (const [clave, valor] of Object.entries(input)) {
    if (!CLAVES_CONFIG.includes(clave as ClaveConfig)) continue;

    // Convertir a string (meta_mensual viene como number)
    const valorStr = valor === null || valor === undefined ? null : String(valor);

    const [existente] = await db
      .select()
      .from(configClub)
      .where(eq(configClub.clave, clave))
      .limit(1);

    if (existente) {
      await db
        .update(configClub)
        .set({ valor: valorStr, updatedAt: ts })
        .where(eq(configClub.clave, clave));
    } else {
      await db.insert(configClub).values({
        clave,
        valor: valorStr,
        createdAt: ts,
        updatedAt: ts,
      });
    }
  }

  // Devolver configuración actualizada
  const configs = await db
    .select()
    .from(configClub)
    .orderBy(configClub.clave);

  const resultado: Record<string, string | null> = {};
  for (const clave of CLAVES_CONFIG) {
    resultado[clave] = null;
  }
  for (const cfg of configs) {
    if (CLAVES_CONFIG.includes(cfg.clave as ClaveConfig)) {
      resultado[cfg.clave] = cfg.valor;
    }
  }

  return c.json(resultado);
});

// ==================== LOGO DEL CLUB ====================

config.get('/logo', async (c) => {
  const [logo] = await db
    .select()
    .from(logoClub)
    .where(eq(logoClub.activo, 1))
    .orderBy(desc(logoClub.createdAt))
    .limit(1);

  if (!logo) return c.json({ logo: null });

  return c.json({
    logo: {
      id: logo.id,
      ruta: logo.ruta,
      mime: logo.mime,
      bytes: logo.bytes,
      sha256: logo.sha256,
      url: `/api/upload/logo/${logo.sha256}`,
    },
  });
});

config.post('/logo', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('archivo');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No se recibió archivo (campo "archivo")' }, 400);
  }

  const mime = file.type;
  if (!MIME_PERMITIDOS_LOGO.has(mime)) {
    return c.json(
      { error: `Tipo de archivo no permitido: ${mime}. Permitidos: PNG, JPEG, SVG, WebP` },
      400,
    );
  }

  const bytes = file.size;
  if (bytes > MAX_BYTES_LOGO) {
    return c.json({ error: `Archivo muy grande: ${bytes} bytes (máx ${MAX_BYTES_LOGO})` }, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Determinar extensión desde MIME
  let ext = '.png';
  if (mime === 'image/jpeg') ext = '.jpg';
  else if (mime === 'image/svg+xml') ext = '.svg';
  else if (mime === 'image/webp') ext = '.webp';

  const nombreArchivo = `${sha256}${ext}`;
  const rutaRelativa = join('logos', nombreArchivo);
  const rutaAbsoluta = join(UPLOAD_DIR_LOGOS, nombreArchivo);

  if (!existsSync(UPLOAD_DIR_LOGOS)) {
    await mkdir(UPLOAD_DIR_LOGOS, { recursive: true });
  }

  // Desactivar logo anterior
  await db
    .update(logoClub)
    .set({ activo: 0 })
    .where(eq(logoClub.activo, 1));

  // Guardar nuevo archivo (deduplicación por hash)
  if (!existsSync(rutaAbsoluta)) {
    await writeFile(rutaAbsoluta, buffer);
  }

  // Insertar nuevo logo
  const ts = nowSec();
  const [result] = await db
    .insert(logoClub)
    .values({
      ruta: rutaRelativa,
      mime,
      bytes,
      sha256,
      activo: 1,
      createdAt: ts,
    });

  const [logo] = await db
    .select()
    .from(logoClub)
    .where(eq(logoClub.id, Number(result.insertId)))
    .limit(1);

  return c.json({
    logo: {
      id: logo!.id,
      ruta: logo!.ruta,
      mime: logo!.mime,
      bytes: logo!.bytes,
      sha256: logo!.sha256,
      url: `/api/upload/logo/${logo!.sha256}`,
    },
  }, 201);
});

// ==================== USUARIOS Y ROLES ====================

config.get('/usuarios', async (c) => {
  const usuarios = await db
    .select({
      userId: usuarioRol.userId,
      rol: usuarioRol.rol,
      createdAt: usuarioRol.createdAt,
    })
    .from(usuarioRol)
    .orderBy(desc(usuarioRol.createdAt));

  return c.json(usuarios);
});

config.post('/usuarios', zValidator('json', crearUsuarioRolSchema), async (c) => {
  const input = c.req.valid('json');
  const ts = nowSec();

  // Verificar si ya tiene rol
  const [existente] = await db
    .select()
    .from(usuarioRol)
    .where(eq(usuarioRol.userId, input.userId))
    .limit(1);

  if (existente) {
    return c.json({ error: 'El usuario ya tiene un rol asignado' }, 409);
  }

  const [result] = await db
    .insert(usuarioRol)
    .values({ ...input, createdAt: ts });

  const [ur] = await db
    .select()
    .from(usuarioRol)
    .where(eq(usuarioRol.id, Number(result.insertId)))
    .limit(1);

  return c.json(ur, 201);
});

config.patch('/usuarios/:userId', zValidator('json', actualizarUsuarioRolSchema), async (c) => {
  const userId = c.req.param('userId');
  const input = c.req.valid('json');

  const [existente] = await db
    .select()
    .from(usuarioRol)
    .where(eq(usuarioRol.userId, userId))
    .limit(1);

  if (!existente) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  await db
    .update(usuarioRol)
    .set(input)
    .where(eq(usuarioRol.userId, userId));

  const [ur] = await db
    .select()
    .from(usuarioRol)
    .where(eq(usuarioRol.userId, userId))
    .limit(1);

  return c.json(ur);
});

config.delete('/usuarios/:userId', async (c) => {
  const userId = c.req.param('userId');

  const [existente] = await db
    .select()
    .from(usuarioRol)
    .where(eq(usuarioRol.userId, userId))
    .limit(1);

  if (!existente) {
    return c.json({ error: 'Usuario no encontrado' }, 404);
  }

  await db.delete(usuarioRol).where(eq(usuarioRol.userId, userId));
  return c.json({ ok: true });
});

// ==================== SERVIR LOGO ====================

config.get('/logo/:sha256', async (c) => {
  const sha256 = c.req.param('sha256');
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return c.json({ error: 'Hash inválido' }, 400);
  }

  let rutaAbsoluta = '';
  let mime = '';

  for (const ext of ['.png', '.jpg', '.svg', '.webp']) {
    const prueba = join(UPLOAD_DIR_LOGOS, `${sha256}${ext}`);
    if (existsSync(prueba)) {
      rutaAbsoluta = prueba;
      if (ext === '.svg') mime = 'image/svg+xml';
      else if (ext === '.webp') mime = 'image/webp';
      else if (ext === '.png') mime = 'image/png';
      else mime = 'image/jpeg';
      break;
    }
  }

  if (!rutaAbsoluta) {
    return c.json({ error: 'Archivo no encontrado' }, 404);
  }

  const file = await import('node:fs/promises').then((fs) => fs.readFile(rutaAbsoluta));
  return new Response(file, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(file.length),
      'Cache-Control': 'public, max-age=86400',
    },
  });
});

// ==================== IMPORTACIÓN SOCIOS ====================

/**
 * Alias de compatibilidad: la importación masiva vive en el módulo Socios
 * (POST /api/socios/importar). Se mantiene esta ruta porque Configuración ya
 * ofrecía el acceso y puede haber enlaces guardados.
 */
config.post('/importar/socios', async (c) => {
  let formData: FormData;
  try {
    formData = await c.req.formData();
  } catch {
    return c.json({ error: 'Se esperaba un formulario multipart con el campo "archivo"' }, 400);
  }

  try {
    const resultado = await importarDesdeFormData(formData);
    return c.json(resultado);
  } catch (err) {
    if (err instanceof ErrorImportacion) {
      return c.json(
        { error: err.message, detalleErrores: err.detalle },
        err.detalle.length > 0 ? 422 : 400,
      );
    }
    console.error('[config] importación fallida:', err);
    return c.json({ error: 'No se pudo procesar la importación' }, 500);
  }
});
