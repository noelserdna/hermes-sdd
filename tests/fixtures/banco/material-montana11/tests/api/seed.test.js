import { describe, it, expect, beforeEach } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearStore } from '../../src/server/store.js';
import { crearReloj } from '../../src/domain/reloj.js';
import { iniciarSesion } from '../../src/domain/cuentas.js';

let archivo;
beforeEach(() => { archivo = path.join(mkdtempSync(path.join(tmpdir(), 'mm-seed-')), 'almacen.json'); });

const seed = (env) => spawnSync(process.execPath, ['scripts/seed.js'], {
  env: { PATH: process.env.PATH, DATA_FILE: archivo, ...env }, encoding: 'utf8',
});
const MARTA = { SEED_ENCARGADO_CORREO: 'marta@club.test', SEED_ENCARGADO_NOMBRE: 'Marta', SEED_ENCARGADO_CONTRASENA: 'Cumbre2026' };
const cuentas = () => crearStore({ archivo }).leer().cuentas;

describe('comando seed', () => {
  it('D-PA-001 seed crea el encargado y marta@club.test entra con Cumbre2026 (Panel del encargado)', () => {
    const r = seed(MARTA);
    expect(r.status).toBe(0);
    const ctx = { store: crearStore({ archivo }), reloj: crearReloj({ fijo: '2026-12-05' }) };
    expect(iniciarSesion(ctx, { correo: 'marta@club.test', contrasena: 'Cumbre2026' })).toMatchObject({ nombre: 'Marta', rol: 'encargado' });
  });

  it('D-PA-001 seed idempotente: dos ejecuciones no duplican la cuenta', () => {
    expect(seed(MARTA).status).toBe(0);
    const segunda = seed(MARTA);
    expect(segunda.status).toBe(0);
    expect(segunda.stdout).toContain('ya existe');
    expect(cuentas().filter((c) => c.correo === 'marta@club.test')).toHaveLength(1);
  });

  it('D-PA-001 con SEED_ROL=junta crea una cuenta de junta', () => {
    expect(seed({ ...MARTA, SEED_ENCARGADO_CORREO: 'junta@club.test', SEED_ENCARGADO_NOMBRE: 'Junta', SEED_ROL: 'junta' }).status).toBe(0);
    expect(cuentas()[0]).toMatchObject({ correo: 'junta@club.test', rol: 'junta', estado: 'Activa' });
  });

  it('INV-ACC-003 seed con hash: el almacén no contiene Cumbre2026 en claro y la salida tampoco', () => {
    const r = seed(MARTA);
    expect(readFileSync(archivo, 'utf8')).not.toContain('Cumbre2026');
    expect(r.stdout + r.stderr).not.toContain('Cumbre2026');
    expect(cuentas()[0].hashContrasena).toMatch(/^scrypt\$/);
  });

  it('si falta una variable de entorno sale con código distinto de 0 y un mensaje en español', () => {
    for (const falta of ['SEED_ENCARGADO_CORREO', 'SEED_ENCARGADO_NOMBRE', 'SEED_ENCARGADO_CONTRASENA']) {
      const resto = { ...MARTA };
      delete resto[falta];
      const r = seed(resto);
      expect(r.status).not.toBe(0);
      expect(r.stderr).toContain(falta);
      expect(r.stderr).toContain('Falta');
    }
  });

  it('rechaza una contraseña de menos de 8 caracteres y un rol desconocido sin crear nada', () => {
    expect(seed({ ...MARTA, SEED_ENCARGADO_CONTRASENA: 'corta1' }).status).not.toBe(0);
    expect(seed({ ...MARTA, SEED_ROL: 'socio' }).status).not.toBe(0);
    expect(cuentas()).toEqual([]);
  });
});
