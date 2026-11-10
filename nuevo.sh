#!/usr/bin/env bash
# Proyecto NUEVO: carpeta con git, AGENTS.md del stack elegido, la petición literal en intent/ y lanzar.sh iniciar
# (crea el tablero del kanban y la primera tarjeta). Lo mismo que el botón «Nuevo» de la pestaña SDD o /nuevo.
#
#   nuevo.sh <nombre> "<qué quieres construir>" [--stack ID] [--carpeta DIR] [--jev MODO]
#   nuevo.sh stacks                                  stacks disponibles (* = el de por defecto)
#   nuevo.sh config [--carpeta DIR] [--stack-defecto ID] [--deshacer SEGUNDOS] [--deshacer-jev SEGUNDOS]
#                                                    ver o cambiar carpeta, stack por defecto y ventana para deshacer
#
# Sin --carpeta, el proyecto va a la carpeta por defecto (~/proyectos-sdd si no la cambias): <carpeta>/<nombre>.
# Los stacks se editan en la pestaña SDD → Configuración (o en ~/.hermes/hermes-sdd/sdd.json).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
PY="$ROOT/plugin/hermes-sdd/hsdd_proyectos.py"
case "${1:-}" in
  ""|-h|--help) sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
  stacks|config) exec python3 "$PY" "$@" ;;
  *) exec python3 "$PY" nuevo "$@" ;;
esac
