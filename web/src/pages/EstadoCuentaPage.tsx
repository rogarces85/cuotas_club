import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listarMorosos } from '../lib/api';

/**
 * Página Estado de cuenta (M3): lista de socios con deuda pendiente
 * y detalle por socio (períodos adeudados).
 */



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

export default function EstadoCuentaPage() {
  const [busqueda, setBusqueda] = useState('');
  const [abierto, setAbierto] = useState<number | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['morosos'],
    queryFn: listarMorosos,
  });

  const morososFiltrados = data?.filter((m) =>
    m.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    m.rut.includes(busqueda.replace(/\D/g, '')) ||
    m.periodos.some((p) => p.periodo.includes(busqueda))
  ) ?? [];

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Estado de cuenta</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Socios con cuotas pendientes · {data ? data.length : 0} con deuda
          </p>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="mb-4">
        <div className="max-w-[420px] relative">
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, RUT o período…"
            className="w-full pl-[34px] pr-3 py-[9px] border border-input rounded-lg bg-card text-[13px]"
          />
          <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">⌕</span>
        </div>
      </div>

      {/* Lista de morosos */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        {isPending ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">Calculando morosidad…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[13px] text-primary">No se pudo cargar el estado de cuenta.</div>
        ) : morososFiltrados.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            {busqueda ? 'No hay coincidencias para la búsqueda.' : 'No hay socios con deuda pendiente.'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {morososFiltrados.map((m) => (
              <div key={m.socioId}>
                <button
                  onClick={() => setAbierto(abierto === m.socioId ? null : m.socioId)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-secondary/40"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 grid place-items-center text-[12px] font-bold text-primary">
                      {m.nombre.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-[13px]">{m.nombre}</div>
                      <div className="text-[11.5px] text-muted-foreground font-mono">{m.rut}</div>
                    </div>
                    <Badge value={m.estado} />
                  </div>
                  <div className="flex items-center gap-4 text-right min-w-[200px]">
                    <div className="text-[12.5px] text-muted-foreground">
                      {m.totalDeuda} período{m.totalDeuda === 1 ? '' : 's'} pendiente{m.totalDeuda === 1 ? '' : 's'}
                    </div>
                    <span className="text-[11px] text-muted-foreground">
                      {abierto === m.socioId ? '▲' : '▼'}
                    </span>
                  </div>
                </button>
                {abierto === m.socioId && (
                  <div className="px-4 pb-4 bg-muted/30">
                    <div className="overflow-x-auto">
                      <table className="w-full text-[12.5px]">
                        <thead>
                          <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                            <th className="px-3 py-2 font-semibold">Período</th>
                            <th className="px-3 py-2 font-semibold text-right">Vence el día</th>
                            <th className="px-3 py-2 font-semibold">Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {m.periodos.map((p) => (
                            <tr key={p.periodo} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 font-mono">{p.periodo}</td>
                              <td className="px-3 py-2 text-right">{p.diaVencimiento}</td>
                              <td className="px-3 py-2">
                                <span className="inline-block px-2 py-0.5 rounded text-[10.5px] font-semibold bg-warning/10 text-warning">
                                  Pendiente
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3 pt-3 border-t border-border text-right text-[13px] font-medium">
                      Total períodos adeudados: <span className="font-mono text-primary ml-2">{m.totalDeuda}</span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {data && data.length > 0 && morososFiltrados.length > 0 && (
        <div className="mt-5 p-4 bg-card border border-border rounded-[10px] text-center text-[12.5px]">
          <strong>Total de socios con deuda:</strong>{' '}
          <span className="font-mono text-primary ml-2">{morososFiltrados.length}</span>
          {busqueda && (
            <span className="ml-4 text-muted-foreground">(filtrado de {data.length})</span>
          )}
        </div>
      )}
    </div>
  );
}