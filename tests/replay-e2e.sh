#!/usr/bin/env bash
# Reproduce la grabación todo-app de principio a fin (sin LLM ni kanban), decidiendo con el canal local.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home" HERMES_SDD_SIN_KANBAN=1; mkdir -p "$HERMES_SDD_HOME"
jq -n --arg u "$USER" '{yo:{nombre:"Alumna", rol:"Cliente", canales:{local:$u}}}' > "$HERMES_SDD_HOME/aprobadores.json"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/practica"; bash "$ROOT/practicar.sh" "$ROOT/grabaciones/todo-app" "$R" --sin-kanban >/dev/null || { echo "FAIL practicar"; exit 1; }
git -C "$R" config user.email a@a; git -C "$R" config user.name Alumna
paso() {  # paso <etapa> [fase] [verbo] — ejecuta la etapa y, si abre puerta, la decide
  local out p
  out=$(bash "$ROOT/etapa.sh" "$R" "$1" ${2:+$2} | tail -1)
  [ "$(echo "$out" | jq -r .outcome)" = done ] || { bad "etapa $1 ${2:-}: $(echo "$out" | jq -r .reason)"; return 1; }
  p=$(echo "$out" | jq -r '.puerta // empty')
  if [ -n "$p" ]; then
    bash "$ROOT/decidir.sh" "$p" "${3:-acepto}" >/dev/null 2>"$T/err" || { bad "puerta $1 ${2:-}: $(tail -1 "$T/err") [$(git -C "$R" status --porcelain | tr "\n" " ")]"; return 1; }
  fi
  ok "etapa $1 ${2:-}${p:+ → puerta firmada}"
}
paso requisitos "" acepto && paso ruta "" acepto && paso plan && paso tareas "" conforme || exit 1
for n in 0 1 2 3; do paso implementar $n && paso aceptar $n "" || break; done
paso cierre "" acepto
tags=$(git -C "$R" tag -l 'requirements-v*' 'fase-*-accepted' 'entrega-*' | tr '\n' ' ')
[ "$(echo $tags | wc -w | tr -d ' ')" = 6 ] && ok "tags: $tags" || bad "tags: $tags"
(cd "$R" && node "$ROOT/metodo/scripts/sdd.mjs" gate >/dev/null 2>&1) && ok "gate global en verde" || bad "gate global no se cumple"
exit $fail
