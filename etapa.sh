#!/usr/bin/env bash
# PROPONE: ejecuta una etapa del método con el ejecutor y, si la etapa termina en una decisión humana, abre la puerta.
# La lanza la estación de Hermes desde una tarjeta del kanban; también se puede lanzar a mano.
#
#   etapa.sh <repo> <etapa> [fase]
#     requisitos     si ya hay requisitos, abre la puerta; si no, el ejecutor los escribe desde intent/
#     ruta           propone qué etapas necesita el proyecto (factores por el ejecutor si no hay Jev) → puerta
#     especificar · auditar · pruebas · seguridad · tecnico · ux
#                    pasos extra que pide la ruta (spec/, audits/, test/TEST-PLAN.md, design/, ux/), antes del plan
#     plan           plan por FASEs
#     tareas         tareas de todas las FASEs → puerta de plan (conformidad con el orden de entrega)
#     huecos N       completa los [PLAN GAP] de la FASE N con las respuestas ya aprobadas (sin puerta: aplica lo decidido)
#     implementar N  implementa la FASE N y verifica (tareas hechas, commits válidos)
#     aceptar N      veredictos y demo de la FASE N → puerta de aceptación
#     cambio         aplica la petición de intent/INT-NNN.md a los requisitos (versión nueva) → puerta de requisitos
#     adoptar        ingeniería inversa de un repo existente: requisitos y FASEs retroactivas → puerta de requisitos
#     brechas        huecos entre especificación y código (si la ruta lo pide), antes del cierre
#     cierre         puerta de calidad GLOBAL; si quedan Must sin verificar, el ejecutor cierra los huecos y se
#                    repite la aceptación global → puerta de entrega
#
# Si existe .sdd/hermes/feedback/<etapa>[-N].txt (lo deja el notario tras un "cambios"/"rechazo"), se pasa al
# ejecutor como lo que la persona pidió cambiar.
# Última línea de stdout: JSON {outcome: done|failed|scheduled|busy, reason, resumen, puerta, run, cost_usd, …}.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"; STATE="$ROOT/metodo/scripts/sdd-state.sh"
REPO=$(cd "$1" && pwd); ETAPA=$2; FASE=${3:-}
cd "$REPO"
T0=$(date +%s); HEAD0=$(git rev-parse HEAD 2>/dev/null || echo ""); EJECUCIONES='[]'   # para etapas.jsonl
SUBPASO=""; S_LLM=0       # el último paso con ejecutor (dónde se quedó si se corta) y los segundos dentro de ejecutores
RONDAS='[]'               # rondas adversariales de la etapa (aceptar): completa | incremental, criterios y verificados
MODELO_PASO=""            # un sub-paso con otro modelo que el de la etapa (veredictos de aceptar: el barato del perfil)
AL_TERMINAR=()            # «origen|destino»: lo consumido se marca solo si la etapa termina bien (un reintento lo vuelve a ver)
. "$ROOT/lib/candado.sh"; CON_CANDADO=false
. "$ROOT/lib/comun.sh"   # slug, unica, parcial, gate_entrega
# Ejecutor por etapa: .ejecutores[<etapa>] o, si no, .ejecutor (claude | hermes | replay); el modelo, en .modelos[<etapa>]
# o, si el proyecto no lo fija, el del perfil de modelos global (sdd.json; por defecto «equilibrado»)
ejecutor() { jq -r --arg e "$1" '.ejecutores[$e] // .ejecutor // "claude"' .sdd/hermes/hermes-sdd.json 2>/dev/null || echo claude; }
EJEC=$(ejecutor "$ETAPA")
modelo() {  # el del proyecto (.modelos[<etapa>]); si no fija ninguno, el del perfil global (SDD → Configuración)
  local m; m=$(jq -r --arg e "$1" '.modelos[$e] // .modelos.defecto // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null)
  [ -n "$m" ] && { echo "$m"; return; }
  HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" modelo "$1" "$(ejecutor "$1")" 2>/dev/null
}
# Topes de gasto y de tiempo (con menos personas mirando, nada debe gastar sin freno): por etapa (suma de sus
# ejecuciones), por proyecto (todo etapas.jsonl) y por ejecución de Claude (minutos). Se fijan en sdd.json
# (`topes`, para todos) y en .sdd/hermes/hermes-sdd.json (`topes`, para este proyecto); 0 = sin tope. Por defecto, unas
# 3 veces lo más caro y lo más largo que se ha visto (club y taller: 7,4 $ y 36 min por etapa; 131,6 $ por proyecto).
tope() {  # tope <clave> <defecto>
  local v; v=$(jq -r --arg k "$1" '.topes[$k] // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null)
  [ -n "$v" ] || v=$(jq -r --arg k "$1" '.topes[$k] // empty' "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/sdd.json" 2>/dev/null)
  echo "${v:-$2}"
}
presupuesto() {  # PRESUPUESTO = lo que puede gastar la ejecución siguiente (USD; vacío = sin tope), o sale de la etapa si no
  # queda (sin subshell: `fin` tiene que terminar la etapa)
  local te tp ge gp q
  PRESUPUESTO=""
  te=$(tope etapa_usd 20); tp=$(tope proyecto_usd 300)
  ge=$(jq '[.[].cost_usd // 0] | add // 0' <<< "$EJECUCIONES")
  gp=0; [ -s .sdd/hermes/etapas.jsonl ] && gp=$(jq -s '[.[].coste_usd // 0] | add // 0' .sdd/hermes/etapas.jsonl 2>/dev/null)
  jq -e 'type == "number"' <<< "${gp:-x}" >/dev/null 2>&1 || gp=0
  q=$(jq -n --argjson te "$te" --argjson tp "$tp" --argjson ge "$ge" --argjson gp "${gp:-0}" '
    [(if $te > 0 then $te - $ge else empty end), (if $tp > 0 then $tp - $gp - $ge else empty end)] | min // ""')
  [ -z "$q" ] && return 0
  if jq -e --argjson q "$q" -n '$q < 0.05' >/dev/null; then
    if jq -e --argjson tp "$tp" --argjson gp "${gp:-0}" --argjson ge "$ge" -n '$tp > 0 and ($gp + $ge) >= $tp - 0.05' >/dev/null; then
      fin "$(jq -nc --arg r "el proyecto llegó a su tope de gasto ($tp \$; lleva $(jq -n "($gp + $ge) * 100 | floor / 100") \$): para seguir, súbelo en .sdd/hermes/hermes-sdd.json (topes.proyecto_usd)" '{outcome:"failed", reason:$r, tope:"proyecto"}')"
    fi
    fin "$(jq -nc --arg r "la etapa llegó a su tope de gasto ($te \$): para seguir, súbelo (topes.etapa_usd) o mira por qué gasta tanto" '{outcome:"failed", reason:$r, tope:"etapa"}')"
  fi
  PRESUPUESTO=$(jq -n "$q * 100 | floor / 100")
}
registrar_etapa() {  # una línea por etapa en .sdd/hermes/etapas.jsonl: la línea base del encargado (docs/encargado.md)
  local res=$1 head1 ratio='null'
  head1=$(git rev-parse HEAD 2>/dev/null || echo "")
  if [ "$ETAPA" = implementar ] && [ -n "$HEAD0" ] && [ -n "$head1" ] && [ "$HEAD0" != "$head1" ]; then
    # líneas añadidas en tests frente a código (sin documentación ni registros del método)
    ratio=$(git diff --numstat "$HEAD0" "$head1" 2>/dev/null | awk '
      $3 ~ /(^|\/)(acceptance|status|evidencias|\.sdd|task|plan|requirements|spec)\// || $3 ~ /\.md$/ {next}
      $3 ~ /(^|\/)(tests?|spec|e2e|__tests__)\// || $3 ~ /\.(test|spec)\.[a-z]+$/ {t+=$1; next} {c+=$1}
      END {printf "{\"tests\":%d,\"codigo\":%d}", t, c}')
  fi
  mkdir -p .sdd/hermes
  local seg=$(( $(date +%s) - T0 )) carga
  # carga del sistema (1, 5 y 15 min) al terminar: para medir si las etapas se estorban (macOS: vm.loadavg; Linux: /proc)
  carga=$({ sysctl -n vm.loadavg 2>/dev/null || cut -d' ' -f1-3 /proc/loadavg 2>/dev/null; } | tr -d '{}' | awk '{printf "[%s,%s,%s]", $1, $2, $3}')
  jq -e . <<< "${carga:-x}" >/dev/null 2>&1 || carga=null
  jq -nc --argjson res "$(echo "$res" | jq -c . 2>/dev/null || echo '{}')" --argjson ej "$EJECUCIONES" --argjson r "$ratio" \
    --arg sub "$SUBPASO" --argjson seg "$seg" --argjson sllm "$S_LLM" --argjson carga "$carga" --argjson rondas "$RONDAS" \
    --arg etapa "$ETAPA" --arg fase "$FASE" --arg t "${HERMES_KANBAN_TASK:-}" --arg h0 "$HEAD0" --arg h1 "$head1" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson min "$(( ($(date +%s) - T0) / 60 ))" --arg resumen "${2:-}" --arg puerta "${3:-}" '
    {ts: $ts, etapa: $etapa, fase: (if $fase == "" then null else $fase end), tarjeta: (if $t == "" then null else $t end),
     resultado: ($res.outcome // null), motivo: ($res.reason // null), resumen: (if $resumen == "" then null else $resumen end),
     puerta: (if $puerta == "" then null else $puerta end), minutos: $min,
     ejecuciones: [$ej[] | .run], coste_usd: ([$ej[] | .cost_usd // 0] | add // 0), turnos: ([$ej[] | .turns // 0] | add // 0),
     head_antes: $h0, head_despues: $h1, tests_codigo: $r,
     subpaso: (if $sub == "" then null else $sub end), segundos: $seg, segundos_sin_llm: ([$seg - $sllm, 0] | max),
     carga: $carga} + (if ($rondas | length) > 0 then {rondas_adversariales: $rondas} else {} end)' >> .sdd/hermes/etapas.jsonl 2>/dev/null || true
}
huerfanos() {  # servidores de este proyecto que dejó una ejecución (vite, el de las pruebas): ocupan el puerto y la
  # siguiente etapa se pelea con ellos (club, FASE-3: 30 min de e2e colgados hasta matarlos). Solo los de su node_modules
  # y solo con el candado del repo en la mano: si otra etapa lo tiene, esos servidores son suyos
  $CON_CANDADO || return 0
  pkill -f "$REPO/node_modules/" >/dev/null 2>&1 || true
}
matar_hijos() {  # matar_hijos <pid>: sus descendientes, de las hojas hacia arriba (el ejecutor mata además su grupo)
  local h; for h in $(pgrep -P "$1" 2>/dev/null); do matar_hijos "$h"; kill -TERM "$h" 2>/dev/null; done; return 0
}
fin() {  # fin <json-del-ejecutor-o-propio> [resumen] [puerta]
  huerfanos
  if [ "$(echo "$1" | jq -r .outcome 2>/dev/null)" = done ]; then   # lo consumido se da por aplicado ahora, no antes
    local par; for par in ${AL_TERMINAR[@]+"${AL_TERMINAR[@]}"}; do [ -e "${par%%|*}" ] && mv "${par%%|*}" "${par#*|}"; done
  fi
  registrar_etapa "$1" "${2:-}" "${3:-}"
  # Etapa resuelta: las tarjetas bloqueadas de intentos anteriores de esta misma etapa quedan obsoletas y se archivan
  if [ "$(echo "$1" | jq -r .outcome 2>/dev/null)" = done ] && [ -z "${HERMES_SDD_SIN_KANBAN:-}" ]; then
    bash "$ROOT/lanzar.sh" limpiar "$REPO" >/dev/null 2>&1 || true
  fi
  echo "$1" | jq -c --arg r "${2:-}" --arg p "${3:-}" '. + {resumen:$r} + (if $p != "" then {puerta:$p} else {} end)'
  exit 0
}
falla() { fin "$(jq -nc --arg r "$1" '{outcome:"failed", reason:$r}')"; }
# Cortada desde fuera (el kanban perdió al worker, un reinicio, Ctrl-C): consta en etapas.jsonl como «interrumpida»,
# sus hijos (el ejecutor y Claude) mueren con ella y el candado se suelta. Antes no quedaba rastro de esos runs.
interrumpida() {
  trap - TERM HUP INT
  matar_hijos $$
  huerfanos
  registrar_etapa "$(jq -nc --arg s "$1" '{outcome:"interrumpida", reason:("señal " + $s)}')"
  candado_soltar
  jq -nc --arg s "$1" '{outcome:"failed", reason:("etapa interrumpida (señal " + $s + ")")}'
  exit 143
}
trap 'interrumpida TERM' TERM; trap 'interrumpida HUP' HUP; trap 'interrumpida INT' INT
trap candado_soltar EXIT
# ── Antes de gastar nada: ¿el proyecto está en pausa? ¿la cuota de Claude está agotada? ────────────────────────────
HOME_SDD=${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}
BOARD=$(slug "$(basename "$REPO")")   # lib/comun.sh: el mismo nombre que da el plugin
if [ -f "$HOME_SDD/pausa/_todo" ] || [ -f "$HOME_SDD/pausa/$BOARD" ]; then
  fin '{"outcome":"scheduled","reason":"proyecto en pausa: /reanudar para seguir"}'
fi
if [ "$EJEC" = claude ] && [ -f "$HOME_SDD/cuota.json" ]; then
  R=$(jq -r '.reset_at // 0' "$HOME_SDD/cuota.json")
  [ "$R" -gt "$(date +%s)" ] && fin "$(jq -nc --arg r "$R" '{outcome:"scheduled", reason:"cuota de Claude agotada", reset_at:$r}')"
fi

# ── Candado del repo para toda la etapa (lib/candado.sh). Si lo tiene una firma, se espera a que acabe (el notario
#    lanza el tramo siguiente antes de terminar); si lo tiene otra etapa, «busy» sin tocar nada (ni sus servidores).
ESPERA=0
until candado_tomar "$REPO" etapa "$ETAPA${FASE:+-$FASE}"; do
  case "$CANDADO_OTRO" in
    firma*) [ "$ESPERA" -lt "${HERMES_SDD_ESPERA_CANDADO_S:-600}" ] && { sleep 5; ESPERA=$((ESPERA + 5)); continue; } ;;
  esac
  fin "$(jq -nc --arg r "ya hay una ejecución viva en este repo ($CANDADO_OTRO)" '{outcome:"busy", reason:$r}')"
done
CON_CANDADO=true; export SDD_CANDADO_PID=$$   # los ejecutores que lance usan este candado
huerfanos   # restos de una etapa anterior (antes de empezar)
# El estado del arnés no se versiona en el proyecto: si un agente reescribió .gitignore y quitó sus líneas (taller3:
# el implementador lo dejó sin .sdd/, pipeline-state.json ni evidencias/), se vuelven a poner, a la vista, antes de
# empezar; si no, un «git add -A» de la etapa siguiente commitearía puertas, decisiones y evidencias
IGN=0; for l in pipeline-state.json .sdd/ evidencias/; do grep -qxF "$l" .gitignore 2>/dev/null || { echo "$l" >> .gitignore; IGN=1; }; done
if [ "$IGN" = 1 ]; then
  git add .gitignore && git commit -qm "chore(sdd): restore the harness entries in .gitignore" >/dev/null 2>&1 || true
fi

FB=".sdd/hermes/feedback/${ETAPA}${FASE:+-$FASE}.txt"
PEDIDO=""; [ -s "$FB" ] && PEDIDO=" La persona revisó la propuesta anterior y pidió estos cambios, que son la prioridad de esta ejecución: «$(cat "$FB")»."
# Lecciones confirmadas de proyectos anteriores para esta etapa (encargado, fase 5): como mucho 5; cada uso se anota
LECC=$(HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_lecciones.py" \
  para-etapa "$ETAPA" --repo "$REPO" --registrar 2>/dev/null || true)
# Lo que el cliente ya decidió (preguntas respondidas y exenciones abiertas), en el prompt de TODA etapa: material-montana
# eligió «hora de España» en la puerta del plan (respuesta sin más efecto), nadie lo escribió en spec/ y la FASE-2 se
# programó en hora universal; y la revisión independiente volvió a dudar de lo que el cliente ya había decidido.
req_cambiados() {  # los requisitos que cambió el último cambio aprobado (entre los dos últimos tags requirements-v*):
  # «añadidos: …; cambiados: …; quitados: …», o nada si no hay un tag anterior o no cambia ningún requisito
  local prev
  prev=$(git tag -l 'requirements-v*' --sort=-v:refname | sed -n 2p)
  [ -n "$prev" ] || return 0
  git show "$prev:requirements/REQUIREMENTS.md" 2>/dev/null | python3 -c '
import re, sys
def bloques(t):
    return {m.group(1): m.group(0).strip() for m in re.finditer(r"^### (REQ-[A-Z]+-\d+).*?(?=^### |^## |\Z)", t, re.M | re.S)}
antes = bloques(sys.stdin.read())
ahora = bloques(open("requirements/REQUIREMENTS.md", encoding="utf-8").read())
if not antes: sys.exit(0)
partes = [(n, sorted(x)) for n, x in (("added", set(ahora) - set(antes)), ("modified", [r for r in ahora if r in antes and antes[r] != ahora[r]]),
                                      ("removed", set(antes) - set(ahora))) if x]
print("; ".join(n + ": " + ", ".join(x) for n, x in partes))' 2>/dev/null || true
}
actualizar() {  # actualizar <clave de etapa>: la etapa ya se hizo y un cambio de requisitos la dejó «stale» → solo lo afectado
  # (material-montana: tras cada cambio se reescribían especificación, auditoría, pruebas, seguridad, técnico y UX: ~10 $)
  [ "$(bash "$STATE" get "$1" 2>/dev/null)" = stale ] || return 0
  local c; c=$(req_cambiados)
  [ -n "$c" ] || return 0
  echo " UPDATE MODE: this artifact already exists and the approved requirements change touched only these requirements ($c). Update only what they affect (and what references them); do not rewrite, reorder or reformat the rest, and do not open questions about anything that did not change."
}
decisiones() {
  local q p
  # Las de efecto req-change ya están escritas en requirements/: no se repiten. Las más recientes primero (mandan).
  q=$(node "$SDD" questions list --json 2>/dev/null | jq -r '[.questions[]? | select(.state == "ANSWERED")
      | ((.answer // "" | capture("^(?<l>[A-Z])\\b").l)? // "") as $l
      | ([.options[]? | select(.letter == $l)][0]) as $o
      | select(($o.effect // "") | startswith("req-change") | not)
      | "\(.id): \((.client // .question) | .[0:110]) → \((($o | (.client // .text)) // (.answer // "")) | .[0:110])"] | reverse | join(" · ")' 2>/dev/null || true)
  p=$( [ -f acceptance/PENDIENTES.md ] && grep -E '\| abierto \|$' acceptance/PENDIENTES.md | awk -F'|' '{gsub(/^ +| +$/,"",$3); gsub(/^ +| +$/,"",$4); gsub(/^ +| +$/,"",$5); print $3 " (" $4 "): " $5}' | tr '\n' ';' || true)
  [ -n "$q$p" ] || return 0
  printf ' Decisiones del cliente que ya están tomadas (aplícalas; no las vuelvas a preguntar ni las impugnes):%s%s' \
    "${p:+ Eximido por el cliente, se cumple más adelante: $p}" "${q:+ $q.}" | python3 -c 'import sys; t = sys.stdin.read(); print(t if len(t) <= 4000 else t[:3990] + " (…)", end="")'
}
DECIS=$(decisiones)
ARNES="Modo arnés (hermes-sdd): sin persona en la sesión; sigue references/modo-arnes.md del plugin.$PEDIDO${LECC:+ $LECC}$DECIS"

registros_ajenos() {  # registros_ajenos <head-antes> → imprime qué está mal y sale 0; nada y sale 1 si todo es de la CLI
  local f d m
  for f in acceptance/decisions.jsonl acceptance/challenges.jsonl; do
    [ -f "$f" ] || { git cat-file -e "$1:$f" 2>/dev/null && { echo "$f: borrado"; return 0; }; continue; }
    # cada línea que había antes de la etapa sigue ahí (lo nuevo puede quedar en medio: merge=union en el replay)
    d=$(diff <(git show "$1:$f" 2>/dev/null) "$f" || true)
    printf '%s\n' "$d" | grep -q '^<' && { echo "$f: líneas borradas o cambiadas"; return 0; }
    if [ "$f" = acceptance/challenges.jsonl ]; then
      # Resolver una impugnación (`accept challenge resolve`) es de la ronda adversarial, no del implementador
      if [ "${SUBPASO:-}" != acceptance ] && printf '%s\n' "$d" | sed -n 's/^> //p' | jq -e -s 'any(.[]; .type == "resolution")' >/dev/null 2>&1; then
        echo "$f: impugnaciones dadas por resueltas fuera de la ronda adversarial (paso ${SUBPASO:-?})"; return 0
      fi
      continue
    fi
    m=$(printf '%s\n' "$d" | sed -n 's/^> //p' | jq -rs '[.[] | select((.type == "measurement" and .by == "command"
      and .role == "automated" and (.command | type) == "string") | not) | "\(.type) por \(.by)"] | unique | join(", ")' 2>/dev/null) ||
      m="líneas que no son JSON"
    [ -z "$m" ] || { echo "$f: registros que no son mediciones de la CLI ($m)"; return 0; }
  done
  return 1
}
claude_etapa() {  # claude_etapa <clave-de-estado> <prompt>
  local clave=$1 res st head0 malo
  head0=$(git rev-parse HEAD)
  # Sandbox de Claude Code en las etapas que no abren un navegador (en macOS no puede arrancar Chromium)
  local sb=1; case "$ETAPA" in implementar|aceptar|cierre|brechas|adoptar|respuestas|mantener) sb=0 ;; esac
  SUBPASO=$clave
  local sal t1; sal=$(mktemp); t1=$(date +%s)
  # SDD_PASO: el paso que corre (acceptance, task-implementer…). La guardia del ejecutor deja `accept challenge
  # resolve` solo a la ronda adversarial (acceptance): el implementador nunca da por resuelto lo que le impugnaron
  presupuesto
  SDD_TOPE_USD=$PRESUPUESTO SDD_TOPE_MIN=$(tope ejecucion_min 60) SDD_PASO=$clave SDD_SANDBOX=$sb bash "$ROOT/executors/$EJEC.sh" "$REPO" "$ETAPA${FASE:+-$FASE}" "$2" "${MODELO_PASO:-$(modelo "$ETAPA")}" > "$sal" &
  wait $!   # en segundo plano y con wait: un TERM se atiende ya, no cuando acabe Claude
  res=$(tail -1 "$sal"); rm -f "$sal"
  S_LLM=$(( S_LLM + $(date +%s) - t1 ))
  EJECUCIONES=$(jq -c --argjson r "$(echo "$res" | jq -c . 2>/dev/null || echo '{}')" '. + [$r]' <<< "$EJECUCIONES")
  [ "$(echo "$res" | jq -r .outcome)" = done ] || fin "$res" "$(echo "$res" | jq -r .reason)"
  # Post-condición: la etapa no puede quedar a medias en el estado del método
  st=$(bash "$STATE" get "$clave" 2>/dev/null || echo "?")
  if [ "$st" = running ]; then
    bash "$STATE" set "$clave" stale --reason "el ejecutor terminó sin cerrar la etapa" >/dev/null 2>&1
    fin "$(echo "$res" | jq -c '.outcome="failed" | .reason="la etapa quedó en running: marcada stale"')"
  fi
  # Lo que pidió la persona se da por aplicado cuando la etapa termine bien (fin), no tras el primer ejecutor: si se
  # corta o falla después, el reintento lo vuelve a recibir (antes el rechazo se perdía)
  [ -s "$FB" ] && AL_TERMINAR+=("$FB|$FB.aplicado")
  # Los registros solo crecen, y el ejecutor solo puede añadir lo que escribe la CLI: mediciones de un comando
  # (`accept measure`) en decisions.jsonl y hallazgos (`accept challenge add`) en challenges.jsonl. Lo demás es una
  # decisión humana: se para la etapa sin commitear nada y lo ve una persona.
  if malo=$(registros_ajenos "$head0"); then
    fin "$(echo "$res" | jq -c --arg r "el ejecutor tocó registros humanos: $malo" '.outcome="failed" | .reason=$r')"
  fi
  # Lo que el ejecutor dejó versionado y sin commit (p. ej. un registro de medición): se commitea, a la vista, para
  # que la puerta se abra sobre un árbol limpio (el notario se niega a firmar con cambios pendientes)
  git add -- $(ls acceptance/decisions.jsonl acceptance/challenges.jsonl 2>/dev/null) >/dev/null 2>&1  # ya validados (un registro nuevo también)
  if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    git add -u && git commit -qm "docs(sdd): changes left uncommitted by the $clave stage" >/dev/null 2>&1 &&
      res=$(echo "$res" | jq -c '.reason = "ok (el arnés hizo commit de cambios que el ejecutor dejó pendientes)"')
  fi
  RES=$res
}
puerta() { bash "$ROOT/puerta.sh" "$REPO" "$@"; }
fidelidad() {  # ronda adversarial del método + hsdd_fidelidad de la FASE (deja .sdd/hermes/fidelidad-<N>.json)
  # Incremental (club: las rondas tras el arreglo y las de las re-aceptaciones fueron dos tercios del coste adversarial):
  # si ya hubo una ronda de esta FASE (su plan queda en .sdd/hermes/adversarial-FASE-N.json), solo se re-verifican los
  # criterios cuyo código, test, captura o texto cambió desde ella, o con una impugnación abierta; el resto conserva su
  # veredicto adversarial. La primera ronda de cada FASE es completa (no hay plan anterior); "ronda_incremental": false
  # en hermes-sdd.json las hace todas completas. Sin nada que re-verificar no se lanza ningún ejecutor.
  local base=".sdd/hermes/adversarial-FASE-$FASE.json" plan=".sdd/hermes/adversarial-FASE-$FASE.ronda.json"
  local tipo=completa n=null v=null inc="" coste=0
  if [ -s "$base" ] && ! jq -e '.ronda_incremental == false' .sdd/hermes/hermes-sdd.json >/dev/null 2>&1 &&
     node "$SDD" accept adversarial plan --fase "$FASE" --since "$base" --json > "$plan" 2>/dev/null && jq -e .incremental "$plan" >/dev/null 2>&1; then
    tipo=incremental; n=$(jq .incremental.criteria "$plan"); v=$(jq .incremental.recheck "$plan")
    inc=" INCREMENTAL ROUND: an adversarial round of FASE-$FASE already ran. Its plan is ready in $plan (made with \`accept adversarial plan --fase $FASE --since\`): use it instead of making a new one. Only the $v criteria with \"recheck\": true out of $n changed since that round (code, tests, captures or text) or have an open challenge (\"recheck_reasons\" says why): send ONLY those to the verifiers, ONLY their rows to the capture verifier, and take the clean-verdict sample among them. The other criteria keep their previous adversarial verdict: do not re-read them and do not report them as a coverage gap. Each open challenge of a re-checked criterion gets an answer: confirmed, it stays open; when the counter-verifier agrees that the new evidence meets the criterion, resolve it with accept challenge resolve --challenge CH-NNN --reason … --evidence <the test, code or capture that changed> --verifier … (references/adversarial-protocol.md §7b)."
  elif node "$SDD" accept adversarial plan --fase "$FASE" --json > "$plan" 2>/dev/null; then
    n=$(jq '[.fases[].requirements[].criteria[]] | length' "$plan" 2>/dev/null || echo null); v=$n
  else rm -f "$plan"; fi
  if [ "$tipo" != incremental ] || [ "$v" != 0 ]; then
    claude_etapa acceptance "/sdd-acceptance --adversarial --fase $FASE — $ARNES Independent verifiers read each criterion of FASE-$FASE against production code, tests and captures: the GIVEN situation with its own data and actor, the WHEN, the whole THEN with its exact text, and whether each capture shows it (its «Se ve:» line says what must be on screen). One verifier is dedicated to captures and looks at EVERY capture of the FASE with the full table (criterion, «Se ve», image, test that took it), so that a wrong pattern is reported for all the captures it affects at once. Record confirmed or inconclusive findings with accept challenge add. Do not fix anything and do not sign off. Run the verifier and counter-verification agents in the foreground and wait for their answers in this same session: never schedule reminders, wake-ups, monitors or background waits (nobody will come back to this session), and close the acceptance stage state before you finish.$inc"
    coste=$(echo "$RES" | jq '.cost_usd // 0' 2>/dev/null || echo 0)
  fi
  # La ronda terminó (claude_etapa sale de la etapa si falla): su plan es la base de la siguiente
  [ -s "$plan" ] && mv "$plan" "$base"
  RONDAS=$(jq -c --arg t "$tipo" --argjson n "$n" --argjson v "$v" --argjson c "${coste:-0}" \
    '. + [{tipo: $t, criterios: $n, verificados: $v, coste_usd: $c}]' <<< "$RONDAS")
  # Rápida (sin mutantes): decide si hace falta la pasada de arreglo. Los mutantes, una sola vez, antes de la puerta
  python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" aceptacion "$REPO" --fase "$FASE" --sin-mutantes >/dev/null 2>&1 || jq -n '{graves: 1, error: "hsdd_fidelidad falló: no hay comprobación de fidelidad"}' > ".sdd/hermes/fidelidad-$FASE.json"   # un fallo no deja valer el JSON anterior
}
modelo_veredictos() {  # el del proyecto («aceptar-veredictos», si no el de aceptar); si no, el del perfil global
  local m; m=$(jq -r '.modelos["aceptar-veredictos"] // .modelos.aceptar // .modelos.defecto // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null)
  [ -n "$m" ] && { echo "$m"; return; }
  HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" modelo aceptar-veredictos "$EJEC" 2>/dev/null
}
graves_arreglables() {  # graves de fidelidad que la pasada de arreglo puede arreglar. Una captura mala (sdd lint
  # --captures) en un test ya aceptado y sin permiso firmado no: el implementador no puede tocarlo y solo escribía una
  # pregunta [OPEN]; va a la puerta como pregunta «editar-test <fichero>» (.sdd/questions-fidelidad.md) y decide la persona
  python3 "$ROOT/plugin/hermes-sdd/hsdd_hallazgos.py" arreglables "$REPO" "$FASE" 2>/dev/null ||
    jq -r '.graves // 0' ".sdd/hermes/fidelidad-$FASE.json" 2>/dev/null || echo 0
}
hay_hallazgos() {  # impugnaciones abiertas que los agentes pueden arreglar (no las dudas del propio criterio, SPEC-QUESTION,
  # que son de una persona) o hallazgos graves de fidelidad que la pasada puede arreglar
  [ "$(node "$SDD" accept challenge list --open --fase "$FASE" --json 2>/dev/null | jq -r '[.challenges[]? | select(.state == "open" and .category != "SPEC-QUESTION")] | length')" != 0 ] && return 0
  [ "$(graves_arreglables)" -gt 0 ]
}
hallazgos() {  # en una línea por hallazgo, para el implementador (sin las capturas de tests congelados: son preguntas)
  node "$SDD" accept challenge list --open --fase "$FASE" --json 2>/dev/null | jq -r '.challenges[]? | select(.state == "open" and .category != "SPEC-QUESTION")
    | "- \(.id) \(.req) AC\(.ac) [\(.category)]: «\(.quote)» — evidencia: \((.evidence // []) | map(if type == "object" then (.path + (if .line then ":\(.line)" else "" end)) else tostring end) | join(", "))"' 2>/dev/null
  python3 "$ROOT/plugin/hermes-sdd/hsdd_hallazgos.py" lineas "$REPO" "$FASE" 2>/dev/null
}
# Granularidad del plan (la fija la ruta firmada en .sdd/hermes/granularidad): compacta | normal | fina. «auto» se
# resuelve aquí: compacta si el proyecto es pequeño (≤ 7 REQ-F, un tipo de usuario, sin integraciones,
# datos delicados ni estado complejo), normal si no.
granularidad() {
  local g; g=$(cat .sdd/hermes/granularidad 2>/dev/null || echo auto)
  case "$g" in compacta|normal|fina) echo "$g"; return ;; esac
  # (Las necesidades no cuentan: el cliente enumera cada detalle como una; vasos tenía 7 y es una app mínima.)
  if jq -e '(.facts.req_f // 99) <= 7
            and ([.factors // {} | to_entries[] | select(.key | IN("multi_actor","integrations","sensitive_data","complex_state"))
                  | select(.value.value == "yes")] | length == 0)' .sdd/hermes/ruta.json >/dev/null 2>&1; then
    echo compacta
  else echo normal; fi
}
GRAN=$(granularidad)
# forma_o_falla <plan|tareas> <prompt de arreglo>: lo que la granularidad exige (hsdd_plan.py forma); si falla, una
# pasada de arreglo con la lista y, si sigue fallando, la etapa para con ella
forma_o_falla() {
  [ "$EJEC" = replay ] && return 0   # una grabación no se puede arreglar: lo que dejó es lo que hay
  local f; f=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_plan.py" forma . "$1" "$GRAN" 2>/dev/null || true)
  [ -z "$f" ] && return 0
  claude_etapa "$([ "$1" = plan ] && echo plan-architect || echo task-generator)" "$2. Each line below is a rule the $1 breaks; fix every one: $(printf '%s' "$f" | tr '\n' ';')"
  f=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_plan.py" forma . "$1" "$GRAN" 2>/dev/null || true)
  [ -z "$f" ] || falla "$([ "$1" = plan ] && echo "el plan" || echo "las tareas") no tienen la forma de la granularidad $GRAN: $(printf '%s' "$f" | head -3 | tr '\n' ' ')"
}
# Lo que cambia con la granularidad, en las instrucciones al ejecutor (en inglés, como las skills)
case "$GRAN" in
  compacta) PLAN_G=" COMPACT PLAN (small project): exactly ONE FASE, FASE-0, that delivers every requirement and the whole user journey; no HARDENING FASE (measured NFRs are criteria of FASE-0); its demo walks the whole journey. Write it as a compact plan (skill section «Compact plan (one FASE)»): only plan/PLAN.md, with '> **Plan-Size:** compact', and plan/fases/FASE-0-SKELETON.md ending with '## Plan de la FASE'; no ARCHITECTURE.md, RESEARCH.md, CLARIFY-LOG.md, fases/README.md nor fase-plans/ (taller: 7 files and 675 lines for one FASE)."
            TAREAS_G=" COMPACT TASKS: 3 to 6 tasks per FASE, each a slice that is seen working: the scaffold with all its tooling (test runner and Playwright) in ONE task; the domain logic with its tests; the UI with its tests; the journey e2e with the demo captures. No separate tasks to 'verify criteria' or 'verify constraints' (the acceptance gate does that). Use the --compact task format and, when plan/PLAN.md says 'Plan-Size: compact', write only task/TASK-FASE-0.md (its Critical path line and Stream Ownership; no TASK-ORDER.md)." ;;
  normal)   PLAN_G=" Keep the plan as small as the rules allow: one FASE per user journey, and no separate HARDENING FASE when a measured NFR fits in the FASE that delivers the journey it measures."
            TAREAS_G=" Tasks are slices that are seen working (about 4 to 8 per FASE), not one task per function; no separate tasks to 'verify criteria' or 'verify constraints' (the acceptance gate does that)." ;;
  *)        PLAN_G=""; TAREAS_G="" ;;
esac
# Política de tests (compacta y normal): cada criterio una vez, al nivel más barato, con su literal desde el principio
# (coches: 5 líneas de test por línea de código y 4 de los 9 minutos de la FASE-0 retocando asserts)
[ "$GRAN" = fina ] && TESTS_G="" || TESTS_G=" TEST POLICY: one test per acceptance criterion, at the cheapest level that proves it (unit for logic, DOM for rendering; a real browser only for what needs it and for the demo journey); never test the same criterion at several levels; test each REQ-C constraint once, not in every FASE. Name each test with its 'REQ-X-NNN ACn' and assert the literal example values of the criterion from the first version, so no later pass is needed to align them."
# «Hecho» = desplegable (hsdd_desplegable.py lo comprueba al cerrar): desde la primera FASE, no como arreglo final
DESPLIEGUE_G=" DEPLOYABLE FROM THE START: the first FASE's scaffold task also makes the app runnable as in production: an npm 'start' script that serves the built app (never the dev server), a 'build' script if there is a build step, the server listening on process.env.PORT and process.env.HOST (default 0.0.0.0, never a hard-coded 127.0.0.1), and a README.md that says how to install, test and start it."
desplegable() {  # comprueba que arranca como en producción; si no, UNA pasada de arreglo y se comprueba otra vez
  python3 "$ROOT/plugin/hermes-sdd/hsdd_desplegable.py" "$REPO" > .sdd/hermes/desplegable.json 2>/dev/null ||
    jq -n '{ok: false, fallos: ["la comprobación de despliegue falló (hsdd_desplegable.py)"]}' > .sdd/hermes/desplegable.json
  jq -e '.ok == false' .sdd/hermes/desplegable.json >/dev/null 2>&1 || return 0
  local ULT; ULT=$(ls plan/fases/FASE-*.md 2>/dev/null | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n | tail -1)
  claude_etapa task-implementer "/sdd-task-implementer --fase=${ULT:-0} — $ARNES The app is not deployable yet: $(jq -r '.fallos | join("; ")' .sdd/hermes/desplegable.json). Append ONE task to task/TASK-FASE-${ULT:-0}.md (next id, Refs the stack constraint REQ-C if there is one) and fix it in one commit, without changing behaviour or any existing test:$DESPLIEGUE_G Check it yourself: npm run build (if any), then PORT=4321 HOST=0.0.0.0 NODE_ENV=production npm start must answer on http://127.0.0.1:4321/."
  python3 "$ROOT/plugin/hermes-sdd/hsdd_desplegable.py" "$REPO" > .sdd/hermes/desplegable.json 2>/dev/null ||
    jq -n '{ok: false, fallos: ["la comprobación de despliegue falló (hsdd_desplegable.py)"]}' > .sdd/hermes/desplegable.json
}
# Una sola FASE compacta: la aceptación de la FASE y la entrega van en una sola puerta (la de entrega, con la demo)
revision_independiente() {  # ronda adversarial + hsdd_fidelidad de la FASE $FASE y, mientras encuentren algo que los
  # agentes pueden arreglar, hasta `rondas_arreglo` pasadas de arreglo (2 de serie) con su ronda incremental detrás. Lo
  # técnico lo cierran los agentes; a la persona solo le llega lo que es suyo (dudas del criterio) o lo que no se cerró.
  local MV n max; MV=$(modelo_veredictos)
  max=$(jq -r '.rondas_arreglo // 2' .sdd/hermes/hermes-sdd.json 2>/dev/null || echo 2)
  fidelidad
  n=$(cat ".sdd/hermes/fidelidad-arreglo-$FASE" 2>/dev/null || echo 0)
  case "$n" in ''|*[!0-9]*) n=1 ;; esac   # la marca antigua (vacía) era «ya hubo una»
  while [ "$n" -lt "$max" ] && hay_hallazgos; do
    claude_etapa task-implementer "/sdd-task-implementer --fase=$FASE — $ARNES An independent review of FASE-$FASE found tests or captures that do not prove their criterion, listed below. For each one, add a task to task/TASK-FASE-$FASE.md and fix it (one commit each): the test must do the criterion's GIVEN with its own data and actor, its WHEN, and assert its whole THEN with the exact text; the capture must show the screen where that THEN is visible. Each WRONG-CAPTURE (or capture finding) is a rule, not a single case: apply it to ALL the captures of the FASE, not only to the one cited, and run «sdd lint --captures --fase ${FASE}» before you finish. Fix the code when it is the code that fails. A test that already existed when an earlier FASE was accepted is NOT edited: write an [OPEN] question with «sdd questions add --role task-implementer» instead. Findings: $(hallazgos)"
    MODELO_PASO=$MV claude_etapa acceptance "/sdd-acceptance --fase $FASE — $ARNES Recompute the verdicts, captures and demo of FASE-$FASE after the fixes. Do not sign off."
    fidelidad
    n=$((n + 1)); echo "$n" > ".sdd/hermes/fidelidad-arreglo-$FASE"   # hecha: si se cortaba a mitad, el reintento la repite
  done
}

no_hecho() {  # la explicación del ejecutor cuando termina sin hacer la etapa (su primer párrafo tras la línea stage=…)
  echo "$RES" | jq -r '.resumen // .reason // ""' | grep -v '^stage=' | grep -v '^ *$' | head -1 | cut -c1-300
}
# Antes de abrir la puerta de requisitos, requirements/ debe pasar `sdd lint --needs`: lo que la persona aprueba es
# lo que después leen el plan y la aceptación (p. ej. criterios "- AC1: GIVEN …" que el método no sabe contar).
# Una pasada de corrección del ejecutor; si siguen los errores, la etapa falla en vez de abrir la puerta.
requisitos_legibles() {  # requisitos_legibles <clave-de-estado> <skill>
  local errs
  errs=$(node "$SDD" lint --needs 2>&1 | grep '^error' | head -20) || true
  [ -z "$errs" ] && return 0
  claude_etapa "$1" "/$2 — $ARNES requirements/ fails \`sdd lint --needs\`. Fix ONLY these errors, without changing the meaning of any requirement or criterion:
$errs"
  errs=$(node "$SDD" lint --needs 2>&1 | grep '^error' | head -5) || true
  [ -z "$errs" ] || falla "sdd lint --needs sigue con errores: $(echo "$errs" | tr '\n' ' ')"
}
ejemplos_coherentes() {  # ejemplos_coherentes <clave-de-estado> <skill>: un ejemplo que contradice lo que dice de sí
  # mismo («haya-27» (8 caracteres), «jueves …» que no es jueves) se corrige una vez; lo que quede lo ve la persona
  # en la puerta como aviso grave del encargado (sala: «haya-27» llegó aprobado hasta la implementación)
  local malos
  malos=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" coherencia "$REPO" --json 2>/dev/null |
          jq -r '.coherencia[]? | select(.tipo == "ejemplo") | "- " + .detalle' 2>/dev/null) || true
  [ -z "$malos" ] && return 0
  claude_etapa "$1" "/$2 — $ARNES Some examples in requirements/REQUIREMENTS.md contradict themselves. Fix ONLY these examples (the data of the example, keeping the rule and the meaning of the criterion), and nothing else:
$malos"
}

case "$ETAPA" in
  requisitos)
    VERIF="Verification: usa test siempre que un test pueda leerlo (también en restricciones REQ-C: idioma de los textos, dependencias, stack, sin red); inspection o demo solo para lo que ningún test puede observar, porque eso lo tiene que confirmar una persona a mano en la puerta."
    # La entrada que preparó el encargado (docs/encargado.md, fase 2): sus preguntas ya contestadas y los documentos
    INTAKE=""
    [ -f intent/INT-001/intake.md ] && INTAKE=" Lee también intent/INT-001/intake.md: preguntas que la persona ya contestó (no las repitas; sus respuestas y los Supuestos son decisiones tomadas)."
    [ -d wiki/raw ] && [ -n "$(find wiki/raw -type f ! -name .gitkeep 2>/dev/null | head -1)" ] &&
      INTAKE="$INTAKE Los documentos que entregó están en wiki/raw/ (solo lectura): úsalos como fuente; si hay exportaciones de Jira, CSV, OpenAPI o Notion, impórtalas con sdd-import."
    PARTIDA=.sdd/hermes/requisitos-de-partida.md
    if [ -s "$FB" ] || [ ! -s requirements/REQUIREMENTS.md ]; then
      claude_etapa requirements-engineer "/sdd-requirements-engineer — $ARNES Escribe las necesidades y los requisitos a partir de la petición literal de intent/ (y de lo que ya haya en requirements/). $VERIF$INTAKE"
    elif [ -f "$PARTIDA" ] && [ ! -f .sdd/hermes/requisitos-depurados ]; then
      # Requisitos casi listos de la persona: se DEPURAN (Mode 2 auditar + Mode 3 formato), no se reescriben
      claude_etapa requirements-engineer "/sdd-requirements-engineer — $ARNES La persona trajo sus requisitos casi listos en requirements/REQUIREMENTS.md (copia del original en $PARTIDA). DEPÚRALOS, no los reescribas (Mode 2, audit, y Mode 3, format): conserva cada requisito, su intención y sus ids (si no tienen, asigna REQ-F-NNN, REQ-NF-NNN, REQ-C-NNN) y llévalos al formato del método (EARS, Para el cliente, Needs, Verification, prioridad, criterios con datos concretos), y escribe requirements/CUSTOMER-NEEDS.md a partir de intent/ y del intake. Lo vago, contradictorio o sin criterio comprobable NO lo inventes: deja una pregunta [OPEN] con opciones (una marcada como recomendada, cada una con su efecto) con «sdd questions add --role requirements-engineer» (references/async-questions.md). Al final de REQUIREMENTS.md añade «## Depuración»: por requisito, qué cambió respecto al original (formato, criterio añadido, partido en dos, dudoso → pregunta). $VERIF$INTAKE"
      touch .sdd/hermes/requisitos-depurados
    else RES='{"outcome":"done","reason":"requisitos ya escritos"}'; fi
    requisitos_legibles requirements-engineer sdd-requirements-engineer
    ejemplos_coherentes requirements-engineer sdd-requirements-engineer
    { sed -i.bak -E 's/^> \*\*Status:\*\* *Approved.*/> **Status:** Review/' requirements/REQUIREMENTS.md && rm -f requirements/REQUIREMENTS.md.bak; } 2>/dev/null || true
    git add requirements/ && { git diff --cached --quiet || git commit -qm "docs(requirements): requirements ready for review"; }
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Requisitos listos para revisar" "$P" ;;

  ruta)
    rc=0; node "$SDD" route --json > .sdd/hermes/ruta.json 2>/dev/null || rc=$?
    if [ "$rc" = 3 ]; then   # sin Jev: el ejecutor estima los siete factores; el código decide la ruta
      bash "$ROOT/executors/$(ejecutor ruta).sh" "$REPO" ruta-factores "Read requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md. Estimate the seven route factors (external_customer, sensitive_data, multi_actor, integrations, ui_flows, long_lived, complex_state) as probabilities 0-1, honestly, 0.5 when the text does not say. Write ONLY .sdd/route-answers.json as {\"factors\": {...}}. Do not run anything else." "$(modelo ruta)" >/dev/null
      node "$SDD" route --json --answers .sdd/route-answers.json > .sdd/hermes/ruta.json || falla "sdd route falló"
    fi
    P=$(puerta ruta) || falla "no se pudo abrir la puerta de ruta"
    fin '{"outcome":"done","reason":"ok"}' "Ruta propuesta" "$P" ;;

  dudas)   # antes del plan: las dudas de diseño abiertas, juntas y en una sola puerta (material-montana: 12 preguntas en
           # la puerta del plan, duplicadas y contradictorias, varias que reabrían requisitos ya aprobados)
    python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" normalizar-preguntas "$REPO" >/dev/null 2>&1 || true
    node "$SDD" questions render >/dev/null 2>&1 || true
    abiertas() { node "$SDD" questions list --open --json 2>/dev/null | jq '.questions | length' 2>/dev/null || echo 0; }
    if [ "$(abiertas)" -gt 1 ]; then   # una pasada barata: fusionar las que deciden lo mismo, sin añadir ninguna
      claude_etapa dudas "$ARNES Consolidate the OPEN questions (sdd questions list --open --json) before the plan: when two or more decide the same thing, keep the clearest one and run «sdd questions merge <other> --into <kept>» for the rest; drop (merge into the kept one) any question already decided by an ANSWERED question. Do not add questions, do not answer any, do not edit requirements/, spec/ or any other file, and do not edit the questions JSON by hand."
      node "$SDD" questions render >/dev/null 2>&1 || true
      # La consolidación solo fusiona preguntas: si tocó algo fuera de .sdd/, la etapa para (antes era prosa del prompt)
      FUERA=$( { git diff --name-only "$HEAD0" HEAD; git status --porcelain | cut -c4-; } 2>/dev/null | grep -vE '^(\.sdd|status/questions)/' | sort -u | head -3 | tr '\n' ' ')
      [ -z "$FUERA" ] || falla "la consolidación de dudas cambió ficheros fuera de .sdd/: $FUERA"
    fi
    mkdir -p .sdd/hermes
    if [ "$(abiertas)" -gt 0 ]; then
      touch .sdd/hermes/dudas-diseno
      P=$(puerta preguntas) || falla "no se pudo abrir la puerta de las dudas de diseño"
      fin "$(jq -nc '{outcome:"failed", reason:"esperando tus respuestas: puerta «Dudas antes del plan»"}')" "Dudas de diseño para la persona" "$P"
    fi
    rm -f .sdd/hermes/dudas-diseno
    # Plan → Tareas ya cuelgan de esta tarjeta (lanzar.sh tras_ruta): al acabar bien, siguen solas
    fin '{"outcome":"done","reason":"sin dudas abiertas"}' "Sin dudas de diseño abiertas: sigue el plan" ;;

  especificar|auditar|pruebas|seguridad|tecnico|ux|brechas)   # etapas opcionales: las encadena la ruta (lanzar.sh)
    case "$ETAPA" in
      especificar) CL=specifications-engineer; HECHO="Especificaciones escritas"; PRODUCTO="spec/use-cases spec/domain spec/contracts"
        PIDE="Write the formal specifications in spec/ from the approved requirements/." ;;
      auditar)     CL=spec-auditor; HECHO="Especificaciones auditadas"; PRODUCTO=audits/AUDIT-BASELINE.md
        PIDE="Audit spec/ (baseline audit), then Mode Fix only for defects whose fix is unambiguous." ;;
      pruebas)     CL=test-planner; HECHO="Plan de pruebas escrito"; PRODUCTO=test/TEST-PLAN.md
        PIDE="Write the test plan (test/TEST-PLAN.md, matrices and E2E scenarios) from spec/." ;;
      seguridad)   CL=security-auditor; HECHO="Seguridad revisada"; PRODUCTO=audits/SECURITY-AUDIT-BASELINE.md
        PIDE="Audit the security posture of spec/ (or requirements/ when there is no spec/)." ;;
      tecnico)     CL=tech-designer; HECHO="Diseño técnico escrito"; PRODUCTO=design
        PIDE="Write the technical design in design/, keeping the Stack Profile of AGENTS.md." ;;
      ux)          CL=ux-designer; HECHO="Diseño visual y de uso escrito"; PRODUCTO=ux
        PIDE="Write the UX design in ux/ (design system, wireframes of the screens the requirements need, accessibility)." ;;
      brechas)     CL=gap-detector; HECHO="Huecos entre especificación y código revisados"; PRODUCTO=audits/GAP-ANALYSIS-REVIEW.md
        PIDE="Detect the gaps between spec/ (or requirements/) and the code${FASE:+ of FASE-$FASE}; --semantic." ;;
    esac
    ACT=""; for x in $PRODUCTO; do [ -e "$x" ] && ACT=$(actualizar "$CL") && break; done
    claude_etapa "$CL" "/sdd-$CL — $ARNES $PIDE$ACT"
    hay=""; for x in $PRODUCTO; do [ -e "$x" ] && hay=1; done
    [ -n "$hay" ] || falla "$CL no dejó $PRODUCTO: $(no_hecho)"
    fin "$RES" "$HECHO" ;;

  plan)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: the requirements changed after some FASEs were accepted (tags fase-N-accepted, see changes/). Keep every accepted FASE file as it is (its scope, tasks and order) and add new FASE(s) after the last one, covering only the new or modified requirements. The one edit allowed in an accepted FASE file: a reference (scenario AC-…, requirement or use case id) that the approved requirements change removed or renumbered, so that sdd lint --plan passes."
    # Las etapas opcionales que el arnés no ejecuta quedan saltadas: si no, el plan se niega a arrancar esperando
    # especificaciones que nunca llegan (incidente coches, 11/11/2026). El plan sale de requirements/.
    # Desde 0.3.0 el arnés tiene todas; queda la red para una etapa cuya skill falte en metodo/skills.
    for k in specifications-engineer spec-auditor test-planner security-auditor ux-designer tech-designer gap-detector; do
      [ -d "$ROOT/metodo/skills/sdd-$k" ] && continue
      case "$(bash "$STATE" get "$k" 2>/dev/null)" in done|skipped|running) ;;
        *) bash "$STATE" set "$k" skipped --reason "hermes-sdd no tiene esta etapa: el plan sale de requirements/" >/dev/null 2>&1 || true ;; esac
    done
    echo "$GRAN" > .sdd/hermes/granularidad-plan   # la que se usó: lanzar.sh la lee (una sola FASE compacta)
    if [ -z "$INC" ] && ls plan/fases/FASE-*.md >/dev/null 2>&1 && C=$(req_cambiados) && [ -n "$C" ]; then
      # Ya hay plan y lo que llega es un cambio (material-montana: el plan entero se rehacía tras cada cambio)
      INC=" INCREMENTAL: plan/ already exists and the approved requirements change touched only: $C. Keep every FASE whose requirements did not change exactly as it is; edit only the FASE(s) that contain those requirements (or add a FASE for added ones), and keep the FASE numbering."
    fi
    claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Generate plan/.$INC$PLAN_G"
    ls plan/fases/FASE-*.md >/dev/null 2>&1 || falla "el plan no se generó: $(no_hecho)"
    # Errores del lint: una pasada de reparación con sus líneas (sala, 12/11/2026: una FASE aceptada citaba un escenario
    # que un cambio de requisitos había quitado, y el plan incremental no podía tocarla)
    if ! node "$SDD" lint --plan >/dev/null 2>&1; then
      ERR=$(node "$SDD" lint --plan 2>&1 | grep -v ' warning: ' | head -20 | tr '\n' ' ')
      claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Fix plan/ so that sdd lint --plan has no errors (do not change requirements/ or spec/; warnings may stay). In an accepted FASE file (tag fase-N-accepted) change only the stale references the error names. Errors: $ERR"
      node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores: $(node "$SDD" lint --plan 2>&1 | grep -v ' warning: ' | tail -3 | tr '\n' ' ')"
    fi
    # Criterios que citan una pantalla que entrega una FASE posterior: esa FASE nunca pasaría su aceptación
    # (biblioteca, 11/11/2026). El plan se corrige una vez; lo que quede se avisa en la puerta del plan.
    DEP="$ROOT/plugin/hermes-sdd/hsdd_plan.py"
    H=$(python3 "$DEP" dependencias . --texto 2>/dev/null || true)
    if [ -n "$H" ]; then
      claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Fix plan/ (do not change requirements/): each line below is an acceptance criterion of a requirement planned in a FASE that quotes a screen or view delivered by a later FASE, so that FASE could never pass its acceptance. For each one, either move the requirement to the FASE that delivers that screen, or deliver a minimal version of that screen in the earlier FASE (its FASE file and its plan). $(echo "$H" | tr '\n' ' ')"
      node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores tras corregir dependencias entre FASEs"
      H=$(python3 "$DEP" dependencias . --texto 2>/dev/null || true)
    fi
    # La forma que pide la granularidad (una FASE compacta, sin FASE de endurecimiento…): antes, prosa del prompt; ahora
    # una pasada de arreglo y, si sigue, la etapa para
    forma_o_falla plan "/sdd-plan-architect --skip-clarify — $ARNES Fix the shape of plan/ (do not change requirements/ or spec/)"
    mkdir -p .sdd/hermes
    if [ -n "$H" ]; then printf '%s\n' "$H" > .sdd/hermes/plan-avisos.txt; else rm -f .sdd/hermes/plan-avisos.txt; fi
    fin "$RES" "Plan generado ($(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ') FASEs)" ;;

  tareas)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: generate task files only for the FASEs that do not have one yet; do not touch the task files of accepted FASEs (except to fix what sdd lint --dir task reports as an error)."
    if [ -z "$INC" ] && ls task/TASK-FASE-*.md >/dev/null 2>&1 && C=$(req_cambiados) && [ -n "$C" ]; then
      INC=" INCREMENTAL: task/ already exists and the approved requirements change touched only: $C. Regenerate the task file only of a FASE whose plan file changed (or that has no task file yet); leave every other task file as it is."
    fi
    claude_etapa task-generator "/sdd-task-generator — $ARNES Generate task/ for all FASEs.$INC$TAREAS_G$TESTS_G$DESPLIEGUE_G"
    ls task/TASK-FASE-*.md >/dev/null 2>&1 || falla "las tareas no se generaron: $(no_hecho)"
    # Errores del lint: una pasada de reparación con sus líneas (sala, 13/11/2026: una tarea añadida al rehacer la FASE-5,
    # ya aceptada, faltaba en su «Stream Ownership» y el lint paraba las tareas del cambio siguiente)
    if ! node "$SDD" lint --dir task >/dev/null 2>&1; then
      ERR=$(node "$SDD" lint --dir task 2>&1 | grep -E ' [A-Z]-?[0-9]+ ' | grep -v ' warning' | head -20 | tr '\n' ' ')
      claude_etapa task-generator "/sdd-task-generator — $ARNES Fix task/ so that sdd lint --dir task has no errors (do not change plan/, requirements/ or spec/; do not change any task's status, scope or commit). In the task file of an accepted FASE change only what the error names. Errors: $ERR"
      node "$SDD" lint --dir task >/dev/null 2>&1 || falla "sdd lint de tareas encuentra errores: $(node "$SDD" lint --dir task 2>&1 | grep -v '^ *$' | tail -3 | tr '\n' ' ')"
    fi
    forma_o_falla tareas "/sdd-task-generator — $ARNES Fix the shape of task/ (do not change plan/, requirements/ or spec/; do not change any task's status or commit)"
    P=$(puerta plan) || falla "no se pudo abrir la puerta de plan"
    fin "$RES" "Tareas generadas: $(node "$SDD" tasks status 2>/dev/null | tail -1)" "$P" ;;

  respuestas)   # lo que una persona eligió en una puerta y pide un ajuste (no de requisitos): aquí FASE es el id de la puerta
    F=".sdd/hermes/respuestas-por-aplicar-$FASE.txt"
    [ -s "$F" ] || fin '{"outcome":"done","reason":"ok (no quedan respuestas por aplicar)"}' "Sin respuestas por aplicar"
    claude_etapa task-implementer "$ARNES A person answered these questions at a gate. Apply each chosen answer exactly: it is the person's decision, so it authorizes what it says (for example editing or removing an existing test, or editing the plan). Change only plan/, task/, tests/ and, if an answer requires it, code; never requirements/ or spec/. Keep every existing test passing (run them). One commit per answer, following the repository commit conventions. If an answer turns out to need nothing, change nothing for it. Answers: $(cat "$F")"
    node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores tras aplicar las respuestas: $(node "$SDD" lint --plan 2>&1 | grep -v ' warning: ' | tail -3 | tr '\n' ' ')"
    # Si cambiaron tests o código, la evidencia de la aceptación caduca: se vuelve a sacar (sin firmar nada) y la puerta
    # de calidad tiene que seguir cumpliéndose (la de esa FASE, o la global si las respuestas vienen de la entrega)
    ABIERTAS=""
    ULT=$(git describe --tags --abbrev=0 --match 'entrega-*' --match 'fase-*-accepted' 2>/dev/null || echo "$HEAD0")
    if git diff --name-only "$ULT" HEAD | grep -vqE '^(plan|task|docs|status|acceptance)/|\.md$'; then
      PF=$(jq -r 'select(.tipo == "fase") | .fase // empty' ".sdd/hermes/puertas/$FASE.json" 2>/dev/null || true)
      claude_etapa acceptance "/sdd-acceptance${PF:+ --fase $PF} — $ARNES Tests or code changed after the last acceptance (a person's answers were applied). Re-run the test suites with their JUnit reports and refresh the evidence so the acceptance ledger is current. Do not sign off."
      grc=0; if [ -n "$PF" ]; then node "$SDD" gate --fase "$PF" >/dev/null 2>&1 || grc=$?; else node "$SDD" gate >/dev/null 2>&1 || grc=$?; fi
      # 4 = solo queda una impugnación abierta: la FASE ya está firmada y no se deshace; la decide una persona en la
      # puerta de la entrega, que la enseña con sus botones (material-montana, FASE-1: esto tumbaba la etapa y paraba
      # el proyecto). Cualquier otro fallo sí es de lo aplicado.
      if [ "$grc" = 4 ]; then
        ABIERTAS=$(node "$SDD" accept challenge list --open ${PF:+--fase "$PF"} --json 2>/dev/null | jq -r '[.challenges[]? | select(.state == "open") | .id] | join(", ")' || true)
      else
        [ "$grc" = 0 ] || [ "$grc" = 3 ] || falla "tras aplicar las respuestas, la puerta de calidad${PF:+ de la FASE-$PF} sale con $grc"
      fi
    fi
    mv "$F" "$F.aplicado"
    fin "$RES" "Respuestas de la puerta $FASE aplicadas${ABIERTAS:+ (queda abierta $ABIERTAS: se decide en la entrega)}" ;;

  mantener)   # mantenimiento de un proyecto entregado que pidió una persona (puerta de mantenimiento): sin cambiar el
              # comportamiento; después el cierre (puerta global → entrega). No pasa por el plan: no es trabajo de una FASE
    F=.sdd/hermes/mantenimiento/en-curso.txt
    [ -s "$F" ] || falla "no hay ningún mantenimiento en curso ($F)"
    claude_etapa task-implementer "$ARNES Maintenance of a delivered project, requested by a person: $(cat "$F")
Do it without changing behaviour: requirements/ and spec/ stay as they are and existing tests are not edited (art. 12), except the exact files that a person authorized (a test-edit record in acceptance/decisions.jsonl, written by the notary when a person picked an option with «efecto: editar-test»); other [ANSWERED] questions in .sdd/questions-*.md are the person's decisions: apply them, do not ask again, but they never authorize editing an existing test. Run every test suite (unit and e2e) and keep them green; one commit per logical step, following the repository commit conventions. If something cannot be done without changing a requirement or editing an existing test, do not do it: write an [OPEN] question with «sdd questions add --role task-implementer» and give «efecto: req-change» to any option that needs a requirements change."
    python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" normalizar-preguntas "$REPO" >/dev/null 2>&1 || true
    node "$SDD" questions render >/dev/null 2>&1 || true   # la vista .md de un questions-*.json escrito a mano
    if grep -qs '^## Q-.*\[OPEN\]' .sdd/questions-*.md && P=$(puerta preguntas); then
      fin "$(jq -nc '{outcome:"failed", reason:"esperando tus respuestas: puerta «Preguntas del mantenimiento»"}')" "Mantenimiento parado: preguntas para la persona" "$P"
    fi
    # El código cambió: la evidencia se vuelve a sacar y la puerta global tiene que seguir cumpliéndose
    claude_etapa acceptance "/sdd-acceptance — $ARNES Code changed by maintenance after the last delivery. Re-run the test suites with their JUnit reports and refresh the evidence so the GLOBAL acceptance ledger is current. Do not sign off."
    grc=0; node "$SDD" gate >/dev/null 2>&1 || grc=$?
    [ "$grc" = 0 ] || [ "$grc" = 3 ] || falla "tras el mantenimiento, la puerta de calidad global sale con $grc: $(node "$SDD" gate 2>&1 | tail -1)"
    fin "$RES" "Mantenimiento aplicado; la puerta global se cumple" ;;

  huecos)   # tareas [PLAN GAP] de la FASE cuyas preguntas ya se contestaron en una puerta (lanzar.sh la encadena)
    [ -n "$FASE" ] || falla "falta la FASE"
    HUECOS=$(grep -oE '^- \[ \] TASK-[A-Za-z0-9-]+ .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null | awk '{print $4}' | tr '\n' ' ')
    PREG="the open questions they waited for are answered in .sdd/questions-*.md (Answer: lines, approved at the plan gate)"
    claude_etapa plan-architect "/sdd-plan-architect --fase $FASE --skip-clarify — $ARNES Some tasks of FASE-$FASE are [PLAN GAP] and $PREG. Update ONLY the plan of FASE-$FASE (plan/fase-plans/, plan/fases/ and the SDD Stack Profile of AGENTS.md if an answer requires it) so that it follows those answers. Do not reopen or change any answer."
    claude_etapa task-generator "/sdd-task-generator --fase=$FASE --incremental — $ARNES Replace every [PLAN GAP] task of task/TASK-FASE-$FASE.md with concrete tasks that follow the updated plan. Keep every other task (done or pending) exactly as it is."
    # solo las tareas de esta FASE (club: 41 errores de FASEs ya aceptadas paraban los huecos de la FASE-6)
    node "$SDD" lint --dir task --fase "$FASE" >/dev/null 2>&1 || falla "sdd lint de tareas de la FASE-$FASE encuentra errores tras completar los huecos: $(node "$SDD" lint --dir task --fase "$FASE" 2>&1 | grep -v warning | tail -3 | tr '\n' ' ')"
    ! grep -qE '^- \[ \] .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null || falla "siguen tareas [PLAN GAP] en la FASE-$FASE"
    git add -A plan/ task/ AGENTS.md 2>/dev/null; git diff --cached --quiet || git commit -qm "docs(tasks): FASE-$FASE gaps filled with the approved answers"
    # Las preguntas que dejó el implementador porque no podía hacer esos huecos ya no tienen sentido: las cierra el
    # arnés (no el ejecutor), solo las del implementador y solo si su cabecera nombra una de esas tareas (en el JSON de
    # preguntas con `sdd questions answer`; en las antiguas, solo en el .md, en su bloque)
    python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" cerrar-huecos "$(date +%Y-%m-%d)" "$HUECOS" .sdd/questions-*.md .sdd/questions-*.json >/dev/null 2>&1 || true
    fin "$RES" "Huecos de la FASE-$FASE completados con las respuestas aprobadas" ;;

  implementar)
    [ -n "$FASE" ] || falla "falta la FASE"
    # Un [PLAN GAP] pendiente no lo puede hacer el implementador: lo completa la etapa huecos (incidente hola-astro)
    ! grep -qE '^- \[ \] .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null ||
      falla "la FASE-$FASE tiene tareas [PLAN GAP]: antes hay que completarlas (lanzar.sh rehacer $REPO $FASE)"
    # Tras un rechazo, que todas las tareas estén hechas no termina la FASE: cada punto del rechazo es trabajo nuevo
    # (tareas nuevas en task/TASK-FASE-N.md, test primero, un commit cada una). Lo que exige tocar requirements/ no
    # lo puede hacer: deja una pregunta [OPEN] en vez de saltárselo. Sin ningún commit nuevo la etapa falla.
    rm -f ".sdd/hermes/fidelidad-arreglo-$FASE"
    RECH=""; ANTES=$(git rev-parse HEAD)
    [ -s "$FB" ] && RECH=" This FASE comes back with a person's request (a rejection at its acceptance gate or newly approved requirements): all tasks being done does NOT finish it. Treat every point of the person's request above as new work: add the tasks it needs to task/TASK-FASE-$FASE.md and implement them (test-first, one commit each), including the missing captures and the literal letter of each criterion in its test. If a point needs a change to requirements/ or to the plan (outside your reach), do not skip it: write an [OPEN] question with «sdd questions add --role task-implementer» explaining what change is needed."
    OBS=""; [ -s .sdd/hermes/feedback/observaciones.txt ] && OBS=" The person accepted earlier FASEs with these observations, still pending: add a task for each one to task/TASK-FASE-$FASE.md and do it in this FASE too (they may touch earlier FASEs' captures or screens; tests that already existed are not edited — write an [OPEN] question if one would need it): $(cat .sdd/hermes/feedback/observaciones.txt | tr '\n' ' ')"
    # Citas de tests que un cambio de requisitos dejó viejas (material-montana: un test aceptado de la FASE-0 citaba el
    # texto anterior de REQ-F-018 AC4 y el criterio salía «weakened-test» en la puerta de una FASE posterior). Volver a
    # citar es cambiar solo el comentario (hsdd_fidelidad no lo cuenta como editar un test que ya existía)
    CITAS=$(node "$SDD" lint --quotes --json 2>/dev/null | jq -r '[.findings[]? | select(.code == "Q-02") | "\(.file):\(.line) \(.req) AC\(.ac)"] | unique | .[:30] | join("; ")' 2>/dev/null || true)
    [ -n "$CITAS" ] && CITAS=" The approved requirements changed the text of some criteria that tests already quote: update ONLY those quote comments to the current text (sdd req show <REQ> --ac <n>), in one commit «test: re-quote criteria changed by the requirements» — a comment-only edit, also in tests of accepted FASEs; if the test then no longer checks what the new text says, write an [OPEN] question with efecto endurecer-test instead of changing the test. Stale quotes: $CITAS."
    claude_etapa task-implementer "/sdd-task-implementer --fase=$FASE — $ARNES Implement FASE-$FASE completely, test-first, one commit per task with Refs:/Task: trailers. Before you finish, check every criterion of the FASE: its test does that criterion's own GIVEN (same actor, same dates and data) and WHEN, and asserts its whole THEN with the exact text; its capture shows the screen where that THEN is visible, with the GIVEN's data on screen: take it with the capture helper passing the criterion's «Se ve:» texts (captura(page, testInfo, id, { ve: [...] })), inside the test whose title cites that criterion, after asserting on screen (never right after an API or CSV check); run «sdd lint --captures --fase ${FASE}» and leave it without errors; the e2e suites (old and new) are green. [ANSWERED] questions in .sdd/questions-*.md are the person's decisions: apply them and do not ask them again; an existing test may be edited only in the exact files a person authorized (a test-edit record in acceptance/decisions.jsonl, written by the notary), and the commit cites that question («Autoriza: Q-…»). Write any new question with «sdd questions add --role task-implementer» (a JSON object on stdin: skill, tema, contexto, pregunta, para_cliente, opciones [{letra, texto, cliente, efecto, ficheros, recomendada}], bloquea and, only to recommend req-change, riesgo; the command rejects what breaks references/async-questions.md and says why); never write .sdd/questions-* by hand.$TESTS_G$RECH$OBS${CITAS:-}"
    [ -n "$OBS" ] && AL_TERMINAR+=(".sdd/hermes/feedback/observaciones.txt|.sdd/hermes/feedback/observaciones.aplicadas-$FASE.txt")
    if ! st=$(node "$SDD" tasks status --fase "$FASE" --require-done 2>&1); then
      # Parada en preguntas [OPEN] (p. ej. un criterio que contradice otro): se abren a la persona en una puerta. La
      # tarjeta queda parada para que no corra su hija (Aceptar); al firmar, la FASE se rehace con las respuestas o,
      # si una pide cambiar los requisitos, primero se lanza ese cambio (sala, 12/11/2026: sin esto se quedaba atascada)
      python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" normalizar-preguntas "$REPO" >/dev/null 2>&1 || true
      node "$SDD" questions render >/dev/null 2>&1 || true   # la vista .md de un questions-*.json escrito a mano
    if grep -qs '^## Q-.*\[OPEN\]' .sdd/questions-*.md && P=$(puerta preguntas "$FASE"); then
        fin "$(jq -nc --arg f "$FASE" '{outcome:"failed", reason:("esperando tus respuestas: puerta «Preguntas de la FASE-" + $f + "»")}')" \
          "FASE-$FASE parada: preguntas para la persona" "$P"
      fi
      falla "quedan tareas de la FASE-$FASE sin hacer: $(echo "$st" | tail -1)"
    fi
    # Un cambio de requisitos que no deja criterios fallando puede no necesitar ningún commit: solo se exige cambio
    # cuando la persona rechazó o hay criterios concretos que arreglar
    OBLIGA=""; [ -n "$RECH" ] && { ! head -1 "$FB" 2>/dev/null | grep -q '^Los requisitos cambiaron' ||
      grep -q '^Criterios de la FASE que no pasan' "$FB" 2>/dev/null; } && OBLIGA=1
    if [ -n "$OBLIGA" ] && [ -z "$(git log --format=%H "$ANTES..HEAD" -- . ':!acceptance' ':!status' ':!.sdd' 2>/dev/null)" ]; then
      falla "la FASE-$FASE volvió con cambios pedidos y la implementación no ha cambiado nada: lo pedido necesita algo que esta etapa no puede hacer (mira .sdd/questions-task-implementer.md)"
    fi
    # Antes de entregar, la comprobación rápida de fidelidad (sin LLM ni mutantes): capturas que no enseñan su criterio,
    # tests ya aceptados tocados sin autorizar, ejemplos incoherentes. Lo grave se arregla aquí, una vez, y no en una
    # vuelta de rechazo (club: de 9 implementaciones, 5 fueron repeticiones por esto; cada vuelta, 30-50 min)
    python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" aceptacion "$REPO" --fase "$FASE" --sin-mutantes >/dev/null 2>&1 || jq -n '{graves: 1, error: "hsdd_fidelidad falló: no hay comprobación de fidelidad"}' > ".sdd/hermes/fidelidad-$FASE.json"   # un fallo no deja valer el JSON anterior
    if [ "$(graves_arreglables)" -gt 0 ]; then
      claude_etapa task-implementer "/sdd-task-implementer --fase=$FASE — $ARNES Before handing FASE-$FASE over, a quick check found these problems. Fix each one (a task and a commit each); a problem with a capture is a rule: apply it to every capture of the FASE, not only the one cited:$(hallazgos | grep -v '^- CH-' | tr '\n' ' ')"
    fi
    base=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    node "$SDD" verify --range "$base..HEAD" >/dev/null 2>&1 || falla "sdd verify --range $base..HEAD encuentra commits inválidos"
    # El prompt pedía dejar «sdd lint --captures» sin errores; ahora, tras la pasada de arreglos, es una parada: un error
    # estático de captura (C-01 tras una comprobación por API, C-03 en un test que no cita el criterio) no llega a la
    # aceptación. Solo los estáticos (con línea): los del ledger dependen del último JUnit (material-montana2, M13)
    CE=$(node "$SDD" lint --captures --fase "$FASE" --json 2>/dev/null | jq -r '[.findings[]? | select(.severity == "error" and (.line // 0) > 0)
      | "\(.file):\(.line) \(.code)"] | .[0:3] | join(", ")' 2>/dev/null || true)
    [ -z "$CE" ] || falla "sdd lint --captures --fase $FASE sigue con errores tras la implementación: $CE"
    fin "$RES" "FASE-$FASE implementada: $(echo "$st" | tail -1)" ;;

  aceptar)
    [ -n "$FASE" ] || falla "falta la FASE"
    # Veredictos y re-veredictos: pocos turnos que ejecutan la CLI, con el modelo barato del perfil (club: 9,47 $ con el
    # de la etapa). La ronda adversarial y el implementador siguen con el de la etapa.
    MV=$(modelo_veredictos)
    MODELO_PASO=$MV claude_etapa acceptance "/sdd-acceptance --fase $FASE — $ARNES Produce the per-requirement verdicts with evidence and the FASE demo (captures and a short video in evidencias/FASE-$FASE/). Do not sign off."
    # ¿Los tests y las capturas prueban de verdad cada criterio? (sala: un e2e citaba REQ-F-003 AC3 y ejecutaba otro
    # escenario, con otra vivienda; capturas de otra semana; tests ya aceptados editados sin autorizar). Dos miradas:
    # la ronda adversarial del método (verificadores independientes: el GIVEN con sus datos, el THEN entero, las
    # capturas) y hsdd_fidelidad (determinista: tests congelados, OCR de capturas, mutantes, coherencia).
    revision_independiente
    # Mutantes de los Must de la FASE (una vez, sobre lo que verá la persona): lo que encuentren llega a la puerta
    python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" aceptacion "$REPO" --fase "$FASE" >/dev/null 2>&1 || jq -n '{graves: 1, error: "hsdd_fidelidad falló: no hay comprobación de fidelidad"}' > ".sdd/hermes/fidelidad-$FASE.json"   # un fallo no deja valer el JSON anterior
    P=$(puerta fase "$FASE") || falla "no se pudo abrir la puerta de la FASE-$FASE"
    fin "$RES" "Veredictos y demo de la FASE-$FASE listos" "$P" ;;

  cambio)
    INT=$(cat .sdd/hermes/cambio-actual 2>/dev/null) || falla "no hay ningún cambio en curso (.sdd/hermes/cambio-actual)"
    claude_etapa req-change "/sdd-req-change --batch --cascade=manual --file intent/$INT.md — $ARNES Apply this change request to requirements/ as the next version (Version +1, Status: Review). Answered questions are decisions: write their chosen option as is. For a detail the request leaves open (a figure, a limit, a wording), write the sensible default in the requirement and do not open a question about it; never open a question whose recommended option is req-change."
    requisitos_legibles req-change sdd-req-change
    ejemplos_coherentes req-change sdd-req-change
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Cambio $INT aplicado a los requisitos (pendiente de aprobar)" "$P" ;;

  adoptar)
    claude_etapa reverse-engineer "/sdd-reverse-engineer — $ARNES Adopt this existing repository: derive requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md (Version 1.0, Status: Review) with verifiable criteria, plus retroactive FASEs and findings."
    requisitos_legibles reverse-engineer sdd-reverse-engineer
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Línea base propuesta a partir del código" "$P" ;;

  cierre)
    if unica "$REPO"; then   # una sola FASE compacta: aquí se hacen sus veredictos y su demo (no hubo puerta de FASE)
      MODELO_PASO=$(modelo_veredictos) claude_etapa acceptance "/sdd-acceptance --fase 0 — $ARNES Produce the per-requirement verdicts with evidence and the FASE demo (captures and a short video in evidencias/FASE-0/). Do not sign off."
      # La misma revisión independiente que una puerta de FASE: sin ella la ruta ligera entregaba sin que nadie mirara
      # si los tests y las capturas prueban los criterios (taller, 14/11/2026: 0 impugnaciones porque no hubo ronda)
      FASE=0; revision_independiente
    fi
    rc=0; gate_entrega >/dev/null 2>&1 || rc=$?
    # Entrega parcial: cada FASE entregada ya pasó su puerta; aquí no se cierran huecos de lo que aún no se hizo
    if [ "$rc" != 0 ] && [ "$rc" != 3 ] && ! parcial; then
      HUECOS=$(node "$SDD" gate 2>/dev/null | grep -E 'MISSING|FAILING|STALE' | awk '{print $1" "$2}' | tr '\n' ';')
      ULT=$(ls plan/fases/FASE-*.md | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n | tail -1)
      claude_etapa task-implementer "/sdd-task-implementer --fase=$ULT — $ARNES The GLOBAL acceptance gate is not met. Requirements without evidence: $HUECOS. For each one, first append a task to task/TASK-FASE-$ULT.md (next TASK-F$ULT id, same grammar, Refs the requirement), then implement it test-first (the test name carries the requirement id and criterion, e.g. 'REQ-C-001 AC1'), one commit per task with Task:/Refs: trailers. Do not touch tests that already exist.$TESTS_G"
      claude_etapa acceptance "/sdd-acceptance — $ARNES Compute the GLOBAL per-requirement verdicts (all FASEs) with evidence. Do not sign off."
    elif [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      # Entrega parcial: cada aceptación de FASE corre solo sus tests y el junit guarda la última; sin volver a correrlos
      # todos, las FASEs anteriores salen sin capturas (material-montana2: 15 capturas «sin test» en FASE-0 y 1)
      F=$(tr '\n' ' ' < .sdd/hermes/entrega-parcial | sed 's/ $//')
      claude_etapa acceptance "/sdd-acceptance — $ARNES Partial delivery of FASEs $F. Run the WHOLE test suite (unit and every e2e spec of those FASEs, not only the last one) so the junit reports cover every delivered FASE, and compute the per-requirement verdicts of FASEs $F with evidence. Do not implement anything, do not touch tests and do not sign off."
    fi
    desplegable   # «hecho» = arranca como en producción (un arreglo si no; lo que quede lo ve la puerta como grave)
    # Fidelidad global antes de entregar: tests congelados, capturas, mutantes de todos los Must y coherencia
    # (en una entrega parcial, sin mutantes: los de lo que aún no se hizo saldrían todos «sin comprobar»)
    python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" aceptacion "$REPO" $(parcial && echo --sin-mutantes) >/dev/null 2>&1 || jq -n '{graves: 1, error: "hsdd_fidelidad falló: no hay comprobación de fidelidad"}' > .sdd/hermes/fidelidad-global.json
    P=$(puerta entrega) || falla "no se pudo abrir la puerta de entrega"
    [ -n "${RES:-}" ] || RES='{"outcome":"done","reason":"ok"}'
    fin "$RES" "Cierre: puerta de calidad $(parcial && echo "de la entrega parcial (FASEs $(tr '\n' ' ' < .sdd/hermes/entrega-parcial | sed 's/ $//'))" || echo global) calculada" "$P" ;;

  *) falla "etapa desconocida: $ETAPA" ;;
esac
