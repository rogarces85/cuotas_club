import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signIn } from '../lib/auth-client';

/**
 * Pantalla de acceso al sistema.
 *
 * Usa React Hook Form + Zod (la convención del proyecto para formularios) y
 * Better Auth para verificar credenciales. Al autenticar, la sesión queda en
 * cookie y App.tsx cambia al shell.
 */

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Ingresa tu correo').email('Correo inválido'),
  password: z.string().min(8, 'La clave debe tener al menos 8 caracteres'),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = async (values: LoginForm) => {
    setServerError(null);
    const { error } = await signIn.email({
      email: values.email,
      password: values.password,
    });

    if (error) {
      setServerError(
        error.status === 401
          ? 'Correo o clave incorrectos.'
          : 'No se pudo iniciar sesión. Inténtalo de nuevo.',
      );
    }
    // Si no hay error, useSession() detecta la sesión y App muestra el shell.
  };

  return (
    <div className="min-h-screen grid place-items-center bg-secondary p-4">
      <div className="w-full max-w-[380px]">
        {/* Marca */}
        <div className="text-center mb-7">
          <div className="inline-block px-4 py-2 rounded-lg bg-black">
            <div className="text-[15px] font-bold tracking-[0.08em] text-white">
              OSORNO <span className="text-sidebar-muted font-normal">RUNNERS</span>
            </div>
          </div>
          <h1 className="mt-5 text-[19px] font-bold tracking-tight">Sistema de cuotas</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Acceso para la directiva del club</p>
        </div>

        {/* Formulario */}
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="bg-card border border-border rounded-[10px] p-6 space-y-4"
          noValidate
        >
          <div>
            <label htmlFor="email" className="block text-[12.5px] font-semibold mb-1.5">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="tesorero@osornorunners.cl"
              aria-invalid={errors.email ? 'true' : 'false'}
              className={`w-full px-3 py-2.5 border rounded-lg text-[13.5px] bg-background ${
                errors.email ? 'border-primary' : 'border-input'
              }`}
              {...register('email')}
            />
            {errors.email && (
              <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="block text-[12.5px] font-semibold mb-1.5">
              Clave
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              aria-invalid={errors.password ? 'true' : 'false'}
              className={`w-full px-3 py-2.5 border rounded-lg text-[13.5px] bg-background ${
                errors.password ? 'border-primary' : 'border-input'
              }`}
              {...register('password')}
            />
            {errors.password && (
              <p className="mt-1.5 text-[11.5px] text-primary font-medium">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <div
              role="alert"
              className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-accent text-accent-foreground text-[12.5px] font-medium"
            >
              <span aria-hidden="true">⚠</span>
              <span>{serverError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-primary text-primary-foreground rounded-lg py-2.5 text-[13.5px] font-semibold disabled:opacity-60"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="text-center text-[11.5px] text-muted-foreground mt-5">
          Osorno Runners · Temporada 2026
        </p>
      </div>
    </div>
  );
}
