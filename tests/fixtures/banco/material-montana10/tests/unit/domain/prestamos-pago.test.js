import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { pagarMulta, listarMultas } from '../../../src/domain/prestamos.js';
import { reservarMaterial, listarMisReservas } from '../../../src/domain/reservas.js';

let almacen;
const relojDe = (dia) => ({ ahora: () => new Date(`${dia}T11:00:00Z`), hoy: () => dia });
const ctx = (dia) => ({ almacen, reloj: relojDe(dia) });
const encargado = { id: 9, nombre: 'Encargado', rol: 'encargado' };
const junta = { id: 8, nombre: 'Junta', rol: 'junta' };
const lucia = { id: 1, nombre: 'Lucía', rol: 'socio' };
const multa = (socioId, importeEur, estado = 'Pendiente', pagadaEl = null) => almacen.transaction((db) => {
  db.multas.push({ id: db.multas.length + 1, socioId, reservaId: db.multas.length + 1, dias: importeEur / 2, importeEur, estado, pagadaEl });
});
const datos = () => almacen.load();

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => {
    db.cuentas.push({ id: 1, nombre: 'Lucía', rol: 'socio' }, { id: 2, nombre: 'Pablo', rol: 'socio' });
    db.unidades.push({ id: 1, tipo: 'Piolet', numero: 1, estado: 'Activa' });
  });
});

describe('pagarMulta (API-003-03, INV-LOA-005, INV-RES-005)', () => {
  it('INV-RES-005 pagar la multa de 6 € de Pablo la deja Pagada con la fecha de hoy (2026-12-10) y le permite reservar', async () => {
    await multa(2, 6);
    const pablo = { id: 2, nombre: 'Pablo', rol: 'socio' };
    expect(await reservarMaterial(ctx('2026-12-10'), pablo, { tipo: 'Piolet', desde: '2026-12-12', hasta: '2026-12-12' }).catch((e) => e.codigo)).toBe('E_MULTA_PENDIENTE');
    const pagada = await pagarMulta(ctx('2026-12-10'), encargado, { multaId: 1 });
    expect(pagada).toEqual({ id: 1, socio: 'Pablo', importeEur: 6, estado: 'Pagada', pagadaEl: '2026-12-10' });
    expect((await reservarMaterial(ctx('2026-12-10'), pablo, { tipo: 'Piolet', desde: '2026-12-12', hasta: '2026-12-12' })).creada).toBe(true);
  });

  it('INV-RES-005 con otra multa Pendiente (2 € y 4 €) pagar la de 2 € deja a Lucía bloqueada y su multa de 4 € a la vista', async () => {
    await multa(1, 2);
    await multa(1, 4);
    await pagarMulta(ctx('2026-12-10'), encargado, { multaId: 1 });
    const fallo = await reservarMaterial(ctx('2026-12-10'), lucia, { tipo: 'Piolet', desde: '2026-12-12', hasta: '2026-12-12' }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_MULTA_PENDIENTE', 'Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar']);
    expect((await listarMisReservas(ctx('2026-12-10'), lucia)).multas.filter((m) => m.estado === 'Pendiente')).toMatchObject([{ importeEur: 4 }]);
  });

  it('INV-LOA-005 pagar otra vez una multa Pagada no cambia nada: conserva su fecha de pago', async () => {
    await multa(1, 6, 'Pagada', '2026-12-09');
    const antes = JSON.stringify(await datos());
    const repetida = await pagarMulta(ctx('2026-12-11'), encargado, { multaId: 1 });
    expect(repetida).toMatchObject({ estado: 'Pagada', pagadaEl: '2026-12-09' });
    expect(JSON.stringify(await datos())).toBe(antes);
  });

  it('INV-ACC-008 un socio y la junta no pueden pagar: E_SIN_PERMISO y la multa sigue Pendiente', async () => {
    await multa(1, 6);
    for (const actor of [lucia, junta]) {
      const fallo = await pagarMulta(ctx('2026-12-10'), actor, { multaId: 1 }).catch((e) => e);
      expect([fallo.codigo, fallo.mensaje]).toEqual(['E_SIN_PERMISO', 'No tienes permiso para ver esta pantalla']);
    }
    expect((await datos()).multas[0]).toMatchObject({ estado: 'Pendiente', pagadaEl: null });
  });

  it('AC-007-05 una multa que no existe da E_MULTA_NO_ENCONTRADA y no cambia ninguna', async () => {
    await multa(1, 6);
    const antes = JSON.stringify(await datos());
    const fallo = await pagarMulta(ctx('2026-12-10'), encargado, { multaId: 99 }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_MULTA_NO_ENCONTRADA', 'No se encontró esa multa']);
    expect(JSON.stringify(await datos())).toBe(antes);
  });
});

describe('listarMultas (API-003-04) y la multa en Mis reservas', () => {
  it('lista todas las multas con el nombre del socio, sin cambiar nada; solo el encargado', async () => {
    await multa(1, 4);
    await multa(2, 2, 'Pagada', '2026-11-19');
    const antes = JSON.stringify(await datos());
    expect(await listarMultas(ctx('2026-12-10'), encargado)).toEqual([
      { id: 1, socio: 'Lucía', importeEur: 4, estado: 'Pendiente', pagadaEl: null },
      { id: 2, socio: 'Pablo', importeEur: 2, estado: 'Pagada', pagadaEl: '2026-11-19' },
    ]);
    expect(JSON.stringify(await datos())).toBe(antes);
    for (const actor of [lucia, junta]) expect((await listarMultas(ctx('2026-12-10'), actor).catch((e) => e)).codigo).toBe('E_SIN_PERMISO');
  });

  it('INV-ACC-009 listarMisReservas de Lucía devuelve su multa Pendiente de 6 € en `multas` y no la de Pablo', async () => {
    await multa(1, 6);
    await multa(2, 2);
    expect((await listarMisReservas(ctx('2026-12-10'), lucia)).multas).toMatchObject([{ importeEur: 6, estado: 'Pendiente' }]);
  });
});
