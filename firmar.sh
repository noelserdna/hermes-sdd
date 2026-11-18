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
. "$ROOT/lib/comun.sh"   # parcial, gate_entrega (entrega parcial)
# La tabla de transiciones (lib/transiciones.json): qué verbos valen en cada tipo de puerta, cuáles exigen que la
# puerta los ofreciera, un texto o una persona, y a qué resultado lleva cada uno (el que recibe lanzar.sh siguiente)
. "$ROOT/lib/transiciones.sh"
# El diario del método admite notas de hasta 600 caracteres; el texto de una persona puede ser más largo (club,
# FASE-7: un rechazo de 755 dejó la decisión escrita a medias). Al diario va recortado; entero queda en la decisión.
diario() {
  local a=()
  while [ $# -gt 0 ]; do
    if [ "$1" = --text ]; then
      local t="$2"; [ "${#t}" -gt 590 ] && t="${t:0:560}… (sigue en la decisión)"
      a+=(--text "$t"); shift 2
    else a+=("$1"); shift; fi
  done
  node "$SDD" journal add "${a[@]}"
}
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
  and (.decision.actor.persona == $d[0].actor.persona) and (.decision.actor.canal == $d[0].actor.canal)
  and ((.decision.respuestas // {}) == ($d[0].respuestas // {}))' "$IDX" >/dev/null ||
  { echo "NOTARIO: rechazado — la decisión de $GATE no coincide con la que registró un canal" >&2; exit 1; }
# Lo que se firma es la puerta que vio quien decidió (persona o Jev): la del índice, fuera del alcance de las etapas. La
# copia del repo, de la que se leen tipo, sha, opciones, preguntas, bloqueo y tests editados, tiene que ser idéntica en
# todo lo que se mostró; una etapa que la retocara (p. ej. «tests_editados: 0» o un sha distinto) no engaña al notario.
DIF=$(jq -r --slurpfile r "$PUERTA" '. as $i | $r[0] | del(.tarjeta, .estado) | keys[] | select($i[.] != $r[0][.])' "$IDX" 2>/dev/null) ||
  { echo "NOTARIO: rechazado — no se pudo comparar la puerta $GATE con el índice" >&2; exit 1; }
[ -z "$DIF" ] || { echo "NOTARIO: rechazado — la copia de la puerta $GATE en el proyecto no es la que se mostró (cambió: $(echo $DIF | tr ' ' ','))" >&2; exit 1; }

# Candado del repo (lib/candado.sh): no se firma con una etapa en marcha (sus commits y los del notario se pisarían).
# Ocupado por una etapa → sale con 75 y quien llama reintenta más tarde (no es un rechazo); por otra firma, se espera.
. "$ROOT/lib/candado.sh"
ESPERA=0
until candado_tomar "$REPO" firma "$GATE"; do
  case "$CANDADO_OTRO" in firma*) [ "$ESPERA" -lt 600 ] && { sleep 2; ESPERA=$((ESPERA + 2)); continue; } ;; esac
  echo "NOTARIO: ocupado — $CANDADO_OTRO; se firmará cuando acabe" >&2; exit 75
done
trap candado_soltar EXIT

p() { jq -r "$1 // empty" "$PUERTA"; }
d() { jq -r "$1 // empty" "$DECISION"; }
TIPO=$(p .tipo); FASE=$(p .fase); BOARD=$(p .tablero); TASK=$(p .tarjeta); SHA=$(p .sha)
VERBO=$(d .verbo); TEXTO=$(d .texto); PERSONA=$(d .actor.persona); CANAL=$(d .actor.canal); ID=$(d .actor.id)
VERBO_DECIDIDO=$VERBO   # el botón que pulsó la persona (VERBO puede pasar a ser otro: revisado → acepto, acepto → cambios)
# Las respuestas que la persona MARCÓ en los botones Q, como campo de la decisión ({"1": "B"}; lo pone el núcleo). Las
# decisiones anteriores las llevaban solo dentro del texto («Q1: B»), que se sigue leyendo.
RESPUESTAS=$(jq -c '.respuestas // {}' "$DECISION")
PRUEBA=$(d '.prueba | to_entries | map("\(.key):\(.value)") | join(" ")')
# Verbos que solo puede elegir una persona y que la puerta tiene que haber ofrecido (en la tabla: «persona», «opcion»):
#  🔍 revisado  — confirma las inspecciones que la puerta enseñaba y acepta (se registran a su nombre en el paso 1b)
#  🟡 eximo     — exime los imprescindibles sin cumplir, con su motivo (paso 1c), y acepta
#  ✏️ corrijo   — la duda de la revisión es del propio criterio: se lanza un cambio de requisitos con lo que pide la
#                 persona y las dudas abiertas (al aprobarse, la FASE se rehace con el criterio bueno)
#  🗑 descarto  — un hallazgo de la revisión independiente no es un fallo (nombra CH-NNN y por qué): se registra como
#                 challenge-dismissal a su nombre y la puerta se vuelve a abrir sin él
# Se comprueban antes de nada (sin acta). Revisado y eximo se firman después como «acepto» («como» en la tabla).
if jq -e --arg v "$VERBO" 'any(.puertas[].verbos[$v] // empty; .persona)' "$TRANSICIONES" >/dev/null; then
  trans_verbo "$TIPO" "$VERBO" >/dev/null || { echo "NOTARIO: rechazado — '$VERBO' no vale para una puerta de tipo '$TIPO'" >&2; exit 1; }
  COMO=$(trans_campo "$TIPO" "$VERBO" como)
  if [ -n "$COMO" ]; then   # (la opción de corrijo y descarto se comprueba al validar, como la de cualquier verbo)
    jq -e --arg v "$VERBO" 'any(.opciones[]; .verbo == $v)' "$PUERTA" >/dev/null || { echo "NOTARIO: rechazado — $(trans_campo "$TIPO" "$VERBO" opcion)" >&2; exit 1; }
  fi
  [ "$CANAL" != jev ] || { echo "NOTARIO: rechazado — $(trans_campo "$TIPO" "$VERBO" persona)" >&2; exit 1; }
  if [ "$VERBO" = descarto ]; then
    printf '%s' "$TEXTO" | grep -qE 'CH-[0-9]+' || { echo "NOTARIO: rechazado — di qué impugnación descartas (su número, p. ej. CH-005) y por qué" >&2; exit 1; }
  fi
  if [ "$VERBO" = eximo ]; then
    [ -n "$TEXTO" ] || { echo "NOTARIO: rechazado — una exención necesita su motivo" >&2; exit 1; }
  fi
  [ -z "$COMO" ] || VERBO=$COMO
fi
REVISADO=false; [ "$VERBO_DECIDIDO" = revisado ] && [ "$VERBO" != revisado ] && REVISADO=true
EXIMO=false; [ "$VERBO_DECIDIDO" = eximo ] && [ "$VERBO" != eximo ] && EXIMO=true

# Respuestas a las preguntas que enseñó la puerta («Q1: A, Q2: B», lo añade el canal): se validan contra lo que la
# persona vio ANTES de firmar nada. Una letra que no es opción, una pregunta que no existe o dos letras para la misma
# rechazan la decisión con su motivo (antes «Q1: D» se ignoraba en silencio y «De Q1 a Q3…» se leía como Q1 = A). Y
# una opción que autoriza editar tests que ya existían (efecto: editar-test) solo la puede elegir una persona.
TEXTOS="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
# (con su .json, la fuente de verdad de las preguntas nuevas: efectos, recomendada y respuesta salen de ahí)
QFILES=(); for f in .sdd/questions-*.md .sdd/questions-*.json; do [ -f "$f" ] && QFILES+=("$f"); done
# Las respuestas se contestan con el botón que se PULSÓ (VERBO_PULSADO), aunque luego el notario convierta «Apruebo»
# en «cambios» por unas respuestas distintas: las preguntas que no se tocaron valen con la recomendada que se veía
respuestas() { python3 "$TEXTOS" respuestas "$1" --puerta "$PUERTA" --texto "$TEXTO" --respuestas "$RESPUESTAS" --verbo "${VERBO_PULSADO:-$VERBO}" "${@:2}" ${QFILES[@]+"${QFILES[@]}"}; }
if ! jq -e '.pasos | index("validado")' "$HOME_SDD/actas/${BOARD:-local}/$GATE.json" >/dev/null 2>&1 &&
   ! ERR=$(respuestas validar --persona "$([ "$CANAL" = jev ] && echo 0 || echo 1)" 2>&1); then
  echo "NOTARIO: rechazado — las respuestas no valen: $(printf '%s' "$ERR" | paste -sd';' - | sed 's/;/; /g')" >&2; exit 1
fi

# Aprobar requisitos o plan eligiendo en alguna pregunta una opción distinta de la recomendada: el texto que la
# persona vio está escrito con la recomendada, así que firmarlo dejaría aprobado algo distinto de lo que eligió.
# Se convierte en una petición de cambios con esas respuestas: la etapa rehace el texto y la puerta vuelve a abrirse.
# (en la tabla: «si_distintas»)
SI_DISTINTAS=$(trans_campo "$TIPO" "$VERBO" si_distintas)
if [ -n "$SI_DISTINTAS" ] && { [ -n "$TEXTO" ] || [ "$RESPUESTAS" != "{}" ]; }; then
  DISTINTAS=$(respuestas distintas)
  if [ -n "$DISTINTAS" ]; then
    VERBO_PULSADO=$VERBO; VERBO=$SI_DISTINTAS
    TEXTO="${TEXTO:+$TEXTO. }Respuestas distintas de la recomendada ($DISTINTAS): reescribe lo afectado según esas respuestas (están en .sdd/questions-*.md)."
  fi
fi

CLAVE_NOTARIO=$(jq -r '.clave_notario // empty' "$HOME_SDD/sdd.json" 2>/dev/null || true); CLAVE_NOTARIO=${CLAVE_NOTARIO:-$HOME/.ssh/hermes-notario}
CLAVE_NOTARIO=${CLAVE_NOTARIO/#\~/$HOME}
[ -f "$CLAVE_NOTARIO" ] && [ -f "$CLAVE_NOTARIO.pub" ] || CLAVE_NOTARIO=""
ACTA="$HOME_SDD/actas/${BOARD:-local}/$GATE.json"
mkdir -p "$(dirname "$ACTA")"
[ -f "$ACTA" ] || jq -n --arg g "$GATE" '{puerta:$g, pasos:[]}' > "$ACTA"
hecho() { jq -e --arg s "$1" '.pasos | index($s)' "$ACTA" >/dev/null; }
marcar() { local t; t=$(mktemp); jq --arg s "$1" '.pasos += [$s] | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"; }
fallo() { local t; t=$(mktemp); jq --arg m "$1" '.error = $m | .actualizado = (now|todate)' "$ACTA" > "$t" && mv "$t" "$ACTA"
  restaurar_previos; echo "NOTARIO: rechazado — $1" >&2; exit 1; }
# Lo que la validación registra antes de saber si la puerta de calidad se cumple (inspecciones 1b, exenciones 1c) se
# escribe sin commit y con copia: si la validación falla se restaura y HEAD no se mueve (antes se commiteaba primero y,
# si la puerta de calidad fallaba, HEAD había avanzado: todo reintento chocaba con «HEAD no es el commit mostrado»)
BKP=""
guardar_previos() {
  BKP=$(mktemp -d)
  local f; for f in acceptance/decisions.jsonl acceptance/PENDIENTES.md; do [ -f "$f" ] && cp "$f" "$BKP/$(basename "$f")"; done; return 0
}
restaurar_previos() {
  [ -n "$BKP" ] || return 0
  local f; for f in acceptance/decisions.jsonl acceptance/PENDIENTES.md; do
    if [ -f "$BKP/$(basename "$f")" ]; then cp "$BKP/$(basename "$f")" "$f"; else rm -f "$f"; fi
  done
  rm -rf "$BKP"; BKP=""
}

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
  # Verbos válidos por tipo de puerta: los de la tabla; con «opcion», solo si la puerta lo ofrecía; con «texto», con él
  trans_verbo "$TIPO" "$VERBO" >/dev/null || fallo "verbo '$VERBO' no vale para una puerta de tipo '$TIPO'"
  OPC=$(trans_campo "$TIPO" "$VERBO" opcion)
  [ -z "$OPC" ] || jq -e --arg v "$VERBO" 'any(.opciones[]; .verbo == $v)' "$PUERTA" >/dev/null || fallo "$OPC"
  [ "$(trans_campo "$TIPO" "$VERBO" texto)" != true ] || [ -n "$TEXTO" ] || fallo "'$VERBO' necesita un texto"
  guardar_previos
  # 1b. inspecciones confirmadas en la puerta (idempotente: una por requisito y puerta); el commit, tras validar
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
  fi
  # 1c. exenciones: cada imprescindible sin cumplir del alcance (la FASE o todo) queda eximido con el motivo de la
  # persona y una referencia de seguimiento <PROYECTO>-N, apuntada en acceptance/PENDIENTES.md (el método la exige para
  # eximir un Must). Idempotente: una por requisito y puerta.
  if [ "$EXIMO" = true ]; then
    KEY=$(printf '%s' "${BOARD:-$(basename "$REPO")}" | tr '[:lower:]' '[:upper:]' | tr -cd 'A-Z0-9')
    case "$KEY" in [A-Z]*) ;; *) KEY="P$KEY" ;; esac; [ "${#KEY}" -ge 2 ] || KEY="${KEY}X"
    PEND=acceptance/PENDIENTES.md; mkdir -p acceptance
    [ -f "$PEND" ] || printf '%s\n' "# Pendientes" "" \
      "Lo que se aceptó sin cumplir del todo. Cada fila es una exención firmada en una puerta (acceptance/decisions.jsonl) y su número es la referencia de seguimiento que pide el método; se cierra cuando un cambio o una FASE posterior lo cumple." "" \
      "| Id | Requisito | Qué falta | Motivo | Quién | Fecha | Puerta | Estado |" "|---|---|---|---|---|---|---|---|" > "$PEND"
    if [ "$TIPO" = fase ]; then ACC=$(node "$SDD" accept --fase "$FASE" --json 2>/dev/null || true); else ACC=$(node "$SDD" accept --json 2>/dev/null || true); fi
    FALTAN=$(printf '%s' "$ACC" | jq -r '(.scope.requirements // null) as $s | .requirements[]?
      | select(.priority == "Must" and ((.verdict | IN("VERIFIED", "WAIVED")) | not) and ($s == null or (.id as $i | $s | index($i))))
      | [.id, (.title // ""), ([.criteria[]? | select(.state != "pass") | "AC\(.n // .index) (\(.state))"] | join(", "))] | @tsv' 2>/dev/null || true)
    [ -n "$FALTAN" ] || grep -qF "| $GATE |" "$PEND" || fallo "no hay ningún imprescindible sin cumplir que eximir"
    MOTIVO=$(printf '%s' "$TEXTO" | tr '|\n' '/ ')
    while IFS=$'\t' read -r REQ TIT QUE; do
      [ -n "$REQ" ] || continue
      grep -F "| $REQ " "$PEND" | grep -qF "| $GATE |" && continue
      FU="$KEY-$(( $(grep -cE "^\| $KEY-[0-9]+ " "$PEND" || true) + 1 ))"   # grep -c sin filas sale con 1 (set -e)
      node "$SDD" accept record waiver --req "$REQ" --reason "$TEXTO (puerta $GATE)" --follow-up "$FU" --by "$NOMBRE" --role "$ROL" >/dev/null ||
        fallo "no se pudo registrar la exención de $REQ"
      printf '| %s | %s %s | %s | %s | %s (%s) | %s | %s | abierto |\n' "$FU" "$REQ" "$TIT" "${QUE:-—}" "$MOTIVO" "$NOMBRE" "$ROL" "$(date +%Y-%m-%d)" "$GATE" >> "$PEND"
    done <<< "$FALTAN"
    # Si con las exenciones la puerta sigue sin cumplirse (p. ej. falta el vídeo de la demo, que no se exime), no queda
    # nada registrado: se deshace y solo cabe rechazar
    rc=0; G=$(mktemp)
    if [ "$TIPO" = fase ]; then node "$SDD" gate --fase "$FASE" > "$G" 2>&1 || rc=$?; else gate_entrega > "$G" 2>&1 || rc=$?; fi
    if [ "$rc" != 0 ] && [ "$rc" != 3 ]; then
      QUEDA=$(grep -E '^missing video|^FAILING|exit [0-9]' "$G" | grep -v WAIVED | head -2 | paste -sd';' -); rm -f "$G"
      fallo "aun eximiendo los imprescindibles, la puerta de calidad sigue sin cumplirse ($QUEDA): solo se admite rechazo"
    fi
    rm -f "$G"
  fi
  # Aceptar una FASE exige la puerta de calidad cumplida (0) o cumplida con exenciones (3); rechazar, no
  if { [ "$TIPO" = fase ] || [ "$TIPO" = entrega ]; } && [ "$VERBO" != rechazo ] && [ "$VERBO" != descarto ] && [ "$VERBO" != corrijo ]; then
    rc=0
    if [ "$TIPO" = fase ]; then node "$SDD" gate --fase "$FASE" >/dev/null 2>&1 || rc=$?
    else gate_entrega >/dev/null 2>&1 || rc=$?; fi
    [ "$rc" = 0 ] || [ "$rc" = 3 ] || fallo "la puerta de calidad sale con $rc: solo se admite rechazo"
  fi
  t=$(mktemp); jq --arg r "$ROL" --arg n "$NOMBRE" --arg h "$(git rev-parse HEAD)" --arg g "${rc:-}" \
    '.rol=$r | .nombre=$n | .head=$h | .gate_exit=$g' "$ACTA" > "$t" && mv "$t" "$ACTA"
  marcar validado
  rm -rf "$BKP"; BKP=""   # validado: lo registrado se queda (y se commitea en el paso siguiente)
fi
ROL=$(jq -r .rol "$ACTA"); NOMBRE=$(jq -r .nombre "$ACTA"); HEAD0=$(jq -r .head "$ACTA")
# 1d. commits de lo registrado al validar (inspecciones o exenciones). Si se corta antes, el reintento los hace.
if [ "$REVISADO" = true ] && ! hecho inspeccion; then
  git add acceptance/decisions.jsonl 2>/dev/null || true
  git diff --cached --quiet || git commit -q -m "docs(acceptance): inspection by $NOMBRE" --trailer "Refs: $(jq -r '[.revisar[]?.id] | join(", ")' "$PUERTA")" --trailer "Gate-Id: $GATE"
  marcar inspeccion
fi
if [ "$EXIMO" = true ] && ! hecho exencion; then
  git add acceptance/ 2>/dev/null || true
  git diff --cached --quiet || git commit -q -m "docs(acceptance): waiver by $NOMBRE" \
    --trailer "Refs: $(grep -F "| $GATE |" acceptance/PENDIENTES.md | awk -F'|' '{print $3}' | awk '{print $1}' | paste -sd, - | sed 's/,/, /g')" --trailer "Gate-Id: $GATE"
  marcar exencion
fi
CHANNEL="$CANAL:$ID $PRUEBA ${BOARD}/${TASK} gate:$GATE"
# Clave de idempotencia de los registros de aceptación: el id de la puerta (con «${BOARD}/${TASK}» y la tarjeta vacía,
# cualquier registro anterior casaba y la aceptación no se registraba)
registrada() { grep -qF "gate:$GATE\"" acceptance/decisions.jsonl 2>/dev/null; }
HOY=$(date +%Y-%m-%d)
TAG=""   # el tag que deja la firma (requirements-vN, fase-N-accepted, entrega-N), si deja alguno
sha256() { if command -v sha256sum >/dev/null; then sha256sum "$1"; else shasum -a 256 "$1"; fi | cut -d' ' -f1; }
etiquetar() {  # etiquetar <tag> <mensaje> — idempotente: si existe y apunta a HEAD, ya está hecho
  local tag=$1 msg=$2
  if git rev-parse -q --verify "refs/tags/$tag" >/dev/null; then
    [ "$(git rev-parse "$tag^{commit}")" = "$(git rev-parse HEAD)" ] || fallo "el tag $tag ya existe en otro commit"
    return
  fi
  # Con la clave del notario (sdd.json «clave_notario», por defecto ~/.ssh/hermes-notario) el tag va firmado con ella:
  # `git tag -v` demuestra que lo puso el notario, no un agente (la clave vive donde el notario, nunca en la caja donde
  # trabaja el agente). Sin ella, la del usuario si la tiene; si no, anotado.
  if [ -n "$CLAVE_NOTARIO" ]; then
    git -c gpg.format=ssh -c user.signingkey="$CLAVE_NOTARIO.pub" tag -s "$tag" -F - <<<"$msg" || fallo "no se pudo firmar el tag $tag con la clave del notario"
    return
  fi
  local sign=-a; [ -n "$(git config user.signingkey || true)" ] && sign=-s
  git tag $sign "$tag" -F - <<<"$msg"
}
firmar_acta() {  # el acta firmada con la clave del notario (<acta>.sig, ssh-keygen -Y sign, espacio «hermes-sdd-acta»)
  [ -n "$CLAVE_NOTARIO" ] || return 0
  rm -f "$ACTA.sig"
  ssh-keygen -Y sign -q -f "$CLAVE_NOTARIO" -n hermes-sdd-acta "$ACTA" >/dev/null 2>&1 || echo "NOTARIO: aviso — no se pudo firmar el acta" >&2
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
  if git merge --no-ff -q "$rama" -m "Merge $rama: $1" -m "Refs: $([ -n "$FASE" ] && echo "FASE-$FASE" || echo "$TIPO")
Gate-Id: $GATE" >/dev/null 2>&1; then
    FUSION=" · $rama fusionada en $def"
  else
    git merge --abort >/dev/null 2>&1 || true; git switch -q "$rama" 2>/dev/null || true
    FUSION=" (la rama $rama no se pudo fusionar en $def: hay conflictos; queda para una persona)"
  fi
}
feedback_implementar() {  # lo que recibe una implementación rechazada: texto, respuestas, criterios que no pasan, impugnaciones
  local FASE=$1
  mkdir -p .sdd/hermes/feedback
  {
    printf '%s\n' "$TEXTO"
    respuestas lineas 2>/dev/null || true
    node "$SDD" accept --fase "$FASE" --json 2>/dev/null | jq -r '
      (.scope.requirements // []) as $s
      | [.requirements[] | select(.verdict != "VERIFIED" and (($s | length) == 0 or (.id as $i | $s | index($i))))
         | .id as $id | .criteria[]? | select(.state != "pass")
         | "- \($id) AC\(.n // .index): \(.state)"
           + (if ((.literal_gaps // []) | length) > 0 then " — el test no lleva la letra literal: " + ([.literal_gaps[].literal] | unique | join(", ")) else "" end)
           + (if .visual == "missing" then " — falta su captura en evidencias/FASE-'"$FASE"'/" else "" end)]
      | if length > 0 then "Criterios de la FASE que no pasan la aceptación (corrígelos todos):", .[] else empty end' || true
    node "$SDD" accept challenge list --open --fase "$FASE" --json 2>/dev/null | jq -r '[.challenges[]? | select(.state == "open")
      | "- \(.id) \(.req) AC\(.ac) [\(.category)]: «\(.quote)» — \((.evidence // []) | map(if type == "object" then (.path + (if .line then ":\(.line)" else "" end)) else tostring end) | join(", "))"]
      | if length > 0 then "Hallazgos de la revisión independiente (el test o la captura no prueban el criterio):", .[] else empty end' 2>/dev/null || true
  } > ".sdd/hermes/feedback/implementar-$FASE.txt"
  # El commit que la persona rechazó: la implementación tiene que cambiar algo DESDE AQUÍ, no desde que empieza cada
  # intento (material-montana5, M5-14: el primer reintento hizo el trabajo y falló por otra cosa; el segundo no tenía
  # nada más que hacer y la guarda «no ha cambiado nada» lo bloqueó 35 min)
  git rev-parse HEAD > ".sdd/hermes/feedback/implementar-$FASE.base"
}

commit_si_hay() {  # commit_si_hay <mensaje> <rutas...> — solo las que existen; no hace nada si no hay cambios
  local msg=$1 r; shift
  for r in "$@"; do [ -e "$r" ] && git add -- "$r"; done
  git diff --cached --quiet || git commit -q -m "$msg" --trailer "Gate-Id: $GATE"
}

# ── 2a. preguntas abiertas (clase C) que la puerta mostró ────────────────────────────────────────────────────────
# «Q1: A, Q2: B» en el texto → esas letras; aceptar, dar conformidad o responder sin ellas → la opción recomendada.
# Lo que lanza cada respuesta sale del efecto que declara su opción (efecto: ninguno | accion | req-change |
# editar-test <ficheros>); solo las preguntas antiguas, sin efecto, se leen con las reglas de siempre.
if ! hecho preguntas; then
  # Respuestas que piden cambiar los requisitos (req-change): al aprobar un plan, una FASE o la entrega, se apuntan
  # aquí y el paso 3 lanza el cambio en vez del tramo siguiente; las que piden trabajo (accion, editar-test), al aceptar
  # una FASE o la entrega, las aplica la etapa «respuestas» antes del tramo siguiente
  PIDEN=""; ACCIONES=""
  # (también al pedir cambios al plan o rechazar una FASE: lo pedido queda en feedback/ y se aplica tras el cambio, al
  # replanificar o al rehacer la FASE; antes esas respuestas se guardaban y el cambio no se lanzaba nunca)
  # (y al aprobar los requisitos: la puerta dice «esto lanzará: 📝 abre un cambio de requisitos: Q3, Q4»; antes se
  # apuntaba y se seguía con la ruta, y lo elegido se perdía — taller, 14/11/2026: el taller compartido con servidor)
  # (en la tabla: «respuestas» de cada verbo, cambio y aplicar)
  if trans_tiene "$TIPO" "$VERBO" respuestas cambio; then PIDEN=".sdd/hermes/cambio-por-respuestas-$GATE.txt"; fi
  if trans_tiene "$TIPO" "$VERBO" respuestas aplicar; then ACCIONES=".sdd/hermes/respuestas-por-aplicar-$GATE.txt"; fi
  mkdir -p .sdd/hermes
  RJ=".sdd/hermes/respuestas-$GATE.json"
  respuestas aplicar --quien "$NOMBRE ($ROL)" --hoy "$HOY" --salida "$RJ" >/dev/null || fallo "no se pudieron escribir las respuestas"
  if [ -n "$PIDEN" ] && [ "$(jq '.peticiones | length' "$RJ")" -gt 0 ]; then jq -r '.peticiones | join("\n\n")' "$RJ" > "$PIDEN"; fi
  if [ -n "$ACCIONES" ] && [ "$(jq '.por_aplicar | length' "$RJ")" -gt 0 ]; then jq -r '.por_aplicar | join("\n\n")' "$RJ" > "$ACCIONES"; fi
  marcar preguntas
fi
# ── 2b. tests que la persona autoriza editar (art. 12) ──────────────────────────────────────────────────────────────
# La única autorización que vale para editar un test que ya existía: una respuesta de una persona cuya opción declara
# «efecto: editar-test <ficheros>». El notario la registra en acceptance/decisions.jsonl (test-edit: los ficheros, la
# pregunta, la puerta, quién) y en su acta, fuera del alcance de las etapas. hsdd_fidelidad solo cree eso: una línea
# «Answer: … elegida por Ana» en .sdd/questions-*.md (que una etapa puede escribir) ya no autoriza nada.
if ! hecho autorizado; then
  RJ=".sdd/hermes/respuestas-$GATE.json"
  if [ -s "$RJ" ] && [ "$(jq '.autorizaciones | length' "$RJ" 2>/dev/null || echo 0)" -gt 0 ]; then
    # Jev solo puede autorizar ENDURECER (efecto endurecer-test); editar a secas un test que ya existía es de una persona
    [ "$CANAL" != jev ] || [ "$(jq '[.autorizaciones[] | select(.endurecer != true)] | length' "$RJ")" = 0 ] ||
      fallo "editar un test que ya existía lo autoriza una persona, no Jev (art. 12); Jev solo puede autorizar endurecerlo"
    while IFS= read -r A; do
      QID=$(jq -r .pregunta <<< "$A")
      jq -e --arg g "$GATE" --arg q "$QID" 'select(.type == "test-edit" and .gate == $g and .question == $q)' acceptance/decisions.jsonl >/dev/null 2>&1 && continue
      FICH=(); while IFS= read -r f; do FICH+=("$f"); done < <(jq -r '.ficheros[]' <<< "$A")
      END=(); [ "$(jq -r '.endurecer // false' <<< "$A")" = true ] && END=(--tighten)
      node "$SDD" accept record test-edit --paths "${FICH[@]}" --question "$QID" --gate "$GATE" ${END[@]+"${END[@]}"} \
        --reason "$(jq -r .motivo <<< "$A")" --by "$NOMBRE" --role "$ROL" >/dev/null || fallo "no se pudo registrar la autorización de $QID"
    done < <(jq -c '.autorizaciones[]' "$RJ")
    t=$(mktemp); jq --slurpfile r "$RJ" '.autorizaciones = [$r[0].autorizaciones[] | {pregunta, ficheros} + (if .endurecer then {endurecer: true} else {} end)]' "$ACTA" > "$t" && mv "$t" "$ACTA"
    # Question-Id y no Refs: el hook commit-msg del proyecto solo admite ids de especificación en Refs (taller: el
    # notario se quedaba a medias con «Refs `Q-acceptance-001` is not a spec id»)
    git add acceptance/decisions.jsonl
    git diff --cached --quiet || git commit -q -m "docs(acceptance): test edit authorized by $NOMBRE" \
      --trailer "Question-Id: $(jq -r '[.autorizaciones[].pregunta] | join(", ")' "$RJ")" --trailer "Gate-Id: $GATE"
  fi
  marcar autorizado
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
      # Ejemplos revisados (lint --needs: examples-not-reviewed): los firma la persona que aprueba; si aprueba Jev, nadie
      # los ha revisado y la firma anterior (de otra versión) se quita
      sed -i.bak -E '/^> \*\*(Ejemplos revisados por|Examples reviewed by):?\*\*/d' requirements/REQUIREMENTS.md
      if [ "$CANAL" != jev ]; then
        sed -i.bak -E "/^> \*\*Approved by:\*\*/a\\
> **Ejemplos revisados por:** $NOMBRE ($ROL), $HOY" requirements/REQUIREMENTS.md
      fi
      rm -f requirements/REQUIREMENTS.md.bak
      diario --stage requirements-engineer --kind decision \
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
    TAG="requirements-v$V"; RESUMEN="Requisitos v$V aprobados por $NOMBRE ($ROL) — tag $TAG" ;;

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
    RESUMEN="Ruta confirmada ($VERBO) por $NOMBRE ($ROL)"
    if [ "${VERBO#ruta-}" != "$VERBO" ]; then
      RN=$(jq -r --arg v "$VERBO" '.opciones[] | select(.verbo == $v) | .etiqueta | sub("^[^A-Za-zÁÉÍÓÚÑáéíóúñ]+"; "")' "$PUERTA")
      RESUMEN="Ruta «${RN}» elegida por $NOMBRE ($ROL)"
    fi ;;

  plan:conforme)
    if ! hecho registrado; then
      diario --stage plan-architect --kind gate --text "$NOMBRE dio conformidad al plan" \
        --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): plan agreed by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Plan conforme ($NOMBRE, $ROL)" ;;

  fase:acepto|fase:observaciones)
    RES=accepted; [ "$VERBO" = observaciones ] && RES=observations
    if ! hecho registrado; then
      # Idempotente: si ya hay un registro con este canal (misma puerta), no se repite
      if ! registrada; then
        node "$SDD" accept record fase-acceptance --fase "$FASE" --result "$RES" \
          --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      fi
      [ -n "$TEXTO" ] && diario --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      # Las observaciones no se quedan en el diario: la siguiente implementación las hace (club: «la captura de AC4
      # tiene que enseñar también al socio» se aceptó con observaciones y nadie la habría arreglado)
      if [ "$VERBO" = observaciones ] && [ -n "$TEXTO" ]; then
        mkdir -p .sdd/hermes/feedback; printf -- '- FASE-%s (%s, %s): %s\n' "$FASE" "$NOMBRE" "$HOY" "$TEXTO" >> .sdd/hermes/feedback/observaciones.txt
      fi
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
    OBS=""; [ "$VERBO" = observaciones ] && OBS=" con observaciones"
    TAG="fase-$FASE-accepted"; RESUMEN="FASE-$FASE aceptada$OBS por $NOMBRE ($ROL) — tag $TAG$FUSION" ;;

  fase:rechazo)
    # Lo que recibe la implementación: el texto de la persona, sus respuestas a las preguntas de la puerta (con el
    # texto de la opción, no solo la letra) y los criterios de la FASE que no pasan. Un «A» suelto no es trabajo.
    feedback_implementar "$FASE"
    if ! hecho registrado; then
      registrada ||
        node "$SDD" accept record fase-acceptance --fase "$FASE" --result rejected \
          --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      diario --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): reject FASE-$FASE" acceptance/ status/; marcar commit; fi
    RESUMEN="FASE-$FASE rechazada por $NOMBRE ($ROL): $TEXTO" ;;

  entrega:acepto|entrega:observaciones)
    # El número de la entrega se fija en el acta la primera vez: al reanudar tras un corte, contar tags daría N+1
    N=$(jq -r '.entrega_n // empty' "$ACTA")
    if [ -z "$N" ]; then
      N=$(( $(git tag -l 'entrega-*' | wc -l) + 1 ))
      t=$(mktemp); jq --argjson n "$N" '.entrega_n = $n' "$ACTA" > "$t" && mv "$t" "$ACTA"
    fi
    # Plan compacto de una sola FASE: esta puerta traía su demo y aceptarla acepta también la FASE-0 (una decisión, dos
    # registros: el de la FASE y el de la entrega)
    UNICA=$(p .unica); RES=accepted; [ "$VERBO" = observaciones ] && RES=observations
    if [ "$UNICA" = true ] && ! hecho registrado; then
      registrada ||
        node "$SDD" accept record fase-acceptance --fase 0 --result "$RES" --channel "$CHANNEL" --by "$NOMBRE" --role "$ROL" >/dev/null
      node "$SDD" accept --report acceptance/ACCEPTANCE-REPORT.md --fase 0 >/dev/null 2>&1 || true
    fi
    if ! hecho registrado; then
      diario --stage acceptance --kind decision --text "$NOMBRE aceptó la entrega $N${TEXTO:+ con observaciones: $TEXTO}" \
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
$(parcial && echo "Scope: partial delivery, FASEs $(tr '\n' ' ' < .sdd/hermes/entrega-parcial)")

$(gate_entrega --md 2>/dev/null)"
      marcar tag
    fi
    if ! hecho fusion; then fusionar "delivery $N accepted"; marcar fusion; fi
    TAG="entrega-$N"; RESUMEN="Entrega $N aceptada por $NOMBRE ($ROL) — tag $TAG$FUSION"
    if parcial; then   # lo que queda del plan sigue ahí: se retoma con /reanudar o rehaciendo la FASE siguiente
      RESUMEN="Entrega parcial $N (FASEs $(tr '\n' ' ' < .sdd/hermes/entrega-parcial | sed 's/ $//')) aceptada por $NOMBRE ($ROL) — tag $TAG$FUSION"
      rm -f .sdd/hermes/entrega-parcial
    fi
    [ "$UNICA" = true ] && RESUMEN="Entrega $N (y su única fase) aceptada por $NOMBRE ($ROL) — tag entrega-$N$FUSION" ;;

  fase:corrijo|entrega:corrijo)
    # «✏️ Corregir el requisito»: lo pedido y las dudas de la revisión van a un cambio de requisitos (paso 3)
    if ! hecho registrado; then
      diario --stage acceptance --kind decision --text "$NOMBRE pide corregir el requisito: $TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      mkdir -p .sdd/hermes
      { echo "En la puerta «$(p .titulo)», $NOMBRE ($ROL) pide corregir el requisito: $TEXTO"; echo
        node "$SDD" accept challenge list --open ${FASE:+--fase "$FASE"} --json 2>/dev/null | jq -r '[.challenges[]? | select(.state == "open" and .category == "SPEC-QUESTION")
          | "- \(.id) \(.req) AC\(.ac): «\(.quote)»"] | if length > 0 then "Dudas de la revisión independiente sobre el criterio:", .[] else empty end' 2>/dev/null || true
      } > ".sdd/hermes/cambio-por-respuestas-$GATE.txt"
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): requirement correction requested by $NOMBRE" status/; marcar commit; fi
    RESUMEN="$NOMBRE ($ROL) pide corregir el requisito: $TEXTO" ;;

  fase:descarto|entrega:descarto)
    if ! hecho registrado; then
      ABIERTAS=$(node "$SDD" accept challenge list --open ${FASE:+--fase "$FASE"} --json 2>/dev/null | jq -r '.challenges[]? | select(.state == "open") | .id')
      HECHAS=""
      for ch in $(printf '%s' "$TEXTO" | grep -oE 'CH-[0-9]+' | sort -u); do
        printf '%s\n' "$ABIERTAS" | grep -qx "$ch" || continue
        node "$SDD" accept record challenge-dismissal --challenge "$ch" --reason "$TEXTO" --by "$NOMBRE" --role "$ROL" >/dev/null ||
          fallo "no se pudo registrar el descarte de $ch"
        HECHAS="$HECHAS $ch"
      done
      [ -n "$HECHAS" ] || fallo "ninguna de las impugnaciones nombradas está abierta"
      printf '%s\n' "$HECHAS" > "$ACTA.descartadas"
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): challenges dismissed by $NOMBRE" acceptance/; marcar commit; fi
    RESUMEN="Impugnaciones descartadas por $NOMBRE ($ROL):$(cat "$ACTA.descartadas" 2>/dev/null) — la puerta vuelve sin ellas" ;;

  entrega:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/cierre.txt"
    # Una sola FASE (la entrega es su puerta): rechazarla rehace la FASE-0 con lo pedido y las impugnaciones abiertas,
    # como el rechazo de una FASE; antes solo se repetía el cierre, que no reprograma nada (taller, 14/11/2026)
    if [ "$(p .unica)" = true ]; then feedback_implementar 0; fi
    if ! hecho registrado; then
      diario --stage acceptance --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(acceptance): delivery rejected by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Entrega rechazada por $NOMBRE ($ROL): $TEXTO" ;;

  preguntas:respondo)
    # de qué son: de una FASE, las dudas de diseño antes del plan (material-montana2: salían «del mantenimiento») o
    # las del mantenimiento
    if [ -n "$FASE" ]; then DE="de la FASE-$FASE"; EN="FASE-$FASE"
    elif [ -f .sdd/hermes/dudas-diseno ]; then DE="antes del plan"; EN="design"
    else DE="del mantenimiento"; EN=maintenance; fi
    if ! hecho registrado; then
      diario --stage task-implementer --kind decision --text "$NOMBRE respondió las preguntas $DE${TEXTO:+ ($TEXTO)}" \
        --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): $EN questions answered by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Preguntas $DE respondidas por $NOMBRE ($ROL)" ;;

  mantenimiento:cambio)
    # La petición del cambio sale de los hallazgos que la persona vio (están en la puerta), más su comentario
    if ! hecho registrado; then
      mkdir -p .sdd/hermes/mantenimiento
      { echo "Mantenimiento detectado el $(jq -r '.creada[0:10]' "$PUERTA") por la revisión periódica:"
        jq -r '.hallazgos[] | "- \(.titulo): \(.propuesta)"' "$PUERTA"
        [ -n "$TEXTO" ] && echo "Comentario de $NOMBRE: $TEXTO"; } > ".sdd/hermes/mantenimiento/peticion-$GATE.txt"
      diario --stage maintenance --kind decision \
        --text "$NOMBRE pidió un cambio de mantenimiento: $(jq -r '[.hallazgos[].titulo] | join("; ")' "$PUERTA")" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): maintenance change requested by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Mantenimiento: $NOMBRE ($ROL) lanza un cambio" ;;

  mantenimiento:ignoro)
    if ! hecho registrado; then
      mkdir -p .sdd/hermes/mantenimiento; SIL=.sdd/hermes/mantenimiento/silenciados.json; [ -f "$SIL" ] || echo '{}' > "$SIL"
      t=$(mktemp); jq --slurpfile p "$PUERTA" --arg m "$TEXTO" --arg q "$NOMBRE" --arg h "$HOY" \
        '. + ([$p[0].hallazgos[] | {(.clave): {titulo, motivo:$m, por:$q, el:$h}}] | add // {})' "$SIL" > "$t" && mv "$t" "$SIL"
      diario --stage maintenance --kind feedback \
        --text "$NOMBRE ignoró: $(jq -r '[.hallazgos[].titulo] | join("; ")' "$PUERTA"). Motivo: $TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): maintenance findings dismissed by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Mantenimiento ignorado por $NOMBRE ($ROL): $TEXTO" ;;

  fallo:reintento|fallo:paro)
    if ! hecho registrado; then
      diario --stage orchestrator --kind decision \
        --text "$NOMBRE: $([ "$VERBO" = reintento ] && echo reintentar || echo dejar parada) la etapa que falló ($(jq -r '.fallo.motivo // ""' "$PUERTA" | cut -c1-300))" \
        --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): failed stage $([ "$VERBO" = reintento ] && echo retried || echo parked) by $NOMBRE" status/; marcar commit; fi
    RESUMEN="Etapa $(jq -r '.fallo.etapa + (if (.fallo.fase // "") != "" then " FASE-" + .fallo.fase else "" end)' "$PUERTA"): $([ "$VERBO" = reintento ] && echo "se reintenta" || echo "queda parada") ($NOMBRE, $ROL)" ;;

  requisitos:cambios|plan:cambios|ruta:rechazo)
    mkdir -p .sdd/hermes/feedback; printf '%s\n' "$TEXTO" > ".sdd/hermes/feedback/$TIPO.txt"
    if ! hecho registrado; then
      case "$TIPO" in requisitos) ST=requirements-engineer;; plan) ST=plan-architect;; *) ST=route;; esac
      diario --stage "$ST" --kind feedback --text "$TEXTO" --by "$NOMBRE ($ROL)" >/dev/null
      marcar registrado
    fi
    if ! hecho commit; then commit_si_hay "docs(status): $TIPO changes requested by $NOMBRE" status/; marcar commit; fi
    RESUMEN="$NOMBRE ($ROL) pide cambios en $TIPO: $TEXTO" ;;
esac
# El resultado que recibe lanzar.sh siguiente sale de la tabla (antes, una cadena en cada rama de este case que tenía
# que casar a mano con el case de lanzar.sh: «aprobado» aquí, «requisitos:aprobado» allí)
RESULTADO=$(trans_campo "$TIPO" "$VERBO" resultado)
[ -n "$RESULTADO" ] || fallo "la tabla de transiciones no dice el resultado de $TIPO:$VERBO"

if [ "$EXIMO" = true ]; then
  PEN=$(grep -F "| $GATE |" acceptance/PENDIENTES.md 2>/dev/null | awk -F'|' '{gsub(/ /, "", $2); print $2}' | paste -sd, - | sed 's/,/, /g')
  RESUMEN="$RESUMEN · con exenciones ($PEN, en acceptance/PENDIENTES.md)"
fi

# ── 3. cerrar la puerta en el tablero y encadenar lo siguiente ────────────────────────────────────────────────────
if [ -n "$BOARD" ] && ! hecho completado; then
  # Sin tarjeta todavía (decidida desde el ordenador antes de que el gateway la creara): no hay nada que cerrar
  if [ -n "$TASK" ] && ! ko=$(hermes kanban --board "$BOARD" complete "$TASK" --result "$RESUMEN" 2>&1 >/dev/null); then
    # la tarjeta ya no se puede cerrar (archivada a mano, superada…): lo firmado vale igual; queda anotado en el acta
    t=$(mktemp); jq --arg m "no se pudo cerrar la tarjeta $TASK: ${ko:0:200}" '.aviso_tablero = $m' "$ACTA" > "$t" && mv "$t" "$ACTA"
    echo "NOTARIO: aviso — no se pudo cerrar la tarjeta $TASK de $BOARD (¿archivada?); la firma sigue" >&2
  fi
  marcar completado
fi
if ! hecho encadenado; then
  PC=".sdd/hermes/cambio-por-respuestas-$GATE.txt"
  if [ -s "$PC" ] && [ -n "$BOARD" ] && [ -x "$ROOT/lanzar.sh" ]; then
    # Primero el cambio de requisitos que pidieron las respuestas: cuando se apruebe, lanzar.sh sigue desde ahí (rehace
    # la FASE en curso o vuelve a planificar con los requisitos nuevos), así que el tramo siguiente no se lanza ahora
    if [ "$VERBO" = corrijo ]; then cp "$PC" "$PC.peticion"   # ya dice quién pide qué
    else { echo "En la puerta «$(p .titulo)», $NOMBRE ($ROL) eligió respuestas que piden cambiar los requisitos:"; echo; cat "$PC"; } > "$PC.peticion"; fi
    ORIGEN="puerta $GATE" "$ROOT/lanzar.sh" cambio "$REPO" "$(cat "$PC.peticion")" >/dev/null
    rm -f "$PC.peticion"
    if [ "$VERBO" = corrijo ]; then RESUMEN="$RESUMEN · lanza un cambio de requisitos"
    else RESUMEN="$RESUMEN · lanza un cambio de requisitos por las respuestas ($(grep -c '^Respuesta elegida:' "$PC" || true))"; fi
  elif [ -s ".sdd/hermes/respuestas-por-aplicar-$GATE.txt" ] && [ -n "$BOARD" ] && [ -x "$ROOT/lanzar.sh" ]; then
    ORIGEN="puerta $GATE" "$ROOT/lanzar.sh" respuestas "$REPO" "$GATE" "$RESULTADO" >/dev/null
    RESUMEN="$RESUMEN · aplica las respuestas elegidas ($(grep -c '^Respuesta elegida:' ".sdd/hermes/respuestas-por-aplicar-$GATE.txt"))"
  else
    [ -n "$BOARD" ] && [ -x "$ROOT/lanzar.sh" ] && ORIGEN="puerta $GATE" "$ROOT/lanzar.sh" siguiente "$REPO" "$GATE" "$RESULTADO" >/dev/null
  fi
  marcar encadenado
fi
# Lo firmado, estructurado: el contrato con los canales y decidir.sh (en el acta y en el índice, «firma»). Antes solo
# existía «la última línea de stdout» y el plugin adivinaba con expresiones regulares si era un rechazo («rechaz|pide
# cambios|ignor», que dependía del texto de la persona) y cuál era el tag (« — tag »). «negativo» sale de la tabla.
NEGATIVO=$(trans_destino "$TIPO" "$RESULTADO" | jq '.negativo // false' 2>/dev/null || true)
FIRMA=$(jq -nc --arg tipo "$TIPO" --arg v "$VERBO_DECIDIDO" --arg como "$VERBO" --arg r "$RESULTADO" --argjson neg "${NEGATIVO:-false}" \
  --arg tag "$TAG" --arg res "$RESUMEN" --arg fase "$FASE" \
  '{tipo:$tipo, fase:$fase, verbo:$v, firmado_como:$como, resultado:$r, negativo:$neg, tag:$tag, resumen:$res}')
t=$(mktemp); jq --arg r "$RESUMEN" --argjson f "$FIRMA" '.resultado = $r | .firma = $f | del(.error)' "$ACTA" > "$t" && mv "$t" "$ACTA"
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
if [ -f "$IDX" ]; then   # por la tabla de transiciones del núcleo, con su cerrojo (decidida|error|firmada → firmada)
  HERMES_SDD_HOME="$HOME_SDD" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" transicion "$GATE" firmada \
    resultado="$RESUMEN" verbo="$VERBO" firma:="$FIRMA" -error >&2 || echo "NOTARIO: aviso — firmada, pero el índice no se pudo poner al día" >&2
fi
firmar_acta   # al final: el acta ya no cambia (pasos, historial, resultado)
echo "$RESUMEN"
