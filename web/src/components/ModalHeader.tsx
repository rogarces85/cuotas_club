import { Icon, type IconName } from './icons';
/**
 * Cabecera estandarizada para todos los modales del sistema.
 * Usa la paleta del club: rojo de marca como acento, negro para texto,
 * blanco para tarjetas. Siempre incluye un solo botón de cierre (✕).
 */

export type ModalHeaderProps = {
  titulo: string;
  onClose: () => void;
  icono?: IconName;
  subtitulo?: string;
};

export function ModalHeader({ titulo, onClose, icono, subtitulo }: ModalHeaderProps) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-3 mb-4">
      <div className="flex items-center gap-2 min-w-0">
        {icono && (
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow-sm">
            <Icon name={icono} size={16} />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground">{titulo}</h2>
          {subtitulo && <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitulo}</div>}
        </div>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="grid h-8 w-8 place-items-center rounded-lg border border-border text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring/25 transition-colors"
      >
        ✕
      </button>
    </div>
  );
}
