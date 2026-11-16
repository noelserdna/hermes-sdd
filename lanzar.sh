#!/usr/bin/env bash
# ORQUESTA el proyecto en su tablero kanban, sin interpretar nada: crea tramos de tarjetas y los encadena.
#
#   lanzar.sh iniciar <repo>                          prepara el repo (sin LLM) y crea el primer tramo
#   lanzar.sh preparar <repo>                         solo prepara el repo y el tablero (el encargado recoge la entrada)
#   lanzar.sh siguiente <repo> <puerta> <resultado>   lo llama el notario al cerrar una puerta
#   lanzar.sh cambio <repo> "<petición>"              un cambio o una funcionalidad nueva (también por /cambio)
#   lanzar.sh adoptar <repo>                          un repo existente sin método: línea base desde el código
#   lanzar.sh rehacer <repo> <N>                      vuelve a lanzar la FASE N: huecos (si quedan [PLAN GAP]) → implementar → aceptar
#   lanzar.sh reintentar <repo> <etapa> [fase] [--de <tarjeta>]   repite una etapa con una tarjeta nueva
#   lanzar.sh esperar <repo> [--tag T] [--max S]      bloquea hasta un evento (etapa terminada, puerta abierta…): una línea
#
# Cada tarjeta de etapa la toma el perfil sdd-estacion y ejecuta `etapa.sh`. Las puertas las abre la propia etapa
# (puerta.sh) y las cierra el notario; después, este script crea el tramo siguiente (qué tramo toca a cada tipo de
# puerta y resultado lo dice lib/transiciones.json; aquí, cada tramo es una función tramo_<nombre>):
#   inicio            → requisitos
#   requisitos ok     → ruta                      requisitos cambios → requisitos (con lo pedido)
#   ruta ok           → plan → tareas             ruta rechazo       → ruta
#   plan conforme     → implementar 0 → aceptar 0 plan cambios       → plan → tareas
#   fase N aceptada   → implementar N+1 → aceptar N+1 (si hay más FASEs)
#   fase N rechazada  → implementar N → aceptar N (con lo pedido)
#   última FASE ok    → cierre (puerta global; cierra huecos si los hay) → PUERTA entrega
#   entrega rechazada → cierre (con lo pedido)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/lib/comun.sh"   # slug, unica
. "$ROOT/lib/transiciones.sh"   # siguiente: qué tramo lanza cada resultado
CMD=$1; REPO=$(cd "$2" && pwd)
BOARD=$(slug "$(basename "$REPO")")   # lib/comun.sh: el mismo nombre que da el plugin
K=(hermes kanban --board "$BOARD")

primera_sin_aceptar() {  # primera FASE del plan sin tag fase-N-accepted (vacío si todas lo tienen)
  local n
  for n in $(ls "$REPO"/plan/fases/FASE-*.md 2>/dev/null | sed -E 's/.*FASE-([0-9]+).*/\1/' | sort -n -u); do
    git -C "$REPO" rev-parse -q --verify "refs/tags/fase-$n-accepted" >/dev/null || { echo "$n"; return; }
  done
}
preparar() {  # lo común a iniciar y adoptar: sin LLM
  cd "$REPO"
  [ -z "$(git status --porcelain)" ] || { echo "ERROR: $REPO tiene cambios sin commit" >&2; exit 1; }
  mkdir -p .sdd/hermes
  for l in pipeline-state.json .sdd/ evidencias/; do grep -qxF "$l" .gitignore 2>/dev/null || echo "$l" >> .gitignore; done
  [ -f pipeline-state.json ] || cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json
  if [ ! -f .sdd/hermes/hermes-sdd.json ]; then
    cp "$ROOT/templates/hermes-sdd.json" .sdd/hermes/hermes-sdd.json
    # El ejecutor de los proyectos nuevos (sdd.json «ejecutor»: claude | github), si se fijó para todos
    EJ=$(jq -r '.ejecutor // empty' "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/sdd.json" 2>/dev/null || true)
    if [ -n "$EJ" ]; then t=$(mktemp); jq --arg e "$EJ" '.ejecutor = $e' .sdd/hermes/hermes-sdd.json > "$t" && mv "$t" .sdd/hermes/hermes-sdd.json; fi
  fi
  bash "$ROOT/metodo/scripts/install-git-hooks.sh" -C "$REPO" --quiet
  [ -f AGENTS.md ] || { cp "$ROOT/templates/AGENTS.md" AGENTS.md; echo "AVISO: AGENTS.md creado desde la plantilla; revisa el Stack Profile" >&2; }
  [ "$(jq -r '.ejecutor // "claude"' .sdd/hermes/hermes-sdd.json)" = github ] && caja_github
  git add -A && { git diff --cached --quiet || git commit -qm "chore(sdd): set up hermes-sdd"; }
  [ "$(jq -r '.ejecutor // "claude"' .sdd/hermes/hermes-sdd.json)" = github ] && git push -q origin HEAD 2>/dev/null || true
  asegurar_tablero
}
caja_github() {  # el proyecto trabaja en la caja de GitHub (executors/github.sh): repo público, workflow y secreto
  command -v gh >/dev/null || { echo "ERROR: la caja de GitHub necesita gh (GitHub CLI)" >&2; exit 1; }
  if ! git remote get-url origin >/dev/null 2>&1; then
    local dueno; dueno=$(jq -r '.github.dueno // empty' "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/sdd.json" 2>/dev/null || true)
    [ -n "$dueno" ] || dueno=$(gh api user -q .login)
    # Público: así lo quiere quien usa el arnés, y en repos públicos los minutos de Actions no cuestan
    gh repo create "$dueno/$BOARD" --public --source . --description "$(basename "$REPO") · hecho con hermes-sdd" >/dev/null ||
      { echo "ERROR: no se pudo crear el repo $dueno/$BOARD en GitHub" >&2; exit 1; }
  fi
  mkdir -p .github/workflows
  cp "$ROOT/templates/github/sdd-etapa.yml" .github/workflows/sdd-etapa.yml
  local gh_repo; gh_repo=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)
  if [ -n "$gh_repo" ] && ! gh secret list -R "$gh_repo" 2>/dev/null | grep -q '^CLAUDE_CODE_OAUTH_TOKEN'; then
    # El token de la caja se guarda UNA vez en el llavero de macOS (servicio «hermes-sdd-caja»): cada repo nuevo lo
    # recibe de ahí, sin que se muestre (GitHub no deja leer un secreto ya guardado para copiarlo a otro repo)
    if command -v security >/dev/null && security find-generic-password -s hermes-sdd-caja -w >/dev/null 2>&1; then
      # Solo si tiene forma de token de Claude Code (taller2: el llavero guardaba otra cosa del portapapeles y la caja
      # falló con 401); el valor no se muestra nunca
      if security find-generic-password -s hermes-sdd-caja -w | tr -d '[:space:]' | grep -qE '^sk-ant-oat[0-9]+-[A-Za-z0-9_-]{40,}$'; then
        security find-generic-password -s hermes-sdd-caja -w | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN -R "$gh_repo" >/dev/null &&
          echo "Token de la caja puesto en $gh_repo (desde el llavero)" >&2
      else
        echo "AVISO: lo guardado en el llavero (hermes-sdd-caja) no tiene forma de token de Claude Code (sk-ant-oat01-…): no se pone en $gh_repo. Vuelve a guardarlo." >&2
      fi
    else
      echo "AVISO: falta el token de Claude en $gh_repo. Para que los próximos repos lo reciban solos, guárdalo una vez en" >&2
      echo "el llavero (copia el token y ejecuta): security add-generic-password -U -s hermes-sdd-caja -a claude -w \"\$(pbpaste | tr -d '[:space:]')\"" >&2
      echo "y para este repo: pbpaste | tr -d '[:space:]' | gh secret set CLAUDE_CODE_OAUTH_TOKEN -R $gh_repo" >&2
    fi
  fi
}
asegurar_tablero() {
  hermes kanban boards list --json | jq -e --arg b "$BOARD" 'any(.[]; .slug == $b)' >/dev/null ||
    hermes kanban boards create "$BOARD" --name "$(basename "$REPO")" --default-workdir "$REPO" >/dev/null
}

con_huecos() {  # ¿quedan tareas [PLAN GAP] sin hacer en la FASE N? (sus preguntas se contestaron en la puerta del plan)
  grep -qE '^- \[ \] .*\[PLAN GAP\]' "$REPO/task/TASK-FASE-$1.md" 2>/dev/null
}
viejas_de_fase() {  # archiva las tarjetas paradas o en espera de la FASE N (huecos, implementar, aceptar): se rehace
  local l; l=$("${K[@]}" list --json 2>/dev/null) || return 0   # sin tablero legible no se archiva nada
  printf '%s' "$l" | jq -r --arg n "$1" '.[]? | select(.assignee == "sdd-estacion" and (.status == "blocked" or .status == "todo" or .status == "triage" or .status == "ready"))
    | select((.body // "") | test("etapa\\.sh \\S+ (huecos|implementar|aceptar) " + $n + "$")) | .id' 2>/dev/null | while read -r id; do
    "${K[@]}" comment "$id" "Obsoleta: la FASE-$1 se vuelve a lanzar con tarjetas nuevas." >/dev/null 2>&1 || true
    "${K[@]}" archive "$id" >/dev/null 2>&1 || true
  done || true
}
fase_n() {  # fase_n <N> [sufijo]: (huecos →) implementar → aceptar la FASE N; imprime el id de la primera tarjeta
  local h="-" t primera=""
  viejas_de_fase "$1"
  if con_huecos "$1"; then h=$(tarjeta "Completar huecos del plan FASE-$1" - 60m huecos "$1"); primera=$h; fi
  t=$(tarjeta "Implementar FASE-$1${2:-}" "$h" 120m implementar "$1"); primera=${primera:-$t}
  if unica "$REPO"; then   # una sola FASE: sus veredictos y su demo los hace el cierre, y se aceptan con la entrega
    cierre "$t" "Cierre: demo, puerta global y entrega" >/dev/null
  else
    tarjeta "Aceptar FASE-$1" "$t" 60m aceptar "$1" >/dev/null
  fi
  echo "$primera"
}

cambio_corto() {  # ¿el cambio aprobado se puede hacer sin replanificar? Imprime las FASEs a rehacer (vacío si no).
  # Sí cuando no añade ni quita requisitos y cada requisito cambiado ya está en una FASE sin aceptar: el plan sigue
  # valiendo y basta con rehacer esas FASEs. Compara REQUIREMENTS.md con la versión aprobada anterior.
  local prev
  prev=$(git -C "$REPO" tag -l 'requirements-v*' --sort=-v:refname | sed -n 2p)
  [ -n "$prev" ] || return 0
  python3 - "$REPO" "$prev" <<'PY'
import re, subprocess, sys
from pathlib import Path
repo, prev = Path(sys.argv[1]), sys.argv[2]
def bloques(t):
    return {m.group(1): m.group(0) for m in re.finditer(r"^### (REQ-[A-Z]+-\d+).*?(?=^### |^## |\Z)", t, re.M | re.S)}
antes = bloques(subprocess.run(["git", "-C", str(repo), "show", f"{prev}:requirements/REQUIREMENTS.md"], capture_output=True, text=True).stdout)
ahora = bloques((repo / "requirements/REQUIREMENTS.md").read_text())
if not antes or set(antes) != set(ahora):
    sys.exit(0)
cambiados = [r for r in ahora if antes[r] != ahora[r]]
if not cambiados:   # los requisitos no cambian (un cambio que solo corrige la especificación): se sigue donde se estaba
    print("IGUAL"); sys.exit(0)
fases = {}
for f in sorted((repo / "plan/fases").glob("FASE-*.md")):
    n = re.match(r"FASE-0*(\d+)", f.name).group(1)
    cab = f.read_text().split("\n## ", 1)[0]
    linea = next((l for l in cab.splitlines() if re.search(r"\b(Requisitos|Requirements)\b[*\s]*:", l, re.I)), "")
    for r in re.findall(r"REQ-[A-Z]+-\d+", linea):
        fases.setdefault(r, set()).add(n)
aceptada = lambda n: subprocess.run(["git", "-C", str(repo), "rev-parse", "-q", "--verify", f"refs/tags/fase-{n}-accepted"], capture_output=True).returncode == 0
rehacer = set()
entregado = bool(subprocess.run(["git", "-C", str(repo), "tag", "-l", "entrega-*"], capture_output=True, text=True).stdout.strip())
for r in cambiados:
    if fases.get(r) and all(aceptada(n) for n in fases[r]) and entregado:
        continue   # ya entregado: se vuelve a comprobar con el cierre (abajo), no se replanifica
    if not fases.get(r) or any(aceptada(n) for n in fases[r]):
        sys.exit(0)
    rehacer |= fases[r]
# Solo retoques de criterios de requisitos ya entregados (taller3, INT-002: aclarar la frase de un criterio que la app
# ya cumplía reiniciaba ruta, especificaciones, diseño, plan…): se comprueba otra vez con el cierre, que arregla lo que
# no cumpla el criterio nuevo
print("REVISAR" if not rehacer else " ".join(sorted(rehacer, key=int)))
PY
}

# Etapas opcionales en el orden del método: clave del estado | etapa de etapa.sh | título de la tarjeta
OPCIONALES="specifications-engineer|especificar|Especificaciones
spec-auditor|auditar|Auditoría de especificaciones
test-planner|pruebas|Plan de pruebas
security-auditor|seguridad|Revisión de seguridad
tech-designer|tecnico|Diseño técnico
ux-designer|ux|Diseño visual y de uso"
toca() {  # toca <clave>: ¿la ruta confirmada la ejecuta y aún no está hecha?
  jq -e --arg k "$1" '(.route.stages[$k].run == true) and (.stages[$k].status != "done")' "$REPO/pipeline-state.json" >/dev/null 2>&1
}
tras_ruta() {  # las etapas opcionales que pide la ruta → Plan → Tareas, encadenadas; imprime la primera
  local padre=- primera="" clave etapa titulo t
  while IFS='|' read -r clave etapa titulo; do
    toca "$clave" || continue
    t=$(tarjeta "$titulo" "$padre" 90m "$etapa"); padre=$t; primera=${primera:-$t}
  done <<< "$OPCIONALES"
  # Las dudas de diseño abiertas se deciden juntas ANTES del plan (material-montana: 12 preguntas en la puerta del plan,
  # varias que reabrían requisitos); la etapa «dudas» encadena Plan → Tareas cuando no queda ninguna
  t=$(tarjeta "Dudas de diseño" "$padre" 30m dudas); primera=${primera:-$t}
  echo "$primera"
}
plan_y_tareas() {  # Plan → Tareas; imprime la primera
  local t; t=$(tarjeta "Plan" - 60m plan)
  tarjeta "Tareas" "$t" 60m tareas >/dev/null
  echo "$t"
}
ruta_o_sigue() {  # tras un cambio de requisitos: la ruta ya confirmada sigue valiendo → sus etapas; si no, la puerta «Ruta»
  # (material-montana: cada cambio volvía a preguntar la misma ruta). Vale si alguien la confirmó, no hay entrega y la
  # ruta que el método recomienda ahora no pide ninguna etapa que la confirmada no tenga.
  local st="$REPO/pipeline-state.json" conf nueva ans=()
  if jq -e '.route.confirmedBy // empty' "$st" >/dev/null 2>&1 && ! git -C "$REPO" tag -l 'entrega-*' | grep -q . &&
     conf=$(jq -c '[.route.stages // {} | to_entries[] | select(.value.run == true) | .key]' "$st" 2>/dev/null); then
    [ -f "$REPO/.sdd/route-answers.json" ] && ans=(--answers .sdd/route-answers.json)
    if nueva=$(cd "$REPO" && node "$ROOT/metodo/scripts/sdd.mjs" route --json ${ans[@]+"${ans[@]}"} 2>/dev/null |
               jq -c '[.stages // {} | to_entries[] | select(.value.run == true) | .key]') && [ -n "$nueva" ] &&
       jq -en --argjson c "$conf" --argjson n "$nueva" '($n - $c) | length == 0' >/dev/null; then
      echo "La ruta confirmada sigue valiendo: se rehacen sus etapas sin volver a preguntarla" >&2
      tras_ruta; return 0
    fi
  fi
  tarjeta "Ruta" - 20m ruta
}
mantener() {  # el mantenimiento en curso (.sdd/hermes/mantenimiento/en-curso.txt) → cierre (puerta global → entrega)
  local t l
  # las tarjetas de un mantenimiento anterior paradas o en espera (y su cierre) quedan obsoletas
  if l=$("${K[@]}" list --json 2>/dev/null); then
    printf '%s' "$l" | jq -r '.[]? | select(.assignee == "sdd-estacion" and (.status == "blocked" or .status == "todo" or .status == "triage" or .status == "ready"))
      | select((.body // "") | test("etapa\\.sh \\S+ (mantener|cierre)$")) | .id' 2>/dev/null | while read -r id; do
      "${K[@]}" comment "$id" "Obsoleta: el mantenimiento se vuelve a lanzar con tarjetas nuevas." >/dev/null 2>&1 || true
      "${K[@]}" archive "$id" >/dev/null 2>&1 || true
    done || true
  fi
  t=$(tarjeta "Mantenimiento" - 120m mantener)
  cierre "$t" "Cierre: puerta global y entrega (mantenimiento)" >/dev/null
  echo "$t"
}
cierre() {  # cierre [padre] [título]: (huecos entre especificación y código, si la ruta los pide →) cierre
  local p=${1:--}
  toca gap-detector && p=$(tarjeta "Huecos entre especificación y código" "$p" 60m brechas)
  tarjeta "${2:-Cierre: puerta global y entrega}" "$p" 120m cierre
}

tarjeta() {  # tarjeta <título> <padre|-> <runtime> <etapa> [fase] — imprime el id
  # Con ORIGEN (lo pone el notario: «puerta <id>»), la tarjeta lleva la línea «Origen: <origen> · <título>» y, si ya
  # existe una tarjeta viva con esa línea, se devuelve esa en vez de crear otra: el notario puede repetir el encadenado
  # tras caerse entre crear las tarjetas y apuntarlo en el acta, y antes eso duplicaba el tramo (dos agentes, dos costes)
  local origen="" ya
  if [ -n "${ORIGEN:-}" ]; then
    origen="Origen: $ORIGEN · $1"
    ya=$("${K[@]}" list --json 2>/dev/null | jq -r --arg o "$origen" \
      '[.[]? | select(.status != "archived" and ((.body // "") | split("\n") | index($o)))][0].id // empty' 2>/dev/null || true)
    if [ -n "$ya" ]; then echo "$ya"; return 0; fi
  fi
  local args=("$1" --assignee sdd-estacion --workspace "dir:$REPO" --max-runtime "$3" --max-retries 1
              --body "${origen:+$origen
}Ejecuta: bash $ROOT/etapa.sh $REPO $4${5:+ $5}" --json)
  if [ "$2" != - ]; then args+=(--parent "$2")
  elif [ -n "${RAIZ:-}" ]; then args+=(--parent "$RAIZ"); fi   # el tramo espera a una tarjeta previa (respuestas)
  "${K[@]}" create "${args[@]}" | jq -r .id
}

# ── Tramos que encadena «siguiente» tras firmar una puerta ─────────────────────────────────────────────────────────
# Cuál toca a cada tipo de puerta y resultado lo dice lib/transiciones.json (tests/transiciones.sh comprueba que cada
# tramo de la tabla existe aquí y que aquí no sobra ninguno). Leen GATE, P (la puerta), TIPO y FASE.
tramo_requisitos_aprobados() {
  if [ "$(jq -r '.adopcion // false' "$P")" = true ]; then
    rm -f "$REPO/.sdd/hermes/adopcion"; echo "Línea base aprobada: los cambios entran con /cambio"; return 0
  fi
  rm -f "$REPO/.sdd/hermes/cambio-actual"
  if [ -s "$REPO/.sdd/hermes/mantenimiento/en-curso.txt" ]; then
    # El cambio lo pidió un mantenimiento en curso (para poder hacerlo): se sigue con él, no se replanifica
    mantener; return 0
  fi
  local RF N
  RF=$(cambio_corto)
  N=$(primera_sin_aceptar)
  if ! ls "$REPO"/plan/fases/FASE-*.md >/dev/null 2>&1; then
    # Aún no hay plan (un cambio pedido al aprobar los primeros requisitos): se sigue por la ruta, como siempre
    ruta_o_sigue
  elif [ "$RF" = REVISAR ]; then
    echo "Cambio que solo retoca criterios de lo ya entregado: se comprueba otra vez con el cierre (sin replanificar)"
    cierre - "Cierre: comprobar los criterios cambiados"
  elif [ "$RF" = IGUAL ]; then
    # Mismos requisitos (el cambio solo tocó la especificación): sin replanificar, sigue la FASE en curso
    echo "Cambio sin cambios en los requisitos: se sigue con ${N:+la FASE-$N}${N:-el cierre}"
    if [ -n "$N" ]; then fase_n "$N" " (especificación corregida)"; else cierre; fi
  elif [ -n "$RF" ] && [ -n "$N" ] && [ "${RF%% *}" -ge "$N" ]; then
    # Cambio sin replanificar: el plan sigue valiendo; la FASE en curso se rehace con los requisitos nuevos
    # (las FASEs posteriores ya los leerán al implementarse)
    mkdir -p "$REPO/.sdd/hermes/feedback"
    { echo "Los requisitos cambiaron (aprobados en $(git -C "$REPO" tag -l 'requirements-v*' --sort=-v:refname | head -1)): ajusta el código y los tests de la FASE-$N a los criterios actuales (sus números pueden haber cambiado)."
      (cd "$REPO" && node "$ROOT/metodo/scripts/sdd.mjs" accept --fase "$N" --json 2>/dev/null) | jq -r '
        (.scope.requirements // []) as $s
        | [.requirements[] | select(.verdict != "VERIFIED" and (($s | length) == 0 or (.id as $i | $s | index($i))))
           | .id as $id | .criteria[]? | select(.state != "pass")
           | "- \($id) AC\(.n // .index): \(.state)"
             + (if ((.literal_gaps // []) | length) > 0 then " — el test no lleva la letra literal: " + ([.literal_gaps[].literal] | unique | join(", ")) else "" end)
             + (if .visual == "missing" then " — falta su captura" else "" end)]
        | if length > 0 then "Criterios de la FASE que no pasan la aceptación (corrígelos todos):", .[] else empty end' || true
    } >> "$REPO/.sdd/hermes/feedback/implementar-$N.txt" 2>/dev/null || true   # >>: sin borrar lo que pidió la persona al rechazar
    # La puerta de esa FASE que quedó abierta (bloqueada por lo que este cambio resuelve) ya no tiene sentido
    # (la misma regla que puerta.sh, en el núcleo: transición abierta → superada con el cerrojo del índice)
    for tj in $(HERMES_SDD_HOME="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" superar "$REPO" fase "$N" "$GATE"); do
      "${K[@]}" archive "$tj" >/dev/null 2>&1 || true
    done
    echo "Cambio sin replanificar (requisitos de las FASEs $RF): se rehace la FASE-$N"
    fase_n "$N" " (requisitos nuevos)"
  else
    ruta_o_sigue
  fi
}
tramo_requisitos_otra_vez() { tarjeta "Requisitos (cambios)" - 40m requisitos; }
tramo_tras_ruta() { tras_ruta; }
tramo_ruta_otra_vez() { tarjeta "Ruta (otra vez)" - 20m ruta; }
tramo_fases_o_cierre() {  # la primera FASE sin aceptar o, si no queda ninguna (un cambio sin FASE nueva), el cierre
  local N; N=$(primera_sin_aceptar)
  if [ -n "$N" ]; then fase_n "$N"; else cierre; fi
}
tramo_plan_otra_vez() { local t; t=$(tarjeta "Plan (cambios)" - 60m plan); tarjeta "Tareas" "$t" 60m tareas; }
tramo_rehacer_fase() { fase_n "$FASE" " (cambios)"; }
tramo_reabrir_puerta() { bash "$ROOT/puerta.sh" "$REPO" "$TIPO" ${FASE:+"$FASE"}; }   # la misma puerta, sin lo descartado
tramo_entregado() { rm -f "$REPO/.sdd/hermes/mantenimiento/en-curso.txt"; echo "Proyecto entregado"; }
tramo_rehacer_entrega() {  # una sola FASE: se rehace (implementar con lo pedido → cierre); si no, solo el cierre
  if [ "$(jq -r '.unica // false' "$P")" = true ]; then fase_n 0 " (cambios)" >/dev/null
  else tarjeta "Cierre (otra vez)" - 120m cierre; fi
}
tramo_tras_preguntas() {
  if [ -n "$FASE" ]; then fase_n "$FASE" " (respuestas)"
  elif [ -f "$REPO/.sdd/hermes/dudas-diseno" ] && [ ! -s "$REPO/.sdd/hermes/mantenimiento/en-curso.txt" ]; then
    # dudas de diseño contestadas: la tarjeta «Dudas» parada queda obsoleta y sigue el plan
    rm -f "$REPO/.sdd/hermes/dudas-diseno"
    local l; if l=$("${K[@]}" list --json 2>/dev/null); then
      printf '%s' "$l" | jq -r '.[]? | select(.assignee == "sdd-estacion" and .status == "blocked")
        | select((.body // "") | test("etapa\\.sh \\S+ dudas$")) | .id' 2>/dev/null | while read -r id; do
        "${K[@]}" comment "$id" "Obsoleta: las dudas se contestaron en su puerta; sigue el plan." >/dev/null 2>&1 || true
        "${K[@]}" archive "$id" >/dev/null 2>&1 || true
      done
    fi
    plan_y_tareas
  else mantener; fi
}
tramo_mantenimiento_cambio() {  # se arregla sin cambiar el comportamiento y se entrega otra vez (no pasa por requisitos
  # ni plan; si hiciera falta cambiar un requisito, la etapa lo pregunta)
  cp "$REPO/.sdd/hermes/mantenimiento/peticion-$GATE.txt" "$REPO/.sdd/hermes/mantenimiento/en-curso.txt"
  mantener
}

case "$CMD" in
  preparar)     # repo y tablero listos, SIN tarjetas: el encargado prepara la entrada y lo lanza (encargado.sh lanzar)
    preparar
    touch .sdd/hermes/preparando
    echo "Proyecto $BOARD preparado: su encargado recoge la entrada; se lanza con encargado.sh lanzar $REPO" ;;

  iniciar)
    preparar
    T=$(tarjeta "Requisitos" - 40m requisitos)
    echo "Proyecto $BOARD en marcha: $T (requisitos)" ;;

  adoptar)
    preparar
    touch .sdd/hermes/adopcion
    T=$(tarjeta "Adoptar: requisitos desde el código" - 60m adoptar)
    echo "Adopción de $BOARD en marcha: $T" ;;

  cambio)
    PETICION=$3
    asegurar_tablero
    cd "$REPO"; mkdir -p intent .sdd/hermes
    # El mismo origen (una puerta que el notario vuelve a encadenar) no abre otro cambio: se reutiliza su INT
    YA=""; [ -z "${ORIGEN:-}" ] || YA=$(grep -lxF "Origen: $ORIGEN" intent/INT-*.md 2>/dev/null | head -1 || true)
    if [ -n "$YA" ]; then
      INT=$(basename "$YA" .md)
    else
      N=$(( $(find intent -name 'INT-*.md' | wc -l) + 1 )); INT=$(printf 'INT-%03d' "$N")
      { echo "# $INT"; echo; echo "Petición literal ($(date +%Y-%m-%d)):"; echo; printf '%s\n' "$PETICION" | sed 's/^/> /'
        [ -z "${ORIGEN:-}" ] || { echo; echo "Origen: $ORIGEN"; }; } > "intent/$INT.md"
      git add "intent/$INT.md" && git commit -qm "docs(intent): $INT"
    fi
    echo "$INT" > .sdd/hermes/cambio-actual
    T=$(tarjeta "Cambio $INT" - 60m cambio)
    echo "Cambio $INT en marcha en $BOARD: $T" ;;

  siguiente)
    GATE=$3; RESULTADO=$4
    P="$REPO/.sdd/hermes/puertas/$GATE.json"
    TIPO=$(jq -r .tipo "$P"); FASE=$(jq -r '.fase // empty' "$P")
    # Qué tramo lanza este resultado lo dice la tabla de transiciones (lib/transiciones.json); el código de cada tramo
    # es su función tramo_<nombre>, arriba. «fin»: no se lanza nada (y se dice por qué).
    DESTINO=$(trans_destino "$TIPO" "$RESULTADO") || { echo "Sin tramo siguiente para $TIPO:$RESULTADO"; exit 0; }
    TRAMO=$(jq -r '.tramo' <<< "$DESTINO")
    if [ "$TRAMO" = fin ]; then jq -r '.mensaje // "Sin tramo siguiente"' <<< "$DESTINO"; exit 0; fi
    declare -F "tramo_$TRAMO" >/dev/null || { echo "ERROR: la tabla pide el tramo «${TRAMO}», que lanzar.sh no tiene" >&2; exit 2; }
    "tramo_$TRAMO" ;;

  respuestas)   # respuestas elegidas en una puerta que piden ajustar plan, tareas o tests: se aplican primero y el tramo
                # siguiente de esa puerta espera a que terminen
    GATE=$3; RESULTADO=$4
    T=$(tarjeta "Aplicar respuestas ($(jq -r '.titulo // .tipo' "$REPO/.sdd/hermes/puertas/$GATE.json"))" - 60m respuestas "$GATE")
    RAIZ="$T" bash "$0" siguiente "$REPO" "$GATE" "$RESULTADO" >/dev/null
    echo "$T" ;;

  entregar)     # entrega parcial: lo aceptado hasta ahora (tags fase-N-accepted) se entrega ya; el resto del plan sigue
                # pendiente y se retoma con el encadenado normal (material-montana: no había forma de cortar y entregar)
    F=$(git -C "$REPO" tag -l 'fase-*-accepted' | sed -E 's/fase-([0-9]+)-accepted/\1/' | sort -n | tr '\n' ' ' | sed 's/ $//')
    [ -n "$F" ] || { echo "No hay ninguna FASE aceptada: no hay nada que entregar" >&2; exit 2; }
    TOTAL=$(ls "$REPO"/plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ')
    mkdir -p "$REPO/.sdd/hermes"
    if [ "$(echo "$F" | wc -w | tr -d ' ')" -ge "$TOTAL" ]; then rm -f "$REPO/.sdd/hermes/entrega-parcial"
    else echo "$F" | tr ' ' '\n' > "$REPO/.sdd/hermes/entrega-parcial"; fi
    T=$(tarjeta "Cierre: entrega de las FASEs $F" - 120m cierre)
    echo "Entrega ${TOTAL:+de $(echo "$F" | wc -w | tr -d ' ') de $TOTAL FASEs }(FASEs $F): $T" ;;

  plan)         # Plan → Tareas (lo encadena la etapa «dudas» cuando no queda ninguna abierta)
    plan_y_tareas ;;

  rehacer)      # la FASE N otra vez, con tarjetas NUEVAS: huecos (si quedan [PLAN GAP]) → implementar → aceptar
    N=$3; [ -f "$REPO/task/TASK-FASE-$N.md" ] || { echo "no existe task/TASK-FASE-$N.md" >&2; exit 2; }
    T=$(fase_n "$N")
    echo "FASE-$N de $BOARD otra vez: $T$(con_huecos "$N" && echo ' (primero completa los huecos del plan)')" ;;

  limpiar)      # archiva las tarjetas de etapa ya resueltas: bloqueadas (o en espera de un padre bloqueado) cuya misma
                # etapa (y FASE) se repitió después en otra tarjeta que terminó (o que está en marcha: etapa.sh al acabar bien)
    "${K[@]}" list --json 2>/dev/null | jq -r '
      [.[] | select(.assignee == "sdd-estacion") | . + {etapa: ((.body // "") | capture("etapa\\.sh (?<e>.+)$").e // "")}
           | select(.etapa != "")] as $ts
      | $ts[] | select(.status == "blocked" or .status == "todo") as $b
      | ($ts | map(select(.etapa == $b.etapa and .created_at > $b.created_at and (.status == "done" or .status == "running")))
             | sort_by(.created_at) | last) as $n
      | select($n != null) | "\($b.id) \($n.id) \($n.title)"' | while read -r viejo nuevo titulo; do
        "${K[@]}" comment "$viejo" "Obsoleta: esta etapa se repitió y se resolvió en $nuevo ($titulo). Archivada por el arnés; sigue consultable." >/dev/null 2>&1 || true
        "${K[@]}" archive "$viejo" >/dev/null 2>&1 && echo "archivada $viejo (resuelta en $nuevo)"
      done ;;

  reintentar)   # una etapa fallida se repite con una tarjeta NUEVA (nunca se desbloquea la vieja)
                # --de <tarjeta>: la vieja; sus hijas pasan a esperar a la nueva y la vieja se archiva (el gateway, cuando
                # el kanban perdió al worker)
    ETAPA=$3; FASE=""; DE=""; shift 3
    while [ $# -gt 0 ]; do case "$1" in --de) DE=$2; shift 2 ;; *) FASE=$1; shift ;; esac; done
    # Si Hermes ya la está repitiendo (cada tarjeta tiene un reintento automático) o hay otra en cola, no se duplica:
    # dos a la vez chocan en el candado del repo (club, FASE-3: la vieja se reintentó sola y la nueva quedó «ocupada»)
    if "${K[@]}" list --json 2>/dev/null | jq -e --arg e "etapa.sh $REPO $ETAPA${FASE:+ $FASE}" \
        'any(.[]?; (.status == "running" or .status == "ready" or .status == "todo") and ((.body // "") | endswith($e)))' >/dev/null; then
      echo "ya hay una tarjeta de $ETAPA${FASE:+ $FASE} en marcha o en cola: no se duplica" >&2; exit 1
    fi
    NUEVA=$(tarjeta "Reintento: $ETAPA${FASE:+ FASE-$FASE}" - 120m "$ETAPA" $FASE)
    if [ -n "$DE" ]; then
      for h in $("${K[@]}" show "$DE" --json 2>/dev/null | jq -r '.children[]?' 2>/dev/null); do
        "${K[@]}" link "$NUEVA" "$h" >/dev/null 2>&1 && "${K[@]}" unlink "$DE" "$h" >/dev/null 2>&1 || true
      done
      "${K[@]}" comment "$DE" "Se repite en $NUEVA (el kanban perdió su worker)." >/dev/null 2>&1 || true
      "${K[@]}" archive "$DE" >/dev/null 2>&1 || true
    fi
    echo "$NUEVA" ;;

  esperar)      # esperar <repo> [--tag T] [--max S]: bloquea hasta un evento del proyecto y lo dice en UNA línea.
                # Para quien vigila una prueba (sustituye a un bucle hecho a mano):
                #   ETAPA <etapa> [FASE-N] <resultado>: <resumen o motivo>   una etapa terminó (bien, mal, aparcada…)
                #   PUERTA <id> <tipo> [FASE-N] abierta: <título>             se abrió una puerta
                #   PUERTA <id> <tipo> [FASE-N] error: <motivo>               el notario no pudo firmarla
                #   TAG <tag>                                                 existe el tag T (--tag; admite comodines)
                #   TIEMPO                                                    S segundos sin nada (sale con 3)
    shift 2; TAG=""; MAX=0
    while [ $# -gt 0 ]; do
      case "$1" in --tag) TAG=$2; shift 2 ;; --max) MAX=$2; shift 2 ;; *) echo "esperar: no entiendo «${1}»" >&2; exit 2 ;; esac
    done
    HS="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"; EJ="$REPO/.sdd/hermes/etapas.jsonl"
    lineas() { if [ -f "$EJ" ]; then wc -l < "$EJ" | tr -d ' '; else echo 0; fi; }
    puertas_repo() {  # «id estado» de las puertas de este repo
      local f; for f in "$HS"/puertas/*.json; do [ -f "$f" ] && jq -r --arg r "$REPO" 'select(.repo == $r) | "\(.id) \(.estado)"' "$f" 2>/dev/null; done; return 0
    }
    N0=$(lineas); VISTAS=$(puertas_repo | sort); T0=$(date +%s)
    while :; do
      if [ "$(lineas)" -gt "$N0" ]; then
        sed -n "$((N0 + 1))p" "$EJ" | jq -r '"ETAPA \(.etapa)\(if .fase then " FASE-\(.fase)" else "" end) \(.resultado): \(.resumen // .motivo // "")"'
        exit 0
      fi
      NUEVA=$(comm -13 <(printf '%s\n' "$VISTAS") <(puertas_repo | sort) | grep -E ' (abierta|error)$' | head -1 || true)
      if [ -n "$NUEVA" ]; then
        jq -r --arg e "${NUEVA##* }" '"PUERTA \(.id) \(.tipo)\(if (.fase // "") != "" then " FASE-\(.fase)" else "" end) \($e): \(if $e == "error" then ((.error // "") | gsub("\n"; " ") | .[0:200]) else (.titulo // "") end)"' \
          "$HS/puertas/${NUEVA%% *}.json"
        exit 0
      fi
      if [ -n "$TAG" ]; then t=$(git -C "$REPO" tag -l "$TAG" | head -1); [ -z "$t" ] || { echo "TAG $t"; exit 0; }; fi
      if [ "$MAX" -gt 0 ] && [ $(( $(date +%s) - T0 )) -ge "$MAX" ]; then echo TIEMPO; exit 3; fi
      sleep "${HERMES_SDD_ESPERA_INTERVALO_S:-5}"
    done ;;

  *) echo "uso: lanzar.sh iniciar <repo> | siguiente <repo> <puerta> <resultado> | rehacer <repo> <N> | reintentar <repo> <etapa> [fase] [--de <tarjeta>] | limpiar <repo> | esperar <repo> [--tag T] [--max S]" >&2; exit 2 ;;
esac
