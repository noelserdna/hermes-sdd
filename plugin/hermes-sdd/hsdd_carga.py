"""Carga de los módulos del plugin por su fichero (el único sitio que lo hace).

Hermes carga el plugin desde su directorio con importlib (``hermes_plugins.<slug>``), el panel carga
``dashboard/plugin_api.py`` suelto y las pruebas cargan ``__init__.py`` también suelto, sin paquete: ninguno pone este
directorio en ``sys.path``, así que ``import hsdd_nucleo`` no funcionaría.

  hermano(nombre)          una biblioteca compartida ``hsdd_*.py`` (núcleo, proyectos, lecciones, textos): una sola
                           copia por proceso, registrada en ``sys.modules`` con su nombre (la comparten el canal de
                           Telegram, el panel y los scripts; el cerrojo y el estado en disco son los mismos).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent


def _ejecutar(nombre: str, ruta: Path):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def hermano(nombre: str, carpeta: Path | None = None):
    """La biblioteca compartida ``<nombre>.py`` (de `carpeta`, o de la de este módulo): una vez por proceso."""
    if nombre not in sys.modules:
        sys.modules[nombre] = _ejecutar(nombre, Path(carpeta or DIR) / f"{nombre}.py")
    return sys.modules[nombre]
