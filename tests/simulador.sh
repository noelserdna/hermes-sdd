#!/usr/bin/env bash
# SIMULADOR DE PROYECTO: el arnés real de punta a punta (lanzar.sh → tarjetas del kanban REAL de Hermes → etapa.sh →
# puerta → decidir.sh → notario → tramo siguiente), sin LLM y sin coste. Sustituye a una prueba de proyecto de 4-9 h
# para todo lo que no es el modelo: los caminos de puertas, rechazos, reintentos y bloqueos.
#   - kanban: el de Hermes, en un directorio temporal (HERMES_KANBAN_HOME); el tuyo no se toca
#   - estación: este script hace lo que profiles/sdd-estacion (ejecuta «Ejecuta:», completa o bloquea la tarjeta)
#   - ejecutor: tests/ejecutor-guion.sh (la grabación todo-app y, donde el escenario lo pide, fallos guionizados)
#   - puertas: se deciden por guion con decidir.sh (canal local), como lo haría una persona
#
#   bash tests/simulador.sh [escenario…]     (sin argumentos, todos; CONSERVAR=1 deja el directorio)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
command -v hermes >/dev/null 2>&1 || { echo "SKIP sin hermes: el simulador usa el kanban real"; exit 0; }
BASE=$(mktemp -d); [ -n "${CONSERVAR:-}" ] && echo "directorio: $BASE" || trap 'rm -rf "$BASE"' EXIT

# ── piezas ──────────────────────────────────────────────────────────────────────────────────────────────────────────
nuevo() {  # nuevo <nombre> <guion-json>: proyecto practicado con su kanban, su HOME y su guion
  local d="$BASE/$1"; mkdir -p "$d/home" "$d/kanban"
  export HERMES_SDD_HOME="$d/home" HERMES_KANBAN_HOME="$d/kanban"
  jq -n --arg u "$USER" '{yo:{nombre:"Alumna", rol:"Cliente", canales:{local:$u}}}' > "$HERMES_SDD_HOME/aprobadores.json"
  hermes kanban init >/dev/null 2>&1
  R="$d/practica"; BOARD=practica; LOG="$d/sim.log"; : > "$LOG"
  git clone -q "$ROOT/grabaciones/todo-app/repo.bundle" "$R.tmp" 2>/dev/null; rm -rf "$R.tmp"   # (nada: practicar clona)
  bash "$ROOT/practicar.sh" "$ROOT/grabaciones/todo-app" "$R" >>"$LOG" 2>&1 || { bad "$1: practicar"; return 1; }
  git -C "$R" config user.email a@a; git -C "$R" config user.name Alumna
  local t; t=$(mktemp)
  jq '.ejecutor = "../tests/ejecutor-guion" | .canales = []' "$R/.sdd/hermes/hermes-sdd.json" > "$t" && mv "$t" "$R/.sdd/hermes/hermes-sdd.json"
  printf '%s\n' "$2" > "$R/.sdd/hermes/guion.json"
}
k() { hermes kanban --board "$BOARD" "$@"; }
tarjetas() { k list --json 2>/dev/null | jq -c '[.[]? | select(.status != "archived")]'; }
estacion() {  # ejecuta las tarjetas listas de la estación hasta que no quede ninguna; como profiles/sdd-estacion
  local id cmd out o
  while id=$(tarjetas | jq -r '[.[] | select(.assignee == "sdd-estacion" and .status == "ready")] | sort_by(.created_at) | .[0].id // empty') && [ -n "$id" ]; do
    cmd=$(k show "$id" --json | jq -r '.task.body // .body // ""' | sed -n 's/^Ejecuta: //p' | head -1)
    k claim "$id" >/dev/null 2>&1
    out=$(bash -c "$cmd" 2>>"$LOG" | tail -1); echo "$(k show "$id" --json | jq -r '.task.title // .title') → $out" >> "$LOG"
    o=$(echo "$out" | jq -r '.outcome // empty' 2>/dev/null)
    if [ "$o" = done ]; then k complete "$id" --summary "$(echo "$out" | jq -r '.resumen // "hecho"')" >/dev/null 2>&1
    else k block "$id" --kind capability "$(echo "$out" | jq -r '.reason // "sin JSON"' 2>/dev/null || echo 'sin JSON')" >/dev/null 2>&1; fi
  done
}
abierta() { for f in "$HERMES_SDD_HOME"/puertas/*.json; do [ -f "$f" ] && [ "$(jq -r .estado "$f")" = abierta ] && jq -r .id "$f"; done 2>/dev/null | head -1; }
decide() {  # decide <puerta> <verbo> [texto]
  echo "PUERTA $1 $(jq -r '.tipo + " " + (.fase // "")' "$HERMES_SDD_HOME/puertas/$1.json") → $2" >> "$LOG"
  bash "$ROOT/decidir.sh" "$1" "$2" ${3:+"$3"} >>"$LOG" 2>&1
}
camino_feliz() {  # decide toda puerta con lo que haría una persona conforme
  local p tipo v
  p=$1; tipo=$(jq -r .tipo "$HERMES_SDD_HOME/puertas/$p.json")
  case "$tipo" in
    ruta) v=$(jq -r '[.opciones[] | select(.auto == true) | .verbo][0] // [.opciones[] | select(.verbo | startswith("ruta-")) | .verbo][0] // "acepto"' "$HERMES_SDD_HOME/puertas/$p.json") ;;
    plan) v=conforme ;; preguntas) v=respondo ;; *) v=acepto ;;
  esac
  decide "$p" "$v"
}
correr() {  # correr <funcion-que-decide> [max]: estación y puertas hasta que no haya nada que hacer
  local i p
  for i in $(seq 1 "${2:-40}"); do
    estacion; p=$(abierta); [ -n "$p" ] || return 0
    "$1" "$p" || return 1
  done
}
ultima() { grep -E "→ \{" "$LOG" | grep -E "^$1" | tail -1 | sed 's/.*→ //'; }

# ── escenarios ──────────────────────────────────────────────────────────────────────────────────────────────────────
# 1. montana5 (18-nov): FASE-0 rechazada; el primer intento hace el trabajo y cae por otra cosa; se reintenta sin --de;
#    el segundo intento no tiene nada nuevo que hacer. Debe seguir solo hasta volver a la puerta de la FASE-0.
#    Antes: la guarda «no ha cambiado nada» medía desde el inicio del intento (M5-14) y Aceptar se quedaba colgada de
#    la tarjeta bloqueada (R4): 35 min parados y dos desbloqueos a mano.
esc_rechazo() {
  nuevo rechazo '{"implementar-0": ["replay", "commit+falla", "nada"]}' || return
  rechazar_fase0() {
    local p=$1 t; t=$(jq -r '.tipo + ":" + (.fase // "")' "$HERMES_SDD_HOME/puertas/$p.json")
    if [ "$t" = "fase:0" ] && [ ! -f "$BASE/rechazo/rechazada" ]; then touch "$BASE/rechazo/rechazada"; decide "$p" rechazo "Falta el botón de borrar. Q1: C, Q2: C"
    elif [ "$t" = "fase:0" ]; then return 1   # vuelve la puerta de la FASE-0: fin del escenario
    else camino_feliz "$p"; fi
  }
  correr rechazar_fase0
  local b; b=$(tarjetas | jq -r '[.[] | select(.status == "blocked")] | .[0].id // empty')
  [ -n "$b" ] && ok "rechazo: el intento que cae deja su tarjeta bloqueada ($(ultima 'Implementar FASE-0' | jq -r .reason))" || bad "rechazo: no hubo bloqueo $(tail -5 "$LOG")"
  bash "$ROOT/lanzar.sh" reintentar "$R" implementar 0 >>"$LOG" 2>&1
  local hija padre nueva
  nueva=$(tarjetas | jq -r '[.[] | select(.title | startswith("Reintento: implementar"))] | .[0].id // empty')
  hija=$(tarjetas | jq -r '[.[] | select(.title == "Aceptar FASE-0" and .status != "done")] | .[0].id // empty')
  padre=$(k show "$hija" --json 2>/dev/null | jq -r '(.parents // .task.parents // [])[0] // empty')
  [ -n "$nueva" ] && [ "$padre" = "$nueva" ] && ok "rechazo: reintentar sin --de pasa Aceptar FASE-0 a la tarjeta nueva" \
    || bad "rechazo: Aceptar FASE-0 cuelga de «${padre}», no del reintento «${nueva}»"
  correr rechazar_fase0
  local r; r=$(ultima 'Reintento: implementar')
  [ "$(echo "$r" | jq -r .outcome)" = done ] && ok "rechazo: el reintento sin trabajo nuevo termina (lo hecho desde el rechazo cuenta)" \
    || bad "rechazo: el reintento falla: $(echo "$r" | jq -r .reason)"
  [ "$(abierta | xargs -I{} jq -r '.tipo + ":" + .fase' "$HERMES_SDD_HOME/puertas/{}.json" 2>/dev/null)" = "fase:0" ] \
    && ok "rechazo: la FASE-0 vuelve a su puerta sin ningún desbloqueo a mano más que el reintento" \
    || bad "rechazo: no volvió la puerta de la FASE-0 ($(tarjetas | jq -c '[.[] | {title, status}]'))"
}

ESC=${*:-rechazo}
for e in $ESC; do "esc_$e"; done
[ $fail = 0 ] && echo "tests/simulador.sh: all passed"
exit $fail
