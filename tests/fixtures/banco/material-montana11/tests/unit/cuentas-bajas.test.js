import { describe, it, expect, beforeEach } from 'vitest';
import { iniciarSesion, comprobarSesion, restablecerContrasena, darDeBajaSocio } from '../../src/domain/cuentas.js';
import { consultarDisponibilidad } from '../../src/domain/reservas.js';
import { listarSocios } from '../../src/domain/cuentas.js';
import { TEXTOS } from '../../src/ui/textos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva } from '../helpers/material.js';

let e; let sidMarta; let lucia;
beforeEach(() => {
  e = crearEntorno();
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  sidMarta = entrar('marta@club.test', 'Cumbre2026').sid;
  lucia = e.store.leer().cuentas.find((c) => c.correo === 'lucia@club.test').id;
});
const entrar = (correo, contrasena) => iniciarSesion(e.ctx(), { correo, contrasena });
const comoMarta = () => e.ctx(sidMarta);
const hashDe = (correo) => e.store.leer().cuentas.find((c) => c.correo === correo).hashContrasena;

describe('UC-004 restablecerContrasena (API-001-06)', () => {
  // REQ-F-002 AC4: "GIVEN the member "Lucía Gil" forgot her password WHEN the encargado sets the new password "Hielo2026x" THEN she can sign in with it and no longer with the old one"
  it('AC-004-01 REQ-F-002 AC4 el encargado fija "Hielo2026x" a "Lucía Gil": entra con ella, con "Cumbre2026" da error y la operación responde éxito', () => {
    const r = restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' });
    expect(r).toEqual({});
    expect(TEXTOS.contrasenaRestablecida).toBe('Contraseña restablecida');   // el aviso que la pantalla muestra al responder éxito
    expect(entrar('lucia@club.test', 'Hielo2026x').rol).toBe('socio');
    expect(() => entrar('lucia@club.test', 'Cumbre2026')).toThrowError('Correo o contraseña incorrectos');
  });

  it('INV-ACC-008 una sesión abierta de Lucía deja de ser válida tras restablecer y la del encargado sigue', () => {
    const sidLucia = entrar('lucia@club.test', 'Cumbre2026').sid;
    expect(comprobarSesion(e.ctx(sidLucia)).nombre).toBe('Lucía Gil');
    restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' });
    expect(() => comprobarSesion(e.ctx(sidLucia))).toThrowError(expect.objectContaining({ codigo: 'E_NO_AUTENTICADO' }));
    expect(comprobarSesion(comoMarta()).nombre).toBe('Marta');
  });

  it('AC-004-03 la contraseña "corta1" da E_CONTRASENA_CORTA y la anterior sigue vigente', async () => {
    const antes = hashDe('lucia@club.test');
    const error = await fallo(() => restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'corta1' }));
    expect(error.codigo).toBe('E_CONTRASENA_CORTA');
    expect(error.message).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(hashDe('lucia@club.test')).toBe(antes);
    expect(entrar('lucia@club.test', 'Cumbre2026').rol).toBe('socio');
  });

  it('AC-004-04 un socio inexistente da E_SOCIO_NO_ENCONTRADO y nada cambia; con la cuenta en Baja también (INV-ACC-009)', async () => {
    e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026', estado: 'Baja' });
    const pablo = e.store.leer().cuentas.find((c) => c.correo === 'pablo@club.test').id;
    const antes = JSON.stringify(e.store.leer().cuentas);
    for (const socioId of [999, pablo]) {
      const error = await fallo(() => restablecerContrasena(comoMarta(), { socioId, contrasena: 'Hielo2026x' }));
      expect(error.codigo).toBe('E_SOCIO_NO_ENCONTRADO');
      expect(error.message).toBe('El socio no existe');
    }
    expect(JSON.stringify(e.store.leer().cuentas)).toBe(antes);
  });

  it('AC-004-08 fijar otra vez "Hielo2026x" responde éxito y solo vale "Hielo2026x"', () => {
    restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' });
    expect(restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' })).toEqual({});
    expect(entrar('lucia@club.test', 'Hielo2026x').rol).toBe('socio');
    expect(() => entrar('lucia@club.test', 'Cumbre2026')).toThrowError('Correo o contraseña incorrectos');
  });

  it('AC-004-06 con rol socio o junta da E_ACCESO_NO_PERMITIDO y nada cambia', async () => {
    const antes = hashDe('lucia@club.test');
    for (const correo of ['lucia@club.test', 'junta@club.test']) {
      const sid = entrar(correo, 'Cumbre2026').sid;
      const error = await fallo(() => restablecerContrasena(e.ctx(sid), { socioId: lucia, contrasena: 'Hielo2026x' }));
      expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    }
    expect(hashDe('lucia@club.test')).toBe(antes);
  });

  it('AC-004-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y la contraseña anterior sigue vigente', async () => {
    e.caer();
    const error = await fallo(() => restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' }));
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(entrar('lucia@club.test', 'Cumbre2026').rol).toBe('socio');
  });

  it('D-PA-005 el socio no tiene que cambiar la contraseña al entrar: no se guarda ninguna marca de cambio obligado', () => {
    restablecerContrasena(comoMarta(), { socioId: lucia, contrasena: 'Hielo2026x' });
    const cuenta = e.store.leer().cuentas.find((c) => c.id === lucia);
    expect(Object.keys(cuenta).sort()).toEqual(['bloqueadaHasta', 'correo', 'estado', 'fallosSeguidos', 'hashContrasena', 'id', 'nombre', 'rol']);
    expect(JSON.stringify(cuenta)).not.toContain('Hielo2026x');
  });
});

describe('UC-004 darDeBajaSocio (API-001-07)', () => {
  let pablo;
  beforeEach(() => {
    e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
    pablo = e.store.leer().cuentas.find((c) => c.correo === 'pablo@club.test').id;
    sembrarUnidades(e, 'Casco', 2);
  });
  const cuentaPablo = () => e.store.leer().cuentas.find((c) => c.id === pablo);
  const reservasDe = (estado) => e.store.leer().reservas.filter((r) => r.estado === estado);
  const libresCasco = () => consultarDisponibilidad(e.ctx(entrar('lucia@club.test', 'Cumbre2026').sid), { material: 'Casco', inicio: '2026-12-20', fin: '2026-12-21' }).libres;

  // REQ-F-002 AC5: "GIVEN "Pablo Ruiz" has 1 future reservation of "Casco 2" WHEN the encargado deactivates him THEN the user sees "Pablo Ruiz" marked "Baja" and the reservation is cancelled, freeing the unit"
  it('AC-004-02 REQ-F-002 AC5 "Pablo Ruiz" con 1 reserva futura de "Casco 2" queda "Baja", la reserva Cancelada y "Casco 2" libre', () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    expect(libresCasco()).toBe(1);
    const r = darDeBajaSocio(comoMarta(), { socioId: pablo });
    expect(r).toEqual({ id: pablo, nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Baja' });
    expect(listarSocios(comoMarta()).find((s) => s.nombre === 'Pablo Ruiz').estado).toBe('Baja');
    expect(reservasDe('Reservada')).toEqual([]);
    expect(reservasDe('Cancelada').map((x) => [x.unidadId, x.canceladaEl])).toEqual([[2, '2026-12-05']]);
    expect(libresCasco()).toBe(2);
  });

  // REQ-F-002 AC6: "GIVEN "Pablo Ruiz" has a lent unit not yet returned WHEN the encargado tries to deactivate him THEN the user sees "No se puede dar de baja: tiene material sin devolver" and he stays active"
  it('AC-004-05 REQ-F-002 AC6 "Pablo Ruiz" con un Casco Entregado sin devolver da E_SOCIO_CON_MATERIAL, sigue Activa y sus reservas intactas', async () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    const antes = JSON.stringify(e.store.leer());
    const error = await fallo(() => darDeBajaSocio(comoMarta(), { socioId: pablo }));
    expect(error.codigo).toBe('E_SOCIO_CON_MATERIAL');
    expect(error.message).toBe('No se puede dar de baja: tiene material sin devolver');
    const despues = e.store.leer();
    // REQ-F-002 AC6 cláusula: "he stays active"
    expect(despues.cuentas.find((c) => c.id === pablo).estado).toBe('Activa');
    expect(despues.reservas).toEqual(JSON.parse(antes).reservas);
  });

  it('AC-004-09 con "Pablo Ruiz" ya en Baja, repetir responde éxito y no cambia nada', () => {
    darDeBajaSocio(comoMarta(), { socioId: pablo });
    const antes = JSON.stringify(e.store.leer().cuentas) + JSON.stringify(e.store.leer().reservas);
    expect(darDeBajaSocio(comoMarta(), { socioId: pablo }).estado).toBe('Baja');
    expect(JSON.stringify(e.store.leer().cuentas) + JSON.stringify(e.store.leer().reservas)).toBe(antes);
  });

  it('INV-ACC-008 las sesiones abiertas de Pablo dejan de ser válidas tras la baja', () => {
    const sid = entrar('pablo@club.test', 'Nieve2026').sid;
    darDeBajaSocio(comoMarta(), { socioId: pablo });
    expect(() => comprobarSesion(e.ctx(sid))).toThrowError(expect.objectContaining({ codigo: 'E_NO_AUTENTICADO' }));
  });

  it('RN-007 tras la baja las reservas Devuelta y los préstamos de Pablo siguen en el almacén', () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 1, inicio: '2026-11-10', fin: '2026-11-12', estado: 'Devuelto' });
    darDeBajaSocio(comoMarta(), { socioId: pablo });
    expect(reservasDe('Devuelto').map((r) => r.socioId)).toEqual([pablo]);
    expect(cuentaPablo().correo).toBe('pablo@club.test');
  });

  it('AC-004-04 un socio inexistente o que es el encargado da E_SOCIO_NO_ENCONTRADO', async () => {
    expect((await fallo(() => darDeBajaSocio(comoMarta(), { socioId: 999 }))).codigo).toBe('E_SOCIO_NO_ENCONTRADO');
    const marta = e.store.leer().cuentas.find((c) => c.correo === 'marta@club.test').id;
    expect((await fallo(() => darDeBajaSocio(comoMarta(), { socioId: marta }))).codigo).toBe('E_SOCIO_NO_ENCONTRADO');
  });

  it('AC-004-06 con rol socio da E_ACCESO_NO_PERMITIDO y la cuenta sigue Activa', async () => {
    const sid = entrar('lucia@club.test', 'Cumbre2026').sid;
    const error = await fallo(() => darDeBajaSocio(e.ctx(sid), { socioId: pablo }));
    expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(cuentaPablo().estado).toBe('Activa');
  });

  it('AC-004-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y la cuenta sigue Activa con sus reservas', async () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    e.caer();
    const error = await fallo(() => darDeBajaSocio(comoMarta(), { socioId: pablo }));
    expect(error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(cuentaPablo().estado).toBe('Activa');
    expect(reservasDe('Reservada')).toHaveLength(1);
  });
});
