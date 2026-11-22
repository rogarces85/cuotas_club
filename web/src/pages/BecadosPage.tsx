import BecadosPendientes from '../components/BecadosPendientes';

/**
 * Página de solicitudes de becado.
 *
 * Muestra los socios que cumplen 60 años y son candidatos a pasar a Becado
 * (cuota $0). El tesorero puede aprobar o rechazar cada solicitud.
 */

export default function BecadosPage() {
  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-[21px] font-bold tracking-tight">Solicitudes de Becado</h1>
          <p className="text-[13px] text-muted-foreground mt-[3px]">
            Socios que cumplen 60 años y son candidatos a pasar a Becado (cuota $0).
          </p>
        </div>
      </div>

      <BecadosPendientes />
    </div>
  );
}