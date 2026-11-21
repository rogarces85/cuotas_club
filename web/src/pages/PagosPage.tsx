import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarPagos,
  crearPago,
  obtenerPago,
  aprobarPago,
  rechazarPago,
  subirComprobante,
  registrarComprobante,
  urlComprobante,
  ApiError,
  type Pago,
  type PagoInput,
} from '../lib/api';

/**
 * Página de pagos (M3): bandeja de revisión de pagos pendientes,
 * alta de pago manual, aprobación y rechazo.
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
const formatFecha = (s: string) => {
  // s es AAAA-MM-DD desde la API
  const [a, m, d] = s.split('-');
  return `${d}-${m}-${a}`;
};

const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  APROBADO: 'Aprobado',
  RECHAZADO: 'Rechazado',
};

const ESTADO_STYLES: Record<string, string> = {
  PENDIENTE: 'bg-warning/10 text-warning',
  APROBADO: 'bg-success/10 text-success',
  RECHAZADO: 'bg-destructive/10 text-destructive',
};

function Badge({ value }: { value: string }) {
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${ESTADO_STYLES[value] ?? 'bg-secondary text-muted-foreground'}`}>
      {ESTADO_LABELS[value] ?? value}
    </span>
  );
}

type ModalState =
  | { modo: 'crear' }
  | { modo: 'detalle'; pago: Pago }
  | null;

export default function PagosPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState<'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | ''>('');
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);

  const filtros = {
    q: busqueda.trim() || undefined,
    estado: estadoFiltro || undefined,
    pagina,
    porPagina: 25,
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['pagos', filtros],
    queryFn: () => listarPagos(filtros),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['pagos'] });

  const crear = useMutation({
    mutationFn: (v: PagoInput) => crearPago(v),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const aprobar = useMutation({
    mutationFn: (id: number) => aprobarPago(id),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const rechazar = useMutation({
    mutationFn: ({ id, motivo }: { id: number; motivo?: string }) => rechazarPago(id, motivo),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const verDetalle = useMutation({
    mutationFn: (id: number) => obtenerPago(id),
  });

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  const handleVerDetalle = async (id: number) => {
    try {
      const pago = await verDetalle.mutateAsync(id);
      setModal({ modo: 'detalle', pago });
    } catch {
      // error ya manejado por ApiError
    }
  };

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Pagos</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            {data ? `${data.total} pago${data.total === 1 ? '' : 's'} registrados` : 'Bandeja de revisión'}
          </p>
        </div>
        <button
          onClick={() => setModal({ modo: 'crear' })}
          className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold"
        >
          Registrar pago
        </button>
      </div>

      {/* Filtros */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 max-w-[420px] relative">
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por RUT o nombre…"
            className="w-full pl-[34px] pr-3 py-[9px] border border-input rounded-lg bg-card text-[13px]"
          />
          <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => {
            setEstadoFiltro(e.target.value as 'PENDIENTE' | 'APROBADO' | 'RECHAZADO' | '');
            setPagina(1);
          }}
          className="px-3 py-[9px] border border-input rounded-lg bg-card text-[13px]"
        >
          <option value="">Todos los estados</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="APROBADO">Aprobado</option>
          <option value="RECHAZADO">Rechazado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        {isPending ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando pagos…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[13px] text-primary">No se pudo cargar la lista.</div>
        ) : data && data.filas.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            No hay pagos que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-semibold">Fecha</th>
                <th className="px-4 py-3 font-semibold">RUT</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Año</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold text-right">Total</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.filas.map((p: Pago) => (
                <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono text-[12.5px]">{formatFecha(p.fechaPago)}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px]">{p.rut}</td>
                  <td className="px-4 py-3 font-medium">{p.nombreSnapshot}</td>
                  <td className="px-4 py-3">{p.anio}</td>
                  <td className="px-4 py-3"><Badge value={p.estado} /></td>
                  <td className="px-4 py-3 text-right font-mono">{formatClp(p.totalPago)}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => handleVerDetalle(p.id)}
                        disabled={verDetalle.isPending}
                        className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        Ver
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {data && data.total > 0 && (
        <div className="flex items-center justify-between mt-4 text-[12.5px] text-muted-foreground">
          <span>
            Página {data.pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
              className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
              className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-[720px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.modo === 'crear' ? (
              <PagoForm
                serverError={crear.error instanceof ApiError ? crear.error.message : null}
                submitLabel={crear.isPending ? 'Creando…' : 'Crear pago'}
                onCancel={() => setModal(null)}
                onSubmit={async (v) => {
                  await crear.mutateAsync(v);
                }}
              />
            ) : (
              <DetallePago
                pago={modal.pago}
                onAprobar={aprobar.isPending ? undefined : () => aprobar.mutate(modal.pago.id)}
                onRechazar={rechazar.isPending ? undefined : (motivo) => rechazar.mutate({ id: modal.pago.id, motivo })}
                onClose={() => setModal(null)}
                aprobando={aprobar.isPending}
                rechazando={rechazar.isPending}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Componentes internos ==========

type PagoFormProps = {
  initial?: Partial<PagoInput>;
  serverError?: string | null;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: PagoInput) => Promise<void>;
};

function PagoForm({ initial, serverError, submitLabel, onCancel, onSubmit }: PagoFormProps) {
  const [rut, setRut] = useState(initial?.rut ?? '');
  const [nombreSnapshot, setNombreSnapshot] = useState(initial?.nombreSnapshot ?? '');
  const [anio, setAnio] = useState(initial?.anio ?? new Date().getFullYear());
  const [sexo, setSexo] = useState(initial?.sexo ?? '');
  const [estado, setEstado] = useState<'PENDIENTE' | 'APROBADO' | 'RECHAZADO'>(initial?.estado ?? 'PENDIENTE');
  const [situacion, setSituacion] = useState(initial?.situacion ?? '');
  const [fechaPago, setFechaPago] = useState(initial?.fechaPago ?? new Date().toISOString().slice(0, 10));
  const [totalPago, setTotalPago] = useState(initial?.totalPago ?? 0);
  const [valorCuota, setValorCuota] = useState(initial?.valorCuota ?? 0);
  const [tipoCuota, setTipoCuota] = useState<'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO'>(initial?.tipoCuota ?? 'ACTIVO');
  const [mesesCantidad, setMesesCantidad] = useState(initial?.mesesCantidad ?? 1);
  const [mesesDetalle, setMesesDetalle] = useState(initial?.mesesDetalle ?? '');
  const [observacion, setObservacion] = useState(initial?.observacion ?? '');
  const [origen, setOrigen] = useState<'manual' | 'banco' | 'historico'>(initial?.origen ?? 'manual');

  const valido = rut.trim() !== '' && nombreSnapshot.trim() !== '' && totalPago > 0 && valorCuota > 0 && mesesCantidad > 0;

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">Registrar pago</h2>
      {serverError && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
          {serverError}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="rut" className="block text-[12px] font-semibold mb-1.5">RUT</label>
          <input
            id="rut"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="12345678-9"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            maxLength={12}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="nombre" className="block text-[12px] font-semibold mb-1.5">Nombre</label>
          <input
            id="nombre"
            value={nombreSnapshot}
            onChange={(e) => setNombreSnapshot(e.target.value)}
            placeholder="Nombre completo del socio"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          />
        </div>
        <div>
          <label htmlFor="anio" className="block text-[12px] font-semibold mb-1.5">Año</label>
          <input
            id="anio"
            type="number"
            min={2020}
            max={2100}
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div>
          <label htmlFor="sexo" className="block text-[12px] font-semibold mb-1.5">Sexo (opcional)</label>
          <input
            id="sexo"
            value={sexo}
            onChange={(e) => setSexo(e.target.value)}
            placeholder="M / F"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={20}
          />
        </div>
        <div>
          <label htmlFor="estado" className="block text-[12px] font-semibold mb-1.5">Estado</label>
          <select
            id="estado"
            value={estado}
            onChange={(e) => setEstado(e.target.value as 'PENDIENTE' | 'APROBADO' | 'RECHAZADO')}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          >
            <option value="PENDIENTE">Pendiente</option>
            <option value="APROBADO">Aprobado</option>
            <option value="RECHAZADO">Rechazado</option>
          </select>
        </div>
        <div>
          <label htmlFor="situacion" className="block text-[12px] font-semibold mb-1.5">Situación (opcional)</label>
          <input
            id="situacion"
            value={situacion}
            onChange={(e) => setSituacion(e.target.value)}
            placeholder="Observación de estado"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={30}
          />
        </div>
        <div>
          <label htmlFor="fechaPago" className="block text-[12px] font-semibold mb-1.5">Fecha de pago</label>
          <input
            id="fechaPago"
            type="date"
            value={fechaPago}
            onChange={(e) => setFechaPago(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div>
          <label htmlFor="totalPago" className="block text-[12px] font-semibold mb-1.5">Total pagado (CLP)</label>
          <input
            id="totalPago"
            type="number"
            min={1}
            value={totalPago}
            onChange={(e) => setTotalPago(Number(e.target.value))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div>
          <label htmlFor="valorCuota" className="block text-[12px] font-semibold mb-1.5">Valor cuota (CLP)</label>
          <input
            id="valorCuota"
            type="number"
            min={1}
            value={valorCuota}
            onChange={(e) => setValorCuota(Number(e.target.value))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div>
          <label htmlFor="tipoCuota" className="block text-[12px] font-semibold mb-1.5">Tipo de cuota</label>
          <select
            id="tipoCuota"
            value={tipoCuota}
            onChange={(e) => setTipoCuota(e.target.value as 'ACTIVO' | 'MEMBRESIA' | 'BECADO' | 'OTRO')}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          >
            <option value="ACTIVO">Activo</option>
            <option value="MEMBRESIA">Membresía</option>
            <option value="BECADO">Becado</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor="mesesCantidad" className="block text-[12px] font-semibold mb-1.5">Meses cubiertos</label>
          <input
            id="mesesCantidad"
            type="number"
            min={1}
            max={12}
            value={mesesCantidad}
            onChange={(e) => setMesesCantidad(Number(e.target.value))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div>
          <label htmlFor="mesesDetalle" className="block text-[12px] font-semibold mb-1.5">Meses detalle (opcional)</label>
          <input
            id="mesesDetalle"
            value={mesesDetalle}
            onChange={(e) => setMesesDetalle(e.target.value)}
            placeholder="Ej: Ene-Feb 2026"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={120}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="observacion" className="block text-[12px] font-semibold mb-1.5">Observación (opcional)</label>
          <textarea
            id="observacion"
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Nota adicional"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] min-h-[70px] resize-y"
            maxLength={255}
          />
        </div>
        <div>
          <label htmlFor="origen" className="block text-[12px] font-semibold mb-1.5">Origen</label>
          <select
            id="origen"
            value={origen}
            onChange={(e) => setOrigen(e.target.value as 'manual' | 'banco' | 'historico')}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          >
            <option value="manual">Manual</option>
            <option value="banco">Banco</option>
            <option value="historico">Histórico</option>
          </select>
        </div>
      </div>
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={() => onSubmit({
            socioId: 0, // se ignora en el backend si viene 0; se busca por RUT
            rut,
            nombreSnapshot,
            anio,
            sexo: sexo || undefined,
            estado,
            situacion: situacion || undefined,
            fechaPago,
            totalPago,
            valorCuota,
            tipoCuota,
            mesesCantidad,
            mesesDetalle: mesesDetalle || undefined,
            observacion: observacion || undefined,
            origen,
          })}
          disabled={!valido}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
        >
          {submitLabel}
        </button>
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

type DetallePagoProps = {
  pago: Pago;
  onAprobar: ((motivo?: string) => void) | undefined;
  onRechazar: ((motivo?: string) => void) | undefined;
  onClose: () => void;
  aprobando: boolean;
  rechazando: boolean;
};

function DetallePago({ pago, onAprobar, onRechazar, onClose, aprobando, rechazando }: DetallePagoProps) {
  const [motivoRechazo, setMotivoRechazo] = useState('');
  const [mostrarRechazo, setMostrarRechazo] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [subidaError, setSubidaError] = useState<string | null>(null);
  const [visorAbierto, setVisorAbierto] = useState<{ url: string; mime: string; nombre: string } | null>(null);

  const handleAprobar = () => {
    if (onAprobar) onAprobar();
  };

  const handleRechazar = () => {
    if (onRechazar) onRechazar(motivoRechazo);
  };

  const comprobante = pago.comprobantes?.[0];
  const tieneComprobante = !!comprobante;
  const puedeSubir = pago.estado === 'PENDIENTE' && !tieneComprobante;

  const handleSubirArchivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;

    // Validar tipo en cliente antes de subir
    const mimesPermitidos = ['application/pdf', 'image/png', 'image/jpeg'];
    if (!mimesPermitidos.includes(archivo.type)) {
      setSubidaError('Tipo de archivo no permitido. Use PDF, PNG o JPEG.');
      return;
    }
    if (archivo.size > 5 * 1024 * 1024) {
      setSubidaError('Archivo muy grande (máx 5 MB).');
      return;
    }

    setSubiendo(true);
    setSubidaError(null);

    try {
      // 1. Subir archivo a /api/upload/comprobante
      const uploadResult = await subirComprobante(archivo);

      // 2. Registrar metadatos en /api/pagos/:id/comprobante
      await registrarComprobante({
        pagoId: pago.id,
        nombreArchivo: uploadResult.nombreArchivo,
        mime: uploadResult.mime,
        bytes: uploadResult.bytes,
        sha256: uploadResult.sha256,
      });

      // 3. Invalidar queries para recargar el detalle
      // El modal se cerrará y se volverá a abrir con datos frescos
      onClose();
    } catch (err) {
      setSubidaError(err instanceof ApiError ? err.message : 'Error al subir el comprobante');
    } finally {
      setSubiendo(false);
      // Reset input
      e.target.value = '';
    }
  };

  const abrirVisor = () => {
    if (comprobante) {
      setVisorAbierto({
        url: urlComprobante(comprobante.sha256),
        mime: comprobante.mime,
        nombre: comprobante.nombreArchivo,
      });
    }
  };

  return (
    <div>
      <div className="flex items-start justify-between mb-5">
        <div>
          <h2 className="text-[17px] font-bold tracking-tight">Pago #{pago.id}</h2>
          <p className="text-[13px] text-muted-foreground mt-1">{pago.nombreSnapshot} · {formatClp(pago.totalPago)} · {formatFecha(pago.fechaPago)}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">✕</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 mb-5">
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">RUT</span>
          <p className="font-mono text-[13px] mt-0.5">{pago.rut}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Año</span>
          <p className="text-[13px] mt-0.5">{pago.anio}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Sexo</span>
          <p className="text-[13px] mt-0.5">{pago.sexo ?? '—'}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Tipo de cuota</span>
          <p className="text-[13px] mt-0.5">{pago.tipoCuota}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Meses cubiertos</span>
          <p className="text-[13px] mt-0.5">{pago.mesesCantidad}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Meses detalle</span>
          <p className="text-[13px] mt-0.5">{pago.mesesDetalle ?? '—'}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Valor cuota</span>
          <p className="text-[13px] font-mono mt-0.5">{formatClp(pago.valorCuota)}</p>
        </div>
        <div>
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Origen</span>
          <p className="text-[13px] mt-0.5">{pago.origen}</p>
        </div>
        <div className="md:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Observación</span>
          <p className="text-[13px] mt-0.5">{pago.observacion ?? '—'}</p>
        </div>
        <div className="md:col-span-2">
          <span className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Situación</span>
          <p className="text-[13px] mt-0.5">{pago.situacion ?? '—'}</p>
        </div>
      </div>

      {/* Comprobante */}
      <div className="mb-5 p-3 bg-secondary/30 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[13px] font-semibold">Comprobante</h3>
          {puedeSubir && (
            <label className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-[12px] font-medium cursor-pointer hover:opacity-90">
              Subir comprobante
              <input
                type="file"
                accept="application/pdf,image/png,image/jpeg"
                onChange={handleSubirArchivo}
                disabled={subiendo}
                className="hidden"
              />
            </label>
          )}
        </div>

        {subidaError && (
          <div className="mb-3 p-2 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
            {subidaError}
          </div>
        )}

        {subiendo && (
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            <div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />
            Subiendo comprobante…
          </div>
        )}

        {tieneComprobante && comprobante && (
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-2 bg-background rounded-lg border border-border">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[13px] truncate">{comprobante.nombreArchivo}</p>
                <p className="text-[11.5px] text-muted-foreground font-mono">
                  {comprobante.mime} · {comprobante.bytes.toLocaleString()} bytes · SHA256: {comprobante.sha256.slice(0, 16)}…
                </p>
              </div>
              <Badge value={comprobante.estado} />
              <button
                onClick={abrirVisor}
                disabled={comprobante.mime !== 'application/pdf' && !comprobante.mime.startsWith('image/')}
                className="text-[12px] font-medium text-primary hover:underline disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {comprobante.mime === 'application/pdf' ? 'Ver PDF' : 'Ver imagen'}
              </button>
            </div>
          </div>
        )}

        {puedeSubir && !subiendo && !tieneComprobante && (
          <p className="text-[12.5px] text-muted-foreground text-center py-2">
            No hay comprobante subido. Use el botón «Subir comprobante» para adjuntar el comprobante de transferencia.
          </p>
        )}
      </div>

      {/* Acciones según estado */}
      <div className="flex items-center gap-3 pt-4 border-t border-border">
        {pago.estado === 'PENDIENTE' && (
          <>
            <button
              onClick={handleAprobar}
              disabled={aprobando || !tieneComprobante}
              className="bg-success text-success-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
              title={!tieneComprobante ? 'Suba un comprobante antes de aprobar' : ''}
            >
              {aprobando ? 'Aprobando…' : 'Aprobar'}
            </button>
            <button
              onClick={() => setMostrarRechazo(true)}
              disabled={rechazando}
              className="bg-destructive text-destructive-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
            >
              {rechazando ? 'Rechazando…' : 'Rechazar'}
            </button>
          </>
        )}
        {pago.estado === 'APROBADO' && (
          <span className="text-success font-medium">Pago aprobado</span>
        )}
        {pago.estado === 'RECHAZADO' && (
          <span className="text-destructive font-medium">Pago rechazado</span>
        )}
      </div>

      {/* Modal de confirmación de rechazo */}
      {mostrarRechazo && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setMostrarRechazo(false)}>
          <div className="w-full max-w-[480px] bg-card border border-border rounded-[12px] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[15px] font-bold mb-4">Motivo del rechazo</h3>
            <textarea
              value={motivoRechazo}
              onChange={(e) => setMotivoRechazo(e.target.value)}
              placeholder="Explique por qué se rechaza este pago…"
              className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] min-h-[80px] resize-y mb-4"
              maxLength={255}
            />
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setMostrarRechazo(false)}
                className="px-4 py-2 text-[13px] font-medium text-muted-foreground border border-border rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleRechazar}
                disabled={rechazando}
                className="bg-destructive text-destructive-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
              >
                {rechazando ? 'Rechazando…' : 'Confirmar rechazo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Visor de comprobante (PDF/imagen) */}
      {visorAbierto && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4" onClick={() => setVisorAbierto(null)}>
          <div className="w-full max-w-[900px] max-h-[90vh] bg-card border border-border rounded-[12px] shadow-lg overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h4 className="text-[14px] font-semibold truncate pr-4">{visorAbierto.nombre}</h4>
              <button onClick={() => setVisorAbierto(null)} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>
            <div className="p-4 overflow-auto max-h-[calc(90vh-100px)]">
              {visorAbierto.mime === 'application/pdf' ? (
                <iframe
                  src={visorAbierto.url}
                  className="w-full h-[70vh] border-0"
                  title={visorAbierto.nombre}
                />
              ) : (
                <img
                  src={visorAbierto.url}
                  alt={visorAbierto.nombre}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}