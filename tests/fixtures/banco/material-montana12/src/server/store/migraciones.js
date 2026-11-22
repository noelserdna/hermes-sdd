// Migraciones del fichero de datos: una función por paso, idempotente y reversible. Cada paso aplicado queda anotado en
// `migraciones`; `version` sigue siendo la del esquema base (un fichero guardado antes de FASE-3 se abre sin más).
export const MIGRACIONES = [
  {
    // ADR-003, D-PA-003: fecha de baja de la cuenta (la depuración a los 3 años la usa en FASE-5)
    id: '002_baja_en',
    subir(datos) { for (const c of datos.cuentas) if (!('bajaEn' in c)) c.bajaEn = null; },
    bajar(datos) { for (const c of datos.cuentas) delete c.bajaEn; },
  },
];

/** Aplica los pasos que faltan, sin tocar los datos que ya hay. Devuelve los mismos datos (mutados). */
export function migrar(datos) {
  datos.migraciones ??= [];
  for (const m of MIGRACIONES) {
    if (datos.migraciones.includes(m.id)) continue;
    m.subir(datos);
    datos.migraciones.push(m.id);
  }
  return datos;
}

/** Paso de bajada de una migración (para revertir el commit que la trajo). */
export function deshacer(datos, id) {
  const m = MIGRACIONES.find((x) => x.id === id);
  m.bajar(datos);
  datos.migraciones = (datos.migraciones ?? []).filter((x) => x !== id);
  return datos;
}
