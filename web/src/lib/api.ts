/**
 * Cliente HTTP para las rutas de negocio de la API.
 *
 * Todas las llamadas usan `credentials: 'include'` para que la cookie de
 * sesión de Better Auth viaje con el request (mismo origen, sin CORS).
 * Ante un 401 la sesión venció: el error se propaga con `status`.
 */

const BASE = '/api';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// ---------------------------------------------------------------------------
// Tipos de dominio (espejo de lo que devuelve la API; sin dependencia del
// esquema drizzle, que no compila para el navegador).
// ---------------------------------------------------------------------------

export type Socio = {
  id: number;
  rut: string;
  nombre: string;
  anio: number;
  sexo: string | null;
  estado: string;
  activo: number;
  email: string | null;
  telefono: string | null;
  createdAt: number;
  updatedAt: number;
};

export type SocioInput = {
  rut: string;
  nombre: string;
  anio: number;
  sexo?: string;
  estado?: string;
  email?: string;
  telefono?: string;
};

export type ListaSocios = {
  total: number;
  pagina: number;
  porPagina: number;
  filas: Socio[];
};

// ---------------------------------------------------------------------------
// Operaciones
// ---------------------------------------------------------------------------

export function listarSocios(params: {
  q?: string;
  estado?: string;
  activo?: boolean;
  pagina?: number;
  porPagina?: number;
}): Promise<ListaSocios> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.estado) qs.set('estado', params.estado);
  if (params.activo !== undefined) qs.set('activo', params.activo ? '1' : '0');
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));

  const query = qs.toString();
  return request<ListaSocios>(`/socios${query ? `?${query}` : ''}`);
}

export function crearSocio(input: SocioInput): Promise<Socio> {
  return request<Socio>('/socios', { method: 'POST', body: JSON.stringify(input) });
}

export function actualizarSocio(id: number, input: Partial<SocioInput>): Promise<Socio> {
  return request<Socio>(`/socios/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function desactivarSocio(id: number): Promise<Socio> {
  return request<Socio>(`/socios/${id}`, { method: 'DELETE' });
}
