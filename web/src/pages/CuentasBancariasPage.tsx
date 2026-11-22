import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listarCuentasBancarias,
  crearCuentaBancaria,
  actualizarCuentaBancaria,
  eliminarCuentaBancaria,
  ApiError,
  type CuentaBancaria,
  type CuentaBancariaInput,
} from '../lib/api';
import { ModalHeader } from '../components/ModalHeader';

/**
 * Pantalla Cuentas bancarias (M5): CRUD de las cuentas del club que se
 * comparten con los socios para transferir.
 */

type ModalState =
  | { modo: 'crear' }
  | { modo: 'editar'; cuenta: CuentaBancaria }
  | { modo: 'eliminar'; cuenta: CuentaBancaria }
  | null;

export default function CuentasBancariasPage() {
  const queryClient = useQueryClient();
  const [modal, setModal] = useState<ModalState>(null);

  const { data: cuentas, isPending, isError } = useQuery({
    queryKey: ['cuentas-bancarias'],
    queryFn: listarCuentasBancarias,
  });

  const invalidar = () => queryClient.invalidateQueries({ queryKey: ['cuentas-bancarias'] });

  const crear = useMutation({
    mutationFn: (v: CuentaBancariaInput) => crearCuentaBancaria(v),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const editar = useMutation({
    mutationFn: ({ id, v }: { id: number; v: Partial<CuentaBancariaInput> }) =>
      actualizarCuentaBancaria(id, v),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const eliminar = useMutation({
    mutationFn: (id: number) => eliminarCuentaBancaria(id),
    onSuccess: () => {
      invalidar();
      setModal(null);
    },
  });

  const error =
    (crear.error instanceof ApiError && crear.error.message) ||
    (editar.error instanceof ApiError && editar.error.message) ||
    (eliminar.error instanceof ApiError && eliminar.error.message) ||
    null;

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Cuentas bancarias</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            {cuentas ? `${cuentas.length} cuenta${cuentas.length === 1 ? '' : 's'} del club` : 'Datos para transferir'}
          </p>
        </div>
        <button
          onClick={() => setModal({ modo: 'crear' })}
          className="bg-primary text-primary-foreground rounded-lg px-[14px] py-[9px] text-[13px] font-semibold"
        >
          Nueva cuenta
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-[12.5px] text-destructive">
          {error}
        </div>
      )}

      <div className="bg-card border border-border rounded-[10px] overflow-hidden">
        {isPending ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">Cargando cuentas…</div>
        ) : isError ? (
          <div className="p-10 text-center text-[13px] text-primary">No se pudieron cargar las cuentas.</div>
        ) : cuentas && cuentas.length === 0 ? (
          <div className="p-10 text-center text-[13px] text-muted-foreground">
            No hay cuentas configuradas. Use «Nueva cuenta» para agregar la primera.
          </div>
        ) : (
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-muted-foreground border-b border-border">
                <th className="px-4 py-3 font-semibold">Banco</th>
                <th className="px-4 py-3 font-semibold">Tipo</th>
                <th className="px-4 py-3 font-semibold">Número</th>
                <th className="px-4 py-3 font-semibold">Titular</th>
                <th className="px-4 py-3 font-semibold">RUT</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {cuentas?.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0 hover:bg-secondary/40">
                  <td className="px-4 py-3 font-medium">{c.banco}</td>
                  <td className="px-4 py-3">{c.tipo}</td>
                  <td className="px-4 py-3 font-mono">{c.numero}</td>
                  <td className="px-4 py-3">{c.titular}</td>
                  <td className="px-4 py-3 font-mono">{c.rut}</td>
                  <td className="px-4 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setModal({ modo: 'editar', cuenta: c })}
                        className="text-[12px] font-medium text-muted-foreground hover:text-foreground border border-border rounded-md px-2 py-1"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setModal({ modo: 'eliminar', cuenta: c })}
                        className="text-[12px] font-medium text-destructive/80 hover:text-destructive border border-border rounded-md px-2 py-1"
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={() => setModal(null)}
        >
          <div
            className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-card border border-border rounded-[12px] p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <ModalHeader
              titulo={
                modal.modo === 'eliminar' ? 'Eliminar cuenta' : 'Cuenta bancaria'
              }
              onClose={() => setModal(null)}
            />
            {modal.modo === 'eliminar' ? (
              <div>
                <p className="text-[13px] text-muted-foreground mb-5">
                  ¿Eliminar la cuenta <strong>{modal.cuenta.banco} · {modal.cuenta.numero}</strong>?
                  Esta acción no se puede deshacer.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setModal(null)}
                    className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => eliminar.mutate(modal.cuenta.id)}
                    disabled={eliminar.isPending}
                    className="bg-destructive text-destructive-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
                  >
                    {eliminar.isPending ? 'Eliminando…' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ) : (
              <CuentaForm
                initial={modal.modo === 'editar' ? modal.cuenta : undefined}
                submitLabel={
                  modal.modo === 'crear'
                    ? crear.isPending
                      ? 'Creando…'
                      : 'Crear cuenta'
                    : editar.isPending
                      ? 'Guardando…'
                      : 'Guardar cambios'
                }
                onCancel={() => setModal(null)}
                onSubmit={async (v) => {
                  if (modal.modo === 'crear') await crear.mutateAsync(v);
                  else await editar.mutateAsync({ id: modal.cuenta.id, v });
                }}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function CuentaForm({
  initial,
  submitLabel,
  onCancel,
  onSubmit,
}: {
  initial?: CuentaBancaria;
  submitLabel: string;
  onCancel: () => void;
  onSubmit: (v: CuentaBancariaInput) => Promise<void>;
}) {
  const [banco, setBanco] = useState(initial?.banco ?? '');
  const [tipo, setTipo] = useState(initial?.tipo ?? 'corriente');
  const [numero, setNumero] = useState(initial?.numero ?? '');
  const [titular, setTitular] = useState(initial?.titular ?? '');
  const [rut, setRut] = useState(initial?.rut ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');

  const valido = banco.trim() && numero.trim() && titular.trim() && rut.trim();

  return (
    <div>
      <h2 className="text-[17px] font-bold tracking-tight mb-5">
        {initial ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label htmlFor="banco" className="block text-[12px] font-semibold mb-1.5">Banco</label>
          <input
            id="banco"
            value={banco}
            onChange={(e) => setBanco(e.target.value)}
            placeholder="Ej: Banco Estado, Santander, BCI…"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={80}
          />
        </div>
        <div>
          <label htmlFor="tipo" className="block text-[12px] font-semibold mb-1.5">Tipo</label>
          <select
            id="tipo"
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          >
            <option value="corriente">Corriente</option>
            <option value="ahorro">Ahorro</option>
            <option value="vista">Vista</option>
            <option value="otro">Otro</option>
          </select>
        </div>
        <div>
          <label htmlFor="numero" className="block text-[12px] font-semibold mb-1.5">Número de cuenta</label>
          <input
            id="numero"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            placeholder="Número de cuenta"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            maxLength={40}
          />
        </div>
        <div className="md:col-span-2">
          <label htmlFor="titular" className="block text-[12px] font-semibold mb-1.5">Titular</label>
          <input
            id="titular"
            value={titular}
            onChange={(e) => setTitular(e.target.value)}
            placeholder="Nombre del titular"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
            maxLength={160}
          />
        </div>
        <div>
          <label htmlFor="rut" className="block text-[12px] font-semibold mb-1.5">RUT titular</label>
          <input
            id="rut"
            value={rut}
            onChange={(e) => setRut(e.target.value)}
            placeholder="12345678-9"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px] font-mono"
            maxLength={12}
          />
        </div>
        <div>
          <label htmlFor="email" className="block text-[12px] font-semibold mb-1.5">Email (opcional)</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="correo@ejemplo.cl"
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-[13px]"
          />
        </div>
      </div>
      <div className="flex items-center gap-3 justify-end mt-6">
        <button
          onClick={onCancel}
          className="px-5 py-2.5 text-[13.5px] font-medium text-muted-foreground border border-border rounded-lg"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSubmit({ banco, tipo, numero, titular, rut, email: email || undefined })}
          disabled={!valido}
          className="bg-primary text-primary-foreground rounded-lg px-5 py-2.5 text-[13.5px] font-semibold disabled:opacity-50"
        >
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
