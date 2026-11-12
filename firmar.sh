#!/usr/bin/env bash
# El NOTARIO: registra y firma la decisión humana de una puerta. Determinista, sin LLM.
# Si el proyecto tiene a Jev en modo piloto o auto, firma también la decisión de Jev, con su nombre y su modo en el
# registro y en el tag: nunca la presenta como de una persona.
#
#   firmar.sh <repo> <puerta>
#
# Lee   <repo>/.sdd/hermes/puertas/<puerta>.json     (lo escribe puerta.sh: tipo, fase, tablero, tarjeta, sha mostrado)
#       <repo>/.sdd/hermes/decisiones/<puerta>.json  (lo escribe un adaptador de canal: verbo, texto, persona, prueba)
#       $HERMES_SDD_HOME/aprobadores.json            (personas autorizadas y sus identidades por canal)
# Deja  $HERMES_SDD_HOME/actas/<tablero>/<puerta>.json con los pasos hechos. Si se corta, la siguiente llamada
#       retoma desde el último paso (cada paso comprueba si ya está hecho antes de repetirlo).
#
# El notario no decide: aplica lo que una persona autorizada eligió, solo si el estado es el que esa persona vio.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
SDD_STATE="$ROOT/metodo/scripts/sdd-state.sh"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
REPO=$(cd "$1" && pwd); GATE=$2
cd "$REPO"

PUERTA=".sdd/hermes/puertas/$GATE.json"
DECISION=".sdd/hermes/decisiones/$GATE.json"
[ -f "$PUERTA" ] || { echo "NOTARIO: no existe la puerta $GATE" >&2; exit 2; }
[ -f "$DECISION" ] || { echo "NOTARIO: la puerta $GATE no tiene decisión" >&2; exit 2; }
# La decisión del repo tiene que ser la que registró un canal en el índice de puertas de Hermes (Telegram, el panel y
# Jev por el núcleo; el canal local por decidir.sh). Una etapa puede escribir en el repo, no en ~/.hermes (sandbox y
# guardias): un fichero de decisión fabricado en el repo, sin su gemelo en el índice, no se firma.
IDX="$HOME_SDD/puertas/$GATE.json"
[ -f "$IDX" ] || { echo "NOTARIO: rechazado — la puerta $GATE no está en el índice de puertas de Hermes" >&2; exit 1; }
jq -e --arg repo "$REPO" --slurpfile d "$DECISION" '
  (.repo == $repo) and (.estado | IN("decidida", "firmada", "error"))
  and (.decision.at == $d[0].at) and (.decision.verbo == $d[0].verbo) and ((.decision.texto // "") == ($d[0].texto // ""))
  and (.decision.actor.persona == $d[0].actor.persona) and (.decision.actor.canal == $d[0].actor.canal)' "$IDX" >/dev/null ||
  { echo "NOTARIO: rechazado — la decisión de $GATE no coincide con la que registró un canal" >&2; exit 1; }

p() { jq -r "$1 // empty" "$PUERTA"; }
d() { jq -r "$1 // empty" "$DECISION"; }
TIPO=$(p .tipo); FASE=$(p .fase); BOARD=$(p .tablero); TASK=$(p .tarjeta); SHA=$(p .sha)
VERBO=$(d .verbo); TEXTO=$(d .texto); PERSONA=$(d .actor.persona); CANAL=$(d .actor.canal); ID=$(d .actor.id)
PRUEBA=$(d '.prueba | to_entries | map("\(.key):\(.value)") | join(" ")')
# «🔍 Lo he revisado y acepto»: la persona confirma las inspecciones que la puerta enseñaba y acepta. Se registran a su
# nombre (paso 1b) y lo demás es una aceptación normal. Solo una persona: una inspección nunca la firma Jev.
REVISADO=false
if [ "$VERBO" = revisado ]; then
  { [ "$TIPO" = fase ] || [ "$TIPO" = entrega ]; } || { echo "NOTARIO: rechazado — 'revisado' no vale para una puerta de tipo '$TIPO'" >&2; exit 1; }
  jq -e 'any(.opciones[]; .verbo == "revisado")' "$PUERTA" >/dev/null || { echo "NOTARIO: rechazado — la puerta no ofrecía 🔍 Lo he revisado" >&2; exit 1; }
  [ "$CANAL" != jev ] || { echo "NOTARIO: rechazado — una inspección la confirma una persona, no Jev" >&2; exit 1; }
  REVISADO=true; VERBO=acepto
fi

# Aprobar requisitos o plan eligiendo en alguna pregunta una opción distinta de la recomendada: el texto que la
# persona vio está escrito con la recomendada, así que firmarlo dejaría aprobado algo distinto de lo que eligió.
# Se convierte en una petición de cambios con esas respuestas: la etapa rehace el texto y la puerta vuelve a abrirse.
if { [ "$TIPO:$VERBO" = requisitos:acepto ] || [ "$TIPO:$VERBO" = plan:conforme ]; } && [ -n "$TEXTO" ]; then
  DISTINTAS=$(jq -r --arg t "$TEXTO" '
    ([$t | scan("[Qq][A-Za-z]?\\s*(\\d+)\\W{0,3}\\s*([A-Ca-c])\\b")] | map({key: .[0], value: (.[1] | ascii_upcase)}) | from_entries) as $e
    | [.preguntas[]? | ($e[(.n | tostring)] // null) as $x | select($x != null and $x != .recomendada) | "\(.id) = \($x)"]
    | join("; ")' "$PUERTA")
  if [ -n "$DISTINTAS" ]; then
    VERBO=cambios
    TEXTO="$TEXTO. Respuestas distintas de la recomendada ($DISTINTAS): reescribe lo afectado según esas respuestas (están en .sdd/questions-*.md)."
  fi
fi

ACTA="$HOME_SDD/actas/${BOARD:-local}/$GATE.json"
mkdir -p "$(dirname "$ACTA")"
[ -f "$ACTA" ] || jq -n --arg g "$GATE" '{puerta:$g, pasos:[]}' > "$ACTA"
hecho() { jq -e --arg s "$1" '.pasos | index($s)' "$ACTA" >/dev/null; }
marcar() { local t; t=$(mktemp); jq --arg s "$1" '.pasos += [$s] | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"; }
fallo() { local t; t=$(mktemp); jq --arg m "$1" '.error = $m | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"
  echo "NOTARIO: rechazado — $1" >&2; exit 1; }

# ── 1. validar (solo la primera vez: después el HEAD ya habrá avanzado con nuestro propio commit) ──────────────────
if ! hecho validado; then
  if [ "$CANAL" = jev ]; then
    # Decidió Jev: no es una persona de aprobadores.json. Vale solo si el modo de ESTE proyecto, ahora, le deja
    # decidir esta puerta con este verbo y esta seguridad (jev.json en $HERMES_SDD_HOME, fuera del alcance del repo).
    [ "$PERSONA" = jev ] || fallo "una decisión del canal jev debe ser de jev, no de '$PERSONA'"
    MODO=$(HERMES_SDD_HOME="$HOME_SDD" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" permite-jev "$PUERTA" "$VERBO" "$(d .prueba.p)" 2>&1) ||
      fallo "Jev no puede decidir esta puerta: $MODO"
    ROL="Agente automático (modo $MODO)"; NOMBRE="Jev ($ID)"
  else
  # La persona existe y la identidad del canal es la suya
  [ -f "$HOME_SDD/aprobadores.json" ] || fallo "falta $HOME_SDD/aprobadores.json"
  jq -e --arg p "$PERSONA" --arg c "$CANAL" --arg i "$ID" \
    '.[$p] and ((.[$p].canales[$c] // "") | tostring) == $i' "$HOME_SDD/aprobadores.json" >/dev/null ||
    fallo "$CANAL:$ID no es una identidad autorizada de '$PERSONA'"
  ROL=$(jq -r --arg p "$PERSONA" '.[$p].rol' "$HOME_SDD/aprobadores.json")
  NOMBRE=$(jq -r --arg p "$PERSONA" '.[$p].nombre // $p' "$HOME_SDD/aprobadores.json")
  fi
  # La decisión es posterior a la puerta
  [ ! "$(d .at)" \< "$(p .creada)" ] || fallo "la decisión es anterior a la puerta"
  # Lo que se firma es lo que la persona vio
  [ "$(git rev-parse --short=7 HEAD)" = "${SHA:0:7}" ] || fallo "HEAD ($(git rev-parse --short=7 HEAD)) no es el commit mostrado (${SHA:0:7})"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || fallo "el árbol tiene cambios sin commit"
  # Verbos válidos por tipo de puerta
  case "$TIPO:$VERBO" in
    requisitos:acepto|requisitos:cambios|ruta:acepto|ruta:completo|ruta:rechazo|plan:conforme|plan:cambios) ;;
    ruta:ruta-*) jq -e --arg v "$VERBO" 'any(.opciones[]; .verbo == $v)' "$PUERTA" >/dev/null || fallo "la puerta no ofrecía la ruta $VERBO" ;;
    fase:acepto|fase:observaciones|fase:rechazo|entrega:acepto|entrega:observaciones|entrega:rechazo) ;;
    mantenimiento:cambio|mantenimiento:ignoro) ;;
    *) fallo "verbo '$VERBO' no vale para una puerta de tipo '$TIPO'" ;;
  esac
  case "$VERBO" in cambios|observaciones|rechazo|ignoro) [ -n "$TEXTO" ] || fallo "'$VERBO' necesita un texto" ;; esac
  # 1b. inspecciones confirmadas en la puerta (idempotente: una por requisito y puerta)
  if [ "$REVISADO" = true ]; then
    for r in $(jq -r '.revisar[]?.id' "$PUERTA"); do
      grep -F "\"$r\"" acceptance/decisions.jsonl 2>/dev/null | grep -qF "puerta $GATE" && continue
      QUE="Revisado por $NOMBRE en la puerta $GATE ($CANAL): $(jq -r --arg r "$r" '.revisar[] | select(.id == $r) | .cliente // .titulo' "$PUERTA")"
      if [ "$(jq -r --arg r "$r" '.revisar[] | select(.id == $r) | .como' "$PUERTA")" = demo ]; then
        node "$SDD" accept record demo --req "$r" --observed "$QUE" --pass true --by "$NOMBRE" --role "$ROL" >/dev/null
      else
        node "$SDD" accept record inspection --req "$r" --note "$QUE" --by "$NOMBRE" --role "$ROL" >/dev/null
      fi || fallo "no se pudo registrar la revisión de $r"
    done
    git add acceptance/decisions.jsonl 2>/dev/null || true
    git diff --cached --quiet || git commit -q -m "docs(acceptance): inspection by $NOMBRE" --trailer "Refs: $(jq -r '[.revisar[]?.id] | join(", ")' "$PUERTA")" --trailer "Gate-Id: $GATE"
  fi
  # Aceptar una FASE exige la puerta de calidad cumplida (0) o cumplida con exenciones (3); rechazar, no
  if { [ "$TIPO" = fase ] || [ "$TIPO" = entrega ]; } && [ "$VERBO" != rechazo ]; then
    rc=0
    if [ "$TIPO" = fase ]; then node "$SDD" gate --fase "$FASE" >/dev/null 2>&1 || rc=$?
    else node "$SDD" gate >/dev/null 2>&1 || rc=$?; fi
    [ "$rc" = 0 ] || [ "$rc" = 3 ] || fallo "la puerta de calidad sale con $rc: solo se admite rechazo"
  fi
  t=$(mktemp); jq --arg r "$ROL" --arg n "$NOMBRE" --arg h "$(git rev-parse HEAD)" --arg g "${rc:-}" \
    '.rol=$r | .nombre=$n | .head=$h | .gate_exit=$g' "$ACTA" > "$t" && mv "$t" "$ACTA"
  marcar validado
fi
ROL=$(jq -r .rol "$ACTA"); NOMBRE=$(jq -r .nombre "$ACTA"); HEAD0=$(jq -r .head "$ACTA")
CHANNEL="$CANAL:$ID $PRUEBA ${BOARD}/${TASK}"
HOY=$(date +%Y-%m-%d)
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
etiquetar() {  # etiquetar <tag> <mensaje> — idempotente: si existe y apunta a HEAD, ya está hecho
  local tag=$1 msg=$2
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-parse "$tag^{commit}")" = "$(git rev-parse HEAD)" ] || fallo "el tag $tag ya existe en otro commit"
    return
  fi
  local sign=-a; [ -n "$(git config user.signingkey || true)" ] && sign=-s
  git tag $sign "$tag" -F - <<<"$msg"
}
rama_defecto() {  # la del Stack Profile (default_branch en AGENTS.md), si no main o master
  local d; d=$(grep -oE '^- *default_branch: *[A-Za-z0-9._/-]+' AGENTS.md 2>/dev/null | head -1 | sed -E 's/.*: *//')
  for b in $d main master; do git rev-parse -q --verify "refs/heads/$b" >/dev/null && { echo "$b"; return; }; done
}
FUSION=""
fusionar() {  # fusionar <qué>: la rama de trabajo (fase-N-…, cambio…) entra en la rama por defecto con un commit de
  # merge (convención del método: nunca squash ni rebase) y HEAD queda en la por defecto, de donde sale la siguiente
  # FASE. Aceptar la FASE o la entrega es la decisión de la persona; el notario solo la aplica en local (nunca push).
  # Con conflicto: se aborta, se queda en la rama y se avisa en el resumen (la firma no se deshace).
  local rama def; rama=$(git rev-parse --abbrev-ref HEAD); def=$(rama_defecto)
  [ -n "$def" ] && [ "$rama" != HEAD ] && [ "$rama" != "$def" ] || return 0
  git merge-base --is-ancestor "$rama" "$def" && { git switch -q "$def"; return 0; }   # ya fusionada
  git switch -q "$def" || { FUSION=" (no se pudo pasar a $def: queda en $rama)"; return 0; }
  if git merge --no-ff -q "$rama" -m "Merge $rama: $1" -m "Refs: ${FASE:+FASE-$FASE}${FASE:-$TIPO}
Gate-Id: $GATE" >/dev/null 2>&1; then
    FUSION=" · $rama fusionada en $def"
  else
    git merge --abort >/dev/null 2>&1 || true; git switch -q "$rama" 2>/dev/null || true
    FUSION=" (la rama $rama no se pudo fusionar en $def: hay conflictos; queda para una persona)"
  fi
}
commit_si_hay() {  # commit_si_hay <mensaje> <rutas...> — solo las que existen; no hace nada si no hay cambios
  local msg=$1 r; shift
  for r in "$@"; do [ -e "$r" ] && git add -- "$r"; done
  git diff --cached --quiet || git commit -q -m "$msg" --trailer "Gate-Id: $GATE"
}

# ── 2a. preguntas abiertas (clase C) que la puerta mostró ────────────────────────────────────────────────────────
# «Q1: A, Q2: B» en el texto → esas letras; aceptar o dar conformidad sin texto → la opción recomendada.
if ! hecho preguntas; then
  MODO=""
  if printf '%s' "$TEXTO" | grep -qiE 'q[a-z]?[[:space:]]*[0-9]'; then MODO=elegidas
  elif [ "$VERBO" = acepto ] || [ "$VERBO" = conforme ]; then MODO=recomendada; fi
  if [ -n "$MODO" ]; then
    python3 - "$MODO" "$NOMBRE ($ROL)" "$HOY" "$TEXTO" .sdd/questions-*.md <<'PY'
import re, sys
modo, quien, hoy, texto, *ficheros = sys.argv[1:]
elegidas = {int(n): l.upper() for n, l in re.findall(r"[Qq][A-Za-z]?\s*(\d+)\W{0,3}\s*([A-Ca-c])\b", texto)}
n = 0
for p in sorted(ficheros):
    try:
        t = open(p).read()
    except OSError:
        continue
    def contestar(m):
        global n
        n += 1
        b = m.group(0)
        if modo == "elegidas":
            if n not in elegidas:
                return b
            letra, como = elegidas[n], "elegida por"
        else:
            rec = re.search(r"^\s+([A-Z])(?:\s*[★⭐]|\).*\(recommended\))", b, re.M)
            letra, como = (rec.group(1) if rec else "?"), "opción recomendada, aceptada por"
        b = b.replace("[OPEN]", "[ANSWERED]", 1)
        linea = f"Answer: {letra} — {como} {quien} ({hoy})"
        if re.search(r"^Answer:[ \t]*$", b, re.M):   # [ \t]: no comerse los saltos de línea que separan preguntas
            return re.sub(r"^Answer:[ \t]*$", linea, b, count=1, flags=re.M)
        cuerpo = b.rstrip("\n")                       # sin línea Answer: se añade, conservando la separación
        return cuerpo + "\n" + linea + b[len(cuerpo):] if b[len(cuerpo):] else cuerpo + "\n" + linea + "\n"
    t = re.sub(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", contestar, t, flags=re.M | re.S)
    open(p, "w").write(t)
PY
  fi
  marcar preguntas
fi

# ── 2. aplicar según el tipo de puerta ────────────────────────────────────────────────────────────────────────────
case "$TIPO:$VERBO" in
  requisitos:acepto)
    V=$(sed -n 's/^> \*\*Version:\*\* *//p' requirements/REQUIREMENTS.md | head -1); V=${V:-1.0}
    if ! hecho registrado; then
      sed -i.bak -E "s/^> \*\*Status:\*\*.*/> **Status:** Approved/" requirements/REQUIREMENTS.md
      if grep -q '^> \*\*Approved by:\*\*' requirements/REQUIREMENTS.md; then
        sed -i.bak -E "s/^> \*\*Approved by:\*\*.*/> **Approved by:** $NOMBRE ($ROL), $HOY/" requirements/REQUIREMENTS.md
      else
        sed -i.bak -E "/^> \*\*Status:\*\*/a\\
> **Approved by:** $NOMBRE ($ROL), $HOY" requirements/REQUIREMENTS.md
      fi
      rm -f requirements/REQUIREMENTS.md.bak
      node "$SDD" journal add --stage requirements-engineer --kind decision \
        --text "$NOMBRE aprobó los requisitos (versión $V) el $HOY" --by "$NOMBRE ($ROL)" --refs "requirements-v$V" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then
      commit_si_hay "docs(requirements): approve requirements v$V" requirements/ status/
      marcar commit
    fi
    if ! hecho tag; then
      etiquetar "requirements-v$V" "Requirements v$V approved

Approved-by: $NOMBRE
Approver-role: $ROL
Approved-on: $HOY
Channel: $CHANNEL
Requirements-sha256: $(sha256 requirements/REQUIREMENTS.md)
Customer-needs-sha256: $(sha256 requirements/CUSTOMER-NEEDS.md)
Kanban-Task: $BOARD/$TASK"
      bash "$SDD_STATE" set requirements-engineer done >/dev/null 2>&1 || true
      marcar tag
    fi
    RESULTADO="aprobado"; RESUMEN="Requisitos v$V aprobados por $NOMBRE ($ROL) — tag requirements-v$V" ;;

  ruta:acepto|ruta:completo|ruta:ruta-*)
    if ! hecho registrado; then
      # «acepto»/«completo» (puertas anteriores a 0.3.0) = la propuesta del método. Una ruta configurada fija cada etapa
      # opcional a lo que mostraba su botón; la «auto» (adaptativa) deja la propuesta del método
      extra=()
      if [ "${VERBO#ruta-}" != "$VERBO" ] && [ "$(jq -r --arg v "$VERBO" '.opciones[] | select(.verbo == $v) | .auto' "$PUERTA")" != true ]; then
        for k in specifications-engineer spec-auditor test-planner security-auditor ux-designer tech-designer gap-detector; do
          jq -e --arg v "$VERBO" --arg k "$k" '.opciones[] | select(.verbo == $v) | .etapas | index($k)' "$PUERTA" >/dev/null &&
            extra+=(--set "$k=run") || extra+=(--set "$k=skip")
        done
      fi
      [ -f .sdd/route-answers.json ] && extra+=(--answers .sdd/route-answers.json)
      node "$SDD" route --write --confirm "$NOMBRE ($ROL) vía $CANAL" ${extra[@]+"${extra[@]}"} >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "chore(sdd): route confirmed by $NOMBRE" status/; marcar commit; fi
    # La granularidad del plan que mostraba el botón (compacta | normal | fina | auto): la leen el plan y las tareas
    mkdir -p .sdd/hermes
    jq -r --arg v "$VERBO" '[.opciones[]? | select(.verbo == $v) | .granularidad // empty][0] // "auto"' "$PUERTA" > .sdd/hermes/granularidad
    RESULTADO="$VERBO"; RESUMEN="Ruta confirmada ($VERBO) por $NOMBRE ($ROL)"
    if [ "${VERBO#ruta-}" != "$VERBO" ]; then
      RN=$(jq -r --arg v "$VERBO" '.opciones[] | select(.verbo == $v) | .etiqueta | sub("^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+"; "")' "$PUERTA")
      RESUMEN="Ruta «${RN}» elegida por $NOMBRE ($ROL)"
    fi ;;

  plan:conforme)
    if ! hecho registrado; then
      node "$SDD" journal add --stage plan-architect --kind gate --text "$NOMBRE dio conformidad al plan" \
        --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): plan agreed by $NOMBRE" status/; marcar commit; fi
    RESULTADO="conforme"; RESUMEN="Plan conforme ($NOMBRE, $ROL)" ;;

  fase:acepto|fase:observaciones)
    RES=accepted; [ "$VERBO" = observaciones ] && RES=observations
    if ! hecho registrado; then
      # Idempotente: si ya hay un registro con este canal (misma puerta), no se repite
      if ! grep -qF "${BOARD}/${TASK}" acceptance/decisions.jsonl 2>/dev/null; then
        node "$SDD" accept record fase-acceptance --fase "$FASE" --result "$RES" \
          --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      fi
      [ -n "$TEXTO" ] && node "$SDD" journal add --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      node "$SDD" accept --report acceptance/ACCEPTANCE-REPORT.md --fase "$FASE" >/dev/null 2>&1 || true
      marcar registrado
    fi
    if ! hecho commit; then
      commit_si_hay "docs(acceptance): accept FASE-$FASE" acceptance/ status/
      marcar commit
    fi
    if ! hecho tag; then
      GRC=$(jq -r '.gate_exit // "?"' "$ACTA")
      etiquetar "fase-$FASE-accepted" "FASE-$FASE accepted

Accepted-by: $NOMBRE
Approver-role: $ROL
Channel: $CHANNEL
Demo: none
Commit: $HEAD0
Acceptance: gate exit $GRC; result $RES${TEXTO:+; notes: $TEXTO}
Kanban-Task: $BOARD/$TASK"
      marcar tag
    fi
    if ! hecho pack; then node "$SDD" accept pack --fase "$FASE" >/dev/null 2>&1 || true; marcar pack; fi
    if ! hecho fusion; then fusionar "FASE-$FASE accepted"; marcar fusion; fi
    RESULTADO="$VERBO"; OBS=""; [ "$VERBO" = observaciones ] && OBS=" con observaciones"
    RESUMEN="FASE-$FASE aceptada$OBS por $NOMBRE ($ROL) — tag fase-$FASE-accepted$FUSION" ;;

  fase:rechazo)
    # Lo que recibe la implementación: el texto de la persona, sus respuestas a las preguntas de la puerta (con el
    # texto de la opción, no solo la letra) y los criterios de la FASE que no pasan. Un «A» suelto no es trabajo.
    mkdir -p .sdd/hermes/feedback
    {
      printf '%s\n' "$TEXTO"
      python3 - "$TEXTO" "$PUERTA" .sdd/questions-*.md <<'PY' 2>/dev/null || true
import json, re, sys
texto, puerta, *ficheros = sys.argv[1:]
elegidas = {int(n): l.upper() for n, l in re.findall(r"[Qq][A-Za-z]?\s*(\d+)\W{0,3}\s*([A-Ca-c])\b", texto)}
qs = {q["n"]: q["id"] for q in (json.load(open(puerta)).get("preguntas") or [])}
bloques = {}
for f in ficheros:
    try:
        t = open(f).read()
    except OSError:
        continue
    for m in re.finditer(r"^## (Q-\S+)[^\n]*\n(.*?)(?=^## |\Z)", t, re.M | re.S):
        bloques[m.group(1)] = m.group(2)
for n, letra in sorted(elegidas.items()):
    b = bloques.get(qs.get(n, ""), "")
    preg = re.search(r"^Question:\s*(.*)$", b, re.M)
    op = re.search(rf"^\s+{letra}\)\s*(.*?)(?:\s*\(recommended\))?$", b, re.M)
    print(f"Q{n} ({qs.get(n, '?')}): {preg.group(1) if preg else ''} → elegida {letra}: {op.group(1) if op else '?'}")
PY
      node "$SDD" accept --fase "$FASE" --json 2>/dev/null | jq -r '
        (.scope.requirements // []) as $s
        | [.requirements[] | select(.verdict != "VERIFIED" and (($s | length) == 0 or (.id as $i | $s | index($i))))
           | .id as $id | .criteria[]? | select(.state != "pass")
           | "- \($id) AC\(.n // .index): \(.state)"
             + (if ((.literal_gaps // []) | length) > 0 then " — el test no lleva la letra literal: " + ([.literal_gaps[].literal] | unique | join(", ")) else "" end)
             + (if .visual == "missing" then " — falta su captura en evidencias/FASE-'"$FASE"'/" else "" end)]
        | if length > 0 then "Criterios de la FASE que no pasan la aceptación (corrígelos todos):", .[] else empty end' || true
    } > ".sdd/hermes/feedback/implementar-$FASE.txt"
    if ! hecho registrado; then
      grep -qF "${BOARD}/${TASK}" acceptance/decisions.jsonl 2>/dev/null ||
        node "$SDD" accept record fase-acceptance --fase "$FASE" --result rejected \
          --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      node "$SDD" journal add --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): reject FASE-$FASE" acceptance/ status/; marcar commit; fi
    RESULTADO="rechazo"; RESUMEN="FASE-$FASE rechazada por $NOMBRE ($ROL): $TEXTO" ;;

  entrega:acepto|entrega:observaciones)
    N=$(( $(git tag -l 'entrega-*' | wc -l) + 1 ))
    # Plan compacto de una sola FASE: esta puerta traía su demo y aceptarla acepta también la FASE-0 (una decisión, dos
    # registros: el de la FASE y el de la entrega)
    UNICA=$(p .unica); RES=accepted; [ "$VERBO" = observaciones ] && RES=observations
    if [ "$UNICA" = true ] && ! hecho registrado; then
      grep -qF "${BOARD}/${TASK}" acceptance/decisions.jsonl 2>/dev/null ||
        node "$SDD" accept record fase-acceptance --fase 0 --result "$RES" --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      node "$SDD" accept --report acceptance/ACCEPTANCE-REPORT.md --fase 0 >/dev/null 2>&1 || true
    fi
    if ! hecho registrado; then
      node "$SDD" journal add --stage acceptance --kind decision --text "$NOMBRE aceptó la entrega $N${TEXTO:+ con observaciones: $TEXTO}" \
        --by "$NOMBRE ($ROL)" --refs "entrega-$N" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): accept delivery $N" status/ acceptance/; marcar commit; fi
    if ! hecho tag; then
      [ "$UNICA" = true ] && etiquetar "fase-0-accepted" "FASE-0 accepted (single FASE: accepted with delivery $N)

Accepted-by: $NOMBRE
Approver-role: $ROL
Channel: $CHANNEL
Commit: $HEAD0
Acceptance: global gate exit $(jq -r '.gate_exit // "?"' "$ACTA"); result $RES${TEXTO:+; notes: $TEXTO}
Kanban-Task: $BOARD/$TASK"
      etiquetar "entrega-$N" "Delivery $N accepted

Accepted-by: $NOMBRE
Approver-role: $ROL
Channel: $CHANNEL
Commit: $HEAD0
Acceptance: global gate exit $(jq -r '.gate_exit // "?"' "$ACTA")${TEXTO:+; notes: $TEXTO}
Kanban-Task: $BOARD/$TASK

$(node "$SDD" gate --md 2>/dev/null)"
      marcar tag
    fi
    if ! hecho fusion; then fusionar "delivery $N accepted"; marcar fusion; fi
    RESULTADO="$VERBO"; RESUMEN="Entrega $N aceptada por $NOMBRE ($ROL) — tag entrega-$N$FUSION"
    [ "$UNICA" = true ] && RESUMEN="Entrega $N (y su única fase) aceptada por $NOMBRE ($ROL) — tag entrega-$N$FUSION" ;;

  entrega:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/cierre.txt"
    if ! hecho registrado; then
      node "$SDD" journal add --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): delivery rejected by $NOMBRE" status/; marcar commit; fi
    RESULTADO="rechazo"; RESUMEN="Entrega rechazada por $NOMBRE ($ROL): $TEXTO" ;;

  mantenimiento:cambio)
    # La petición del cambio sale de los hallazgos que la persona vio (están en la puerta), más su comentario
    if ! hecho registrado; then
      mkdir -p .sdd/hermes/mantenimiento
      { echo "Mantenimiento detectado el $(jq -r '.creada[0:10]' "$PUERTA") por la revisión periódica:"
        jq -r '.hallazgos[] | "- \(.titulo): \(.propuesta)"' "$PUERTA"
        [ -n "$TEXTO" ] && echo "Comentario de $NOMBRE: $TEXTO"; } > ".sdd/hermes/mantenimiento/peticion-$GATE.txt"
      node "$SDD" journal add --stage maintenance --kind decision \
        --text "$NOMBRE pidió un cambio de mantenimiento: $(jq -r '[.hallazgos[].titulo] | join("; ")' "$PUERTA")" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): maintenance change requested by $NOMBRE" status/; marcar commit; fi
    RESULTADO="cambio"; RESUMEN="Mantenimiento: $NOMBRE ($ROL) lanza un cambio" ;;

  mantenimiento:ignoro)
    if ! hecho registrado; then
      mkdir -p .sdd/hermes/mantenimiento; SIL=.sdd/hermes/mantenimiento/silenciados.json; [ -f "$SIL" ] || echo '{}' > "$SIL"
      t=$(mktemp); jq --slurpfile p "$PUERTA" --arg m "$TEXTO" --arg q "$NOMBRE" --arg h "$HOY" \
        '. + ([$p[0].hallazgos[] | {(.clave): {titulo, motivo:$m, por:$q, el:$h}}] | add // {})' "$SIL" > "$t" && mv "$t" "$SIL"
      node "$SDD" journal add --stage maintenance --kind feedback \
        --text "$NOMBRE ignoró: $(jq -r '[.hallazgos[].titulo] | join("; ")' "$PUERTA"). Motivo: $TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): maintenance findings dismissed by $NOMBRE" status/; marcar commit; fi
    RESULTADO="ignoro"; RESUMEN="Mantenimiento ignorado por $NOMBRE ($ROL): $TEXTO" ;;

  requisitos:cambios|plan:cambios|ruta:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/$TIPO.txt"
    if ! hecho registrado; then
      case "$TIPO" in requisitos) ST=requirements-engineer;; plan) ST=plan-architect;; *) ST=route;; esac
      node "$SDD" journal add --stage "$ST" --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): $TIPO changes requested by $NOMBRE" status/; marcar commit; fi
    RESULTADO="$VERBO"; RESUMEN="$NOMBRE ($ROL) pide cambios en $TIPO: $TEXTO" ;;
esac

# ── 3. cerrar la puerta en el tablero y encadenar lo siguiente ────────────────────────────────────────────────────
if [ -n "$BOARD" ] && ! hecho completado; then
  hermes kanban --board "$BOARD" complete "$TASK" --result "$RESUMEN" >/dev/null
  marcar completado
fi
if ! hecho encadenado; then
  [ -n "$BOARD" ] && [ -x "$ROOT/lanzar.sh" ] && "$ROOT/lanzar.sh" siguiente "$REPO" "$GATE" "$RESULTADO" >/dev/null
  marcar encadenado
fi
t=$(mktemp); jq --arg r "$RESUMEN" '.resultado = $r | del(.error)' "$ACTA" > "$t" && mv "$t" "$ACTA"
IDX="$HOME_SDD/puertas/$GATE.json"   # índice que leen los canales: la puerta queda cerrada
# Una línea por puerta firmada en .sdd/hermes/puertas.jsonl (línea base del encargado): cuánto tardó la decisión, quién,
# si Jev decidió después de que una persona le quitara una decisión anterior, y el texto que acompañó
if ! hecho historial; then
  jq -nc --slurpfile p "$PUERTA" --slurpfile d "$DECISION" --slurpfile i "$IDX" --arg v "$VERBO" --arg r "$RESUMEN" \
    --arg g "$GATE" --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '
    def seg($a): ($a // "" | sub("\\.[0-9]+"; "") | try fromdateiso8601 catch null);
    $p[0] as $p | $d[0] as $d | ($i[0] // {}) as $i |
    {ts: $ts, puerta: $g, tipo: $p.tipo, fase: ($p.fase // null), verbo: $v, persona: $d.actor.persona,
     canal: $d.actor.canal, texto: ($d.texto // ""), resultado: $r,
     segundos_hasta_decidir: (if seg($d.at) and seg($p.creada) then seg($d.at) - seg($p.creada) else null end),
     segundos_mirando: ($i.decision.dwell_s // null), jev_vetado: ($i.jev_vetado != null),
     bloqueada: ($i.bloqueo // false)}' >> .sdd/hermes/puertas.jsonl 2>/dev/null || true
  marcar historial
fi
if [ -f "$IDX" ]; then
  t=$(mktemp); jq --arg r "$RESUMEN" --arg v "$VERBO" '.estado = "firmada" | .resultado = $r | .verbo = $v' "$IDX" > "$t" && mv "$t" "$IDX"
fi
echo "$RESUMEN"
