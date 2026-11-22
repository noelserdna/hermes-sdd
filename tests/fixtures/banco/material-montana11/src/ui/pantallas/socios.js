import { TEXTOS, textoConfirmarBajaSocio } from '../textos.js';
import { mensajeError } from '../errores.js';
import { mostrarAviso } from '../componentes/aviso.js';
import { crearConfirmar } from '../componentes/confirmar.js';
import { pantallaProhibido } from './prohibido.js';

function campo(id, etiqueta, tipo, autocompletar) {
  const fila = document.createElement('div');
  const label = document.createElement('label');
  label.htmlFor = id;
  label.textContent = etiqueta;
  const input = document.createElement('input');
  input.id = id; input.name = id; input.type = tipo; input.autocomplete = autocompletar;
  fila.append(label, input);
  return { fila, input };
}

function tabla(socios) {
  const t = document.createElement('table');
  t.setAttribute('aria-label', TEXTOS.socios);
  const cabecera = t.createTHead().insertRow();
  for (const titulo of [TEXTOS.columnaNombre, TEXTOS.columnaCorreo, TEXTOS.columnaEstado]) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = titulo;
    cabecera.append(th);
  }
  const cuerpo = t.createTBody();
  for (const s of socios) {
    const fila = cuerpo.insertRow();
    fila.insertCell().textContent = s.nombre;
    fila.insertCell().textContent = s.correo;
    fila.insertCell().textContent = s.estado === 'Baja' ? TEXTOS.estadoBaja : TEXTOS.estadoActiva;
  }
  return t;
}

/** UC-003: lista de socios y alta (solo el encargado; el servidor decide con E_ACCESO_NO_PERMITIDO). */
export async function pantallaSocios({ contenedor, usuario, api }) {
  const titulo = document.createElement('h1');
  titulo.textContent = TEXTOS.socios;
  const zonaAviso = document.createElement('div');
  zonaAviso.tabIndex = -1;
  const zonaLista = document.createElement('div');

  const zonaAcciones = document.createElement('div');

  /** Botón por socio Activa; las acciones salen bajo la tabla, no en la fila (Q-task-implementer-003). */
  function listaAcciones(socios) {
    const ul = document.createElement('ul');
    ul.setAttribute('aria-label', TEXTOS.acciones);
    for (const s of socios.filter((x) => x.estado !== 'Baja')) {
      const li = document.createElement('li');
      const nombre = document.createElement('span');
      nombre.textContent = s.nombre;
      nombre.id = `socio-${s.id}`;
      // El nombre del socio es la descripción de sus botones, no su nombre accesible: un aria-label con «contraseña»
      // haría que getByLabel('Contraseña') (el campo del alta) encontrara también estos botones.
      const restablecer = crearBoton(TEXTOS.restablecerContrasena, nombre.id);
      const baja = crearBoton(TEXTOS.darDeBaja, nombre.id);
      restablecer.addEventListener('click', () => abrirRestablecer(s, li, restablecer));
      baja.addEventListener('click', () => abrirBaja(s, baja));
      li.append(nombre, ' ', restablecer, ' ', baja);
      ul.append(li);
    }
    return ul;
  }

  function crearBoton(texto, descripcionId) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = texto; b.setAttribute('aria-describedby', descripcionId);
    return b;
  }

  const textoDe = (e) => e.message ?? mensajeError(e.codigo);

  // «Restablecer contraseña»: un campo «Nueva contraseña» en línea; la clave nunca se pinta tras guardar.
  function abrirRestablecer(s, li, abrir) {
    const form = document.createElement('form');
    form.noValidate = true;
    const nuevo = campo(`nueva-contrasena-${s.id}`, TEXTOS.nuevaContrasena, 'password', 'new-password');
    nuevo.input.name = 'nueva-contrasena';
    const guardar = document.createElement('button');
    guardar.type = 'submit'; guardar.textContent = TEXTOS.guardarContrasena;
    const cancelar = document.createElement('button');
    cancelar.type = 'button'; cancelar.textContent = TEXTOS.cancelar;
    form.append(nuevo.fila, guardar, ' ', cancelar);
    const cerrar = () => { form.replaceWith(abrir); abrir.focus(); };
    cancelar.addEventListener('click', () => { mostrarAviso(zonaAviso, 'error', ''); cerrar(); });
    let enviando = false;
    form.addEventListener('submit', async (evento) => {
      evento.preventDefault();
      if (enviando) return;
      enviando = true; guardar.disabled = true;
      mostrarAviso(zonaAviso, 'error', '');
      try {
        await api.restablecerContrasena(s.id, nuevo.input.value);
        mostrarAviso(zonaAviso, 'exito', TEXTOS.contrasenaRestablecida);
        cerrar();
      } catch (e) {
        mostrarAviso(zonaAviso, 'error', textoDe(e));
        nuevo.input.focus();
      } finally {
        enviando = false; guardar.disabled = false;
      }
    });
    abrir.replaceWith(form);
    nuevo.input.focus();
  }

  // «Dar de baja»: confirmación en línea (mol-confirm de FASE-1).
  function abrirBaja(s, baja) {
    const cerrar = () => { confirmar.elemento.replaceWith(baja); baja.focus(); };
    const confirmar = crearConfirmar({
      pregunta: textoConfirmarBajaSocio(s.nombre), textoSi: TEXTOS.confirmarBajaSi, textoNo: TEXTOS.confirmarNo,
      alSi: async () => {
        confirmar.elemento.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        mostrarAviso(zonaAviso, 'error', '');
        try {
          await api.darDeBajaSocio(s.id);
        } catch (e) {
          mostrarAviso(zonaAviso, 'error', textoDe(e));
          cerrar();
          return;
        }
        try { await cargarLista(); } catch { /* la lista anterior se queda */ }
        zonaAviso.focus();   // el botón ya no existe: el foco va al aviso
      },
      alNo: cerrar,
    });
    baja.replaceWith(confirmar.elemento);
    confirmar.enfocar();
  }

  async function cargarLista() {
    const socios = await api.listarSocios();
    zonaLista.replaceChildren(tabla(socios));
    zonaAcciones.replaceChildren(listaAcciones(socios));
  }

  try {
    await cargarLista();
  } catch (e) {
    if (e.codigo === 'E_ACCESO_NO_PERMITIDO') return pantallaProhibido({ contenedor, usuario });
    contenedor.replaceChildren(titulo);
    mostrarAviso(zonaAviso, 'error', e.message ?? mensajeError(e.codigo));
    contenedor.append(zonaAviso);
    return undefined;
  }

  const form = document.createElement('form');
  form.noValidate = true;
  const nombre = campo('nombre', TEXTOS.nombre, 'text', 'off');
  const correo = campo('correo', TEXTOS.correo, 'email', 'off');
  const contrasena = campo('contrasena', TEXTOS.contrasena, 'password', 'new-password');
  const boton = document.createElement('button');
  boton.type = 'submit';
  boton.textContent = TEXTOS.crearSocio;
  form.append(nombre.fila, correo.fila, contrasena.fila, boton);

  let enviando = false;
  form.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;
    enviando = true;
    boton.disabled = true;
    mostrarAviso(zonaAviso, 'error', '');
    try {
      await api.crearSocio(nombre.input.value, correo.input.value, contrasena.input.value);
      await cargarLista();
      mostrarAviso(zonaAviso, 'exito', TEXTOS.socioCreado);
      form.reset();
    } catch (e) {
      mostrarAviso(zonaAviso, 'error', e.message ?? mensajeError(e.codigo));
    } finally {
      enviando = false;
      boton.disabled = false;
    }
  });

  contenedor.replaceChildren(titulo, form, zonaAviso, zonaLista, zonaAcciones);
  return undefined;
}
