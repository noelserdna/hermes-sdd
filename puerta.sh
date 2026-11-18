#!/usr/bin/env bash
# Abre una PUERTA: deja la pregunta en disco para que el canal la publique y el orquestador del gateway cree su
# tarjeta bloqueada (sin assignee: ningún agente la toma). No decide ni avisa por sí mismo.
# No crea la tarjeta él mismo: lo lanza un worker del kanban, y Hermes no deja que los procesos de un worker
# modifiquen el tablero (frontera de seguridad que respetamos).
#
#   puerta.sh <repo> <tipo> [fase]        tipo: requisitos | ruta | plan | fase | entrega | preguntas | mantenimiento | fallo
#
# Escribe <repo>/.sdd/hermes/puertas/<id>.json (lo lee el notario) y $HERMES_SDD_HOME/puertas/<id>.json (índice
# global que leen los canales). Imprime el id de la puerta.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
. "$ROOT/lib/comun.sh"   # slug, gate_entrega
SDD="$ROOT/metodo/scripts/sdd.mjs"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"

# ── puerta.sh recuperar <puerta>: una puerta en «error» (el notario no terminó) ───────────────────────────────────────
# · Si el acta consta como validada, la firma se reanuda donde se quedó (cada paso del notario es idempotente).
# · Si no llegó a validarse, no se firmó nada: se deshace lo que dejara a medias en acceptance/ (lo no commiteado), se
#   borra la decisión y la puerta vuelve a abrirse para decidirla otra vez (el canal la publica de nuevo).
if [ "${1:-}" = recuperar ]; then
  GATE=${2:?uso: puerta.sh recuperar <puerta>}
  NUCLEO=(env HERMES_SDD_HOME="$HOME_SDD" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py")
  IDX="$HOME_SDD/puertas/$GATE.json"
  [ -f "$IDX" ] || { echo "No conozco la puerta $GATE" >&2; exit 2; }
  EST=$(jq -r '.estado // ""' "$IDX"); REPO=$(jq -r .repo "$IDX"); TAB=$(jq -r '.tablero // ""' "$IDX")
  [ "$EST" = error ] || { echo "La puerta $GATE está «${EST}»: solo se recupera una puerta en error" >&2; exit 2; }
  ACTA="$HOME_SDD/actas/${TAB:-local}/$GATE.json"
  if jq -e '.pasos | index("validado")' "$ACTA" >/dev/null 2>&1; then
    rc=0; OUT=$(bash "$ROOT/firmar.sh" "$REPO" "$GATE") || rc=$?
    case "$rc" in
      0)  "${NUCLEO[@]}" transicion "$GATE" firmada resultado="$(printf '%s\n' "$OUT" | tail -1)" -error
          echo "Firma reanudada: $(printf '%s\n' "$OUT" | tail -1)" ;;
      75) echo "El repo está ocupado (una etapa en marcha): vuelve a intentarlo cuando acabe" >&2; exit 75 ;;
      *)  "${NUCLEO[@]}" transicion "$GATE" error error="la firma reanudada volvió a fallar" || true
          echo "La firma reanudada volvió a fallar (mira $ACTA)" >&2; exit 1 ;;
    esac
    exit 0
  fi
  cd "$REPO"
  . "$ROOT/lib/candado.sh"
  candado_tomar "$REPO" firma "recuperar $GATE" || { echo "El repo está ocupado ($CANDADO_OTRO): vuelve a intentarlo cuando acabe" >&2; exit 75; }
  trap candado_soltar EXIT
  git checkout -q -- acceptance/ 2>/dev/null || true
  git ls-files --error-unmatch acceptance/PENDIENTES.md >/dev/null 2>&1 || rm -f acceptance/PENDIENTES.md
  rm -f ".sdd/hermes/decisiones/$GATE.json" "$ACTA"
  "${NUCLEO[@]}" transicion "$GATE" abierta --desde error -decision -firmar_en -error -telegram -publicada -tg_vista
  SHA=$(jq -r '.sha // ""' "$IDX")
  echo "Puerta $GATE abierta otra vez: decide de nuevo (no se había firmado nada)"
  [ "$(git rev-parse HEAD)" = "$SHA" ] ||
    echo "  AVISO: el proyecto avanzó desde que se abrió (HEAD $(git rev-parse --short=7 HEAD), la puerta enseñaba ${SHA:0:7}): el notario no podrá firmarla; lo normal es relanzar la etapa que la abre" >&2
  exit 0
fi

REPO=$(cd "$1" && pwd); TIPO=$2; FASE=${3:-}
[ -n "${HERMES_SDD_SIN_KANBAN:-}" ] && BOARD="" || BOARD=${HERMES_KANBAN_BOARD:-$(slug "$(basename "$REPO")")}
cd "$REPO"

tests_editados() {  # tests_editados <base> → nº de ficheros de test existentes con líneas que cambian lo que se comprueba
  git diff -U0 --diff-filter=MD "$1..HEAD" -- tests test 2>/dev/null | python3 -c '
import re, sys
ficheros, actual, quitadas, puestas = {}, None, {}, {}
for l in sys.stdin.read().splitlines():
    if l.startswith("diff --git"):
        actual = l.split(" b/")[-1]; quitadas[actual] = []; puestas[actual] = set()
    elif actual and l.startswith("-") and not l.startswith("---"):
        quitadas[actual].append(l[1:].strip())
    elif actual and l.startswith("+") and not l.startswith("+++"):
        puestas[actual].add(l[1:].strip())
trivial = re.compile(r"^(import\b|export \{|from\s|//|#|/\*|\*|\}?\)?;?$|\}\);?$)")
# Solo código de test: los documentos de la carpeta test/ (TEST-PLAN.md, matrices, escenarios) no son tests (sala, FASE-5:
# el plan de pruebas actualizó 8 .md y la puerta avisó de «8 tests cambiados»; Jev no la decidió por eso)
doc = re.compile(r"\.(md|txt|csv|json|ya?ml)$", re.I)
print(sum(1 for f, q in quitadas.items() if not doc.search(f) and any(x and not trivial.match(x) and x not in puestas[f] for x in q)))'
}
# sin_autorizar <fase|global> <n>: de los tests existentes cambiados, los que no autorizó nadie con su firma o se
# debilitaron (hsdd_fidelidad, el mismo informe que enseña la puerta). Uno autorizado ya lo decidió una persona: no
# vuelve a quitarle la puerta a Jev (material-montana2, FASE-2: el cambio que se firmó en la FASE-1). Sin informe, <n>.
sin_autorizar() {
  local f=".sdd/hermes/fidelidad-$1.json"
  jq -e '.congelados | type == "array"' "$f" >/dev/null 2>&1 || { echo "$2"; return; }
  jq '[.congelados[] | select((.autorizado | not) or ((.debilitamiento // []) | length > 0)) | .fichero] | unique | length' "$f"
}

# Requisitos sin verificar que solo una persona puede comprobar (Verification: inspection o demo): la puerta los enseña y
# ofrece 🔍 Lo he revisado y acepto; el notario registra la inspección a nombre de quien lo pulsa.
REV_JSON=$(mktemp); trap 'rm -f "$REV_JSON"' EXIT; echo null > "$REV_JSON"
revisar() { { node "$SDD" gate "$@" --json 2>/dev/null || true; } | python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" revisar "$REPO" > "$REV_JSON" 2>/dev/null ||
  echo null > "$REV_JSON"; }
hay_rev() { jq -e '(.revisar // []) | length > 0' "$REV_JSON" >/dev/null; }
# Impugnaciones abiertas de la revisión independiente: la puerta las enseña y deja descartarlas (🗑). Con gate 4 todas;
# con otro fallo (1/2) solo las dudas del propio criterio (SPEC-QUESTION), que son del cliente: material-montana, FASE-1,
# CH-004 no salió en la puerta (gate 1, se pidió eximir) y, al arreglarse la cita, el requisito pasó a verificado, la
# exención caducó y la duda escondida tumbó la etapa de respuestas con gate 4. Las de un requisito eximido no cuentan
# (el gate tampoco las cuenta) y no se enseñan.
IMP_JSON=$(mktemp); echo '[]' > "$IMP_JSON"
impugnaciones() {  # impugnaciones <rc> [--fase N]
  local rcg=$1; shift
  local w; w=$(node "$SDD" accept "$@" --json 2>/dev/null | jq -c '[.requirements[]? | select(.verdict == "WAIVED") | .id]' 2>/dev/null || true)
  { node "$SDD" accept challenge list --open "$@" --json 2>/dev/null || echo '{}'; } |
    jq -c --argjson w "${w:-[]}" --arg rc "$rcg" '[.challenges[]? | select(.state == "open") | select(.req as $r | $w | index($r) | not)
      | select($rc == "4" or .category == "SPEC-QUESTION") | {id, req, ac, category, quote, why}]' > "$IMP_JSON" 2>/dev/null || echo '[]' > "$IMP_JSON"; }
hay_imp() { jq -e 'length > 0' "$IMP_JSON" >/dev/null 2>&1; }
DESCARTO='{"verbo":"descarto","etiqueta":"🗑 Descartar una impugnación","texto":true}'
# Una duda sobre el propio criterio (SPEC-QUESTION) se resuelve corrigiendo el requisito: lanza un cambio con ella
CORRIJO='{"verbo":"corrijo","etiqueta":"✏️ Corregir el requisito","texto":true}'
con_duda() { jq -e 'any(.[]; .category == "SPEC-QUESTION")' "$IMP_JSON" >/dev/null 2>&1; }
solo_rev() { jq -e '.solo == true' "$REV_JSON" >/dev/null; }
REVISADO='{"verbo":"revisado","etiqueta":"🔍 Lo he revisado y acepto"}'
# Con imprescindibles sin cumplir: rechazar, o eximirlos con un motivo (🟡). Solo una persona: el notario lo registra como
# exención del método con una referencia de seguimiento (acceptance/PENDIENTES.md). Jev nunca la elige (lleva texto).
EXIMO='{"verbo":"eximo","etiqueta":"🟡 Aceptar sin lo que falta","texto":true}'

# ── Texto de la puerta: lo escribe hsdd_textos.py en castellano llano (lo que pediste, lo que se añadió, qué decidir) ─
TEXTOS="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
GATE_MD=$(mktemp); trap 'rm -f "$GATE_MD" "$REV_JSON" "$IMP_JSON"' EXIT
EXTRA=(); EDIT=0; BLOQUEO=false; UNICA=false; rc=0
case "$TIPO" in
  requisitos)
    EXTRA+=(--version "$(sed -n 's/^> \*\*Version:\*\* *//p' requirements/REQUIREMENTS.md | head -1)")
    if [ -f .sdd/hermes/cambio-actual ]; then   # un cambio: primero lo que se pidió y lo que cambia
      INT=$(cat .sdd/hermes/cambio-actual)
      PREV=$(git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || true)
      # Un cambio que solo toca criterios no añade ni quita cabeceras: grep sin coincidencias no debe tumbar la puerta
      ANADIDOS=$( [ -n "$PREV" ] || exit 0; git diff "$PREV" -- requirements/REQUIREMENTS.md | { grep -E '^\+### REQ-' || true; } | sed -E 's/^\+### (REQ-[^ :]+).*/\1/' | tr '\n' ' ')
      QUITADOS=$( [ -n "$PREV" ] || exit 0; git diff "$PREV" -- requirements/REQUIREMENTS.md | { grep -E '^-### REQ-' || true; } | sed -E 's/^-### //' | tr '\n' '|')
      EXTRA+=(--cambio "$INT" --anadidos "$ANADIDOS" --quitados "$QUITADOS")
    fi
    [ -f .sdd/hermes/adopcion ] && EXTRA+=(--adopcion 1)
    [ -f .sdd/hermes/requisitos-de-partida.md ] && [ ! -f .sdd/hermes/cambio-actual ] && EXTRA+=(--partida .sdd/hermes/requisitos-de-partida.md)
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Apruebo"},{"verbo":"cambios","etiqueta":"✏️ Falta o sobra algo","texto":true}]' ;;
  ruta)   # un botón por ruta configurada (SDD → Configuración → Rutas), la recomendada primero; cada opción guarda las
          # etapas que hará, para que el notario firme exactamente lo que se vio
    RUTAS=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta "${BOARD:-$(basename "$REPO")}" .sdd/hermes/ruta.json) ||
      { echo "no se pudieron leer las rutas configuradas" >&2; exit 1; }
    echo "$RUTAS" > "$GATE_MD"; EXTRA+=(--opciones-ruta "$GATE_MD")
    OPCIONES=$(echo "$RUTAS" | jq -c '[.[] | {verbo, etiqueta, etapas, auto, granularidad, criterio, fijada}] + [{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]') ;;
  plan)
    OPCIONES='[{"verbo":"conforme","etiqueta":"✅ Conforme"},{"verbo":"cambios","etiqueta":"✏️ Cambiar","texto":true}]' ;;
  fase)
    node "$SDD" gate --fase "$FASE" --md > "$GATE_MD" 2>/dev/null || rc=$?
    # Tests que YA existían y se modificaron desde la última aceptación (art. 12: se arregla el código, no el test).
    # Solo cuentan ficheros con líneas borradas o cambiadas: añadir tests nuevos a un fichero existente no debilita nada.
    # Tampoco cuentan los imports, las líneas en blanco, los comentarios ni las líneas que solo se movieron (coches,
    # FASE-1: ampliar un `import { a, b }` mandaba la puerta a una persona y la tuvo esperando 7 h)
    BASE=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
    EDIT=$(sin_autorizar "$FASE" "$(tests_editados "$BASE")")
    VIDEO=$(ls evidencias/FASE-"$FASE"/*.mp4 evidencias/FASE-"$FASE"/*.webm evidencias/FASE-"$FASE"/*.mov 2>/dev/null | head -1 || true)
    CAPTURAS=$( (ls evidencias/FASE-"$FASE"/*.png evidencias/FASE-"$FASE"/*.jpg 2>/dev/null || true) | wc -l | tr -d ' ')
    EXTRA+=(--gate-md "$GATE_MD" --rc "$rc" --tests-editados "$EDIT" --video "$([ -n "$VIDEO" ] && echo 1 || echo 0)" --capturas "$CAPTURAS")
    OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Aceptar","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    revisar --fase "$FASE"; EXTRA+=(--revisar "$REV_JSON")
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then impugnaciones "$rc" --fase "$FASE"; EXTRA+=(--impugnaciones "$IMP_JSON"); fi
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      if solo_rev; then   # solo faltan inspecciones: se confirman aquí mismo
        OPCIONES=$(jq -nc --argjson r "$REVISADO" '[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1}, ($r + {paso:2}), {"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]')
      else BLOQUEO=true
        # impugnación abierta (4): se arregla (rechazar) o una persona la descarta; otro fallo: se exime o se rechaza, y
        # si además hay una duda del criterio, también se puede corregir el requisito o descartar la duda
        X=$EXIMO; D=null; [ "$rc" = 4 ] && X=$DESCARTO; [ "$rc" != 4 ] && hay_imp && D=$DESCARTO
        C=null; con_duda && C=$CORRIJO
        OPCIONES=$(jq -nc --argjson x "$X" --argjson c "$C" --argjson d "$D" '[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1}] + (if $c then [$c + {paso:2}] else [] end) + (if $d then [$d + {paso:2}] else [] end) + (if $x then [$x + {paso:2}] else [] end) + [{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'); fi
    elif hay_rev; then OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" '.[0:1] + [$r + {paso:2}] + .[1:]'); fi ;;
  entrega)
    gate_entrega --md > "$GATE_MD" 2>/dev/null || rc=$?
    EXTRA+=(--gate-md "$GATE_MD" --rc "$rc" --fases-aceptadas "$(git tag -l 'fase-*-accepted' | tr '\n' ' ')")
    parcial && EXTRA+=(--parcial "$(cat .sdd/hermes/entrega-parcial | tr '\n' ' ')")
    OPCIONES='[{"verbo":"acepto","etiqueta":"✅ Acepto la entrega"},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true}]'
    # Plan de una sola FASE sin aceptar (y no «fina»): no hubo puerta de FASE, así que esta trae su demo (▶ Ver demo primero)
    if [ -f .sdd/hermes/granularidad-plan ] && [ "$(cat .sdd/hermes/granularidad-plan)" != fina ] && [ "$(ls plan/fases/FASE-*.md 2>/dev/null | wc -l | tr -d ' ')" = 1 ] \
       && ! git tag -l 'fase-*-accepted' | grep -q .; then
      UNICA=true
      VIDEO=$(ls evidencias/FASE-0/*.mp4 evidencias/FASE-0/*.webm evidencias/FASE-0/*.mov 2>/dev/null | head -1 || true)
      CAPTURAS=$( (ls evidencias/FASE-0/*.png evidencias/FASE-0/*.jpg 2>/dev/null || true) | wc -l | tr -d ' ')
      BASE=$(git describe --tags --abbrev=0 --match 'requirements-v*' 2>/dev/null || git rev-list --max-parents=0 HEAD)
      EDIT=$(sin_autorizar global "$(tests_editados "$BASE")")
      EXTRA+=(--unica 1 --video "$([ -n "$VIDEO" ] && echo 1 || echo 0)" --capturas "$CAPTURAS" --tests-editados "$EDIT")
      OPCIONES='[{"verbo":"ver","etiqueta":"▶ Ver demo","paso":1},{"verbo":"acepto","etiqueta":"✅ Acepto la entrega","paso":2},{"verbo":"observaciones","etiqueta":"📝 Con observaciones","texto":true,"paso":2},{"verbo":"rechazo","etiqueta":"❌ Rechazar","texto":true,"paso":2}]'
    fi
    revisar; EXTRA+=(--revisar "$REV_JSON")
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then impugnaciones "$rc"; EXTRA+=(--impugnaciones "$IMP_JSON"); fi
    PASO=$([ "$UNICA" = true ] && echo '{paso:2}' || echo '{}')
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      if solo_rev; then   # solo faltan inspecciones: se confirman aquí mismo
        OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" "[.[] | select(.verbo == \"ver\")] + [\$r + $PASO] + [.[] | select(.verbo == \"rechazo\")]")
      else BLOQUEO=true
        X=$EXIMO; D=null; [ "$rc" = 4 ] && X=$DESCARTO; [ "$rc" != 4 ] && hay_imp && D=$DESCARTO
        C=null; con_duda && C=$CORRIJO
        OPCIONES=$(echo "$OPCIONES" | jq -c --argjson x "$X" --argjson c "$C" --argjson d "$D" "[.[] | select(.verbo == \"ver\")] + (if \$c then [\$c + $PASO] else [] end) + (if \$d then [\$d + $PASO] else [] end) + [\$x + $PASO] + [.[] | select(.verbo == \"rechazo\")]"); fi
    elif hay_rev; then
      OPCIONES=$(echo "$OPCIONES" | jq -c --argjson r "$REVISADO" "[.[] | select(.verbo == \"ver\")] + [\$r + $PASO] + [.[] | select(.verbo != \"ver\")]"); fi ;;
  preguntas)       # lo abre etapa.sh implementar cuando la FASE se para en preguntas [OPEN] (y «dudas», antes del plan)
    [ -z "$FASE" ] && [ -f .sdd/hermes/dudas-diseno ] && EXTRA+=(--diseno 1)
    OPCIONES='[{"verbo":"respondo","etiqueta":"✅ Responder"}]' ;;
  mantenimiento)   # lo abre vigilar.sh con .sdd/hermes/mantenimiento/hallazgos.json
    EXTRA+=(--hallazgos .sdd/hermes/mantenimiento/hallazgos.json)
    OPCIONES='[{"verbo":"cambio","etiqueta":"🛠 Lanzar cambio"},{"verbo":"ignoro","etiqueta":"🔕 Ignorar","texto":true}]' ;;
  fallo)           # lo abre etapa.sh cuando una etapa termina mal sin otra puerta (.sdd/hermes/fallo.json: etapa, fase,
                   # motivo). Antes quedaba una tarjeta bloqueada y solo salía con un desbloqueo a mano (montana2-5)
    EXTRA+=(--fallo .sdd/hermes/fallo.json)
    OPCIONES='[{"verbo":"reintento","etiqueta":"🔁 Reintentar"},{"verbo":"paro","etiqueta":"⏹ Dejarla parada"}]' ;;
  *) echo "tipo de puerta desconocido: $TIPO" >&2; exit 2 ;;
esac
# Las preguntas en JSON (.sdd/questions-<rol>.json) son la verdad y su .md una vista: si una etapa escribió el JSON a
# mano, la vista se regenera antes de enseñarla (la leen Jev y las etapas). El texto y los botones Q leen el JSON.
node "$SDD" questions render >/dev/null 2>&1 || true
T_JSON=$(python3 "$TEXTOS" puerta "$TIPO" "$REPO" --proyecto "${BOARD:-$(basename "$REPO")}" ${FASE:+--fase "$FASE"} ${EXTRA[@]+"${EXTRA[@]}"}) ||
  { echo "no se pudo escribir el texto de la puerta $TIPO" >&2; exit 1; }
TITULO=$(echo "$T_JSON" | jq -r .titulo); TEXTO=$(echo "$T_JSON" | jq -r .texto)
mkdir -p .sdd/hermes
# Revisión mecánica del encargado (hsdd_revision.py, sin LLM): «🧭 Encargado: N avisos» arriba del texto. No bloquea;
# un aviso grave hace que Jev no pueda aprobar esta puerta solo (hsdd_nucleo.puede_jev lee .encargado.graves)
ENC='{"avisos":[],"graves":0}'
case "$TIPO" in requisitos|ruta|plan|fase|entrega)
  IA=""; jq -e --arg t "$TIPO" '(.revision_ia // []) | index($t)' "$HOME_SDD/sdd.json" >/dev/null 2>&1 && IA=--ia
  # Si la revisión no se puede hacer, Jev no tiene con qué decidir: la puerta escala a una persona (antes, un fallo de
  # la revisión dejaba la puerta «sin avisos» y Jev podía aprobarla a ciegas)
  FALLO_REV='{"avisos":[{"grave":true,"codigo":"revision-fallida","texto":"La revisión automática de esta puerta no se pudo hacer: sin ella Jev no decide, la decide una persona"}],"graves":1}'
  ENC=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_revision.py" revisar "$REPO" "$TIPO" ${FASE:+--fase "$FASE"} $IA 2>".sdd/hermes/revision.err") || ENC=$FALLO_REV
  jq -e '.avisos' <<< "$ENC" >/dev/null 2>&1 || ENC=$FALLO_REV
  [ "$ENC" != "$FALLO_REV" ] || ENC=$(jq -c --arg l "🧭 Encargado: ‼️ la revisión automática falló (.sdd/hermes/revision.err); esta puerta la decide una persona" '. + {linea: $l}' <<< "$ENC")
  LINEA=$(jq -r '.linea // ""' <<< "$ENC")
  [ -z "$LINEA" ] || TEXTO="$LINEA

$TEXTO" ;;
esac

# Preguntas como datos, para que el canal pueda ofrecerlas como formulario (Q1: A/B/C…)
python3 "$TEXTOS" normalizar-preguntas "$REPO" >/dev/null 2>&1 || true   # cabeceras «## » y números repetidos
PREG_ERROR=false
# (hsdd_textos.preguntas_json: el JSON si lo hay, el .md en las preguntas antiguas; numera igual que el texto)
PREGUNTAS=$(python3 "$TEXTOS" preguntas-json .sdd/questions-*.md .sdd/questions-*.json 2>".sdd/hermes/preguntas.err" || echo ERROR)

# Preguntas ilegibles: la puerta sale sin botones Q, pero Jev no decide sobre preguntas que no ha podido leer
if [ "$PREGUNTAS" = ERROR ] || ! jq -e 'type == "array"' <<< "$PREGUNTAS" >/dev/null 2>&1; then PREGUNTAS='[]'; PREG_ERROR=true; fi

# Exenciones que ya se cumplen: su fila de PENDIENTES.md se cierra antes de enseñar la puerta (y va en su commit, así
# el commit que se muestra es el que se firma)
if [ "$TIPO" = fase ] || [ "$TIPO" = entrega ]; then
  CERR=$(node "$SDD" accept --json 2>/dev/null | python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" cerrar-pendientes "$REPO" 2>/dev/null || true)
  if [ -n "$CERR" ]; then
    git add acceptance/PENDIENTES.md && git commit -qm "docs(acceptance): pendientes cerrados ($CERR): ya se cumplen" >/dev/null 2>&1 || true
  fi
fi
SHA=$(git rev-parse HEAD)
ID="g$(date +%s)$(openssl rand -hex 2)"

AHORA=$(date -u +%Y-%m-%dT%H:%M:%SZ)
mkdir -p .sdd/hermes/puertas "$HOME_SDD/puertas"
jq -n --arg id "$ID" --arg t "$TIPO" --arg f "$FASE" --arg b "$BOARD" --arg s "$SHA" --arg c "$AHORA" \
  --arg r "$REPO" --arg ti "$TITULO" --arg tx "$TEXTO" --argjson o "$OPCIONES" --arg v "${VIDEO:-}" --argjson q "$PREGUNTAS" \
  --argjson ad "$([ -f .sdd/hermes/adopcion ] && echo true || echo false)" \
  --argjson hz "$([ "$TIPO" = mantenimiento ] && cat .sdd/hermes/mantenimiento/hallazgos.json || echo null)" \
  --argjson fa "$([ "$TIPO" = fallo ] && cat .sdd/hermes/fallo.json || echo null)" \
  --argjson te "${EDIT:-0}" --argjson bl "$BLOQUEO" --argjson un "${UNICA:-false}" --argjson rv "$(cat "$REV_JSON")" \
  --argjson en "$(jq -c '{avisos, graves}' <<< "$ENC")" --argjson pe "$PREG_ERROR" \
  '{id:$id, tipo:$t, fase:$f, tablero:$b, tarjeta:"", adopcion:$ad, sha:$s, creada:$c, repo:$r, titulo:$ti, texto:$tx,
    opciones:$o, demo:$v, preguntas:$q, preguntas_error:$pe, hallazgos:$hz, tests_editados:$te, bloqueo:$bl, unica:$un,
    revisar:(($rv // {}).revisar // []), encargado:$en} + (if $fa then {fallo:$fa} else {} end)' > ".sdd/hermes/puertas/$ID.json"
# La copia del repo es lo que se mostró (la lee el notario) y no lleva estado: el estado vive solo en el índice global
# y solo cambia por las transiciones del núcleo (hsdd_nucleo.py transicion). Una puerta nueva del mismo proyecto, tipo y
# FASE sustituye a la que siguiera abierta (club: reabrir la entrega dejaba dos puertas de entrega abiertas a la vez):
# la vieja queda «superada» sin botones y su tarjeta se archiva
for tj in $(HERMES_SDD_HOME="$HOME_SDD" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" superar "$REPO" "$TIPO" "$FASE" "$ID" "$ID"); do
  [ -n "$BOARD" ] && hermes kanban --board "$BOARD" archive "$tj" >/dev/null 2>&1 || true
done
jq '. + {estado: "abierta"}' ".sdd/hermes/puertas/$ID.json" > "$HOME_SDD/puertas/$ID.json.tmp" &&
  mv "$HOME_SDD/puertas/$ID.json.tmp" "$HOME_SDD/puertas/$ID.json"   # índice global para los canales
echo "$ID"
