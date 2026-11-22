import { describe, it, expect, beforeEach } from 'vitest';
import { consultarPrestado } from '../../src/domain/prestamos.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarUnidades, sembrarReserva, sesionDe } from '../helpers/material.js';

let e;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-09T10:00:00Z' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Cumbre2026' });
  sembrarUnidades(e, 'Piolet', 1);
  sembrarUnidades(e, 'Casco', 2);
});
const marta = () => e.ctx(sesionDe(e, 'marta@club.test'));

describe('API-003-09 consultarPrestado (UC-015)', () => {
  // REQ-F-009 AC1: "the user sees "Piolet 1 — Lucía Gil — hasta 2026-12-07""
  it('AC-015-01 REQ-F-009 AC1 lista de lo prestado: Piolet 1, Lucía Gil y fin 2026-12-07', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
    const lista = consultarPrestado(marta(), { dia: '2026-12-07' });
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ material: 'Piolet', unidad: 1, socio: 'Lucía Gil', fin: '2026-12-07' });
    // la fila que pinta la pantalla con esos datos: «{material} — {socio} — hasta {fecha}»
    expect(lista.map((p) => `${p.material} ${p.unidad} — ${p.socio} — hasta ${p.fin}`)).toEqual(['Piolet 1 — Lucía Gil — hasta 2026-12-07']);
  });

  // REQ-F-009 AC2: "the user sees "Piolet 1" under "Vuelven hoy" and does not see "Casco 2""
  it('AC-015-02 REQ-F-009 AC2 con dia 2026-12-07 el Piolet 1 vuelve ese día y el Casco 2 no', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-05', fin: '2026-12-08', estado: 'Entregado' });
    const lista = consultarPrestado(marta(), { dia: '2026-12-07' });
    expect({ 'Vuelven hoy': lista.filter((p) => p.vuelveHoy).map((p) => `${p.material} ${p.unidad}`) }).toEqual({ 'Vuelven hoy': ['Piolet 1'] });
    expect(lista.find((p) => p.material === 'Casco').vuelveHoy).toBe(false);
  });

  // REQ-F-009 AC3: "the user sees "Casco 2" marked "Retrasado 1 día""
  it('AC-015-03 REQ-F-009 AC3 con hoy 2026-12-09 y el Casco 2 con fin 2026-12-08 sin devolver el retraso es 1 día', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-12', estado: 'Entregado' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-05', fin: '2026-12-08', estado: 'Entregado' });
    const lista = consultarPrestado(marta());
    expect(lista[0]).toMatchObject({ material: 'Casco', unidad: 2, retrasoDias: 1 });   // los retrasados van primero
    expect(`Retrasado ${lista[0].retrasoDias} día`).toBe('Retrasado 1 día');   // «Retrasado {n} día»
    expect(lista[1].retrasoDias).toBe(0);
  });

  // REQ-F-009 AC4: "the user sees "No hay material prestado""
  it('AC-015-04 REQ-F-009 AC4 sin préstamos abiertos devuelve lista vacía (lo devuelto, cancelado o reservado no cuenta)', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto' });
    sembrarReserva(e, { correo: 'pablo@club.test', tipo: 'Casco', unidad: 2, inicio: '2026-12-10', fin: '2026-12-12' });
    const lista = consultarPrestado(marta());
    expect(lista).toEqual([]);
    expect(lista.length === 0 ? 'No hay material prestado' : '').toBe('No hay material prestado');   // lo que la pantalla muestra sin filas
  });

  it('AC-015-05 con rol socio o junta responde E_ACCESO_NO_PERMITIDO y ninguna lista', async () => {
    for (const correo of ['lucia@club.test', 'junta@club.test']) {
      const error = await fallo(() => consultarPrestado(e.ctx(sesionDe(e, correo)), {}));
      expect(error.codigo).toBe('E_ACCESO_NO_PERMITIDO');
    }
  });

  it('AC-015-06 un día mal formado "31-31-2026" da E_DATOS_INVALIDOS', async () => {
    expect((await fallo(() => consultarPrestado(marta(), { dia: '31-31-2026' }))).codigo).toBe('E_DATOS_INVALIDOS');
  });

  it('AC-015-07 con el almacén caído da E_ALMACEN_NO_DISPONIBLE y sin lista', async () => {
    const ctx = marta();
    e.caer();
    expect((await fallo(() => consultarPrestado(ctx, {}))).codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });

  it('es de solo lectura: no cambia el almacén (salvo la actividad de la sesión)', () => {
    sembrarReserva(e, { correo: 'lucia@club.test', tipo: 'Piolet', inicio: '2026-12-05', fin: '2026-12-07', estado: 'Entregado' });
    const antes = e.store.leer();
    consultarPrestado(marta(), {});
    const despues = e.store.leer();
    expect(despues.reservas).toEqual(antes.reservas);
    expect(despues.multas).toEqual(antes.multas);
  });
});
