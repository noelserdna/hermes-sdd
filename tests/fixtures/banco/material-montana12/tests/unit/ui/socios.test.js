// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { paginaSocios } from '../../../src/ui/paginas/socios.js';
import { crearAvisos } from '../../../src/ui/componentes.js';
import { T } from '../../../src/ui/textos.js';

// SCR-007. Lo que ve el encargado en cada criterio (AC-003-0x, AC-005-01, AC-006-0x) lo prueba el recorrido e2e con su captura
// (tests/e2e/fase-3-alta-primer-acceso.spec.js); aquí va cómo se arma la página: formulario, filas con sus botones, avisos y errores.
beforeEach(() => document.body.replaceChildren());
const esperar = () => new Promise((r) => setTimeout(r, 0));
const socio = (extra) => ({ id: 'c1', nombre: 'Marta Ruiz', correo: 'marta@club.test', estado: 'Activo', ...extra });
const ok = (socios) => ({ estado: 200, cuerpo: { socios } });
const fallo = (codigo, mensaje, estado = 409) => ({ estado, cuerpo: { error: { codigo, mensaje } } });

async function pagina(listas, extra = {}) {
  const cola = [...listas];
  const api = { listarSocios: vi.fn(async () => (cola.length > 1 ? cola.shift() : cola[0])), altaSocio: vi.fn(), restablecerSocio: vi.fn(), bajaSocio: vi.fn(), ...extra };
  const avisos = crearAvisos(T);
  const main = await paginaSocios({ api, T, avisos });
  document.body.append(main);
  return { main, api, avisos };
}
const boton = (nodo, texto) => [...nodo.querySelectorAll('button')].find((b) => b.textContent === texto);
const escribir = (main, etiqueta, valor) => { main.querySelector(`#${[...main.querySelectorAll('label')].find((l) => l.textContent === etiqueta).htmlFor}`).value = valor; };
const alta = async (main) => { main.querySelector('form.alta').dispatchEvent(new Event('submit', { cancelable: true })); await esperar(); };

describe('SCR-007 Socios', () => {
  it('SCR-007 el formulario pide nombre, correo y contraseña provisional, y cada fila dice «{nombre} — Activo» con «Restablecer» y «Dar de baja»', async () => {
    const { main } = await pagina([ok([socio(), socio({ id: 'c2', nombre: 'Álvaro', estado: 'Baja' })])]);
    expect(main.querySelector('h1').textContent).toBe('Socios');
    expect([...main.querySelectorAll('form.alta label')].map((l) => l.textContent)).toEqual(['Nombre', 'Correo', 'Contraseña provisional']);
    expect(boton(main.querySelector('form.alta'), 'Dar de alta').type).toBe('submit');
    const filas = [...main.querySelectorAll('ul.socios li')];
    expect(filas.map((li) => li.querySelector('.texto').textContent)).toEqual(['Marta Ruiz — Activo', 'Álvaro — Baja']);
    expect(['Restablecer', 'Dar de baja'].map((t) => boton(filas[0], t)?.textContent)).toEqual(['Restablecer', 'Dar de baja']);
    expect(filas[1].querySelectorAll('button')).toHaveLength(0);
  });

  it('SCR-007 un alta correcta pone «Socio creado: Álvaro» en los avisos, vacía el formulario y recarga la lista', async () => {
    const { main, api, avisos } = await pagina([ok([]), ok([socio({ nombre: 'Álvaro' })])], { altaSocio: vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Socio creado: Álvaro' } })) });
    escribir(main, 'Nombre', 'Álvaro'); escribir(main, 'Correo', 'alvaro@club.test'); escribir(main, 'Contraseña provisional', 'Provisional1');
    await alta(main);
    expect(api.altaSocio).toHaveBeenCalledWith({ nombre: 'Álvaro', correo: 'alvaro@club.test', contrasena: 'Provisional1' });
    expect(avisos.textos()).toEqual(['Socio creado: Álvaro']);
    expect(main.querySelector('form.alta input').value).toBe('');
    expect(main.querySelector('ul.socios .texto').textContent).toBe('Álvaro — Activo');
  });

  it('SCR-007 el error de correo repetido sale bajo el campo Correo, marcado inválido, y la lista no cambia', async () => {
    const { main } = await pagina([ok([socio()])], { altaSocio: vi.fn(async () => fallo('E_SOCIO_DUPLICADO', 'Ya existe un socio con ese correo')) });
    escribir(main, 'Nombre', 'Marta Ruiz'); escribir(main, 'Correo', 'marta@club.test'); escribir(main, 'Contraseña provisional', 'Provisional1');
    await alta(main);
    const campo = main.querySelector('#alta-correo');
    const error = main.querySelector(`#${campo.getAttribute('aria-describedby').split(' ').find((i) => i.startsWith('error-'))}`);
    expect(error.textContent).toBe('Ya existe un socio con ese correo');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(main.querySelectorAll('ul.socios li')).toHaveLength(1);
  });

  it('SCR-007 el error de contraseña corta sale bajo el campo de la contraseña provisional', async () => {
    const { main } = await pagina([ok([])], { altaSocio: vi.fn(async () => fallo('E_CONTRASENA_CORTA', 'La contraseña debe tener al menos 8 caracteres', 400)) });
    escribir(main, 'Nombre', 'Marta Ruiz'); escribir(main, 'Correo', 'marta@club.test'); escribir(main, 'Contraseña provisional', 'corta');
    await alta(main);
    expect(main.querySelector('#alta-contrasena').getAttribute('aria-invalid')).toBe('true');
    expect(main.querySelector('#error-alta-contrasena').textContent).toBe('La contraseña debe tener al menos 8 caracteres');
  });

  it('SCR-007 «Restablecer» abre en la fila el campo «Contraseña provisional» con «Guardar»; guardar pone el aviso «Contraseña provisional guardada para Marta Ruiz»', async () => {
    const { main, api, avisos } = await pagina([ok([socio()])], { restablecerSocio: vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Contraseña provisional guardada para Marta Ruiz' } })) });
    const filaDe = () => main.querySelector('ul.socios li');
    boton(filaDe(), 'Restablecer').click();
    const fila = filaDe();
    const campo = fila.querySelector('input');
    expect(fila.querySelector(`label[for="${campo.id}"]`).textContent).toBe('Contraseña provisional');
    campo.value = 'Otra12345';
    boton(fila, 'Guardar').click();
    await esperar();
    expect(api.restablecerSocio).toHaveBeenCalledWith('c1', 'Otra12345');
    expect(avisos.textos()).toEqual(['Contraseña provisional guardada para Marta Ruiz']);
  });

  it('SCR-007 una provisional corta enseña el error bajo el campo de la fila', async () => {
    const { main } = await pagina([ok([socio()])], { restablecerSocio: vi.fn(async () => fallo('E_CONTRASENA_CORTA', 'La contraseña debe tener al menos 8 caracteres', 400)) });
    const filaDe = () => main.querySelector('ul.socios li');
    boton(filaDe(), 'Restablecer').click();
    const fila = filaDe();
    fila.querySelector('input').value = 'corta';
    boton(fila, 'Guardar').click();
    await esperar();
    expect(fila.querySelector('[role="alert"]').textContent).toBe('La contraseña debe tener al menos 8 caracteres');
  });

  it('SCR-007 «Dar de baja» pide confirmar; confirmar pone «Socio dado de baja: Marta Ruiz» en los avisos y recarga la lista con Marta de baja', async () => {
    const { main, api, avisos } = await pagina([ok([socio()]), ok([socio({ estado: 'Baja' })])], { bajaSocio: vi.fn(async () => ({ estado: 200, cuerpo: { mensaje: 'Socio dado de baja: Marta Ruiz' } })) });
    const filaDe = () => main.querySelector('ul.socios li');
    boton(filaDe(), 'Dar de baja').click();
    const fila = filaDe();
    expect(fila.textContent).toContain('¿Dar de baja a Marta Ruiz? Se cancelarán sus reservas futuras.');
    expect(api.bajaSocio).not.toHaveBeenCalled();
    boton(fila, 'Confirmar').click();
    await esperar();
    expect(api.bajaSocio).toHaveBeenCalledWith('c1');
    expect(avisos.textos()).toEqual(['Socio dado de baja: Marta Ruiz']);
    expect(main.querySelector('ul.socios .texto').textContent).toBe('Marta Ruiz — Baja');
  });

  it('AC-006-07 repetir la baja pone el aviso «Marta Ruiz ya estaba de baja», no un error', async () => {
    const { main, avisos } = await pagina([ok([socio()])], { bajaSocio: vi.fn(async () => ({ estado: 200, cuerpo: { aviso: { codigo: 'E_YA_DE_BAJA', mensaje: 'Marta Ruiz ya estaba de baja' } } })) });
    const filaDe = () => main.querySelector('ul.socios li');
    boton(filaDe(), 'Dar de baja').click();
    const fila = filaDe();
    boton(fila, 'Confirmar').click();
    await esperar();
    expect(avisos.textos()).toEqual(['Marta Ruiz ya estaba de baja']);
    expect(main.querySelector('.mensajes [role="alert"]')).toBeNull();
  });

  it('SCR-007 un error de baja sale junto a la lista, con foco, y la fila sigue «Lucía Gil — Activo»', async () => {
    const { main, avisos } = await pagina([ok([socio({ nombre: 'Lucía Gil' })])], { bajaSocio: vi.fn(async () => fallo('E_BAJA_PRESTAMOS', 'No se puede dar de baja: tiene material sin devolver')) });
    const filaDe = () => main.querySelector('ul.socios li');
    boton(filaDe(), 'Dar de baja').click();
    const fila = filaDe();
    boton(fila, 'Confirmar').click();
    await esperar();
    expect(main.querySelector('.mensajes [role="alert"]').textContent).toBe('No se puede dar de baja: tiene material sin devolver');
    expect(main.querySelector('ul.socios .texto').textContent).toBe('Lucía Gil — Activo');
    expect(avisos.textos()).toEqual([]);
  });
});
