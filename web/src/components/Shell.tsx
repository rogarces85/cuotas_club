import { useEffect, useState } from 'react';
import { signOut } from '../lib/auth-client';
import { Icon, type IconName } from './icons';
import SociosPage from '../pages/SociosPage';
import CumpleanosPage from '../pages/CumpleanosPage';
import CuotasPage from '../pages/CuotasPage';
import PagosPage from '../pages/PagosPage';
import EstadoCuentaPage from '../pages/EstadoCuentaPage';
import BancosPage from '../pages/BancosPage';
import ReportesPage from '../pages/ReportesPage';
import ConfiguracionPage from '../pages/ConfiguracionPage';
import PanelPage from '../pages/PanelPage';
import CuentasBancariasPage from '../pages/CuentasBancariasPage';
import GastosPage from '../pages/GastosPage';

/**
 * Shell del sistema — sidebar negra, contenido blanco, rojo como acento.
 *
 * La sidebar es el ancla visual del club: monograma OR + wordmark, íconos por
 * módulo, el ítem activo como píldora roja y el pie con la temporada y el
 * usuario. Es plegable a un riel de íconos (76 px) para pantallas angostas.
 *
 * La navegación sigue por estado (sin router): cada sección con módulo real
 * renderiza su página; las que faltan muestran un placeholder.
 */

type NavItem = { key: string; label: string; icon: IconName; count?: number };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Club',
    items: [
      { key: 'panel', label: 'Panel', icon: 'panel' },
      { key: 'socios', label: 'Socios', icon: 'socios' },
      { key: 'cumpleanos', label: 'Cumpleaños', icon: 'cumpleanos' },
      { key: 'cuentas', label: 'Cuentas bancarias', icon: 'cuentas' },
    ],
  },
  {
    label: 'Cobranza',
    items: [
      { key: 'cuotas', label: 'Cuotas', icon: 'cuotas' },
      { key: 'pagos', label: 'Pagos', icon: 'pagos', count: 0 },
      { key: 'morosidad', label: 'Morosidad', icon: 'morosidad', count: 0 },
      { key: 'estado', label: 'Estado de cuenta', icon: 'estado' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { key: 'bancos', label: 'Bancos', icon: 'bancos' },
      { key: 'gastos', label: 'Gastos', icon: 'gastos' },
      { key: 'reportes', label: 'Reportes', icon: 'reportes' },
    ],
  },
  {
    label: 'Sistema',
    items: [{ key: 'config', label: 'Configuración', icon: 'config' }],
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
  /** Recibe la clave del ítem ('socios', 'cuotas', …), no su etiqueta. */
  onItemClick: (key: string) => void;
};

export default function Shell({ user, activeItem, onItemClick }: Props) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  // En pantallas angostas arranca plegado; al volver a escritorio se expande.
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 768px)');
    const alCambiar = (evento: MediaQueryListEvent) => setCollapsed(!evento.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* ============ Sidebar ============ */}
      <aside
        className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-300 ${
          collapsed ? 'w-[76px]' : 'w-[264px]'
        }`}
      >
        {/* Cabecera: monograma + wordmark */}
        <div className={`flex h-16 shrink-0 items-center border-b border-sidebar-border ${collapsed ? 'justify-between px-3' : 'px-4'}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary text-[12.5px] font-bold text-primary-foreground shadow-[0_2px_10px_rgba(223,2,47,0.4)]"
              aria-hidden="true"
            >
              OR
            </span>
            {!collapsed && (
              <div className="min-w-0 leading-none">
                <div className="text-[13px] font-bold tracking-[0.08em]">OSORNO</div>
                <div className="mt-[3px] text-[10px] font-medium tracking-[0.24em] text-sidebar-muted">
                  RUNNERS
                </div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`ml-auto grid h-7 w-7 shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              collapsed ? 'ml-0 mt-0' : ''
            }`}
          >
            <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={16} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-5 last:mb-0">
              {!collapsed && (
                <div className="mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted">
                  {g.label}
                </div>
              )}
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = activeItem === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onItemClick(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-xl py-2 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                        collapsed ? 'justify-center px-0' : 'px-2.5'
                      } ${
                        active
                          ? 'bg-primary font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(223,2,47,0.28)]'
                          : 'text-[#d6d6d6] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon name={item.icon} size={19} />
                      {!collapsed && (
                        <span className="flex-1 truncate text-left">{item.label}</span>
                      )}
                      {!collapsed && item.count !== undefined && item.count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-primary text-white'
                          }`}
                        >
                          {item.count}
                        </span>
                      )}
                      {collapsed && item.count !== undefined && item.count > 0 && (
                        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Pie: temporada + usuario */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'flex-col' : ''}`}>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-[11.5px] font-bold text-sidebar-foreground"
              title={user.name ?? user.email}
            >
              {initials(user.name ?? user.email)}
            </span>
            {!collapsed && (
              <div className="min-w-0 flex-1 leading-tight">
                <div className="truncate text-[12.5px] font-semibold">{user.name ?? user.email}</div>
                <div className="truncate text-[11px] text-sidebar-muted">{user.email}</div>
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <Icon name="logout" size={16} />
            </button>
          </div>

          {!collapsed && (
            <div className="mt-3 flex items-center justify-between px-1 text-[10.5px] text-sidebar-muted">
              <span>Temporada 2026</span>
              <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
            </div>
          )}
          {collapsed && (
            <div className="mt-2 flex justify-center">
              <span
                className="h-1.5 w-1.5 rounded-full bg-success"
                title="Temporada 2026 activa"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
      </aside>

      {/* ============ Main ============ */}
      <div className="flex min-w-0 flex-1 flex-col bg-background">
        <header className="sticky top-0 z-5 flex h-16 items-center gap-4 border-b border-border bg-background px-6">
          <div className="relative max-w-[420px] flex-1">
            <input
              className="w-full rounded-lg border border-input bg-card py-[9px] pl-[34px] pr-[40px] text-[13px]"
              placeholder="Buscar socio, cuota o comprobante…"
              disabled
            />
            <span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">
              ⌕
            </span>
            <span className="absolute right-[9px] top-1/2 -translate-y-1/2 rounded border border-border px-[5px] py-px font-mono text-[10.5px] text-muted-foreground">
              ⌘K
            </span>
          </div>
          <button className="ml-auto rounded-lg bg-primary px-[14px] py-[9px] text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            Registrar pago
          </button>
        </header>

        <main className="flex-1 w-full max-w-[1500px] overflow-y-auto p-6">
          {activeItem === 'socios' ? (
            <SociosPage />
          ) : activeItem === 'cumpleanos' ? (
            <CumpleanosPage />
          ) : activeItem === 'cuentas' ? (
            <CuentasBancariasPage />
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
          ) : activeItem === 'gastos' ? (
            <GastosPage />
          ) : activeItem === 'reportes' ? (
            <ReportesPage />
          ) : activeItem === 'config' ? (
            <ConfiguracionPage />
          ) : (
            <PanelPage />
          )}
        </main>
      </div>
    </div>
  );
}
