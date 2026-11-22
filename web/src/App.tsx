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

type View = 'panel' | 'socios' | 'cumpleanos' | 'becados' | 'cuentas' | 'cuotas' | 'pagos' | 'morosidad' | 'estado' | 'bancos' | 'gastos' | 'reportes' | 'config';

const VIEWS: readonly View[] = [
  'panel', 'socios', 'cumpleanos', 'becados', 'cuentas', 'cuotas', 'pagos', 'morosidad', 'estado', 'bancos', 'gastos', 'reportes', 'config',
];

export default function App() {
  const { data: session, isPending } = useSession();
  const [view, setView] = useState<View>('panel');
  const [search, setSearch] = useState('');

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
      search={search}
      onSearchChange={setSearch}
      onItemClick={(key) => {
        if ((VIEWS as readonly string[]).includes(key)) setView(key as View);
      }}
    />
  );
}