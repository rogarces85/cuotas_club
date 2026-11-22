import { primerNombre, type Membresia } from './calculo.js';

/**
 * Plantilla del saludo de cumpleaños.
 *
 * HTML compatible con clientes de correo: tablas, estilos inline, sin
 * imágenes externas ni JavaScript. Los datos personales y del club se
 * escapan antes de entrar al HTML.
 */

export type ClubCorreo = {
  nombre: string;
  email: string | null;
  telefono: string | null;
  direccion: string | null;
};

export type DatosSaludo = {
  nombre: string;
  edad: number | null;
  esHoy: boolean;
  membresia: Membresia | null;
  club: ClubCorreo;
};

export type SaludoRenderizado = {
  asunto: string;
  texto: string;
  html: string;
};

function escaparHtml(valor: string): string {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function fraseEdad(edad: number | null, esHoy: boolean): string {
  if (edad === null) {
    return esHoy ? 'Hoy celebramos tu cumpleaños.' : 'Este mes celebramos tu cumpleaños.';
  }
  const anios = edad === 1 ? '1 año' : `${edad} años`;
  return esHoy ? `Hoy cumples ${anios}.` : `Este mes cumples ${anios}.`;
}

function fraseMembresia(membresia: Membresia | null, club: string): string | null {
  if (!membresia) return null;
  return `Ya llevas ${membresia.texto} en ${club}. Gracias por seguir corriendo con nosotros.`;
}

export function renderizarSaludo(datos: DatosSaludo): SaludoRenderizado {
  const nombre = primerNombre(datos.nombre);
  const club = datos.club.nombre || 'Osorno Runners';
  const frase = fraseEdad(datos.edad, datos.esHoy);
  const membresia = fraseMembresia(datos.membresia, club);

  const asunto = `¡Feliz cumpleaños, ${nombre}! · ${club}`;

  const contacto = [datos.club.email, datos.club.telefono, datos.club.direccion]
    .filter((valor): valor is string => Boolean(valor))
    .join(' · ');

  const texto = [
    `Hola ${nombre}:`,
    '',
    `¡Feliz cumpleaños! ${frase}`,
    ...(membresia ? ['', membresia] : []),
    '',
    'Que tengas un gran día y nos vemos en la próxima corrida.',
    '',
    club,
    ...(contacto ? [contacto] : []),
  ].join('\n');

  const nombreHtml = escaparHtml(nombre);
  const clubHtml = escaparHtml(club);
  const fraseHtml = escaparHtml(frase);
  const membresiaHtml = membresia ? escaparHtml(membresia) : null;
  const contactoHtml = escaparHtml(contacto);
  const asuntoHtml = escaparHtml(asunto);

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${asuntoHtml}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;color:#0a0a0a;">
  <span style="display:none;font-size:1px;color:#f5f5f5;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;">
    ¡Feliz cumpleaños, ${nombreHtml}! Te saluda ${clubHtml}.
  </span>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#f5f5f5;padding:28px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;background-color:#ffffff;border:1px solid #e7e7e7;border-radius:12px;overflow:hidden;">
          <tr>
            <td style="background-color:#df022f;height:5px;font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:26px 32px 8px 32px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="width:40px;height:40px;background-color:#df022f;border-radius:10px;text-align:center;color:#ffffff;font-size:13px;font-weight:bold;">OR</td>
                  <td style="padding-left:12px;font-size:13px;font-weight:bold;letter-spacing:0.08em;text-transform:uppercase;color:#0a0a0a;">
                    ${clubHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 32px 0 32px;">
              <h1 style="margin:0 0 14px 0;font-size:26px;line-height:1.2;color:#0a0a0a;">¡Feliz cumpleaños, ${nombreHtml}!</h1>
              <p style="margin:0 0 14px 0;font-size:16px;line-height:1.6;color:#1a1a1a;">
                ${fraseHtml}
              </p>
              ${
                membresiaHtml
                  ? `<p style="margin:0 0 14px 0;font-size:15px;line-height:1.6;color:#6b6b6b;">${membresiaHtml}</p>`
                  : ''
              }
              <p style="margin:0 0 24px 0;font-size:15px;line-height:1.6;color:#1a1a1a;">
                Que tengas un gran día y nos vemos en la próxima corrida.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px 32px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #e7e7e7;">
                <tr>
                  <td style="padding-top:16px;font-size:13px;line-height:1.6;color:#6b6b6b;">
                    <strong style="color:#0a0a0a;">${clubHtml}</strong><br>
                    ${contactoHtml || 'Nos vemos en la próxima corrida.'}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <p style="max-width:600px;margin:14px auto 0 auto;font-size:11px;line-height:1.5;color:#8a8a8a;text-align:center;">
          Recibes este correo porque eres parte de ${clubHtml}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { asunto, texto, html };
}
