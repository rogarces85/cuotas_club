import { describe, it, expect } from 'vitest';
import app from '../app.js';

/**
 * Cumpleaños: las tres rutas exigen sesión. No hace falta base de datos
 * porque `requireSession` corta antes de cualquier consulta.
 */

describe('cumpleanos: control de sesión', () => {
  it('GET /api/cumpleanos sin sesión → 401', async () => {
    const res = await app.request('/api/cumpleanos');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No autenticado');
  });

  it('GET /api/cumpleanos/1/preview sin sesión → 401', async () => {
    const res = await app.request('/api/cumpleanos/1/preview');
    expect(res.status).toBe(401);
  });

  it('POST /api/cumpleanos/1/enviar sin sesión → 401', async () => {
    const res = await app.request('/api/cumpleanos/1/enviar', { method: 'POST' });
    expect(res.status).toBe(401);
  });
});
