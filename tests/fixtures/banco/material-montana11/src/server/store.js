// ADR-001/ADR-005: un único almacén JSON compartido. Cada escritura copia, valida y vuelca de una vez (INV-SEC-003).
import { readFileSync, writeFileSync, renameSync, mkdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { ErrorDominio } from '../domain/errores.js';

const COLECCIONES = ['cuentas', 'unidades', 'reservas', 'multas', 'sesiones'];

function almacenVacio() {
  return {
    version: 1,
    contadores: { cuentas: 0, unidades: 0, reservas: 0, multas: 0 },
    cuentas: [], unidades: [], reservas: [], multas: [], sesiones: [],
  };
}

/** Lleva el formato guardado al actual. Hoy solo existe la versión 1. */
function migrar(db) {
  if (db.version === undefined) db.version = 1;
  return db;
}

/** Siguiente identificador de una colección (contador propio, nunca se reutiliza). */
export function siguienteId(db, coleccion) {
  db.contadores[coleccion] = (db.contadores[coleccion] ?? 0) + 1;
  return db.contadores[coleccion];
}

/**
 * `falloEscritura` (booleano o función) simula un fallo de E/S al guardar (D-T-003).
 * Se relee el fichero en cada operación: el comando `seed` y el servidor comparten el mismo almacén.
 */
export function crearStore({ archivo, falloEscritura } = {}) {
  function leer() {
    if (!existsSync(archivo)) return almacenVacio();
    try {
      const db = migrar(JSON.parse(readFileSync(archivo, 'utf8')));
      for (const c of COLECCIONES) db[c] ??= [];
      return db;
    } catch {
      throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
    }
  }

  function transaccion(fn) {
    const copia = leer();
    const resultado = fn(copia);
    const falla = typeof falloEscritura === 'function' ? falloEscritura() : falloEscritura;
    if (falla) throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
    try {
      mkdirSync(path.dirname(archivo), { recursive: true });
      const temporal = `${archivo}.tmp`;
      writeFileSync(temporal, JSON.stringify(copia));
      renameSync(temporal, archivo);
    } catch {
      throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
    }
    return resultado;
  }

  return { leer, transaccion };
}
