// API-001-08 authorize: el único punto que decide por rol (INV-SEC-003). Sigue spec/contracts/PERMISSIONS-MATRIX.md.
export const COOKIE = 'mm_sesion';

const OPERACIONES = {
  socio: ['API-001-02', 'API-001-03', 'API-002-01', 'API-002-02', 'API-002-03', 'API-003-03', 'API-004-01'],
  encargado: ['API-001-02', 'API-001-03', 'API-001-04', 'API-001-05', 'API-001-06', 'API-002-04', 'API-002-05', 'API-002-06',
    'API-003-01', 'API-003-02', 'API-003-03', 'API-004-02', 'API-004-03'],
  junta: ['API-001-02', 'API-001-03', 'API-001-07'],
};

const PAGINAS = {
  socio: ['/mis-reservas', '/reservar', '/mis-multas', '/cambiar-contrasena'],
  encargado: ['/panel', '/socios', '/material', '/multas', '/cambiar-contrasena'],
  junta: ['/historial', '/cambiar-contrasena'],
};

const SIN_CAMBIAR = ['API-001-02', 'API-001-03'];

/**
 * @param sesion la sesión viva (o null)
 * @param operacion `{ pagina: '/material' }` o `{ operacion: 'API-003-01' }`
 * @returns `{ ok: true }` | `{ ok: false, entrar: true }` (sin sesión) | `{ ok: false, cambiar: true }` (contraseña provisional) | `{ ok: false, codigo }`
 */
export function authorize(sesion, operacion) {
  if (!sesion) return { ok: false, entrar: true };
  // INV-SOC-006: con contraseña provisional solo se sale o se cambia la contraseña; lo demás lleva a Cambiar contraseña
  if (sesion.debeCambiar) {
    const libre = operacion.pagina !== undefined ? operacion.pagina === '/cambiar-contrasena' : SIN_CAMBIAR.includes(operacion.operacion);
    if (!libre) return { ok: false, cambiar: true };
    sesion.renovar();
    return { ok: true };
  }
  const permitido = operacion.pagina !== undefined
    ? (PAGINAS[sesion.rol] ?? []).includes(operacion.pagina)
    : (OPERACIONES[sesion.rol] ?? []).includes(operacion.operacion);
  if (!permitido) return { ok: false, codigo: operacion.pagina !== undefined ? 'E_PAGINA_PROHIBIDA' : 'E_ACCESO_DENEGADO' };
  sesion.renovar();
  return { ok: true };
}

export function cookieSesion(id, { secure = false, borrar = false } = {}) {
  const partes = [`${COOKIE}=${id}`, 'Path=/', 'HttpOnly', 'SameSite=Strict'];
  if (borrar) partes.push('Max-Age=0');
  if (secure) partes.push('Secure');
  return partes.join('; ');
}

export function leerCookieSesion(cabecera) {
  if (!cabecera) return null;
  for (const trozo of cabecera.split(';')) {
    const [k, ...v] = trozo.trim().split('=');
    if (k === COOKIE) return v.join('=') || null;
  }
  return null;
}
