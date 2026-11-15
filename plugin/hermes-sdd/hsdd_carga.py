"""Carga de los módulos del plugin por su fichero (el único sitio que lo hace).

Hermes carga el plugin desde su directorio con importlib (``hermes_plugins.<slug>``), el panel carga
``dashboard/plugin_api.py`` suelto y las pruebas cargan ``__init__.py`` también suelto, sin paquete: ninguno pone este
directorio en ``sys.path``, así que ``import hsdd_nucleo`` no funcionaría. Dos clases de módulo:

  hermano(nombre)          una biblioteca compartida ``hsdd_*.py`` (núcleo, proyectos, lecciones, textos): una sola
                           copia por proceso, registrada en ``sys.modules`` con su nombre (la comparten el canal de
                           Telegram, el panel y los scripts; el cerrojo y el estado en disco son los mismos).
  parte(paquete, ruta)     una parte del plugin (canal_telegram.py, bucle.py…): una copia por carga del plugin, con
                           nombre ``<paquete>.<parte>``; así cada carga tiene su propio estado y Hermes, al descargar
                           ``hermes_plugins.<slug>``, se lleva también sus partes. La ruta la da quien carga (su propia
                           carpeta), no este módulo: el que quedó en ``sys.modules`` puede venir de otra instalación.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

DIR = Path(__file__).resolve().parent


def _ejecutar(nombre: str, ruta: Path, globales: dict | None = None, registrar: bool = False):
    spec = importlib.util.spec_from_file_location(nombre, ruta)
    mod = importlib.util.module_from_spec(spec)
    mod.__dict__.update(globales or {})   # lo que la parte necesita antes de ejecutarse (P: el plugin que la carga)
    if registrar:   # en sys.modules ya al ejecutarse, como un import normal (dataclasses busca ahí su módulo)
        sys.modules[nombre] = mod
    try:
        spec.loader.exec_module(mod)
    except BaseException:
        if registrar:
            sys.modules.pop(nombre, None)
        raise
    return mod


def hermano(nombre: str, carpeta: Path | None = None):
    """La biblioteca compartida ``<nombre>.py`` (de `carpeta`, o de la de este módulo): una vez por proceso."""
    if nombre not in sys.modules:
        sys.modules[nombre] = _ejecutar(nombre, Path(carpeta or DIR) / f"{nombre}.py")
    return sys.modules[nombre]


def parte(paquete: str, ruta: Path, **globales):
    """La parte del plugin en `ruta`, como ``<paquete>.<nombre del fichero>``; nueva en cada carga (no se reutiliza).
    `globales` quedan definidos en el módulo antes de ejecutarlo."""
    return _ejecutar(f"{paquete}.{Path(ruta).stem}", Path(ruta), globales, registrar=True)


class Vista:
    """Vista viva de los nombres de un módulo: ``Vista(globals()).x`` es siempre el ``x`` actual del módulo, también si
    alguien lo sustituye después (``plugin._cli = falso`` en una prueba). Hace falta porque las pruebas cargan
    ``__init__.py`` sin registrarlo en ``sys.modules`` y el módulo no tiene otra forma de nombrarse a sí mismo."""

    def __init__(self, globales: dict):
        self.__dict__ = globales
