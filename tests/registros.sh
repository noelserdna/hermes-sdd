#!/usr/bin/env bash
# Lo que el ejecutor añade a los registros (incidente del 13/10/2026): una medición de la CLI que no pudo commitear la
# commitea el arnés; una decisión humana fabricada o un registro reescrito paran la etapa sin commitear nada.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home" HERMES_SDD_SIN_KANBAN=1; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/practica"; bash "$ROOT/practicar.sh" "$ROOT/grabaciones/todo-app" "$R" --sin-kanban >/dev/null
git -C "$R" config user.email a@a; git -C "$R" config user.name Alumna
jq '.ejecutores.plan = "../tests/ejecutor-falso"' "$R/.sdd/hermes/hermes-sdd.json" > "$T/c" && cp "$T/c" "$R/.sdd/hermes/hermes-sdd.json"
etapa() { FALSO_MODO=$1 bash "$ROOT/etapa.sh" "$R" plan | tail -1; }
D=acceptance/decisions.jsonl

h=$(git -C "$R" rev-parse HEAD); o=$(etapa medicion)
[ "$(git -C "$R" log -1 --format=%s)" = "docs(sdd): changes left uncommitted by the plan-architect stage" ] &&
  [ -z "$(git -C "$R" status --porcelain --untracked-files=no)" ] &&
  echo "$o" | jq -r .reason | grep -vq "registros humanos" &&
  ok "medición de la CLI sin commitear → la commitea el arnés" || bad "medición: $o"

h=$(git -C "$R" rev-parse HEAD); o=$(etapa humano)
[ "$(echo "$o" | jq -r .outcome)" = failed ] && echo "$o" | jq -r .reason | grep -q "no son mediciones de la CLI" &&
  ok "decisión humana fabricada por el ejecutor → la etapa falla" || bad "humano: $o"
git -C "$R" reset -q --hard "$h"

o=$(etapa borra)
[ "$(echo "$o" | jq -r .outcome)" = failed ] && echo "$o" | jq -r .reason | grep -q "borradas o cambiadas" &&
  [ -n "$(git -C "$R" status --porcelain -- "$D")" ] && [ "$(git -C "$R" rev-parse HEAD)" = "$h" ] &&
  ok "registro reescrito → la etapa falla y no se commitea" || bad "borra: $o"
exit $fail
