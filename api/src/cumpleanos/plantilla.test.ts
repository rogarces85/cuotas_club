import { describe, it, expect } from 'vitest';
import { renderizarSaludo } from './plantilla.js';

/**
 * Plantilla del saludo: contenido, datos del club y escape de HTML.
 */

const CLUB = {
  nombre: 'Osorno Runners',
  email: 'tesoreriaor@gmail.com',
  telefono: '+56 9 1234 5678',
  direccion: 'Osorno, Chile',
};

describe('renderizarSaludo', () => {
  it('arma asunto, texto y HTML con el nombre, la edad y la membresía', () => {
    const saludo = renderizarSaludo({
      nombre: 'Camila Andrea Rojas Muñoz',
      edad: 52,
      esHoy: true,
      membresia: { anios: 10, meses: 8, texto: '10 años y 8 meses' },
      club: CLUB,
    });

    expect(saludo.asunto).toContain('Camila');
    expect(saludo.asunto).toContain('Osorno Runners');
    expect(saludo.texto).toContain('Hola Camila:');
    expect(saludo.texto).toContain('Hoy cumples 52 años');
    expect(saludo.texto).toContain('10 años y 8 meses');
    expect(saludo.texto).toContain('tesoreriaor@gmail.com');
    expect(saludo.html).toContain('¡Feliz cumpleaños, Camila!');
    expect(saludo.html).toContain('Osorno Runners');
    expect(saludo.html).toContain('#df022f');
    expect(saludo.html).not.toContain('<img');
  });

  it('no dice "Hoy" si el correo se envía otro día del mes', () => {
    const saludo = renderizarSaludo({
      nombre: 'Camila Rojas',
      edad: 39,
      esHoy: false,
      membresia: null,
      club: CLUB,
    });
    expect(saludo.texto).toContain('Este mes cumples 39 años');
    expect(saludo.texto).not.toContain('Hoy cumples');
    expect(saludo.texto).not.toContain('Ya llevas');
  });

  it('omite la edad cuando no hay fecha de nacimiento', () => {
    const saludo = renderizarSaludo({
      nombre: 'Oscar Pérez',
      edad: null,
      esHoy: true,
      membresia: null,
      club: CLUB,
    });
    expect(saludo.texto).toContain('Hoy celebramos tu cumpleaños');
    expect(saludo.texto).not.toContain('Hoy cumples');
  });

  it('escapa HTML en el nombre y en los datos del club', () => {
    const saludo = renderizarSaludo({
      nombre: '<script>alert(1)</script> Ana',
      edad: 30,
      esHoy: true,
      membresia: null,
      club: { ...CLUB, nombre: '<b>Club</b>' },
    });
    expect(saludo.html).not.toContain('<script>');
    expect(saludo.html).toContain('&lt;script&gt;');
    expect(saludo.html).toContain('&lt;b&gt;Club&lt;/b&gt;');
  });

  it('usa el correo del club cuando no hay contacto de dirección', () => {
    const saludo = renderizarSaludo({
      nombre: 'Ana',
      edad: 30,
      esHoy: true,
      membresia: null,
      club: { ...CLUB, telefono: null, direccion: null },
    });
    expect(saludo.texto).toContain('tesoreriaor@gmail.com');
    expect(saludo.html).toContain('tesoreriaor@gmail.com');
  });
});
