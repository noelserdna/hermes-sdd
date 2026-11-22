import { describe, it, expect, beforeEach } from 'vitest';
import { crearAlmacenMemoria } from '../../../src/server/store.js';
import { crearSocio, listarSocios, darDeBajaSocio, restablecerContrasena } from '../../../src/domain/socios.js';
import { iniciarSesion, nuevaCuenta } from '../../../src/domain/acceso.js';

let almacen;
const encargado = { id: 1, rol: 'encargado' };
const socio = { id: 3, rol: 'socio' };
const junta = { id: 2, rol: 'junta' };
const reloj = { ahora: () => new Date('2026-11-21T11:00:00Z'), hoy: () => '2026-11-21' };
const marta = { nombre: 'Marta Ruiz', correo: 'marta@club.es', contrasena: 'Glaciar2026' };
const codigoDe = async (promesa) => (await promesa.then(() => ({}), (e) => e)).codigo;
const cuentas = async () => (await almacen.load()).cuentas;

beforeEach(async () => {
  almacen = crearAlmacenMemoria();
  await almacen.transaction((db) => {
    nuevaCuenta(db, { nombre: 'Encargado', correo: 'encargado@club.es', contrasena: 'Glaciar2025', rol: 'encargado' });
    nuevaCuenta(db, { nombre: 'Junta', correo: 'junta@club.es', contrasena: 'Serac20266', rol: 'junta' });
  });
});

describe('crearSocio (API-001-03, UC-002)', () => {
  it('el encargado crea a «Marta Ruiz» con «Glaciar2026»: cuenta Activa con rol socio, aparece en la lista con su correo y Marta puede entrar', async () => {
    const creada = await crearSocio({ almacen }, encargado, { ...marta, correo: ' Marta@Club.es ' });
    expect(creada).toEqual({ id: 3, nombre: 'Marta Ruiz', correo: 'marta@club.es', estado: 'Activa' });
    expect(await listarSocios({ almacen }, encargado, { detalle: true })).toEqual([{ id: 3, nombre: 'Marta Ruiz', correo: 'marta@club.es', estado: 'Activa' }]);
    expect((await cuentas()).find((c) => c.id === 3)).toMatchObject({ rol: 'socio', estado: 'Activa', correo: 'marta@club.es' });
    const sesion = await iniciarSesion({ almacen, reloj }, { correo: 'marta@club.es', contrasena: 'Glaciar2026' });
    expect(sesion).toMatchObject({ nombre: 'Marta Ruiz', rol: 'socio' });
  });

  it('con «marta@club.es» ya existente, otra alta con ese correo da E_CORREO_DUPLICADO y la lista mantiene un solo «Marta Ruiz»', async () => {
    await crearSocio({ almacen }, encargado, marta);
    const fallo = await crearSocio({ almacen }, encargado, { ...marta, nombre: 'Otra Marta', correo: 'MARTA@club.es' }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_CORREO_DUPLICADO', 'Ya existe un socio con ese correo']);
    const lista = await listarSocios({ almacen }, encargado, { detalle: true });
    expect(lista.filter((s) => s.nombre === 'Marta Ruiz')).toHaveLength(1);
    expect(lista).toHaveLength(1);
  });

  it('con la contraseña «corta» (5 caracteres) da E_CONTRASENA_CORTA y no se crea cuenta', async () => {
    const fallo = await crearSocio({ almacen }, encargado, { ...marta, contrasena: 'corta' }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_CONTRASENA_CORTA', 'La contraseña debe tener al menos 8 caracteres']);
    expect(await cuentas()).toHaveLength(2);
  });

  it('AC-002-12 un nombre vacío o el correo «marta» dan E_DATOS_SOCIO_INVALIDOS y no se crea cuenta', async () => {
    for (const datos of [{ ...marta, nombre: '  ' }, { ...marta, correo: 'marta' }, { ...marta, nombre: undefined }]) {
      expect(await codigoDe(crearSocio({ almacen }, encargado, datos))).toBe('E_DATOS_SOCIO_INVALIDOS');
    }
    expect(await cuentas()).toHaveLength(2);
  });

  it('un socio y la junta reciben E_SIN_PERMISO y no se crea nada; ninguna operación crea cuentas de encargado o junta (D-PA-003)', async () => {
    for (const actor of [socio, junta]) expect(await codigoDe(crearSocio({ almacen }, actor, marta))).toBe('E_SIN_PERMISO');
    // D-PA-003: aunque el cuerpo pida rol «encargado», la cuenta nace con rol socio
    await crearSocio({ almacen }, encargado, { ...marta, rol: 'encargado' });
    const creadas = (await cuentas()).filter((c) => c.correo === 'marta@club.es');
    expect(creadas.map((c) => c.rol)).toEqual(['socio']);
    expect((await cuentas()).filter((c) => c.rol !== 'socio')).toHaveLength(2);
  });

  it('AC-002-09 dos altas a la vez con «marta@club.es»: una crea la cuenta y la otra da E_CORREO_DUPLICADO', async () => {
    const resultados = await Promise.allSettled([crearSocio({ almacen }, encargado, marta), crearSocio({ almacen }, encargado, marta)]);
    expect(resultados.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected']);
    expect(resultados.find((r) => r.status === 'rejected').reason.codigo).toBe('E_CORREO_DUPLICADO');
    expect((await cuentas()).filter((c) => c.correo === 'marta@club.es')).toHaveLength(1);
  });

  it('REQ-NF-001 AC1 con Marta creada con «Glaciar2026», el almacén guardado y las respuestas no contienen «Glaciar2026»', async () => {
    const creada = await crearSocio({ almacen }, encargado, marta);
    const lista = await listarSocios({ almacen }, encargado, { detalle: true });
    // REQ-NF-001 AC1: "GIVEN Marta created with contraseña "Glaciar2026" WHEN the stored data is read THEN it does not contain "Glaciar2026""
    expect(JSON.stringify(await almacen.load())).not.toContain('Glaciar2026');
    expect(JSON.stringify([creada, lista])).not.toMatch(/Glaciar2026|scrypt/);
    expect((await cuentas()).find((c) => c.correo === 'marta@club.es').hashContrasena).toMatch(/^scrypt\$/);
  });
});

describe('listarSocios (API-001-06)', () => {
  it('el detalle con correo es solo del encargado: la junta y el socio reciben E_SIN_PERMISO; sin detalle sigue el selector sin correo', async () => {
    await crearSocio({ almacen }, encargado, marta);
    expect(await codigoDe(listarSocios({ almacen }, junta, { detalle: true }))).toBe('E_SIN_PERMISO');
    expect(await codigoDe(listarSocios({ almacen }, socio, { detalle: true }))).toBe('E_SIN_PERMISO');
    expect(await listarSocios({ almacen }, junta)).toEqual([{ id: 3, nombre: 'Marta Ruiz', estado: 'Activa' }]);
  });
});

describe('darDeBajaSocio (API-001-04, INV-ACC-006, INV-ACC-007)', () => {
  const sembrarPablo = () => almacen.transaction((db) => {
    nuevaCuenta(db, { nombre: 'Pablo', correo: 'pablo@club.es', contrasena: 'Arista2026', rol: 'socio' });
    nuevaCuenta(db, { nombre: 'Lucía', correo: 'lucia@club.es', contrasena: 'Cumbre2026', rol: 'socio' });
  });
  const idDe = async (correo) => (await cuentas()).find((c) => c.correo === correo).id;

  it('«pablo@club.es» sin reserva en curso ni multa pendiente pasa a «Baja» y no puede entrar', async () => {
    await sembrarPablo();
    const baja = await darDeBajaSocio({ almacen }, encargado, { cuentaId: await idDe('pablo@club.es') });
    expect(baja).toMatchObject({ nombre: 'Pablo', estado: 'Baja' });
    const lista = await listarSocios({ almacen }, encargado, { detalle: true });
    expect(lista.find((s) => s.nombre === 'Pablo').estado).toBe('Baja');
    expect(await codigoDe(iniciarSesion({ almacen, reloj }, { correo: 'pablo@club.es', contrasena: 'Arista2026' }))).toBe('E_CREDENCIALES_INVALIDAS');
  });

  it('«lucia@club.es» con «Casco 2» prestado, o con una multa Pendiente, da E_BAJA_SOCIO_BLOQUEADA y su cuenta sigue Activa', async () => {
    await sembrarPablo();
    const lucia = await idDe('lucia@club.es');
    const pablo = await idDe('pablo@club.es');
    await almacen.transaction((db) => {
      db.unidades.push({ id: 1, tipo: 'Casco', numero: 2, estado: 'Activa' });
      db.reservas.push({ id: 1, socioId: lucia, tipo: 'Casco', desde: '2026-11-20', hasta: '2026-11-25', estado: 'Prestada', unidadId: 1, devueltaEl: null, creadaEl: '2026-11-10T10:00:00.000Z' });
      db.multas.push({ id: 1, socioId: pablo, reservaId: 1, dias: 1, importeEur: 2, estado: 'Pendiente', pagadaEl: null });
    });
    for (const cuentaId of [lucia, pablo]) {
      const fallo = await darDeBajaSocio({ almacen }, encargado, { cuentaId }).catch((e) => e);
      expect([fallo.codigo, fallo.mensaje]).toEqual(['E_BAJA_SOCIO_BLOQUEADA', 'No se puede dar de baja: tiene material prestado o multas pendientes']);
    }
    expect((await cuentas()).filter((c) => c.rol === 'socio').map((c) => c.estado)).toEqual(['Activa', 'Activa']);
    // una multa Pagada ya no bloquea (RN-010: solo Pendiente)
    await almacen.transaction((db) => { db.multas[0].estado = 'Pagada'; });
    expect((await darDeBajaSocio({ almacen }, encargado, { cuentaId: pablo })).estado).toBe('Baja');
  });

  it('AC-002-10 repetir la baja de «pablo@club.es» lo deja en «Baja» sin cambiar nada', async () => {
    await sembrarPablo();
    const cuentaId = await idDe('pablo@club.es');
    await darDeBajaSocio({ almacen }, encargado, { cuentaId });
    const antes = JSON.stringify(await almacen.load());
    expect((await darDeBajaSocio({ almacen }, encargado, { cuentaId })).estado).toBe('Baja');
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });

  it('solo el encargado da de baja, y nunca a una cuenta de encargado o junta (D-PA-003)', async () => {
    await sembrarPablo();
    const pablo = await idDe('pablo@club.es');
    for (const actor of [socio, junta]) expect(await codigoDe(darDeBajaSocio({ almacen }, actor, { cuentaId: pablo }))).toBe('E_SIN_PERMISO');
    for (const cuentaId of [1, 2, 99]) expect(await codigoDe(darDeBajaSocio({ almacen }, encargado, { cuentaId }))).toBe('E_SOCIO_NO_ENCONTRADO');
    expect((await cuentas()).map((c) => c.estado)).toEqual(['Activa', 'Activa', 'Activa', 'Activa']);
  });
});

describe('restablecerContrasena (API-001-05, INV-ACC-103)', () => {
  let martaId;
  const entrarMarta = (contrasena) => iniciarSesion({ almacen, reloj }, { correo: 'marta@club.es', contrasena });
  beforeEach(async () => { martaId = (await crearSocio({ almacen }, encargado, marta)).id; });

  it('el encargado fija «Nieve2026» a «marta@club.es»: Marta entra con ella y la antigua «Glaciar2026» ya no vale', async () => {
    const antes = (await cuentas()).find((c) => c.id === martaId).hashContrasena;
    await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'Nieve2026' });
    expect((await cuentas()).find((c) => c.id === martaId).hashContrasena).not.toBe(antes);
    expect(await entrarMarta('Nieve2026')).toMatchObject({ nombre: 'Marta Ruiz' });
    expect(await codigoDe(entrarMarta('Glaciar2026'))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(JSON.stringify(await almacen.load())).not.toContain('Nieve2026');
  });

  it('AC-002-08 fijar «corta» a «marta@club.es» da E_CONTRASENA_CORTA y la contraseña vigente no cambia', async () => {
    const antes = JSON.stringify(await almacen.load());
    const fallo = await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'corta' }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_CONTRASENA_CORTA', 'La contraseña debe tener al menos 8 caracteres']);
    expect(JSON.stringify(await almacen.load())).toBe(antes);
    expect(await entrarMarta('Glaciar2026')).toMatchObject({ nombre: 'Marta Ruiz' });
  });

  it('AC-002-11 repetir «Nieve2026» a «marta@club.es» no cambia nada y Marta sigue entrando con ella', async () => {
    await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'Nieve2026' });
    const antes = JSON.stringify(await almacen.load());
    await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'Nieve2026' });
    expect(JSON.stringify(await almacen.load())).toBe(antes);
    expect(await entrarMarta('Nieve2026')).toMatchObject({ nombre: 'Marta Ruiz' });
  });

  it('REQ-F-002 restablecer la contraseña de «pablo@club.es» dado de baja (decisión Q-spec-auditor-001, aún sin id AC) da E_SOCIO_NO_ENCONTRADO, no cambia el hash y Pablo sigue sin entrar', async () => {
    // WHEN the encargado asks to deactivate or reset an account THE system SHALL apply it (decisión del cliente Q-spec-auditor-001: no se restablece una cuenta en Baja)
    const pablo = (await crearSocio({ almacen }, encargado, { nombre: 'Pablo', correo: 'pablo@club.es', contrasena: 'Arista2026' })).id;
    await darDeBajaSocio({ almacen }, encargado, { cuentaId: pablo });
    const antes = JSON.stringify(await almacen.load());
    const fallo = await restablecerContrasena({ almacen }, encargado, { cuentaId: pablo, contrasena: 'Nieve2026' }).catch((e) => e);
    expect([fallo.codigo, fallo.mensaje]).toEqual(['E_SOCIO_NO_ENCONTRADO', 'El socio elegido no existe']);
    expect(JSON.stringify(await almacen.load())).toBe(antes);
    expect(await codigoDe(iniciarSesion({ almacen, reloj }, { correo: 'pablo@club.es', contrasena: 'Nieve2026' }))).toBe('E_CREDENCIALES_INVALIDAS');
  });

  it('REQ-F-002 (CH-004, el criterio AC6 se prueba en e2e) con «marta@club.es» bloqueada por errores, fijarle «Nieve2026» levanta el bloqueo: entra ya con ella y la antigua no vale', async () => {
    // CH-004: restablecer la contraseña de una cuenta bloqueada por errores levanta el bloqueo en el acto (sin esperar los minutos de bloqueo)
    for (let i = 0; i < 5; i += 1) expect(await codigoDe(entrarMarta('Olvidada1'))).toBe('E_CREDENCIALES_INVALIDAS');
    expect(await codigoDe(entrarMarta('Glaciar2026'))).toBe('E_CUENTA_BLOQUEADA');
    await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'Nieve2026' });
    expect(await entrarMarta('Nieve2026')).toMatchObject({ nombre: 'Marta Ruiz' });
    expect((await cuentas()).find((c) => c.id === martaId)).toMatchObject({ fallosSeguidos: 0, bloqueadaHasta: null });
    expect(await codigoDe(entrarMarta('Glaciar2026'))).toBe('E_CREDENCIALES_INVALIDAS');
  });

  it('REQ-F-002 (CH-006, el criterio AC6 se prueba en e2e) si alguien entra con la antigua «Glaciar2026» justo mientras el encargado fija «Nieve2026» a «marta@club.es», no se abre sesión con la antigua y Marta entra con la nueva (CH-006)', async () => {
    // REQ-F-002 AC6: "GIVEN "marta@club.es" forgot her contraseña WHEN the encargado sets "Nieve2026" THEN Marta enters with it and the old one no longer works"
    // El restablecimiento se cuela entre la lectura de la cuenta y la apertura de la sesión del intento con la antigua.
    const cargar = almacen.load.bind(almacen);
    let colado = false;
    almacen.load = async () => {
      const datos = await cargar();
      if (!colado) {
        colado = true;
        await restablecerContrasena({ almacen }, encargado, { cuentaId: martaId, contrasena: 'Nieve2026' });
      }
      return datos;
    };
    expect(await codigoDe(entrarMarta('Glaciar2026'))).toBe('E_CREDENCIALES_INVALIDAS');
    almacen.load = cargar;
    // and the old one no longer works: no queda ninguna sesión abierta con la antigua
    expect((await almacen.load()).sesiones).toHaveLength(0);
    expect(await entrarMarta('Nieve2026')).toMatchObject({ nombre: 'Marta Ruiz' });
    expect(await codigoDe(entrarMarta('Glaciar2026'))).toBe('E_CREDENCIALES_INVALIDAS');
  });

  it('solo el encargado restablece, y solo cuentas socio: un encargado o una junta como destino da E_SOCIO_NO_ENCONTRADO (INV-ACC-103, D-PA-003)', async () => {
    for (const actor of [socio, junta]) expect(await codigoDe(restablecerContrasena({ almacen }, actor, { cuentaId: martaId, contrasena: 'Nieve2026' }))).toBe('E_SIN_PERMISO');
    const antes = JSON.stringify(await almacen.load());
    for (const cuentaId of [1, 2]) expect(await codigoDe(restablecerContrasena({ almacen }, encargado, { cuentaId, contrasena: 'Nieve2026' }))).toBe('E_SOCIO_NO_ENCONTRADO');
    expect(JSON.stringify(await almacen.load())).toBe(antes);
  });
});
