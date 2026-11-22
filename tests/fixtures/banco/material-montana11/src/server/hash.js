// INV-ACC-003 / ADR-003: la contraseña solo se guarda como hash scrypt con sal propia.
import { scryptSync, randomBytes, timingSafeEqual } from 'node:crypto';

const N = 16384; const R = 8; const P = 1; const LONGITUD = 64;

export function hashContrasena(plana) {
  const sal = randomBytes(16);
  const hash = scryptSync(plana, sal, LONGITUD, { N, r: R, p: P });
  return ['scrypt', N, R, P, sal.toString('hex'), hash.toString('hex')].join('$');
}

export function verificarContrasena(plana, guardado) {
  const [esquema, n, r, p, sal, hash] = String(guardado).split('$');
  if (esquema !== 'scrypt' || !hash) return false;
  const esperado = Buffer.from(hash, 'hex');
  const calculado = scryptSync(plana, Buffer.from(sal, 'hex'), esperado.length, { N: Number(n), r: Number(r), p: Number(p) });
  return timingSafeEqual(calculado, esperado);
}

// Contraseña inexistente para igualar el tiempo cuando el correo no está registrado.
export const HASH_FICTICIO = hashContrasena('sin-cuenta');
