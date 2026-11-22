import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  buscarDirecciones,
  type RespuestaDirecciones,
  type SugerenciaDireccion,
} from '../lib/api';
import { tipoCuotaSchema, montoCuotaPorTipo, estadoSocioSchema } from '@cuotas-club/shared';

/**
 * Formulario de alta y edición de socios.
 *
 * El RUT se normaliza al enviar: sin puntos ni guion, K en mayúscula.
 * Los campos nuevos (fechas, dirección y sexo cerrado) se validan acá y en la
 * API. La dirección se apoya en Google Maps u OpenStreetMap desde el backend,
 * pero la validación nunca impide guardar: es una ayuda, no una barrera.
 */

const SEXOS = [
  { valor: 'HOMBRE', etiqueta: 'Hombre' },
  { valor: 'MUJER', etiqueta: 'Mujer' },
  { valor: 'INDEFINIDO', etiqueta: 'Indefinido' },
] as const;

const ESTADOS = [
  { valor: 'ACTIVO', etiqueta: 'Activo', nota: 'Habilitado para cobro de cuotas.' },
  { valor: 'INACTIVO', etiqueta: 'Inactivo', nota: 'Dado de baja del padrón.' },
] as const;

const TIPOS_CUOTA = [
  { valor: 'NORMAL', etiqueta: 'Normal', monto: 15000, nota: 'Plan normal: $15.000.' },
  { valor: 'MEMBRESIA', etiqueta: 'Membresía', monto: 5000, nota: 'Plan reducido: $5.000.' },
  { valor: 'BECADO', etiqueta: 'Becado', monto: 0, nota: 'Exento de pago: $0.' },
  { valor: 'INVITADO', etiqueta: 'Invitado', monto: 0, nota: 'Invitado: $0, no aparece en cobro.' },
] as const;

const dosDigitos = (n: number) => String(n).padStart(2, '0');

function hoyISO(): string {
  const hoy = new Date();
  return `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`;
}

function esFechaReal(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio &&
    fecha.getUTCMonth() === mes - 1 &&
    fecha.getUTCDate() === dia
  );
}

function fechaOpcional(minimo: string, etiqueta: string) {
  return z
    .union([
      z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'Usa una fecha válida')
        .refine(esFechaReal, 'La fecha no existe en el calendario')
        .refine((v) => v >= minimo, `${etiqueta} demasiado antigua`)
        .refine((v) => v <= hoyISO(), `${etiqueta} no puede ser futura`),
      z.literal(''),
    ])
    .optional();
}

const schema = z.object({
  rut: z
    .string()
    .trim()
    .min(1, 'Ingresa el RUT')
    .transform((v) => v.replace(/\./g, '').replace(/-/g, '').toUpperCase())
    .pipe(z.string().regex(/^\d{7,8}[0-9K]$/, 'RUT inválido: 7-8 dígitos más dígito verificador')),
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(160, 'Nombre muy largo'),
  anio: z.number().int().min(2020, 'Año mínimo 2020').max(2100, 'Año máximo 2100'),
  sexo: z.enum(['HOMBRE', 'MUJER', 'INDEFINIDO']).optional().or(z.literal('')),
  fechaNacimiento: fechaOpcional('1900-01-01', 'Fecha de nacimiento'),
  fechaIngreso: fechaOpcional('1950-01-01', 'Fecha de ingreso'),
  direccion: z
    .string()
    .trim()
    .max(255, 'Máximo 255 caracteres')
    .refine((v) => v.length === 0 || v.length >= 3, 'Dirección muy corta')
    .optional()
    .or(z.literal('')),
  estado: estadoSocioSchema.optional().or(z.literal('')),
  tipoCuota: tipoCuotaSchema.optional().or(z.literal('')),
  montoCuota: z.number().int().nonnegative().optional(),
  motivoCambioTipoCuota: z.string().trim().max(255).optional().or(z.literal('')),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().max(30, 'Máximo 30 caracteres').optional(),
});

export type SocioFormValues = {
  rut: string;
  nombre: string;
  anio: number;
  sexo?: string;
  fechaNacimiento?: string;
  fechaIngreso?: string;
  direccion?: string;
  estado: string;
  tipoCuota?: string;
  montoCuota?: number;
  motivoCambioTipoCuota?: string;
  email?: string;
  telefono?: string;
};

type Props = {
  initial?: Partial<SocioFormValues>;
  onSubmit: (values: SocioFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  titulo?: string;
  serverError?: string | null;
};

export default function SocioForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar socio',
  titulo = 'Nuevo socio',
  serverError,
}: Props) {
  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SocioFormValues>({
    resolver: zodResolver(schema) as unknown as Resolver<SocioFormValues>,
    mode: 'onBlur',
    defaultValues: {
      rut: initial?.rut ?? '',
      nombre: initial?.nombre ?? '',
      anio: initial?.anio ?? new Date().getFullYear(),
      sexo: initial?.sexo ?? '',
      fechaNacimiento: initial?.fechaNacimiento ?? '',
      fechaIngreso: initial?.fechaIngreso ?? '',
      direccion: initial?.direccion ?? '',
      estado: initial?.estado ?? 'ACTIVO',
      tipoCuota: initial?.tipoCuota ?? 'NORMAL',
      montoCuota: initial?.montoCuota ?? montoCuotaPorTipo('NORMAL'),
      motivoCambioTipoCuota: initial?.motivoCambioTipoCuota ?? '',
      email: initial?.email ?? '',
      telefono: initial?.telefono ?? '',
    },
  });

  const estadoActual = watch('estado');
  const tipoCuotaActual = watch('tipoCuota');

  const formatoClp = (n: number) => `$${n.toLocaleString('es-CL')}`;

  const inputClass = (invalid: boolean) =>
    `w-full rounded-lg border bg-background px-3 py-2.5 text-[13.5px] text-foreground placeholder:text-muted-foreground/70 transition-colors focus:outline-none focus:ring-2 focus:ring-ring/25 focus:border-ring ${
      invalid ? 'border-primary' : 'border-input'
    }`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex max-h-[92vh] flex-col">
      {/* Cabecera con acento de marca */}
      <header className="relative shrink-0 border-b border-border bg-secondary/40 px-6 pt-5 pb-4">
        <div className="absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r from-primary via-red-600 to-red-900" />
        <div className="flex items-start gap-3">
          <div
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-[13px] font-bold text-primary-foreground shadow-sm"
            aria-hidden="true"
          >
            OR
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-[18px] font-bold tracking-tight">{titulo}</h2>
            <p className="mt-0.5 text-[12.5px] text-muted-foreground">
              Los campos con <span className="font-bold text-primary">*</span> son obligatorios. Los
              ejemplos te ayudan a registrar bien cada dato.
            </p>
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Cerrar formulario"
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-card text-[13px] text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-ring/25"
            >
              ✕
            </button>
          )}
        </div>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
        <Seccion titulo="Identificación">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="rut"
              etiqueta="RUT"
              requerido
              error={errors.rut?.message}
              ayuda="Ej.: 12.345.678-9. Se limpia solo: sin puntos ni guion."
            >
              <input
                id="rut"
                inputMode="text"
                autoComplete="off"
                maxLength={12}
                placeholder="12.345.678-9"
                aria-invalid={errors.rut ? 'true' : 'false'}
                className={`${inputClass(!!errors.rut)} font-mono`}
                {...register('rut')}
              />
            </Campo>
            <Campo
              id="nombre"
              etiqueta="Nombre completo"
              requerido
              error={errors.nombre?.message}
              ayuda="Ej.: Camila Andrea Rojas Muñoz. Nombre y apellido como deben salir en el padrón."
            >
              <input
                id="nombre"
                autoComplete="name"
                placeholder="Camila Andrea Rojas Muñoz"
                aria-invalid={errors.nombre ? 'true' : 'false'}
                className={inputClass(!!errors.nombre)}
                {...register('nombre')}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Datos personales">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              id="sexo"
              etiqueta="Sexo"
              error={errors.sexo?.message}
              ayuda="Elige Hombre, Mujer o Indefinido. Sin dato también es válido."
            >
              <select id="sexo" className={inputClass(!!errors.sexo)} {...register('sexo')}>
                <option value="">Sin especificar</option>
                {SEXOS.map((s) => (
                  <option key={s.valor} value={s.valor}>
                    {s.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id="fechaNacimiento"
              etiqueta="Fecha de nacimiento"
              error={errors.fechaNacimiento?.message}
              ayuda="Ej.: 15-03-1990. Se usa para categorías por edad."
            >
              <input
                id="fechaNacimiento"
                type="date"
                min="1900-01-01"
                max={hoyISO()}
                aria-invalid={errors.fechaNacimiento ? 'true' : 'false'}
                className={inputClass(!!errors.fechaNacimiento)}
                {...register('fechaNacimiento')}
              />
            </Campo>
            <Campo
              id="fechaIngreso"
              etiqueta="Fecha de ingreso"
              error={errors.fechaIngreso?.message}
              ayuda="Ej.: 01-03-2021. Día en que se integró al club."
            >
              <input
                id="fechaIngreso"
                type="date"
                min="1950-01-01"
                max={hoyISO()}
                aria-invalid={errors.fechaIngreso ? 'true' : 'false'}
                className={inputClass(!!errors.fechaIngreso)}
                {...register('fechaIngreso')}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Contacto">
          <Campo
            id="direccion"
            etiqueta="Dirección"
            error={errors.direccion?.message}
            ayuda="Ej.: Av. Juan Mackenna 1234, Osorno. Escribe y elige una sugerencia para validarla."
          >
            <Controller
              control={control}
              name="direccion"
              render={({ field, fieldState }) => (
                <CampoDireccion
                  valor={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  error={!!fieldState.error}
                  inputClass={inputClass}
                />
              )}
            />
          </Campo>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Campo
              id="email"
              etiqueta="Email"
              error={errors.email?.message}
              ayuda="Ej.: camila.rojas@correo.cl. Sirve para avisos y comprobantes."
            >
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="camila.rojas@correo.cl"
                aria-invalid={errors.email ? 'true' : 'false'}
                className={inputClass(!!errors.email)}
                {...register('email')}
              />
            </Campo>
            <Campo
              id="telefono"
              etiqueta="Teléfono"
              error={errors.telefono?.message}
              ayuda="Ej.: +56 9 1234 5678. Celular o teléfono de contacto."
            >
              <input
                id="telefono"
                type="tel"
                autoComplete="tel"
                placeholder="+56 9 1234 5678"
                aria-invalid={errors.telefono ? 'true' : 'false'}
                className={inputClass(!!errors.telefono)}
                {...register('telefono')}
              />
            </Campo>
          </div>
        </Seccion>

        <Seccion titulo="Membresía">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              id="anio"
              etiqueta="Año de la membresía"
              requerido
              error={errors.anio?.message}
              ayuda="Ej.: 2026. Es el año de la cuota que se cobra, no el de nacimiento."
            >
              <input
                id="anio"
                type="number"
                min={2020}
                max={2100}
                inputMode="numeric"
                aria-invalid={errors.anio ? 'true' : 'false'}
                className={`${inputClass(!!errors.anio)} font-mono`}
                {...register('anio', { valueAsNumber: true })}
              />
            </Campo>
            <Campo
              id="estado"
              etiqueta="Estado"
              requerido
              error={errors.estado?.message}
              ayuda={ESTADOS.find((e) => e.valor === estadoActual)?.nota ?? 'Define cuánto paga el socio.'}
            >
              <select id="estado" className={inputClass(!!errors.estado)} {...register('estado')}>
                {ESTADOS.map((e) => (
                  <option key={e.valor} value={e.valor}>
                    {e.etiqueta}
                  </option>
                ))}
              </select>
            </Campo>
            <Campo
              id="tipoCuota"
              etiqueta="Tipo de cuota"
              requerido
              error={errors.tipoCuota?.message}
              ayuda="Define el tipo de plan de cuota que se le asigna al socio."
            >
              <select
                id="tipoCuota"
                className={inputClass(!!errors.tipoCuota)}
                {...register('tipoCuota')}
              >
                {TIPOS_CUOTA.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.etiqueta} ({formatoClp(t.monto)})
                  </option>
                ))}
              </select>
            </Campo>
            {tipoCuotaActual === 'MEMBRESIA' && (
              <Campo
                id="motivoCambioTipoCuota"
                etiqueta="Motivo de membresía"
                requerido
                error={errors.motivoCambioTipoCuota?.message}
                ayuda="Indica por qué este socio tiene membresía reducida."
              >
                <input
                  id="motivoCambioTipoCuota"
                  className={inputClass(!!errors.motivoCambioTipoCuota)}
                  {...register('motivoCambioTipoCuota')}
                />
              </Campo>
            )}
            {tipoCuotaActual === 'BECADO' && (
              <Campo
                id="notaBecado"
                etiqueta="Nota"
                requerido={false}
                error={undefined}
                ayuda="Becado por edad (60 años). Requiere aprobación del tesorero."
              >
                <span className="text-[12.5px] text-warning">
                  Este socio será exento de pago ($0) una vez el tesorero apruebe el becado.
                </span>
              </Campo>
            )}
            {tipoCuotaActual === 'INVITADO' && (
              <Campo
                id="notaInvitado"
                etiqueta="Nota"
                requerido={false}
                error={undefined}
                ayuda="Invitado: no paga cuota y no aparece en los estados de cobro."
              >
                <span className="text-[12.5px] text-warning">
                  Este socio es invitado/influencer. No paga cuota y no aparece en el padrón de cobro.
                </span>
              </Campo>
            )}
          </div>
        </Seccion>

        {serverError && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-primary/20 bg-accent px-3 py-2.5 text-[12.5px] font-medium text-accent-foreground"
          >
            <span aria-hidden="true">⚠</span>
            <span>{serverError}</span>
          </div>
        )}
      </div>

      <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-border px-6 py-4">
        <p className="text-[11.5px] text-muted-foreground">
          Se guarda en el padrón del club. La baja es siempre lógica.
        </p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-lg border border-border px-4 py-2.5 text-[13px] font-medium text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-lg bg-primary px-5 py-2.5 text-[13.5px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {isSubmitting ? 'Guardando…' : submitLabel}
          </button>
        </div>
      </footer>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Piezas internas
// ---------------------------------------------------------------------------

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border/80 bg-secondary/20 p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-4 w-[3px] rounded-full bg-primary" aria-hidden="true" />
        <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/80">
          {titulo}
        </h3>
      </div>
      {children}
    </section>
  );
}

function Campo({
  id,
  etiqueta,
  requerido = false,
  error,
  ayuda,
  children,
}: {
  id: string;
  etiqueta: string;
  requerido?: boolean;
  error?: string;
  ayuda?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 flex items-baseline gap-1 text-[12.5px] font-semibold">
        {etiqueta}
        {requerido ? (
          <span className="text-primary" aria-label="obligatorio">
            *
          </span>
        ) : (
          <span className="text-[10.5px] font-medium text-muted-foreground">(opcional)</span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-1.5 text-[11.5px] font-medium text-primary">
          {error}
        </p>
      ) : (
        ayuda && (
          <p className="mt-1.5 text-[11.5px] leading-snug text-muted-foreground">
            <span aria-hidden="true" className="mr-1 text-primary/70">
              ↳
            </span>
            {ayuda}
          </p>
        )
      )}
    </div>
  );
}

function CampoDireccion({
  valor,
  onChange,
  onBlur,
  error,
  inputClass,
}: {
  valor: string;
  onChange: (valor: string) => void;
  onBlur: () => void;
  error: boolean;
  inputClass: (invalid: boolean) => string;
}) {
  const [tocado, setTocado] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [validada, setValidada] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [fallo, setFallo] = useState(false);
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([]);
  const [proveedor, setProveedor] = useState<RespuestaDirecciones['proveedor'] | null>(null);

  const seleccionada = useRef('');
  const solicitud = useRef(0);
  const contenedor = useRef<HTMLDivElement>(null);

  // Si la persona borra la dirección, se limpia también el estado de validación.
  useEffect(() => {
    if (valor.trim().length === 0) {
      setValidada(false);
      setSugerencias([]);
      setAbierto(false);
      seleccionada.current = '';
    }
  }, [valor]);

  // Búsqueda con retardo: 550 ms después de la última tecla.
  useEffect(() => {
    const consulta = valor.trim();
    if (!tocado || consulta.length < 4 || consulta === seleccionada.current) return;

    const id = ++solicitud.current;
    setBuscando(true);
    setFallo(false);
    setSinResultados(false);

    const timer = window.setTimeout(async () => {
      try {
        const respuesta = await buscarDirecciones(consulta);
        if (solicitud.current !== id) return;
        setProveedor(respuesta.proveedor);
        setSugerencias(respuesta.resultados);
        setAbierto(respuesta.resultados.length > 0);
        setSinResultados(respuesta.resultados.length === 0);
      } catch {
        if (solicitud.current !== id) return;
        setSugerencias([]);
        setAbierto(false);
        setFallo(true);
      } finally {
        if (solicitud.current === id) setBuscando(false);
      }
    }, 550);

    return () => window.clearTimeout(timer);
  }, [valor, tocado]);

  // Cierra la lista al hacer clic fuera.
  useEffect(() => {
    if (!abierto) return;
    const alClic = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) setAbierto(false);
    };
    document.addEventListener('mousedown', alClic);
    return () => document.removeEventListener('mousedown', alClic);
  }, [abierto]);

  const seleccionar = (sugerencia: SugerenciaDireccion) => {
    seleccionada.current = sugerencia.direccion.trim();
    onChange(sugerencia.direccion);
    setSugerencias([]);
    setAbierto(false);
    setValidada(true);
    setSinResultados(false);
    setFallo(false);
  };

  const mensaje = validada
    ? 'Dirección validada'
    : buscando
      ? 'Buscando coincidencias…'
      : fallo
        ? 'No se pudo validar ahora. Puedes guardarla igual.'
        : sinResultados
          ? 'Sin coincidencias exactas. Revisa el número o guárdala tal como está.'
          : !tocado && valor.trim()
            ? 'Dirección guardada. Escribe para volver a validarla.'
            : 'Elige una sugerencia para confirmar que la dirección existe.';

  return (
    <div ref={contenedor} className="relative">
      <input
        id="direccion"
        type="text"
        autoComplete="street-address"
        placeholder="Av. Juan Mackenna 1234, Osorno"
        value={valor}
        aria-invalid={error ? 'true' : 'false'}
        className={inputClass(error)}
        onChange={(evento) => {
          setTocado(true);
          setValidada(false);
          setSinResultados(false);
          setFallo(false);
          setAbierto(false);
          onChange(evento.target.value);
        }}
        onKeyDown={(evento) => {
          if (evento.key === 'Escape') setAbierto(false);
        }}
        onBlur={() => {
          onBlur();
          window.setTimeout(() => setAbierto(false), 140);
        }}
      />

      <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] leading-snug">
        <span
          role="status"
          className={
            validada
              ? 'font-medium text-success'
              : fallo
                ? 'text-warning'
                : 'text-muted-foreground'
          }
        >
          {validada && <span aria-hidden="true">✓ </span>}
          {mensaje}
        </span>
        {validada && (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(valor)}`}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Ver en Google Maps
          </a>
        )}
        {proveedor && validada && (
          <span className="text-muted-foreground">
            · {proveedor === 'google' ? 'Google Maps' : 'OpenStreetMap'}
          </span>
        )}
      </div>

      {abierto && sugerencias.length > 0 && (
        <ul
          aria-label="Sugerencias de dirección"
          className="absolute z-30 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-border bg-card py-1 shadow-xl"
        >
          {sugerencias.map((sugerencia, indice) => (
            <li key={`${sugerencia.direccion}-${indice}`}>
              <button
                type="button"
                onMouseDown={(evento) => evento.preventDefault()}
                onClick={() => seleccionar(sugerencia)}
                className="block w-full px-3 py-2 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
              >
                <span className="block text-[12.5px] font-medium text-foreground">
                  {sugerencia.direccion}
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                  {sugerencia.detalle}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}