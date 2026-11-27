#!/usr/bin/env bash
# CI: instala Hermes Agent de verdad (no un doble), en la versión que lib/comprobar-hermes.sh da por probada, para que
# tests/simulador.sh recorra el kanban real (decidido el 25-nov). Solo lo que necesita el kanban: sin gateway, sin
# Telegram y sin claves. Las dependencias salen del uv.lock de esa versión (--frozen), no de «la última» de PyPI.
# Deja `hermes` en ~/.local/bin (y en GITHUB_PATH) y el código en ~/.hermes/hermes-agent, como una instalación normal
# (lib/comprobar-hermes.sh mira ahí los internos que usa el plugin).
#
#   bash .github/scripts/instalar-hermes.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
read -r VERSION COMMIT < <(bash "$ROOT/lib/comprobar-hermes.sh" --probada)
SRC="$HOME/.hermes/hermes-agent"; VENV="$HOME/.hermes/hermes-venv"; BIN="$HOME/.local/bin"
t0=$(date +%s)
command -v uv >/dev/null || python3 -m pip install -q uv
mkdir -p "$HOME/.hermes" "$BIN"
git clone -q --depth 1 --branch "$VERSION" -c advice.detachedHead=false https://github.com/NousResearch/hermes-agent "$SRC"
got=$(git -C "$SRC" rev-parse HEAD)
[ "$got" = "$COMMIT" ] || { echo "ERROR: el tag $VERSION de Hermes apunta a $got, no a $COMMIT (el probado)" >&2; exit 1; }
(cd "$SRC" && UV_PROJECT_ENVIRONMENT="$VENV" uv sync --frozen --no-dev -q --python 3.14)
ln -sf "$VENV/bin/hermes" "$BIN/hermes"
# Sin esto, la primera orden de un Hermes clonado completa la «actualización» (TUI, web, chromium, cua-driver…):
# más de 2 min y descargas que el kanban no usa (hermes_cli/venv_sync.py, v0.23.1). El venv ya está al día.
export HERMES_DISABLE_LAZY_INSTALLS=1
[ -n "${GITHUB_PATH:-}" ] && echo "$BIN" >> "$GITHUB_PATH"
[ -n "${GITHUB_ENV:-}" ] && echo "HERMES_DISABLE_LAZY_INSTALLS=1" >> "$GITHUB_ENV"
"$BIN/hermes" --version | head -1
# el kanban funciona sin gateway ni claves: un tablero de usar y tirar
k=$(mktemp -d); HERMES_KANBAN_HOME="$k" "$BIN/hermes" kanban init >/dev/null
HERMES_KANBAN_HOME="$k" "$BIN/hermes" kanban list --json | jq -e 'type == "array"' >/dev/null || { echo "ERROR: el kanban de Hermes no responde" >&2; exit 1; }
rm -rf "$k"
echo "Hermes $VERSION (${COMMIT:0:12}) instalado en $(( $(date +%s) - t0 )) s"
