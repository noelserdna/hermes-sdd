import { describe, it, expect } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { listarSocios } from '../../../src/domain/socios.js';

const encargado = { id: 9, rol: 'encargado' };
const junta = { id: 8, rol: 'junta' };

describe('listarSocios como selector de Historial (API-001-06, RN-023)', () => {
  it('RN-023 el encargado y la junta reciben solo los socios con id, nombre y estado, sin correo ni hash; un socio no puede', async () => {
    const almacen = crearAlmacenMemoria();
    await almacen.transaction((db) => {
      db.cuentas.push(
        { id: 1, nombre: 'Lucía', rol: 'socio', estado: 'Activa', correo: 'lucia@club.es', hashContrasena: 'scrypt$aa$bb' },
        { id: 2, nombre: 'Marta', rol: 'socio', estado: 'Baja', correo: 'marta@club.es', hashContrasena: 'scrypt$cc$dd' },
        { id: 8, nombre: 'Ana', rol: 'junta', estado: 'Activa', correo: 'ana@club.es', hashContrasena: 'scrypt$ee$ff' },
      );
    });
    const esperado = [{ id: 1, nombre: 'Lucía', estado: 'Activa' }, { id: 2, nombre: 'Marta', estado: 'Baja' }];
    expect(await listarSocios({ almacen }, encargado)).toEqual(esperado);
    expect(await listarSocios({ almacen }, junta)).toEqual(esperado);
    expect((await listarSocios({ almacen }, { id: 1, rol: 'socio' }).catch((e) => e)).codigo).toBe('E_SIN_PERMISO');
  });
});
