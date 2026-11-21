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

// ---------------------------------------------------------------------------
// Cuotas (M2)
// ---------------------------------------------------------------------------

export type PeriodoCuota = {
  id: number;
  periodo: string;
  diaVencimiento: number;
  createdAt: number;
  totalDeudores?: number;
};

export type DeudaFila = {
  socioId: number;
  rut: string;
  nombre: string;
  tipo: string;
  montoClp: number;
};

export type Deuda = {
  periodo: string | null;
  total: number;
  filas: DeudaFila[];
};

export function listarPeriodos(): Promise<PeriodoCuota[]> {
  return request<PeriodoCuota[]>('/cuotas/periodos');
}

export function crearPeriodo(input: { periodo: string; diaVencimiento: number }): Promise<PeriodoCuota> {
  return request<PeriodoCuota>('/cuotas/periodos', { method: 'POST', body: JSON.stringify(input) });
}

export function obtenerDeuda(periodoId: number): Promise<Deuda> {
  return request<Deuda>(`/cuotas/periodos/${periodoId}/deuda`);
}

// ---------------------------------------------------------------------------
// Pagos (M3)
// ---------------------------------------------------------------------------

export type Comprobante = {
  id: number;
  pagoId: number;
  ruta: string;
  nombreArchivo: string;
  mime: string;
  bytes: number;
  sha256: string;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  createdAt: number;
};

export type Pago = {
  id: number;
  codigoPago: string | null;
  socioId: number;
  rut: string;
  nombreSnapshot: string;
  anio: number;
  sexo: string | null;
  estado: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  situacion: string | null;
  fechaPago: string;
  totalPago: number;
  valorCuota: number;
  tipoCuota: 'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO';
  mesesCantidad: number;
  mesesDetalle: string;
  observacion: string | null;
  origen: 'manual' | 'banco' | 'historico';
  createdAt: number;
  comprobantes?: Comprobante[];
};

export type ListaPagos = {
  total: number;
  pagina: number;
  porPagina: number;
  filas: Pago[];
};

export type Moroso = {
  socioId: number;
  rut: string;
  nombre: string;
  estado: string;
  totalDeuda: number;
  periodos: { periodo: string; diaVencimiento: number }[];
};

export type PagoInput = {
  socioId: number;
  rut: string;
  nombreSnapshot: string;
  anio: number;
  sexo?: string;
  estado?: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  situacion?: string;
  fechaPago: string;
  totalPago: number;
  valorCuota: number;
  tipoCuota: 'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO';
  mesesCantidad: number;
  mesesDetalle?: string;
  observacion?: string;
  origen?: 'manual' | 'banco' | 'historico';
};

export function listarPagos(params: {
  q?: string;
  estado?: 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';
  socioId?: number;
  pagina?: number;
  porPagina?: number;
}): Promise<ListaPagos> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.estado) qs.set('estado', params.estado);
  if (params.socioId !== undefined) qs.set('socioId', String(params.socioId));
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));
  const query = qs.toString();
  return request<ListaPagos>(`/pagos${query ? `?${query}` : ''}`);
}

export function crearPago(input: PagoInput): Promise<Pago> {
  return request<Pago>('/pagos', { method: 'POST', body: JSON.stringify(input) });
}

export function obtenerPago(id: number): Promise<Pago> {
  return request<Pago>(`/pagos/${id}`);
}

export function aprobarPago(id: number): Promise<Pago> {
  return request<Pago>(`/pagos/${id}/aprobar`, { method: 'PATCH' });
}

export function rechazarPago(id: number, motivo?: string): Promise<Pago> {
  return request<Pago>(`/pagos/${id}/rechazar`, {
    method: 'PATCH',
    body: JSON.stringify({ estado: 'RECHAZADO', motivo }),
  });
}

export function listarMorosos(): Promise<Moroso[]> {
  return request<Moroso[]>('/pagos/morosos');
}

// ---------------------------------------------------------------------------
// Comprobantes (M4)
// ---------------------------------------------------------------------------

export type ComprobanteUploadResult = {
  ruta: string;
  nombreArchivo: string;
  mime: string;
  bytes: number;
  sha256: string;
};

export type ComprobanteInput = {
  pagoId: number;
  nombreArchivo: string;
  mime: string;
  bytes: number;
  sha256: string;
};

export type ComprobanteEstado = 'PENDIENTE' | 'APROBADO' | 'RECHAZADO';

export async function subirComprobante(archivo: File): Promise<ComprobanteUploadResult> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${BASE}/upload/comprobante`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
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

  return (await res.json()) as ComprobanteUploadResult;
}

export function registrarComprobante(input: ComprobanteInput): Promise<Comprobante> {
  return request<Comprobante>(`/pagos/${input.pagoId}/comprobante`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function obtenerComprobantePago(pagoId: number): Promise<Comprobante> {
  return request<Comprobante>(`/pagos/${pagoId}/comprobante`);
}

export function actualizarComprobante(id: number, estado: ComprobanteEstado): Promise<Comprobante> {
  return request<Comprobante>(`/pagos/comprobantes/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ estado }),
  });
}

export function urlComprobante(sha256: string): string {
  return `${BASE}/upload/comprobante/${sha256}`;
}

// ---------------------------------------------------------------------------
// Bancos (M4)
// ---------------------------------------------------------------------------

export type CuentaBancaria = {
  id: number;
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rut: string;
  email: string | null;
  createdAt: number;
};

export type MovimientoBancario = {
  id: number;
  fecha: string;
  monto: number;
  descripcion: string;
  referencia: string | null;
  createdAt: number;
};

export type ConciliacionSugerencia = {
  movimiento: {
    id: number;
    fecha: string;
    monto: number;
    descripcion: string;
    referencia: string | null;
  };
  pago: {
    id: number;
    rut: string;
    nombre: string;
    total: number;
    fecha: string;
  };
  score: number;
  razones: string[];
};

export type ConciliacionResult = {
  sugerencias: ConciliacionSugerencia[];
};

export function listarCuentasBancarias(): Promise<CuentaBancaria[]> {
  return request<CuentaBancaria[]>('/bancos/cuentas');
}

export function crearCuentaBancaria(input: {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rut: string;
  email?: string;
}): Promise<CuentaBancaria> {
  return request<CuentaBancaria>('/bancos/cuentas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listarMovimientosBancarios(params: {
  pagina?: number;
  porPagina?: number;
}): Promise<{ total: number; pagina: number; porPagina: number; filas: MovimientoBancario[] }> {
  const qs = new URLSearchParams();
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));
  const query = qs.toString();
  return request(`/bancos/movimientos${query ? `?${query}` : ''}`);
}

export async function importarCartola(archivo: File): Promise<{
  importados: number;
  errores: string[];
  totalFilas: number;
}> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${BASE}/bancos/importar`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
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

  return (await res.json()) as { importados: number; errores: string[]; totalFilas: number };
}

export function conciliarMovimientos(): Promise<ConciliacionResult> {
  return request<ConciliacionResult>('/bancos/conciliar', { method: 'POST' });
}
