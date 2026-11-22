import { useEffect, useRef, useState } from 'react';
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
 * Responsive:
 * - Escritorio (≥768 px): sidebar visible, plegable a un riel de 76 px.
 * - Móvil (<768 px): sidebar fuera de pantalla; se abre como cajón con el
 *   botón de menú del header y se cierra al elegir una sección, con Escape
 *   o tocando el fondo.
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobileRef = useRef<HTMLButtonElement>(null);

  // Al volver a escritorio se expande y se cierra el cajón móvil.
  useEffect(() => {
    const consulta = window.matchMedia('(min-width: 768px)');
    const alCambiar = (evento: MediaQueryListEvent) => {
      setCollapsed(!evento.matches);
      if (evento.matches) setMobileOpen(false);
    };
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  // Cajón móvil: bloquea el scroll de fondo, enfoca el cierre y cierra con Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeMobileRef.current?.focus();
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') setMobileOpen(false);
    };
    document.addEventListener('keydown', alTeclear);
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener('keydown', alTeclear);
    };
  }, [mobileOpen]);

  const navegar = (key: string) => {
    onItemClick(key);
    setMobileOpen(false);
  };

  return (
    <div className="flex min-h-screen">
      {/* Fondo del cajón móvil */}
      {mobileOpen && (
        <div
          id="sidebar-backdrop"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[1px] md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ============ Sidebar ============ */}
      <aside
        id="sidebar"
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[264px] shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 md:sticky md:top-0 md:bottom-auto md:z-auto md:h-screen md:translate-x-0 md:transition-[width] ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        } ${collapsed ? 'md:w-[76px]' : 'md:w-[264px]'}`}
      >
        {/* Cabecera: monograma + wordmark */}
        <div
          className={`flex h-16 shrink-0 items-center border-b border-sidebar-border px-4 ${
            collapsed ? 'md:justify-center md:px-3' : ''
          }`}
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary text-[12.5px] font-bold text-primary-foreground shadow-[0_2px_10px_rgba(223,2,47,0.4)]"
              aria-hidden="true"
            >
              OR
            </span>
            <div className={`min-w-0 leading-none ${collapsed ? 'md:hidden' : ''}`}>
              <div className="text-[13px] font-bold tracking-[0.08em]">OSORNO</div>
              <div className="mt-[3px] text-[10px] font-medium tracking-[0.24em] text-sidebar-muted">
                RUNNERS
              </div>
            </div>
          </div>
          <button
            ref={closeMobileRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menú"
            className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 md:hidden"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Navegación */}
        <nav className="sidebar-scroll flex-1 overflow-y-auto px-3 py-4">
          {groups.map((g) => (
            <div key={g.label} className="mb-5 last:mb-0">
              <div
                className={`mb-1.5 px-2.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-muted ${
                  collapsed ? 'md:hidden' : ''
                }`}
              >
                {g.label}
              </div>
              <div className="space-y-0.5">
                {g.items.map((item) => {
                  const active = activeItem === item.key;
                  return (
                    <button
                      key={item.key}
                      onClick={() => navegar(item.key)}
                      title={collapsed ? item.label : undefined}
                      className={`group relative flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[13px] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
                        collapsed ? 'md:justify-center md:px-0' : ''
                      } ${
                        active
                          ? 'bg-primary font-semibold text-primary-foreground shadow-[0_4px_14px_rgba(223,2,47,0.28)]'
                          : 'text-[#d6d6d6] hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon name={item.icon} size={19} />
                      <span className={`flex-1 truncate text-left ${collapsed ? 'md:hidden' : ''}`}>
                        {item.label}
                      </span>
                      {item.count !== undefined && item.count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 font-mono text-[10.5px] font-bold ${
                            active ? 'bg-white/20 text-white' : 'bg-primary text-white'
                          } ${collapsed ? 'md:hidden' : ''}`}
                        >
                          {item.count}
                        </span>
                      )}
                      {collapsed && item.count !== undefined && item.count > 0 && (
                        <span className="absolute right-2 top-2 hidden h-1.5 w-1.5 rounded-full bg-primary md:block" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Control de plegado (solo escritorio) */}
        <div className="hidden shrink-0 px-3 pb-1 md:block">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
            title={collapsed ? 'Expandir menú' : 'Contraer menú'}
            className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-[12.5px] text-sidebar-muted transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 ${
              collapsed ? 'justify-center px-0' : ''
            }`}
          >
            <Icon name={collapsed ? 'chevronsRight' : 'chevronsLeft'} size={16} />
            {!collapsed && <span>Contraer menú</span>}
          </button>
        </div>

        {/* Pie: temporada + usuario */}
        <div className="shrink-0 border-t border-sidebar-border p-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'md:flex-col md:gap-2' : ''}`}>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-white/5 text-[11.5px] font-bold text-sidebar-foreground"
              title={user.name ?? user.email}
            >
              {initials(user.name ?? user.email)}
            </span>
            <div className={`min-w-0 flex-1 leading-tight ${collapsed ? 'md:hidden' : ''}`}>
              <div className="truncate text-[12.5px] font-semibold">{user.name ?? user.email}</div>
              <div className="truncate text-[11px] text-sidebar-muted">{user.email}</div>
            </div>
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

          <div
            className={`mt-3 flex items-center justify-between px-1 text-[10.5px] text-sidebar-muted ${
              collapsed ? 'md:hidden' : ''
            }`}
          >
            <span>Temporada 2026</span>
            <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden="true" />
          </div>
          {collapsed && (
            <div className="mt-2 hidden justify-center md:flex">
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
        <header className="sticky top-0 z-10 flex h-16 items-center gap-3 border-b border-border bg-background px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            aria-controls="sidebar"
            aria-expanded={mobileOpen}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 md:hidden"
          >
            <Icon name="menu" size={18} />
          </button>

          <div className="relative hidden max-w-[420px] flex-1 sm:block">
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

          <button className="ml-auto shrink-0 rounded-lg bg-primary px-[14px] py-[9px] text-[13px] font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90">
            Registrar pago
          </button>
        </header>

        <main className="w-full max-w-[1500px] flex-1 overflow-y-auto p-4 sm:p-6">
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
