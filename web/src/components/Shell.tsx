import { useState } from 'react';
import { signOut } from '../lib/auth-client';

/**
 * Shell del sistema — sidebar negra, contenido blanco, rojo como acento.
 * Es el esqueleto que M1–M5 llenarán con socios, cuotas y pagos.
 */

type NavItem = { label: string; active?: boolean; count?: number };

const groups: { label: string; items: NavItem[] }[] = [
  {
    label: 'Club',
    items: [
      { label: 'Panel', active: true },
      { label: 'Socios' },
      { label: 'Cuentas bancarias' },
    ],
  },
  {
    label: 'Cobranza',
    items: [
      { label: 'Cuotas' },
      { label: 'Pagos', count: 0 },
      { label: 'Morosidad', count: 0 },
      { label: 'Estado de cuenta' },
    ],
  },
  {
    label: 'Finanzas',
    items: [
      { label: 'Gastos' },
      { label: 'Reportes' },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { label: 'Configuración' },
      { label: 'Usuarios' },
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
};

export default function Shell({ user }: Props) {
  const [period, setPeriod] = useState<'Mes' | 'Trimestre' | 'Año'>('Mes');

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
                <a
                  key={item.label}
                  href="#"
                  className={`relative flex items-center gap-[10px] px-[10px] py-[8px] rounded-lg text-[13px] mb-px ${
                    item.active
                      ? 'bg-sidebar-accent text-white font-semibold'
                      : 'text-[#d6d6d6] hover:bg-sidebar-accent hover:text-white'
                  }`}
                >
                  {item.active && (
                    <span className="absolute left-[-10px] top-[8px] bottom-[8px] w-[3px] bg-sidebar-primary rounded-r" />
                  )}
                  <span className="w-4 h-4 flex items-center justify-center opacity-75 text-[11px]">•</span>
                  {item.label}
                  {item.count !== undefined && item.count > 0 && (
                    <span className="ml-auto bg-sidebar-primary text-white text-[10.5px] font-bold px-[6px] rounded-full font-mono">
                      {item.count}
                    </span>
                  )}
                </a>
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

        <main className="flex-1 p-6 max-w-[1500px] w-full">
          <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
            <div>
              <h1 className="text-[21px] font-bold tracking-tight">Panel</h1>
              <p className="text-[13px] text-muted-foreground mt-[3px]">
                Resumen de cobranza del club · Noviembre 2026
              </p>
            </div>
            <div className="flex gap-0.5 bg-secondary p-[3px] rounded-lg">
              {(['Mes', 'Trimestre', 'Año'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                    period === p ? 'bg-white shadow-sm font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* KPI cards */}
          <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
            <div className="bg-card border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium mb-2.5">Recaudado del mes</div>
              <div className="text-[26px] font-bold font-mono leading-tight">$3.480.000</div>
              <div className="text-[11.5px] text-success mt-1.5">▲ 12,4% vs. octubre</div>
            </div>
            <div className="bg-card border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium mb-2.5">Socios morosos</div>
              <div className="text-[26px] font-bold font-mono leading-tight text-primary">8</div>
              <div className="text-[11.5px] text-muted-foreground mt-1.5">2 más que el mes anterior</div>
            </div>
            <div className="bg-card border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium mb-2.5">Socios activos</div>
              <div className="text-[26px] font-bold font-mono leading-tight">52</div>
              <div className="text-[11.5px] text-muted-foreground mt-1.5">de 60 registrados</div>
            </div>
            <div className="bg-card border border-border rounded-[10px] p-4">
              <div className="text-[11.5px] text-muted-foreground font-medium mb-2.5">Comprobantes por revisar</div>
              <div className="text-[26px] font-bold font-mono leading-tight text-primary">6</div>
              <div className="text-[11.5px] text-primary mt-1.5 font-semibold">Revisar bandeja →</div>
            </div>
          </div>

          <div className="mt-5 bg-card border border-dashed border-border rounded-[10px] p-8 text-center text-muted-foreground text-sm">
            Sesión iniciada como <strong className="text-foreground">{user.email}</strong>.
            Los módulos de socios, cuotas y pagos se construyen en M1–M5.
            <div className="mt-2 text-xs text-sidebar-muted">
              Los indicadores de arriba son de muestra, todavía no leen la base de datos.
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
