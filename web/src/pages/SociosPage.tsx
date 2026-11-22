import { useEffect, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarSocios,
  crearSocio,
  actualizarSocio,
  desactivarSocio,
  ApiError,
  type Socio,
} from '../lib/api';
import SocioForm, { type SocioFormValues } from '../components/SocioForm';
import ImportarSociosModal from '../components/ImportarSociosModal';
import BoletaSocioModal from '../components/BoletaSocioModal';

/**
 * Página de socios (M1): tabla con búsqueda, alta, edición y baja lógica.
 *
 * El listado vive en caché de react-query (clave ['socios', filtros]) y se
 * invalida tras cada mutación, así la tabla siempre refleja la base.
 */

const SEXO_LABEL: Record<string, string> = {
  HOMBRE: 'Hombre',
  MUJER: 'Mujer',
  INDEFINIDO: 'Indefinido',
};

const formatRut = (rut: string) => {
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return rut;
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  const conPuntos = cuerpo.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return `${conPuntos}-${dv}`;
};

function fechaCorta(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  if (!anio || !mes || !dia) return iso;
  return `${dia}-${mes}-${anio}`;
}

function edad(fechaNacimiento: string | null): number | null {
  if (!fechaNacimiento) return null;
  const [anio, mes, dia] = fechaNacimiento.slice(0, 10).split('-').map(Number);
  if (!anio || !mes || !dia) return null;
  const hoy = new Date();
  let edadActual = hoy.getFullYear() - anio;
  const cumpleAunNo =
    hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia);
  if (cumpleAunNo) edadActual--;
  return edadActual >= 0 ? edadActual : null;
}

function Badge({ value }: { value: string }) {
  const mapa: Record<string, string> = {
    ACTIVO: 'bg-success/10 text-success',
    MEMBRESIA: 'bg-warning/10 text-warning',
    BECADO: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-block rounded px-2 py-0.5 text-[11px] font-semibold ${mapa[value] ?? 'bg-secondary text-muted-foreground'}`}>
      {value}
    </span>
  );
}

type ModalState =
  | { modo: 'crear' }
  | { modo: 'editar'; socio: Socio }
  | { modo: 'baja'; socio: Socio }
  | null;

export default function SociosPage() {
  const queryClient = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [pagina, setPagina] = useState(1);
  const [modal, setModal] = useState<ModalState>(null);
  const [importarAbierto, setImportarAbierto] = useState(false);
  const [fichaSocioId, setFichaSocioId] = useState<number | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const filtros = {
    q: busqueda.trim() || undefined,
    estado: estadoFiltro || undefined,
    pagina,
    porPagina: 25,
  };

  const { data, isPending, isError } = useQuery({
    queryKey: ['socios', filtros],
    queryFn: () => listarSocios(filtros),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['socios'] });

  const crear = useMutation({
    mutationFn: (v: SocioFormValues) => crearSocio(v),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const editar = useMutation({
    mutationFn: ({ id, v }: { id: number; v: SocioFormValues }) => actualizarSocio(id, v),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const darBaja = useMutation({
    mutationFn: (id: number) => desactivarSocio(id),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const cerrarModal = () => {
    setModal(null);
    crear.reset();
    editar.reset();
    darBaja.reset();
  };

  // Escape cierra el modal de alta/edición/baja y también la ficha.
  useEffect(() => {
    if (!modal && fichaSocioId === null) return;
    if (modal) modalRef.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      if (modal) cerrarModal();
      else setFichaSocioId(null);
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [modal, fichaSocioId]);

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Socios</h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground">
            {data ? `${data.total} socio${data.total === 1 ? '' : 's'} en el padrón` : 'Padrón del club'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setImportarAbierto(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-[13px] py-[9px] text-[13px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            <span aria-hidden="true">⇪</span>
            Importar
          </button>
          <button
            onClick={() => setModal({ modo: 'crear' })}
            className="rounded-lg bg-primary px-[14px] py-[9px] text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90"
          >
            + Nuevo socio
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] max-w-[420px] flex-1">
          <input
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por RUT o nombre…"
            className="w-full rounded-lg border border-input bg-card py-[9px] pl-[34px] pr-3 text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/20"
          />
          <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">⌕</span>
        </div>
        <select
          value={estadoFiltro}
          onChange={(e) => {
            setEstadoFiltro(e.target.value);
            setPagina(1);
          }}
          className="rounded-lg border border-input bg-card px-3 py-[9px] text-[13px] focus:outline-none focus:ring-2 focus:ring-ring/20"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="MEMBRESIA">Membresía</option>
          <option value="BECADO">Becado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-hidden rounded-[10px] border border-border bg-card">
        <div className="overflow-x-auto">
          {isPending ? (
            <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando socios…</div>
          ) : isError ? (
            <div className="p-10 text-center text-[13px] text-primary">No se pudo cargar el padrón.</div>
          ) : data && data.filas.length === 0 ? (
            <div className="p-10 text-center text-[13px] text-muted-foreground">
              No hay socios que coincidan con la búsqueda.
            </div>
          ) : (
            <table className="w-full min-w-[940px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-4 py-3 font-semibold">RUT</th>
                  <th className="px-4 py-3 font-semibold">Nombre</th>
                  <th className="px-4 py-3 font-semibold">Sexo</th>
                  <th className="px-4 py-3 font-semibold">Edad</th>
                  <th className="px-4 py-3 font-semibold">Ingreso</th>
                  <th className="px-4 py-3 font-semibold">Año</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 font-semibold">Situación</th>
                  <th className="px-4 py-3 text-right font-semibold">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {data?.filas.map((s) => (
                  <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px]">{formatRut(s.rut)}</td>
                    <td className="px-4 py-3 font-medium">{s.nombre}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {s.sexo ? SEXO_LABEL[s.sexo] ?? s.sexo : '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] text-muted-foreground">
                      {edad(s.fechaNacimiento) ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-[12.5px] text-muted-foreground">
                      {fechaCorta(s.fechaIngreso)}
                    </td>
                    <td className="px-4 py-3">{s.anio}</td>
                    <td className="px-4 py-3">
                      <Badge value={s.estado} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {s.activo === 1 ? (
                        <span className="font-medium text-success">Activo</span>
                      ) : (
                        <span className="text-muted-foreground">Inactivo</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setFichaSocioId(s.id)}
                          className="rounded-md border border-border px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          Ficha
                        </button>
                        <button
                          onClick={() => setModal({ modo: 'editar', socio: s })}
                          className="rounded-md border border-border px-2 py-1 text-[12px] font-medium text-muted-foreground hover:text-foreground"
                        >
                          Editar
                        </button>
                        {s.activo === 1 && (
                          <button
                            onClick={() => setModal({ modo: 'baja', socio: s })}
                            className="rounded-md border border-border px-2 py-1 text-[12px] font-medium text-primary/80 hover:text-primary"
                          >
                            Dar de baja
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Paginación */}
      {data && data.total > 0 && (
        <div className="mt-4 flex items-center justify-between text-[12.5px] text-muted-foreground">
          <span>
            Página {data.pagina} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina((p) => p - 1)}
              className="rounded-md border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina((p) => p + 1)}
              className="rounded-md border border-border px-3 py-1.5 hover:text-foreground disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}

      {/* Modal de alta / edición / baja */}
      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[1px]"
          onClick={cerrarModal}
          role="presentation"
        >
          <div
            ref={modalRef}
            tabIndex={-1}
            className="w-full max-w-[820px] overflow-hidden rounded-[16px] border border-border bg-card shadow-2xl focus:outline-none"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={modal.modo === 'crear' ? 'Nuevo socio' : modal.modo === 'editar' ? 'Editar socio' : 'Dar de baja'}
          >
            {modal.modo === 'baja' ? (
              <div>
                <div className="h-[4px] bg-gradient-to-r from-primary via-red-600 to-red-900" />
                <div className="p-6">
                  <h2 className="mb-2 text-[18px] font-bold tracking-tight">
                    Dar de baja a {modal.socio.nombre}
                  </h2>
                  <p className="mb-5 text-[13px] text-muted-foreground">
                    Quedará marcado como inactivo y no se le cobrarán cuotas nuevas. Su historial de
                    pagos se conserva.
                  </p>
                  {darBaja.error instanceof ApiError && (
                    <p className="mb-4 rounded-lg border border-primary/20 bg-accent px-3 py-2 text-[12.5px] text-accent-foreground">
                      {darBaja.error.message}
                    </p>
                  )}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => darBaja.mutate(modal.socio.id)}
                      disabled={darBaja.isPending}
                      className="rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {darBaja.isPending ? 'Dando de baja…' : 'Confirmar baja'}
                    </button>
                    <button
                      onClick={cerrarModal}
                      className="rounded-lg border border-border px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground hover:text-foreground"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <SocioForm
                titulo={modal.modo === 'crear' ? 'Nuevo socio' : 'Editar socio'}
                initial={
                  modal.modo === 'editar'
                    ? {
                        rut: modal.socio.rut,
                        nombre: modal.socio.nombre,
                        anio: modal.socio.anio,
                        sexo: modal.socio.sexo ?? '',
                        fechaNacimiento: modal.socio.fechaNacimiento ?? '',
                        fechaIngreso: modal.socio.fechaIngreso ?? '',
                        direccion: modal.socio.direccion ?? '',
                        estado: modal.socio.estado,
                        email: modal.socio.email ?? '',
                        telefono: modal.socio.telefono ?? '',
                      }
                    : undefined
                }
                serverError={
                  crear.error instanceof ApiError || editar.error instanceof ApiError
                    ? ((crear.error ?? editar.error) as ApiError).message
                    : null
                }
                submitLabel={modal.modo === 'crear' ? 'Crear socio' : 'Guardar cambios'}
                onCancel={cerrarModal}
                onSubmit={async (v) => {
                  if (modal.modo === 'crear') await crear.mutateAsync(v);
                  else await editar.mutateAsync({ id: modal.socio.id, v });
                }}
              />
            )}
          </div>
        </div>
      )}

      {fichaSocioId !== null && (
        <BoletaSocioModal socioId={fichaSocioId} onClose={() => setFichaSocioId(null)} />
      )}

      <ImportarSociosModal
        abierto={importarAbierto}
        onClose={() => setImportarAbierto(false)}
        onImported={invalidar}
      />
    </div>
  );
}
