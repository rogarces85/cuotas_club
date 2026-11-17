import { describe, it, expect } from 'vitest';
import app from '../app.js';

/**
 * AC1 — las rutas de cuotas rechazan sin sesión (401).
 * Sin cookie, requireSession corta antes de tocar la base.
 */

describe('cuotas: control de sesión (AC1)', () => {
  it('GET /api/cuotas/periodos sin sesión → 401', async () => {
    const res = await app.request('/api/cuotas/periodos');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe('No autenticado');
  });

  it('POST /api/cuotas/periodos sin sesión → 401', async () => {
    const res = await app.request('/api/cuotas/periodos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodo: '2026-11', diaVencimiento: 10 }),
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/cuotas/periodos/1/deuda sin sesión → 401', async () => {
    const res = await app.request('/api/cuotas/periodos/1/deuda');
    expect(res.status).toBe(401);
  });
});
