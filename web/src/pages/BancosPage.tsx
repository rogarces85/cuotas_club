import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarMovimientosBancarios,
  importarCartola,
  conciliarMovimientos,
  ApiError,
  type ConciliacionSugerencia,
} from '../lib/api';
import { ModalHeader } from '../components/ModalHeader';

/**
 * Página Bancos (M4): cartola bancaria y conciliación de movimientos con
 * pagos pendientes. El CRUD de cuentas vive en CuentasBancariasPage.
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

type ImportarModalState = { abierto: boolean } | null;
type ConciliarModalState = { abierto: boolean; sugerencias: ConciliacionSugerencia[] } | null;

export default function BancosPage() {
  const queryClient = useQueryClient();
  const [importarModal, setImportarModal] = useState<ImportarModalState>(null);
  const [conciliarModal, setConciliarModal] = useState<ConciliarModalState>(null);
  const [paginaMov, setPaginaMov] = useState(1);
  const [archivoCartola, setArchivoCartola] = useState<File | null>(null);
  const [importarError, setImportarError] = useState<string | null>(null);

  // Movimientos bancarios
  const { data: movData, isPending: movPending, isError: movError } = useQuery({
    queryKey: ['movimientos-bancarios', paginaMov],
    queryFn: () => listarMovimientosBancarios({ pagina: paginaMov, porPagina: 50 }),
  });

  const importar = useMutation({
    mutationFn: (archivo: File) => importarCartola(archivo),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['movimientos-bancarios'] });
      setImportarModal(null);
      setArchivoCartola(null);
      if (res.errores.length > 0) {
        setImportarError(`${res.importados} importados, ${res.errores.length} errores. Ver consola.`);
      }
    },
  });

  const conciliar = useMutation({
    mutationFn: () => conciliarMovimientos(),
    onSuccess: (res) => {
      setConciliarModal({ abierto: true, sugerencias: res.sugerencias });
    },
  });

  const totalPaginasMov = movData ? Math.max(1, Math.ceil(movData.total / movData.porPagina)) : 1;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Bancos</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Cartola bancaria y conciliación con pagos
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setImportarModal({ abierto: true })}
            className="bg-secondary text-secondary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold border border-border"
          >
            Importar cartola
          </button>
          <button
            onClick={() => conciliar.mutate()}
            disabled={conciliar.isPending}
            className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold disabled:opacity-50"
          >
            {conciliar.isPending ? 'Conciliando…' : 'Conciliar'}
          </button>
        </div>
      </div>

      {/* Movimientos bancarios */}
      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="text-[14px] font-semibold">Movimientos importados</h2>
          <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground">
            {movData && (
              <>
                <span>Total: <span className="font-mono ml-1">{movData.total}</span></span>
                <span>Página {movData.pagina} de {totalPaginasMov}</span>
              </>
            )}
          </div>
        </div>
        {movPending ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">Cargando movimientos…</div>
        ) : movError ? (
          <div className="p-8 text-center text-[13px] text-primary">No se pudieron cargar los movimientos.</div>
        ) : movData && movData.filas.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            No hay movimientos importados. Use «Importar cartola» para cargar un CSV.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">Fecha</th>
                  <th className="px-3 py-2 font-semibold text-right">Monto</th>
                  <th className="px-3 py-2 font-semibold">Descripción</th>
                  <th className="px-3 py-2 font-semibold">Referencia</th>
                </tr>
              </thead>
              <tbody>
                {movData?.filas.map((m) => (
                  <tr key={m.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono">{formatFecha(m.fecha)}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {m.monto > 0 ? '+' : ''}{formatClp(m.monto)}
                    </td>
                    <td className="px-3 py-2 max-w-[400px] truncate">{m.descripcion}</td>
                    <td className="px-3 py-2 text-muted-foreground font-mono">{m.referencia ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación movimientos */}
        {movData && movData.total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border text-[12.5px] text-muted-foreground">
            <div className="flex gap-2">
              <button
                disabled={paginaMov <= 1}
                onClick={() => setPaginaMov((p) => p - 1)}
                className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground"
              >
                Anterior
              </button>
              <button
                disabled={paginaMov >= totalPaginasMov}
                onClick={() => setPaginaMov((p) => p + 1)}
                className="px-3 py-1.5 border border-border rounded-md disabled:opacity-40 hover:text-foreground"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Importar cartola */}
      {importarModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setImportarModal(null)}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              titulo="Importar cartola bancaria"
              subtitulo="Formato esperado: fecha,monto,descripcion,referencia"
              onClose={() => { setImportarModal(null); setArchivoCartola(null); setImportarError(null); }}
            />
            <p className="text-[12.5px] text-muted-foreground mb-4">
              Formato esperado: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">fecha,monto,descripcion,referencia</code>
              <br />Ejemplo: <code className="font-mono bg-secondary px-1.5 py-0.5 rounded">2026-11-15,50000,TRANSFERENCIA JUAN PEREZ 12345678K,REF123</code>
            </p>
            {importarError && (
              <div className="mb-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-[12.5px] text-warning">
                {importarError}
              </div>
            )}
            {importar.error instanceof ApiError && (
              <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
                {importar.error.message}
              </div>
            )}
            <div className="mb-4">
              <label className="block text-[12px] font-semibold mb-1.5">Archivo CSV</label>
              <input
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => {
                  setArchivoCartola(e.target.files?.[0] ?? null);
                  setImportarError(null);
                }}
                className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
                disabled={importar.isPending}
              />
            </div>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => { setImportarModal(null); setArchivoCartola(null); setImportarError(null); }}
                className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={() => archivoCartola && importar.mutate(archivoCartola)}
                disabled={importar.isPending || !archivoCartola}
                className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
              >
                {importar.isPending ? 'Importando…' : 'Importar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Conciliación */}
      {conciliarModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setConciliarModal(null)}>
          <div className="w-full max-w-[900px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              titulo="Sugerencias de conciliación"
              onClose={() => setConciliarModal(null)}
            />
            {conciliarModal.sugerencias.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-muted-foreground">
                No se encontraron coincidencias entre movimientos y pagos pendientes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                      <th className="px-3 py-2 font-semibold">Movimiento</th>
                      <th className="px-3 py-2 font-semibold">Fecha</th>
                      <th className="px-3 py-2 font-semibold text-right">Monto</th>
                      <th className="px-3 py-2 font-semibold">Pago sugerido</th>
                      <th className="px-3 py-2 font-semibold">Score</th>
                      <th className="px-3 py-2 font-semibold">Razones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conciliarModal.sugerencias.map((s, i) => (
                      <tr key={i} className="border-b border-border last:border-0 hover:bg-secondary/40">
                        <td className="px-3 py-2 font-mono text-muted-foreground">
                          {s.movimiento.descripcion.slice(0, 50)}…
                        </td>
                        <td className="px-3 py-2">{formatFecha(s.movimiento.fecha)}</td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatClp(s.movimiento.monto)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium">{s.pago.nombre}</div>
                          <div className="text-[11px] text-muted-foreground font-mono">{s.pago.rut} · Pago #{s.pago.id}</div>
                        </td>
                        <td className="px-3 py-2">
                          <Badge value={`${s.score}`} color={s.score >= 70 ? 'success' : s.score >= 40 ? 'warning' : 'secondary'} />
                        </td>
                        <td className="px-3 py-2 text-[11px] text-muted-foreground">
                          {s.razones.join('; ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 pt-4 border-t border-border text-right">
              <button
                onClick={() => setConciliarModal(null)}
                className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
