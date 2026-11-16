import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Formulario de alta y edición de socios.
 *
 * El RUT se normaliza al enviar: sin puntos ni guion, K en mayúscula.
 * El año y el estado son los campos que importan para cuotas (M2).
 */

const schema = z.object({
  rut: z
    .string()
    .trim()
    .min(1, 'Ingresa el RUT')
    .transform((v) => v.replace(/\./g, '').replace(/-/g, '').toUpperCase())
    .pipe(z.string().regex(/^\d{7,8}[0-9K]$/, 'RUT inválido: 7-8 dígitos más dígito verificador')),
  nombre: z.string().trim().min(2, 'Nombre muy corto').max(160, 'Nombre muy largo'),
  anio: z.number().int().min(2020, 'Año mínimo 2020').max(2100, 'Año máximo 2100'),
  sexo: z.string().trim().max(20).optional().or(z.literal('')),
  estado: z.string().trim().min(1).max(30),
  email: z.string().trim().email('Email inválido').optional().or(z.literal('')),
  telefono: z.string().trim().max(30).optional(),
});

export type SocioFormValues = {
  rut: string;
  nombre: string;
  anio: number;
  sexo?: string;
  estado: string;
  email?: string;
  telefono?: string;
};

const ESTADOS = ['ACTIVO', 'MEMBRESIA', 'BECADO'];

type Props = {
  initial?: Partial<SocioFormValues>;
  onSubmit: (values: SocioFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  serverError?: string | null;
};

export default function SocioForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar socio',
  serverError,
}: Props) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SocioFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      rut: initial?.rut ?? '',
      nombre: initial?.nombre ?? '',
      anio: initial?.anio ?? new Date().getFullYear(),
      sexo: initial?.sexo ?? '',
      estado: initial?.estado ?? 'ACTIVO',
      email: initial?.email ?? '',
      telefono: initial?.telefono ?? '',
    },
  });

  const inputClass = (invalid: boolean) =>
    `w-full px-3 py-2.5 border rounded-lg text-[13.5px] bg-background ${
      invalid ? 'border-primary' : 'border-input'
    }`;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="rut" className="block text-[12.5px] font-semibold mb-1.5">
            RUT
          </label>
          <input
            id="rut"
            placeholder="17682512K"
            aria-invalid={errors.rut ? 'true' : 'false'}
            className={inputClass(!!errors.rut)}
            {...register('rut')}
          />
          {errors.rut && <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.rut.message}</p>}
        </div>
        <div>
          <label htmlFor="nombre" className="block text-[12.5px] font-semibold mb-1.5">
            Nombre
          </label>
          <input
            id="nombre"
            placeholder="Nombre y apellido"
            aria-invalid={errors.nombre ? 'true' : 'false'}
            className={inputClass(!!errors.nombre)}
            {...register('nombre')}
          />
          {errors.nombre && (
            <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.nombre.message}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="anio" className="block text-[12.5px] font-semibold mb-1.5">
            Año
          </label>
          <input
            id="anio"
            type="number"
            aria-invalid={errors.anio ? 'true' : 'false'}
            className={inputClass(!!errors.anio)}
            {...register('anio', { valueAsNumber: true })}
          />
          {errors.anio && <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.anio.message}</p>}
        </div>
        <div>
          <label htmlFor="sexo" className="block text-[12.5px] font-semibold mb-1.5">
            Sexo
          </label>
          <input id="sexo" placeholder="M / F (opcional)" className={inputClass(!!errors.sexo)} {...register('sexo')} />
        </div>
      </div>

      <div>
        <label htmlFor="estado" className="block text-[12.5px] font-semibold mb-1.5">
          Estado
        </label>
        <select id="estado" className={inputClass(!!errors.estado)} {...register('estado')}>
          {ESTADOS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        {errors.estado && (
          <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.estado.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="email" className="block text-[12.5px] font-semibold mb-1.5">
            Email
          </label>
          <input id="email" type="email" placeholder="opcional" className={inputClass(!!errors.email)} {...register('email')} />
          {errors.email && (
            <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.email.message}</p>
          )}
        </div>
        <div>
          <label htmlFor="telefono" className="block text-[12.5px] font-semibold mb-1.5">
            Teléfono
          </label>
          <input id="telefono" placeholder="opcional" className={inputClass(!!errors.telefono)} {...register('telefono')} />
        </div>
      </div>

      {serverError && (
        <div role="alert" className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent text-accent-foreground text-[12.5px] font-medium">
          <span aria-hidden="true">⚠</span>
          <span>{serverError}</span>
        </div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg hover:text-foreground"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
