import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearAlmacen } from '../../../src/server/store.js';
import { iniciarSesion } from '../../../src/domain/acceso.js';
import { RUTAS } from '../../../src/server/http.js';

const raiz = path.resolve(import.meta.dirname, '../../..');
const nuevoAlmacen = () => path.join(mkdtempSync(path.join(tmpdir(), 'mm10-cuentas-')), 'store.json');
const ejecutar = (archivo, argumentos, env = {}) => spawnSync('node', ['src/server/preparar-cuentas.js', ...argumentos], {
  cwd: raiz, env: { ...process.env, STORE_FILE: archivo, ...env }, encoding: 'utf8',
});
const reloj = { ahora: () => new Date('2026-12-01T11:00:00Z'), hoy: () => '2026-12-01' };

describe('D-PA-003 npm run cuentas', () => {
  it('D-PA-003 npm run cuentas crea encargado y junta y ambos entran después con su rol (AC-001-12)', async () => {
    const archivo = nuevoAlmacen();
    const salida = ejecutar(archivo, ['--encargado', 'e@club.es', '--junta', 'j@club.es'], { CUENTA_ENCARGADO_CONTRASENA: 'Glaciar2026', CUENTA_JUNTA_CONTRASENA: 'Serac2026' });
    expect(salida.status).toBe(0);
    expect(salida.stdout).not.toContain('Glaciar2026');
    const almacen = crearAlmacen({ archivo });
    expect((await iniciarSesion({ almacen, reloj }, { correo: 'e@club.es', contrasena: 'Glaciar2026' })).rol).toBe('encargado');
    expect((await iniciarSesion({ almacen, reloj }, { correo: 'j@club.es', contrasena: 'Serac2026' })).rol).toBe('junta');
    expect(readFileSync(archivo, 'utf8')).not.toContain('Glaciar2026');
  });

  it('D-PA-003 acepta la contraseña por argumento y es idempotente: repetir no duplica las cuentas', async () => {
    const archivo = nuevoAlmacen();
    const argumentos = ['--encargado', 'e@club.es', '--encargado-contrasena', 'Glaciar2026', '--junta', 'j@club.es', '--junta-contrasena', 'Serac2026'];
    expect(ejecutar(archivo, argumentos).status).toBe(0);
    const repetido = ejecutar(archivo, argumentos);
    expect(repetido.status).toBe(0);
    expect(repetido.stdout).toContain('sin cambios');
    const { cuentas } = await crearAlmacen({ archivo }).load();
    expect(cuentas.map((c) => c.rol).sort()).toEqual(['encargado', 'junta']);
  });

  it('D-PA-003 quien instala puede cambiar la contraseña repitiendo el comando', async () => {
    const archivo = nuevoAlmacen();
    ejecutar(archivo, ['--encargado', 'e@club.es', '--encargado-contrasena', 'Glaciar2026']);
    expect(ejecutar(archivo, ['--encargado', 'e@club.es', '--encargado-contrasena', 'Nueva20260']).stdout).toContain('contraseña actualizada');
    const almacen = crearAlmacen({ archivo });
    expect((await iniciarSesion({ almacen, reloj }, { correo: 'e@club.es', contrasena: 'Nueva20260' })).rol).toBe('encargado');
    await expect(iniciarSesion({ almacen, reloj }, { correo: 'e@club.es', contrasena: 'Glaciar2026' })).rejects.toMatchObject({ codigo: 'E_CREDENCIALES_INVALIDAS' });
  });

  it('D-PA-003 rechaza contraseñas cortas, correos mal escritos y argumentos incompletos sin escribir nada', () => {
    const archivo = nuevoAlmacen();
    expect(ejecutar(archivo, ['--encargado', 'e@club.es', '--encargado-contrasena', 'corta']).status).toBe(1);
    expect(ejecutar(archivo, ['--encargado', 'sin-arroba', '--encargado-contrasena', 'Glaciar2026']).status).toBe(1);
    expect(ejecutar(archivo, ['--encargado', 'e@club.es']).status).toBe(1);
    expect(ejecutar(archivo, []).status).toBe(1);
  });

  it('D-PA-003 ninguna ruta de la API crea ni cambia cuentas de encargado o junta', () => {
    for (const ruta of RUTAS) expect(ruta.ruta).not.toMatch(/cuenta|encargado|junta|contrasena/);
  });
});
