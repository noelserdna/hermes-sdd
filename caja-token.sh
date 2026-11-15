#!/usr/bin/env bash
# Guarda el token de Claude Code de la caja de GitHub, sin mostrarlo nunca:
#   1. lo toma del portapapeles (copia antes solo la cadena sk-ant-oat01-… que da «claude setup-token»);
#   2. comprueba que tiene forma de token;
#   3. lo guarda en el llavero de macOS (servicio hermes-sdd-caja), de donde lo copian los proyectos nuevos;
#   4. y, si se nombran repos, lo pone ya como secreto de Actions en cada uno.
#
#   caja-token.sh [dueño/repo ...]
set -uo pipefail
command -v pbpaste >/dev/null && command -v security >/dev/null || { echo "Esto es para macOS (pbpaste y security)"; exit 1; }
TOKEN=$(pbpaste | tr -d '[:space:]')
if ! printf '%s' "$TOKEN" | grep -qE '^sk-ant-oat[0-9]+-[A-Za-z0-9_-]{40,}$'; then
  echo "En el portapapeles no hay un token de Claude Code (tiene ${#TOKEN} caracteres y no empieza por sk-ant-oat01-)."
  echo "Ejecuta «claude setup-token», copia SOLO la cadena sk-ant-oat01-… y vuelve a lanzar esto."
  exit 1
fi
# -w sin valor no vale aquí (lo pediría por teclado); el valor va por argumento un instante y no se imprime
security add-generic-password -U -s hermes-sdd-caja -a claude -w "$TOKEN" >/dev/null 2>&1 ||
  { echo "No se pudo guardar en el llavero"; exit 1; }
[ "$(security find-generic-password -s hermes-sdd-caja -w 2>/dev/null | tr -d '[:space:]')" = "$TOKEN" ] ||
  { echo "El llavero no devuelve lo que se guardó"; exit 1; }
echo "✓ Token guardado en el llavero (${#TOKEN} caracteres, empieza por sk-ant-oat01-)"
for r in "$@"; do
  if printf '%s' "$TOKEN" | gh secret set CLAUDE_CODE_OAUTH_TOKEN -R "$r" >/dev/null 2>&1; then echo "✓ Puesto en $r"
  else echo "✗ No se pudo poner en $r (¿existe y tienes permiso?)"; fi
done
unset TOKEN
printf '' | pbcopy   # el portapapeles ya no lo guarda
echo "✓ Portapapeles vaciado"
