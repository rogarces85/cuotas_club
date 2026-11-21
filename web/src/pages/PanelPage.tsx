import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  obtenerKPIs,
  obtenerRecaudacion,
  obtenerUltimosPagos,
  obtenerMeta,
  obtenerResumenPanel,
  type PanelKPIs,
  type PanelRecaudacion,
  type PanelUltimosPagos,
  type PanelMeta,
  type PanelResumen,
} from '../lib/api';

/**
 * Página Panel / Dashboard (M5): KPIs principales, gráfico de recaudación
 * (últimos 6 meses), últimos pagos aprobados y meta del mes.
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
const formatPeriodo = (p: string) => {
  // p es AAAA-MM -> mostrar "Mes YYYY"
  const [anio, mes] = p.split('-');
  const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  return `${meses[Number(mes) - 1]} ${anio}`;
};

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

/** Gráfico de barras SVG simple para la serie de recaudación mensual */
function RecaudacionChart({ serie }: { serie: { periodo: string; monto: number }[] }) {
  if (serie.length === 0) return null;

  const maxMonto = Math.max(...serie.map((s) => s.monto), 1);
  const barHeight = 140;
  const barWidth = 34;

  return (
    <div className="bg-card border border-border rounded-[10px] p-5 mb-5">
      <h2 className="text-[14px] font-semibold mb-4">Recaudación — últimos 6 meses</h2>
      <div className="flex items-end gap-2 h-[140px] px-4">
        {serie.map((s) => {
          const altura = Math.max(6, (s.monto / maxMonto) * barHeight);
          const color = s.monto > 0 ? '#DF022F' : '#9ca3af';
          return (
            <div key={s.periodo} className="flex flex-col items-center gap-1">
              <svg
                width={barWidth}
                height={barHeight}
                className="block"
                viewBox={`0 0 ${barWidth} ${barHeight}`}
              >
                <rect
                  x={0}
                  y={barHeight - altura}
                  width={barWidth}
                  height={altura}
                  fill={color}
                  rx={2}
                />
              </svg>
              <span className="text-[10px] text-muted-foreground leading-none">
                {formatPeriodo(s.periodo)}
              </span>
              <span className="text-[10px] font-mono font-semibold">{formatClp(s.monto)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PanelPage() {
  const queryClient = useQueryClient();

  // KPIs
  const { data: kpis, isPending: kpisPending } = useQuery({
    queryKey: ['panel-kpis'],
    queryFn: () => obtenerKPIs(),
  });

  // Serie de recaudación
  const { data: recaudacion, isPending: recPending } = useQuery({
    queryKey: ['panel-recaudacion'],
    queryFn: () => obtenerRecaudacion(),
  });

  // Últimos pagos
  const { data: ultimosPagos, isPending: pagosPending } = useQuery({
    queryKey: ['panel-ultimos-pagos'],
    queryFn: () => obtenerUltimosPagos(),
  });

  // Meta del mes
  const { data: meta, isPending: metaPending } = useQuery({
    queryKey: ['panel-meta'],
    queryFn: () => obtenerMeta(),
  });

  // Resumen financiero
  const { data: resumen, isPending: resPending } = useQuery({
    queryKey: ['panel-resumen'],
    queryFn: () => obtenerResumenPanel(),
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['panel'] });

  const kpisData = kpis as PanelKPIs | undefined;
  const recData = recaudacion as PanelRecaudacion | undefined;
  const pagosData = ultimosPagos as PanelUltimosPagos | undefined;
  const metaData = meta as PanelMeta | undefined;
  const resumenData = resumen as PanelResumen | undefined;

  const cargando = kpisPending || recPending || pagosPending || metaPending || resPending;

  return (
    <div>
      {/* Header con acción */}
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Panel</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Resumen de cobranza del club
          </p>
        </div>
        <button
          onClick={() => invalidar()}
          className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold"
        >
          Actualizar
        </button>
      </div>

      {cargando && (
        <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando panel…</div>
      )}

      {/* KPIs */}
      {kpisData && (
        <div className="grid gap-4 md:grid-cols-4 mb-5">
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Recaudado este mes</div>
            <div className="text-[24px] font-bold font-mono text-success">
              {formatClp(kpisData.recaudadoMes)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Socios morosos</div>
            <div className="text-[24px] font-bold font-mono text-destructive">
              {kpisData.sociosMorosos}
            </div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Socios activos</div>
            <div className="text-[24px] font-bold font-mono">{kpisData.sociosActivos}</div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-2">Comprobantes por revisar</div>
            <div className="text-[24px] font-bold font-mono text-warning">
              {kpisData.comprobantesPendientes}
            </div>
          </div>
        </div>
      )}

      {/* Gráfico de recaudación + Meta */}
      <div className="grid gap-4 md:grid-cols-3 mb-5">
        <RecaudacionChart serie={recData?.serie ?? []} />

        <div className="bg-card border border-border rounded-[10px] p-5">
          <h2 className="text-[14px] font-semibold mb-4">Meta del mes</h2>
          {metaData && (
            <div className="space-y-3">
              <div className="flex justify-between items-end">
                <span className="text-[12px] text-muted-foreground">Meta</span>
                <span className="text-[16px] font-mono font-bold">{formatClp(metaData.meta)}</span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[12px] text-muted-foreground">Recaudado</span>
                <span className="text-[16px] font-mono font-bold">{formatClp(metaData.recaudado)}</span>
              </div>
              <div className="flex justify-between items-end mb-3">
                <span className="text-[12px] text-muted-foreground">Faltante</span>
                <span className="text-[16px] font-mono font-bold">{formatClp(metaData.faltante)}</span>
              </div>
              <div className="w-full bg-secondary/30 rounded-full h-2 mb-1">
                <div
                  className={`h-2 rounded-full bg-primary ${metaData.porcentaje >= 100 ? 'bg-success' : ''}`}
                  style={{ width: `${Math.min(100, metaData.porcentaje)}%` }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground">
                {metaData.porcentaje}% de la meta
              </div>
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-[10px] p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-[14px] font-semibold mb-4">Saldo del mes</h2>
            {resumenData && (
              <div className="text-[24px] font-bold font-mono text-[length:24px]">
                {resumenData.saldo >= 0 ? '+' : ''}{formatClp(resumenData.saldo)}
              </div>
            )}
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Badge
              value={resumenData?.saldo ?? 0 >= 0 ? 'Positivo' : 'Negativo'}
              color={resumenData?.saldo ?? 0 >= 0 ? 'success' : 'destructive'}
            />
          </div>
        </div>
      </div>

      {/* Últimos pagos */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Últimos pagos aprobados</h2>
        </div>
        {pagosPending ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Cargando pagos…</div>
        ) : pagosData && pagosData.pagos.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            No hay pagos aprobados todavía.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">RUT</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                </tr>
              </thead>
              <tbody>
                {pagosData?.pagos.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{formatPeriodo(p.fechaPago)}</td>
                    <td className="px-3 py-2 font-mono">{p.rut}</td>
                    <td className="px-3 py-2">{p.nombreSnapshot}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(p.totalPago)}</td>
                    <td className="px-3 py-2"><Badge value={p.tipoCuota} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}