import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarSocios,
  crearSocio,
  actualizarSocio,
  desactivarSocio,
  obtenerFichaSocio,
  ApiError,
  type Socio,
} from '../lib/api';
import SocioForm, { type SocioFormValues } from '../components/SocioForm';

/**
 * Página de socios (M1): tabla con búsqueda, alta, edición y baja lógica.
 *
 * El listado vive en caché de react-query (clave ['socios', filtros]) y se
 * invalida tras cada mutación, así la tabla siempre refleja la base.
 */

const formatRut = (rut: string) => {
  if (!/^\d{7,8}[0-9K]$/.test(rut)) return rut;
  const cuerpo = rut.slice(0, -1);
  const dv = rut.slice(-1);
  const conPuntos = cuerpo.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1.');
  return `${conPuntos}-${dv}`;
};

function Badge({ value }: { value: string }) {
  const mapa: Record<string, string> = {
    ACTIVO: 'bg-success/10 text-success',
    MEMBRESIA: 'bg-warning/10 text-warning',
    BECADO: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${mapa[value] ?? 'bg-secondary text-muted-foreground'}`}>
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
  const [fichaSocioId, setFichaSocioId] = useState<number | null>(null);

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

  const totalPaginas = data ? Math.max(1, Math.ceil(data.total / data.porPagina)) : 1;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Socios</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            {data ? `${data.total} socio${data.total === 1 ? '' : 's'} en el padrón` : 'Padrón del club'}
          </p>
        </div>
        <button
          onClick={() => setModal({ modo: 'crear' })}
          className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold"
        >
          Nuevo socio
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
            setEstadoFiltro(e.target.value);
            setPagina(1);
          }}
          className="px-3 py-[9px] border border-input rounded-lg bg-card text-[13px]"
        >
          <option value="">Todos los estados</option>
          <option value="ACTIVO">Activo</option>
          <option value="MEMBRESIA">Membresía</option>
          <option value="BECADO">Becado</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        {isPending ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando socios…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[13px] text-primary">No se pudo cargar el padrón.</div>
        ) : data && data.filas.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            No hay socios que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-semibold">RUT</th>
                <th className="px-4 py-3 font-semibold">Nombre</th>
                <th className="px-4 py-3 font-semibold">Año</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Situación</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.filas.map((s) => (
                <tr key={s.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-mono text-[12.5px]">{formatRut(s.rut)}</td>
                  <td className="px-4 py-3 font-medium">{s.nombre}</td>
                  <td className="px-4 py-3">{s.anio}</td>
                  <td className="px-4 py-3">
                    <Badge value={s.estado} />
                  </td>
                  <td className="px-4 py-3">
                    {s.activo === 1 ? (
                      <span className="text-success font-medium">Activo</span>
                    ) : (
                      <span className="text-muted-foreground">Inactivo</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setFichaSocioId(s.id)}
                        className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                      >
                        Ficha
                      </button>
                      <button
                        onClick={() => setModal({ modo: 'editar', socio: s })}
                        className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                      >
                        Editar
                      </button>
                      {s.activo === 1 && (
                        <button
                          onClick={() => setModal({ modo: 'baja', socio: s })}
                          className="text-[12px] font-medium text-primary/80 hover:text-primary border border-border rounded-md px-2 py-1"
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
            className="w-full max-w-[560px] bg-card border border-border rounded-[12px] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            {modal.modo === 'baja' ? (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-2">Dar de baja a {modal.socio.nombre}</h2>
                <p className="text-[13px] text-muted-foreground mb-5">
                  El socio quedará marcado como inactivo. No se borra su historial.
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => darBaja.mutate(modal.socio.id)}
                    disabled={darBaja.isPending}
                    className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
                  >
                    {darBaja.isPending ? 'Dando de baja…' : 'Confirmar baja'}
                  </button>
                  <button
                    onClick={() => setModal(null)}
                    className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <h2 className="text-[17px] font-bold tracking-tight mb-5">
                  {modal.modo === 'crear' ? 'Nuevo socio' : 'Editar socio'}
                </h2>
                <SocioForm
                  initial={
                    modal.modo === 'editar'
                      ? {
                          rut: modal.socio.rut,
                          nombre: modal.socio.nombre,
                          anio: modal.socio.anio,
                          sexo: modal.socio.sexo ?? '',
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
                  onCancel={() => setModal(null)}
                  onSubmit={async (v) => {
                    if (modal.modo === 'crear') await crear.mutateAsync(v);
                    else await editar.mutateAsync({ id: modal.socio.id, v });
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {fichaSocioId !== null && (
        <FichaSocioModal socioId={fichaSocioId} onClose={() => setFichaSocioId(null)} />
      )}
    </div>
  );
}

function formatClp(n: number) {
  return `$${n.toLocaleString('es-CL')}`;
}

function formatFecha(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split('-');
  return `${d}-${m}-${a}`;
}

function FichaSocioModal({ socioId, onClose }: { socioId: number; onClose: () => void }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['ficha-socio', socioId],
    queryFn: () => obtenerFichaSocio(socioId),
  });

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[820px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {isPending ? (
          <p className="text-[13px] text-muted-foreground py-6 text-center">Cargando ficha…</p>
        ) : isError || !data ? (
          <p className="text-[13px] text-primary py-6 text-center">No se pudo cargar la ficha.</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-[18px] font-bold tracking-tight">{data.socio.nombre}</h2>
                <p className="text-[12.5px] text-muted-foreground font-mono mt-0.5">
                  {formatRut(data.socio.rut)} · {data.socio.estado} · {data.socio.anio}
                </p>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1">✕</button>
            </div>

            <div className="grid gap-3 md:grid-cols-3 mb-5">
              <div className="p-3 bg-secondary/30 rounded-lg">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Períodos pendientes</div>
                <div className="text-[20px] font-bold font-mono">{data.deuda?.totalDeuda ?? 0}</div>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Pagos registrados</div>
                <div className="text-[20px] font-bold font-mono">{data.pagos.length}</div>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">Estado</div>
                <div className="text-[13px] font-semibold mt-1">
                  {data.socio.activo === 1 ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            </div>

            {data.deuda && data.deuda.periodos.length > 0 && (
              <div className="mb-5">
                <h3 className="text-[13.5px] font-semibold mb-2">Períodos adeudados</h3>
                <div className="flex flex-wrap gap-2">
                  {data.deuda.periodos.map((p) => (
                    <span key={p.periodo} className="px-2 py-1 rounded-md bg-warning/10 text-warning text-[12px] font-mono font-semibold">
                      {p.periodo}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-[13.5px] font-semibold mb-2">Historial de pagos</h3>
              {data.pagos.length === 0 ? (
                <p className="text-[13px] text-muted-foreground py-3">Sin pagos registrados.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[12.5px]">
                    <thead>
                      <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                        <th className="px-3 py-2 font-semibold">Fecha</th>
                        <th className="px-3 py-2 font-semibold">Año</th>
                        <th className="px-3 py-2 font-semibold">Tipo</th>
                        <th className="px-3 py-2 font-semibold">Meses</th>
                        <th className="px-3 py-2 font-semibold">Estado</th>
                        <th className="px-3 py-2 font-semibold text-right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.pagos.map((p) => (
                        <tr key={p.id} className="border-b border-border last:border-0">
                          <td className="px-3 py-2 font-mono">{formatFecha(p.fechaPago)}</td>
                          <td className="px-3 py-2">{p.anio}</td>
                          <td className="px-3 py-2">{p.tipoCuota}</td>
                          <td className="px-3 py-2">{p.mesesDetalle ?? p.mesesCantidad}</td>
                          <td className="px-3 py-2">
                            <Badge value={p.estado} />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">{formatClp(p.totalPago)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
