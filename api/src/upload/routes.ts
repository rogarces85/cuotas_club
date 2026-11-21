import { Hono } from 'hono';
import { requireSession } from '../middleware/auth.js';
import { createHash } from 'node:crypto';
import { writeFile, mkdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { existsSync } from 'node:fs';

/**
 * Rutas de subida de archivos.
 *
 * POST /api/upload/comprobante — sube un comprobante de pago
 *   Recibe multipart/form-data con campo "archivo"
 *   Devuelve { ruta, nombreArchivo, mime, bytes, sha256 }
 *
 * Validaciones:
 * - MIME permitido: application/pdf, image/png, image/jpeg
 * - Tamaño máximo: 5 MB
 * - SHA256 calculado en servidor
 * - Almacenado en api/uploads/comprobantes/<sha256><ext>
 */

const MIME_PERMITIDOS = new Set(['application/pdf', 'image/png', 'image/jpeg']);
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'comprobantes');

export const upload = new Hono();

upload.use('*', requireSession);

// POST /api/upload/comprobante
upload.post('/comprobante', async (c) => {
  const formData = await c.req.formData();
  const file = formData.get('archivo');

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'No se recibió archivo (campo "archivo")' }, 400);
  }

  const mime = file.type;
  if (!MIME_PERMITIDOS.has(mime)) {
    return c.json(
      { error: `Tipo de archivo no permitido: ${mime}. Permitidos: PDF, PNG, JPEG` },
      400,
    );
  }

  const bytes = file.size;
  if (bytes > MAX_BYTES) {
    return c.json({ error: `Archivo muy grande: ${bytes} bytes (máx ${MAX_BYTES})` }, 400);
  }

  // Leer contenido y calcular SHA256
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Determinar extensión desde MIME
  const ext = mime === 'application/pdf' ? '.pdf' : mime === 'image/png' ? '.png' : '.jpg';
  const nombreArchivo = `${sha256}${ext}`;
  const rutaRelativa = join('comprobantes', nombreArchivo);
  const rutaAbsoluta = join(UPLOAD_DIR, nombreArchivo);

  // Crear directorio si no existe
  if (!existsSync(UPLOAD_DIR)) {
    await mkdir(UPLOAD_DIR, { recursive: true });
  }

  // Verificar si ya existe (deduplicación por hash)
  if (!existsSync(rutaAbsoluta)) {
    await writeFile(rutaAbsoluta, buffer);
  }

  return c.json({
    ruta: rutaRelativa,
    nombreArchivo: file.name,
    mime,
    bytes,
    sha256,
  });
});

// GET /api/upload/comprobante/:sha256 — servir archivo privado (para visor)
upload.get('/comprobante/:sha256', async (c) => {
  const sha256 = c.req.param('sha256');
  if (!/^[a-f0-9]{64}$/.test(sha256)) {
    return c.json({ error: 'Hash inválido' }, 400);
  }

  // Buscar archivo con cualquier extensión permitida
  let rutaAbsoluta = '';
  let mime = '';

  for (const ext of ['.pdf', '.png', '.jpg']) {
    const prueba = join(UPLOAD_DIR, `${sha256}${ext}`);
    if (existsSync(prueba)) {
      rutaAbsoluta = prueba;
      mime = ext === '.pdf' ? 'application/pdf' : ext === '.png' ? 'image/png' : 'image/jpeg';
      break;
    }
  }

  if (!rutaAbsoluta) {
    return c.json({ error: 'Archivo no encontrado' }, 404);
  }

  // Leer y servir
  const file = await import('node:fs/promises').then((fs) => fs.readFile(rutaAbsoluta));
  return new Response(file, {
    headers: {
      'Content-Type': mime,
      'Content-Length': String(file.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
});