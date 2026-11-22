// Sesiones opacas guardadas en el almacén (ENT-005) y su cookie `sid`.
import { randomBytes } from 'node:crypto';

export const NOMBRE_COOKIE = 'sid';

export function nuevaSesion(db, cuentaId, ahoraMs) {
  const sesion = { id: randomBytes(32).toString('hex'), cuentaId, ultimaActividad: new Date(ahoraMs).toISOString() };
  db.sesiones.push(sesion);
  return sesion;
}

export function leerSid(cabeceraCookie) {
  for (const parte of String(cabeceraCookie ?? '').split(';')) {
    const [nombre, ...valor] = parte.trim().split('=');
    if (nombre === NOMBRE_COOKIE) return valor.join('=') || undefined;
  }
  return undefined;
}

export const cookieSesion = (sid) => `${NOMBRE_COOKIE}=${sid}; Path=/; HttpOnly; SameSite=Strict`;
export const cookieBorrada = () => `${NOMBRE_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`;
