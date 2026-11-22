// «Hoy» del servidor de pruebas para los recorridos de FASE-1 en adelante. El servidor arranca con CLOCK_FIXED=2026-12-01
// (playwright.config.js); con CLOCK_FIXED puesto lee `relojFijo` del almacén en cada petición (src/server/http.js), así
// que cada caso fija su día después de sembrar. `sembrar()` reescribe el almacén y vuelve al día por defecto.
import { modificarAlmacen } from './semilla.js';

export const fijarHoy = (dia) => modificarAlmacen((datos) => { datos.relojFijo = dia; });
