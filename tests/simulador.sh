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
    plan) v=conforme ;; preguntas) v=respondo ;; fallo) v=reintento ;; *) v=acepto ;;
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
    elif [ "${t%%:*}" = fallo ] && [ ! -f "$BASE/rechazo/a-mano" ]; then touch "$BASE/rechazo/a-mano"; return 1   # se reintenta con la CLI
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
  [ -z "$(abierta)" ] && ok "rechazo: reintentar a mano da por superada la puerta «fallo» que seguía abierta" \
    || bad "rechazo: tras reintentar a mano sigue abierta $(abierta)"
  correr rechazar_fase0
  local r; r=$(ultima 'Reintento: implementar')
  [ "$(echo "$r" | jq -r .outcome)" = done ] && ok "rechazo: el reintento sin trabajo nuevo termina (lo hecho desde el rechazo cuenta)" \
    || bad "rechazo: el reintento falla: $(echo "$r" | jq -r .reason)"
  [ "$(abierta | xargs -I{} jq -r '.tipo + ":" + .fase' "$HERMES_SDD_HOME/puertas/{}.json" 2>/dev/null)" = "fase:0" ] \
    && ok "rechazo: la FASE-0 vuelve a su puerta sin ningún desbloqueo a mano más que el reintento" \
    || bad "rechazo: no volvió la puerta de la FASE-0 ($(tarjetas | jq -c '[.[] | {title, status}]'))"
}

# 2. Una etapa cae (montana2 M4/M5/M8, montana3 N8, montana5 M5-12/13/14): antes quedaba una tarjeta bloqueada sin
#    puerta y solo salía con un desbloqueo a mano. Ahora abre una puerta «fallo» con el motivo y dos salidas.
esc_fallo() {
  nuevo fallo '{"implementar-0": ["falla"]}' || return
  local vista=""
  hasta_fallo() {
    local p=$1 t; t=$(jq -r .tipo "$HERMES_SDD_HOME/puertas/$p.json")
    case "$t" in
      fallo) if [ -z "$vista" ]; then vista=$p; decide "$p" reintento; else return 1; fi ;;
      fase)  return 1 ;;   # la FASE-0 llegó a su puerta: fin del escenario
      *)     camino_feliz "$p" ;;
    esac
  }
  correr hasta_fallo
  if [ -n "$vista" ]; then
    local f="$HERMES_SDD_HOME/puertas/$vista.json"
    jq -e '(.opciones | map(.verbo)) == ["reintento", "paro"] and (.texto | test("Implementar FASE-0|implementar")) and (.texto | test("el guion: falla"))' "$f" >/dev/null \
      && ok "fallo: la etapa que cae abre una puerta con el motivo y dos salidas (reintentar o dejarla parada)" \
      || bad "fallo: la puerta no es la esperada: $(jq -c '{opciones: [.opciones[].verbo], texto: .texto[0:200]}' "$f")"
  else
    bad "fallo: la etapa cayó y no abrió ninguna puerta ($(tarjetas | jq -c '[.[] | select(.status == "blocked") | .title]'))"
  fi
  [ "$(abierta | xargs -I{} jq -r '.tipo + ":" + .fase' "$HERMES_SDD_HOME/puertas/{}.json" 2>/dev/null)" = "fase:0" ] \
    && ok "fallo: tras «Reintentar», la FASE-0 sigue sola hasta su puerta (sin tocar el kanban a mano)" \
    || bad "fallo: no llegó a la puerta de la FASE-0 ($(tarjetas | jq -c '[.[] | {title, status}]'))"
  [ -z "$(tarjetas | jq -r '.[] | select(.status == "blocked") | .id')" ] \
    && ok "fallo: no queda ninguna tarjeta bloqueada" || bad "fallo: quedan bloqueadas: $(tarjetas | jq -c '[.[] | select(.status == "blocked") | .title]')"
}

# 3. Rechazar una FASE cuya pregunta recomienda cambiar los requisitos (material-montana5: dos vueltas así). La
#    respuesta lanza el cambio; al aprobarlo, la FASE se rehace y su implementación recibe TAMBIÉN lo que la persona
#    escribió al rechazar (no se pierde por el camino del cambio).
esc_rechazo_cambio() {
  nuevo rechazo_cambio '{"cambio": ["cambio"], "implementar-0": ["replay", "commit"]}' || return
  local d="$BASE/rechazo_cambio"
  decide_rc() {
    local p=$1 t; t=$(jq -r '.tipo + ":" + (.fase // "")' "$HERMES_SDD_HOME/puertas/$p.json")
    if [ "$t" = "fase:0" ] && [ ! -f "$d/rechazada" ]; then touch "$d/rechazada"; decide "$p" rechazo "Falta el botón de borrar"
    elif [ "$t" = "fase:0" ]; then return 1
    else camino_feliz "$p"; fi
  }
  correr decide_rc
  git -C "$R" tag -l 'requirements-v*' | grep -qx 'requirements-v1.1' \
    && ok "rechazo con cambio: la recomendada lanza el cambio y su puerta de requisitos se aprueba (v1.1)" \
    || bad "rechazo con cambio: no hay requirements-v1.1 ($(git -C "$R" tag -l | tr '\n' ' '); $(grep -E 'PUERTA|NOTARIO' "$LOG" | tail -3 | tr '\n' ' '))"
  local pr; pr=$(ls "$R"/.sdd/hermes/guion-prompts/implementar-0-*.txt 2>/dev/null | sort -V | tail -1)
  [ -n "$pr" ] && grep -q "Falta el botón de borrar" "$pr" \
    && ok "rechazo con cambio: la FASE-0 se rehace y su implementación recibe lo que se escribió al rechazar" \
    || bad "rechazo con cambio: la implementación no recibió el rechazo ($(basename "${pr:-ninguno}"))"
  [ "$(abierta | xargs -I{} jq -r '.tipo + ":" + .fase' "$HERMES_SDD_HOME/puertas/{}.json" 2>/dev/null)" = "fase:0" ] \
    && ok "rechazo con cambio: la FASE-0 vuelve a su puerta sin desbloqueos a mano" \
    || bad "rechazo con cambio: no volvió la puerta de la FASE-0 ($(tarjetas | jq -c '[.[] | {title, status}]'))"
}

# 4. Descartar una impugnación (usado 3 veces en pruebas reales, sin ningún test): la puerta de la FASE sale bloqueada
#    con la impugnación; la persona la descarta («no es un fallo»); la puerta vuelve sin ella, se acepta y sigue la FASE-1.
esc_descarto() {
  nuevo descarto '{"aceptar-0": ["replay", "impugna"]}' || return
  local d="$BASE/descarto" bloqueada=""
  decide_d() {
    local p=$1 f="$HERMES_SDD_HOME/puertas/$1.json" t; t=$(jq -r '.tipo + ":" + (.fase // "")' "$f")
    if [ "$t" = "fase:0" ] && [ -z "$bloqueada" ]; then
      bloqueada=$(jq -c '{bloqueo, opciones: [.opciones[].verbo], ch: (.texto | test("CH-001"))}' "$f")
      decide "$p" descarto "CH-001: no es un fallo, el test sí lo comprueba"
    elif [ "$t" = "fase:0" ]; then
      jq -c '{bloqueo, ch: (.texto | test("CH-001"))}' "$f" > "$d/segunda"; decide "$p" acepto
    elif [ "$t" = "fase:1" ]; then return 1
    else camino_feliz "$p"; fi
  }
  correr decide_d
  [ "$(echo "$bloqueada" | jq -c '[.bloqueo, (.opciones | index("descarto") != null), .ch]' 2>/dev/null)" = "[true,true,true]" ] \
    && ok "descarto: la impugnación abierta bloquea la puerta de la FASE y ofrece descartarla" || bad "descarto: primera puerta ${bloqueada}"
  [ "$(jq -c '[.bloqueo, .ch]' "$d/segunda" 2>/dev/null)" = "[false,false]" ] \
    && ok "descarto: la puerta vuelve sin la impugnación descartada y sin bloqueo" || bad "descarto: segunda puerta $(cat "$d/segunda" 2>/dev/null)"
  git -C "$R" tag -l | grep -qx fase-0-accepted && tarjetas | jq -e 'any(.[]; .title | startswith("Implementar FASE-1"))' >/dev/null \
    && ok "descarto: aceptada la FASE-0, sigue la FASE-1" || bad "descarto: no siguió ($(git -C "$R" tag -l | tr '\n' ' '))"
}

# 5. Entrega parcial (/entregar) tras aceptar la FASE-1: la FASE-2 que ya estaba en cola no entra; el cierre abre la
#    puerta de entrega de las FASEs 0 y 1 y, aceptada, queda la etiqueta entrega-1 (material-montana2..5 lo hicieron así)
esc_entrega() {
  nuevo entrega '{}' || return
  decide_e() {
    local p=$1 t; t=$(jq -r '.tipo + ":" + (.fase // "")' "$HERMES_SDD_HOME/puertas/$p.json")
    case "$t" in
      fase:1) decide "$p" acepto && bash "$ROOT/lanzar.sh" entregar "$R" >>"$LOG" 2>&1 ;;
      # la grabación tiene un requisito de cobertura sin medir: la entrega sale bloqueada y solo vale eximirlo (N25 en
      # material-montana3: «eximo» dejó la puerta en error)
      entrega:) if jq -e '.bloqueo' "$HERMES_SDD_HOME/puertas/$p.json" >/dev/null; then decide "$p" eximo "La cobertura se mide al terminar todas las FASEs"
                else decide "$p" acepto; fi; return 1 ;;
      *) camino_feliz "$p" ;;
    esac
  }
  correr decide_e 60
  git -C "$R" tag -l | grep -qx entrega-1 && ok "entrega: /entregar tras la FASE-1 acaba en la etiqueta entrega-1" \
    || bad "entrega: sin entrega-1 ($(git -C "$R" tag -l | tr '\n' ' '); $(grep -E 'PUERTA|NOTARIO|Cierre' "$LOG" | tail -3 | tr '\n' ' '))"
  tarjetas | jq -e '[.[] | select((.title | startswith("Implementar FASE-2")) and (.status == "done" or .status == "running"))] | length == 0' >/dev/null \
    && ok "entrega: la FASE-2 que estaba en cola no se ejecuta" || bad "entrega: la FASE-2 se ejecutó"
  grep -q "Entrega parcial 1 (FASEs 0 1) aceptada" "$LOG" \
    && ok "entrega: la entrega es de las FASEs 0 y 1, con la exención apuntada" || bad "entrega: $(grep -i 'entrega' "$LOG" | tail -2 | tr '\n' ' ')"
}

# 6. Un cambio pedido a mitad (/cambio) justo cuando la FASE-1 está en cola: el cambio pasa por su puerta de requisitos
#    y la FASE-1 se hace con los requisitos nuevos, sin dos implementaciones a la vez ni tarjetas bloqueadas
esc_cambio_medio() {
  nuevo cambio_medio '{}' || return
  decide_m() {
    local p=$1 t; t=$(jq -r '.tipo + ":" + (.fase // "")' "$HERMES_SDD_HOME/puertas/$p.json")
    case "$t" in
      fase:0) decide "$p" acepto && bash "$ROOT/lanzar.sh" cambio "$R" "Que cada tarea pueda llevar una fecha límite" >>"$LOG" 2>&1 ;;
      fase:1) return 1 ;;
      *) camino_feliz "$p" ;;
    esac
  }
  correr decide_m 60
  git -C "$R" tag -l 'requirements-v*' | grep -q 'requirements-v1\.[1-9]' \
    && ok "cambio a mitad: pasa por su puerta de requisitos y se aprueba" || bad "cambio a mitad: sin versión nueva ($(git -C "$R" tag -l | tr '\n' ' '))"
  [ "$(abierta | xargs -I{} jq -r '.tipo + ":" + .fase' "$HERMES_SDD_HOME/puertas/{}.json" 2>/dev/null)" = "fase:1" ] \
    && ok "cambio a mitad: la FASE-1 llega a su puerta" || bad "cambio a mitad: no llegó a la FASE-1 ($(tarjetas | jq -c '[.[] | {title, status}]'))"
  [ -z "$(tarjetas | jq -r '.[] | select(.status == "blocked") | .id')" ] && ! grep -q '"busy"\|ocupado' "$LOG" \
    && ok "cambio a mitad: ninguna tarjeta bloqueada ni etapas pisándose" || bad "cambio a mitad: $(tarjetas | jq -c '[.[] | select(.status == "blocked") | .title]') $(grep -c 'ocupado' "$LOG")"
}

# Cada escenario es independiente (su kanban, su HOME, su repo): corren a la vez y se cuentan al final
ESC=${*:-rechazo fallo rechazo_cambio descarto entrega cambio_medio}
for e in $ESC; do ( fail=0; "esc_$e"; exit $fail ) > "$BASE/$e.out" 2>&1 & done
wait
for e in $ESC; do cat "$BASE/$e.out"; grep -q '^FAIL' "$BASE/$e.out" && fail=1; grep -q '^ok' "$BASE/$e.out" || { echo "FAIL $e: no comprobó nada"; fail=1; }; done
[ $fail = 0 ] && echo "tests/simulador.sh: all passed"
exit $fail
