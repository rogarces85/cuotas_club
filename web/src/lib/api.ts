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
  detalle: string[];

  constructor(status: number, message: string, detalle: string[] = []) {
    super(message);
    this.status = status;
    this.detalle = detalle;
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
    let detalle: string[] = [];
    try {
      const body = (await res.json()) as { error?: string; detalleErrores?: string[] };
      if (body.error) message = body.error;
      if (Array.isArray(body.detalleErrores)) detalle = body.detalleErrores;
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, message, detalle);
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
  fechaNacimiento: string | null;
  fechaIngreso: string | null;
  direccion: string | null;
  estado: string;
  tipoCuota: string;
  montoCuota: number;
  fechaCambioEstado: string | null;
  fechaCambioTipoCuota: string | null;
  motivoCambioTipoCuota: string | null;
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
  fechaNacimiento?: string;
  fechaIngreso?: string;
  direccion?: string;
  estado?: string;
  tipoCuota?: string;
  montoCuota?: number;
  motivoCambioTipoCuota?: string;
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

export function reactivarSocio(id: number): Promise<Socio> {
  return request<Socio>(`/socios/${id}/reactivar`, { method: 'POST' });
}

export async function obtenerCandidatosBecado(): Promise<Socio[]> {
  return request<Socio[]>(`/socios/candidatos-becado`);
}

export async function aprobarBecado(socioId: number): Promise<Socio> {
  return request<Socio>(`/socios/${socioId}/becado/aprobar`, { method: 'POST' });
}

export async function rechazarBecado(socioId: number): Promise<Socio> {
  return request<Socio>(`/socios/${socioId}/becado/rechazar`, { method: 'POST' });
}

// ---------------------------------------------------------------------------
// Direcciones (validación con Google Maps / OpenStreetMap)
// ---------------------------------------------------------------------------

export type SugerenciaDireccion = {
  direccion: string;
  detalle: string;
  lat: number | null;
  lng: number | null;
  precision: string | null;
};

export type RespuestaDirecciones = {
  proveedor: 'google' | 'nominatim';
  resultados: SugerenciaDireccion[];
};

export function buscarDirecciones(q: string, limit = 5): Promise<RespuestaDirecciones> {
  const qs = new URLSearchParams({ q, limit: String(limit) });
  return request<RespuestaDirecciones>(`/geocoding/buscar?${qs.toString()}`);
}

// ---------------------------------------------------------------------------
// Importación masiva de socios (Excel / CSV)
// ---------------------------------------------------------------------------

export type ResultadoImportacionSocios = {
  simulado: boolean;
  totalFilas: number;
  validos: number;
  insertados: number;
  actualizados: number;
  saltados: number;
  errores: number;
  detalleErrores: string[];
};

export async function descargarPlantillaSocios(): Promise<Blob> {
  const res = await fetch(`${BASE}/socios/plantilla`, { credentials: 'include' });

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

  return res.blob();
}

export async function importarSocios(
  archivo: File,
  force = false,
  dryRun = false,
): Promise<ResultadoImportacionSocios> {
  const formData = new FormData();
  formData.append('archivo', archivo);
  formData.append('force', String(force));
  formData.append('dryRun', String(dryRun));

  const res = await fetch(`${BASE}/socios/importar`, {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    let message = `Error ${res.status}`;
    let detalle: string[] = [];
    try {
      const body = (await res.json()) as { error?: string; detalleErrores?: string[] };
      if (body.error) message = body.error;
      if (Array.isArray(body.detalleErrores)) detalle = body.detalleErrores;
    } catch {
      // sin cuerpo JSON
    }
    throw new ApiError(res.status, message, detalle);
  }

  return (await res.json()) as ResultadoImportacionSocios;
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
// Niveles de cuota (cuánto paga cada tipo)
// ---------------------------------------------------------------------------

export type NivelCuota = {
  id: number;
  codigo: string;
  nombre: string;
  montoClp: number;
  tipo: 'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO';
  activo: number;
};

export type NivelCuotaInput = {
  codigo: string;
  nombre: string;
  montoClp: number;
  tipo: 'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO';
};

export function listarNivelesCuota(): Promise<NivelCuota[]> {
  return request<NivelCuota[]>('/cuotas/niveles');
}

export function crearNivelCuota(input: NivelCuotaInput): Promise<NivelCuota> {
  return request<NivelCuota>('/cuotas/niveles', { method: 'POST', body: JSON.stringify(input) });
}

export function actualizarNivelCuota(
  id: number,
  input: Partial<NivelCuotaInput> & { activo?: boolean },
): Promise<NivelCuota> {
  return request<NivelCuota>(`/cuotas/niveles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function eliminarNivelCuota(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/cuotas/niveles/${id}`, { method: 'DELETE' });
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

export type CuentaBancariaInput = {
  banco: string;
  tipo: string;
  numero: string;
  titular: string;
  rut: string;
  email?: string;
};

export function crearCuentaBancaria(input: CuentaBancariaInput): Promise<CuentaBancaria> {
  return request<CuentaBancaria>('/bancos/cuentas', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function actualizarCuentaBancaria(
  id: number,
  input: Partial<CuentaBancariaInput>,
): Promise<CuentaBancaria> {
  return request<CuentaBancaria>(`/bancos/cuentas/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function eliminarCuentaBancaria(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/bancos/cuentas/${id}`, { method: 'DELETE' });
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

// ---------------------------------------------------------------------------
// Gastos (M5)
// ---------------------------------------------------------------------------

export type CategoriaEgreso = {
  id: number;
  nombre: string;
  createdAt: number;
};

export type Egreso = {
  id: number;
  categoriaId: number | null;
  fecha: string;
  monto: number;
  descripcion: string;
  boletaRuta: string | null;
  createdAt: number;
  categoriaNombre: string | null;
};

export type GastoFijo = {
  id: number;
  descripcion: string;
  monto: number;
  periodicidad: string;
  activo: number;
  createdAt: number;
};

export type OtroIngreso = {
  id: number;
  fecha: string;
  monto: number;
  descripcion: string;
  origen: string | null;
  createdAt: number;
};

export function listarCategoriasEgreso(): Promise<CategoriaEgreso[]> {
  return request<CategoriaEgreso[]>('/gastos/categorias');
}

export function crearCategoriaEgreso(nombre: string): Promise<CategoriaEgreso> {
  return request<CategoriaEgreso>('/gastos/categorias', { method: 'POST', body: JSON.stringify({ nombre }) });
}

export function actualizarCategoriaEgreso(id: number, nombre: string): Promise<CategoriaEgreso> {
  return request<CategoriaEgreso>(`/gastos/categorias/${id}`, { method: 'PATCH', body: JSON.stringify({ nombre }) });
}

export function eliminarCategoriaEgreso(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/gastos/categorias/${id}`, { method: 'DELETE' });
}

export function listarEgresos(params: {
  q?: string;
  categoriaId?: number;
  desde?: string;
  hasta?: string;
  pagina?: number;
  porPagina?: number;
}): Promise<{ total: number; pagina: number; porPagina: number; filas: Egreso[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.categoriaId) qs.set('categoriaId', String(params.categoriaId));
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));
  const query = qs.toString();
  return request(`/gastos/egresos${query ? `?${query}` : ''}`);
}

export function crearEgreso(input: { categoriaId?: number; fecha: string; monto: number; descripcion: string }): Promise<Egreso> {
  return request<Egreso>('/gastos/egresos', { method: 'POST', body: JSON.stringify(input) });
}

export function obtenerEgreso(id: number): Promise<Egreso> {
  return request<Egreso>(`/gastos/egresos/${id}`);
}

export function actualizarEgreso(id: number, input: { categoriaId?: number; fecha?: string; monto?: number; descripcion?: string; boletaRuta?: string }): Promise<Egreso> {
  return request<Egreso>(`/gastos/egresos/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function eliminarEgreso(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/gastos/egresos/${id}`, { method: 'DELETE' });
}

export async function subirBoletaEgreso(egresoId: number, archivo: File): Promise<{ ruta: string; nombreArchivo: string; mime: string; bytes: number; sha256: string }> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${BASE}/gastos/egresos/${egresoId}/boleta`, {
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

  return (await res.json()) as { ruta: string; nombreArchivo: string; mime: string; bytes: number; sha256: string };
}

export function listarGastosFijos(params: { activo?: boolean; pagina?: number; porPagina?: number }): Promise<{ total: number; pagina: number; porPagina: number; filas: GastoFijo[] }> {
  const qs = new URLSearchParams();
  if (params.activo !== undefined) qs.set('activo', params.activo ? '1' : '0');
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));
  const query = qs.toString();
  return request(`/gastos/fijos${query ? `?${query}` : ''}`);
}

export function crearGastoFijo(input: { descripcion: string; monto: number; periodicidad: 'mensual' | 'trimestral' | 'semestral' | 'anual' }): Promise<GastoFijo> {
  return request<GastoFijo>('/gastos/fijos', { method: 'POST', body: JSON.stringify(input) });
}

export function actualizarGastoFijo(id: number, input: { descripcion?: string; monto?: number; periodicidad?: 'mensual' | 'trimestral' | 'semestral' | 'anual'; activo?: boolean }): Promise<GastoFijo> {
  return request<GastoFijo>(`/gastos/fijos/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function eliminarGastoFijo(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/gastos/fijos/${id}`, { method: 'DELETE' });
}

export function listarOtrosIngresos(params: { q?: string; desde?: string; hasta?: string; pagina?: number; porPagina?: number }): Promise<{ total: number; pagina: number; porPagina: number; filas: OtroIngreso[] }> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.porPagina) qs.set('porPagina', String(params.porPagina));
  const query = qs.toString();
  return request(`/gastos/ingresos${query ? `?${query}` : ''}`);
}

export function crearOtroIngreso(input: { fecha: string; monto: number; descripcion: string; origen?: string }): Promise<OtroIngreso> {
  return request<OtroIngreso>('/gastos/ingresos', { method: 'POST', body: JSON.stringify(input) });
}

export function actualizarOtroIngreso(id: number, input: { fecha?: string; monto?: number; descripcion?: string; origen?: string }): Promise<OtroIngreso> {
  return request<OtroIngreso>(`/gastos/ingresos/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function eliminarOtroIngreso(id: number): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/gastos/ingresos/${id}`, { method: 'DELETE' });
}

export function urlBoletaEgreso(sha256: string): string {
  return `${BASE}/gastos/boletas/${sha256}`;
}

// ---------------------------------------------------------------------------
// Reportes (M5)
// ---------------------------------------------------------------------------

export type BalanceResumen = {
  periodo: string;
  inicio: string;
  fin: string;
  ingresos: { pagosAprobados: number; otrosIngresos: number; total: number };
  egresos: { variables: number; fijosMensuales: number; total: number };
  saldo: number;
  detalle: {
    pagos: { id: number; fecha: string; monto: number; rut: string; nombre: string; tipo: string; meses: string }[];
    egresos: { id: number; fecha: string; monto: number; descripcion: string; categoria: string; tieneBoleta: boolean }[];
    otrosIngresos: { id: number; fecha: string; monto: number; descripcion: string; origen: string }[];
    gastosFijos: { id: number; descripcion: string; montoOriginal: number; montoMensual: number; periodicidad: string }[];
  };
};

export async function obtenerBalance(params: { periodo?: string; desde?: string; hasta?: string; formato?: 'json' | 'xlsx' | 'pdf' }): Promise<BalanceResumen | Blob> {
  const qs = new URLSearchParams();
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.desde) qs.set('desde', params.desde);
  if (params.hasta) qs.set('hasta', params.hasta);
  if (params.formato) qs.set('formato', params.formato);
  const query = qs.toString();

  const res = await fetch(`${BASE}/reportes/balance${query ? `?${query}` : ''}`, {
    credentials: 'include',
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

  if (params.formato === 'xlsx' || params.formato === 'pdf') {
    return res.blob();
  }

  return (await res.json()) as BalanceResumen;
}

export function descargarBalanceXLSX(params: { periodo?: string; desde?: string; hasta?: string }): Promise<Blob> {
  return obtenerBalance({ ...params, formato: 'xlsx' }) as Promise<Blob>;
}

export function descargarBalancePDF(params: { periodo?: string; desde?: string; hasta?: string }): Promise<Blob> {
  return obtenerBalance({ ...params, formato: 'pdf' }) as Promise<Blob>;
}

// ---------------------------------------------------------------------------
// Reporte de socios y descarga de pagos
// ---------------------------------------------------------------------------

export type ReporteSociosParams = {
  anio?: number;
  periodo?: 'ANIO' | 'TRIMESTRE' | 'MES';
  trimestre?: number;
  mes?: number;
  socios?: string[];
};

export type ReporteSocios = {
  generadoEn: string;
  periodo: {
    clave: string;
    etiqueta: string;
    inicio: string;
    fin: string;
    meses: string[];
  };
  filtros: {
    anio: number;
    periodo: 'ANIO' | 'TRIMESTRE' | 'MES';
    trimestre: number | null;
    mes: number | null;
    activo: boolean | null;
    estados: string[];
    sexos: string[];
    socios: string[];
  };
  resumen: {
    totalSocios: number;
    activos: number;
    inactivos: number;
    conEmail: number;
    sinEmail: number;
    conFechaNacimiento: number;
    conFechaIngreso: number;
    edadPromedio: number | null;
    recaudacionPeriodo: number;
    pagosAprobados: number;
    sociosPagadores: number;
    promedioPorPago: number;
  };
  porSexo: { clave: string; etiqueta: string; total: number }[];
  porEstado: { clave: string; etiqueta: string; total: number }[];
  porRangoEdad: { clave: string; etiqueta: string; total: number }[];
  nuevosPorMes: { clave: string; etiqueta: string; total: number }[];
  pagos: {
    porMes: { clave: string; etiqueta: string; monto: number; cantidad: number }[];
    porTipoCuota: { clave: string; etiqueta: string; monto: number; cantidad: number }[];
  };
};

function paramsReporteSocios(params: ReporteSociosParams): URLSearchParams {
  const qs = new URLSearchParams();
  if (params.anio) qs.set('anio', String(params.anio));
  if (params.periodo) qs.set('periodo', params.periodo);
  if (params.trimestre) qs.set('trimestre', String(params.trimestre));
  if (params.mes) qs.set('mes', String(params.mes));
  for (const socio of params.socios ?? []) qs.append('socios', socio);
  return qs;
}

export function obtenerReporteSocios(params: ReporteSociosParams): Promise<ReporteSocios> {
  const query = paramsReporteSocios(params).toString();
  return request<ReporteSocios>(`/reportes/socios${query ? `?${query}` : ''}`);
}

export type EstadoPagoExport = 'TODOS' | 'APROBADO' | 'PENDIENTE' | 'RECHAZADO';

export async function descargarPagos(params: {
  anio?: number;
  socios?: string[];
  estadoPago?: EstadoPagoExport;
  formato: 'csv' | 'xlsx';
}): Promise<Blob> {
  const qs = new URLSearchParams();
  if (params.anio) qs.set('anio', String(params.anio));
  if (params.estadoPago) qs.set('estadoPago', params.estadoPago);
  for (const socio of params.socios ?? []) qs.append('socios', socio);
  qs.set('formato', params.formato);

  const res = await fetch(`${BASE}/reportes/descarga/pagos?${qs.toString()}`, {
    credentials: 'include',
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

  return res.blob();
}

// ---------------------------------------------------------------------------
// Configuración (M5)
// ---------------------------------------------------------------------------

export type ConfigClub = {
  nombre_club: string | null;
  logo_url: string | null;
  direccion: string | null;
  telefono: string | null;
  email: string | null;
  email_tesoreria: string | null;
  meta_mensual: string | null;
};

export type LogoClub = {
  id: number;
  ruta: string;
  mime: string;
  bytes: number;
  sha256: string;
  url: string;
};

export type UsuarioRol = {
  userId: string;
  rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO';
  createdAt: number;
};

export function obtenerConfig(): Promise<ConfigClub> {
  return request<ConfigClub>('/config');
}

export function actualizarConfig(input: Partial<ConfigClub>): Promise<ConfigClub> {
  return request<ConfigClub>('/config', { method: 'PATCH', body: JSON.stringify(input) });
}

export function obtenerLogo(): Promise<{ logo: LogoClub | null }> {
  return request<{ logo: LogoClub | null }>('/config/logo');
}

export async function subirLogo(archivo: File): Promise<{ logo: LogoClub }> {
  const formData = new FormData();
  formData.append('archivo', archivo);

  const res = await fetch(`${BASE}/config/logo`, {
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

  return (await res.json()) as { logo: LogoClub };
}

export function listarUsuariosConRol(): Promise<UsuarioRol[]> {
  return request<UsuarioRol[]>('/config/usuarios');
}

export function asignarRolUsuario(userId: string, rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO'): Promise<UsuarioRol> {
  return request<UsuarioRol>('/config/usuarios', { method: 'POST', body: JSON.stringify({ userId, rol }) });
}

export function actualizarRolUsuario(userId: string, rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO'): Promise<UsuarioRol> {
  return request<UsuarioRol>(`/config/usuarios/${userId}`, { method: 'PATCH', body: JSON.stringify({ rol }) });
}

export function eliminarRolUsuario(userId: string): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>(`/config/usuarios/${userId}`, { method: 'DELETE' });
}

export function urlLogo(sha256: string): string {
  return `${BASE}/config/logo/${sha256}`;
}

// ---------------------------------------------------------------------------
// Panel (M5)
// ---------------------------------------------------------------------------

export type PanelKPIs = {
  mes: string;
  recaudadoMes: number;
  sociosMorosos: number;
  sociosActivos: number;
  comprobantesPendientes: number;
};

export type PanelRecaudacion = {
  serie: { periodo: string; monto: number }[];
};

export type PanelUltimosPagos = {
  pagos: { id: number; fechaPago: string; totalPago: number; rut: string; nombreSnapshot: string; tipoCuota: string }[];
};

export type PanelMeta = {
  mes: string;
  meta: number;
  recaudado: number;
  porcentaje: number;
  faltante: number;
};

export type PanelResumen = {
  mes: string;
  ingresos: { pagos: number; otros: number; total: number };
  egresos: { variables: number; fijos: number; total: number };
  saldo: number;
};

export function obtenerKPIs(mes?: string): Promise<PanelKPIs> {
  const qs = new URLSearchParams();
  if (mes) qs.set('mes', mes);
  const query = qs.toString();
  return request<PanelKPIs>(`/panel/kpis${query ? `?${query}` : ''}`);
}

export function obtenerRecaudacion(): Promise<PanelRecaudacion> {
  return request<PanelRecaudacion>('/panel/recaudacion');
}

export function obtenerUltimosPagos(): Promise<PanelUltimosPagos> {
  return request<PanelUltimosPagos>('/panel/ultimos-pagos');
}

export function obtenerMeta(mes?: string): Promise<PanelMeta> {
  const qs = new URLSearchParams();
  if (mes) qs.set('mes', mes);
  const query = qs.toString();
  return request<PanelMeta>(`/panel/meta${query ? `?${query}` : ''}`);
}

export function obtenerResumenPanel(mes?: string): Promise<PanelResumen> {
  const qs = new URLSearchParams();
  if (mes) qs.set('mes', mes);
  const query = qs.toString();
  return request<PanelResumen>(`/panel/resumen${query ? `?${query}` : ''}`);
}

// ---------------------------------------------------------------------------
// Ficha de socio (datos + pagos + deuda derivada)
// ---------------------------------------------------------------------------

export type FichaSocio = {
  socio: Socio;
  pagos: Pago[];
  deuda: {
    socioId: number;
    rut: string;
    nombre: string;
    estado: string;
    activo: number;
    totalDeuda: number;
    periodos: { periodo: string; diaVencimiento: number }[];
  } | null;
};

export function obtenerFichaSocio(id: number): Promise<FichaSocio> {
  return request<FichaSocio>(`/socios/${id}/ficha`);
}

// ---------------------------------------------------------------------------
// Cumpleaños
// ---------------------------------------------------------------------------

export type MembresiaSocio = {
  anios: number;
  meses: number;
  texto: string;
};

export type FelicitacionCumple = {
  enviadoAt: number;
  anio: number;
};

export type CumpleanosFila = {
  socioId: number;
  rut: string;
  nombre: string;
  email: string | null;
  fechaNacimiento: string;
  dia: number;
  edadCumple: number | null;
  fechaIngreso: string | null;
  membresia: MembresiaSocio | null;
  esHoy: boolean;
  felicitacion: FelicitacionCumple | null;
  puedeEnviar: boolean;
};

export type CumpleanosLista = {
  mes: string;
  etiqueta: string;
  total: number;
  conEmail: number;
  enviados: number;
  correoConfigurado: boolean;
  club: {
    nombre: string;
    email: string | null;
    telefono: string | null;
    direccion: string | null;
  };
  filas: CumpleanosFila[];
};

export type SaludoPreview = {
  asunto: string;
  texto: string;
  html: string;
  para: string;
  nombre: string;
};

export function listarCumpleanos(mes?: string): Promise<CumpleanosLista> {
  const qs = new URLSearchParams();
  if (mes) qs.set('mes', mes);
  const query = qs.toString();
  return request<CumpleanosLista>(`/cumpleanos${query ? `?${query}` : ''}`);
}

export function previsualizarSaludo(socioId: number): Promise<SaludoPreview> {
  return request<SaludoPreview>(`/cumpleanos/${socioId}/preview`);
}

export function enviarSaludo(
  socioId: number,
): Promise<{ ok: true; enviadoAt: number; para: string }> {
  return request<{ ok: true; enviadoAt: number; para: string }>(
    `/cumpleanos/${socioId}/enviar`,
    { method: 'POST' },
  );
}
