import { useEffect, useRef, useState } from 'react';
import {
  ApiError,
  descargarPlantillaSocios,
  importarSocios,
  type ResultadoImportacionSocios,
} from '../lib/api';
import { ModalHeader } from './ModalHeader';

/**
 * Importación masiva de socios.
 *
 * Flujo en dos pasos para no escribir datos a ciegas:
 * 1. Se sube el archivo y se valida con `dryRun`: la API cuenta cuántos se
 *    crearían, cuántos se actualizarían y qué filas tienen errores.
 * 2. La persona confirma y recién ahí se escribe en la base.
 *
 * La plantilla descargable es la misma que espera el importador: una fila por
 * integrante y encabezados fijos.
 */

type Props = {
  abierto: boolean;
  onClose: () => void;
  onImported: () => void;
};

const MAX_BYTES = 8 * 1024 * 1024;
const ACEPTADOS = /\.(xlsx|xls|csv)$/i;

function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ImportarSociosModal({ abierto, onClose, onImported }: Props) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [forzar, setForzar] = useState(false);
  const [revision, setRevision] = useState<ResultadoImportacionSocios | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacionSocios | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [detalleError, setDetalleError] = useState<string[]>([]);
  const [revisando, setRevisando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [descargando, setDescargando] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const solicitudRef = useRef(0);

  const reiniciar = () => {
    solicitudRef.current++;
    setArchivo(null);
    setForzar(false);
    setRevision(null);
    setResultado(null);
    setError(null);
    setDetalleError([]);
    setArrastrando(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const cerrar = () => {
    if (importando) return;
    reiniciar();
    onClose();
  };

  useEffect(() => {
    if (!abierto) return;
    dialogRef.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !importando) cerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [abierto, importando]);

  const revisar = async (nuevoArchivo: File, conForzar: boolean) => {
    const id = ++solicitudRef.current;
    setRevisando(true);
    setError(null);
    setDetalleError([]);
    setRevision(null);
    try {
      const respuesta = await importarSocios(nuevoArchivo, conForzar, true);
      if (solicitudRef.current !== id) return;
      setRevision(respuesta);
    } catch (err) {
      if (solicitudRef.current !== id) return;
      if (err instanceof ApiError) {
        setError(err.message);
        setDetalleError(err.detalle);
      } else {
        setError('No se pudo revisar el archivo. Intenta de nuevo.');
      }
    } finally {
      if (solicitudRef.current === id) setRevisando(false);
    }
  };

  const elegirArchivo = (nuevoArchivo: File | null | undefined) => {
    if (!nuevoArchivo) return;
    if (!ACEPTADOS.test(nuevoArchivo.name)) {
      setArchivo(null);
      setRevision(null);
      setResultado(null);
      setError('Formato no permitido. Sube un archivo .xlsx, .xls o .csv.');
      setDetalleError([]);
      return;
    }
    if (nuevoArchivo.size > MAX_BYTES) {
      setArchivo(null);
      setRevision(null);
      setResultado(null);
      setError('El archivo supera el máximo de 8 MB.');
      setDetalleError([]);
      return;
    }
    setArchivo(nuevoArchivo);
    setResultado(null);
    void revisar(nuevoArchivo, forzar);
  };

  const descargarPlantilla = async () => {
    setDescargando(true);
    setError(null);
    try {
      const blob = await descargarPlantillaSocios();
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement('a');
      enlace.href = url;
      enlace.download = 'plantilla-socios-osorno-runners.xlsx';
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo descargar la plantilla.');
    } finally {
      setDescargando(false);
    }
  };

  const confirmarImportacion = async () => {
    if (!archivo) return;
    setImportando(true);
    setError(null);
    setDetalleError([]);
    try {
      const respuesta = await importarSocios(archivo, forzar, false);
      setResultado(respuesta);
      setRevision(null);
      onImported();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setDetalleError(err.detalle);
      } else {
        setError('No se pudo importar el archivo. Intenta de nuevo.');
      }
    } finally {
      setImportando(false);
    }
  };

  if (!abierto) return null;

  const nuevas = revision?.insertados ?? 0;
  const actualizaciones = revision?.actualizados ?? 0;
  const omitidos = revision?.saltados ?? 0;
  const conError = revision?.errores ?? 0;
  const totalAImportar = nuevas + actualizaciones;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={cerrar}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-[700px] overflow-hidden rounded-[16px] border border-border bg-card shadow-2xl focus:outline-none"
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-importar-socios"
      >
        <div className="h-[4px] bg-gradient-to-r from-primary via-red-600 to-red-900" />

            <ModalHeader
              titulo="Importar socios"
              subtitulo="Sube la planilla del club. Primero revisamos todo; tú confirmas antes de guardar."
              onClose={cerrar}
            />

        <div className="max-h-[calc(92vh-73px)] space-y-5 overflow-y-auto px-6 py-5">
          {resultado ? (
            <ResultadoImportacion resultado={resultado} onCerrar={cerrar} onOtro={reiniciar} />
          ) : (
            <>
              {/* Paso 1: plantilla */}
              <section className="rounded-xl border border-border/80 bg-secondary/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    1
                  </span>
                  <h3 className="text-[13px] font-semibold">Descarga la plantilla limpia</h3>
                </div>
                <p className="mb-3 text-[12px] leading-snug text-muted-foreground">
                  Trae las columnas exactas que espera el sistema, tres hojas (Socios, Ejemplos e
                  Instrucciones) y las fechas listas para escribir. No cambies los encabezados.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void descargarPlantilla()}
                    disabled={descargando}
                    className="rounded-lg border border-border bg-card px-3 py-2 text-[12.5px] font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-60"
                  >
                    {descargando ? 'Descargando…' : '⬇ Descargar plantilla Excel'}
                  </button>
                  <span className="text-[11.5px] text-muted-foreground">.xlsx · sin macros</span>
                </div>
              </section>

              {/* Paso 2: archivo */}
              <section className="rounded-xl border border-border/80 bg-secondary/20 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    2
                  </span>
                  <h3 className="text-[13px] font-semibold">Sube la planilla llena</h3>
                </div>

                <label
                  onDragOver={(evento) => {
                    evento.preventDefault();
                    setArrastrando(true);
                  }}
                  onDragLeave={() => setArrastrando(false)}
                  onDrop={(evento) => {
                    evento.preventDefault();
                    setArrastrando(false);
                    elegirArchivo(evento.dataTransfer.files?.[0]);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
                    arrastrando
                      ? 'border-primary bg-accent'
                      : 'border-border bg-card hover:border-primary/50'
                  }`}
                >
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="sr-only"
                    disabled={importando}
                    onChange={(evento) => elegirArchivo(evento.target.files?.[0])}
                  />
                  <span className="text-[13px] font-medium">
                    {archivo ? archivo.name : 'Arrastra el archivo o haz clic para elegirlo'}
                  </span>
                  <span className="text-[11.5px] text-muted-foreground">
                    {archivo
                      ? `${formatearBytes(archivo.size)} · haz clic para cambiar`
                      : '.xlsx, .xls o .csv · máximo 8 MB'}
                  </span>
                </label>

                <label
                  htmlFor="forzar-actualizacion"
                  className="mt-3 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                >
                  <input
                    id="forzar-actualizacion"
                    type="checkbox"
                    checked={forzar}
                    disabled={importando}
                    onChange={(evento) => {
                      const nuevo = evento.target.checked;
                      setForzar(nuevo);
                      if (archivo) void revisar(archivo, nuevo);
                    }}
                    className="mt-0.5 h-4 w-4 rounded border-border accent-[var(--color-primary)]"
                  />
                  <span>
                    <span className="block text-[12.5px] font-medium">
                      Actualizar socios que ya existen
                    </span>
                    <span className="block text-[11.5px] leading-snug text-muted-foreground">
                      Si un RUT ya está en el padrón, se actualizan solo las celdas con datos. Las
                      celdas vacías no borran lo que ya había.
                    </span>
                  </span>
                </label>

                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  Columnas obligatorias: <code className="rounded bg-secondary px-1 py-0.5 font-mono">rut</code>{' '}
                  <code className="rounded bg-secondary px-1 py-0.5 font-mono">nombre</code>{' '}
                  <code className="rounded bg-secondary px-1 py-0.5 font-mono">anio</code>.
                </p>
              </section>

              {revisando && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-[12.5px] text-muted-foreground">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
                  Revisando la planilla…
                </div>
              )}

              {error && (
                <div className="rounded-lg border border-primary/20 bg-accent p-3 text-[12.5px] text-accent-foreground">
                  <div className="flex items-start gap-2 font-medium">
                    <span aria-hidden="true">⚠</span>
                    <span>{error}</span>
                  </div>
                  {detalleError.length > 0 && <ListaErrores errores={detalleError} />}
                </div>
              )}

              {revision && (
                <section className="rounded-xl border border-border bg-card p-4">
                  <h3 className="mb-2 text-[13px] font-semibold">Revisión previa</h3>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Resumen valor={nuevas} etiqueta="nuevas" tono="success" />
                    <Resumen valor={actualizaciones} etiqueta="se actualizan" tono="primary" />
                    <Resumen valor={omitidos} etiqueta="se omiten" tono="muted" />
                    <Resumen valor={conError} etiqueta="con errores" tono={conError > 0 ? 'warning' : 'muted'} />
                  </div>

                  {conError > 0 && revision.detalleErrores.length > 0 && (
                    <ListaErrores errores={revision.detalleErrores} />
                  )}

                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11.5px] text-muted-foreground">
                      {totalAImportar > 0
                        ? `Se guardarán ${totalAImportar} socio${totalAImportar === 1 ? '' : 's'} al confirmar.`
                        : 'No hay filas válidas para importar con esta configuración.'}
                    </p>
                    <button
                      type="button"
                      onClick={() => void confirmarImportacion()}
                      disabled={importando || totalAImportar === 0}
                      className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      {importando
                        ? 'Importando…'
                        : `Importar ${totalAImportar} socio${totalAImportar === 1 ? '' : 's'}`}
                    </button>
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Resumen({
  valor,
  etiqueta,
  tono,
}: {
  valor: number;
  etiqueta: string;
  tono: 'success' | 'primary' | 'warning' | 'muted';
}) {
  const clases: Record<typeof tono, string> = {
    success: 'bg-success/10 text-success',
    primary: 'bg-accent text-accent-foreground',
    warning: 'bg-warning/10 text-warning',
    muted: 'bg-secondary text-muted-foreground',
  };
  return (
    <div
      className={`rounded-lg px-3 py-2 ${
        valor === 0 ? clases.muted : clases[tono]
      }`}
    >
      <div className="font-mono text-[18px] font-bold leading-none">{valor}</div>
      <div className="mt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] opacity-80">
        {etiqueta}
      </div>
    </div>
  );
}

function ListaErrores({ errores }: { errores: string[] }) {
  return (
    <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-2 text-[11.5px] text-muted-foreground">
      {errores.map((mensaje, indice) => (
        <li key={`${indice}-${mensaje}`} className="flex gap-1.5">
          <span aria-hidden="true" className="text-primary">
            •
          </span>
          <span>{mensaje}</span>
        </li>
      ))}
    </ul>
  );
}

function ResultadoImportacion({
  resultado,
  onCerrar,
  onOtro,
}: {
  resultado: ResultadoImportacionSocios;
  onCerrar: () => void;
  onOtro: () => void;
}) {
  return (
    <div>
      <div className="rounded-xl border border-success/30 bg-success/5 p-4">
        <div className="flex items-start gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-success/15 text-[15px] font-bold text-success">
            ✓
          </span>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Importación terminada</h3>
            <p className="mt-1 text-[12.5px] leading-snug text-muted-foreground">
              El padrón ya quedó actualizado. Puedes cerrar esta ventana.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Resumen valor={resultado.insertados} etiqueta="nuevos" tono="success" />
          <Resumen valor={resultado.actualizados} etiqueta="actualizados" tono="primary" />
          <Resumen valor={resultado.saltados} etiqueta="omitidos" tono="muted" />
          <Resumen valor={resultado.errores} etiqueta="con errores" tono={resultado.errores > 0 ? 'warning' : 'muted'} />
        </div>
        {resultado.detalleErrores.length > 0 && (
          <div className="mt-3">
            <p className="mb-1 text-[11.5px] font-medium text-warning">
              Estas filas no se importaron:
            </p>
            <ListaErrores errores={resultado.detalleErrores} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onOtro}
          className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
        >
          Importar otro archivo
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
