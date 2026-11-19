"""hermes-sdd — canal Telegram de las puertas del método.

El canal no decide ni firma: (1) publica cada puerta abierta con botones, (2) convierte un toque de una persona
autorizada en una decisión normalizada (fichero en el repo), (3) deja una ventana para deshacer y (4) lanza el
notario (``firmar.sh``), que valida y firma. La identidad sale del update de Telegram (``from.id``), no de un texto.

Estado en disco, compartido con el resto del arnés (``$HERMES_SDD_HOME``, por defecto ``~/.hermes/hermes-sdd``):
  puertas/<id>.json     índice de puertas (lo escribe puerta.sh; aquí se añade ``telegram`` y ``estado``)
  aprobadores.json      personas autorizadas y su id por canal
  instalacion.json      {"root": "<ruta del arnés instalado>"}
  avisos.json           fallos de etapa ya avisados (para avisar una sola vez)
  pendientes.json       respuestas de texto que se esperan (motivo de ❌ Rechazar…)
  reintentos.json       reintentos automáticos de etapas perdidas por el kanban
Todo lo que se lee-modifica-escribe pasa por ``N.actualizar`` (cerrojo entre hilos y procesos).

Este fichero es solo el pegamento: carga las bibliotecas compartidas y las partes, y ``register(ctx)``.
  kanban.py           cliente del kanban y de los scripts del arnés por su CLI (``_cli``, ``_proyectos``…)
  canal_telegram.py   render de las puertas, envío y edición de mensajes, handlers de botones y respuestas
  bucle.py            el bucle del gateway (una vuelta cada 5 s), firmar, Jev en cada puerta, un solo bucle (candado)
  vigia.py            lo periódico: etapas paradas, perdidas o sin latido, cuota, mensaje vivo, resúmenes, mantenimiento
  operacion.py        estado de los proyectos, resumen periódico, tema del encargado, reenviar las puertas
  comandos.py         las órdenes (/nuevo, /estado, /puertas, /cambio, /jev…)
Cada parte se carga de nuevo con cada carga del plugin (``hsdd_carga.parte``) y recibe ``P``: una vista viva de este
módulo. Las partes se llaman entre sí por ``P`` (``P._proyectos()``), y lo mismo hacen con lo que sale del proceso
(kanban, Jev, tareas del bucle): así una pieza se sustituye en un solo sitio (``plugin._cli = falso`` en las pruebas)
y la ven todas. Los nombres de cada parte (su ``__all__``) se reexportan aquí con el mismo nombre que tenían.
Lo que vive mientras el plugin está cargado (app de Telegram, bucle, hilo, candado) está en ``_RT`` (``bucle.Vivo``).
"""
from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

# Dentro del gateway, /nuevo, /preparar y /encargado crean el tema «🧭 proyecto» con su bot tras `encargado.sh crear`;
# crear no debe crear otro (fuera del gateway, por línea de órdenes, sí lo crea: sin tema el encargado no avisa)
os.environ.setdefault("HERMES_SDD_SIN_TEMA", "1")

log = logging.getLogger("hermes_plugins.hermes_sdd")   # este prefijo llega a gateway.log
_DIR = Path(__file__).resolve().parent


def _hsdd_carga():
    """El cargador de módulos del plugin (hsdd_carga.py). Es lo único que se carga a mano: ni Hermes ni las pruebas
    ponen este directorio en ``sys.path``."""
    if "hsdd_carga" not in sys.modules:
        import importlib.util
        spec = importlib.util.spec_from_file_location("hsdd_carga", _DIR / "hsdd_carga.py")
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); sys.modules["hsdd_carga"] = mod
    return sys.modules["hsdd_carga"]


C = _hsdd_carga()
# ── bibliotecas compartidas con el panel y los scripts (una copia por proceso) ──────────────────────────────────────
N = C.hermano("hsdd_nucleo", _DIR)        # validación, decisión, deshacer y cerrojo entre procesos
PR = C.hermano("hsdd_proyectos", _DIR)
PL = C.hermano("hsdd_lecciones", _DIR)
TX = C.hermano("hsdd_textos", _DIR)
HOME = N.HOME
_leer, _escribir, _ahora, _respuestas = N.leer, N.escribir, N.ahora, N.respuestas

# ── partes del plugin (una copia por carga) y sus nombres, aquí ─────────────────────────────────────────────────────
P = C.Vista(globals())
# En este orden: al cargarse, cada parte toma de P lo que ya han dejado las anteriores (PATH_CMDS, de kanban.py)
for _nombre in ("kanban", "canal_telegram", "bucle", "vigia", "operacion", "comandos"):
    _parte = C.parte(__name__, _DIR / f"{_nombre}.py", P=P)
    globals().update({n: getattr(_parte, n) for n in _parte.__all__})
    globals()[_nombre] = _parte
del _nombre, _parte

_RT = P.Vivo()   # lo que vive mientras el plugin está cargado (bucle.py)


# ── registro ────────────────────────────────────────────────────────────────────────────────────────────────────
def register(ctx):
    ctx.register_telegram_handler(P._enganchar)
    # Bucle de las puertas también sin Telegram (firma de lo decidido en el panel, Jev, reintentos, cuota): ver _arrancar_bucle
    if hasattr(ctx, "on_unload"):
        ctx.on_unload(P._parar_bucle)
    try:
        log.info("hermes-sdd: arranque del bucle: %s", P._arrancar_bucle())
    except Exception:
        log.exception("hermes-sdd: no se pudo arrancar el bucle desde el registro (lo hará Telegram si engancha)")
    for nombre, fn, descripcion, args in P.ORDENES:   # comandos.py
        ctx.register_command(nombre, fn, description=descripcion, **({"args_hint": args} if args else {}))

    # El encargado de cada proyecto (perfil sdd-p-<proyecto>, encargado.sh): al abrir una sesión encuentra en su prompt
    # la foto de su proyecto y lo que pasó desde su última sesión (Hermes congela la sección por sesión)
    def _foto_encargado(info) -> str:
        perfil = str((info or {}).get("profile_name") or "")
        if not perfil.startswith("sdd-p-"):
            return ""
        try:
            return PR.foto_encargado(perfil)
        except Exception as e:   # nunca romper el prompt del perfil por un fallo de la foto
            log.warning("hermes-sdd: foto del encargado %s: %s", perfil, e)
            return ""
    if hasattr(ctx, "register_system_prompt_section"):
        ctx.register_system_prompt_section("hermes-sdd.encargado", _foto_encargado, max_chars=4000)
