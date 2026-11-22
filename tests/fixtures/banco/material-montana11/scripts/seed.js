// Comando `seed`: prepara la primera cuenta del encargado (o de la junta con SEED_ROL=junta). Lo ejecuta una sola
// vez quien instala la web; repetirlo no duplica la cuenta. Nunca imprime la contraseña.
import path from 'node:path';
import { crearStore, siguienteId } from '../src/server/store.js';
import { hashContrasena } from '../src/server/hash.js';
import { validarCorreo, validarNombre, validarContrasena } from '../src/domain/validacion.js';

const VARIABLES = ['SEED_ENCARGADO_CORREO', 'SEED_ENCARGADO_NOMBRE', 'SEED_ENCARGADO_CONTRASENA'];

function salir(mensaje) {
  process.stderr.write(`${mensaje}\n`);
  process.exit(1);
}

for (const v of VARIABLES) if (!process.env[v]) salir(`Falta la variable de entorno ${v}. Define ${VARIABLES.join(', ')} (y SEED_ROL=junta para la junta).`);

const rol = process.env.SEED_ROL ?? 'encargado';
if (!['encargado', 'junta'].includes(rol)) salir('SEED_ROL debe ser «encargado» o «junta».');

let datos;
try {
  datos = {
    correo: validarCorreo(process.env.SEED_ENCARGADO_CORREO),
    nombre: validarNombre(process.env.SEED_ENCARGADO_NOMBRE),
    contrasena: validarContrasena(process.env.SEED_ENCARGADO_CONTRASENA),
  };
} catch (e) {
  salir(`Datos no válidos: ${e.message}.`);
}

const store = crearStore({ archivo: path.resolve(process.env.DATA_FILE ?? 'data/almacen.json') });
try {
  const creada = store.transaccion((db) => {
    if (db.cuentas.some((c) => c.correo === datos.correo)) return false;
    db.cuentas.push({
      id: siguienteId(db, 'cuentas'), nombre: datos.nombre, correo: datos.correo, rol,
      hashContrasena: hashContrasena(datos.contrasena), estado: 'Activa', fallosSeguidos: 0, bloqueadaHasta: null,
    });
    return true;
  });
  process.stdout.write(creada ? `Cuenta de ${rol} creada: ${datos.correo}\n` : `La cuenta ${datos.correo} ya existe: no se ha cambiado nada.\n`);
} catch (e) {
  salir(`No se pudo guardar la cuenta: ${e.message}`);
}
