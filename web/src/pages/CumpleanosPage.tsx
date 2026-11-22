import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  enviarSaludo,
  listarCumpleanos,
  previsualizarSaludo,
  type CumpleanosFila,
} from '../lib/api';

/**
 * Cumpleaños del mes.
 *
 * Lista a los socios activos que cumplen años este mes, calcula la edad que
 * cumplen y la antigüedad en el club, y permite previsualizar y enviar el
 * saludo por correo. El envío queda registrado una vez por socio y año.
 */

const MESES_CORTOS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function mesCorto(fechaNacimiento: string): string {
  const mes = Number(fechaNacimiento.slice(5, 7));
  return MESES_CORTOS[mes - 1] ?? '';
}

function fechaEnvio(epoch: number): string {
  return new Date(epoch * 1000).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: '2-digit',
  });
}

function edadTexto(edad: number | null): string {
  if (edad === null) return 'Cumpleaños';
  return edad === 1 ? 'Cumple 1 año' : `Cumple ${edad} años`;
}

export default function CumpleanosPage() {
  const queryClient = useQueryClient();
  const [seleccion, setSeleccion] = useState<CumpleanosFila | null>(null);

  const { data, isPending, isError } = useQuery({
    queryKey: ['cumpleanos'],
    queryFn: () => listarCumpleanos(),
  });

  const onSent = () => {
    queryClient.invalidateQueries({ queryKey: ['cumpleanos'] });
  };

  const cerrarSeleccion = useCallback(() => setSeleccion(null), []);

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Cumpleaños</h1>
          <p className="mt-[3px] text-[13px] text-muted-foreground">
            {data
              ? `${capitalizar(data.etiqueta)} · ${data.total} cumpleaños en el mes`
              : 'Cumpleaños del mes en curso'}
          </p>
        </div>
        {data && (
          <span className="rounded-full border border-primary/20 bg-accent px-3 py-1.5 text-[12px] font-semibold text-accent-foreground">
            {capitalizar(data.etiqueta)}
          </span>
        )}
      </div>

      {isPending ? (
        <div className="rounded-[10px] border border-border bg-card p-10 text-center text-[13px] text-muted-foreground">
          Cargando cumpleaños…
        </div>
      ) : isError || !data ? (
        <div className="rounded-[10px] border border-border bg-card p-10 text-center text-[13px] text-primary">
          No se pudieron cargar los cumpleaños.
        </div>
      ) : (
        <>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <Resumen etiqueta="Cumpleaños este mes" valor={data.total} destacado />
            <Resumen etiqueta="Con correo registrado" valor={data.conEmail} />
            <Resumen etiqueta="Saludos enviados" valor={data.enviados} />
          </div>

          {!data.correoConfigurado && (
            <div className="mb-5 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12.5px] leading-snug text-warning">
              <span aria-hidden="true">⚠</span>
              <span>
                El envío de correos aún no está configurado. Agrega{' '}
                <code className="rounded bg-warning/10 px-1 py-0.5 font-mono">MAIL_PASSWORD</code>{' '}
                (contraseña de aplicación de Gmail) en{' '}
                <code className="rounded bg-warning/10 px-1 py-0.5 font-mono">api/.env</code> y
                reinicia la API. La vista previa y la copia del texto funcionan igual.
              </span>
            </div>
          )}

          {data.filas.length === 0 ? (
            <div className="rounded-[10px] border border-border bg-card p-10 text-center">
              <p className="text-[14px] font-semibold">No hay cumpleaños este mes</p>
              <p className="mt-1 text-[12.5px] text-muted-foreground">
                Cuando un socio tenga fecha de nacimiento en {data.etiqueta}, aparecerá acá.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.filas.map((fila) => (
                <TarjetaCumple
                  key={fila.socioId}
                  fila={fila}
                  onAbrir={() => setSeleccion(fila)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {seleccion && data && (
        <SaludoModal
          fila={seleccion}
          correoConfigurado={data.correoConfigurado}
          onClose={cerrarSeleccion}
          onSent={onSent}
        />
      )}
    </div>
  );
}

function Resumen({
  etiqueta,
  valor,
  destacado = false,
}: {
  etiqueta: string;
  valor: number;
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-[10px] border bg-card p-4 ${
        destacado ? 'border-primary/20' : 'border-border'
      }`}
    >
      <div className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
        {etiqueta}
      </div>
      <div
        className={`mt-1 font-mono text-[26px] font-bold leading-none ${
          destacado ? 'text-primary' : 'text-foreground'
        }`}
      >
        {valor}
      </div>
    </div>
  );
}

function TarjetaCumple({ fila, onAbrir }: { fila: CumpleanosFila; onAbrir: () => void }) {
  const enviado = Boolean(fila.felicitacion);
  const sinCorreo = !fila.email;

  return (
    <div
      className={`flex flex-col gap-4 rounded-xl border p-4 sm:flex-row sm:items-center ${
        fila.esHoy ? 'border-primary/30 bg-accent/40' : 'border-border bg-card'
      }`}
    >
      <div
        className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-full ${
          fila.esHoy ? 'bg-primary text-primary-foreground' : 'bg-accent text-accent-foreground'
        }`}
        aria-hidden="true"
      >
        <span className="font-mono text-[19px] font-bold leading-none">{fila.dia}</span>
        <span className="mt-0.5 text-[9.5px] font-semibold uppercase tracking-[0.08em]">
          {mesCorto(fila.fechaNacimiento)}
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[14.5px] font-semibold">{fila.nombre}</h2>
          {fila.esHoy && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-primary-foreground">
              Hoy
            </span>
          )}
          {enviado && (
            <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10.5px] font-semibold text-success">
              ✓ Enviado
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted-foreground">
          <span>{edadTexto(fila.edadCumple)}</span>
          <span aria-hidden="true">·</span>
          <span>
            {fila.membresia
              ? `Lleva ${fila.membresia.texto} en el club`
              : 'Sin fecha de ingreso registrada'}
          </span>
        </div>
        <div className="mt-1 text-[12px]">
          {fila.email ? (
            <span className="text-muted-foreground">✉ {fila.email}</span>
          ) : (
            <span className="text-warning">Sin correo registrado</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {enviado && fila.felicitacion && (
          <span className="text-[11.5px] text-success">
            Enviado el {fechaEnvio(fila.felicitacion.enviadoAt)}
          </span>
        )}
        <button
          type="button"
          onClick={onAbrir}
          className={
            sinCorreo || enviado
              ? 'rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground'
              : 'rounded-lg bg-primary px-4 py-2 text-[12.5px] font-semibold text-primary-foreground shadow-sm hover:opacity-90'
          }
        >
          {sinCorreo ? 'Ver saludo' : enviado ? 'Ver saludo' : 'Saludar'}
        </button>
      </div>
    </div>
  );
}

function SaludoModal({
  fila,
  correoConfigurado,
  onClose,
  onSent,
}: {
  fila: CumpleanosFila;
  correoConfigurado: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState<boolean>(Boolean(fila.felicitacion));
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  const { data: preview, isPending, isError } = useQuery({
    queryKey: ['cumpleanos-preview', fila.socioId],
    queryFn: () => previsualizarSaludo(fila.socioId),
  });

  useEffect(() => {
    dialogRef.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape' && !enviando) onClose();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [enviando, onClose]);

  const enviar = async () => {
    if (!preview || enviando || enviado) return;
    setEnviando(true);
    setErrorEnvio(null);
    try {
      await enviarSaludo(fila.socioId);
      setEnviado(true);
      onSent();
    } catch (err) {
      setErrorEnvio(
        err instanceof ApiError ? err.message : 'No se pudo enviar el saludo. Intenta de nuevo.',
      );
    } finally {
      setEnviando(false);
    }
  };

  const copiar = async () => {
    if (!preview) return;
    try {
      await navigator.clipboard.writeText(
        `Asunto: ${preview.asunto}\n\n${preview.texto}`,
      );
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErrorEnvio('No se pudo copiar el texto. Selecciónalo y cópialo manualmente.');
    }
  };

  const puedeEnviar = Boolean(fila.email) && correoConfigurado && !enviado;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-[1px]"
      onClick={() => {
        if (!enviando) onClose();
      }}
      role="presentation"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-[16px] border border-border bg-card shadow-2xl focus:outline-none"
        onClick={(evento) => evento.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-saludo"
      >
        <div className="h-[4px] bg-gradient-to-r from-primary via-red-600 to-red-900" />

        <header className="flex items-start gap-3 border-b border-border bg-secondary/40 px-6 py-4">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary font-mono text-[15px] font-bold text-primary-foreground shadow-sm"
            aria-hidden="true"
          >
            {fila.dia}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="titulo-saludo" className="text-[18px] font-bold tracking-tight">
              Saludo para {fila.nombre}
            </h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              {fila.email ? `Se enviará a ${fila.email}` : 'Este socio no tiene correo registrado'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={enviando}
            aria-label="Cerrar saludo"
            className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-[13px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25 disabled:opacity-50"
          >
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {isPending ? (
            <div className="flex items-center justify-center gap-2 py-16 text-[13px] text-muted-foreground">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-primary" />
              Preparando el saludo…
            </div>
          ) : isError || !preview ? (
            <div className="rounded-lg border border-primary/20 bg-accent p-3 text-[12.5px] text-accent-foreground">
              No se pudo preparar el saludo. Cierra y vuelve a intentar.
            </div>
          ) : (
            <>
              <div className="mb-3 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
                <div className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Asunto
                </div>
                <div className="mt-0.5 text-[13px] font-medium">{preview.asunto}</div>
              </div>

              <iframe
                title="Vista previa del correo de cumpleaños"
                srcDoc={preview.html}
                sandbox=""
                className="h-[380px] w-full rounded-lg border border-border bg-white"
              />

              {enviado && (
                <div className="mt-4 flex items-start gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2.5 text-[12.5px] text-success">
                  <span aria-hidden="true">✓</span>
                  <span>Saludo enviado. Quedó registrado para que no se repita este año.</span>
                </div>
              )}

              {!correoConfigurado && (
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 text-[12px] leading-snug text-warning">
                  El correo no está configurado todavía. Puedes copiar el texto y enviarlo desde tu
                  correo, o agregar <code className="font-mono">MAIL_PASSWORD</code> en{' '}
                  <code className="font-mono">api/.env</code>.
                </div>
              )}

              {errorEnvio && (
                <div className="mt-4 rounded-lg border border-primary/20 bg-accent px-3 py-2.5 text-[12.5px] text-accent-foreground">
                  {errorEnvio}
                </div>
              )}
            </>
          )}
        </div>

        <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => void copiar()}
            disabled={!preview}
            className="rounded-lg border border-border px-3 py-2 text-[12.5px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            {copiado ? '✓ Texto copiado' : 'Copiar texto'}
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              {enviado ? 'Cerrar' : 'Cancelar'}
            </button>
            {!enviado && (
              <button
                type="button"
                onClick={() => void enviar()}
                disabled={!puedeEnviar || enviando}
                className="rounded-lg bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm hover:opacity-90 disabled:opacity-50"
              >
                {enviando ? 'Enviando…' : 'Enviar saludo'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
