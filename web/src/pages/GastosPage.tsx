import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarCategoriasEgreso,
  crearCategoriaEgreso,
  actualizarCategoriaEgreso,
  eliminarCategoriaEgreso,
  listarEgresos,
  crearEgreso,
  actualizarEgreso,
  eliminarEgreso,
  subirBoletaEgreso,
  listarGastosFijos,
  crearGastoFijo,
  actualizarGastoFijo,
  eliminarGastoFijo,
  listarOtrosIngresos,
  crearOtroIngreso,
  actualizarOtroIngreso,
  eliminarOtroIngreso,
  urlBoletaEgreso,
  ApiError,
  type CategoriaEgreso,
  type Egreso,
  type GastoFijo,
  type OtroIngreso,
} from '../lib/api';

/**
 * Página Gastos (M5): gestión de egresos, categorías, gastos fijos y otros ingresos.
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
const formatFecha = (s: string) => {
  const [a, m, d] = s.split('-');
  return `${d}-${m}-${a}`;
};

type TabKey = 'categorias' | 'egresos' | 'fijos' | 'ingresos';

type ModalState =
  | { tipo: 'categoria'; modo: 'crear' | 'editar'; data?: CategoriaEgreso }
  | { tipo: 'egreso'; modo: 'crear' | 'editar' | 'boleta'; data?: Egreso }
  | { tipo: 'fijo'; modo: 'crear' | 'editar'; data?: GastoFijo }
  | { tipo: 'ingreso'; modo: 'crear' | 'editar'; data?: OtroIngreso }
  | null;

export default function GastosPage() {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<TabKey>('egresos');
  const [modal, setModal] = useState<ModalState>(null);
  const [busqueda, setBusqueda] = useState('');
  const [categoriaFiltro, setCategoriaFiltro] = useState<number | ''>('');
  const [pagina, setPagina] = useState(1);
  const [archivoBoleta, setArchivoBoleta] = useState<File | null>(null);
  const [subiendoBoleta, setSubiendoBoleta] = useState(false);
  const [boletaError, setBoletError] = useState<string | null>(null);

  // ===== CATEGORÍAS =====
  const { data: categorias, isPending: catPending } = useQuery({
    queryKey: ['categorias-egreso'],
    queryFn: listarCategoriasEgreso,
  });

  const crearCat = useMutation({
    mutationFn: (nombre: string) => crearCategoriaEgreso(nombre),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias-egreso'] }); setModal(null); },
  });

  const editarCat = useMutation({
    mutationFn: ({ id, nombre }: { id: number; nombre: string }) => actualizarCategoriaEgreso(id, nombre),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias-egreso'] }); setModal(null); },
  });

  const eliminarCat = useMutation({
    mutationFn: (id: number) => eliminarCategoriaEgreso(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['categorias-egreso'] }); },
  });

  // ===== EGRESOS =====
  const { data: egresosData, isPending: egrPending, isError: egrError } = useQuery({
    queryKey: ['egresos', busqueda, categoriaFiltro, pagina],
    queryFn: () => listarEgresos({ q: busqueda || undefined, categoriaId: categoriaFiltro || undefined, pagina, porPagina: 25 }),
  });

  const crearEgr = useMutation({
    mutationFn: (v: { categoriaId?: number; fecha: string; monto: number; descripcion: string }) => crearEgreso(v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['egresos'] }); setModal(null); },
  });

  const editarEgr = useMutation({
    mutationFn: ({ id, v }: { id: number; v: { categoriaId?: number; fecha?: string; monto?: number; descripcion?: string; boletaRuta?: string } }) => actualizarEgreso(id, v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['egresos'] }); setModal(null); },
  });

  const eliminarEgr = useMutation({
    mutationFn: (id: number) => eliminarEgreso(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['egresos'] }); },
  });

  const subirBoleta = useMutation({
    mutationFn: ({ egresoId, archivo }: { egresoId: number; archivo: File }) => subirBoletaEgreso(egresoId, archivo),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['egresos'] }); setModal(null); setArchivoBoleta(null); setBoletError(null); },
    onError: (err) => { setBoletError(err instanceof ApiError ? err.message : 'Error subiendo boleta'); setSubiendoBoleta(false); },
  });

  const totalPaginasEgr = egresosData ? Math.max(1, Math.ceil(egresosData.total / egresosData.porPagina)) : 1;

  // ===== GASTOS FIJOS =====
  const { data: fijosData, isPending: fijosPending } = useQuery({
    queryKey: ['gastos-fijos', pagina],
    queryFn: () => listarGastosFijos({ pagina, porPagina: 25 }),
  });

  const crearFijo = useMutation({
    mutationFn: (v: { descripcion: string; monto: number; periodicidad: 'mensual' | 'trimestral' | 'semestral' | 'anual' }) => crearGastoFijo(v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos-fijos'] }); setModal(null); },
  });

  const editarFijo = useMutation({
    mutationFn: ({ id, v }: { id: number; v: { descripcion?: string; monto?: number; periodicidad?: 'mensual' | 'trimestral' | 'semestral' | 'anual'; activo?: boolean } }) => actualizarGastoFijo(id, v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos-fijos'] }); setModal(null); },
  });

  const eliminarFijo = useMutation({
    mutationFn: (id: number) => eliminarGastoFijo(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['gastos-fijos'] }); },
  });

  const totalPaginasFijos = fijosData ? Math.max(1, Math.ceil(fijosData.total / fijosData.porPagina)) : 1;

  // ===== OTROS INGRESOS =====
  const { data: ingresosData, isPending: ingPending } = useQuery({
    queryKey: ['otros-ingresos', busqueda, pagina],
    queryFn: () => listarOtrosIngresos({ q: busqueda || undefined, pagina, porPagina: 25 }),
  });

  const crearIng = useMutation({
    mutationFn: (v: { fecha: string; monto: number; descripcion: string; origen?: string }) => crearOtroIngreso(v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['otros-ingresos'] }); setModal(null); },
  });

  const editarIng = useMutation({
    mutationFn: ({ id, v }: { id: number; v: { fecha?: string; monto?: number; descripcion?: string; origen?: string } }) => actualizarOtroIngreso(id, v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['otros-ingresos'] }); setModal(null); },
  });

  const eliminarIng = useMutation({
    mutationFn: (id: number) => eliminarOtroIngreso(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['otros-ingresos'] }); },
  });

  const totalPaginasIng = ingresosData ? Math.max(1, Math.ceil(ingresosData.total / ingresosData.porPagina)) : 1;

  // ===== RENDER =====
  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Gastos e Ingresos</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Egresos, categorías, gastos fijos y otros ingresos
          </p>
        </div>
        {tab === 'categorias' && (
          <button onClick={() => setModal({ tipo: 'categoria', modo: 'crear' })} className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold">
            Nueva categoría
          </button>
        )}
        {tab === 'egresos' && (
          <button onClick={() => setModal({ tipo: 'egreso', modo: 'crear' })} className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold">
            Nuevo egreso
          </button>
        )}
        {tab === 'fijos' && (
          <button onClick={() => setModal({ tipo: 'fijo', modo: 'crear' })} className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold">
            Nuevo gasto fijo
          </button>
        )}
        {tab === 'ingresos' && (
          <button onClick={() => setModal({ tipo: 'ingreso', modo: 'crear' })} className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold">
            Nuevo ingreso
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-border" role="tablist">
        {[
          { key: 'categorias', label: 'Categorías' },
          { key: 'egresos', label: 'Egresos' },
          { key: 'fijos', label: 'Gastos fijos' },
          { key: 'ingresos', label: 'Otros ingresos' },
        ].map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => { setTab(t.key as TabKey); setPagina(1); setBusqueda(''); }}
            className={`px-4 py-2 text-[13px] font-medium rounded-t-lg border-b-2 transition-colors ${
              tab === t.key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido por tab */}
      {tab === 'categorias' && <CategoriasTab
        categorias={categorias}
        isPending={catPending}
        crear={crearCat}
        editar={editarCat}
        eliminar={eliminarCat}
        modal={modal}
        setModal={setModal}
      />}

      {tab === 'egresos' && <EgresosTab
        data={egresosData}
        isPending={egrPending}
        isError={egrError}
        totalPaginas={totalPaginasEgr}
        pagina={pagina}
        setPagina={setPagina}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        categoriaFiltro={categoriaFiltro}
        setCategoriaFiltro={setCategoriaFiltro}
        categorias={categorias}
        crear={crearEgr}
        editar={editarEgr}
        eliminar={eliminarEgr}
        subirBoleta={subirBoleta}
        modal={modal}
        setModal={setModal}
        archivoBoleta={archivoBoleta}
        setArchivoBoleta={setArchivoBoleta}
        subiendoBoleta={subiendoBoleta}
        setSubiendoBoleta={setSubiendoBoleta}
        boletaError={boletaError}
        setBoletError={setBoletError}
      />}

      {tab === 'fijos' && <FijosTab
        data={fijosData}
        isPending={fijosPending}
        totalPaginas={totalPaginasFijos}
        pagina={pagina}
        setPagina={setPagina}
        crear={crearFijo}
        editar={editarFijo}
        eliminar={eliminarFijo}
        modal={modal}
        setModal={setModal}
      />}

      {tab === 'ingresos' && <IngresosTab
        data={ingresosData}
        isPending={ingPending}
        totalPaginas={totalPaginasIng}
        pagina={pagina}
        setPagina={setPagina}
        busqueda={busqueda}
        setBusqueda={setBusqueda}
        crear={crearIng}
        editar={editarIng}
        eliminar={eliminarIng}
        modal={modal}
        setModal={setModal}
      />}

      {/* Modal genérico */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setModal(null)}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-bold tracking-tight">
                {modal.tipo === 'categoria' ? 'Categoría' : modal.tipo === 'egreso' ? 'Egreso' : modal.tipo === 'fijo' ? 'Gasto fijo' : 'Ingreso'}
              </h2>
              <button
                onClick={() => setModal(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25"
              >
                ✕
              </button>
            </div>
            {modal.tipo === 'categoria' && <CategoriaForm
              modo={modal.modo}
              initial={modal.data}
              submitLabel={modal.modo === 'crear' ? (crearCat.isPending ? 'Creando…' : 'Crear categoría') : (editarCat.isPending ? 'Guardando…' : 'Guardar cambios')}
              onCancel={() => setModal(null)}
              onSubmit={async (v: string) => { if (modal.modo === 'crear') await crearCat.mutateAsync(v); else await editarCat.mutateAsync({ id: modal.data!.id, nombre: v }); }}
            />}

            {modal.tipo === 'egreso' && <EgresoForm
              modo={modal.modo}
              initial={modal.data}
              categorias={categorias}
              submitLabel={
                modal.modo === 'boleta' ? (subiendoBoleta ? 'Subiendo…' : 'Subir boleta')
                : modal.modo === 'crear' ? (crearEgr.isPending ? 'Creando…' : 'Crear egreso')
                : (editarEgr.isPending ? 'Guardando…' : 'Guardar cambios')
              }
              onCancel={() => { setModal(null); setArchivoBoleta(null); setBoletError(null); }}
              onSubmit={async (v: any) => {
                if (modal.modo === 'crear') await crearEgr.mutateAsync(v);
                else if (modal.modo === 'editar') await editarEgr.mutateAsync({ id: modal.data!.id, v });
                else if (modal.modo === 'boleta' && modal.data && archivoBoleta) await subirBoleta.mutateAsync({ egresoId: modal.data.id, archivo: archivoBoleta });
              }}
              onFileChange={setArchivoBoleta}
              subiendo={subiendoBoleta}
              error={boletaError}
              archivo={archivoBoleta}
            />}

            {modal.tipo === 'fijo' && <FijoForm
              modo={modal.modo}
              initial={modal.data}
              submitLabel={modal.modo === 'crear' ? (crearFijo.isPending ? 'Creando…' : 'Crear gasto fijo') : (editarFijo.isPending ? 'Guardando…' : 'Guardar cambios')}
              onCancel={() => setModal(null)}
              onSubmit={async (v: any) => { if (modal.modo === 'crear') await crearFijo.mutateAsync(v); else await editarFijo.mutateAsync({ id: modal.data!.id, v }); }}
            />}

            {modal.tipo === 'ingreso' && <IngresoForm
              modo={modal.modo}
              initial={modal.data}
              submitLabel={modal.modo === 'crear' ? (crearIng.isPending ? 'Creando…' : 'Crear ingreso') : (editarIng.isPending ? 'Guardando…' : 'Guardar cambios')}
              onCancel={() => setModal(null)}
              onSubmit={async (v: any) => { if (modal.modo === 'crear') await crearIng.mutateAsync(v); else await editarIng.mutateAsync({ id: modal.data!.id, v }); }}
            />}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Componentes internos ==========

function Badge({ value, color = 'secondary' }: { value: string; color?: string }) {
  const colores: Record<string, string> = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    secondary: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${colores[color]}`}>
      {value}
    </span>
  );
}

// ---- Categorías Tab ----
function CategoriasTab({ categorias, isPending, eliminar, setModal }: any) {
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {isPending ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando categorías…</div>
      ) : categorias && categorias.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">
          No hay categorías. Use «Nueva categoría» para crear la primera.
        </div>
      ) : (
        <table className="w-full text-[13px]">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {categorias?.map((c: any) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                <td className="px-4 py-3">{c.nombre}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setModal({ tipo: 'categoria', modo: 'editar', data: c })}
                      className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => eliminar.mutate(c.id)}
                      disabled={eliminar.isPending}
                      className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1 disabled:opacity-50"
                    >
                      Eliminar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---- Egresos Tab ----
function EgresosTab(props: any) {
  const { data, isPending, isError, totalPaginas, pagina, setPagina, busqueda, setBusqueda,
    categoriaFiltro, setCategoriaFiltro, categorias, eliminar, setModal } = props;

  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {/* Filtros */}
      <div className="p-4 border-b border-border flex flex-wrap gap-3">
        <div className="flex-1 min-w-[200px] relative">
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Buscar por descripción…"
            className="w-full pl-[34px] pr-3 py-[9px] border border-input rounded-lg bg-background text-[13px]"
          />
          <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
        </div>
        <select
          value={categoriaFiltro}
          onChange={(e) => { setCategoriaFiltro(e.target.value === '' ? '' : Number(e.target.value)); setPagina(1); }}
          className="px-3 py-[9px] border border-input rounded-lg bg-card text-[13px] min-w-[180px]"
        >
          <option value="">Todas las categorías</option>
          {categorias?.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
      </div>

      {/* Tabla */}
      <div className="overflow-x-auto">
        {isPending ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando egresos…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[13px] text-primary">No se pudieron cargar los egresos.</div>
        ) : data && data.filas.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            No hay egresos que coincidan con la búsqueda.
          </div>
        ) : (
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Categoría</th>
                <th className="px-3 py-2 font-semibold">Descripción</th>
                <th className="px-3 py-2 font-semibold text-right">Monto</th>
                <th className="px-3 py-2 font-semibold">Boleta</th>
                <th className="px-3 py-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.filas.map((e: any) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-3 py-2 font-mono">{formatFecha(e.fecha)}</td>
                  <td className="px-3 py-2">{e.categoriaNombre ?? 'Sin categoría'}</td>
                  <td className="px-3 py-2 max-w-[300px] truncate">{e.descripcion}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatClp(e.monto)}</td>
                  <td className="px-3 py-2">
                    {e.boletaRuta ? (
                      <button
                        onClick={() => window.open(urlBoletaEgreso(e.boletaRuta.split('/').pop()?.split('.')[0] || ''), '_blank')}
                        className="text-[12px] font-medium text-primary hover:underline"
                      >
                        Ver
                      </button>
                    ) : (
                      <span className="text-[12px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setModal({ tipo: 'egreso', modo: 'editar', data: e })}
                        className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                      >
                        Editar
                      </button>
                      {!e.boletaRuta && (
                        <button
                          onClick={() => setModal({ tipo: 'egreso', modo: 'boleta', data: e })}
                          className="text-[12px] font-medium text-primary/80 hover:text-primary border border-border rounded-md px-2 py-1"
                        >
                          Subir boleta
                        </button>
                      )}
                      <button
                        onClick={() => eliminar.mutate(e.id)}
                        disabled={eliminar.isPending}
                        className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1 disabled:opacity-50"
                      >
                        Eliminar
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
        <div className="flex items-center justify-between p-4 border-t border-border text-[12.5px] text-muted-foreground">
          <span>Página {data.pagina} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina((p: number) => p - 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Anterior</button>
            <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p: number) => p + 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Gastos Fijos Tab ----
function FijosTab({ data, isPending, totalPaginas, pagina, setPagina, eliminar, setModal }: any) {
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {isPending ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando gastos fijos…</div>
      ) : data && data.filas.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">
          No hay gastos fijos. Use «Nuevo gasto fijo» para crear el primero.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-semibold">Descripción</th>
                <th className="px-3 py-2 font-semibold text-right">Monto</th>
                <th className="px-3 py-2 font-semibold">Periodicidad</th>
                <th className="px-3 py-2 font-semibold">Mensual</th>
                <th className="px-3 py-2 font-semibold">Estado</th>
                <th className="px-3 py-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.filas.map((g: any) => {
                const mensual = g.monto / (g.periodicidad === 'mensual' ? 1 : g.periodicidad === 'trimestral' ? 3 : g.periodicidad === 'semestral' ? 6 : 12);
                return (
                  <tr key={g.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2">{g.descripcion}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(g.monto)}</td>
                    <td className="px-3 py-2">{g.periodicidad}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(mensual)}</td>
                    <td className="px-3 py-2">
                      <Badge value={g.activo === 1 ? 'Activo' : 'Inactivo'} color={g.activo === 1 ? 'success' : 'secondary'} />
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button onClick={() => setModal({ tipo: 'fijo', modo: 'editar', data: g })} className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1">Editar</button>
                        <button onClick={() => eliminar.mutate(g.id)} disabled={eliminar.isPending} className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1 disabled:opacity-50">Eliminar</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between p-4 border-t border-border text-[12.5px] text-muted-foreground">
          <span>Página {data.pagina} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina((p: number) => p - 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Anterior</button>
            <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p: number) => p + 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Otros Ingresos Tab ----
function IngresosTab({ data, isPending, totalPaginas, pagina, setPagina, busqueda, setBusqueda, eliminar, setModal }: any) {
  return (
    <div className="bg-card border border-border rounded-[10px] overflow-hidden">
      {/* Búsqueda */}
      <div className="p-4 border-b border-border">
        <div className="max-w-[420px] relative">
          <input
            value={busqueda}
            onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
            placeholder="Buscar por descripción u origen…"
            className="w-full pl-[34px] pr-3 py-[9px] border border-input rounded-lg bg-card text-[13px]"
          />
          <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
        </div>
      </div>

      {isPending ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando ingresos…</div>
      ) : data && data.filas.length === 0 ? (
        <div className="p-10 text-center text-[13px] text-muted-foreground">
          No hay otros ingresos registrados.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-3 py-2 font-semibold">Fecha</th>
                <th className="px-3 py-2 font-semibold">Descripción</th>
                <th className="px-3 py-2 font-semibold">Origen</th>
                <th className="px-3 py-2 font-semibold text-right">Monto</th>
                <th className="px-3 py-2 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data?.filas.map((i: any) => (
                <tr key={i.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-3 py-2 font-mono">{formatFecha(i.fecha)}</td>
                  <td className="px-3 py-2">{i.descripcion}</td>
                  <td className="px-3 py-2 text-muted-foreground">{i.origen ?? '—'}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatClp(i.monto)}</td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => setModal({ tipo: 'ingreso', modo: 'editar', data: i })} className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1">Editar</button>
                      <button onClick={() => eliminar.mutate(i.id)} disabled={eliminar.isPending} className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1 disabled:opacity-50">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data && data.total > 0 && (
        <div className="flex items-center justify-between p-4 border-t border-border text-[12.5px] text-muted-foreground">
          <span>Página {data.pagina} de {totalPaginas}</span>
          <div className="flex gap-2">
            <button disabled={pagina <= 1} onClick={() => setPagina((p: number) => p - 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Anterior</button>
            <button disabled={pagina >= totalPaginas} onClick={() => setPagina((p: number) => p + 1)} className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground">Siguiente</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Formularios ----
function CategoriaForm({ modo, initial, submitLabel, onCancel, onSubmit }: any) {
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const valido = nombre.trim().length > 0;
  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">{modo === 'crear' ? 'Nueva categoría' : 'Editar categoría'}</h2>
      <div className="mb-4">
        <label htmlFor="nombre" className="block text-[12px] font-semibold mb-1.5">Nombre</label>
        <input id="nombre" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Servicios, Arriendo, Materiales…" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={80} />
      </div>
      <div className="flex items-center gap-3 justify-end">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit(nombre)} disabled={!valido} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}

function EgresoForm({ modo, initial, categorias, submitLabel, onCancel, onSubmit, onFileChange, subiendo, error, archivo }: any) {
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId ?? '');
  const [fecha, setFecha] = useState(initial?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState(initial?.monto ?? 0);
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');

  const valido = fecha && monto > 0 && descripcion.trim();

  if (modo === 'boleta') {
    return (
      <div>
        <h2 className="text-[17px] font-bold tracking-tight mb-5">Subir boleta</h2>
        <p className="text-[13px] text-muted-foreground mb-4">Egreso: {initial?.descripcion} · {formatClp(initial?.monto)}</p>
        {error && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">{error}</div>}
        <div className="mb-4">
          <label className="block text-[12px] font-semibold mb-1.5">Archivo (PDF, PNG, JPEG máx 5 MB)</label>
          <input type="file" accept="application/pdf,image/png,image/jpeg" onChange={e => onFileChange(e.target.files?.[0] ?? null)} disabled={subiendo} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" />
        </div>
        {subiendo && <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />Subiendo boleta…</div>}
        <div className="flex items-center gap-3 justify-end mt-6">
          <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
          <button onClick={() => onSubmit({})} disabled={subiendo || !archivo} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">{modo === 'crear' ? 'Nuevo egreso' : 'Editar egreso'}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="categoria" className="block text-[12px] font-semibold mb-1.5">Categoría (opcional)</label>
          <select id="categoria" value={categoriaId} onChange={e => setCategoriaId(e.target.value || '')} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]">
            <option value="">Sin categoría</option>
            {categorias?.map((c: any) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="fecha" className="block text-[12px] font-semibold mb-1.5">Fecha</label>
          <input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
        </div>
        <div>
          <label htmlFor="monto" className="block text-[12px] font-semibold mb-1.5">Monto (CLP)</label>
          <input id="monto" type="number" min={1} value={monto} onChange={e => setMonto(Number(e.target.value))} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="descripcion" className="block text-[12px] font-semibold mb-1.5">Descripción</label>
          <input id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Concepto del gasto" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={255} />
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit({ categoriaId: categoriaId ? Number(categoriaId) : undefined, fecha, monto, descripcion })} disabled={!valido} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}

function FijoForm({ modo, initial, submitLabel, onCancel, onSubmit }: any) {
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [monto, setMonto] = useState(initial?.monto ?? 0);
  const [periodicidad, setPeriodicidad] = useState<'mensual' | 'trimestral' | 'semestral' | 'anual'>(initial?.periodicidad ?? 'mensual');
  const [activo, setActivo] = useState(initial?.activo !== undefined ? initial.activo === 1 : true);
  const valido = descripcion.trim() && monto > 0;

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">{modo === 'crear' ? 'Nuevo gasto fijo' : 'Editar gasto fijo'}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="descripcion" className="block text-[12px] font-semibold mb-1.5">Descripción</label>
          <input id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Arriendo sede, Suscripción software…" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={160} />
        </div>
        <div>
          <label htmlFor="monto" className="block text-[12px] font-semibold mb-1.5">Monto (CLP)</label>
          <input id="monto" type="number" min={1} value={monto} onChange={e => setMonto(Number(e.target.value))} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
        </div>
        <div>
          <label htmlFor="periodicidad" className="block text-[12px] font-semibold mb-1.5">Periodicidad</label>
          <select id="periodicidad" value={periodicidad} onChange={e => setPeriodicidad(e.target.value as any)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]">
            <option value="mensual">Mensual</option>
            <option value="trimestral">Trimestral</option>
            <option value="semestral">Semestral</option>
            <option value="anual">Anual</option>
          </select>
        </div>
        <div>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={activo} onChange={e => setActivo(e.target.checked)} className="w-4 h-4 rounded border-border text-primary focus:ring-primary" />
            <span className="text-[13px] font-medium">Activo</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit({ descripcion, monto, periodicidad, activo: activo ? 1 : 0 })} disabled={!valido} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}

function IngresoForm({ modo, initial, submitLabel, onCancel, onSubmit }: any) {
  const [fecha, setFecha] = useState(initial?.fecha?.slice(0, 10) ?? new Date().toISOString().slice(0, 10));
  const [monto, setMonto] = useState(initial?.monto ?? 0);
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? '');
  const [origen, setOrigen] = useState(initial?.origen ?? '');
  const valido = fecha && monto > 0 && descripcion.trim();

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">{modo === 'crear' ? 'Nuevo ingreso' : 'Editar ingreso'}</h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="fecha" className="block text-[12px] font-semibold mb-1.5">Fecha</label>
          <input id="fecha" type="date" value={fecha} onChange={e => setFecha(e.target.value)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
        </div>
        <div>
          <label htmlFor="monto" className="block text-[12px] font-semibold mb-1.5">Monto (CLP)</label>
          <input id="monto" type="number" min={1} value={monto} onChange={e => setMonto(Number(e.target.value))} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="descripcion" className="block text-[12px] font-semibold mb-1.5">Descripción</label>
          <input id="descripcion" value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Ej: Rifa, Donación, Venta camisetas…" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={255} />
        </div>
        <div>
          <label htmlFor="origen" className="block text-[12px] font-semibold mb-1.5">Origen (opcional)</label>
          <input id="origen" value={origen} onChange={e => setOrigen(e.target.value)} placeholder="Ej: Rifa julio, Socio #123" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={60} />
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit({ fecha, monto, descripcion, origen: origen || undefined })} disabled={!valido} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}