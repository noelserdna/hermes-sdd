// Doble de test del almacén: mismo contrato que el almacén JSON, en memoria y con fallo de escritura simulable.
import { datosVacios } from './almacen-json.js';
import { ErrorDominio } from '../mensajes.js';

export function crearAlmacenMemoria(inicial = datosVacios()) {
  let datos = structuredClone({ ...datosVacios(), ...inicial });
  let cola = Promise.resolve();
  const almacen = {
    fallarEscritura: false,
    leer: async () => structuredClone(datos),
    transaccion(fn) {
      const turno = cola.then(async () => {
        const copia = structuredClone(datos);
        const resultado = await fn(copia);
        if (almacen.fallarEscritura) throw new ErrorDominio('E_ALMACEN_NO_DISPONIBLE');
        datos = copia;
        return resultado;
      });
      cola = turno.catch(() => {});
      return turno;
    },
  };
  return almacen;
}
