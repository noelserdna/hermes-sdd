import * as nodeFs from 'node:fs/promises';
import path from 'node:path';
import { error } from '../domain/errores.js';

// Puerto `store` (ADR-002, ADR-DRAFT-001): load() y transaction(fn). Un solo proceso, fichero JSON con escritura
// atómica (temporal + rename). Cada operación vuelve a leer el fichero: lo que cambie fuera se ve en la siguiente.
const vacio = () => ({ schemaVersion: 1, cuentas: [], unidades: [], reservas: [], multas: [], sesiones: [] });

function crearPuerto(medio) {
  let cola = Promise.resolve();

  async function leer() {
    let texto;
    try { texto = await medio.leer(); } catch { throw error('E_ALMACEN_NO_DISPONIBLE'); }
    if (texto === null) {
      try { await medio.escribir(JSON.stringify(vacio(), null, 2)); } catch { throw error('E_ALMACEN_NO_DISPONIBLE'); }
      return { texto: null, datos: vacio() };
    }
    try { return { texto, datos: JSON.parse(texto) }; } catch { throw error('E_ALMACEN_NO_DISPONIBLE'); }
  }

  async function ejecutar(fn) {
    const { datos } = await leer();
    const antes = JSON.stringify(datos, null, 2);
    const resultado = await fn(datos);
    const despues = JSON.stringify(datos, null, 2);
    if (despues !== antes) {
      try { await medio.escribir(despues); } catch { throw error('E_ALMACEN_NO_DISPONIBLE'); }
    }
    return resultado;
  }

  return {
    async load() { return (await leer()).datos; },
    // fn(db) trabaja sobre una copia: si lanza, no se escribe nada; las transacciones se ejecutan de una en una.
    transaction(fn) {
      const turno = cola.then(() => ejecutar(fn));
      cola = turno.catch(() => {});
      return turno;
    },
  };
}

export function crearAlmacen({ env = process.env, archivo = env.STORE_FILE ?? 'data/store.json', fs = nodeFs } = {}) {
  const ruta = path.resolve(archivo);
  const medio = {
    async leer() {
      try { return await fs.readFile(ruta, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return null; throw e; }
    },
    async escribir(texto) {
      await fs.mkdir(path.dirname(ruta), { recursive: true });
      const temporal = `${ruta}.${process.pid}.${Date.now()}.tmp`;
      try {
        await fs.writeFile(temporal, texto);
        await fs.rename(temporal, ruta);
      } catch (e) {
        await fs.rm(temporal, { force: true }).catch(() => {});
        throw e;
      }
    },
  };
  return { archivo: ruta, ...crearPuerto(medio) };
}

export function crearAlmacenMemoria(inicial = vacio()) {
  let texto = JSON.stringify(inicial);
  return crearPuerto({ leer: async () => texto, escribir: async (nuevo) => { texto = nuevo; } });
}
