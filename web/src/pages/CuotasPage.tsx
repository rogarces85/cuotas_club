import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { listarPeriodos, crearPeriodo, obtenerDeuda, ApiError, type Deuda } from '../lib/api';

/**
 * Página de cuotas (M2): lista de períodos, creación de período y deuda
 * derivada (socios activos sin pago, con su monto por tipo).
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;

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
    </div>
  );
}
