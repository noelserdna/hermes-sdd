import { describe, it, expect } from 'vitest';
import { crearSesiones } from '../../src/server/servicios/sesiones.js';
import { crearRelojManual } from '../../src/server/dominio/fechas.js';

const nueva = () => {
  const reloj = crearRelojManual('2026-11-22T10:00:00Z');
  return { reloj, sesiones: crearSesiones({ reloj, idleMinutes: 30 }) };
};

describe('INV-SOC-005 caducidad por inactividad', () => {
  // Q-spec-auditor-001: con exactamente 30 minutos sigue abierta; se cierra al pasar de 30 (inactividad > SESSION_IDLE_MINUTES)
  it('INV-SOC-005 D-PA-001 con exactamente 30 minutos sin actividad la sesión sigue abierta', () => {
    const { reloj, sesiones } = nueva();
    const id = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    reloj.avanzar(30);
    expect(sesiones.obtener(id)).not.toBeNull();
  });

  it('INV-SOC-005 D-PA-001 a los 30 minutos y 1 segundo la sesión está cerrada y no se recupera', () => {
    const { reloj, sesiones } = nueva();
    const id = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    reloj.avanzar(30);
    reloj.avanzarSegundos(1);
    expect(sesiones.obtener(id)).toBeNull();
    reloj.avanzarSegundos(-1);
    expect(sesiones.obtener(id)).toBeNull();
  });

  it('obtener no renueva la actividad; renovar sí', () => {
    const { reloj, sesiones } = nueva();
    const id = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    reloj.avanzar(20);
    sesiones.obtener(id);
    reloj.avanzar(11);
    expect(sesiones.obtener(id)).toBeNull();

    const otra = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    reloj.avanzar(20);
    sesiones.obtener(otra).renovar();
    reloj.avanzar(20);
    expect(sesiones.obtener(otra)).not.toBeNull();
  });
});

describe('INV-SOC-005 sesión opaca', () => {
  it('el id es aleatorio y no contiene datos de la cuenta', () => {
    const { sesiones } = nueva();
    const a = sesiones.abrir({ cuentaId: 'cuenta-lucia', rol: 'socio', nombre: 'Lucía' });
    const b = sesiones.abrir({ cuentaId: 'cuenta-lucia', rol: 'socio', nombre: 'Lucía' });
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(a.toLowerCase()).not.toContain('lucia');
  });

  it('cerrar invalida la sesión en el servidor y repetirlo no falla', () => {
    const { sesiones } = nueva();
    const id = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    expect(sesiones.cerrar(id)).toBe(true);
    expect(sesiones.obtener(id)).toBeNull();
    expect(sesiones.cerrar(id)).toBe(false);
  });

  it('cerrarDeCuenta cierra todas las sesiones de esa cuenta y no las de otras', () => {
    const { sesiones } = nueva();
    const a = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    const b = sesiones.abrir({ cuentaId: 'a1', rol: 'socio', nombre: 'Lucía' });
    const c = sesiones.abrir({ cuentaId: 'a2', rol: 'encargado', nombre: 'Pablo' });
    sesiones.cerrarDeCuenta('a1');
    expect([sesiones.obtener(a), sesiones.obtener(b)]).toEqual([null, null]);
    expect(sesiones.obtener(c)).not.toBeNull();
  });
});
