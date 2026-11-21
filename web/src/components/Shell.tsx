import { signOut } from '../lib/auth-client';
import SociosPage from '../pages/SociosPage';
import CuotasPage from '../pages/CuotasPage';
import PagosPage from '../pages/PagosPage';
import EstadoCuentaPage from '../pages/EstadoCuentaPage';
import BancosPage from '../pages/BancosPage';
import ReportesPage from '../pages/ReportesPage';
import ConfiguracionPage from '../pages/ConfiguracionPage';

/**
 * Shell del sistema — sidebar negra, contenido blanco, rojo como acento.
 * La navegación es por estado (sin router): cada sección con módulo real
 * renderiza su página; las que faltan muestran un placeholder.
 *
 * Props:
 * - user: datos del usuario autenticado.
 * - activeItem: clave de la sección activa ('panel' | 'socios' | 'cuotas').
 * - onItemClick: se llama al hacer clic en un ítem del sidebar.
 */

type NavItem = { key: string; label: string; count?: number };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Club',
    items: [
      { key: 'panel', label: 'Panel' },
      { key: 'socios', label: 'Socios' },
      { key: 'cuentas', label: 'Cuentas bancarias' },
    ],
  },
  {
    label: 'Cobranza',
    items: [
      { key: 'cuotas', label: 'Cuotas' },
      { key: 'pagos', label: 'Pagos', count: 0 },
      { key: 'morosidad', label: 'Morosidad', count: 0 },
      { key: 'estado', label: 'Estado de cuenta' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { key: 'bancos', label: 'Bancos' },
      { key: 'gastos', label: 'Gastos' },
      { key: 'reportes', label: 'Reportes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { key: 'config', label: 'Configuración' },
      { key: 'usuarios', label: 'Usuarios' },
    ],
  },
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type Props = {
  user: { name?: string | null; email: string };
  activeItem: string;
  onItemClick: (label: string) => void;
};

export default function Shell({ user, activeItem, onItemClick }: Props) {
  return (
    <div className="flex min-h-screen">
      {/* ============ Sidebar ============ */}
      <aside className="w-[260px] shrink-0 flex flex-col sticky top-0 h-screen bg-sidebar text-sidebar-foreground">
        <div className="flex items-center px-[18px] py-[18px] border-b border-sidebar-border">
          <div className="text-[13px] font-bold tracking-[0.08em]">
            OSORNO <span className="text-sidebar-muted font-normal">RUNNERS</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-[10px] py-[14px]">
          {groups.map((g) => (
            <div key={g.label} className="mb-[18px]">
              <div className="px-[10px] mb-[7px] text-[10px] uppercase tracking-[0.14em] font-semibold text-sidebar-muted">
                {g.label}
              </div>
              {g.items.map((item) => (
                <button
                  key={item.key}
                  onClick={() => onItemClick(item.key)}
                  className={`relative flex items-center gap-[10px] px-[10px] py-[8px] rounded-lg text-[13px] mb-px w-full text-left ${
                    activeItem === item.key
                      ? 'bg-sidebar-accent text-white font-semibold'
                      : 'text-[#d6d6d6] hover:bg-sidebar-accent hover:text-white'
                  }`}
                >
                  {activeItem === item.key && (
                    <span className="absolute left-[-10px] top-[8px] bottom-[8px] w-[3px] bg-sidebar-primary rounded-r" />
                  )}
                  <span className="w-4 h-4 flex items-center justify-center opacity-75 text-[11px]">•</span>
                  {item.label}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="ml-auto bg-sidebar-primary text-white text-[10.5px] font-bold px-[6px] rounded-full font-mono">
                      {item.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="px-[18px] py-[14px] border-t border-sidebar-border">
          <div className="flex gap-[6px] mb-[8px]">
            <span className="w-[22px] h-[22px] rounded bg-primary" title="Rojo #DF022F" />
            <span className="w-[22px] h-[22px] rounded bg-black border border-white/20" title="Negro" />
            <span className="w-[22px] h-[22px] rounded bg-white" title="Blanco" />
          </div>
          <div className="text-[10.5px] text-sidebar-muted">Temporada 2026 · v0.1</div>
        </div>
      </aside>

      {/* ============ Main ============ */}
      <div className="flex-1 min-w-0 flex flex-col bg-background">
        <header className="flex items-center gap-4 h-16 px-6 border-b border-border bg-background sticky top-0 z-5">
          <div className="flex-1 max-w-[420px] relative">
            <input
              className="w-full pl-[34px] pr-[40px] py-[9px] border border-input rounded-lg bg-card text-[13px]"
              placeholder="Buscar socio, cuota o comprobante…"
              disabled
            />
            <span className="absolute right-[9px] top-1/2 -translate-y-1/2 font-mono text-[10.5px] text-muted-foreground border border-border rounded px-[5px] py-px">
              ⌘K
            </span>
          </div>
          <button className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold">
            Registrar pago
          </button>
          <div className="ml-auto flex items-center gap-[9px] pl-4 border-l border-border">
            <span className="w-8 h-8 rounded-full bg-primary text-white grid place-items-center text-[11.5px] font-bold">
              {initials(user.name ?? user.email)}
            </span>
            <div className="leading-tight">
              <div className="text-[12.5px] font-semibold">{user.name ?? user.email}</div>
              <div className="text-[11px] text-muted-foreground">{user.email}</div>
            </div>
            <button
              onClick={() => void signOut()}
              className="ml-2 text-[11.5px] font-medium text-muted-foreground hover:text-primary border border-border rounded-md px-2 py-1"
            >
              Salir
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1500px] w-full overflow-y-auto">
          {activeItem === 'socios' ? (
            <SociosPage />
          ) : activeItem === 'cuotas' ? (
            <CuotasPage />
          ) : activeItem === 'pagos' ? (
            <PagosPage />
          ) : activeItem === 'morosidad' ? (
            <EstadoCuentaPage />
          ) : activeItem === 'estado' ? (
            <EstadoCuentaPage />
          ) : activeItem === 'bancos' ? (
            <BancosPage />
          ) : activeItem === 'reportes' ? (
            <ReportesPage />
          ) : activeItem === 'config' ? (
            <ConfiguracionPage />
          ) : (
            <div className="p-6">
              <h1 className="text-[21px] font-bold tracking-tight">Panel</h1>
              <p className="text-[13px] text-muted-foreground mt-[3px]">
                Resumen de cobranza del club · Noviembre 2026
              </p>
              <div className="mt-5 bg-card border border-dashed border-border rounded-[10px] p-8 text-center text-muted-foreground text-sm">
                Los módulos de socios y cuotas están disponibles desde la barra lateral.
                Los indicadores de esta pantalla son de muestra.
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
