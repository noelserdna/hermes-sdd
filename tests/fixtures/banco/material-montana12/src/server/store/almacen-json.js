// Almacén en un fichero JSON con escritura atómica (ADR-DRAFT-002): se escribe a .tmp y se renombra.
// Una cola de promesas serializa las transacciones. Se lee de disco cada vez: el dato compartido es el fichero.
import * as nodeFs from 'node:fs/promises';
import path from 'node:path';
import { ErrorDominio } from '../mensajes.js';
import { migrar as migrarPasos } from './migraciones.js';

export const VERSION_ESQUEMA = 1;

export function datosVacios() {
  return { version: VERSION_ESQUEMA, cuentas: [], material: [], reservas: [], multas: [], migraciones: ['002_baja_en'] };
}

/** Al abrir: completa lo que falte y aplica las migraciones pendientes (migraciones.js). */
function migrar(datos) {
  return migrarPasos({ ...datosVacios(), ...datos, migraciones: datos.migraciones ?? [], version: VERSION_ESQUEMA });
}

export function crearAlmacenJson(ruta, { fs = nodeFs } = {}) {
  let cola = Promise.resolve();

  async function leerFichero() {
    try {
      return migrar(JSON.parse(await fs.readFile(ruta, 'utf8')));
    } catch (e) {
      if (e.code === 'ENOENT') return datosVacios();
      throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
    }
  }

  async function escribir(datos) {
    const tmp = `${ruta}.tmp`;
    try {
      await fs.mkdir(path.dirname(ruta), { recursive: true });
      await fs.writeFile(tmp, JSON.stringify(datos, null, 2));
      await fs.rename(tmp, ruta);
    } catch {
      await fs.rm(tmp, { force: true }).catch(() => {});
      throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
    }
  }

  return {
    leer: () => leerFichero(),
    /** Copia el fichero tal como está a `<ruta>.bak` (la depuración la pide antes de borrar). Sin fichero no hay nada que copiar. */
    async respaldar() {
      try { await fs.copyFile(ruta, `${ruta}.bak`); } catch (e) { if (e.code !== 'ENOENT') throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE'); }
    },
    /** Ejecuta fn(datos) sobre una copia; si no lanza, escribe la copia. El resultado de fn es el de la transacción. */
    transaccion(fn) {
      const turno = cola.then(async () => {
        const datos = await leerFichero();
        const resultado = await fn(datos);
        await escribir(datos);
        return resultado;
      });
      cola = turno.catch(() => {});
      return turno;
    },
  };
}
