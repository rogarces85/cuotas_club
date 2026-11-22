import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  obtenerCandidatosBecado,
  aprobarBecado,
  rechazarBecado,
  ApiError,
} from '../lib/api';

/**
 * Panel de solicitudes de becado por edad.
 *
 * Muestra los socios que cumplen 60 años y son candidatos a pasar a Becado
 * (cuota $0). El tesorero puede aprobar o rechazar cada solicitud.
 */

export default function BecadosPendientes() {
  const { data, isPending, isError } = useQuery({
    queryKey: ['candidatos-becado'],
    queryFn: obtenerCandidatosBecado,
    retry: false,
  });

  const [aprobando, setAprobando] = useState<Set<number>>(new Set());
  const [rechazando, setRechazando] = useState<Set<number>>(new Set());
  const [mensaje, setMensaje] = useState<string | null>(null);

  const aprobar = async (socioId: number) => {
    setAprobando((prev) => new Set([...prev, socioId]));
    setMensaje(null);
    try {
      await aprobarBecado(socioId);
      setMensaje('Socio aprobado como Becado.');
    } catch (err) {
      setMensaje(
        err instanceof ApiError ? err.message : 'No se pudo aprobar el becado.'
      );
    } finally {
      setAprobando((prev) => new Set([...prev].filter((id) => id !== socioId)));
    }
  };

  const rechazar = async (socioId: number) => {
    setRechazando((prev) => new Set([...prev, socioId]));
    setMensaje(null);
    try {
      await rechazarBecado(socioId);
      setMensaje('Solicitud de becado rechazada.');
    } catch (err) {
      setMensaje(
        err instanceof ApiError ? err.message : 'No se pudo rechazar la solicitud.'
      );
    } finally {
      setRechazando((prev) => new Set([...prev].filter((id) => id !== socioId)));
    }
  };

  if (isPending) {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-muted-foreground">
        Cargando solicitudes de becado…
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="flex items-center justify-center p-10 text-[13px] text-primary">
        No se pudieron cargar las solicitudes de becado.
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="rounded-[10px] border border-border bg-card p-10 text-center">
        <h2 className="text-[16px] font-bold tracking-tight mb-2">
          Sin solicitudes de becado pendientes
        </h2>
        <p className="text-[12.5px] text-muted-foreground">
          No hay socios que cumplan 60 años y estén pendientes de aprobación
          como becado.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-[10px] border border-border bg-card p-6">
      <h2 className="text-[17px] font-bold tracking-tight mb-5">
        Solicitudes de Becado (60 años)
      </h2>
      {mensaje && (
        <div
          className={`mb-4 rounded-lg border p-3 text-[12.5px] ${
            mensaje.includes('aprobado') || mensaje.includes('rechazada')
              ? 'bg-success/10 border-success/30 text-success'
              : 'bg-accent/10 border-accent/30 text-accent-foreground'
          }`}
        >
          {mensaje}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-[12.5px]">
          <thead>
            <tr className="border-b border-border text-left text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
              <th className="px-4 py-3 font-semibold">RUT</th>
              <th className="px-4 py-3 font-semibold">Nombre</th>
              <th className="px-4 py-3 font-semibold">Nacimiento</th>
              <th className="px-4 py-3 text-right font-semibold">Edad</th>
              <th className="px-4 py-3 text-right font-semibold">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((s) => {
              const [anio, mes, dia] = (s.fechaNacimiento ?? '').split('-').map(Number);
              const hoy = new Date();
              const edad =
                hoy.getFullYear() -
                anio -
                (hoy.getMonth() + 1 < mes || (hoy.getMonth() + 1 === mes && hoy.getDate() < dia)
                  ? 1
                  : 0);
              const estaAprobando = aprobando.has(s.id);
              const estaRechazando = rechazando.has(s.id);
              return (
                <tr
                  key={s.id}
                  className="border-b border-border last:border-0 hover:bg-secondary/40"
                >
                  <td className="px-4 py-3 font-mono text-[12.5px]">{s.rut}</td>
                  <td className="px-4 py-3 font-medium">{s.nombre}</td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-muted-foreground">
                    {s.fechaNacimiento ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{edad}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-end gap-2">
                      {!estaAprobando && (
                        <button
                          onClick={() => aprobar(s.id)}
                          disabled={estaRechazando}
                          className="rounded-md border border-success px-3 py-1.5 text-[11px] font-medium text-success hover:bg-success/10 transition-colors disabled:opacity-50"
                        >
                          Aprobar
                        </button>
                      )}
                      {!estaRechazando && (
                        <button
                          onClick={() => rechazar(s.id)}
                          disabled={estaAprobando}
                          className="rounded-md border border-destructive px-3 py-1.5 text-[11px] font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                        >
                          Rechazar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
