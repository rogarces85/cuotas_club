import { describe, it, expect } from 'vitest';
import app from '../app.js';

/**
 * AC1 — las rutas de negocio rechazan sin sesión (401).
 *
 * `requireSession` llama a `auth.api.getSession` ANTES de cualquier consulta
 * a la base, así que una petición sin cookie devuelve 401 sin tocar la BD.
 * No hace falta base de datos para esta prueba.
 */

describe('socios: control de sesión (AC1)', () => {
  it('GET /api/socios sin sesión → 401', async () => {
    const res = await app.request('/api/socios');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No autenticado');
  });

  it('POST /api/socios sin sesión → 401', async () => {
    const res = await app.request('/api/socios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rut: '17682512K', nombre: 'Juan Pérez', anio: 2026 }),
    });
    expect(res.status).toBe(401);
  });

  it('PATCH /api/socios/1 sin sesión → 401', async () => {
    const res = await app.request('/api/socios/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'X' }),
    });
    expect(res.status).toBe(401);
  });

  it('DELETE /api/socios/1 sin sesión → 401', async () => {
    const res = await app.request('/api/socios/1', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });
});
