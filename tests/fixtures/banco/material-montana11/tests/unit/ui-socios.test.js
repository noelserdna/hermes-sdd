// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pantallaSocios } from '../../src/ui/pantallas/socios.js';
import { ErrorApi } from '../../src/ui/api.js';

let contenedor;
beforeEach(() => { document.body.replaceChildren(); contenedor = document.createElement('main'); document.body.append(contenedor); });
const usuario = { nombre: 'Marta', rol: 'encargado' };
const filas = () => [...contenedor.querySelectorAll('table[aria-label="Socios"] tbody tr')].map((tr) => [...tr.children].map((td) => td.textContent));
const rellenar = (nombre, correo, contrasena) => {
  contenedor.querySelector('input[name="nombre"]').value = nombre;
  contenedor.querySelector('input[name="correo"]').value = correo;
  contenedor.querySelector('input[name="contrasena"]').value = contrasena;
};

describe('pantalla Socios', () => {
  it('lista nombre, correo y estado de cada socio y marca "Baja" al que está de baja', async () => {
    const api = { listarSocios: vi.fn().mockResolvedValue([
      { id: 1, nombre: 'Lucía Gil', correo: 'lucia@club.test', estado: 'Activa' },
      { id: 2, nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Baja' }]) };
    await pantallaSocios({ contenedor, usuario, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Socios');
    expect(filas()).toEqual([['Lucía Gil', 'lucia@club.test', 'Activa'], ['Pablo Ruiz', 'pablo@club.test', 'Baja']]);
  });

  it('crear un socio envía los tres datos, avisa con role="status" y recarga la lista', async () => {
    const api = {
      listarSocios: vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1, nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Activa' }]),
      crearSocio: vi.fn().mockResolvedValue({}),
    };
    await pantallaSocios({ contenedor, usuario, api });
    rellenar('Pablo Ruiz', 'pablo@club.test', 'Nieve2026');
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(filas()).toEqual([['Pablo Ruiz', 'pablo@club.test', 'Activa']]));
    expect(api.crearSocio).toHaveBeenCalledWith('Pablo Ruiz', 'pablo@club.test', 'Nieve2026');
    expect(contenedor.querySelector('[role="status"]').textContent).toBe('Socio creado');
    expect(contenedor.querySelector('input[name="contrasena"]').value).toBe('');
  });

  it('un error al crear se muestra con role="alert" y la lista no cambia', async () => {
    const api = {
      listarSocios: vi.fn().mockResolvedValue([{ id: 1, nombre: 'Pablo Ruiz', correo: 'pablo@club.test', estado: 'Activa' }]),
      crearSocio: vi.fn().mockRejectedValue(new ErrorApi('E_CORREO_DUPLICADO')),
    };
    await pantallaSocios({ contenedor, usuario, api });
    rellenar('Otro', 'pablo@club.test', 'Nieve2026');
    contenedor.querySelector('form').requestSubmit();
    await vi.waitFor(() => expect(contenedor.querySelector('[role="alert"]')?.textContent).toBe('Ya existe un socio con ese correo'));
    expect(filas()).toEqual([['Pablo Ruiz', 'pablo@club.test', 'Activa']]);
    expect(api.listarSocios).toHaveBeenCalledTimes(1);
  });

  it('con E_ACCESO_NO_PERMITIDO muestra "Acceso no permitido" y ni formulario ni lista', async () => {
    const api = { listarSocios: vi.fn().mockRejectedValue(new ErrorApi('E_ACCESO_NO_PERMITIDO')) };
    await pantallaSocios({ contenedor, usuario: { nombre: 'Lucía', rol: 'socio' }, api });
    expect(contenedor.querySelector('h1').textContent).toBe('Acceso no permitido');
    expect(contenedor.querySelector('form, table')).toBeNull();
  });
});
