import { useState } from 'react';
import { useSession } from './lib/auth-client';
import LoginPage from './pages/LoginPage';
import Shell from './components/Shell';

/**
 * Puerta de entrada del sistema.
 *
 * Sin sesión → pantalla de login.
 * Con sesión → shell del club con navegación entre vistas (Panel, Socios, Cuotas).
 *
 * La sesión vive en cookie (Better Auth) y useSession() la resuelve al cargar.
 */

type View = 'panel' | 'socios' | 'cuotas';

export default function App() {
  const { data: session, isPending } = useSession();
  const [view, setView] = useState<View>('panel');

  if (isPending) {
    return (
      <div className="min-h-screen grid place-items-center bg-secondary">
        <div className="text-center">
          <div className="w-8 h-8 rounded-full border-2 border-border border-t-primary animate-spin mx-auto" />
          <p className="mt-3 text-[13px] text-muted-foreground">Cargando…</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Shell
      user={{ name: session.user.name, email: session.user.email }}
      activeItem={view}
      onItemClick={(label) => {
        if (label === 'Socios') setView('socios');
        else if (label === 'Cuotas') setView('cuotas');
        else setView('panel');
      }}
    />
  );
}
