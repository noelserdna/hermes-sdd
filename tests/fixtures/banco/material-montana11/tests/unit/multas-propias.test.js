import { describe, it, expect, beforeEach } from 'vitest';
import { listarMisMultas } from '../../src/domain/multas.js';
import { crearEntorno, fallo } from '../helpers/entorno.js';
import { sembrarMulta, sesionDe } from '../helpers/material.js';

// UC-011 · API-003-06 listarMisMultas. Dos socios con multa Pendiente y el encargado y la junta sin ninguna.
let e;
beforeEach(() => {
  e = crearEntorno({ inicio: '2026-12-11T10:00:00Z' });
  e.cuenta({ nombre: 'Lucía Gil', correo: 'lucia@club.test', contrasena: 'Cumbre2026' });
  e.cuenta({ nombre: 'Pablo Ruiz', correo: 'pablo@club.test', contrasena: 'Nieve2026' });
  e.cuenta({ nombre: 'Marta', correo: 'marta@club.test', contrasena: 'Cumbre2026', rol: 'encargado' });
  e.cuenta({ nombre: 'Junta', correo: 'junta@club.test', contrasena: 'Cumbre2026', rol: 'junta' });
});

describe('API-003-06 listarMisMultas (UC-011)', () => {
  // AC-011-02: "GIVEN "lucia" has a Pendiente fine of 2,00 € and "pablo" one of 6,00 € WHEN "pablo" opens Mis multas THEN he sees only his own"
  it('AC-011-02 solo las propias (INV-SEC-001): pablo con 6 € ve la suya y ninguna de 2 € de lucia', () => {
    sembrarMulta(e, 'lucia@club.test', { importeEur: 2 });
    sembrarMulta(e, 'pablo@club.test', { importeEur: 6 });
    const multas = listarMisMultas(e.ctx(sesionDe(e, 'pablo@club.test', 'Nieve2026')));
    expect(multas).toHaveLength(1);
    expect(multas[0]).toMatchObject({ importeEur: 6, estado: 'Pendiente' });
    expect(multas.map((m) => m.importeEur)).not.toContain(2);
  });

  it('devuelve el importe sin formatear, el estado y el material de la reserva con su fecha de devolución', () => {
    e.store.transaccion((db) => {
      db.unidades.push({ id: 1, tipo: 'Casco', numero: 1, estado: 'Alta' });
      db.reservas.push({ id: 1, socioId: 2, unidadId: 1, inicio: '2026-12-05', fin: '2026-12-07', estado: 'Devuelto', entregadaEl: '2026-12-05', devueltaEl: '2026-12-10', canceladaEl: null });
      db.multas.push({ id: 1, socioId: 2, reservaId: 1, diasRetraso: 3, importeEur: 6, estado: 'Pendiente', creadaEl: '2026-12-10', pagadaEl: null });
    });
    const [m] = listarMisMultas(e.ctx(sesionDe(e, 'pablo@club.test', 'Nieve2026')));
    expect(m).toEqual({ id: 1, material: 'Casco', devueltaEl: '2026-12-10', importeEur: 6, estado: 'Pendiente', pagadaEl: null });
  });

  it('sin multas devuelve una lista vacía', () => {
    sembrarMulta(e, 'lucia@club.test');
    expect(listarMisMultas(e.ctx(sesionDe(e, 'pablo@club.test', 'Nieve2026')))).toEqual([]);
  });

  it('con rol encargado o junta responde E_ACCESO_NO_PERMITIDO', async () => {
    for (const correo of ['marta@club.test', 'junta@club.test']) {
      expect((await fallo(() => listarMisMultas(e.ctx(sesionDe(e, correo))))).codigo).toBe('E_ACCESO_NO_PERMITIDO');
    }
  });

  it('sin sesión responde E_NO_AUTENTICADO', async () => {
    expect((await fallo(() => listarMisMultas(e.ctx()))).codigo).toBe('E_NO_AUTENTICADO');
  });
});
