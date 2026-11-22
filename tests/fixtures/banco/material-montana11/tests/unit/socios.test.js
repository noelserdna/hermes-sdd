import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { iniciarSesion, crearSocio, listarSocios } from '../../src/domain/cuentas.js';
import { PASSWORD_MIN_LENGTH } from '../../src/domain/constantes.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';

let e; let encargado;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  encargado = e.ctx(iniciarSesion(e.ctx(), { correo: 'marta@club.test', contrasena: 'Cumbre2026' }).sid);
});
const alta = (datos = { nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' }) => crearSocio(encargado, datos);

describe('UC-003 crearSocio y listarSocios', () => {
  it('INV-ACC-001 el encargado crea a "Pablo Ruiz", "pablo@club.test" con "Nieve2026" y la lista de Socios lo muestra Activa', () => {
    alta();
    expect(listarSocios(encargado)).toEqual([{ id: expect.any(Number), nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Activa' }]);
  });

  it('INV-ACC-002 la contraseña "corta1" lanza E_CONTRASENA_CORTA y no se crea el socio', async () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    const error = await fallo(() => alta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'corta1' }));
    expect(error.codigo).toBe('E_CONTRASENA_CORTA');
    expect(error.message).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(listarSocios(encargado)).toEqual([]);
  });

  it('INV-ACC-001 "PABLO@club.test" con otro nombre lanza E_CORREO_DUPLICADO y queda un solo socio', async () => {
    alta();
    const error = await fallo(() => alta({ nombre: 'Otro Pablo', correo: 'PABLO@club.test', contrasena: 'Nieve2026' }));
    expect(error.codigo).toBe('E_CORREO_DUPLICADO');
    expect(error.message).toBe('Ya existe un socio con ese correo');
    expect(listarSocios(encargado).map((s) => s.correo)).toEqual(['pablo@club.test']);
  });

  it('AC-003-02 la lista incluye a un socio en Baja marcado "Baja"', () => {
    e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026', estado: 'Baja' });
    e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
    const lista = listarSocios(encargado);
    expect(lista.find((s) => s.nombre === 'Pablo Ruiz').estado).toBe('Baja');
    expect(lista.find((s) => s.nombre === 'Lucía Gil').estado).toBe('Activa');
  });

  it('INV-SEC-001 la lista solo trae socios, sin el encargado y nunca el hash', () => {
    alta();
    const lista = listarSocios(encargado);
    expect(lista).toHaveLength(1);
    for (const socio of lista) expect(Object.keys(socio).sort()).toEqual(['correo', 'estado', 'id', 'nombre']);
  });

  it('AC-003-03 datos vacíos: E_DATOS_INVALIDOS y la lista queda igual', async () => {
    alta();
    const antes = listarSocios(encargado);
    for (const datos of [
      { nombre: '', correo: 'x@club.test', contrasena: 'Nieve2026' },
      { nombre: 'X', correo: '', contrasena: 'Nieve2026' },
      { nombre: 'X', correo: 'sin-arroba', contrasena: 'Nieve2026' },
      { nombre: 'X', correo: 'x@club.test', contrasena: '' },
      {},
    ]) expect((await fallo(() => alta(datos))).codigo).toBe('E_DATOS_INVALIDOS');
    expect(listarSocios(encargado)).toEqual(antes);
  });

  it('AC-003-07 con el almacén caído: E_ALMACEN_NO_DISPONIBLE y no se crea la cuenta', async () => {
    e.caer();
    expect((await fallo(() => alta())).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(listarSocios(encargado)).toEqual([]);
  });

  // REQ-NF-001 AC3: "GIVEN the stored data after creating "pablo" with password "Nieve2026" THEN the text "Nieve2026" appears nowhere and the stored value is a hash"
  it('REQ-NF-001 AC3 tras crear a pablo con la contraseña "Nieve2026" el texto no aparece en el almacén y lo guardado es un hash', () => {
    alta({ nombre: 'Pablo', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
    expect(readFileSync(e.archivo, 'utf8')).not.toContain('Nieve2026');
    expect(e.store.leer().cuentas.find((c) => c.correo === 'pablo@club.test').hashContrasena).toMatch(/^scrypt\$\d+\$\d+\$\d+\$[0-9a-f]+\$[0-9a-f]+$/);
  });

  it('el socio creado puede entrar con su contraseña', () => {
    alta();
    expect(iniciarSesion(e.ctx(), { correo: 'pablo@club.test', contrasena: 'Nieve2026' })).toMatchObject({ nombre: 'Pablo Ruiz', rol: 'socio' });
  });
});
