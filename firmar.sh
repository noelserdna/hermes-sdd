#!/usr/bin/env bash
# El NOTARIO: registra y firma la decisión humana de una puerta. Determinista, sin LLM.
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

p() { jq -r "$1 // empty" "$PUERTA"; }
d() { jq -r "$1 // empty" "$DECISION"; }
TIPO=$(p .tipo); FASE=$(p .fase); BOARD=$(p .tablero); TASK=$(p .tarjeta); SHA=$(p .sha)
VERBO=$(d .verbo); TEXTO=$(d .texto); PERSONA=$(d .actor.persona); CANAL=$(d .actor.canal); ID=$(d .actor.id)
PRUEBA=$(d '.prueba | to_entries | map("\(.key):\(.value)") | join(" ")')

ACTA="$HOME_SDD/actas/${BOARD:-local}/$GATE.json"
mkdir -p "$(dirname "$ACTA")"
[ -f "$ACTA" ] || jq -n --arg g "$GATE" '{puerta:$g, pasos:[]}' > "$ACTA"
hecho() { jq -e --arg s "$1" '.pasos | index($s)' "$ACTA" >/dev/null; }
marcar() { local t; t=$(mktemp); jq --arg s "$1" '.pasos += [$s] | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"; }
fallo() { local t; t=$(mktemp); jq --arg m "$1" '.error = $m | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"
  echo "NOTARIO: rechazado — $1" >&2; exit 1; }

# ── 1. validar (solo la primera vez: después el HEAD ya habrá avanzado con nuestro propio commit) ──────────────────
if ! hecho validado; then
  # La persona existe y la identidad del canal es la suya
  [ -f "$HOME_SDD/aprobadores.json" ] || fallo "falta $HOME_SDD/aprobadores.json"
  jq -e --arg p "$PERSONA" --arg c "$CANAL" --arg i "$ID" \
    '.[$p] and ((.[$p].canales[$c] // "") | tostring) == $i' "$HOME_SDD/aprobadores.json" >/dev/null ||
    fallo "$CANAL:$ID no es una identidad autorizada de '$PERSONA'"
  ROL=$(jq -r --arg p "$PERSONA" '.[$p].rol' "$HOME_SDD/aprobadores.json")
  NOMBRE=$(jq -r --arg p "$PERSONA" '.[$p].nombre // $p' "$HOME_SDD/aprobadores.json")
  # La decisión es posterior a la puerta
  [ ! "$(d .at)" \< "$(p .creada)" ] || fallo "la decisión es anterior a la puerta"
  # Lo que se firma es lo que la persona vio
  [ "$(git rev-parse --short=7 HEAD)" = "${SHA:0:7}" ] || fallo "HEAD ($(git rev-parse --short=7 HEAD)) no es el commit mostrado (${SHA:0:7})"
  [ -z "$(git status --porcelain --untracked-files=no)" ] || fallo "el árbol tiene cambios sin commit"
  # Verbos válidos por tipo de puerta
  case "$TIPO:$VERBO" in
    requisitos:acepto|requisitos:cambios|ruta:acepto|ruta:completo|ruta:rechazo|plan:conforme|plan:cambios) ;;
    fase:acepto|fase:observaciones|fase:rechazo|entrega:acepto|entrega:observaciones|entrega:rechazo) ;;
    *) fallo "verbo '$VERBO' no vale para una puerta de tipo '$TIPO'" ;;
  esac
  case "$VERBO" in cambios|observaciones|rechazo) [ -n "$TEXTO" ] || fallo "'$VERBO' necesita un texto" ;; esac
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
sha256() { shasum -a 256 "$1" | cut -d' ' -f1; }
etiquetar() {  # etiquetar <tag> <mensaje> — idempotente: si existe y apunta a HEAD, ya está hecho
  local tag=$1 msg=$2
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-parse "$tag^{commit}")" = "$(git rev-parse HEAD)" ] || fallo "el tag $tag ya existe en otro commit"
    return
  fi
  local sign=-a; [ -n "$(git config user.signingkey || true)" ] && sign=-s
  git tag $sign "$tag" -F - <<<"$msg"
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
            rec = re.search(r"^\s+([A-Z])\).*\(recommended\)", b, re.M)
            letra, como = (rec.group(1) if rec else "?"), "opción recomendada, aceptada por"
        b = b.replace("[OPEN]", "[ANSWERED]", 1)
        return re.sub(r"^Answer:\s*$", f"Answer: {letra} — {como} {quien} ({hoy})", b, count=1, flags=re.M)
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

  ruta:acepto|ruta:completo)
    if ! hecho registrado; then
      extra=(); [ "$VERBO" = completo ] && extra+=(--full)
      [ -f .sdd/route-answers.json ] && extra+=(--answers .sdd/route-answers.json)
      node "$SDD" route --write --confirm "$NOMBRE ($ROL) vía $CANAL" ${extra[@]+"${extra[@]}"} >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "chore(sdd): route confirmed by $NOMBRE" status/; marcar commit; fi
    RESULTADO="$VERBO"; RESUMEN="Ruta confirmada ($VERBO) por $NOMBRE ($ROL)" ;;

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
Acceptance: gate exit $GRC; result $RES${TEXTO:+; observations: $TEXTO}
Kanban-Task: $BOARD/$TASK"
      marcar tag
    fi
    if ! hecho pack; then node "$SDD" accept pack --fase "$FASE" >/dev/null 2>&1 || true; marcar pack; fi
    RESULTADO="$VERBO"; RESUMEN="FASE-$FASE aceptada${TEXTO:+ con observaciones} por $NOMBRE ($ROL) — tag fase-$FASE-accepted" ;;

  fase:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/implementar-$FASE.txt"
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
    if ! hecho registrado; then
      node "$SDD" journal add --stage acceptance --kind decision --text "$NOMBRE aceptó la entrega $N${TEXTO:+ con observaciones: $TEXTO}" \
        --by "$NOMBRE ($ROL)" --refs "entrega-$N" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): accept delivery $N" status/ acceptance/; marcar commit; fi
    if ! hecho tag; then
      etiquetar "entrega-$N" "Delivery $N accepted

Accepted-by: $NOMBRE
Approver-role: $ROL
Channel: $CHANNEL
Commit: $HEAD0
Acceptance: global gate exit $(jq -r '.gate_exit // "?"' "$ACTA")${TEXTO:+; observations: $TEXTO}
Kanban-Task: $BOARD/$TASK

$(node "$SDD" gate --md 2>/dev/null)"
      marcar tag
    fi
    RESULTADO="$VERBO"; RESUMEN="Entrega $N aceptada por $NOMBRE ($ROL) — tag entrega-$N" ;;

  entrega:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/cierre.txt"
    if ! hecho registrado; then
      node "$SDD" journal add --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): delivery rejected by $NOMBRE" status/; marcar commit; fi
    RESULTADO="rechazo"; RESUMEN="Entrega rechazada por $NOMBRE ($ROL): $TEXTO" ;;

  requisitos:cambios|plan:cambios|ruta:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/$TIPO.txt"
    if ! hecho registrado; then
      node "$SDD" journal add --stage "$TIPO" --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null 2>&1 || true
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
if [ -f "$IDX" ]; then
  t=$(mktemp); jq --arg r "$RESUMEN" --arg v "$VERBO" '.estado = "firmada" | .resultado = $r | .verbo = $v' "$IDX" > "$t" && mv "$t" "$IDX"
fi
echo "$RESUMEN"
