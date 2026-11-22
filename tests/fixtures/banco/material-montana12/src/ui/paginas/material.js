// SCR-008 · UC-015 y UC-016: lista de tipos con su total, añadir unidades, dar de baja (con confirmación) y tipo nuevo.
import { el, zonaMensajes } from '../componentes.js';

const entero = (texto) => (String(texto).trim() === '' ? null : Number(texto));

export async function paginaMaterial({ api, T }) {
  const mensajes = zonaMensajes();
  const lista = el('ul', { 'aria-label': T.material, class: 'material' });
  let confirmando = null;   // { id } del tipo cuya baja espera confirmación

  const respuesta = (r, linea) => {
    if (r.estado === 200) {
      pintar(r.cuerpo.material);
      mensajes.aviso(linea(r.cuerpo.material));
    } else {
      mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
    }
  };

  async function anadir(nombre, cantidad) {
    const r = await api.anadirUnidades(nombre, cantidad);
    respuesta(r, (filas) => { const t = filas.find((m) => m.nombre.toLowerCase() === String(nombre).trim().toLowerCase()); return T.fila(t.nombre, t.total); });
  }

  async function retirar(tipo, cantidad) {
    confirmando = null;
    const r = await api.retirarUnidades(tipo.id, cantidad);
    respuesta(r, (filas) => { const t = filas.find((m) => m.id === tipo.id); return T.fila(t.nombre, t.total); });
    if (r.estado !== 200) pintar(null);
  }

  let ultimas = [];
  function pintar(filas) {
    if (filas) ultimas = filas;
    lista.replaceChildren(...ultimas.map((tipo) => {
      const campo = el('input', { id: `cantidad-${tipo.id}`, type: 'number', inputmode: 'numeric', 'aria-describedby': `texto-${tipo.id}` });
      const baja = el('button', {
        type: 'button',
        onclick: () => {
          const n = entero(campo.value);
          if (Number.isInteger(n) && n >= 1) { confirmando = { id: tipo.id, n }; pintar(null); } else retirar(tipo, n);
        },
      }, T.darDeBaja);
      const confirmar = confirmando?.id === tipo.id
        ? el('p', { class: 'confirmar', role: 'group' }, T.confirmarBaja(confirmando.n, tipo.nombre),
          el('button', { type: 'button', onclick: () => retirar(tipo, confirmando.n) }, T.confirmar),
          el('button', { type: 'button', onclick: () => { confirmando = null; pintar(null); } }, T.cancelar))
        : '';
      return el('li', {},
        el('span', { id: `texto-${tipo.id}` }, T.fila(tipo.nombre, tipo.total)),
        el('form', { onsubmit: (e) => { e.preventDefault(); anadir(tipo.nombre, entero(campo.value)); } },
          el('label', { for: `cantidad-${tipo.id}` }, T.cantidadDe(tipo.nombre)), campo,
          el('button', { type: 'submit' }, T.anadir), baja),
        confirmar);
    }));
  }

  const nombre = el('input', { id: 'nombre-nuevo', type: 'text', autocomplete: 'off' });
  const unidades = el('input', { id: 'unidades-nuevo', type: 'number', inputmode: 'numeric' });
  const nuevo = el('form', {
    class: 'tipo-nuevo',
    onsubmit: async (e) => { e.preventDefault(); await anadir(nombre.value, entero(unidades.value)); },
  },
  el('h2', {}, T.tipoNuevo),
  el('label', { for: 'nombre-nuevo' }, T.nombre), nombre,
  el('label', { for: 'unidades-nuevo' }, T.unidades), unidades,
  el('button', { type: 'submit' }, T.anadirTipo));

  const r = await api.listarMaterial();
  if (r.estado === 200) pintar(r.cuerpo.material); else mensajes.error(r.cuerpo?.error?.mensaje ?? T.errorRed);
  return el('main', {}, el('h1', {}, T.material), mensajes.zona, lista, nuevo);
}
