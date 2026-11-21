import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  generarPlantillaSocios,
  leerArchivoSocios,
  normalizarFecha,
  rutValido,
  validarFilas,
} from './import.js';

/**
 * Pruebas de la importación masiva, sin base de datos: normalización de
 * fechas, RUT, encabezados, plantilla y validación de filas.
 */

const ENCABEZADOS = [
  'rut',
  'nombre',
  'anio',
  'sexo',
  'fecha_nacimiento',
  'fecha_ingreso',
  'direccion',
  'email',
  'telefono',
  'estado',
  'activo',
];

function libro(filas: unknown[][]): Buffer {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), 'Socios');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

describe('rutValido', () => {
  it('acepta RUT con dígito verificador correcto', () => {
    expect(rutValido('17682512K')).toBe(true);
    expect(rutValido('12.755.663-6')).toBe(true);
    expect(rutValido('152426674')).toBe(true);
  });

  it('rechaza dígito verificador incorrecto o formato inválido', () => {
    expect(rutValido('12345678-9')).toBe(false);
    expect(rutValido('123')).toBe(false);
    expect(rutValido('17682512X')).toBe(false);
  });
});

describe('normalizarFecha', () => {
  it('acepta ISO y formato chileno DD-MM-AAAA', () => {
    expect(normalizarFecha('2021-03-01').valor).toBe('2021-03-01');
    expect(normalizarFecha('15-03-1990').valor).toBe('1990-03-15');
    expect(normalizarFecha('15/03/1990').valor).toBe('1990-03-15');
  });

  it('convierte una celda de fecha nativa de Excel (serial)', () => {
    // 45000 = 2023-03-15 en el calendario de Excel.
    expect(normalizarFecha(45000).valor).toBe('2023-03-15');
  });

  it('rechaza fechas imposibles, futuras y años sueltos', () => {
    expect(normalizarFecha('2021-02-30').error).toBeTruthy();
    expect(normalizarFecha('2999-01-01').error).toBeTruthy();
    expect(normalizarFecha(1990).error).toBeTruthy();
  });

  it('trata vacío como sin dato', () => {
    expect(normalizarFecha('').valor).toBeNull();
    expect(normalizarFecha(null).valor).toBeNull();
  });
});

describe('generarPlantillaSocios', () => {
  it('genera un xlsx con las tres hojas y los encabezados exactos', () => {
    const buffer = generarPlantillaSocios();
    expect(buffer.length).toBeGreaterThan(5000);

    const wb = XLSX.read(buffer, { type: 'buffer' });
    expect(wb.SheetNames).toEqual(['Socios', 'Ejemplos', 'Instrucciones']);

    const filas = XLSX.utils.sheet_to_json<string[]>(wb.Sheets.Socios, { header: 1 });
    expect(filas[0]).toEqual(ENCABEZADOS);
    expect(filas).toHaveLength(1);
  });

  it('la plantilla vacía no se puede importar (error claro)', async () => {
    await expect(leerArchivoSocios(generarPlantillaSocios(), 'plantilla.xlsx')).rejects.toThrow(
      /no tiene filas/i,
    );
  });
});

describe('lectura y validación de filas', () => {
  it('mapea encabezados con acentos y mayúsculas', async () => {
    const buffer = libro([
      ['RUT', 'Nombre', 'Año', 'Sexo', 'Fecha de nacimiento', 'Dirección', 'Teléfono', 'Estado'],
      ['15.242.667-4', 'Camila Rojas', '2026', 'Mujer', '15-03-1990', 'Los Carrera 555, Osorno', '+56 9 1111 2222', 'Activo'],
    ]);
    const crudas = await leerArchivoSocios(buffer, 'socios.xlsx');
    expect(crudas).toHaveLength(1);
    expect(crudas[0].datos).toMatchObject({
      rut: '15.242.667-4',
      nombre: 'Camila Rojas',
      anio: '2026',
      sexo: 'Mujer',
      fecha_nacimiento: '15-03-1990',
      direccion: 'Los Carrera 555, Osorno',
    });
  });

  it('valida y normaliza una fila completa', async () => {
    const buffer = libro([
      ENCABEZADOS,
      ['15.242.667-4', 'Camila Rojas', 2026, 'Mujer', '15-03-1990', '01-03-2021', 'Los Carrera 555, Osorno', 'CAMILA@Correo.CL', '+56 9 1111 2222', 'Activo', '1'],
    ]);
    const { validos, errores } = validarFilas(await leerArchivoSocios(buffer, 'socios.xlsx'));
    expect(errores).toEqual([]);
    expect(validos[0]).toMatchObject({
      rut: '152426674',
      nombre: 'Camila Rojas',
      anio: 2026,
      sexo: 'MUJER',
      fechaNacimiento: '1990-03-15',
      fechaIngreso: '2021-03-01',
      direccion: 'Los Carrera 555, Osorno',
      email: 'camila@correo.cl',
      estado: 'ACTIVO',
      activo: 1,
    });
  });

  it('reporta RUT inválido, sexo fuera de catálogo y RUT repetido', async () => {
    const buffer = libro([
      ENCABEZADOS,
      ['12345678-9', 'RUT Malo', 2026, '', '', '', '', '', '', '', ''],
      ['15.242.667-4', 'Buena', 2026, 'Mujer', '', '', '', '', '', '', ''],
      ['15.242.667-4', 'Repetida', 2026, '', '', '', '', '', '', '', ''],
      ['12.755.663-6', 'Sexo Malo', 2026, 'M', '', '', '', '', '', '', ''],
    ]);
    const { validos, errores } = validarFilas(await leerArchivoSocios(buffer, 'socios.xlsx'));
    expect(validos).toHaveLength(1);
    expect(errores).toHaveLength(3);
    expect(errores[0]).toMatch(/RUT inválido/);
    expect(errores[1]).toMatch(/repetido/);
    expect(errores[2]).toMatch(/sexo/i);
  });

  it('ignora filas completamente vacías', async () => {
    const buffer = libro([
      ENCABEZADOS,
      ['15.242.667-4', 'Camila', 2026, '', '', '', '', '', '', '', ''],
      ['', '', '', '', '', '', '', '', '', '', ''],
    ]);
    const { validos, errores } = validarFilas(await leerArchivoSocios(buffer, 'socios.xlsx'));
    expect(validos).toHaveLength(1);
    expect(errores).toEqual([]);
  });

  it('falla si faltan los encabezados obligatorios', async () => {
    const buffer = libro([
      ['rut', 'nombre'],
      ['152426674', 'Camila'],
    ]);
    const { errores } = validarFilas(await leerArchivoSocios(buffer, 'socios.xlsx'));
    expect(errores[0]).toMatch(/columna obligatoria "anio"/i);
  });

  it('lee CSV separado por punto y coma', async () => {
    const csv =
      'rut;nombre;anio;sexo;fecha_nacimiento\n' +
      '15.242.667-4;Camila Rojas;2026;Mujer;15-03-1990\n';
    const crudas = await leerArchivoSocios(Buffer.from(csv, 'utf8'), 'socios.csv');
    const { validos, errores } = validarFilas(crudas);
    expect(errores).toEqual([]);
    expect(validos[0].sexo).toBe('MUJER');
  });
});
