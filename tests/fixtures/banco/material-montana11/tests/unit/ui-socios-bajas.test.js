// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaSocios } from '../../src/ui/pantallas/socios.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Marta', rol: 'encargado' };
const lucia = { id: 1, nombre: 'Lucía Gil', correo: 'lucia@club.test', estado: 'Activa' };
const pablo = { id: 2, nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Activa' };
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Socios"] tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
const vaciar = () => new Promise((r) => setTimeout(r, 0));
const clic = async (boton) => { boton.click(); await vaciar(); await vaciar(); };
// el nombre del socio describe sus botones (aria-describedby): se busca el botón dentro de su elemento de la lista
const boton = (texto, socio) => [...contenedor.querySelectorAll('button')].find((b) => b.textContent === texto
  && (!socio || document.getElementById(b.getAttribute('aria-describedby'))?.textContent === socio));

describe('pantalla Socios: Restablecer contraseña y Dar de baja (UC-004, SCR-006)', () => {
  // REQ-F-002 AC4: "GIVEN the member "Lucía Gil" forgot her password WHEN the encargado sets the new password "Hielo2026x" THEN she can sign in with it and no longer with the old one"
  it('AC-004-01 REQ-F-002 AC4 "Restablecer contraseña" pide la nueva clave y, al confirmar con "Hielo2026x", muestra "Contraseña restablecida" sin pintar la clave', async () => {
    const api = { listarSocios: vi.fn().mockResolvedValue([lucia, pablo]), restablecerContrasena: vi.fn().mockResolvedValue({}) };
    await pantallaSocios({ contenedor, usuario, api });
    const abrir = boton('Restablecer contraseña', 'Lucía Gil');
    expect(abrir.textContent).toBe('Restablecer contraseña');
    await clic(abrir);
    expect(api.restablecerContrasena).not.toHaveBeenCalled();   // primero pide la nueva clave
    const campo = contenedor.querySelector('input[type="password"][autocomplete="new-password"][name="nueva-contrasena"]');
    expect(contenedor.querySelector(`label[for="${campo.id}"]`).textContent).toBe('Nueva contraseña');
    campo.value = 'Hielo2026x';
    campo.form.requestSubmit();
    await vaciar(); await vaciar();
    expect(api.restablecerContrasena).toHaveBeenCalledWith(1, 'Hielo2026x');
    expect(contenedor.querySelector('[role="status"]').textContent).toBe('Contraseña restablecida');
    expect(contenedor.textContent).not.toContain('Hielo2026x');
    expect(contenedor.querySelector('input[name="nueva-contrasena"]')).toBeNull();
    expect(document.activeElement).toBe(boton('Restablecer contraseña', 'Lucía Gil'));
  });

  it('una contraseña corta se muestra con role="alert" y el campo sigue abierto; "Cancelar" vuelve al botón', async () => {
    const api = { listarSocios: vi.fn().mockResolvedValue([lucia]), restablecerContrasena: vi.fn().mockRejectedValue(new ErrorApi('E_CONTRASENA_CORTA')) };
    await pantallaSocios({ contenedor, usuario, api });
    await clic(boton('Restablecer contraseña', 'Lucía Gil'));
    const campo = contenedor.querySelector('input[name="nueva-contrasena"]');
    campo.value = 'corta1';
    campo.form.requestSubmit();
    await vaciar(); await vaciar();
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('La contraseña debe tener al menos 8 caracteres');
    expect(contenedor.querySelector('input[name="nueva-contrasena"]')).not.toBeNull();
    await clic(boton('Cancelar'));
    expect(contenedor.querySelector('input[name="nueva-contrasena"]')).toBeNull();
    expect(document.activeElement).toBe(boton('Restablecer contraseña', 'Lucía Gil'));
  });

  // REQ-F-002 AC5: "GIVEN "Pablo Ruiz" has 1 future reservation of "Casco 2" WHEN the encargado deactivates him THEN the user sees "Pablo Ruiz" marked "Baja" and the reservation is cancelled, freeing the unit"
  it('AC-004-02 REQ-F-002 AC5 "Dar de baja" pide confirmación en línea y, al confirmar, la fila de "Pablo Ruiz" muestra "Baja" y deja de ofrecer las acciones', async () => {
    const api = {
      listarSocios: vi.fn().mockResolvedValueOnce([lucia, pablo]).mockResolvedValueOnce([lucia, { ...pablo, estado: 'Baja' }]),
      darDeBajaSocio: vi.fn().mockResolvedValue({}),
    };
    await pantallaSocios({ contenedor, usuario, api });
    expect(boton('Dar de baja', 'Pablo Ruiz').textContent).toBe('Dar de baja');
    await clic(boton('Dar de baja', 'Pablo Ruiz'));
    expect(api.darDeBajaSocio).not.toHaveBeenCalled();   // primero la confirmación
    expect(contenedor.querySelector('[role="group"]').getAttribute('aria-label')).toBe('¿Dar de baja a Pablo Ruiz?');
    await clic(boton('Sí, dar de baja'));
    expect(api.darDeBajaSocio).toHaveBeenCalledWith(2);
    expect(filas()).toEqual([['Lucía Gil', 'lucia@club.test', 'Activa'], ['Pablo Ruiz', 'pablo@club.test', 'Baja']]);
    expect(boton('Dar de baja', 'Pablo Ruiz')).toBeUndefined();
    expect(boton('Restablecer contraseña', 'Pablo Ruiz')).toBeUndefined();
    expect(boton('Dar de baja', 'Lucía Gil')).toBeDefined();
  });

  // REQ-F-002 AC6: "GIVEN "Pablo Ruiz" has a lent unit not yet returned WHEN the encargado tries to deactivate him THEN the user sees "No se puede dar de baja: tiene material sin devolver" and he stays active"
  it('AC-004-05 REQ-F-002 AC6 con E_SOCIO_CON_MATERIAL se muestra "No se puede dar de baja: tiene material sin devolver" y la fila de "Pablo Ruiz" sigue Activa', async () => {
    const api = { listarSocios: vi.fn().mockResolvedValue([pablo]), darDeBajaSocio: vi.fn().mockRejectedValue(new ErrorApi('E_SOCIO_CON_MATERIAL')) };
    await pantallaSocios({ contenedor, usuario, api });
    await clic(boton('Dar de baja', 'Pablo Ruiz'));
    await clic(boton('Sí, dar de baja'));
    expect(contenedor.querySelector('[role="alert"]').textContent).toBe('No se puede dar de baja: tiene material sin devolver');
    // REQ-F-002 AC6 cláusula: "he stays active"
    expect(filas()).toEqual([['Pablo Ruiz', 'pablo@club.test', 'Activa']]);
    expect(document.activeElement).toBe(boton('Dar de baja', 'Pablo Ruiz'));
  });
});
