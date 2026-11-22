// Cliente de /api: devuelve siempre { estado, cuerpo }, sin lanzar por un error de dominio.
export function crearApi(fetchFn = (...args) => fetch(...args)) {
  async function llamar(metodo, ruta, cuerpo) {
    try {
      const r = await fetchFn(ruta, {
        method: metodo,
        credentials: 'same-origin',
        headers: cuerpo === undefined ? {} : { 'Content-Type': 'application/json' },
        body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      });
      let datos = {};
      try { datos = await r.json(); } catch { /* sin cuerpo */ }
      return { estado: r.status, cuerpo: datos };
    } catch {
      return { estado: 0, cuerpo: { error: { codigo: 'E_RED', mensaje: null } } };
    }
  }
  return {
    entrar: (correo, contrasena) => llamar('POST', '/api/entrar', { correo, contrasena }),
    salir: () => llamar('POST', '/api/salir'),
    listarMaterial: () => llamar('GET', '/api/material'),
    anadirUnidades: (nombre, cantidad) => llamar('POST', '/api/material', { nombre, cantidad }),
    retirarUnidades: (id, cantidad) => llamar('POST', `/api/material/${encodeURIComponent(id)}/retirar`, { cantidad }),
    reservar: (datos) => llamar('POST', '/api/reservas', datos),
    misReservas: () => llamar('GET', '/api/mis-reservas'),
    cancelarReserva: (id) => llamar('POST', `/api/reservas/${encodeURIComponent(id)}/cancelar`, {}),
    panel: (fecha) => llamar('GET', fecha === undefined ? '/api/panel' : `/api/panel?fecha=${encodeURIComponent(fecha)}`),
    entregar: (id) => llamar('POST', `/api/reservas/${encodeURIComponent(id)}/entregar`, {}),
    devolver: (id) => llamar('POST', `/api/reservas/${encodeURIComponent(id)}/devolver`, {}),
    misMultas: () => llamar('GET', '/api/mis-multas'),
    listarMultas: () => llamar('GET', '/api/multas'),
    pagarMulta: (id) => llamar('POST', `/api/multas/${encodeURIComponent(id)}/pagar`, {}),
    listarSocios: () => llamar('GET', '/api/socios'),
    altaSocio: (datos) => llamar('POST', '/api/socios', datos),
    restablecerSocio: (id, contrasena) => llamar('PUT', `/api/socios/${encodeURIComponent(id)}/contrasena`, { contrasena }),
    bajaSocio: (id) => llamar('POST', `/api/socios/${encodeURIComponent(id)}/baja`, {}),
    cambiarContrasena: (contrasena) => llamar('PUT', '/api/cuenta/contrasena', { contrasena }),
    historial: ({ q, id }) => llamar('GET', `/api/historial?${id !== undefined ? `id=${encodeURIComponent(id)}` : `q=${encodeURIComponent(q ?? '')}`}`),
    autorizarPagina: (pagina) => llamar('GET', `/api/sesion?pagina=${encodeURIComponent(pagina)}`),
  };
}
