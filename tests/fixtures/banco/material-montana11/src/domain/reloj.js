// ADR-002: único punto de `hoy()` y `ahora()`. Ningún otro módulo lee Date.now() ni new Date() para decidir fechas.
const ZONA = 'Europe/Madrid';
const formato = new Intl.DateTimeFormat('en-CA', { timeZone: ZONA, year: 'numeric', month: '2-digit', day: '2-digit' });

function instanteFijo(fijo) {
  // '2026-12-05' → ese día a mediodía UTC (cae el mismo día en Madrid); con hora, el instante exacto.
  return Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(fijo) ? `${fijo}T12:00:00Z` : fijo);
}

/**
 * `fijo` (CLOCK_FIXED) congela el reloj y se ignora con NODE_ENV=production; `ahora` inyecta una función de ms
 * (los tests avanzan el reloj sin esperas, D-T-002).
 */
export function crearReloj({ fijo, ahora } = {}) {
  const usarFijo = fijo && process.env.NODE_ENV !== 'production';
  const leerAhora = usarFijo ? () => instanteFijo(fijo) : (ahora ?? (() => Date.now()));
  return {
    ahora: () => leerAhora(),
    hoy: () => formato.format(new Date(leerAhora())),
  };
}
