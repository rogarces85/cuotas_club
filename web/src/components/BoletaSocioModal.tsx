import { useQuery } from '@tanstack/react-query';
import { obtenerFichaSocio } from '../lib/api';

/**
 * Boleta de pagos — ficha del socio rediseñada como comprobante/resumen.
 *
 * Muestra los datos del socio, un resumen de deuda y pagos, y el historial
 * de pagos con estilo de recibo (boleto). Se abre al hacer clic en "Ver"
 * desde la tabla de socios.
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

const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}-${mes}-${anio}`;
};

const formatoClp = (n: number) => `$${n.toLocaleString('es-CL')}`;

const ESTADO_COLOR: Record<string, string> = {
  APROBADO: 'text-success',
  PENDIENTE: 'text-warning',
  RECHAZADO: 'text-destructive',
};

export default function BoletaSocioModal({ socioId, onClose }: { socioId: number; onClose: () => void }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ['ficha-socio', socioId],
    queryFn: () => obtenerFichaSocio(socioId),
  });

  const socio = data?.socio;
  const pagos = data?.pagos ?? [];
  const deuda = data?.deuda;
  const totalPagado = pagos.filter((p) => p.estado === 'APROBADO').reduce((acc, p) => acc + p.totalPago, 0);

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-muted-foreground">
        Generando boleta…
      </div>
    );
  }
  if (isError || !data || !socio) {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-primary">
        No se pudo cargar la boleta.
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="max-h-[92vh] w-full max-w-[760px] overflow-y-auto rounded-[16px] border border-border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Boleta de pagos"
      >
        {/* Encabezado rayado */}
        <div className="h-[5px] bg-gradient-to-r from-primary via-red-600 to-red-900" />

        <div className="p-6">
          {/* Club + datos de la boleta */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-[18px] font-bold text-white shadow-[0_4px_12px_rgba(223,2,47,0.35)]">
                OR
              </div>
              <div>
                <div className="text-[16px] font-bold tracking-tight">
                  OSORNO <span className="font-normal tracking-wider text-red-600">RUNNERS</span>
                </div>
                <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  Tesorería · Club Deportivo
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-[13px] font-bold text-primary">BOLETA DE PAGOS</div>
              <div className="text-[11px] text-muted-foreground">
                N° {String(socio.id ?? 0).padStart(6, '0')} ·
                {new Date().toLocaleDateString('es-CL')}
              </div>
            </div>
          </div>

          {/* Tarjeta del socio */}
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[13px] font-semibold">{formatRut(socio.rut)}</span>
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {socio.estado}
                </span>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold">{socio.nombre}</div>
                <div className="text-[11px] text-muted-foreground">
                  Año de membresía {socio.anio}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11.5px] text-muted-foreground">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Nacimiento
                </div>
                <div>{fechaCorta(socio.fechaNacimiento)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Ingreso
                </div>
                <div>{fechaCorta(socio.fechaIngreso)}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Sexo
                </div>
                <div>
                  {socio.sexo ? SEXO_LABEL[socio.sexo] ?? socio.sexo : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-semibold mb-1">
                  Estado
                </div>
                <div>
                  {socio.activo === 1 ? 'Activo' : 'Inactivo'}
                </div>
              </div>
            </div>
          </div>

          {/* Resumen */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <Stat titulo="Total pagado" valor={formatoClp(totalPagado)} sub="Este año" />
            <Stat
              titulo="Deuda total"
              valor={formatoClp(deuda?.totalDeuda ?? 0)}
              sub="Períodos pendientes"
            />
            <Stat
              titulo="Pagos registrados"
              valor={String(pagos.length)}
              sub="Historial"
            />
          </div>

          {/* Historial como recibo */}
          <div className="overflow-hidden rounded-xl border border-border/60 mb-6">
            <div className="bg-secondary/30 px-4 py-3">
              <div className="grid grid-cols-[1fr_110px_90px_110px] gap-2 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
                <div>Fecha</div>
                <div className="text-right">Monto</div>
                <div className="text-right">Estado</div>
                <div className="text-right">Período</div>
              </div>
            </div>
            <div className="divide-y divide-border/40">
              {pagos.length === 0 ? (
                <div className="px-4 py-6 text-center text-[12.5px] text-muted-foreground">
                  Sin pagos registrados.
                </div>
              ) : (
                pagos.map((p) => (
                  <div
                    key={p.id}
                    className="px-4 py-3 flex items-center gap-3 group hover:bg-secondary/30 transition-colors"
                  >
                    <div className="grid grid-cols-[1fr_110px_90px_110px] gap-2 text-[12px]">
                      <div className="font-mono text-[11px]">{fechaCorta(p.fechaPago)}</div>
                      <div className="text-right font-mono">{formatoClp(p.totalPago)}</div>
                      <div className="text-right">
                        <span
                          className={`text-[10px] font-semibold ${ESTADO_COLOR[p.estado] ?? 'text-muted'}`}
                        >
                          {p.estado}
                        </span>
                      </div>
                      <div className="text-right font-mono text-[11px]">
                        {p.mesesDetalle ?? p.mesesCantidad}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
            <div className="bg-secondary/20 px-4 py-3 border-t border-border/40">
              <div className="grid grid-cols-[1fr_110px_90px_110px] gap-2 text-[11px] font-bold uppercase tracking-wider text-primary">
                <div>Total</div>
                <div className="text-right">{formatoClp(totalPagado)}</div>
                <div className="text-right">
                  {deuda?.totalDeuda ?? 0 > 0 ? 'PENDIENTE' : 'AL DÍA'}
                </div>
                <div className="text-right font-mono">{pagos.length}</div>
              </div>
            </div>
          </div>

          {/* Períodos pendientes */}
          {deuda && deuda.periodos.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="h-2 w-2 rounded-full bg-warning" />
                <h3 className="text-[12px] font-semibold text-warning">
                  Períodos pendientes
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {deuda.periodos.map((per) => (
                  <span
                    key={per.periodo}
                    className="rounded-md bg-warning/10 px-2 py-1 font-mono text-[11px] font-semibold text-warning border border-warning/30"
                  >
                    {per.periodo}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Contacto */}
          <div className="border-t border-border/40 pt-5 flex items-center justify-between text-[10.5px] text-muted-foreground">
            <div>
              <div className="font-semibold">OSORNO RUNNERS — Tesorería</div>
              <div>{socio.direccion ?? 'Osorno, Chile'}</div>
            </div>
            <div className="text-right">
              <div>{socio.email ?? '—'}</div>
              <div>{socio.telefono ?? '—'}</div>
            </div>
          </div>
          <div className="text-center text-[10px] text-muted-foreground mt-3">
            Gracias por su pago · Este comprobante es válido como respaldo de pago.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border/60 bg-secondary/20 p-3">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {titulo}
      </div>
      <div className="mt-1 text-[16px] font-bold">{valor}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}
