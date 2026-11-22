import { db } from '../db/client.js';
import { clubSchema } from '@cuotas-club/shared';
import type { ClubCorreo } from './plantilla.js';

/**
 * Datos del club para el correo de cumpleaños. Salen de `config_club` y, si
 * la configuración está vacía, se usan valores seguros para que el saludo
 * nunca salga sin remitente.
 */
export async function obtenerConfigClubCorreo(): Promise<ClubCorreo> {
  const filas = await db.select().from(clubSchema.configClub);
  const mapa = new Map(filas.map((fila) => [fila.clave, fila.valor]));

  const limpiar = (clave: string): string | null => {
    const valor = mapa.get(clave)?.trim();
    return valor ? valor : null;
  };

  return {
    nombre: limpiar('nombre_club') ?? 'Osorno Runners',
    email: limpiar('email') ?? limpiar('email_tesoreria') ?? process.env.MAIL_FROM ?? null,
    telefono: limpiar('telefono'),
    direccion: limpiar('direccion'),
  };
}
