// Ayudas de test (D-T-004: cada test con su almacén y su reloj; D-T-002: el reloj se avanza, nunca se espera).
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { crearStore, siguienteId } from '../../src/server/store.js';
import { crearReloj } from '../../src/domain/reloj.js';
import { hashContrasena } from '../../src/server/hash.js';

export function crearEntorno({ inicio = '2026-12-05T10:00:00Z' } = {}) {
  const archivo = path.join(mkdtempSync(path.join(tmpdir(), 'mm-')), 'almacen.json');
  let ahora = Date.parse(inicio);
  let caido = false;
  const store = crearStore({ archivo, falloEscritura: () => caido });
  const reloj = crearReloj({ ahora: () => ahora });
  return {
    archivo, store, reloj,
    ctx: (sid) => ({ store, reloj, sid }),
    avanzar: (minutos, segundos = 0) => { ahora += (minutos * 60 + segundos) * 1000; },
    caer: (valor = true) => { caido = valor; },
    /** Alta directa en el almacén (sin pasar por las operaciones), para preparar el GIVEN. */
    cuenta({ nombre, correo, contrasena, rol = 'socio', estado = 'Activa' }) {
      store.transaccion((db) => {
        db.cuentas.push({
          id: siguienteId(db, 'cuentas'), nombre, correo: correo.toLowerCase(), rol,
          hashContrasena: hashContrasena(contrasena), estado, fallosSeguidos: 0, bloqueadaHasta: null,
        });
      });
    },
  };
}

export async function fallo(promesaOFn) {
  try { await (typeof promesaOFn === 'function' ? promesaOFn() : promesaOFn); } catch (e) { return e; }
  return null;
}
