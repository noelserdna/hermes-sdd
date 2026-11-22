import { describe, it, expect, beforeEach } from 'vitest';
import { consultarHistorialSocio, listarSociosHistorial } from '../../src/domain/prestamos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sembrarMulta, sesionDe } from '../helpers/material.js';

let e; let lucia; let pablo;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Ana Mir', correo: 'ana@club.test', contrasena: 'Cumbre2026' });
  const { cuentas } = e.store.leer();
  lucia = cuentas.find((c) => c.correo === 'lucia@club.test').id;
  pablo = cuentas.find((c) => c.correo === 'pablo@club.test').id;
  sembrarUnidades(e, 'Piolet', 1);
  sembrarUnidades(e, 'Casco', 2);
  sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto' });
  sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
});
const junta = () => e.ctx(sesionDe(e, 'junta@club.test'));

describe('API-003-10 consultarHistorialSocio (UC-016)', () => {
  // REQ-F-010 AC1: "the user sees "Multa 6,00 € Pendiente" and not the loans of "Lucía Gil""
  it('AC-016-01 REQ-F-010 AC1 el historial de Pablo Ruiz incluye la multa de 6,00 € (importeEur 6) Pendiente y nada de Lucía Gil', () => {
    const h = consultarHistorialSocio(junta(), { socioId: pablo });
    expect(h.socio.nombre).toBe('Pablo Ruiz');
    expect(h.multas).toEqual([expect.objectContaining({ importeEur: 6, estado: 'Pendiente' })]);
    expect(h.prestamos).toEqual([]);
    expect(JSON.stringify(h)).not.toContain('Lucía');   // INV-SEC-001
  });

  // REQ-F-010 AC2: "the user sees "Piolet 1" with "Devuelto""
  it('AC-016-02 REQ-F-010 AC2 el historial de Lucía Gil incluye el Piolet 1 con estado Devuelto', () => {
    const h = consultarHistorialSocio(junta(), { socioId: lucia });
    expect(h.prestamos).toEqual([expect.objectContaining({ material: 'Piolet', unidad: 1, fin: '2026-12-07', estado: 'Devuelto' })]);
    expect(h.multas).toEqual([]);
  });

  // REQ-F-010 AC3: "the user sees "Sin préstamos ni multas""
  it('AC-016-03 REQ-F-010 AC3 un socio sin movimientos devuelve listas vacías', () => {
    const ana = e.store.leer().cuentas.find((c) => c.correo === 'ana@club.test').id;
    const h = consultarHistorialSocio(junta(), { socioId: ana });
    expect(h.prestamos).toEqual([]);
    expect(h.multas).toEqual([]);
    expect(h.prestamos.length + h.multas.length === 0 ? 'Sin préstamos ni multas' : '').toBe('Sin préstamos ni multas');   // lo que la pantalla muestra sin filas
  });

  it('un préstamo Entregado figura en el historial; una reserva Reservada o Cancelada no es un préstamo', () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 1, inicio: '2026-12-10', fin: '2026-12-12', estado: 'Entregado' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-20', fin: '2026-12-21' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Piolet', inicio: '2026-12-22', fin: '2026-12-23', estado: 'Cancelada' });
    expect(consultarHistorialSocio(junta(), { socioId: pablo }).prestamos.map((p) => `${p.material} ${p.unidad} ${p.estado}`)).toEqual(['Casco 1 Entregado']);
  });

  it('RN-007 un socio en Baja conserva su historial dentro de la retención', () => {
    e.store.transaccion((db) => { db.cuentas.find((c) => c.id === lucia).estado = 'Baja'; });
    expect(consultarHistorialSocio(junta(), { socioId: lucia }).prestamos).toHaveLength(1);
  });

  it('AC-016-05 con rol socio responde E_ACCESO_NO_PERMITIDO y ningún historial', async () => {
    const error = await fallo(() => consultarHistorialSocio(e.ctx(sesionDe(e, 'lucia@club.test')), { socioId: pablo }));
    expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    expect(error.message).toBe('Acceso no permitido');
  });

  it('AC-016-06 un socio inexistente da E_SOCIO_NO_ENCONTRADO; un id que no es número, E_DATOS_INVALIDOS; la junta no es un socio', async () => {
    expect((await fallo(() => consultarHistorialSocio(junta(), { socioId: 999 }))).codigo).toBe('E_SOCIO_NO_ENCONTRADO');
    expect((await fallo(() => consultarHistorialSocio(junta(), { socioId: 'x' }))).codigo).toBe('E_DATOS_INVALIDOS');
    expect((await fallo(() => consultarHistorialSocio(junta(), { socioId: 1 }))).codigo).toBe('E_SOCIO_NO_ENCONTRADO');
  });

  it('AC-016-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y sin historial', async () => {
    const ctx = junta();
    e.caer();
    expect((await fallo(() => consultarHistorialSocio(ctx, { socioId: pablo }))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });

  it('el selector de la junta: listarSociosHistorial devuelve solo id, nombre y estado de los socios, y solo a la junta', async () => {
    expect(listarSociosHistorial(junta())).toEqual([
      { id: lucia, nombre: 'Lucía Gil', estado: 'Activa' }, { id: pablo, nombre: 'Pablo Ruiz', estado: 'Activa' }, expect.objectContaining({ nombre: 'Ana Mir' }),
    ]);
    expect(Object.keys(listarSociosHistorial(junta())[0]).sort()).toEqual(['estado', 'id', 'nombre']);
    expect((await fallo(() => listarSociosHistorial(e.ctx(sesionDe(e, 'lucia@club.test'))))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
  });
});
