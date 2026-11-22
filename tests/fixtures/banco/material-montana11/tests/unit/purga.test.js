import { describe, it, expect, beforeEach } from 'vitest';
import { purgar } from '../../src/server/purga.js';
import { purgarAlArrancar } from '../../src/server/plugin.js';
import { RETENTION_YEARS } from '../../src/domain/constantes.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sembrarMulta } from '../helpers/material.js';

const HOY = '2026-12-11';
let e;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Ana Mir', correo: 'ana@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026', estado: 'Baja' });
  sembrarUnidades(e, 'Piolet', 3);
});
const correos = () => e.store.leer().cuentas.map((c) => c.correo);
const reservasDe = (correo) => { const db = e.store.leer(); const id = db.cuentas.find((c) => c.correo === correo)?.id; return db.reservas.filter((r) => r.socioId === id); };

describe('SPEC-LIM-003 / RN-010 purga por retención', () => {
  it('RETENTION_YEARS vale 2 (VALUE-REGISTRY)', () => { expect(RETENTION_YEARS).toBe(2); });

  // SPEC-LIM-003: "RETENTION_YEARS desde la última actividad"
  it('SPEC-LIM-003 purga a los 2 años: con hoy 2026-12-11 se borran la cuenta y el historial de quien no tiene actividad desde antes del 2024-12-11, y se conserva el reciente', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', unidad: 1, inicio: '2024-05-01', fin: '2024-05-03', estado: 'Devuelto' });
    sembrarMulta(e, 'lucia@club.test', { importeEur: 4 });   // creada el 2026-11-10: actividad reciente de Lucía
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 2, inicio: '2024-05-01', fin: '2024-05-03', estado: 'Devuelto' });
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 3, inicio: '2026-11-01', fin: '2026-11-03', estado: 'Devuelto' });
    const antes = e.store.leer();
    const resumen = purgar(e.store, HOY);
    expect(resumen).toEqual({ cuentas: 0, reservas: 2, multas: 0 });
    expect(reservasDe('lucia@club.test')).toEqual([]);   // el préstamo viejo sale aunque la cuenta siga viva
    expect(reservasDe('ana@club.test').map((r) => r.inicio)).toEqual(['2026-11-01']);
    expect(e.store.leer().multas).toEqual(antes.multas);
  });

  it('SPEC-LIM-003 una cuenta de socio sin actividad desde hace más de 2 años se borra con su historial y sus sesiones; las del encargado y la junta no', () => {
    e.store.transaccion((db) => {
      const ana = db.cuentas.find((c) => c.correo === 'ana@club.test');
      db.multas.push({ id: 1, socioId: ana.id, reservaId: 0, diasRetraso: 1, importeEur: 2, estado: 'Pagada', creadaEl: '2024-01-10', pagadaEl: '2024-01-12' });
      db.sesiones.push({ id: 'vieja', cuentaId: ana.id, ultimaActividad: '2024-01-12T10:00:00.000Z' });
    });
    const resumen = purgar(e.store, HOY);
    expect(resumen).toEqual({ cuentas: 1, reservas: 0, multas: 1 });
    expect(correos()).toEqual(['marta@club.test', 'lucia@club.test', 'pablo@club.test']);
    const db = e.store.leer();
    expect(db.multas).toEqual([]);
    expect(db.sesiones).toEqual([]);
  });

  it('el límite: una actividad de hace exactamente 2 años (2024-12-11) se conserva; de un día antes (2024-12-10), no', () => {
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 1, inicio: '2024-12-09', fin: '2024-12-11', estado: 'Devuelto' });
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 2, inicio: '2024-12-08', fin: '2024-12-10', estado: 'Devuelto' });
    purgar(e.store, HOY);
    expect(reservasDe('ana@club.test').map((r) => r.fin)).toEqual(['2024-12-11']);
  });

  // RN-010: "un socio en Baja con actividad de hace menos de 2 años conserva su historial"
  it('RN-010 socio en Baja dentro de la retención: Pablo Ruiz, en Baja, con un préstamo de hace menos de 2 años conserva cuenta e historial', () => {
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Piolet', unidad: 1, inicio: '2025-03-01', fin: '2025-03-03', estado: 'Devuelto' });
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    purgar(e.store, HOY);
    expect(correos()).toContain('pablo@club.test');
    expect(reservasDe('pablo@club.test')).toHaveLength(1);
    expect(e.store.leer().multas).toHaveLength(1);
  });

  it('INV-SEC-003 un fallo del almacén al guardar no deja la purga a medias: nada cambia', async () => {
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 1, inicio: '2024-01-01', fin: '2024-01-03', estado: 'Devuelto' });
    const antes = JSON.stringify(e.store.leer());
    e.caer();
    expect((await fallo(() => purgar(e.store, HOY))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
    e.caer(false);
    expect(JSON.stringify(e.store.leer())).toBe(antes);
  });

  it('repetir la purga no cambia nada más', () => {
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 1, inicio: '2024-01-01', fin: '2024-01-03', estado: 'Devuelto' });
    purgar(e.store, HOY);
    expect(purgar(e.store, HOY)).toEqual({ cuentas: 0, reservas: 0, multas: 0 });
  });

  it('SPEC-LIM-003 purgarAlArrancar purga con el reloj del servidor, registra una línea sin datos personales y no tumba el arranque si el almacén falla', () => {
    sembrarReserva(e, { correo: 'ana@club.test', tipo: 'Piolet', unidad: 1, inicio: '2024-01-01', fin: '2024-01-03', estado: 'Devuelto' });
    const lineas = [];
    expect(purgarAlArrancar({ store: e.store, reloj: e.reloj, log: (l) => lineas.push(l) })).toEqual({ cuentas: 1, reservas: 1, multas: 0 });
    expect(lineas).toHaveLength(1);
    expect(lineas[0]).not.toMatch(/ana@|Ana Mir/);
    e.caer();
    expect(purgarAlArrancar({ store: e.store, reloj: e.reloj, log: (l) => lineas.push(l) })).toBeNull();
    expect(JSON.parse(lineas[1]).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });
});
