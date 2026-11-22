import { useState, type ReactNode } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  ApiError,
  descargarPagos,
  obtenerReporteSocios,
  type EstadoPagoExport,
  type ReporteSociosParams,
} from '../lib/api';

/**
 * Panel del Reporte de Socios.
 *
 * Consume `/api/reportes/socios` para las métricas del padrón y la
 * recaudación, y `/api/reportes/descarga/pagos` para los archivos CSV/XLSX.
 * Las gráficas son SVG/CSS simples: el proyecto no tiene una librería de
 * charts y no hace falta agregar una para seis series.
 */

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const PERIODOS = [
  { valor: 'ANIO', etiqueta: 'Año' },
  { valor: 'TRIMESTRE', etiqueta: 'Trimestre' },
  { valor: 'MES', etiqueta: 'Mes' },
] as const;

const FILTROS_SOCIO = [
  { valor: 'Activos', etiqueta: 'Activos' },
  { valor: 'Inactivos', etiqueta: 'Inactivos' },
  { valor: 'Hombres', etiqueta: 'Hombres' },
  { valor: 'Mujeres', etiqueta: 'Mujeres' },
  { valor: 'Indefinido', etiqueta: 'Indefinido' },
  { valor: 'Membresía', etiqueta: 'Membresía' },
  { valor: 'Becado', etiqueta: 'Becado' },
];

const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;

function compactoClp(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace('.', ',')}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}k`;
  return `$${n}`;
}

function etiquetaCorta(mes: string): string {
  return mes.length > 3 ? mes.slice(0, 3) : mes;
}

export default function ReporteSociosPanel() {
  const hoy = new Date();
  const [periodo, setPeriodo] = useState<'ANIO' | 'TRIMESTRE' | 'MES'>('ANIO');
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [trimestre, setTrimestre] = useState(Math.floor(hoy.getMonth() / 3) + 1);
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [socios, setSocios] = useState<string[]>([]);
  const [estadoPago, setEstadoPago] = useState<EstadoPagoExport>('TODOS');
  const [descargaOk, setDescargaOk] = useState<string | null>(null);
  const [descargaError, setDescargaError] = useState<string | null>(null);

  const params: ReporteSociosParams = {
    anio,
    periodo,
    trimestre: periodo === 'TRIMESTRE' ? trimestre : undefined,
    mes: periodo === 'MES' ? mes : undefined,
    socios,
  };

  const { data, isPending, isError, error } = useQuery({
    queryKey: ['reporte-socios', params],
    queryFn: () => obtenerReporteSocios(params),
    retry: false,
  });

  const descarga = useMutation({
    mutationFn: (formato: 'csv' | 'xlsx') =>
      descargarPagos({ anio, socios, estadoPago, formato }),
    onSuccess: (blob, formato) => {
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = `pagos-${anio}.${formato}`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
      setDescargaError(null);
      setDescargaOk(`Archivo ${formato.toUpperCase()} descargado.`);
    },
    onError: (err) => {
      setDescargaOk(null);
      setDescargaError(err instanceof ApiError ? err.message : 'No se pudo descargar el archivo.');
    },
  });

  const toggleFiltro = (valor: string) => {
    setSocios((actual) =>
      actual.includes(valor) ? actual.filter((item) => item !== valor) : [...actual, valor],
    );
  };

  const descargar = (formato: 'csv' | 'xlsx') => {
    setDescargaOk(null);
    setDescargaError(null);
    descarga.mutate(formato);
  };

  return (
    <div className="space-y-5">
      {/* Filtros */}
      <section className="rounded-[10px] border border-border bg-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label htmlFor="reporte-periodo" className="mb-1.5 block text-[12px] font-semibold">
              Período
            </label>
            <select
              id="reporte-periodo"
              value={periodo}
              onChange={(evento) => setPeriodo(evento.target.value as typeof periodo)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
            >
              {PERIODOS.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.etiqueta}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="reporte-anio" className="mb-1.5 block text-[12px] font-semibold">
              Año
            </label>
            <input
              id="reporte-anio"
              type="number"
              min={2020}
              max={2100}
              value={anio}
              onChange={(evento) => setAnio(Number(evento.target.value) || hoy.getFullYear())}
              className="w-[104px] rounded-lg border border-input bg-background px-3 py-2 text-[13px] font-mono"
            />
          </div>

          {periodo === 'TRIMESTRE' && (
            <div>
              <label htmlFor="reporte-trimestre" className="mb-1.5 block text-[12px] font-semibold">
                Trimestre
              </label>
              <select
                id="reporte-trimestre"
                value={trimestre}
                onChange={(evento) => setTrimestre(Number(evento.target.value))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
              >
                {[1, 2, 3, 4].map((numero) => (
                  <option key={numero} value={numero}>
                    {numero}.º trimestre
                  </option>
                ))}
              </select>
            </div>
          )}

          {periodo === 'MES' && (
            <div>
              <label htmlFor="reporte-mes" className="mb-1.5 block text-[12px] font-semibold">
                Mes
              </label>
              <select
                id="reporte-mes"
                value={mes}
                onChange={(evento) => setMes(Number(evento.target.value))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
              >
                {MESES.map((nombre, indice) => (
                  <option key={nombre} value={indice + 1}>
                    {nombre}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="w-full border-t border-border pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[12px] font-semibold">Filtros de socios</span>
              {socios.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSocios([])}
                  className="text-[11.5px] font-medium text-muted-foreground hover:text-foreground"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {FILTROS_SOCIO.map((filtro) => {
                const activo = socios.includes(filtro.valor);
                return (
                  <button
                    key={filtro.valor}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => toggleFiltro(filtro.valor)}
                    className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors ${
                      activo
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                    }`}
                  >
                    {filtro.etiqueta}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              Los filtros se aplican al padrón y a los pagos exportados.
            </p>
          </div>
        </div>
      </section>

      {isPending ? (
        <div className="rounded-[10px] border border-border bg-card p-10 text-center text-[13px] text-muted-foreground">
          Generando reporte…
        </div>
      ) : isError || !data ? (
        <div className="rounded-[10px] border border-border bg-card p-10 text-center text-[13px] text-primary">
          {error instanceof ApiError ? error.message : 'No se pudo generar el reporte.'}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[12.5px] text-muted-foreground">
              {data.periodo.etiqueta} · {data.periodo.inicio} a {data.periodo.fin}
            </p>
            {data.filtros.socios.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {data.filtros.socios.map((etiqueta) => (
                  <span
                    key={etiqueta}
                    className="rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-accent-foreground"
                  >
                    {etiqueta}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Métricas principales */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metrica
              etiqueta="Total socios"
              valor={data.resumen.totalSocios.toLocaleString('es-CL')}
              detalle={`${data.resumen.activos} activos · ${data.resumen.inactivos} inactivos`}
              destacada
            />
            <Metrica
              etiqueta="Recaudación"
              valor={formatClp(data.resumen.recaudacionPeriodo)}
              detalle={`${data.resumen.pagosAprobados} pagos aprobados`}
            />
            <Metrica
              etiqueta="Socios pagadores"
              valor={String(data.resumen.sociosPagadores)}
              detalle={`Promedio ${formatClp(data.resumen.promedioPorPago)}`}
            />
            <Metrica
              etiqueta="Edad promedio"
              valor={data.resumen.edadPromedio !== null ? `${data.resumen.edadPromedio} años` : '—'}
              detalle={`${data.resumen.conEmail} con email`}
            />
          </div>

          {/* Distribuciones */}
          <div className="grid gap-4 lg:grid-cols-3">
            <Panel titulo="Socios por sexo">
              <Barras
                datos={data.porSexo.map((fila) => ({
                  etiqueta: fila.etiqueta,
                  total: fila.total,
                  color:
                    fila.clave === 'HOMBRE'
                      ? 'bg-primary'
                      : fila.clave === 'MUJER'
                        ? 'bg-red-400'
                        : fila.clave === 'INDEFINIDO'
                          ? 'bg-red-300'
                          : 'bg-border',
                }))}
              />
            </Panel>

            <Panel titulo="Estado del padrón">
              <Barras
                datos={data.porEstado.map((fila) => ({
                  etiqueta: fila.etiqueta,
                  total: fila.total,
                }))}
              />
            </Panel>

            <Panel titulo="Rango de edad">
              <Barras
                datos={data.porRangoEdad.map((fila) => ({
                  etiqueta: fila.etiqueta,
                  total: fila.total,
                }))}
              />
            </Panel>
          </div>

          {/* Series */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel
              titulo="Altas por mes"
              extra={<span className="text-[11px] text-muted-foreground">nuevos socios</span>}
            >
              <BarrasMensuales
                datos={data.nuevosPorMes.map((fila) => ({
                  etiqueta: etiquetaCorta(fila.etiqueta),
                  completo: fila.etiqueta,
                  valor: fila.total,
                }))}
                formato="numero"
                vacio="Sin altas registradas en el período."
              />
            </Panel>

            <Panel
              titulo="Recaudación por mes"
              extra={<span className="text-[11px] text-muted-foreground">pagos aprobados</span>}
            >
              <BarrasMensuales
                datos={data.pagos.porMes.map((fila) => ({
                  etiqueta: etiquetaCorta(fila.etiqueta),
                  completo: fila.etiqueta,
                  valor: fila.monto,
                }))}
                formato="clp"
                vacio="Sin pagos aprobados en el período."
              />
            </Panel>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel titulo="Monto por tipo de cuota">
              {data.pagos.porTipoCuota.length === 0 ? (
                <p className="py-6 text-center text-[12.5px] text-muted-foreground">
                  Sin pagos en el período.
                </p>
              ) : (
                <Barras
                  datos={data.pagos.porTipoCuota.map((fila) => ({
                    etiqueta: fila.etiqueta,
                    total: fila.monto,
                    detalle: `${fila.cantidad} pago${fila.cantidad === 1 ? '' : 's'}`,
                  }))}
                  formato="clp"
                />
              )}
            </Panel>

            <Panel titulo="Datos de contacto">
              <Barras
                datos={[
                  { etiqueta: 'Con email', total: data.resumen.conEmail },
                  { etiqueta: 'Sin email', total: data.resumen.sinEmail },
                  { etiqueta: 'Con nacimiento', total: data.resumen.conFechaNacimiento },
                  { etiqueta: 'Con ingreso', total: data.resumen.conFechaIngreso },
                ]}
              />
              <p className="mt-3 text-[11.5px] leading-snug text-muted-foreground">
                La antigüedad y los saludos de cumpleaños dependen de la fecha de ingreso y de
                nacimiento registradas en Socios.
              </p>
            </Panel>
          </div>

          {/* Descarga */}
          <section className="rounded-[10px] border border-border bg-card p-4">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-[14px] font-semibold">Descargar pagos</h2>
                <p className="mt-1 text-[12px] leading-snug text-muted-foreground">
                  Año {anio} · {socios.length > 0 ? socios.join(', ') : 'todos los socios'} · estado{' '}
                  {estadoPago.toLowerCase()}. El año filtra la fecha de pago.
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label htmlFor="estado-pago" className="mb-1.5 block text-[12px] font-semibold">
                    Estado del pago
                  </label>
                  <select
                    id="estado-pago"
                    value={estadoPago}
                    onChange={(evento) => setEstadoPago(evento.target.value as EstadoPagoExport)}
                    className="rounded-lg border border-input bg-background px-3 py-2 text-[13px]"
                  >
                    <option value="TODOS">Todos</option>
                    <option value="APROBADO">Aprobados</option>
                    <option value="PENDIENTE">Pendientes</option>
                    <option value="RECHAZADO">Rechazados</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => descargar('csv')}
                  disabled={descarga.isPending}
                  className="rounded-lg border border-border bg-secondary px-4 py-2 text-[12.5px] font-semibold text-secondary-foreground disabled:opacity-50"
                >
                  {descarga.isPending && descarga.variables === 'csv' ? 'Generando…' : '⬇ CSV'}
                </button>
                <button
                  type="button"
                  onClick={() => descargar('xlsx')}
                  disabled={descarga.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground disabled:opacity-50"
                >
                  {descarga.isPending && descarga.variables === 'xlsx' ? 'Generando…' : '⬇ Excel'}
                </button>
              </div>
            </div>
            {descargaOk && (
              <div className="mt-3 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-[12px] text-success">
                {descargaOk}
              </div>
            )}
            {descargaError && (
              <div className="mt-3 rounded-lg border border-primary/20 bg-accent px-3 py-2 text-[12px] text-accent-foreground">
                {descargaError}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function Metrica({
  etiqueta,
  valor,
  detalle,
  destacada = false,
}: {
  etiqueta: string;
  valor: string;
  detalle?: string;
  destacada?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-card p-4 ${
        destacada ? 'border-primary/20' : 'border-border'
      }`}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {etiqueta}
      </div>
      <div
        className={`mt-1 font-mono text-[22px] font-bold leading-none ${
          destacada ? 'text-primary' : 'text-foreground'
        }`}
      >
        {valor}
      </div>
      {detalle && <div className="mt-1.5 text-[11px] text-muted-foreground">{detalle}</div>}
    </div>
  );
}

function Panel({
  titulo,
  extra,
  children,
}: {
  titulo: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13.5px] font-semibold">{titulo}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Barras({
  datos,
  formato = 'numero',
}: {
  datos: { etiqueta: string; total: number; color?: string; detalle?: string }[];
  formato?: 'numero' | 'clp';
}) {
  const max = Math.max(1, ...datos.map((fila) => fila.total));
  return (
    <div className="space-y-2.5">
      {datos.map((fila) => (
        <div key={fila.etiqueta} className="flex items-center gap-3">
          <span
            className="w-[96px] shrink-0 truncate text-[11.5px] text-muted-foreground"
            title={`${fila.etiqueta}${fila.detalle ? `: ${fila.detalle}` : ''}`}
          >
            {fila.etiqueta}
          </span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full rounded-full ${fila.color ?? 'bg-primary/80'}`}
              style={{ width: `${Math.max(fila.total > 0 ? 4 : 0, (fila.total / max) * 100)}%` }}
            />
          </div>
          <span className="w-[62px] shrink-0 text-right font-mono text-[11.5px]">
            {formato === 'clp' ? compactoClp(fila.total) : fila.total}
          </span>
        </div>
      ))}
      {datos.every((fila) => fila.total === 0) && (
        <p className="pt-2 text-center text-[11.5px] text-muted-foreground">Sin datos.</p>
      )}
    </div>
  );
}

function BarrasMensuales({
  datos,
  formato,
  vacio,
}: {
  datos: { etiqueta: string; completo: string; valor: number }[];
  formato: 'numero' | 'clp';
  vacio: string;
}) {
  const max = Math.max(1, ...datos.map((fila) => fila.valor));
  const todosCero = datos.every((fila) => fila.valor === 0);

  if (todosCero) {
    return <p className="py-8 text-center text-[12.5px] text-muted-foreground">{vacio}</p>;
  }

  return (
    <div className="flex h-[190px] items-end gap-1.5 overflow-x-auto pb-1">
      {datos.map((fila) => (
        <div
          key={fila.completo}
          className="flex min-w-[26px] flex-1 flex-col items-center justify-end gap-1"
          title={`${fila.completo}: ${formato === 'clp' ? formatClp(fila.valor) : fila.valor}`}
        >
          <span className="text-[9.5px] font-mono text-muted-foreground">
            {fila.valor > 0 ? (formato === 'clp' ? compactoClp(fila.valor) : fila.valor) : ''}
          </span>
          <div
            className="w-full rounded-t bg-primary/85"
            style={{ height: `${Math.max(fila.valor > 0 ? 4 : 1, (fila.valor / max) * 140)}px` }}
          />
          <span className="text-[9.5px] uppercase tracking-[0.04em] text-muted-foreground">
            {fila.etiqueta}
          </span>
        </div>
      ))}
    </div>
  );
}
