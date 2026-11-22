import { describe, it, expect, beforeEach } from 'vitest';
import { crearApp } from '../../src/server/app.js';
import { crearAlmacenMemoria } from '../../src/server/store/almacen-memoria.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';
import { crearManejador } from '../../src/server/http/rutas.js';
import { login, logout, verificarContrasena } from '../../src/server/servicios/cuentas.js';
import { datosSemilla } from '../../demo/sembrar.mjs';

let app, reloj, http;
beforeEach(async () => {
  reloj = crearRelojManual('2026-11-22T10:00:00Z');
  app = crearApp({ store: crearAlmacenMemoria(await datosSemilla({ hoy: '2026-11-22' })), reloj });
  http = crearManejador(app);
});

const entrar = (correo, contrasena, cookie) => http({ metodo: 'POST', ruta: '/api/entrar', cuerpo: { correo, contrasena }, cookie });
const idDeCookie = (r) => /mm_sesion=([^;]+)/.exec(r.cabeceras['Set-Cookie'])?.[1];

describe('API-001-01 login', () => {
  it('socio y encargado entran y van a la página de su rol con su nombre', async () => {
    const lucia = await entrar('lucia@club.test', 'Cumbre2026!');
    expect(lucia.estado).toBe(200);
    expect(lucia.cuerpo).toMatchObject({ nombre: 'Lucía', rol: 'socio', destino: '/mis-reservas' });
    const pablo = await entrar('pablo@club.test', 'Piolet2026!');
    expect(pablo.cuerpo).toMatchObject({ nombre: 'Pablo', rol: 'encargado', destino: '/panel' });
  });

  it('el correo no distingue mayúsculas ni espacios alrededor', async () => {
    expect((await entrar('  Lucia@Club.TEST ', 'Cumbre2026!')).estado).toBe(200);
  });

  it('INV-SOC-008 contraseña errónea, correo desconocido y cuenta de baja dan el mismo E_CREDENCIALES', async () => {
    await app.store.transaccion((d) => { d.cuentas.find((c) => c.email === 'elena@club.test').active = false; });
    const respuestas = await Promise.all([
      entrar('lucia@club.test', 'mala'),
      entrar('nadie@club.test', 'Cumbre2026!'),
      entrar('elena@club.test', 'Junta2026!'),
    ]);
    for (const r of respuestas) {
      expect(r.estado).toBe(401);
      expect(r.cuerpo.error).toEqual({ codigo: 'E_CREDENCIALES', mensaje: 'Correo o contraseña incorrectos' });
      expect(r.cabeceras['Set-Cookie']).toBeUndefined();
    }
  });
});

describe('INV-SOC-004 bloqueo de cuenta', () => {
  const fallar = async (n) => { for (let i = 0; i < n; i++) await entrar('lucia@club.test', 'mala'); };

  it('tras 5 fallos seguidos la cuenta se bloquea 15 minutos, aunque la contraseña sea correcta', async () => {
    await fallar(4);
    expect((await entrar('lucia@club.test', 'mala')).cuerpo.error.codigo).toBe('E_CREDENCIALES');   // el 5.º todavía es una contraseña errónea
    reloj.avanzar(1);
    const r = await entrar('lucia@club.test', 'Cumbre2026!');
    expect(r.estado).toBe(423);
    expect(r.cuerpo.error).toEqual({ codigo: 'E_CUENTA_BLOQUEADA', mensaje: 'Cuenta bloqueada. Vuelve a intentarlo en 15 minutos' });
  });

  it('un intento con la cuenta bloqueada no cambia el contador ni alarga el bloqueo', async () => {
    await fallar(5);
    const antes = (await app.store.leer()).cuentas.find((c) => c.email === 'lucia@club.test');
    await entrar('lucia@club.test', 'mala');
    const despues = (await app.store.leer()).cuentas.find((c) => c.email === 'lucia@club.test');
    expect(despues.failedLogins).toBe(antes.failedLogins);
    expect(despues.lockedUntil).toBe(antes.lockedUntil);
  });

  it('pasados 15 minutos desde el bloqueo la contraseña correcta entra', async () => {
    await fallar(5);
    reloj.avanzar(14);
    expect((await entrar('lucia@club.test', 'Cumbre2026!')).estado).toBe(423);
    reloj.avanzar(1);
    expect((await entrar('lucia@club.test', 'Cumbre2026!')).estado).toBe(200);
  });

  it('un acierto reinicia el contador: 4 fallos, acierto y otros 4 fallos no bloquean', async () => {
    await fallar(4);
    await entrar('lucia@club.test', 'Cumbre2026!');
    await fallar(4);
    expect((await entrar('lucia@club.test', 'Cumbre2026!')).estado).toBe(200);
  });

  it('el bloqueo es por cuenta: otra cuenta sigue entrando', async () => {
    await fallar(5);
    expect((await entrar('pablo@club.test', 'Piolet2026!')).estado).toBe(200);
  });
});

describe('AC-001-09 entrar con una sesión ya abierta', () => {
  it('no duplica ningún dato y sigue mostrando a Lucía', async () => {
    const primera = await entrar('lucia@club.test', 'Cumbre2026!');
    const antes = await app.store.leer();
    const segunda = await entrar('lucia@club.test', 'Cumbre2026!', `mm_sesion=${idDeCookie(primera)}`);
    expect(segunda.cuerpo).toMatchObject({ nombre: 'Lucía', destino: '/mis-reservas' });
    expect(await app.store.leer()).toEqual(antes);
  });
});

describe('API-001-02 logout', () => {
  it('invalida la sesión en el servidor: la misma cookie ya no abre ninguna página', async () => {
    const id = idDeCookie(await entrar('lucia@club.test', 'Cumbre2026!'));
    const cookie = `mm_sesion=${id}`;
    expect((await http({ metodo: 'GET', ruta: '/api/sesion', consulta: { pagina: '/mis-reservas' }, cookie })).estado).toBe(200);
    const salir = await http({ metodo: 'POST', ruta: '/api/salir', cookie });
    expect(salir.estado).toBe(200);
    expect(salir.cabeceras['Set-Cookie']).toContain('Max-Age=0');
    expect((await http({ metodo: 'GET', ruta: '/api/sesion', consulta: { pagina: '/mis-reservas' }, cookie })).estado).toBe(401);
  });

  it('AC-002-03 salir otra vez responde 200 con un aviso y sin error', async () => {
    const id = idDeCookie(await entrar('lucia@club.test', 'Cumbre2026!'));
    await http({ metodo: 'POST', ruta: '/api/salir', cookie: `mm_sesion=${id}` });
    const otra = await http({ metodo: 'POST', ruta: '/api/salir', cookie: `mm_sesion=${id}` });
    expect(otra.estado).toBe(200);
    expect(otra.cuerpo.aviso.mensaje).toBe('La sesión ya estaba cerrada');
    expect(otra.cuerpo.error).toBeUndefined();
  });

  it('logout sin sesión devuelve el mismo aviso', async () => {
    const r = await logout(app, null);
    expect(r.aviso.codigo).toBe('E_YA_SALIDO');
  });
});

describe('API-001-08 guardia de página y cabeceras', () => {
  it('sin sesión pide Entrar (401) y con sesión de otro rol devuelve E_PAGINA_PROHIBIDA (403) sin datos ajenos', async () => {
    const sin = await http({ metodo: 'GET', ruta: '/api/sesion', consulta: { pagina: '/mis-reservas' } });
    expect(sin.estado).toBe(401);
    expect(sin.cuerpo).toEqual({ entrar: true });
    const id = idDeCookie(await entrar('lucia@club.test', 'Cumbre2026!'));
    const prohibida = await http({ metodo: 'GET', ruta: '/api/sesion', consulta: { pagina: '/material' }, cookie: `mm_sesion=${id}` });
    expect(prohibida.estado).toBe(403);
    expect(prohibida.cuerpo.error.codigo).toBe('E_PAGINA_PROHIBIDA');
    expect(JSON.stringify(prohibida.cuerpo)).not.toContain('Pablo');
  });

  it('toda respuesta lleva Cache-Control: no-store y la cookie es HttpOnly SameSite=Strict', async () => {
    const r = await entrar('lucia@club.test', 'Cumbre2026!');
    expect(r.cabeceras['Cache-Control']).toBe('no-store');
    expect(r.cabeceras['Set-Cookie']).toMatch(/HttpOnly/);
    expect(r.cabeceras['Set-Cookie']).toMatch(/SameSite=Strict/);
    expect((await http({ metodo: 'GET', ruta: '/api/no-existe' })).estado).toBe(404);
  });

  it('un fallo del almacén responde 503 con E_ALMACEN_NO_DISPONIBLE', async () => {
    app.store.fallarEscritura = true;
    const r = await entrar('lucia@club.test', 'Cumbre2026!');
    expect(r.estado).toBe(503);
    expect(r.cuerpo.error.codigo).toBe('E_ALMACEN_NO_DISPONIBLE');
  });
});

describe('INV-SOC-003 contraseñas solo con hash y sal', () => {
  it('el almacén no contiene ninguna contraseña en claro y cada cuenta tiene su propia sal', async () => {
    const texto = JSON.stringify(await app.store.leer());
    for (const clave of ['Cumbre2026!', 'Piolet2026!', 'Junta2026!']) expect(texto).not.toContain(clave);
    const hashes = (await app.store.leer()).cuentas.map((c) => c.passwordHash);
    expect(hashes.every((h) => /^scrypt\$\d+\$[0-9a-f]+\$[0-9a-f]+$/.test(h))).toBe(true);
    expect(new Set(hashes).size).toBe(hashes.length);
    expect(verificarContrasena('Cumbre2026!', hashes[0])).toBe(true);
    expect(verificarContrasena('otra', hashes[0])).toBe(false);
  });

  it('ni la respuesta ni el registro de errores contienen la contraseña', async () => {
    const r = await entrar('lucia@club.test', 'Secreta-que-no-es');
    expect(JSON.stringify(r)).not.toContain('Secreta-que-no-es');
    await expect(login(app, { correo: 'lucia@club.test', contrasena: 'Secreta-que-no-es' })).rejects.toSatisfy((e) => !e.message.includes('Secreta'));
  });
});

describe('D-PA-004 demo/sembrar.mjs', () => {
  it('siembra Lucía, Pablo, un miembro de la junta, 3 «Casco», 0 «Cuerda» y una reserva que ocupa 2 «Casco»', async () => {
    const d = await datosSemilla({ hoy: '2026-11-22' });
    expect(d.cuentas.map((c) => [c.name, c.role])).toEqual([['Lucía', 'socio'], ['Pablo', 'encargado'], ['Elena', 'junta']]);
    expect(d.material.map((m) => [m.name, m.totalUnits])).toEqual([['Casco', 3], ['Cuerda', 0]]);
    expect(d.reservas).toHaveLength(1);
    expect(d.reservas[0]).toMatchObject({ quantity: 2, status: 'Reservada', accountId: d.cuentas[0].id, itemId: d.material[0].id });
    expect(d.reservas[0].startDate >= '2026-11-22').toBe(true);
  });
});
