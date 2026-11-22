import { describe, it, expect } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

const PABLO = ['pablo@club.test', 'Piolet2026!'];

async function preparar() {
  const reloj = crearRelojManual('2026-11-22T10:00:00Z');
  const app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: '2026-11-22' })), reloj });
  return { app, http: crearManejador(app) };
}
const entrar = (http, correo, contrasena) => http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena } });
async function conMarta() {
  const { app, http } = await preparar();
  const pablo = `mm_sesion=${/mm_sesion=([^;]+)/.exec((await entrar(http, ...PABLO)).cabeceras['Set-Cookie'])[1]}`;
  const alta = await http({ metodo: 'POST', ruta: '/api/socios', cuerpo: { nombre: 'Marta Ruiz', correo: 'marta@club.test', contrasena: 'Provisional1' }, cookie: pablo });
  const id = alta.cuerpo.socio.id;
  const restablecer = () => http({ metodo: 'PUT', ruta: `/api/socios/${id}/contrasena`, cuerpo: { contrasena: 'Otra12345' }, cookie: pablo });
  const marta = async () => (await app.store.leer()).cuentas.find((c) => c.id === id);
  return { app, http, restablecer, marta };
}

describe('UC-005 · INV-SOC-004 · restablecer la contraseña levanta el bloqueo (CH-010, Q-acceptance-002)', () => {
  // REQ-F-002 AC5: "GIVEN Marta forgot her password WHEN the encargado sets "Otra12345" for her THEN the user sees "Contraseña provisional guardada para Marta Ruiz" and Marta can enter with "Otra12345" and no longer with her old password"
  it('AC-005-01 REQ-F-002 AC5 Marta, con la cuenta bloqueada por fallos, entra en el acto con «Otra12345» tras restablecerla Pablo, y ya no con la antigua', async () => {
    const { app, http, restablecer, marta } = await conMarta();
    for (let i = 0; i < app.config.LOGIN_MAX_FAILURES; i += 1) await entrar(http, 'marta@club.test', 'equivocada1');
    expect((await entrar(http, 'marta@club.test', 'Provisional1')).cuerpo.error.codigo).toBe('E_CUENTA_BLOQUEADA');

    const r = await restablecer();
    expect(r.cuerpo.mensaje).toBe('Contraseña provisional guardada para Marta Ruiz');
    expect(await marta()).toMatchObject({ lockedUntil: null, failedLogins: 0 });

    const nueva = await entrar(http, 'marta@club.test', 'Otra12345');
    expect(nueva.estado).toBe(200);
    expect(nueva.cuerpo.destino).toBe('/cambiar-contrasena');
    const antigua = await entrar(http, 'marta@club.test', 'Provisional1');
    expect(antigua.estado).toBe(401);
    expect(antigua.cuerpo.error).toEqual({ codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' });
  });

  it('restablecer borra también el contador de fallos de una cuenta que aún no estaba bloqueada', async () => {
    const { app, http, restablecer, marta } = await conMarta();
    for (let i = 0; i < app.config.LOGIN_MAX_FAILURES - 1; i += 1) await entrar(http, 'marta@club.test', 'equivocada1');
    expect((await marta()).failedLogins).toBe(app.config.LOGIN_MAX_FAILURES - 1);
    await restablecer();
    expect((await marta()).failedLogins).toBe(0);
  });
});
