// contracts/PERMISSIONS-MATRIX.md: qué operaciones puede cada rol. Sesión vigente en todas (INV-ACC-008).
const TODOS = ['iniciarSesion', 'cerrarSesion', 'quienSoy'];

const MATRIZ = {
  socio: [...TODOS, 'reservarMaterial', 'listarMisReservas', 'cancelarReserva'],
  encargado: [
    ...TODOS, 'crearSocio', 'darDeBajaSocio', 'restablecerContrasena', 'listarSocios',
    'entregarReserva', 'devolverPrestamo', 'pagarMulta', 'listarMultas', 'consultarEntregasYDevoluciones', 'consultarHistorial',
    'anadirUnidades', 'darDeBajaUnidad', 'listarInventario',
  ],
  junta: [...TODOS, 'listarSocios', 'consultarEntregasYDevoluciones', 'consultarHistorial'],
};

export const ROLES = Object.keys(MATRIZ);

export const puede = (rol, operacion) => Boolean(MATRIZ[rol]?.includes(operacion));
