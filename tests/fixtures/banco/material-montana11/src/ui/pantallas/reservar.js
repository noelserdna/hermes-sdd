import { TEXTOS, textoReservaCreada, textoLibres } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { MATERIAL_TYPES } from '../../domain/constantes.js';
import { pantallaProhibido } from './prohibido.js';

// Qué campo señala cada error de fecha (SCR-002): el resto va en el aviso general.
const CAMPO_DE_ERROR = { E_FECHA_PASADA: 'inicio', E_FECHAS_INVERTIDAS: 'fin', E_RESERVA_MUY_LARGA: 'fin' };

function fila(id, etiqueta, control) {
  const div = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = id; label.textContent = etiqueta;
  control.id = id; control.name = id;
  const zonaError = document.createElement('div');
  div.append(label, control, zonaError);
  return { div, control, zonaError };
}

/** UC-005 / SCR-002: disponibilidad por tipo para unas fechas y formulario de reserva (inicio del socio). */
export function pantallaReservar({ contenedor, usuario, api }) {
  if (usuario.rol !== 'socio') return pantallaProhibido({ contenedor, usuario });
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.materialDisponible;
  const zonaAviso = document.createElement('div');

  const select = document.createElement('select');
  for (const t of MATERIAL_TYPES) {
    const opcion = document.createElement('option');
    opcion.value = t; opcion.textContent = t;
    select.append(opcion);
  }
  const fechaInicio = document.createElement('input'); fechaInicio.type = 'date';
  const fechaFin = document.createElement('input'); fechaFin.type = 'date';
  const campos = { material: fila('material', TEXTOS.material, select), inicio: fila('inicio', TEXTOS.inicio, fechaInicio), fin: fila('fin', TEXTOS.fin, fechaFin) };
  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = TEXTOS.reservar;
  const form = document.createElement('form');
  form.noValidate = true;
  form.append(campos.material.div, campos.inicio.div, campos.fin.div, boton);

  const zonaDisponibilidad = document.createElement('section');

  function limpiarErrores() {
    mostrarAviso(zonaAviso, 'error', '');
    for (const c of [campos.inicio, campos.fin]) {
      mostrarAviso(c.zonaError, 'error', '');
      c.control.removeAttribute('aria-invalid');
      c.control.removeAttribute('aria-describedby');
    }
  }

  function mostrarError(e) {
    const texto = e.message ?? mensajeError(e.codigo);
    const campo = campos[CAMPO_DE_ERROR[e.codigo]];
    if (!campo) return mostrarAviso(zonaAviso, 'error', texto);
    mostrarAviso(campo.zonaError, 'error', texto);
    const alerta = campo.zonaError.querySelector('[role="alert"]');
    alerta.id = `error-${campo.control.id}`;
    campo.control.setAttribute('aria-invalid', 'true');
    campo.control.setAttribute('aria-describedby', alerta.id);
    return undefined;
  }

  let consulta = 0;   // descarta respuestas de una consulta anterior si el socio ya cambió las fechas
  async function refrescarDisponibilidad() {
    const inicio = fechaInicio.value; const fin = fechaFin.value;
    const esta = ++consulta;
    if (!inicio || !fin) { zonaDisponibilidad.replaceChildren(Object.assign(document.createElement('p'), { textContent: TEXTOS.elegirFechas })); return; }
    try {
      const respuestas = await Promise.all(MATERIAL_TYPES.map((m) => api.consultarDisponibilidad(m, inicio, fin)));
      if (esta !== consulta) return;
      const cabecera = document.createElement('h2');
      cabecera.textContent = TEXTOS.disponibilidad;
      const dl = document.createElement('dl');
      for (const r of respuestas) {
        const dt = document.createElement('dt'); dt.textContent = r.material;
        const dd = document.createElement('dd'); dd.textContent = textoLibres(r.libres);
        dl.append(dt, dd);
      }
      zonaDisponibilidad.replaceChildren(cabecera, dl);
    } catch (e) {
      if (esta === consulta) zonaDisponibilidad.replaceChildren(Object.assign(document.createElement('p'), { textContent: e.message ?? mensajeError(e.codigo) }));
    }
  }
  fechaInicio.addEventListener('change', refrescarDisponibilidad);
  fechaFin.addEventListener('change', refrescarDisponibilidad);

  let enviando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    enviando = true;
    boton.disabled = true;
    limpiarErrores();
    try {
      const r = await api.reservarMaterial(select.value, fechaInicio.value, fechaFin.value);
      mostrarAviso(zonaAviso, 'exito', textoReservaCreada(r.material, r.inicio, r.fin));
    } catch (e) {
      mostrarError(e);
    } finally {
      enviando = false;
      boton.disabled = false;
    }
    await refrescarDisponibilidad();
  });

  contenedor.replaceChildren(titulo, zonaAviso, form, zonaDisponibilidad);
  return refrescarDisponibilidad();
}
