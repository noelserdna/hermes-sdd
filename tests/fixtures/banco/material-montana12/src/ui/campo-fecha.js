// Campo de fecha en día/mes/año (REQ-C-001). El navegador pinta <input type="date"> con el formato de su idioma (mm/dd/yyyy en inglés)
// y la página no puede cambiarlo, así que el campo es de texto: se escribe «05/12/2026», se enseña así y al servidor le llega AAAA-MM-DD.
import { el } from './componentes.js';

const DIA_MES_ANYO = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** «05/12/2026» → «2026-12-05». Un AAAA-MM-DD pasa igual; lo demás se deja tal cual para que el servidor lo rechace. */
export function aIso(texto) {
  const t = String(texto ?? '').trim();
  const m = DIA_MES_ANYO.exec(t);
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : t;
}

/** «2026-12-05» → «05/12/2026»; lo que no es un AAAA-MM-DD se deja como está. */
export function aVisible(texto) {
  const m = ISO.exec(String(texto ?? '').trim());
  return m ? `${m[3]}/${m[2]}/${m[1]}` : texto;
}

export function campoFecha(atributos = {}) {
  const campo = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', placeholder: 'dd/mm/aaaa', ...atributos });
  campo.addEventListener('change', () => { campo.value = aVisible(campo.value); });
  return campo;
}
