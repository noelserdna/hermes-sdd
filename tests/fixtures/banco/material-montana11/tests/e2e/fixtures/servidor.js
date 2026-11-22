// Servidor propio de cada test e2e: almacén aislado (D-T-004), reloj fijo (CLOCK_FIXED) y reinicio con otro reloj para
// "10 minutos después" sin esperas (D-T-002). Arranca la web con `vite` y el plugin, como `npm run dev`.
import { spawn, execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

const raiz = path.resolve(import.meta.dirname, '../../..');
export const INICIO = '2026-12-05T10:00:00Z';
export const MARTA = { correo: 'marta@club.test', nombre: 'Marta', contrasena: 'Cumbre2026' };

/** Instante `minutos` y `segundos` después del inicio, en el formato de CLOCK_FIXED. */
export const despues = (minutos, segundos = 0) => new Date(Date.parse(INICIO) + (minutos * 60 + segundos) * 1000).toISOString();

const puertoLibre = () => new Promise((resolver) => {
  const s = createServer();
  s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolver(port)); });
});

async function esperar(url) {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(url)).status < 500) return; } catch { /* aún no escucha */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`El servidor no arrancó en ${url}`);
}

export async function crearServidor() {
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), 'mm-e2e-')), 'almacen.json');
  const puerto = await puertoLibre();
  const url = `http://127.0.0.1:${puerto}`;
  let proceso;

  async function arrancar(reloj = INICIO) {
    proceso = spawn(process.execPath, [path.join(raiz, 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1', '--port', String(puerto), '--strictPort'], {
      cwd: raiz, stdio: 'ignore', env: { ...process.env, NODE_ENV: 'development', DATA_FILE: archivo, CLOCK_FIXED: reloj },
    });
    await esperar(url);
  }
  async function parar() {
    if (!proceso || proceso.exitCode !== null) return;
    await new Promise((resolver) => { proceso.once('exit', resolver); proceso.kill('SIGTERM'); });
  }
  async function reiniciar(reloj) { await parar(); await arrancar(reloj); }

  const llamar = (operacion, cuerpo, cookie) => fetch(`${url}/api/${operacion}`, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { ...(cuerpo ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { cookie } : {}) },
    ...(cuerpo ? { body: JSON.stringify(cuerpo) } : {}),
  });

  return {
    url, archivo, arrancar, parar, reiniciar,
    /** Comando `seed` del encargado (como lo prepara quien instala la web). */
    sembrar(cuenta = MARTA) {
      execFileSync(process.execPath, ['scripts/seed.js'], { cwd: raiz, stdio: 'ignore', env: {
        PATH: process.env.PATH, DATA_FILE: archivo,
        SEED_ENCARGADO_CORREO: cuenta.correo, SEED_ENCARGADO_NOMBRE: cuenta.nombre, SEED_ENCARGADO_CONTRASENA: cuenta.contrasena } });
    },
    /** Prepara el GIVEN: un socio dado de alta por la API como lo haría el encargado. */
    async socio({ nombre, correo, contrasena }) {
      const entrada = await llamar('iniciarSesion', { correo: MARTA.correo, contrasena: MARTA.contrasena });
      const cookie = entrada.headers.get('set-cookie').split(';')[0];
      const r = await (await llamar('crearSocio', { nombre, correo, contrasena }, cookie)).json();
      if (!r.ok) throw new Error(`No se pudo preparar al socio ${correo}: ${r.codigo}`);
    },
    /** Prepara el GIVEN de un fallo de contraseña repetido (sin pasar por la pantalla). */
    async fallar(correo, veces) {
      for (let i = 0; i < veces; i++) await llamar('iniciarSesion', { correo, contrasena: 'x' });
    },
    /** El socio ya estaba dado de baja (la baja llega en FASE-4: aquí se deja en el almacén). */
    ponerEnBaja(correo) {
      const db = JSON.parse(readFileSync(archivo, 'utf8'));
      db.cuentas.find((c) => c.correo === correo).estado = 'Baja';
      writeFileSync(archivo, JSON.stringify(db));
    },
  };
}
