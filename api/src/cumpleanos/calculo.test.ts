import { describe, it, expect } from 'vitest';
import {
  calcularEdadCumple,
  calcularMembresia,
  esCumpleHoy,
  parsePeriodo,
  primerNombre,
} from './calculo.js';

/**
 * Cálculos de cumpleaños y antigüedad. Pura lógica, sin base de datos.
 * La referencia es el 21 de noviembre de 2026.
 */

const REF = new Date(2026, 10, 21);

describe('calcularMembresia', () => {
  it('calcula años y meses completos', () => {
    expect(calcularMembresia('2020-05-15', REF)).toEqual({
      anios: 6,
      meses: 6,
      texto: '6 años y 6 meses',
    });
  });

  it('no cuenta el mes si todavía no llega el día de ingreso', () => {
    expect(calcularMembresia('2020-11-22', REF)?.texto).toBe('5 años y 11 meses');
    expect(calcularMembresia('2025-11-22', REF)?.texto).toBe('11 meses');
  });

  it('usa singular cuando corresponde', () => {
    expect(calcularMembresia('2025-10-21', REF)?.texto).toBe('1 año y 1 mes');
    expect(calcularMembresia('2025-10-15', REF)?.texto).toBe('1 año y 1 mes');
  });

  it('devuelve meses sueltos o menos de un mes', () => {
    expect(calcularMembresia('2026-01-27', REF)?.texto).toBe('9 meses');
    expect(calcularMembresia('2026-11-01', REF)?.texto).toBe('menos de un mes');
    expect(calcularMembresia('2026-11-21', REF)?.texto).toBe('menos de un mes');
  });

  it('devuelve null sin fecha, con fecha inválida o futura', () => {
    expect(calcularMembresia(null, REF)).toBeNull();
    expect(calcularMembresia('', REF)).toBeNull();
    expect(calcularMembresia('2026-02-31', REF)).toBeNull();
    expect(calcularMembresia('2027-01-01', REF)).toBeNull();
  });
});

describe('calcularEdadCumple', () => {
  it('calcula la edad que cumple en el año', () => {
    expect(calcularEdadCumple('1990-03-15', 2026)).toBe(36);
    expect(calcularEdadCumple('2002-11-25', 2026)).toBe(24);
    expect(calcularEdadCumple('2021-07-22', 2026)).toBe(5);
  });

  it('devuelve null sin fecha o con año anterior al nacimiento', () => {
    expect(calcularEdadCumple(null, 2026)).toBeNull();
    expect(calcularEdadCumple('2020-01-01', 2019)).toBeNull();
  });
});

describe('esCumpleHoy', () => {
  it('compara día y mes, sin importar el año', () => {
    expect(esCumpleHoy('1990-11-21', REF)).toBe(true);
    expect(esCumpleHoy('2002-11-25', REF)).toBe(false);
    expect(esCumpleHoy(null, REF)).toBe(false);
  });
});

describe('parsePeriodo', () => {
  it('usa el mes actual cuando no se indica', () => {
    const periodo = parsePeriodo(undefined, REF);
    expect(periodo.clave).toBe('2026-11');
    expect(periodo.etiqueta).toBe('noviembre 2026');
    expect(periodo.mesCorto).toBe('nov');
  });

  it('parsea un mes concreto', () => {
    const periodo = parsePeriodo('2027-03');
    expect(periodo.anio).toBe(2027);
    expect(periodo.mes).toBe(3);
    expect(periodo.etiqueta).toBe('marzo 2027');
  });
});

describe('primerNombre', () => {
  it('toma la primera palabra', () => {
    expect(primerNombre('María Eugenia Pérez Soto')).toBe('María');
    expect(primerNombre('  Oscar Pérez ')).toBe('Oscar');
  });
});
