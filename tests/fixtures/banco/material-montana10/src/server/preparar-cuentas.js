import { pathToFileURL } from 'node:url';
import { crearAlmacen } from './store.js';
import { nuevaCuenta, hashContrasena, verificarContrasena, normalizarCorreo } from '../domain/acceso.js';
import { error } from '../domain/errores.js';
import { PASSWORD_MIN_LENGTH } from '../domain/config.js';

// D-PA-003: las cuentas del encargado y de la junta las deja preparadas quien instala la web, con este comando.
// Ninguna ruta de la API las crea ni les cambia la contraseña; el encargado solo gestiona socios.
const ROLES = [
  { rol: 'encargado', nombre: 'Encargado', entorno: 'CUENTA_ENCARGADO_CONTRASENA' },
  { rol: 'junta', nombre: 'Junta', entorno: 'CUENTA_JUNTA_CONTRASENA' },
];

export function leerArgumentos(argv) {
  const opciones = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i].startsWith('--') || argv[i + 1] === undefined) throw new Error(`Argumento no válido: ${argv[i]}`);
    opciones[argv[i].slice(2)] = argv[i + 1];
  }
  return opciones;
}

const correoValido = (correo) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);

// Crea o actualiza las cuentas pedidas; repetirlo no duplica nada. Devuelve qué hizo con cada rol.
export async function prepararCuentas({ almacen, opciones, env = process.env }) {
  const informe = [];
  await almacen.transaction((db) => {
    for (const { rol, nombre, entorno } of ROLES) {
      const correo = opciones[rol] === undefined ? null : normalizarCorreo(opciones[rol]);
      if (correo === null) continue;
      if (!correoValido(correo)) throw error('E_DATOS_SOCIO_INVALIDOS');
      const contrasena = opciones[`${rol}-contrasena`] ?? env[entorno];
      const existente = db.cuentas.find((c) => c.correo === correo);
      if (existente && existente.rol !== rol) throw new Error(`El correo ${correo} ya es de una cuenta con otro rol`);
      if (contrasena === undefined && !existente) throw new Error(`Falta la contraseña de ${rol}: usa ${entorno} o --${rol}-contrasena`);
      if (contrasena !== undefined && contrasena.length < PASSWORD_MIN_LENGTH) throw error('E_CONTRASENA_CORTA');
      if (!existente) {
        nuevaCuenta(db, { nombre: opciones[`${rol}-nombre`] ?? nombre, correo, contrasena, rol });
        informe.push({ rol, correo, accion: 'creada' });
      } else {
        existente.estado = 'Activa';
        informe.push({ rol, correo, accion: 'existente', cambiar: contrasena });
      }
    }
  });
  // El cambio de contraseña pedido por quien instala se aplica fuera de la comparación síncrona de la transacción.
  for (const linea of informe.filter((l) => l.cambiar !== undefined)) {
    if (await verificarContrasena(linea.cambiar, (await almacen.load()).cuentas.find((c) => c.correo === linea.correo).hashContrasena)) {
      linea.accion = 'sin cambios';
    } else {
      await almacen.transaction((db) => { db.cuentas.find((c) => c.correo === linea.correo).hashContrasena = hashContrasena(linea.cambiar); });
      linea.accion = 'contraseña actualizada';
    }
    delete linea.cambiar;
  }
  return informe;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const informe = await prepararCuentas({ almacen: crearAlmacen(), opciones: leerArgumentos(process.argv.slice(2)) });
    if (!informe.length) throw new Error('Indica al menos --encargado <correo> o --junta <correo>');
    for (const { rol, correo, accion } of informe) process.stdout.write(`${rol} ${correo}: ${accion}\n`);
  } catch (e) {
    process.stderr.write(`${e.mensaje ?? e.message}\n`);
    process.exitCode = 1;
  }
}
