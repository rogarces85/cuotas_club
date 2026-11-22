import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarPeriodos,
  crearPeriodo,
  obtenerDeuda,
  listarNivelesCuota,
  crearNivelCuota,
  actualizarNivelCuota,
  eliminarNivelCuota,
  ApiError,
  type Deuda,
  type NivelCuota,
  type NivelCuotaInput,
} from '../lib/api';

/**
 * Página de cuotas (M2): lista de períodos, creación de período y deuda
 * derivada. Incluye los niveles de cuota (monto de referencia por tipo).
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;

const TIPO_STYLES: Record<string, string> = {
  ACTIVO: 'bg-success/10 text-success',
  MEMBRESIA: 'bg-warning/10 text-warning',
  BECADO: 'bg-secondary text-muted-foreground',
  OTRO: 'bg-secondary text-muted-foreground',
};

function DeudaPanel({ periodoId }: { periodoId: number }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['deuda', periodoId],
    queryFn: () => obtenerDeuda(periodoId),
  });

  if (isPending) return <p className="text-[13px] text-muted-foreground py-3">Calculando deuda…</p>;
  if (isError) return <p className="text-[13px] text-primary py-3">No se pudo calcular la deuda.</p>;

  const deuda = data as Deuda;
  if (deuda.filas.length === 0) {
    return <p className="text-[13px] text-muted-foreground py-3">Sin deudores para este período.</p>;
  }

  return (
    <table className="w-full text-[12.5px] mt-2">
      <thead>
        <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
          <th className="py-2 font-semibold">RUT</th>
          <th className="py-2 font-semibold">Nombre</th>
          <th className="py-2 font-semibold">Tipo</th>
          <th className="py-2 font-semibold text-right">Monto</th>
        </tr>
      </thead>
      <tbody>
        {deuda.filas.map((f) => (
          <tr key={f.socioId} className="border-b border-border last:border-0">
            <td className="py-2 font-mono">{f.rut}</td>
            <td className="py-2">{f.nombre}</td>
            <td className="py-2">{f.tipo}</td>
            <td className="py-2 text-right font-mono">{formatClp(f.montoClp)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function CuotasPage() {
  const queryClient = useQueryClient();
  const [mes, setMes] = useState('');
  const [dia, setDia] = useState(10);
  const [abierto, setAbierto] = useState<number | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['periodos'],
    queryFn: listarPeriodos,
  });

  const crear = useMutation({
    mutationFn: (v: { periodo: string; diaVencimiento: number }) => crearPeriodo(v),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['periodos'] });
      setMes('');
    },
  });

  // ---- Niveles de cuota ----
  const [modalNivel, setModalNivel] = useState<
    { modo: 'crear' } | { modo: 'editar'; nivel: NivelCuota } | null
  >(null);

  const { data: niveles, isPending: nivelesPending } = useQuery({
    queryKey: ['niveles-cuota'],
    queryFn: listarNivelesCuota,
  });

  const invalidarNiveles = () => queryClient.invalidateQueries({ queryKey: ['niveles-cuota'] });

  const crearNivel = useMutation({
    mutationFn: (v: NivelCuotaInput) => crearNivelCuota(v),
    onSuccess: () => {
      invalidarNiveles();
      setModalNivel(null);
    },
  });

  const editarNivel = useMutation({
    mutationFn: ({ id, v }: { id: number; v: Partial<NivelCuotaInput> & { activo?: boolean } }) =>
      actualizarNivelCuota(id, v),
    onSuccess: () => {
      invalidarNiveles();
      setModalNivel(null);
    },
  });

  const borrarNivel = useMutation({
    mutationFn: (id: number) => eliminarNivelCuota(id),
    onSuccess: invalidarNiveles,
  });

  const nivelError =
    (crearNivel.error instanceof ApiError && crearNivel.error.message) ||
    (editarNivel.error instanceof ApiError && editarNivel.error.message) ||
    (borrarNivel.error instanceof ApiError && borrarNivel.error.message) ||
    null;

  const mesValido = /^\d{4}-(0[1-9]|1[0-2])$/.test(mes);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Cuotas</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Períodos de cobro y deuda derivada del padrón
          </p>
        </div>
      </div>

      {/* Formulario de nuevo período */}
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5">
        <h2 className="text-[14px] font-semibold mb-3">Nuevo período</h2>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label htmlFor="mes" className="block text-[12px] font-semibold mb-1.5">
              Mes (AAAA-MM)
            </label>
            <input
              id="mes"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              placeholder="2026-11"
              className="w-[140px] px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            />
          </div>
          <div>
            <label htmlFor="dia" className="block text-[12px] font-semibold mb-1.5">
              Vence el día
            </label>
            <input
              id="dia"
              type="number"
              min={1}
              max={31}
              value={dia}
              onChange={(e) => setDia(Number(e.target.value))}
              className="w-[80px] px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            />
          </div>
          <button
            onClick={() => crear.mutate({ periodo: mes, diaVencimiento: dia })}
            disabled={!mesValido || crear.isPending}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            {crear.isPending ? 'Creando…' : 'Crear período'}
          </button>
          {!mesValido && mes !== '' && (
            <span className="text-[12px] text-primary font-medium">Formato: AAAA-MM</span>
          )}
          {crear.error instanceof ApiError && (
            <span className="text-[12px] text-primary font-medium">{crear.error.message}</span>
          )}
        </div>
      </div>

      {/* Lista de períodos */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        {isPending ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Cargando períodos…</div>
        ) : isError ? (
          <div className="p-8 text-center text-[13px] text-primary">No se pudieron cargar los períodos.</div>
        ) : data && data.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            No hay períodos todavía. Crea el primero arriba.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {data?.map((p) => (
              <div key={p.id}>
                <button
                  onClick={() => setAbierto(abierto === p.id ? null : p.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/40"
                >
                  <span className="font-semibold text-[13.5px] font-mono">{p.periodo}</span>
                  <span className="text-[12.5px] text-muted-foreground">
                    Vence el {p.diaVencimiento} · {p.totalDeudores ?? 0} deudor{p.totalDeudores === 1 ? '' : 'es'}
                  </span>
                </button>
                {abierto === p.id && (
                  <div className="px-4 pb-3">
                    <DeudaPanel periodoId={p.id} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Niveles de cuota */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden mt-5">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-[14px] font-semibold">Niveles de cuota</h2>
            <p className="text-[12px] text-muted-foreground">
              Monto de referencia por tipo de socio
            </p>
          </div>
          <button
            onClick={() => setModalNivel({ modo: 'crear' })}
            className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-[12.5px] font-semibold"
          >
            Nuevo nivel
          </button>
        </div>

        {nivelError && (
          <div className="m-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
            {nivelError}
          </div>
        )}

        {nivelesPending ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Cargando niveles…</div>
        ) : niveles && niveles.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            No hay niveles configurados. Use «Nuevo nivel» para agregar el primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Código</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                  <th className="px-3 py-2 font-semibold">Estado</th>
                  <th className="px-3 py-2 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {niveles?.map((n) => (
                  <tr key={n.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{n.codigo}</td>
                    <td className="px-3 py-2">{n.nombre}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${TIPO_STYLES[n.tipo] ?? 'bg-secondary text-muted-foreground'}`}>
                        {n.tipo}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(n.montoClp)}</td>
                    <td className="px-3 py-2">
                      {n.activo === 1 ? (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-success/10 text-success">Activo</span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold bg-secondary text-muted-foreground">Inactivo</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setModalNivel({ modo: 'editar', nivel: n })}
                          className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => borrarNivel.mutate(n.id)}
                          disabled={borrarNivel.isPending}
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
          </div>
        )}
      </div>

      {modalNivel && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setModalNivel(null)}
        >
          <div
            className="w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[17px] font-bold tracking-tight">
                {modalNivel.modo === 'crear' ? 'Nivel de cuota' : 'Editar nivel de cuota'}
              </h2>
              <button
                onClick={() => setModalNivel(null)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25"
              >
                ✕
              </button>
            </div>
            <NivelForm
              initial={modalNivel.modo === 'editar' ? modalNivel.nivel : undefined}
              submitLabel={
                modalNivel.modo === 'crear'
                  ? crearNivel.isPending
                    ? 'Creando…'
                    : 'Crear nivel'
                  : editarNivel.isPending
                    ? 'Guardando…'
                    : 'Guardar cambios'
              }
              onCancel={() => setModalNivel(null)}
              onSubmit={async (v) => {
                if (modalNivel.modo === 'crear') await crearNivel.mutateAsync(v);
                else await editarNivel.mutateAsync({ id: modalNivel.nivel.id, v });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function NivelForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: NivelCuota;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: NivelCuotaInput & { activo?: boolean }) => Promise<void>;
}) {
  const [codigo, setCodigo] = useState(initial?.codigo ?? '');
  const [nombre, setNombre] = useState(initial?.nombre ?? '');
  const [montoClp, setMontoClp] = useState(initial?.montoClp ?? 0);
  const [tipo, setTipo] = useState<NivelCuota['tipo']>(initial?.tipo ?? 'ACTIVO');
  const [activo, setActivo] = useState(initial ? initial.activo === 1 : true);

  const valido = codigo.trim() && nombre.trim() && montoClp > 0;

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">
        {initial ? 'Editar nivel de cuota' : 'Nuevo nivel de cuota'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label htmlFor="codigo" className="block text-[12px] font-semibold mb-1.5">Código</label>
          <input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Ej: ADULTO"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono uppercase"
            maxLength={20}
          />
        </div>
        <div>
          <label htmlFor="tipo" className="block text-[12px] font-semibold mb-1.5">Tipo</label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value as NivelCuota['tipo'])}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          >
            <option value="ACTIVO">Activo</option>
            <option value="MEMBRESIA">Membresía</option>
            <option value="BECADO">Becado</option>
            <option value="OTRO">Otro</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label htmlFor="nombre" className="block text-[12px] font-semibold mb-1.5">Nombre</label>
          <input
            id="nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej: Socio activo adulto"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="monto" className="block text-[12px] font-semibold mb-1.5">Monto (CLP)</label>
          <input
            id="monto"
            type="number"
            min={0}
            value={montoClp}
            onChange={(e) => setMontoClp(Number(e.target.value))}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
          />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-[13px] font-medium">Activo</span>
          </label>
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSubmit({ codigo, nombre, montoClp, tipo, ...(initial ? { activo } : {}) })}
          disabled={!valido}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
