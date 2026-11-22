// ADR-004 · INV-MUL-004: el retraso y la multa se calculan con funciones puras; la multa solo se crea al devolver.
import { diasEntre } from './fechas.js';

// Valor de spec/VALUE-REGISTRY.md
export const FINE_PER_DAY_EUR = 2;

/** Días naturales de retraso: `hasta` (día de la devolución, o hoy si no se ha devuelto) − `fin`; 0 si no hay retraso. */
export function diasRetraso(fin, hasta) {
  return hasta > fin ? diasEntre(fin, hasta).length - 1 : 0;
}

/** Importe en € de la multa de `dias` días de retraso; sin retraso, 0. */
export const importeMulta = (dias) => Math.max(dias, 0) * FINE_PER_DAY_EUR;
