#!/usr/bin/env bash
# Preguntas con fuente de verdad en JSON (.sdd/questions-<rol>.json, metodo/templates/questions.schema.json) y el .md
# como vista. Antes, que una respuesta lanzara un cambio de requisitos o autorizara editar un test salía de leer el
# Markdown con expresiones regulares (tres sintaxis de opción, la recomendada por ★ o «(recomendada…)», el efecto
# adivinado por verbos) y la respuesta se escribía reescribiendo ese Markdown. Aquí: efectos, recomendada y validación
# salen del JSON; las preguntas antiguas (solo .md) siguen como siempre; un proyecto mixto numera igual en la puerta y en
# el notario; la respuesta se escribe en el JSON de forma atómica y regenera la vista.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
TX="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
py() { python3 - "$ROOT/plugin/hermes-sdd" "$R" "$@"; }

R="$T/club"; mkdir -p "$R/.sdd"; cd "$R" || exit 1

# ── 1. sdd questions add: el único que escribe preguntas nuevas, validadas con el esquema ─────────────────────────────
# Una pregunta antigua del implementador, solo en el .md (sin efecto: se adivina, como siempre)
cat > .sdd/questions-task-implementer.md <<'Q'
# Questions — task-implementer

## Q-task-implementer-001 [OPEN] skill=sdd-task-implementer context=TASK-F1-002
Question: ¿La lista de espera va antes del aforo?
Options:
  A) Mantener el orden actual (recommended)
  B) Enmendar el criterio de REQ-F-004 para que la lista vaya antes
Blocks: TASK-F1-002
Answer:
Q
# La nueva, en JSON: la recomendada es B (no la primera) y su texto «Cambiar el criterio…» haría adivinar req-change,
# pero el efecto declarado manda
node "$SDD" questions add --role task-implementer >/dev/null <<'J' && ok "add: escribe la pregunta en el JSON" || bad "add"
{"skill": "sdd-task-implementer", "contexto": "TASK-F1-004", "tema": "registro-zonas",
 "pregunta": "REQ-F-024 AC2 only logs E_ZONA_SOLO_JUNTA; logging E_NO_AUTORIZADO breaks AC-001-08 (FASE-1, accepted).",
 "para_cliente": "¿El registro de seguridad apunta también los intentos en zonas que no son de la junta?",
 "opciones": [
   {"letra": "A", "texto": "Keep logging only the board's zones", "efecto": "ninguno", "cliente": "No, solo las zonas de la junta"},
   {"letra": "B", "texto": "Cambiar el criterio y adaptar el test aceptado", "recomendada": true, "efecto": "editar-test",
    "ficheros": ["tests/integration/accesos.test.js"], "cliente": "Sí, todos los intentos; se adapta la prueba"},
   {"letra": "C", "texto": "Amend REQ-F-024 AC2", "efecto": "req-change"}],
 "bloquea": "TASK-F1-004"}
J
[ "$(jq -r '.preguntas[0].id + " " + .preguntas[0].estado' .sdd/questions-task-implementer.json)" = "Q-task-implementer-002 OPEN" ] \
  && ok "add: numera tras las del .md (Q-…-002) y la deja OPEN" || bad "add id: $(cat .sdd/questions-task-implementer.json)"
grep -q '^## Q-task-implementer-001 \[OPEN\]' .sdd/questions-task-implementer.md && grep -q '^## Q-task-implementer-002 \[OPEN\] skill=sdd-task-implementer context=TASK-F1-004' .sdd/questions-task-implementer.md \
  && grep -q '^  B) Cambiar el criterio y adaptar el test aceptado (recommended)$' .sdd/questions-task-implementer.md \
  && grep -q '^     efecto: editar-test tests/integration/accesos.test.js$' .sdd/questions-task-implementer.md \
  && ok "add: regenera la vista .md (la antigua se conserva tal cual, la nueva con el formato de async-questions.md)" || bad "vista: $(cat .sdd/questions-task-implementer.md)"
cp .sdd/questions-task-implementer.json "$T/antes.json"
out=$(printf '{"skill":"s","tema":"t1","pregunta":"q","para_cliente":"c","opciones":[{"letra":"A","texto":"a","efecto":"editar-test"},{"letra":"B","texto":"b","efecto":"cambiar"}]}' | node "$SDD" questions add --role task-implementer 2>&1); rc=$?
[ $rc = 1 ] && case "$out" in *"ficheros: needs at least 1"*"efecto: must be one of"*"recomendada; must be exactly 1"*) true ;; *) false ;; esac \
  && cmp -s .sdd/questions-task-implementer.json "$T/antes.json" \
  && ok "add: el esquema rechaza editar-test sin ficheros, un efecto desconocido y no marcar recomendada (y no escribe nada)" || bad "add inválida: $rc $out"
out=$(printf '{"skill":"s","pregunta":"q","para_cliente":"c","estado":"ANSWERED","respuesta":{"letra":"A","como":"elegida por","quien":"Ana","fecha":"x"},"opciones":[]}' | node "$SDD" questions add --role task-implementer 2>&1); rc=$?
[ $rc = 1 ] && case "$out" in *"only the notary or the lead answers"*) true ;; *) false ;; esac && ok "add: una etapa no puede traer la respuesta hecha" || bad "add con respuesta: $rc $out"
node "$SDD" questions validate >/dev/null && ok "validate: el JSON escrito cumple el esquema" || bad "validate"
# taller3: opciones en inglés y una segunda pregunta abierta sobre el mismo criterio se rechazan (en un repo aparte,
# para no cambiar las preguntas que cuentan los casos siguientes)
AQUI=$PWD; mkdir -p "$T/q3/.sdd"; cd "$T/q3"; git init -q
out=$(printf '{"skill":"s","tema":"t2","pregunta":"q","para_cliente":"¿Vale así?","opciones":[{"letra":"A","texto":"Keep the texts and skip the scan","efecto":"ninguno","recomendada":true},{"letra":"B","texto":"Cambiar los textos","efecto":"accion"}]}' | node "$SDD" questions add --role acceptance 2>&1); rc=$?
[ $rc = 1 ] && case "$out" in *"write them in Spanish"*) true ;; *) false ;; esac && ok "add: opciones en inglés, rechazadas (las lee el cliente)" || bad "inglés: $rc $out"
out=$(printf '{"skill":"s","tema":"t2b","pregunta":"Some outcomes have no acceptance criterion with literal text: cancelling a reservation that is not open, an id that does not exist.","para_cliente":"¿Valen estos mensajes?","opciones":[{"letra":"A","texto":"Sí, valen","efecto":"ninguno","recomendada":true},{"letra":"B","texto":"Los escribo yo","efecto":"accion"}]}' | node "$SDD" questions add --role acceptance 2>&1); rc=$?
[ $rc = 1 ] && case "$out" in *"technical detail: write it in Spanish"*) true ;; *) false ;; esac && ok "add: «pregunta» en inglés, rechazada (sale como «Detalle técnico»; material-montana4)" || bad "pregunta en inglés: $rc $out"
printf '{"skill":"s","tema":"t3","contexto":"REQ-NF-001 AC1","pregunta":"¿Vale «confirmada»?","para_cliente":"¿Vale así?","opciones":[{"letra":"A","texto":"Sí","efecto":"ninguno","recomendada":true},{"letra":"B","texto":"No","efecto":"accion"}]}' | node "$SDD" questions add --role task-implementer >/dev/null
out=$(printf '{"skill":"s","tema":"t4","contexto":"CH-001 REQ-NF-001 AC1","pregunta":"¿Se permite «registrada»?","para_cliente":"¿Vale así?","opciones":[{"letra":"A","texto":"Sí","efecto":"ninguno","recomendada":true},{"letra":"B","texto":"No","efecto":"accion"}]}' | node "$SDD" questions add --role acceptance 2>&1); rc=$?
[ $rc = 1 ] && case "$out" in *"already OPEN about REQ-NF-001 AC1"*) true ;; *) false ;; esac && ok "add: una segunda pregunta abierta sobre el mismo criterio, rechazada" || bad "duplicada: $rc $out"
cd "$AQUI"

# Otro rol, solo .md antiguo (el formato de siempre, con efectos declarados)
cat > .sdd/questions-plan-architect.md <<'Q'
# Questions — plan-architect

## Q-plan-architect-001 [OPEN] skill=sdd-plan-architect context=plan
Question: ¿Una FASE o dos?
Para el cliente: ¿Lo entregamos de una vez o en dos partes?
Options:
  A) Dos FASEs (recommended)
     efecto: accion
  B) Una sola
     efecto: ninguno
Answer:
Q

# ── 2. lectura: el JSON manda, el .md antiguo como siempre, mixto numerado igual ─────────────────────────────────────
py <<'PY' && ok "hsdd_textos: efectos, recomendada y validación del JSON; heurística solo para la antigua; numeración mixta" || bad "lectura"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
R = Path(sys.argv[2]); fs = T.ficheros_preguntas(R)
bl = T.bloques_preguntas(fs)
j, viejo = bl["Q-task-implementer-002"], bl["Q-task-implementer-001"]
assert isinstance(j, dict) and isinstance(viejo, str), (type(j), type(viejo))
oj = T.opciones_json(j)
assert oj["recomendada"] == "B" and oj["opciones"] == ["A", "B", "C"], oj
assert oj["efectos"]["B"] == {"efecto": "editar-test", "ficheros": ["tests/integration/accesos.test.js"], "declarado": True}, oj
assert oj["efectos"]["C"]["efecto"] == "req-change" and oj["efectos"]["A"]["efecto"] == "ninguno", oj
assert T.efecto(j, "B")["cliente"] == "Sí, todos los intentos; se adapta la prueba"
# el texto de B («Cambiar el criterio…») haría adivinar req-change en una pregunta antigua: en el JSON, no
assert T.pide_cambio("Cambiar el criterio y adaptar el test aceptado") and T.peticion_cambio(j, "B") == ""
assert T.errores_pregunta(j) == [], T.errores_pregunta(j)
# la antigua: sin efecto declarado, se adivina como siempre
assert T.efecto(viejo, "B")["efecto"] == "req-change" and T.efecto(viejo, "A")["efecto"] == "ninguno" and not T.efecto(viejo, "A")["declarado"]
# orden de los botones Q: por fichero (plan-architect antes que task-implementer) y dentro, el de la vista
qs = T.preguntas_json(fs)
assert [(q["n"], q["id"]) for q in qs] == [(1, "Q-plan-architect-001"), (2, "Q-task-implementer-001"), (3, "Q-task-implementer-002")], qs
txt = T.preguntas(fs)
assert "3. ¿El registro de seguridad apunta" in txt and "B) Sí, todos los intentos; se adapta la prueba  ⭐ recomendada  (✏️ autoriza editar tests/integration/accesos.test.js)" in txt, txt
assert "1. ¿Lo entregamos de una vez o en dos partes?" in txt, txt
# un JSON escrito a mano con faltas: la puerta lo dice (las reglas de su esquema que importan al decidir)
m = dict(j, para_cliente="", opciones=[dict(o, recomendada=False) for o in j["opciones"]] + [{"letra": "D", "texto": "x", "efecto": "endurecer-test"}])
e = T.errores_pregunta(m)
assert "le falta «Para el cliente:»" in e and "no marca ninguna opción como recomendada" in e and "la opción D autoriza editar tests sin decir cuáles" in e, e
m2 = dict(j, opciones=[dict(o, efecto="cambiar-cosas") if o["letra"] == "C" else o for o in j["opciones"]])
assert T.efecto(m2, "C")["efecto"] == "?" and T.accion_respuesta(m2, "C") and T.peticion_cambio(m2, "C") == ""
PY
out=$(python3 "$TX" preguntas-json .sdd/questions-*.md .sdd/questions-*.json)
[ "$(jq -c '[.[] | [.n, .id, .recomendada]]' <<< "$out")" = '[[1,"Q-plan-architect-001","A"],[2,"Q-task-implementer-001","A"],[3,"Q-task-implementer-002","B"]]' ] \
  && [ "$(jq -c '.[2].efectos.B' <<< "$out")" = '{"efecto":"editar-test","ficheros":["tests/integration/accesos.test.js"],"declarado":true}' ] \
  && ok "preguntas-json (lo que congela puerta.sh): mismas preguntas, números y efectos" || bad "preguntas-json: $out"
node "$SDD" questions list --open --json > "$T/l.json"
[ "$(jq -r '[.questions[] | .id + "=" + ((.options[] | select(.recommended) | .letter) // "?")] | join(",")' "$T/l.json")" = "Q-plan-architect-001=?,Q-task-implementer-001=?,Q-task-implementer-002=B" ] \
  && [ "$(jq -r '.questions[2].options[1].effect' "$T/l.json")" = "editar-test tests/integration/accesos.test.js" ] \
  && ok "sdd questions list: lee el JSON (y el .md de las antiguas)" || bad "list: $(cat "$T/l.json")"

# ── 3. el notario: validar y aplicar (lo que llama firmar.sh) ─────────────────────────────────────────────────────────
echo "$out" | jq '{tipo: "preguntas", preguntas: .}' > "$T/puerta.json"
resp() { python3 "$TX" respuestas "$@" --puerta "$T/puerta.json" .sdd/questions-*.md .sdd/questions-*.json; }
err=$(resp validar --texto "Q3: D" --verbo respondo --persona 1 2>&1) && bad "Q3: D debía rechazarse" || \
  { case "$err" in *"Q3: «D» no es una de sus opciones (A, B o C)"*) ok "validar: una letra que no está en el JSON rechaza la decisión" ;; *) bad "validar: $err" ;; esac; }
err=$(resp validar --texto "" --respuestas '{"3":"B"}' --verbo respondo --persona 0 2>&1) && bad "Jev no puede editar-test" || \
  { case "$err" in *"Q3 (Q-task-implementer-002): editar un test que ya existía lo autoriza una persona"*) ok "validar: el editar-test del JSON solo lo elige una persona" ;; *) bad "validar Jev: $err" ;; esac; }
ino_antes=$(ls -i .sdd/questions-task-implementer.json | awk '{print $1}')
resp aplicar --respuestas '{"1":"B","2":"B","3":"B"}' --verbo respondo --quien "Ana (Cliente)" --hoy 2026-11-15 --salida "$T/r.json" >/dev/null 2>"$T/err" \
  && ok "aplicar: escribe las tres respuestas (dos antiguas en su .md, una en el JSON)" || bad "aplicar: $(cat "$T/err")"
[ "$(jq -c '.preguntas[0] | [.estado, .respuesta]' .sdd/questions-task-implementer.json)" = '["ANSWERED",{"letra":"B","como":"elegida por","quien":"Ana (Cliente)","fecha":"2026-11-15"}]' ] \
  && ok "aplicar: la respuesta queda en el JSON {letra, como, quien, fecha}" || bad "JSON: $(cat .sdd/questions-task-implementer.json)"
grep -q '^## Q-task-implementer-002 \[ANSWERED\]' .sdd/questions-task-implementer.md && grep -q '^Answer: B — elegida por Ana (Cliente) (2026-11-15)$' .sdd/questions-task-implementer.md \
  && grep -q '^## Q-task-implementer-001 \[ANSWERED\]' .sdd/questions-task-implementer.md \
  && [ "$(grep -c '^Answer: B — elegida por Ana (Cliente) (2026-11-15)$' .sdd/questions-task-implementer.md)" = 2 ] \
  && ok "aplicar: la vista .md se regenera (la antigua contestada en su bloque, la del JSON desde el JSON)" || bad "vista tras aplicar: $(cat .sdd/questions-task-implementer.md)"
grep -q '^Answer: B — elegida por Ana (Cliente) (2026-11-15)$' .sdd/questions-plan-architect.md && ok "aplicar: el rol solo .md, como siempre" || bad "plan-architect: $(cat .sdd/questions-plan-architect.md)"
[ "$(jq -c '[.autorizaciones[] | [.pregunta, .letra, .ficheros, .endurecer]]' "$T/r.json")" = '[["Q-task-implementer-002","B",["tests/integration/accesos.test.js"],false]]' ] \
  && [ "$(jq '.peticiones | length' "$T/r.json")" = 1 ] && jq -r '.peticiones[0]' "$T/r.json" | grep -q '^Q-task-implementer-001:' \
  && ok "aplicar: la autorización sale del efecto del JSON; el cambio de requisitos, solo de la antigua (adivinado)" || bad "salida: $(cat "$T/r.json")"
ino_despues=$(ls -i .sdd/questions-task-implementer.json | awk '{print $1}')
[ "$ino_antes" != "$ino_despues" ] && [ -z "$(ls -A .sdd | grep -E '\.tmp')" ] \
  && ok "escritura atómica: el JSON se sustituye con rename (otro inodo) y no quedan temporales" || bad "atómica: $ino_antes $ino_despues $(ls -A .sdd)"
cp .sdd/questions-task-implementer.json "$T/j1"; cp .sdd/questions-task-implementer.md "$T/m1"
resp aplicar --respuestas '{"3":"B"}' --verbo respondo --quien "Ana (Cliente)" --hoy 2026-11-16 >/dev/null 2>&1
cmp -s "$T/j1" .sdd/questions-task-implementer.json && cmp -s "$T/m1" .sdd/questions-task-implementer.md \
  && ok "aplicar otra vez (un notario que se reanuda) no reescribe nada" || bad "reanudar cambió algo"
out=$(node "$SDD" questions answer Q-task-implementer-002 --letter A --by Luis 2>&1); rc=$?
[ $rc = 1 ] && cmp -s "$T/j1" .sdd/questions-task-implementer.json && case "$out" in *"already answered"*) true ;; *) false ;; esac \
  && ok "answer: otra respuesta a una ya contestada falla y no toca el fichero" || bad "re-answer: $rc $out"

# Si la CLI no puede escribir (aquí: el JSON roto), el notario falla en vez de seguir sin respuesta
R2="$T/roto"; mkdir -p "$R2/.sdd"; cd "$R2" || exit 1
printf '{"rol":"x","preguntas":[' > .sdd/questions-x.json; printf '# Questions — x\n' > .sdd/questions-x.md
python3 "$TX" preguntas-json .sdd/questions-*.md .sdd/questions-*.json >/dev/null 2>&1 && bad "un JSON roto debía fallar" \
  || ok "un questions-*.json ilegible hace fallar la lectura (puerta.sh: preguntas_error), no vuelve a adivinar del .md"
cd "$R" || exit 1

# ── 4. huecos: el arnés cierra las del implementador sobre [PLAN GAP], también en el JSON ─────────────────────────────
node "$SDD" questions add --role task-implementer >/dev/null <<'J'
{"skill": "sdd-task-implementer", "contexto": "TASK-F2-007", "tema": "proveedor-correo", "pregunta": "TASK-F2-007 is a [PLAN GAP]: which provider?",
 "para_cliente": "¿Con qué proveedor se envían los correos?",
 "opciones": [{"letra": "A", "texto": "SMTP", "recomendada": true, "efecto": "accion"}, {"letra": "B", "texto": "Ninguno", "efecto": "ninguno"}]}
J
[ "$(python3 "$TX" cerrar-huecos 2026-11-17 "TASK-F2-007 TASK-F2-009" .sdd/questions-*.md .sdd/questions-*.json)" = 1 ] \
  && [ "$(jq -c '.preguntas[1] | [.estado, .respuesta.como, .respuesta.quien, (.respuesta.texto | test("TASK-F2-007"))]' .sdd/questions-task-implementer.json)" = '["ANSWERED","resuelta por","el arnés",true]' ] \
  && grep -q '^Answer: resuelta por el arnés (2026-11-17): las tareas \[PLAN GAP\] TASK-F2-007' .sdd/questions-task-implementer.md \
  && ok "cerrar-huecos: la del JSON se cierra en el JSON (con el mismo «Answer:» en la vista)" || bad "huecos: $(cat .sdd/questions-task-implementer.md)"

# ── 5. render: un JSON escrito a mano tiene su vista en la puerta siguiente ───────────────────────────────────────────
jq '.preguntas[0].pregunta = "Texto corregido a mano"' .sdd/questions-task-implementer.json > "$T/x" && mv "$T/x" .sdd/questions-task-implementer.json
node "$SDD" questions render >/dev/null && grep -q '^Question: Texto corregido a mano$' .sdd/questions-task-implementer.md \
  && ok "render: regenera la vista desde el JSON" || bad "render"
jq '.preguntas[0].opciones[0].efecto = "quizas"' .sdd/questions-task-implementer.json > "$T/x" && mv "$T/x" .sdd/questions-task-implementer.json
cp .sdd/questions-task-implementer.md "$T/m2"
node "$SDD" questions render >/dev/null 2>&1 && bad "render de un JSON inválido debía fallar" || \
  { v=$(node "$SDD" questions validate 2>&1); cmp -s "$T/m2" .sdd/questions-task-implementer.md && case "$v" in *"efecto: must be one of"*) true ;; *) false ;; esac \
    && ok "render/validate: un JSON fuera del esquema no se pinta y se dice por qué" || bad "render inválido"; }

# ── material-montana (C4): una sola pregunta por tema, de cualquier rol; las duplicadas se fusionan ──────────────────
R2="$T/tema"; mkdir -p "$R2/.sdd"; cd "$R2" || exit 1
q() { printf '{"skill":"sdd-%s","tema":"%s","pregunta":"Which clock?","para_cliente":"¿Qué hora manda?","opciones":[{"letra":"A","texto":"Madrid","recomendada":true,"efecto":"ninguno"},{"letra":"B","texto":"UTC","efecto":"ninguno"}]}' "$1" "$2"; }
q spec-auditor zona-horaria | node "$SDD" questions add --role spec-auditor >/dev/null 2>&1
out=$(q plan-architect zona-horaria | node "$SDD" questions add --role plan-architect 2>&1); rc=$?
[ $rc = 1 ] && echo "$out" | grep -q 'Q-spec-auditor-001 is already OPEN about «zona-horaria»' && [ ! -f .sdd/questions-plan-architect.json ] \
  && ok "tema: otra pregunta abierta sobre lo mismo (otro rol) se rechaza" || bad "tema abierto: $rc $out"
out=$(q x 'Zona Horaria' | node "$SDD" questions add --role x 2>&1) && bad "tema que no es slug" || ok "tema: tiene que ser un slug"
q plan-architect huso | node "$SDD" questions add --role plan-architect >/dev/null 2>&1
node "$SDD" questions merge Q-plan-architect-001 --into Q-spec-auditor-001 >/dev/null 2>&1
o=$(node "$SDD" questions list --open --json | jq -c '[.questions[].id]')
c=$(jq -r '.preguntas[0].contexto' .sdd/questions-spec-auditor.json); m=$(jq -r '.preguntas[0] | "\(.estado) \(.fusionada)"' .sdd/questions-plan-architect.json)
[ "$o" = '["Q-spec-auditor-001"]' ] && [ "$c" = Q-plan-architect-001 ] && [ "$m" = "MERGED Q-spec-auditor-001" ] && node "$SDD" questions validate >/dev/null 2>&1 \
  && ok "merge: la fusionada deja de estar abierta y la otra se queda con su contexto" || bad "merge: $o | $c | $m"
node "$SDD" questions answer Q-spec-auditor-001 --letter A --by "Ana" >/dev/null 2>&1
out=$(q implementador zona-horaria | node "$SDD" questions add --role impl 2>&1)
[ $? = 1 ] && echo "$out" | grep -q 'already decided «zona-horaria»' && ok "tema ya contestado: no se vuelve a preguntar" || bad "tema contestado: $out"
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "la puerta no enseña la fusionada" || bad "puerta con fusionada"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as X, json
b = json.load(open(".sdd/questions-plan-architect.json"))["preguntas"][0]
assert not X._abierta(b)
PY
# Reglas de redacción y de recomendación: antes, prosa del prompt; ahora, errores de `questions add` (Lauren Tan: cada
# fallo repetido de un agente es una comprobación, no una instrucción)
mkdir -p "$T/reglas/.sdd"; cd "$T/reglas"; git init -q
qa() {  # qa <json> → rc y salida de questions add
  out=$(printf '%s' "$1" | node "$SDD" questions add --role r 2>&1); rc=$?; }
base='"skill":"s","pregunta":"q","opciones":[{"letra":"A","texto":"a","efecto":"ninguno","recomendada":true,"cliente":"Se queda así"},{"letra":"B","texto":"b","efecto":"accion","cliente":"Se cambia"}]'
qa "{$base,\"para_cliente\":\"¿Vale así?\"}"
[ $rc = 1 ] && echo "$out" | grep -q 'tema is required' && ok "add: sin tema, rechazada" || bad "sin tema: $rc $out"
qa "{$base,\"tema\":\"a1\",\"para_cliente\":\"¿Vale el texto de REQ-F-002 en la FASE-1?\"}"
[ $rc = 1 ] && echo "$out" | grep -q 'no code, ids' && ok "add: ids o «FASE» en lo que lee el cliente, rechazada" || bad "ids: $rc $out"
qa "{$base,\"tema\":\"a2\",\"para_cliente\":\"Hay dos caminos. Uno es corto. Otro es largo. ¿Cuál?\"}"
[ $rc = 1 ] && echo "$out" | grep -q 'one plain sentence' && ok "add: para_cliente de varias frases, rechazada" || bad "frases: $rc $out"
qa '{"skill":"s","tema":"a3","pregunta":"q","para_cliente":"¿Se pueden reservar fechas pasadas?","opciones":[{"letra":"A","texto":"a","efecto":"ninguno","recomendada":true,"cliente":"No: se rechaza con un aviso"},{"letra":"B","texto":"b","efecto":"req-change","cliente":"Sí, no se aceptan"}]}'
[ $rc = 1 ] && echo "$out" | grep -q 'answers backwards' && ok "add: una opción que responde al revés («Sí, no…»), rechazada" || bad "al revés: $rc $out"
qa '{"skill":"s","tema":"a4","pregunta":"q","para_cliente":"¿Cuántas reservas a la vez?","opciones":[{"letra":"A","texto":"a","efecto":"req-change","recomendada":true,"cliente":"Tres"},{"letra":"B","texto":"b","efecto":"ninguno","cliente":"Sin límite"}]}'
[ $rc = 1 ] && echo "$out" | grep -q 'reopens the requirements' && ok "add: recomendar req-change sin riesgo grave, rechazada" || bad "req-change: $rc $out"
qa '{"skill":"s","tema":"a5","riesgo":"sin ella se pierden datos de socios","pregunta":"q","para_cliente":"¿Guardamos copia de los socios?","opciones":[{"letra":"A","texto":"a","efecto":"req-change","recomendada":true,"cliente":"Sí, cada noche"},{"letra":"B","texto":"b","efecto":"ninguno","cliente":"No"}]}'
[ $rc = 0 ] && jq -e '.preguntas[0].riesgo' .sdd/questions-r.json >/dev/null && ok "add: req-change recomendado con su riesgo grave, aceptada (y el riesgo queda escrito)" || bad "con riesgo: $rc $out"
cd "$AQUI"
exit $fail
