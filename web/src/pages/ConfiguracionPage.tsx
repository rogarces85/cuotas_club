import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  obtenerConfig,
  actualizarConfig,
  obtenerLogo,
  subirLogo,
  listarUsuariosConRol,
  asignarRolUsuario,
  actualizarRolUsuario,
  eliminarRolUsuario,
  urlLogo,
  ApiError,
  type ConfigClub,
  type UsuarioRol,
} from '../lib/api';
import { ModalHeader } from '../components/ModalHeader';

/**
 * Página Configuración (M5): datos del club, logo, usuarios/roles, importación socios.
 */

function Badge({ value, color = 'secondary' }: { value: string; color?: string }) {
  const colores: Record<string, string> = {
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    destructive: 'bg-destructive/10 text-destructive',
    secondary: 'bg-secondary text-muted-foreground',
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${colores[color]}`}>
      {value}
    </span>
  );
}

type ModalState =
  | { tipo: 'logo' }
  | { tipo: 'usuario'; modo: 'crear' | 'editar'; data?: UsuarioRol }
  | null;

export default function ConfiguracionPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);
  const [archivoLogo, setArchivoLogo] = useState<File | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState(false);
  const [logoError, setLogoError] = useState<string | null>(null);

  // Configuración del club
  const { data: config, isPending: configPending, refetch: refetchConfig } = useQuery({
    queryKey: ['config'],
    queryFn: obtenerConfig,
  });

  // Logo actual
  const { data: logoData, isPending: logoPending } = useQuery({
    queryKey: ['logo'],
    queryFn: obtenerLogo,
  });

  // Usuarios con roles
  const { data: usuarios, isPending: usuariosPending } = useQuery({
    queryKey: ['usuarios-roles'],
    queryFn: listarUsuariosConRol,
  });

  const actualizarCfg = useMutation({
    mutationFn: (v: Partial<ConfigClub>) => actualizarConfig(v),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['config'] }); setModal(null); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error actualizando configuración'),
  });

  const subirLogoMut = useMutation({
    mutationFn: (archivo: File) => subirLogo(archivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logo'] });
      setModal(null);
      setArchivoLogo(null);
      setLogoError(null);
    },
    onError: (err) => { setLogoError(err instanceof ApiError ? err.message : 'Error subiendo logo'); setSubiendoLogo(false); },
  });

  const crearUsuario = useMutation({
    mutationFn: (v: { userId: string; rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO' }) => asignarRolUsuario(v.userId, v.rol),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios-roles'] }); setModal(null); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error asignando rol'),
  });

  const editarUsuario = useMutation({
    mutationFn: (v: { userId: string; rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO' }) => actualizarRolUsuario(v.userId, v.rol),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios-roles'] }); setModal(null); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error actualizando rol'),
  });

  const eliminarUsuario = useMutation({
    mutationFn: (userId: string) => eliminarRolUsuario(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['usuarios-roles'] }); },
    onError: (err) => setError(err instanceof ApiError ? err.message : 'Error eliminando rol'),
  });

  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Configuración</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Datos del club, logo, usuarios y roles
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-5 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-destructive hover:underline">Cerrar</button>
        </div>
      )}

      {/* Sección: Datos del club */}
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5">
        <h2 className="text-[14px] font-semibold mb-4">Datos del club</h2>
        {configPending ? (
          <div className="p-4 text-center text-[13px] text-muted-foreground">Cargando…</div>
        ) : (
          <ConfigForm
            config={config as ConfigClub}
            onSubmit={async (v) => { await actualizarCfg.mutateAsync(v); refetchConfig(); }}
            isPending={actualizarCfg.isPending}
          />
        )}
      </div>

      {/* Sección: Logo */}
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold">Logo del club</h2>
          <button
            onClick={() => setModal({ tipo: 'logo' })}
            disabled={subiendoLogo}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-[13px] font-semibold disabled:opacity-50"
          >
            {logoPending ? 'Cargando…' : 'Cambiar logo'}
          </button>
        </div>

        {logoPending ? (
          <div className="p-4 text-center text-[13px] text-muted-foreground">Cargando logo…</div>
        ) : logoData?.logo ? (
          <div className="flex items-center gap-4 p-4 bg-background rounded-lg border border-border">
            <img
              src={urlLogo(logoData.logo.sha256)}
              alt="Logo del club"
              className="h-20 w-auto object-contain rounded-lg border border-border bg-white"
            />
            <div>
              <p className="font-medium text-[13px]">Logo actual</p>
              <p className="text-[12px] text-muted-foreground font-mono">{logoData.logo.mime} · {logoData.logo.bytes.toLocaleString()} bytes</p>
            </div>
          </div>
        ) : (
          <div className="p-8 text-center text-[13px] text-muted-foreground border-2 border-dashed border-border rounded-lg">
            No hay logo configurado. Use «Cambiar logo» para subir uno.
          </div>
        )}
      </div>

      {/* Sección: Usuarios y Roles */}
      <div className="bg-card border border-border rounded-[10px] p-4 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[14px] font-semibold">Usuarios y roles</h2>
          <button
            onClick={() => setModal({ tipo: 'usuario', modo: 'crear' })}
            className="bg-primary text-primary-foreground rounded-lg px-4 py-2 text-[13px] font-semibold"
          >
            Asignar rol
          </button>
        </div>

        {usuariosPending ? (
          <div className="p-4 text-center text-[13px] text-muted-foreground">Cargando usuarios…</div>
        ) : usuarios && usuarios.length === 0 ? (
          <div className="p-8 text-center text-[13px] text-muted-foreground">
            No hay usuarios con rol asignado. Use «Asignar rol» para agregar el primero.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                  <th className="px-3 py-2 font-semibold">User ID</th>
                  <th className="px-3 py-2 font-semibold">Rol</th>
                  <th className="px-3 py-2 font-semibold">Creado</th>
                  <th className="px-3 py-2 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {usuarios?.map((u) => (
                  <tr key={u.userId} className="border-b border-border last:border-0 hover:bg-secondary/40">
                    <td className="px-3 py-2 font-mono text-[11px] truncate max-w-[200px]">{u.userId}</td>
                    <td className="px-3 py-2">
                      <Badge
                        value={u.rol}
                        color={u.rol === 'DIRECTIVA' ? 'success' : u.rol === 'TESORERO' ? 'warning' : 'secondary'}
                      />
                    </td>
                    <td className="px-3 py-2 text-muted-foreground font-mono text-[11px]">
                      {new Date(u.createdAt * 1000).toLocaleDateString('es-CL')}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setModal({ tipo: 'usuario', modo: 'editar', data: u })}
                          className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => { if (confirm('¿Eliminar rol de este usuario?')) eliminarUsuario.mutate(u.userId); }}
                          disabled={eliminarUsuario.isPending}
                          className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1 disabled:opacity-50"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modales */}
      {modal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => { setModal(null); setArchivoLogo(null); setLogoError(null); }}>
          <div className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg" onClick={(e) => e.stopPropagation()}>
            <ModalHeader
              titulo={
                modal.tipo === 'logo'
                  ? 'Logo del club'
                  : modal.tipo === 'usuario'
                    ? 'Usuarios y roles'
                    : 'Configuración'
              }
              onClose={() => setModal(null)}
            />
            {modal.tipo === 'logo' && <LogoModal
              onCancel={() => { setModal(null); setArchivoLogo(null); setLogoError(null); }}
              onSubmit={async (v) => { await subirLogoMut.mutateAsync(v); }}
              isPending={subiendoLogo}
              error={logoError}
              setArchivo={setArchivoLogo}
              archivo={archivoLogo}
              setError={setLogoError}
            />}

            {modal.tipo === 'usuario' && <UsuarioModal
              modo={modal.modo}
              initial={modal.data}
              submitLabel={
                modal.modo === 'crear' ? (crearUsuario.isPending ? 'Asignando…' : 'Asignar rol')
                : (editarUsuario.isPending ? 'Guardando…' : 'Guardar cambios')
              }
              onCancel={() => setModal(null)}
              onSubmit={async (v) => { if (modal.modo === 'crear') await crearUsuario.mutateAsync(v); else await editarUsuario.mutateAsync(v); }}
            />}
          </div>
        </div>
      )}
    </div>
  );
}

// ========== Componentes internos ==========

type ConfigFormData = {
  nombre_club?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  email_tesoreria?: string;
  meta_mensual?: string;
};

function ConfigForm({ config, onSubmit, isPending }: { config: ConfigClub | undefined; onSubmit: (v: ConfigFormData) => Promise<void>; isPending: boolean }) {
  const [nombre, setNombre] = useState(config?.nombre_club ?? '');
  const [direccion, setDireccion] = useState(config?.direccion ?? '');
  const [telefono, setTelefono] = useState(config?.telefono ?? '');
  const [email, setEmail] = useState(config?.email ?? '');
  const [emailTesoreria, setEmailTesoreria] = useState(config?.email_tesoreria ?? '');
  const [metaMensual, setMetaMensual] = useState(config?.meta_mensual ?? '');

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <label htmlFor="nombre_club" className="block text-[12px] font-semibold mb-1.5">Nombre del club</label>
        <input id="nombre_club" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Osorno Runners" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={160} />
      </div>
      <div className="md:col-span-2">
        <label htmlFor="direccion" className="block text-[12px] font-semibold mb-1.5">Dirección</label>
        <input id="direccion" value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Dirección física" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={255} />
      </div>
      <div>
        <label htmlFor="telefono" className="block text-[12px] font-semibold mb-1.5">Teléfono</label>
        <input id="telefono" value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="+56 9 1234 5678" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={30} />
      </div>
      <div>
        <label htmlFor="email" className="block text-[12px] font-semibold mb-1.5">Email club</label>
        <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="club@ejemplo.cl" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={255} />
      </div>
      <div>
        <label htmlFor="email_tesoreria" className="block text-[12px] font-semibold mb-1.5">Email tesorería (para notificaciones)</label>
        <input id="email_tesoreria" type="email" value={emailTesoreria} onChange={e => setEmailTesoreria(e.target.value)} placeholder="tesoreria@ejemplo.cl" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" maxLength={255} />
      </div>
      <div>
        <label htmlFor="meta_mensual" className="block text-[12px] font-semibold mb-1.5">Meta mensual (CLP)</label>
        <input id="meta_mensual" type="number" min={0} value={metaMensual} onChange={e => setMetaMensual(e.target.value)} placeholder="0" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" />
      </div>
      <div className="flex items-center gap-3 justify-end mt-6 md:col-span-2">
        <button type="button" onClick={() => onSubmit({ nombre_club: nombre, direccion, telefono, email, email_tesoreria: emailTesoreria, meta_mensual: metaMensual })} disabled={isPending} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">
          {isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}

type LogoModalProps = {
  onCancel: () => void;
  onSubmit: (archivo: File) => Promise<void>;
  isPending: boolean;
  error: string | null;
  setArchivo: (archivo: File | null) => void;
  archivo: File | null;
  setError: (v: string | null) => void;
};

function LogoModal({ onCancel, onSubmit, isPending, error, setArchivo, archivo, setError }: LogoModalProps) {
  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">Subir logo del club</h2>
      <p className="text-[12.5px] text-muted-foreground mb-4">
        Formatos: PNG, JPEG, SVG, WebP · Máx 2 MB · Se recomienda fondo transparente
      </p>
      {error && <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">{error}</div>}
      <div className="mb-4">
        <label className="block text-[12px] font-semibold mb-1.5">Archivo</label>
        <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={e => { setArchivo(e.target.files?.[0] ?? null); setError(null); }} disabled={isPending} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]" />
      </div>
      {isPending && <div className="flex items-center gap-2 text-[12.5px] text-muted-foreground"><div className="w-4 h-4 border-2 border-border border-t-primary rounded-full animate-spin" />Subiendo logo…</div>}
      <div className="flex items-center gap-3 justify-end mt-6">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit(archivo!)} disabled={isPending || !archivo} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{isPending ? 'Subiendo…' : 'Subir logo'}</button>
      </div>
    </div>
  );
}

type UsuarioModalProps = {
  modo: 'crear' | 'editar';
  initial: { userId: string; rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO' } | undefined;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: { userId: string; rol: 'DIRECTIVA' | 'TESORERO' | 'SOCIO' }) => Promise<void>;
};

function UsuarioModal({ modo, initial, submitLabel, onCancel, onSubmit }: UsuarioModalProps) {
  const [userId, setUserId] = useState(initial?.userId ?? '');
  const [rol, setRol] = useState<'DIRECTIVA' | 'TESORERO' | 'SOCIO'>(initial?.rol ?? 'SOCIO');
  const valido = userId.trim().length > 0;

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">{modo === 'crear' ? 'Asignar rol a usuario' : 'Editar rol de usuario'}</h2>
      <div className="grid gap-4">
        {modo === 'crear' && (
          <div>
            <label htmlFor="userId" className="block text-[12px] font-semibold mb-1.5">User ID (UUID de Better Auth)</label>
            <input id="userId" value={userId} onChange={e => setUserId(e.target.value)} placeholder="uuid-del-usuario" className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono" maxLength={36} />
          </div>
        )}
        <div>
          <label htmlFor="rol" className="block text-[12px] font-semibold mb-1.5">Rol</label>
          <select id="rol" value={rol} onChange={e => setRol(e.target.value as any)} className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]">
            <option value="DIRECTIVA">Directiva (acceso total)</option>
            <option value="TESORERO">Tesorero (pagos, bancos, reportes, gastos)</option>
            <option value="SOCIO">Socio (solo ver su estado de cuenta)</option>
          </select>
        </div>
        {modo === 'editar' && <div className="text-[12px] text-muted-foreground">User ID: <code className="font-mono">{initial?.userId}</code></div>}
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button onClick={onCancel} className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg">Cancelar</button>
        <button onClick={() => onSubmit({ userId, rol })} disabled={!valido} className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50">{submitLabel}</button>
      </div>
    </div>
  );
}
