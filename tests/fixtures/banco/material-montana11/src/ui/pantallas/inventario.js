import { TEXTOS, textoRecuento, textoDarDeBajaUnidadDe, textoConfirmarBajaUnidad } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { crearConfirmar } from '../componentes/confirmar.js';
import { MATERIAL_TYPES } from '../../domain/constantes.js';
import { pantallaProhibido } from './prohibido.js';

function lista(inventario, alDarDeBaja) {
  const bloque = document.createElement('div');
  bloque.setAttribute('aria-label', TEXTOS.inventario);
  for (const { tipo, total, unidades } of inventario.tipos) {
    const seccion = document.createElement('section');
    const cabecera = document.createElement('h2');
    cabecera.textContent = textoRecuento(tipo, total);
    const ul = document.createElement('ul');
    for (const u of unidades) {
      const li = document.createElement('li');
      const texto = document.createElement('span');
      texto.textContent = `${tipo} ${u.numero} · ${u.estado === 'Alta' ? TEXTOS.estadoUnidadAlta : TEXTOS.estadoUnidadBaja}`;
      li.append(texto);
      if (u.estado === 'Alta') {
        const baja = document.createElement('button');
        baja.type = 'button'; baja.textContent = TEXTOS.darDeBaja;
        baja.setAttribute('aria-label', textoDarDeBajaUnidadDe(tipo, u.numero));
        baja.addEventListener('click', () => alDarDeBaja(tipo, u, baja));
        li.append(' ', baja);
      }
      ul.append(li);
    }
    seccion.append(cabecera, ...(unidades.length ? [ul] : []));
    bloque.append(seccion);
  }
  return bloque;
}

/** UC-013 / SCR-009: recuento por tipo y alta de unidades (solo el encargado; el servidor decide con E_ACCESO_NO_PERMITIDO). */
export async function pantallaInventario({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.inventario;
  const zonaLista = document.createElement('div');
  const zonaAviso = document.createElement('div');
  zonaAviso.tabIndex = -1;   // tras una baja el botón ya no existe: el foco va al aviso

  const textoDe = (e) => e.message ?? mensajeError(e.codigo);

  // «Dar de baja»: confirmación en línea (mol-confirm de FASE-1); el servidor decide (E_UNIDAD_PRESTADA).
  function pedirBaja(tipoUnidad, u, baja) {
    const cerrar = () => { confirmar.elemento.replaceWith(baja); baja.focus(); };
    const confirmar = crearConfirmar({
      pregunta: textoConfirmarBajaUnidad(tipoUnidad, u.numero), textoSi: TEXTOS.confirmarBajaUnidadSi, textoNo: TEXTOS.confirmarNo,
      alSi: async () => {
        confirmar.elemento.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        mostrarAviso(zonaAviso, 'error', '');
        let respuesta;
        try {
          respuesta = await api.darDeBajaUnidad(u.id);
        } catch (e) {
          mostrarAviso(zonaAviso, 'error', textoDe(e));
          cerrar();
          return;
        }
        zonaLista.replaceChildren(lista(respuesta.inventario, pedirBaja));
        if (respuesta.mensaje) mostrarAviso(zonaAviso, 'exito', respuesta.mensaje);
        zonaAviso.focus();
      },
      alNo: cerrar,
    });
    baja.replaceWith(confirmar.elemento);
    confirmar.enfocar();
  }

  async function cargar() {
    zonaLista.replaceChildren(lista(await api.listarInventario(), pedirBaja));
  }
  try {
    await cargar();
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    const zona = document.createElement('div');
    mostrarAviso(zona, 'error', e.message ?? mensajeError(e.codigo));
    contenedor.replaceChildren(titulo, zona);
    return undefined;
  }

  const form = document.createElement('form');
  form.noValidate = true;
  const filaTipo = document.createElement('div');
  const etiquetaTipo = document.createElement('label');
  etiquetaTipo.htmlFor = 'tipo'; etiquetaTipo.textContent = TEXTOS.tipo;
  const tipo = document.createElement('select');
  tipo.id = 'tipo'; tipo.name = 'tipo';
  for (const t of MATERIAL_TYPES) {
    const opcion = document.createElement('option');
    opcion.value = t; opcion.textContent = t;
    tipo.append(opcion);
  }
  filaTipo.append(etiquetaTipo, tipo);

  const filaCantidad = document.createElement('div');
  const etiquetaCantidad = document.createElement('label');
  etiquetaCantidad.htmlFor = 'cantidad'; etiquetaCantidad.textContent = TEXTOS.cantidad;
  const cantidad = document.createElement('input');
  cantidad.id = 'cantidad'; cantidad.name = 'cantidad'; cantidad.type = 'number'; cantidad.min = '1'; cantidad.step = '1'; cantidad.value = '1';
  const zonaError = document.createElement('div');
  filaCantidad.append(etiquetaCantidad, cantidad, zonaError);

  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = TEXTOS.anadir;
  form.append(filaTipo, filaCantidad, boton);

  function mostrarError(texto) {
    mostrarAviso(zonaError, 'error', texto);
    const alerta = zonaError.querySelector('[role="alert"]');
    if (alerta) { alerta.id = 'error-cantidad'; cantidad.setAttribute('aria-invalid', 'true'); cantidad.setAttribute('aria-describedby', alerta.id); }
    else { cantidad.removeAttribute('aria-invalid'); cantidad.removeAttribute('aria-describedby'); }
  }

  let enviando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    enviando = true;
    boton.disabled = true;
    mostrarError('');
    try {
      await api.anadirMaterial(tipo.value, cantidad.value === '' ? undefined : Number(cantidad.value));
      await cargar();
    } catch (e) {
      mostrarError(e.message ?? mensajeError(e.codigo));
    } finally {
      enviando = false;
      boton.disabled = false;
    }
  });

  contenedor.replaceChildren(titulo, zonaAviso, form, zonaLista);
  return undefined;
}
