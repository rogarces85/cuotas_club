import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  obtenerBalance,
  descargarBalanceXLSX,
  descargarBalancePDF,
  ApiError,
  type BalanceResumen,
} from '../lib/api';

/**
 * Página Reportes (M5): balance del período con exportación XLSX/PDF.
 */

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
const formatFecha = (s: string) => {
  const [a, m, d] = s.split('-');
  return `${d}-${m}-${a}`;
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

export default function ReportesPage() {
  const [periodo, setPeriodo] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ['balance', periodo, desde, hasta],
    queryFn: () => obtenerBalance({ periodo: periodo || undefined, desde: desde || undefined, hasta: hasta || undefined, formato: 'json' }),
    enabled: !!(periodo || (desde && hasta)),
    retry: false,
  });

  const descargarXLSX = useMutation({
    mutationFn: () => descargarBalanceXLSX({ periodo: periodo || undefined, desde: desde || undefined, hasta: hasta || undefined }),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balance-${periodo || `${desde}-${hasta}`}.xlsx`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error descargando XLSX'),
  });

  const descargarPDF = useMutation({
    mutationFn: () => descargarBalancePDF({ periodo: periodo || undefined, desde: desde || undefined, hasta: hasta || undefined }),
    onSuccess: (blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `balance-${periodo || `${desde}-${hasta}`}.pdf`;
      a.click();
      window.URL.revokeObjectURL(url);
    },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error descargando PDF'),
  });

  const handleGenerar = () => {
    if (!periodo && !(desde && hasta)) {
      setError('Debe especificar un período (AAAA-MM) o rango desde/hasta');
      return;
    }
    setError(null);
    refetch();
  };

  const handleDescargarXLSX = () => {
    if (!periodo && !(desde && hasta)) {
      setError('Debe especificar un período o rango');
      return;
    }
    setError(null);
    descargarXLSX.mutate();
  };

  const handleDescargarPDF = () => {
    if (!periodo && !(desde && hasta)) {
      setError('Debe especificar un período o rango');
      return;
    }
    setError(null);
    descargarPDF.mutate();
  };

  const balance = data as BalanceResumen | undefined;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Reportes</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Balance financiero con exportación a Excel y PDF
          </p>
        </div>
      </div>

      {/* Formulario de parámetros */}
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5">
        <h2 className="text-[14px] font-semibold mb-4">Parámetros del reporte</h2>
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label htmlFor="periodo" className="block text-[12px] font-semibold mb-1.5">
              Período (AAAA-MM)
            </label>
            <input
              id="periodo"
              type="month"
              value={periodo}
              onChange={(e) => { setPeriodo(e.target.value); setDesde(''); setHasta(''); }}
              className="w-[160px] px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            />
          </div>
          <div>
            <label htmlFor="desde" className="block text-[12px] font-semibold mb-1.5">
              Desde (AAAA-MM-DD)
            </label>
            <input
              id="desde"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPeriodo(''); }}
              className="w-[160px] px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            />
          </div>
          <div>
            <label htmlFor="hasta" className="block text-[12px] font-semibold mb-1.5">
              Hasta (AAAA-MM-DD)
            </label>
            <input
              id="hasta"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPeriodo(''); }}
              className="w-[160px] px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            />
          </div>
          <button
            onClick={handleGenerar}
            disabled={isPending || (!periodo && !(desde && hasta))}
            className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
          >
            {isPending ? 'Generando…' : 'Generar reporte'}
          </button>
        </div>
        {error && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
            {error}
          </div>
        )}
      </div>

      {/* Resumen del balance */}
      {balance && (
        <div className="grid gap-4 md:grid-cols-4 mb-5">
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">Total Ingresos</div>
            <div className="text-[22px] font-bold font-mono text-success">{formatClp(balance.ingresos.total)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Pagos: {formatClp(balance.ingresos.pagosAprobados)} · Otros: {formatClp(balance.ingresos.otrosIngresos)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">Total Egresos</div>
            <div className="text-[22px] font-bold font-mono text-destructive">{formatClp(balance.egresos.total)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Variables: {formatClp(balance.egresos.variables)} · Fijos: {formatClp(balance.egresos.fijosMensuales)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">Saldo</div>
            <div className={`text-[22px] font-bold font-mono ${balance.saldo >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatClp(balance.saldo)}
            </div>
          </div>
          <div className="bg-card border border-border rounded-[10px] p-4 flex items-end">
            <div className="flex gap-2">
              <button
                onClick={handleDescargarXLSX}
                disabled={descargarXLSX.isPending}
                className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2 text-[12.5px] font-semibold border border-border disabled:opacity-50"
              >
                {descargarXLSX.isPending ? 'Generando XLSX…' : '⬇ Excel'}
              </button>
              <button
                onClick={handleDescargarPDF}
                disabled={descargarPDF.isPending}
                className="bg-secondary text-secondary-foreground rounded-lg px-4 py-2 text-[12.5px] font-semibold border border-border disabled:opacity-50"
              >
                {descargarPDF.isPending ? 'Generando PDF…' : '⬇ PDF'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle - Pagos */}
      {balance && balance.detalle.pagos.length > 0 && (
        <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Pagos aprobados ({balance.detalle.pagos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">RUT</th>
                  <th className="px-3 py-2 font-semibold">Nombre</th>
                  <th className="px-3 py-2 font-semibold">Tipo</th>
                  <th className="px-3 py-2 font-semibold">Meses</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {balance.detalle.pagos.map((p) => (
                  <tr key={p.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{formatFecha(p.fecha)}</td>
                    <td className="px-3 py-2 font-mono">{p.rut}</td>
                    <td className="px-3 py-2">{p.nombre}</td>
                    <td className="px-3 py-2"><Badge value={p.tipo} /></td>
                    <td className="px-3 py-2">{p.meses ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(p.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle - Egresos */}
      {balance && balance.detalle.egresos.length > 0 && (
        <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h3 className="text-[14px] font-semibold">Egresos ({balance.detalle.egresos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Categoría</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 font-semibold">Boleta</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {balance.detalle.egresos.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{formatFecha(e.fecha)}</td>
                    <td className="px-3 py-2">{e.categoria ?? 'Sin categoría'}</td>
                    <td className="px-3 py-2 max-w-[300px] truncate">{e.descripcion}</td>
                    <td className="px-3 py-2 text-center">
                      {e.tieneBoleta ? <Badge value="Sí" color="success" /> : <span className="text-muted-foreground">No</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(e.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle - Otros Ingresos */}
      {balance && balance.detalle.otrosIngresos.length > 0 && (
        <div className="bg-card border border-border rounded-[10px] overflow-hidden mb-5">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[14px] font-semibold">Otros ingresos ({balance.detalle.otrosIngresos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 font-semibold">Origen</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                </tr>
              </thead>
              <tbody>
                {balance.detalle.otrosIngresos.map((o) => (
                  <tr key={o.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{formatFecha(o.fecha)}</td>
                    <td className="px-3 py-2">{o.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.origen ?? '—'}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(o.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detalle - Gastos Fijos */}
      {balance && balance.detalle.gastosFijos.length > 0 && (
        <div className="bg-card border border-border rounded-[10px] overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-[14px] font-semibold">Gastos fijos ({balance.detalle.gastosFijos.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 font-semibold">Monto original</th>
                  <th className="px-3 py-2 font-semibold">Mensual</th>
                  <th className="px-3 py-2 font-semibold">Periodicidad</th>
                </tr>
              </thead>
              <tbody>
                {balance.detalle.gastosFijos.map((g) => (
                  <tr key={g.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2">{g.descripcion}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(g.montoOriginal)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatClp(g.montoMensual)}</td>
                    <td className="px-3 py-2">{g.periodicidad}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!balance && !isPending && !isError && (
        <div className="p-10 text-center text-[13px] text-muted-foreground">
          Seleccione un período y presione «Generar reporte» para ver el balance.
        </div>
      )}

      {isError && (
        <div className="p-10 text-center text-[13px] text-primary">
          Error generando el reporte. Verifique los parámetros.
        </div>
      )}
    </div>
  );
}