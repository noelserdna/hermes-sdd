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
# Ejecutor por etapa: .ejecutores[<etapa>] o, si no, .ejecutor (claude | hermes | replay); el modelo, en .modelos[<etapa>]
# o, si el proyecto no lo fija, el del perfil de modelos global (sdd.json; por defecto «equilibrado»)
ejecutor() { jq -r --arg e "$1" '.ejecutores[$e] // .ejecutor // "claude"' .sdd/hermes/hermes-sdd.json 2>/dev/null || echo claude; }
EJEC=$(ejecutor "$ETAPA")
modelo() {  # el del proyecto (.modelos[<etapa>]); si no fija ninguno, el del perfil global (SDD → Configuración)
  local m; m=$(jq -r --arg e "$1" '.modelos[$e] // .modelos.defecto // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null)
  [ -n "$m" ] && { echo "$m"; return; }
  HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" modelo "$1" "$(ejecutor "$1")" 2>/dev/null
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
  jq -nc --argjson res "$(echo "$res" | jq -c . 2>/dev/null || echo '{}')" --argjson ej "$EJECUCIONES" --argjson r "$ratio" \
    --arg etapa "$ETAPA" --arg fase "$FASE" --arg t "${HERMES_KANBAN_TASK:-}" --arg h0 "$HEAD0" --arg h1 "$head1" \
    --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" --argjson min "$(( ($(date +%s) - T0) / 60 ))" --arg resumen "${2:-}" --arg puerta "${3:-}" '
    {ts: $ts, etapa: $etapa, fase: (if $fase == "" then null else $fase end), tarjeta: (if $t == "" then null else $t end),
     resultado: ($res.outcome // null), motivo: ($res.reason // null), resumen: (if $resumen == "" then null else $resumen end),
     puerta: (if $puerta == "" then null else $puerta end), minutos: $min,
     ejecuciones: [$ej[] | .run], coste_usd: ([$ej[] | .cost_usd // 0] | add // 0), turnos: ([$ej[] | .turns // 0] | add // 0),
     head_antes: $h0, head_despues: $h1, tests_codigo: $r}' >> .sdd/hermes/etapas.jsonl 2>/dev/null || true
}
fin() {  # fin <json-del-ejecutor-o-propio> [resumen] [puerta]
  registrar_etapa "$1" "${2:-}" "${3:-}"
  # Etapa resuelta: las tarjetas bloqueadas de intentos anteriores de esta misma etapa quedan obsoletas y se archivan
  if [ "$(echo "$1" | jq -r .outcome 2>/dev/null)" = done ] && [ -z "${HERMES_SDD_SIN_KANBAN:-}" ]; then
    bash "$ROOT/lanzar.sh" limpiar "$REPO" >/dev/null 2>&1 || true
  fi
  echo "$1" | jq -c --arg r "${2:-}" --arg p "${3:-}" '. + {resumen:$r} + (if $p != "" then {puerta:$p} else {} end)'
  exit 0
}
falla() { fin "$(jq -nc --arg r "$1" '{outcome:"failed", reason:$r}')"; }

# ── Antes de gastar nada: ¿el proyecto está en pausa? ¿la cuota de Claude está agotada? ────────────────────────────
HOME_SDD=${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}
BOARD=$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
if [ -f "$HOME_SDD/pausa/_todo" ] || [ -f "$HOME_SDD/pausa/$BOARD" ]; then
  fin '{"outcome":"scheduled","reason":"proyecto en pausa: /reanudar para seguir"}'
fi
if [ "$EJEC" = claude ] && [ -f "$HOME_SDD/cuota.json" ]; then
  R=$(jq -r '.reset_at // 0' "$HOME_SDD/cuota.json")
  [ "$R" -gt "$(date +%s)" ] && fin "$(jq -nc --arg r "$R" '{outcome:"scheduled", reason:"cuota de Claude agotada", reset_at:$r}')"
fi

FB=".sdd/hermes/feedback/${ETAPA}${FASE:+-$FASE}.txt"
PEDIDO=""; [ -s "$FB" ] && PEDIDO=" La persona revisó la propuesta anterior y pidió estos cambios, que son la prioridad de esta ejecución: «$(cat "$FB")»."
# Lecciones confirmadas de proyectos anteriores para esta etapa (encargado, fase 5): como mucho 5; cada uso se anota
LECC=$(HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_lecciones.py" \
  para-etapa "$ETAPA" --repo "$REPO" --registrar 2>/dev/null || true)
ARNES="Modo arnés (hermes-sdd): sin persona en la sesión; sigue references/modo-arnes.md del plugin.$PEDIDO${LECC:+ $LECC}"

registros_ajenos() {  # registros_ajenos <head-antes> → imprime qué está mal y sale 0; nada y sale 1 si todo es de la CLI
  local f d m
  for f in acceptance/decisions.jsonl acceptance/challenges.jsonl; do
    [ -f "$f" ] || { git cat-file -e "$1:$f" 2>/dev/null && { echo "$f: borrado"; return 0; }; continue; }
    # cada línea que había antes de la etapa sigue ahí (lo nuevo puede quedar en medio: merge=union en el replay)
    d=$(diff <(git show "$1:$f" 2>/dev/null) "$f" || true)
    printf '%s\n' "$d" | grep -q '^<' && { echo "$f: líneas borradas o cambiadas"; return 0; }
    [ "$f" = acceptance/challenges.jsonl ] && continue
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
  local sb=1; case "$ETAPA" in implementar|aceptar|cierre|brechas|adoptar) sb=0 ;; esac
  res=$(SDD_SANDBOX=$sb bash "$ROOT/executors/$EJEC.sh" "$REPO" "$ETAPA${FASE:+-$FASE}" "$2" "$(modelo "$ETAPA")" | tail -1)
  EJECUCIONES=$(jq -c --argjson r "$(echo "$res" | jq -c . 2>/dev/null || echo '{}')" '. + [$r]' <<< "$EJECUCIONES")
  [ "$(echo "$res" | jq -r .outcome)" = done ] || fin "$res" "$(echo "$res" | jq -r .reason)"
  # Post-condición: la etapa no puede quedar a medias en el estado del método
  st=$(bash "$STATE" get "$clave" 2>/dev/null || echo "?")
  if [ "$st" = running ]; then
    bash "$STATE" set "$clave" stale --reason "el ejecutor terminó sin cerrar la etapa" >/dev/null 2>&1
    fin "$(echo "$res" | jq -c '.outcome="failed" | .reason="la etapa quedó en running: marcada stale"')"
  fi
  [ -s "$FB" ] && mv "$FB" "$FB.aplicado"
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
# Lo que cambia con la granularidad, en las instrucciones al ejecutor (en inglés, como las skills)
case "$GRAN" in
  compacta) PLAN_G=" COMPACT PLAN (small project): exactly ONE FASE, FASE-0, that delivers every requirement and the whole user journey; no HARDENING FASE (measured NFRs are criteria of FASE-0); its demo walks the whole journey."
            TAREAS_G=" COMPACT TASKS: 3 to 6 tasks per FASE, each a slice that is seen working: the scaffold with all its tooling (test runner and Playwright) in ONE task; the domain logic with its tests; the UI with its tests; the journey e2e with the demo captures. No separate tasks to 'verify criteria' or 'verify constraints' (the acceptance gate does that)." ;;
  normal)   PLAN_G=" Keep the plan as small as the rules allow: one FASE per user journey, and no separate HARDENING FASE when a measured NFR fits in the FASE that delivers the journey it measures."
            TAREAS_G=" Tasks are slices that are seen working (about 4 to 8 per FASE), not one task per function; no separate tasks to 'verify criteria' or 'verify constraints' (the acceptance gate does that)." ;;
  *)        PLAN_G=""; TAREAS_G="" ;;
esac
# Política de tests (compacta y normal): cada criterio una vez, al nivel más barato, con su literal desde el principio
# (coches: 5 líneas de test por línea de código y 4 de los 9 minutos de la FASE-0 retocando asserts)
[ "$GRAN" = fina ] && TESTS_G="" || TESTS_G=" TEST POLICY: one test per acceptance criterion, at the cheapest level that proves it (unit for logic, DOM for rendering; a real browser only for what needs it and for the demo journey); never test the same criterion at several levels; test each REQ-C constraint once, not in every FASE. Name each test with its 'REQ-X-NNN ACn' and assert the literal example values of the criterion from the first version, so no later pass is needed to align them."
# Una sola FASE compacta: la aceptación de la FASE y la entrega van en una sola puerta (la de entrega, con la demo)
unica() { [ -f .sdd/hermes/granularidad-plan ] && [ "$(cat .sdd/hermes/granularidad-plan)" != fina ] && [ "$(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ')" = 1 ] && ! git tag -l 'fase-*-accepted' | grep -q .; }

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
      claude_etapa requirements-engineer "/sdd-requirements-engineer — $ARNES La persona trajo sus requisitos casi listos en requirements/REQUIREMENTS.md (copia del original en $PARTIDA). DEPÚRALOS, no los reescribas (Mode 2, audit, y Mode 3, format): conserva cada requisito, su intención y sus ids (si no tienen, asigna REQ-F-NNN, REQ-NF-NNN, REQ-C-NNN) y llévalos al formato del método (EARS, Para el cliente, Needs, Verification, prioridad, criterios con datos concretos), y escribe requirements/CUSTOMER-NEEDS.md a partir de intent/ y del intake. Lo vago, contradictorio o sin criterio comprobable NO lo inventes: deja una pregunta [OPEN] con opciones (la recomendada primero) en .sdd/questions-requirements-engineer.md. Al final de REQUIREMENTS.md añade «## Depuración»: por requisito, qué cambió respecto al original (formato, criterio añadido, partido en dos, dudoso → pregunta). $VERIF$INTAKE"
      touch .sdd/hermes/requisitos-depurados
    else RES='{"outcome":"done","reason":"requisitos ya escritos"}'; fi
    requisitos_legibles requirements-engineer sdd-requirements-engineer
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
    claude_etapa "$CL" "/sdd-$CL — $ARNES $PIDE"
    hay=""; for x in $PRODUCTO; do [ -e "$x" ] && hay=1; done
    [ -n "$hay" ] || falla "$CL no dejó $PRODUCTO: $(no_hecho)"
    fin "$RES" "$HECHO" ;;

  plan)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: the requirements changed after some FASEs were accepted (tags fase-N-accepted, see changes/). Keep every accepted FASE file untouched and add new FASE(s) after the last one, covering only the new or modified requirements."
    # Las etapas opcionales que el arnés no ejecuta quedan saltadas: si no, el plan se niega a arrancar esperando
    # especificaciones que nunca llegan (incidente coches, 11/11/2026). El plan sale de requirements/.
    # Desde 0.3.0 el arnés tiene todas; queda la red para una etapa cuya skill falte en metodo/skills.
    for k in specifications-engineer spec-auditor test-planner security-auditor ux-designer tech-designer gap-detector; do
      [ -d "$ROOT/metodo/skills/sdd-$k" ] && continue
      case "$(bash "$STATE" get "$k" 2>/dev/null)" in done|skipped|running) ;;
        *) bash "$STATE" set "$k" skipped --reason "hermes-sdd no tiene esta etapa: el plan sale de requirements/" >/dev/null 2>&1 || true ;; esac
    done
    echo "$GRAN" > .sdd/hermes/granularidad-plan   # la que se usó: lanzar.sh la lee (una sola FASE compacta)
    claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Generate plan/.$INC$PLAN_G"
    ls plan/fases/FASE-*.md >/dev/null 2>&1 || falla "el plan no se generó: $(no_hecho)"
    node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores: $(node "$SDD" lint --plan 2>&1 | tail -3 | tr '\n' ' ')"
    # Criterios que citan una pantalla que entrega una FASE posterior: esa FASE nunca pasaría su aceptación
    # (biblioteca, 11/11/2026). El plan se corrige una vez; lo que quede se avisa en la puerta del plan.
    DEP="$ROOT/plugin/hermes-sdd/hsdd_plan.py"
    H=$(python3 "$DEP" dependencias . --texto 2>/dev/null || true)
    if [ -n "$H" ]; then
      claude_etapa plan-architect "/sdd-plan-architect --skip-clarify — $ARNES Fix plan/ (do not change requirements/): each line below is an acceptance criterion of a requirement planned in a FASE that quotes a screen or view delivered by a later FASE, so that FASE could never pass its acceptance. For each one, either move the requirement to the FASE that delivers that screen, or deliver a minimal version of that screen in the earlier FASE (its FASE file and its plan). $(echo "$H" | tr '\n' ' ')"
      node "$SDD" lint --plan >/dev/null 2>&1 || falla "sdd lint --plan encuentra errores tras corregir dependencias entre FASEs"
      H=$(python3 "$DEP" dependencias . --texto 2>/dev/null || true)
    fi
    mkdir -p .sdd/hermes
    if [ -n "$H" ]; then printf '%s\n' "$H" > .sdd/hermes/plan-avisos.txt; else rm -f .sdd/hermes/plan-avisos.txt; fi
    fin "$RES" "Plan generado ($(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ') FASEs)" ;;

  tareas)
    INC=""; git tag -l 'fase-*-accepted' | grep -q . && INC=" INCREMENTAL: generate task files only for the FASEs that do not have one yet; do not touch the task files of accepted FASEs."
    claude_etapa task-generator "/sdd-task-generator — $ARNES Generate task/ for all FASEs.$INC$TAREAS_G$TESTS_G"
    ls task/TASK-FASE-*.md >/dev/null 2>&1 || falla "las tareas no se generaron: $(no_hecho)"
    node "$SDD" lint --dir task >/dev/null 2>&1 || falla "sdd lint de tareas encuentra errores: $(node "$SDD" lint --dir task 2>&1 | grep -v '^ *$' | tail -3 | tr '\n' ' ')"
    P=$(puerta plan) || falla "no se pudo abrir la puerta de plan"
    fin "$RES" "Tareas generadas: $(node "$SDD" tasks status 2>/dev/null | tail -1)" "$P" ;;

  huecos)   # tareas [PLAN GAP] de la FASE cuyas preguntas ya se contestaron en una puerta (lanzar.sh la encadena)
    [ -n "$FASE" ] || falla "falta la FASE"
    HUECOS=$(grep -oE '^- \[ \] TASK-[A-Za-z0-9-]+ .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null | awk '{print $4}' | tr '\n' ' ')
    PREG="the open questions they waited for are answered in .sdd/questions-*.md (Answer: lines, approved at the plan gate)"
    claude_etapa plan-architect "/sdd-plan-architect --fase $FASE --skip-clarify — $ARNES Some tasks of FASE-$FASE are [PLAN GAP] and $PREG. Update ONLY the plan of FASE-$FASE (plan/fase-plans/, plan/fases/ and the SDD Stack Profile of AGENTS.md if an answer requires it) so that it follows those answers. Do not reopen or change any answer."
    claude_etapa task-generator "/sdd-task-generator --fase=$FASE --incremental — $ARNES Replace every [PLAN GAP] task of task/TASK-FASE-$FASE.md with concrete tasks that follow the updated plan. Keep every other task (done or pending) exactly as it is."
    node "$SDD" lint --dir task >/dev/null 2>&1 || falla "sdd lint de tareas encuentra errores tras completar los huecos"
    ! grep -qE '^- \[ \] .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null || falla "siguen tareas [PLAN GAP] en la FASE-$FASE"
    git add -A plan/ task/ AGENTS.md 2>/dev/null; git diff --cached --quiet || git commit -qm "docs(tasks): FASE-$FASE gaps filled with the approved answers"
    # Las preguntas que dejó el implementador porque no podía hacer esos huecos ya no tienen sentido: las cierra el
    # arnés (no el ejecutor), solo las del implementador y solo si su cabecera nombra una de esas tareas
    python3 - "$(date +%Y-%m-%d)" "$HUECOS" .sdd/questions-*.md <<'PY' 2>/dev/null || true
import re, sys
hoy, huecos, ficheros = sys.argv[1], sys.argv[2].split(), sys.argv[3:]
for f in ficheros:
    try:
        t = open(f).read()
    except OSError:
        continue
    def cerrar(m):
        b = m.group(0); cab = b.split("\n", 1)[0]
        if "skill=sdd-task-implementer" not in cab or not any(h in cab for h in huecos):
            return b
        linea = f"Answer: resuelta por el arnés ({hoy}): las tareas [PLAN GAP] {', '.join(h for h in huecos if h in cab)} se completaron con las respuestas aprobadas en la puerta del plan"
        b = b.replace("[OPEN]", "[ANSWERED]", 1)
        if re.search(r"^Answer:[ \t]*$", b, re.M):
            return re.sub(r"^Answer:[ \t]*$", linea, b, count=1, flags=re.M)
        cuerpo = b.rstrip("\n")
        return cuerpo + "\n" + linea + b[len(cuerpo):]
    nuevo = re.sub(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", cerrar, t, flags=re.M | re.S)
    if nuevo != t:
        open(f, "w").write(nuevo)
PY
    fin "$RES" "Huecos de la FASE-$FASE completados con las respuestas aprobadas" ;;

  implementar)
    [ -n "$FASE" ] || falla "falta la FASE"
    # Un [PLAN GAP] pendiente no lo puede hacer el implementador: lo completa la etapa huecos (incidente hola-astro)
    ! grep -qE '^- \[ \] .*\[PLAN GAP\]' "task/TASK-FASE-$FASE.md" 2>/dev/null ||
      falla "la FASE-$FASE tiene tareas [PLAN GAP]: antes hay que completarlas (lanzar.sh rehacer $REPO $FASE)"
    # Tras un rechazo, que todas las tareas estén hechas no termina la FASE: cada punto del rechazo es trabajo nuevo
    # (tareas nuevas en task/TASK-FASE-N.md, test primero, un commit cada una). Lo que exige tocar requirements/ no
    # lo puede hacer: deja una pregunta [OPEN] en vez de saltárselo. Sin ningún commit nuevo la etapa falla.
    RECH=""; ANTES=$(git rev-parse HEAD)
    [ -s "$FB" ] && RECH=" This FASE comes back with a person's request (a rejection at its acceptance gate or newly approved requirements): all tasks being done does NOT finish it. Treat every point of the person's request above as new work: add the tasks it needs to task/TASK-FASE-$FASE.md and implement them (test-first, one commit each), including the missing captures and the literal letter of each criterion in its test. If a point needs a change to requirements/ or to the plan (outside your reach), do not skip it: write an [OPEN] question in .sdd/questions-task-implementer.md explaining what change is needed."
    claude_etapa task-implementer "/sdd-task-implementer --fase=$FASE — $ARNES Implement FASE-$FASE completely, test-first, one commit per task with Refs:/Task: trailers.$TESTS_G$RECH"
    st=$(node "$SDD" tasks status --fase "$FASE" --require-done 2>&1) || falla "quedan tareas de la FASE-$FASE sin hacer: $(echo "$st" | tail -1)"
    # Un cambio de requisitos que no deja criterios fallando puede no necesitar ningún commit: solo se exige cambio
    # cuando la persona rechazó o hay criterios concretos que arreglar
    OBLIGA=""; [ -n "$RECH" ] && { ! head -1 "$FB.aplicado" 2>/dev/null | grep -q '^Los requisitos cambiaron' ||
      grep -q '^Criterios de la FASE que no pasan' "$FB.aplicado" 2>/dev/null; } && OBLIGA=1
    if [ -n "$OBLIGA" ] && [ -z "$(git log --format=%H "$ANTES..HEAD" -- . ':!acceptance' ':!status' ':!.sdd' 2>/dev/null)" ]; then
      falla "la FASE-$FASE volvió con cambios pedidos y la implementación no ha cambiado nada: lo pedido necesita algo que esta etapa no puede hacer (mira .sdd/questions-task-implementer.md)"
    fi
    base=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    node "$SDD" verify --range "$base..HEAD" >/dev/null 2>&1 || falla "sdd verify --range $base..HEAD encuentra commits inválidos"
    fin "$RES" "FASE-$FASE implementada: $(echo "$st" | tail -1)" ;;

  aceptar)
    [ -n "$FASE" ] || falla "falta la FASE"
    claude_etapa acceptance "/sdd-acceptance --fase $FASE — $ARNES Produce the per-requirement verdicts with evidence and the FASE demo (captures and a short video in evidencias/FASE-$FASE/). Do not sign off."
    P=$(puerta fase "$FASE") || falla "no se pudo abrir la puerta de la FASE-$FASE"
    fin "$RES" "Veredictos y demo de la FASE-$FASE listos" "$P" ;;

  cambio)
    INT=$(cat .sdd/hermes/cambio-actual 2>/dev/null) || falla "no hay ningún cambio en curso (.sdd/hermes/cambio-actual)"
    claude_etapa req-change "/sdd-req-change --batch --cascade=manual --file intent/$INT.md — $ARNES Apply this change request to requirements/ as the next version (Version +1, Status: Review)."
    requisitos_legibles req-change sdd-req-change
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Cambio $INT aplicado a los requisitos (pendiente de aprobar)" "$P" ;;

  adoptar)
    claude_etapa reverse-engineer "/sdd-reverse-engineer — $ARNES Adopt this existing repository: derive requirements/CUSTOMER-NEEDS.md and requirements/REQUIREMENTS.md (Version 1.0, Status: Review) with verifiable criteria, plus retroactive FASEs and findings."
    requisitos_legibles reverse-engineer sdd-reverse-engineer
    P=$(puerta requisitos) || falla "no se pudo abrir la puerta de requisitos"
    fin "$RES" "Línea base propuesta a partir del código" "$P" ;;

  cierre)
    if unica; then   # una sola FASE compacta: aquí se hacen sus veredictos y su demo (no hubo puerta de FASE)
      claude_etapa acceptance "/sdd-acceptance --fase 0 — $ARNES Produce the per-requirement verdicts with evidence and the FASE demo (captures and a short video in evidencias/FASE-0/). Do not sign off."
    fi
    rc=0; node "$SDD" gate >/dev/null 2>&1 || rc=$?
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      HUECOS=$(node "$SDD" gate 2>/dev/null | grep -E 'MISSING|FAILING|STALE' | awk '{print $1" "$2}' | tr '\n' ';')
      ULT=$(ls plan/fases/FASE-*.md | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n | tail -1)
      claude_etapa task-implementer "/sdd-task-implementer --fase=$ULT — $ARNES The GLOBAL acceptance gate is not met. Requirements without evidence: $HUECOS. For each one, first append a task to task/TASK-FASE-$ULT.md (next TASK-F$ULT id, same grammar, Refs the requirement), then implement it test-first (the test name carries the requirement id and criterion, e.g. 'REQ-C-001 AC1'), one commit per task with Task:/Refs: trailers. Do not touch tests that already exist.$TESTS_G"
      claude_etapa acceptance "/sdd-acceptance — $ARNES Compute the GLOBAL per-requirement verdicts (all FASEs) with evidence. Do not sign off."
    fi
    P=$(puerta entrega) || falla "no se pudo abrir la puerta de entrega"
    [ -n "${RES:-}" ] || RES='{"outcome":"done","reason":"ok"}'
    fin "$RES" "Cierre: puerta de calidad global calculada" "$P" ;;

  *) falla "etapa desconocida: $ETAPA" ;;
esac
