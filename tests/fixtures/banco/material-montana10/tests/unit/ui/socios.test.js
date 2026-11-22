// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { montar } from '../../../src/ui/pantallas/socios.js';
import { resolver } from '../../../src/ui/router.js';

let raiz;
const esperar = (condicion) => vi.waitFor(condicion, { timeout: 1000 });
const encargado = { nombre: 'Encargado', rol: 'encargado' };
const lucia = { id: 1, nombre: 'Lucía', correo: 'lucia@club.es', estado: 'Activa' };
const pablo = { id: 2, nombre: 'Pablo', correo: 'pablo@club.es', estado: 'Activa' };
const marta = { id: 3, nombre: 'Marta Ruiz', correo: 'marta@club.es', estado: 'Activa' };
const filas = () => [...raiz.querySelectorAll('tbody tr')].map((tr) => [...tr.querySelectorAll('td')].slice(0, 3).map((td) => td.textContent));
const botones = (tr) => [...tr.querySelectorAll('button')].map((b) => b.textContent);
const rellenar = (nombre, valor) => { raiz.querySelector(`[name="${nombre}"]`).value = valor; };
const enviarAlta = (datos) => {
  rellenar('nombre', datos.nombre); rellenar('correo', datos.correo); rellenar('contrasena', datos.contrasena);
  raiz.querySelector('form').requestSubmit();
};

beforeEach(() => {
  raiz = document.createElement('div');
  document.body.replaceChildren(raiz);
});

describe('pantalla Socios (SCR-006, UC-002)', () => {
  it('la ruta #/socios existe solo para el encargado', () => {
    expect(resolver('#/socios')).toMatchObject({ nombre: 'socios', roles: ['encargado'] });
  });

  it('lista nombre, correo y estado de cada socio; la acción «Restablecer contraseña» y «Dar de baja» solo en las cuentas Activas', async () => {
    const api = { listarSociosDetalle: vi.fn().mockResolvedValue([lucia, { ...pablo, estado: 'Baja' }]) };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(2));
    expect(raiz.querySelector('h1').textContent).toBe('Socios');
    expect(filas()).toEqual([['Lucía', 'lucia@club.es', 'Activa'], ['Pablo', 'pablo@club.es', 'Baja']]);
    const trs = raiz.querySelectorAll('tbody tr');
    expect(botones(trs[0])).toEqual(['Restablecer contraseña', 'Dar de baja']);
    expect(botones(trs[1])).toEqual([]);
  });

  it('tras dar de alta a «Marta Ruiz», «marta@club.es» y «Glaciar2026», la tabla Socios muestra su fila', async () => {
    const api = {
      listarSociosDetalle: vi.fn().mockResolvedValueOnce([lucia]).mockResolvedValue([lucia, marta]),
      crearSocio: vi.fn().mockResolvedValue(marta),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(1));
    enviarAlta({ nombre: 'Marta Ruiz', correo: 'marta@club.es', contrasena: 'Glaciar2026' });
    await esperar(() => expect(filas()).toHaveLength(2));
    expect(api.crearSocio).toHaveBeenCalledWith('Marta Ruiz', 'marta@club.es', 'Glaciar2026');
    expect(filas()[1]).toEqual(['Marta Ruiz', 'marta@club.es', 'Activa']);
    expect(raiz.querySelector('[name="contrasena"]').value).toBe('');
  });

  it('un rechazo del alta (correo duplicado) sale como alerta con su mensaje y la lista no cambia', async () => {
    const api = {
      listarSociosDetalle: vi.fn().mockResolvedValue([lucia, marta]),
      crearSocio: vi.fn().mockRejectedValue({ codigo: 'E_CORREO_DUPLICADO', mensaje: 'Ya existe un socio con ese correo' }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(2));
    enviarAlta({ nombre: 'Marta Ruiz', correo: 'marta@club.es', contrasena: 'Glaciar2026' });
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('Ya existe un socio con ese correo'));
    expect(filas()).toHaveLength(2);
  });

  it('la baja de «Lucía», con una multa Pendiente, pide confirmación, muestra «No se puede dar de baja: tiene material prestado o multas pendientes» y la fila no cambia', async () => {
    const mensaje = 'No se puede dar de baja: tiene material prestado o multas pendientes';
    const api = {
      listarSociosDetalle: vi.fn().mockResolvedValue([lucia]),
      darDeBajaSocio: vi.fn().mockRejectedValue({ codigo: 'E_BAJA_SOCIO_BLOQUEADA', mensaje }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(1));
    raiz.querySelector('tbody tr [data-accion="baja"]').click();
    // confirmación visible antes de dar de baja: todavía no se ha llamado a la API
    expect(raiz.querySelector('tbody tr').textContent).toContain('¿Dar de baja a Lucía?');
    expect(api.darDeBajaSocio).not.toHaveBeenCalled();
    raiz.querySelector('[data-accion="confirmar"]').click();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe(mensaje));
    expect(api.darDeBajaSocio).toHaveBeenCalledWith(1);
    expect(filas()).toEqual([['Lucía', 'lucia@club.es', 'Activa']]);
    expect(botones(raiz.querySelector('tbody tr'))).toEqual(['Restablecer contraseña', 'Dar de baja']);
  });

  it('«Mantener» cancela la confirmación de baja sin llamar a la API; la baja confirmada deja a «Pablo» en «Baja» sin botones', async () => {
    const api = {
      listarSociosDetalle: vi.fn().mockResolvedValueOnce([pablo]).mockResolvedValue([{ ...pablo, estado: 'Baja' }]),
      darDeBajaSocio: vi.fn().mockResolvedValue({ ...pablo, estado: 'Baja' }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(1));
    raiz.querySelector('[data-accion="baja"]').click();
    raiz.querySelector('[data-accion="mantener"]').click();
    expect(api.darDeBajaSocio).not.toHaveBeenCalled();
    expect(botones(raiz.querySelector('tbody tr'))).toEqual(['Restablecer contraseña', 'Dar de baja']);
    raiz.querySelector('[data-accion="baja"]').click();
    raiz.querySelector('[data-accion="confirmar"]').click();
    await esperar(() => expect(filas()).toEqual([['Pablo', 'pablo@club.es', 'Baja']]));
    expect(botones(raiz.querySelector('tbody tr'))).toEqual([]);
  });

  it('«Restablecer contraseña» despliega el campo de la fila; «Guardar» con «Nieve2026» avisa «Contraseña restablecida»', async () => {
    const api = { listarSociosDetalle: vi.fn().mockResolvedValue([marta]), restablecerContrasena: vi.fn().mockResolvedValue(null) };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(1));
    raiz.querySelector('[data-accion="restablecer"]').click();
    raiz.querySelector('tbody [name="contrasena-nueva"]').value = 'Nieve2026';
    raiz.querySelector('[data-accion="guardar"]').click();
    await esperar(() => expect(raiz.querySelector('[role="status"]').textContent).toBe('Contraseña restablecida'));
    expect(api.restablecerContrasena).toHaveBeenCalledWith(3, 'Nieve2026');
    expect(raiz.querySelector('tbody [name="contrasena-nueva"]')).toBeNull();
  });

  it('un rechazo de la contraseña corta al restablecer sale como alerta y el campo sigue abierto', async () => {
    const api = {
      listarSociosDetalle: vi.fn().mockResolvedValue([marta]),
      restablecerContrasena: vi.fn().mockRejectedValue({ codigo: 'E_CONTRASENA_CORTA', mensaje: 'La contraseña debe tener al menos 8 caracteres' }),
    };
    montar({ raiz, api, sesion: encargado });
    await esperar(() => expect(filas()).toHaveLength(1));
    raiz.querySelector('[data-accion="restablecer"]').click();
    raiz.querySelector('tbody [name="contrasena-nueva"]').value = 'corta';
    raiz.querySelector('[data-accion="guardar"]').click();
    await esperar(() => expect(raiz.querySelector('[role="alert"]').textContent).toBe('La contraseña debe tener al menos 8 caracteres'));
    expect(raiz.querySelector('tbody [name="contrasena-nueva"]')).not.toBeNull();
  });
});
