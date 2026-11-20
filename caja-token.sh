#!/usr/bin/env bash
# Guarda el token de Claude Code de la caja (local y de GitHub), sin mostrarlo nunca:
#   1. lo toma del portapapeles en macOS; en Linux/WSL, de la entrada estándar o, si es un terminal, te lo pide sin
#      que se vea al pegarlo (copia antes solo la cadena sk-ant-oat01-… que da «claude setup-token»);
#   2. comprueba que tiene forma de token;
#   3. lo guarda: en macOS, en el llavero (servicio hermes-sdd-caja); en Linux, en ~/.hermes/hermes-sdd/caja-token (600)
#      (lib/token-caja.sh). De ahí lo toman la caja local y los proyectos nuevos de GitHub;
#   4. y, si se nombran repos, lo pone ya como secreto de Actions en cada uno.
#
#   caja-token.sh [dueño/repo ...]
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/lib/token-caja.sh"
if token_caja_llavero; then
  command -v pbpaste >/dev/null || { echo "Falta pbpaste"; exit 1; }
  TOKEN=$(pbpaste | tr -d '[:space:]'); DE="el portapapeles"
elif [ -t 0 ]; then
  read -rsp "Pega el token (sk-ant-oat01-…; no se verá) y pulsa Intro: " TOKEN; echo; TOKEN=$(printf '%s' "$TOKEN" | tr -d '[:space:]'); DE="lo pegado"
else
  TOKEN=$(tr -d '[:space:]'); DE="la entrada"
fi
if ! printf '%s' "$TOKEN" | grep -qE "$TOKEN_CAJA_FORMA"; then
  echo "En $DE no hay un token de Claude Code (tiene ${#TOKEN} caracteres y no empieza por sk-ant-oat01-)."
  token_caja_ayuda
  exit 1
fi
token_caja_guardar "$TOKEN" || { echo "No se pudo guardar en $(token_caja_donde)"; exit 1; }
echo "✓ Token guardado en $(token_caja_donde) (${#TOKEN} caracteres, empieza por sk-ant-oat01-)"
for r in "$@"; do
  if printf '%s' "$TOKEN" | gh secret set CLAUDE_CODE_OAUTH_TOKEN -R "$r" >/dev/null 2>&1; then echo "✓ Puesto en $r"
  else echo "✗ No se pudo poner en $r (¿existe y tienes permiso?)"; fi
done
unset TOKEN
if token_caja_llavero; then printf '' | pbcopy; echo "✓ Portapapeles vaciado"; fi
