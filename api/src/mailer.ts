import { createTransport, Transporter } from 'nodemailer';
import type { Transport } from 'nodemailer';

/**
 * Utilidad de envío de correo (Gmail SMTP).
 *
 * Configuración vía variables de entorno (api/.env):
 * - MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM
 *
 * Requiere "contraseña de aplicación" de Google (2FA activada).
 */

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  const host = process.env.MAIL_HOST;
  const port = parseInt(process.env.MAIL_PORT ?? '587', 10);
  const user = process.env.MAIL_USER;
  const pass = process.env.MAIL_PASSWORD;
  const from = process.env.MAIL_FROM;

  if (!host || !user || !pass || !from) {
    throw new Error('Configuración de correo incompleta (MAIL_HOST, MAIL_PORT, MAIL_USER, MAIL_PASSWORD, MAIL_FROM)');
  }

  transporter = createTransport({
    host,
    port,
    secure: port === 465, // true para 465, false para 587 (STARTTLS)
    auth: { user, pass },
  });

  return transporter;
}

/**
 * Envía un correo. Si falla, loggea el error pero no lanza (fire-and-forget
 * para no bloquear la respuesta de la API).
 */
export async function enviarCorreo(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<boolean> {
  try {
    const tx = getTransporter();
    const from = process.env.MAIL_FROM!;
    await tx.sendMail({
      from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html ?? opts.text.replace(/\n/g, '<br>'),
    });
    console.log(`[mail] Enviado a ${opts.to}: ${opts.subject}`);
    return true;
  } catch (err) {
    console.error('[mail] Error al enviar:', err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Plantilla: comprobante aprobado.
 */
export function plantillaAprobado(pago: {
  id: number;
  nombre: string;
  total: number;
  fecha: string;
}): { subject: string; text: string; html: string } {
  const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
  const subject = `✅ Comprobante aprobado — Pago #${pago.id}`;
  const text = `
Hola ${pago.nombre}:

Tu comprobante de pago ha sido APROBADO.

Detalle:
- Pago #${pago.id}
- Fecha: ${pago.fecha}
- Total: ${formatClp(pago.total)}

El pago ya figura como pagado en tu estado de cuenta.

Saludos,
Tesorería Osorno Runners
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #166534;">✅ Comprobante aprobado</h2>
    <p>Hola <strong>${pago.nombre}</strong>,</p>
    <p>Tu comprobante de pago ha sido <strong style="color: #166534;">APROBADO</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Pago</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">#${pago.id}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Fecha</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pago.fecha}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatClp(pago.total)}</td></tr>
    </table>
    <p>El pago ya figura como pagado en tu estado de cuenta.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #6b7280; font-size: 14px;">Tesorería Osorno Runners</p>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}

/**
 * Plantilla: comprobante rechazado.
 */
export function plantillaRechazado(pago: {
  id: number;
  nombre: string;
  total: number;
  fecha: string;
  motivo?: string;
}): { subject: string; text: string; html: string } {
  const formatClp = (n: number) => `$${n.toLocaleString('es-CL')}`;
  const subject = `❌ Comprobante rechazado — Pago #${pago.id}`;
  const text = `
Hola ${pago.nombre}:

Tu comprobante de pago ha sido RECHAZADO.

Detalle:
- Pago #${pago.id}
- Fecha: ${pago.fecha}
- Total: ${formatClp(pago.total)}
${pago.motivo ? `- Motivo: ${pago.motivo}` : ''}

Por favor, revisa el comprobante y vuelve a subirlo corregido, o contacta a tesorería si tienes dudas.

Saludos,
Tesorería Osorno Runners
`.trim();

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: system-ui, sans-serif; line-height: 1.6; color: #1f2937;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h2 style="color: #991b1b;">❌ Comprobante rechazado</h2>
    <p>Hola <strong>${pago.nombre}</strong>,</p>
    <p>Tu comprobante de pago ha sido <strong style="color: #991b1b;">RECHAZADO</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Pago</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">#${pago.id}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Fecha</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pago.fecha}</td></tr>
      <tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Total</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${formatClp(pago.total)}</td></tr>
      ${pago.motivo ? `<tr><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;"><strong>Motivo</strong></td><td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">${pago.motivo}</td></tr>` : ''}
    </table>
    <p>Por favor, revisa el comprobante y vuelve a subirlo corregido, o contacta a tesorería si tienes dudas.</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">
    <p style="color: #6b7280; font-size: 14px;">Tesorería Osorno Runners</p>
  </div>
</body>
</html>
`.trim();

  return { subject, text, html };
}