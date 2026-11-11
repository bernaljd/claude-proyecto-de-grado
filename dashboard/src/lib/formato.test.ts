// Formato de números en español (Colombia): coma decimal, punto de miles.
import { describe, expect, it } from 'vitest';
import { diaDeLaSemana, fechaConDia, fechaCorta, moneda, numero, unidadesPronosticadas } from './formato';

describe('formato en español', () => {
  it('usa coma para los decimales y punto para los miles', () => {
    expect(numero(1234.5, 1)).toBe('1.234,5');
    expect(numero(4.02, 2)).toBe('4,02');
    expect(numero(1000000)).toBe('1.000.000');
  });

  it('muestra la moneda como £4,02', () => {
    expect(moneda(4.02)).toBe('£4,02');
  });

  it('muestra las fechas como «29 dic 2025»', () => {
    expect(fechaCorta('2025-12-29')).toBe('29 dic 2025');
    expect(fechaConDia('2025-12-31')).toBe('mié 31 dic');
  });

  it('las unidades pronosticadas llevan 1 decimal (0,3, no un 0 engañoso)', () => {
    expect(unidadesPronosticadas(0.3)).toBe('0,3');
    expect(unidadesPronosticadas(0.04)).toBe('0,0');
  });

  it('un valor vacío se muestra como «—», jamás como 0', () => {
    expect(numero(null)).toBe('—');
    expect(moneda(undefined)).toBe('—');
    expect(unidadesPronosticadas(null)).toBe('—');
  });

  it('calcula el día de la semana sin zona horaria (2025-12-29 es lunes)', () => {
    expect(diaDeLaSemana('2025-12-29')).toBe(0);
    expect(diaDeLaSemana('2025-12-31')).toBe(2);
    expect(diaDeLaSemana('2026-01-03')).toBe(5);
  });
});
