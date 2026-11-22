// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/entregas.js';
import { resolver } from '../../../src/ui/router.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const sesion = { nombre: 'Encargado', rol: 'encargado' };
const lista = (extra = {}) => ({ entregarHoy: [], vuelveHoy: [], conRetraso: [], prestado: [], noRecogidas: [], ...extra });
const textos = (selector) => [...raiz.querySelectorAll(selector)].map((n) => n.textContent);

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Entregas y devoluciones (SCR-004, UC-005, UC-009)', () => {
  it('REQ-F-009 la ruta #/entregas existe para el encargado y la junta, no para el socio', () => {
    expect(resolver('#/entregas')).toMatchObject({ nombre: 'entregas', roles: expect.arrayContaining(['encargado', 'junta']) });
    expect(resolver('#/entregas').roles).not.toContain('socio');
  });

  it('muestra las secciones en su orden con las líneas «Entregar hoy: …», «Vuelve hoy: …», «Con retraso: … · n días», «Prestado: … · hasta …» y las No recogidas', async () => {
    const api = { consultarEntregasYDevoluciones: vi.fn().mockResolvedValue(lista({
      entregarHoy: [{ reservaId: 5, material: 'Piolet', socio: 'Lucía', desde: '2026-12-07', hasta: '2026-12-09', unidadesLibres: [{ id: 1, nombre: 'Piolet 1' }] }],
      vuelveHoy: [{ reservaId: 1, unidad: 'Piolet 2', socio: 'Lucía', hasta: '2026-12-07' }],
      conRetraso: [{ reservaId: 2, unidad: 'Cuerda 1', socio: 'Marta', hasta: '2026-12-05', dias: 2 }, { reservaId: 3, unidad: 'Casco 2', socio: 'Inés', hasta: '2026-12-06', dias: 1 }],
      prestado: [{ reservaId: 1, unidad: 'Piolet 2', socio: 'Lucía', hasta: '2026-12-07' }, { reservaId: 4, unidad: 'Casco 1', socio: 'Pablo', hasta: '2026-12-09' }],
      noRecogidas: [{ reservaId: 6, material: 'Tienda', socio: 'Ana', hasta: '2026-12-06' }],
    })) };
    montar({ raiz, api, sesion });
    await esperar(() => expect(raiz.querySelectorAll('li').length).toBeGreaterThan(5));
    expect(raiz.querySelector('h1').textContent).toBe('Entregas y devoluciones');
    expect(textos('h2')).toEqual(['Entregar hoy', 'Vuelve hoy', 'Con retraso', 'Prestado', 'No recogidas']);
    expect(textos('[data-seccion="entregar-hoy"] .linea')).toEqual(['Entregar hoy: Piolet · Lucía']);
    expect(textos('[data-seccion="vuelve-hoy"] .linea')).toEqual(['Vuelve hoy: Piolet 2 · Lucía']);
    expect(textos('[data-seccion="con-retraso"] .linea')).toEqual(['Con retraso: Cuerda 1 · Marta · 2 días', 'Con retraso: Casco 2 · Inés · 1 día']);
    expect(textos('[data-seccion="prestado"] .linea')).toEqual(['Prestado: Piolet 2 · Lucía · hasta 2026-12-07', 'Prestado: Casco 1 · Pablo · hasta 2026-12-09']);
    expect(textos('[data-seccion="no-recogidas"] .linea')).toEqual(['Tienda · Ana · No recogida']);
  });

  it('el encargado elige la unidad entre las libres, pulsa Entregar y ve «{unidad} · {socio} · Prestada»; la lista se vuelve a pedir', async () => {
    const antes = lista({ entregarHoy: [{ reservaId: 5, material: 'Piolet', socio: 'Lucía', desde: '2026-12-05', hasta: '2026-12-07', unidadesLibres: [{ id: 1, nombre: 'Piolet 1' }, { id: 2, nombre: 'Piolet 2' }] }] });
    const despues = lista({ prestado: [{ reservaId: 5, unidad: 'Piolet 2', socio: 'Lucía', hasta: '2026-12-07' }] });
    const api = {
      consultarEntregasYDevoluciones: vi.fn().mockResolvedValueOnce(antes).mockResolvedValue(despues),
      entregarReserva: vi.fn().mockResolvedValue({ unidad: 'Piolet 2', socio: 'Lucía', reserva: { id: 5, estado: 'Prestada', unidadId: 2 } }),
    };
    montar({ raiz, api, sesion });
    await esperar(() => expect(raiz.querySelector('select')).not.toBeNull());
    expect([...raiz.querySelectorAll('option')].map((o) => o.textContent)).toEqual(['Piolet 1', 'Piolet 2']);
    raiz.querySelector('select').value = '2';
    raiz.querySelector('button').click();
    await esperar(() => expect(raiz.querySelector('[role="status"]').textContent).toBe('Piolet 2 · Lucía · Prestada'));
    expect(api.entregarReserva).toHaveBeenCalledWith(5, 2);
    await esperar(() => expect(textos('[data-seccion="prestado"] .linea')).toEqual(['Prestado: Piolet 2 · Lucía · hasta 2026-12-07']));
    expect(raiz.querySelector('button')).toBeNull();
  });

  it('un rechazo de la API se muestra con su mensaje en la fila y la reserva sigue por entregar', async () => {
    const api = {
      consultarEntregasYDevoluciones: vi.fn().mockResolvedValue(lista({ entregarHoy: [{ reservaId: 5, material: 'Piolet', socio: 'Lucía', desde: '2026-12-05', hasta: '2026-12-07', unidadesLibres: [{ id: 1, nombre: 'Piolet 1' }] }] })),
      entregarReserva: vi.fn().mockRejectedValue({ codigo: 'E_ENTREGA_ANTICIPADA', mensaje: 'Aún no es la fecha de entrega' }),
    };
    montar({ raiz, api, sesion });
    await esperar(() => expect(raiz.querySelector('button')).not.toBeNull());
    raiz.querySelector('button').click();
    await esperar(() => expect(raiz.querySelector('li [role="alert"]').textContent).toBe('Aún no es la fecha de entrega'));
    expect(textos('[data-seccion="entregar-hoy"] .linea')).toEqual(['Entregar hoy: Piolet · Lucía']);
    expect(raiz.querySelector('button')).not.toBeNull();
  });

  it('un fallo al cargar la lista se muestra como alerta con el mensaje de la API', async () => {
    const api = { consultarEntregasYDevoluciones: vi.fn().mockRejectedValue({ codigo: 'E_ALMACEN_NO_DISPONIBLE', mensaje: 'No se pudo completar la operación. Inténtalo de nuevo' }) };
    montar({ raiz, api, sesion });
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('No se pudo completar la operación. Inténtalo de nuevo'));
  });
});
