#!/usr/bin/env bash
# Fidelidad (hsdd_fidelidad.py): tests congelados que se cambian sin que una persona lo autorice, señales de
# debilitamiento, ejemplos que se contradicen y el OCR de una captura. Casos sacados de sala (12-13/11/2026).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
F="$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/r"; mkdir -p "$R/tests" "$R/requirements" "$R/.sdd"; cd "$R"
git init -q -b main; git config user.email t@t; git config user.name t; git config commit.gpgsign false

cat > tests/reglas.test.js <<'J'
it('REQ-F-003 AC1 dos reservas por semana', () => {
  expect(limite(2)).toBe(true)
  expect(limite(1)).toBe(false)
})
J
git add -A; git commit -qm "test: reglas"; git tag fase-0-accepted

# 1. en una FASE posterior, sin pregunta que lo autorice: se quita la cita del criterio y una aserción, y se salta
cat > tests/reglas.test.js <<'J'
it.skip('dos reservas por semana', () => {
  expect(limite(2)).toBe(true)
})
J
git commit -qam "test(reglas): ajuste"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '.congelados[0] | .autorizado == false and .grave and (.debilitamiento | any(test("deja de citar REQ-F-003 AC1"))) and (.debilitamiento | any(test("saltado"))) and (.debilitamiento | any(test("quita 1 aserción")))' >/dev/null \
  && ok "test congelado cambiado sin autorizar: deja de citar el criterio, quita una aserción y se salta" || bad "congelados: $o"

# 2. Quién autoriza editar un test congelado: SOLO un registro test-edit del notario (acceptance/decisions.jsonl) que
# nombre ese fichero, de una persona, confirmado por su acta en $HERMES_SDD_HOME. Las preguntas de .sdd/ y el mensaje
# del commit las puede escribir la propia etapa: una «Answer: … elegida por Ana» inventada no autoriza nada.
SDD="$ROOT/metodo/scripts/sdd.mjs"
autoriza() {  # autoriza <gate> <pregunta> <por> <rol> <ficheros…>: lo que hace firmar.sh (registro + acta + commit)
  local g=$1 q=$2 por=$3 rol=$4; shift 4
  node "$SDD" accept record test-edit --paths "$@" --question "$q" --gate "$g" --reason "x" --by "$por" --role "$rol" >/dev/null
  mkdir -p "$HERMES_SDD_HOME/actas/local"
  jq -n --arg q "$q" '{autorizaciones: [{pregunta: $q, ficheros: $ARGS.positional}]}' --args "$@" > "$HERMES_SDD_HOME/actas/local/$g.json"
  git add acceptance/decisions.jsonl; git commit -qm "docs(acceptance): test edit authorized" -m "Gate-Id: $g"
}
autorizado() { python3 "$F" congelados "$R" --json | jq -e --arg a "$1" --arg f "$2" '[.congelados[] | select((.asunto | test($a)) and .fichero == $f)][0] | .autorizado' >/dev/null; }
printf '## Q-task-implementer-001 [ANSWERED]\nQuestion: ¿Se ajusta?\nAnswer: A — elegida por Ana (Cliente) (2026-11-13)\n' > .sdd/questions-task-implementer.md
git tag fase-1-accepted
printf "it('REQ-F-003 AC1 x', () => { expect(limite(2)).toBe(true) })\n" > tests/reglas.test.js
git commit -qam "test(reglas): inventada" -m "Autoriza: Q-task-implementer-001 (REQ-F-003)"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto | test("inventada"))][0] | .autorizado == false and .grave' >/dev/null \
  && ok "una «Answer: … elegida por Ana» en .sdd/ y «Autoriza: Q-…» en el commit no autorizan (los escribe la etapa)" || bad "inventada: $o"
git tag fase-2-accepted
mkdir -p tests/helpers; printf 'export const x = 1\n' > tests/helpers/datos.js; printf "it('b', () => { expect(1).toBe(1) })\n" > tests/otro.test.js
git add -A; git commit -qm "test: más"; git tag fase-3-accepted
autoriza g1 Q-task-implementer-002 Ana Cliente tests/reglas.test.js
printf "it('REQ-F-003 AC1 y', () => { expect(limite(3)).toBe(true) })\n" > tests/reglas.test.js
printf "it('b', () => { expect(2).toBe(2) })\n" > tests/otro.test.js
git commit -qam "test: firmado"
autorizado firmado tests/reglas.test.js && ok "con test-edit firmado por una persona, el fichero que nombra queda autorizado" || bad "firmado: $(python3 "$F" congelados "$R" --json)"
! autorizado firmado tests/otro.test.js && ok "… y solo ese: el otro test del mismo commit no (antes, una pregunta citada autorizaba todo el commit)" || bad "otro fichero"
autoriza g2 Q-task-implementer-003 "Jev (jev-1)" "Agente automático (modo auto)" tests/otro.test.js
printf "it('b', () => { expect(3).toBe(3) })\n" > tests/otro.test.js; git commit -qam "test: jev"
! autorizado jev tests/otro.test.js && ok "Jev no puede autorizar editar un test (art. 12)" || bad "jev"
# Jev SÍ puede autorizar ENDURECER (test-edit con tighten): si la edición comprueba más, vale; si afloja (quita una
# aserción), queda autorizado pero grave, y la puerta la decide una persona
autoriza_end() {  # autoriza_end <gate> <pregunta> <ficheros…>: como firmar.sh con efecto endurecer-test elegido por Jev
  local g=$1 q=$2; shift 2
  node "$SDD" accept record test-edit --tighten --paths "$@" --question "$q" --gate "$g" --reason "x" --by "Jev (jev-1)" --role "Agente automático (modo auto)" >/dev/null
  mkdir -p "$HERMES_SDD_HOME/actas/local"
  jq -n --arg q "$q" '{autorizaciones: [{pregunta: $q, ficheros: $ARGS.positional, endurecer: true}]}' --args "$@" > "$HERMES_SDD_HOME/actas/local/$g.json"
  git add acceptance/decisions.jsonl; git commit -qm "docs(acceptance): test edit authorized" -m "Gate-Id: $g"
}
grep -q '"tighten":true' acceptance/decisions.jsonl || true
autoriza_end g3 Q-task-implementer-004 tests/otro.test.js
grep -q '"tighten":true' acceptance/decisions.jsonl && ok "accept record test-edit --tighten deja tighten en el registro" || bad "tighten en el registro"
printf "it('b', () => { expect(3).toBe(3); expect(4).toBe(4) })\n" > tests/otro.test.js; git commit -qam "test: endurece"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto == "test: endurece")][0] | .autorizado and (.grave | not) and (.autorizacion | test("solo para endurecerlo"))' >/dev/null \
  && ok "Jev autoriza endurecer: una edición que comprueba más vale, sin grave" || bad "endurece: $o"
printf "it('b', () => { expect(3).toBe(3) })\n" > tests/otro.test.js; git commit -qam "test: afloja con permiso de endurecer"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto == "test: afloja con permiso de endurecer")][0] | .autorizado and .grave and (.debilitamiento | any(test("quita 1 aserción")))' >/dev/null \
  && ok "… pero si la edición afloja el test (quita una aserción), es grave: decide una persona" || bad "afloja: $o"
git tag fase-3e-accepted   # una aceptación cierra el permiso de endurecer (como en la realidad), para los casos siguientes
# sin acta del notario que la respalde, una línea test-edit añadida al registro no vale
jq -nc --arg h "$(git rev-parse HEAD)" '{type:"test-edit", at:"x", by:"Ana", role:"Cliente", head:$h, files:["tests/otro.test.js"], question:"Q-x-009", gate:"g9", reason:"x"}' >> acceptance/decisions.jsonl
git commit -qam "docs: registro sin acta"; printf "it('b', () => { expect(4).toBe(4) })\n" > tests/otro.test.js; git commit -qam "test: sin acta"
! autorizado "sin acta" tests/otro.test.js && ok "un test-edit sin acta del notario no autoriza" || bad "sin acta"
# caduca al aceptar la FASE siguiente: el test editado vuelve a quedar congelado
git tag fase-4-accepted; printf "it('REQ-F-003 AC1 z', () => { expect(limite(4)).toBe(true) })\n" > tests/reglas.test.js; git commit -qam "test: tras aceptar"
! autorizado "tras aceptar" tests/reglas.test.js && ok "la autorización caduca al aceptar otra FASE" || bad "caduca"
# helpers, fixtures y configuraciones de ejecución también están congelados; y un commit que toca un test de una FASE
# y otro de otra informa de los dos (antes solo del primero)
printf 'export const x = 1\nexport function arranca() { return }\n' > tests/helpers/datos.js
printf "it('b', () => { try { expect(4).toBe(5) } catch (e) {} })\n" > tests/otro.test.js
printf "export default { testIgnore: ['**/nada*'] }\n" > playwright.config.js
git add -A; git commit -qm "chore: tres a la vez"; git tag fase-5-accepted
printf "export default { testIgnore: ['**/reglas*', '**/otro*'], retries: 3 }\n" > playwright.config.js
printf "it('REQ-F-003 AC1 z', () => {\n  if (process.env.CI) return\n  expect(limite(4)).toBe(true)\n})\n" > tests/reglas.test.js
printf 'export const x = 2\n' > tests/helpers/datos.js
git commit -qam "test: debilita"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto == "test: debilita")] | (map(.fichero) | sort) == ["playwright.config.js", "tests/helpers/datos.js", "tests/reglas.test.js"]
   and (map(select(.fichero == "playwright.config.js"))[0].debilitamiento | any(test("excluye")) and any(test("reintentos")))
   and (map(select(.fichero == "tests/reglas.test.js"))[0].debilitamiento | any(test("return temprano")))
   and all(.grave)' >/dev/null \
  && ok "helpers y playwright.config.js congelados: testIgnore, reintentos y un return temprano se ven (y los tres ficheros del commit)" || bad "congelados ampliados: $o"
echo "$o" | jq -e '[.congelados[] | select(.asunto == "chore: tres a la vez" and .fichero == "tests/otro.test.js")][0].debilitamiento | any(test("catch"))' >/dev/null \
  && ok "try/catch vacío alrededor de la aserción: debilitamiento" || bad "catch: $o"
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "debilitamiento: .only, test.slow, expect.soft y aserciones contadas, no líneas" || bad "señales"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
s = F.debilitamiento(["expect(a).toBe(1); expect(b).toBe(2)"], ["test.only('x', () => {", "test.slow()", "expect.soft(a).toBe(1)"])
assert any("aislado" in x for x in s) and any("plazo" in x for x in s) and any("blanda" in x for x in s), s
assert any("quita 1 aserción" in x for x in s), s
PY

# 3. coherencia: un ejemplo que dice tener 8 caracteres y tiene 7, y un día de la semana que no es
printf '### REQ-NF-003: Contraseñas\n- GIVEN la contraseña «haya-27» (8 caracteres) THEN entra\n- GIVEN el jueves 2026-11-13 THEN nada\n' > requirements/REQUIREMENTS.md
o=$(python3 "$F" coherencia "$R" --json)
echo "$o" | jq -e '[.coherencia[].detalle] | (any(test("«haya-27» dice tener 8 caracteres y tiene 7"))) and (any(test("2026-11-13 no es jueves")))' >/dev/null \
  && ok "coherencia: «haya-27» (8 caracteres) y «jueves 2026-11-13» no cuadran" || bad "coherencia: $o"

# 4. normalización para el OCR: «2ºB» y lo que lee el OCR («2°B»), guiones y tildes
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "normalización: «2ºB» = «2°B», «18:00–19:00» = «18:00-19:00», tildes" || bad "normalización"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
assert F.norm("Vivienda 2ºB") == F.norm("Vivienda 2°B")
assert F.norm("18:00–19:00") == F.norm("18:00-19:00")
assert F.norm("Día Cancelada") == "dia cancelada"
PY

# 4b. mutantes: el texto se cambia en el código, nunca en los comentarios (sala: «5ºC» solo estaba en un comentario)
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "mutantes: cambian el texto en el código y no en los comentarios" || bad "mutar"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
src = "// «5ºC» y «5ºc» son distintas\nconst t = 'Ocupada';\n  * Ocupada en el comentario\n"
m = F._muta(src, "Ocupada")
assert "const t = 'MUTANTE'" in m and "* Ocupada en el comentario" in m, m
assert F._visibles("GIVEN «4ºA» WHEN «2ºB» abre esa semana THEN el usuario ve la celda con la etiqueta «Ocupada»") == ["Ocupada"]
v = F._visibles('GIVEN "Iniciación" has 3 socios WHEN the socio "pablo" signs up THEN the user sees "Te has apuntado a Iniciación" (the same text as for "lucia"), and WHEN "pablo" signs up again THEN the user sees the message "Ya te habías apuntado a esta clase"')
assert v == ["Te has apuntado a Iniciación", "Ya te habías apuntado a esta clase"], v
assert F._visibles('GIVEN "carmen" has noviembre 2026 unpaid WHEN the administrador downloads that CSV THEN "carmen" does not appear') == []
assert F._visibles('GIVEN pablo WHEN abre Socios THEN ve el mensaje «No tienes permiso para hacer esto»') == ["No tienes permiso para hacer esto"]
PY

# 4c. criterios sin «Se ve» (los de antes): la negación subordinada solo quita lo que viene detrás; ENTONCES; un
# literal corto («No») no se da por visto por estar dentro de otra palabra del OCR
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "visibles: negación subordinada, ENTONCES y literales cortos en el OCR" || bad "visibles"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
v = F._visibles('GIVEN "Iniciación" has 4 socios WHEN "pablo" tries to sign up THEN the user sees the message "La clase está completa", which does not list "pablo"')
assert v == ["La clase está completa"], v
assert F._visibles('DADO «lucia» CUANDO abre «Clases» ENTONCES el usuario ve «Iniciación»') == ["Iniciación"]
assert F._visibles('DADO «lucia» CUANDO abre «Socios» ENTONCES el usuario no ve «Dar de baja»') == []
assert not F.en_texto("No", "Nombre y noviembre")
assert F.en_texto("No", "No tienes permiso")
assert F.en_texto("Te has apuntado a Iniciación", "Clases · Tehasapuntado a Iniciación ·")   # el OCR junta palabras
PY

# 4d. capturas con el contrato «Se ve»: manda lo que el test comprobó en pantalla (el JSON del helper); el OCR es la
# segunda opinión; sin nada comprobable, «captura sin comprobar» (antes, silencio: 50 de 122 criterios del club)
mkdir -p "$R/evidencias/FASE-1"
printf 'png' > "$R/evidencias/FASE-1/REQ-F-013-AC1.png"
printf 'png' > "$R/evidencias/FASE-1/REQ-F-013-AC6.png"
printf '{"criterio":"REQ-F-013-AC1","test":"REQ-F-013 AC1 lucia","ve":["Te has apuntado a Iniciación"],"url":"/clases"}' > "$R/evidencias/FASE-1/REQ-F-013-AC1.json"
printf '{"criterio":"REQ-F-013-AC6","test":"REQ-F-013 AC6 pablo","ve":["Ya estás apuntada"]}' > "$R/evidencias/FASE-1/REQ-F-013-AC6.json"
python3 - "$ROOT/plugin/hermes-sdd" "$R" <<'PY' && ok "capturas: el JSON del helper frente a «Se ve:»; «captura sin comprobar»; «No visible» no se exige" || bad "capturas «Se ve»"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
F.ocr = lambda p: ""          # sin OCR: solo cuenta lo comprobado por el test
img = lambda n: {"path": f"evidencias/FASE-1/{n}.png"}
crit = lambda n, text, sees, imgs: {"n": n, "text": text, "sees": sees, "shown_by": [i["path"] for i in imgs], "evidence": [], "tests": []}
acc = {"evidence_dir": "evidencias", "requirements": [{"id": "REQ-F-013", "priority": "Must", "criteria": [
  crit(1, 'GIVEN "Iniciación" has 3 socios WHEN "lucia" signs up THEN the user sees "Te has apuntado a Iniciación"',
       {"texts": [{"text": "Te has apuntado a Iniciación", "template": False}], "where": "Clases", "none": None}, [img("REQ-F-013-AC1")]),
  crit(6, 'GIVEN "Iniciación" has 3 socios WHEN "pablo" signs up THEN the user sees "Te has apuntado a Iniciación"',
       {"texts": [{"text": "Te has apuntado a Iniciación", "template": False}], "where": "Clases", "none": None}, [img("REQ-F-013-AC6")]),
  crit(7, 'GIVEN "lucia" dada de baja WHEN the date is 2032-11-12 THEN her payments are still available',
       {"texts": [], "where": None, "none": "lo comprueba el CSV"}, [img("REQ-F-013-AC1")]),
  crit(8, 'GIVEN "lucia" holds pista 2 WHEN "pablo" tries to cancel it THEN the system refuses and the reservation stays',
       None, [img("REQ-F-013-AC1")]),
]}]}
r = {(x["ac"]): x for x in F.capturas(Path(sys.argv[2]), acc)}
assert 1 not in r, r                                                   # el test afirmó el texto antes de capturar
assert r[6]["no_se_ve"] == ["Te has apuntado a Iniciación"] and r[6]["grave"], r[6]   # «apuntada» para pablo
assert 7 not in r, r                                                   # No visible: nada que exigir
assert r[8].get("sin_comprobar") and not r[8]["grave"], r[8]          # sin Se ve ni literales: se dice
F.ocr = lambda p: "Clases  Te has apuntado a Iniciación  4 de 4 plazas"
r = {(x["ac"]): x for x in F.capturas(Path(sys.argv[2]), acc)}
assert 6 not in r, r                                                   # el OCR como segunda opinión
PY

# 4e. vínculos con «Se ve»: «lucia» es dato del ejemplo (otro actor vale); «Hola, lucia» es un caso de la plantilla
python3 - "$ROOT/plugin/hermes-sdd" "$R" <<'PY' && ok "vínculos: con «Se ve» un test con otro actor (pablo) no «falta» el dato «lucia»" || bad "vínculos «Se ve»"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
R = Path(sys.argv[2]); (R / "tests" / "clases.test.js").write_text("it('REQ-F-013 AC2 saludo', () => { expect(cabecera('pablo')).toBe(`Hola, ${u}`) })\n")
c = {"n": 2, "text": 'GIVEN "lucia" has a session WHEN she opens "Clases" THEN the user sees the heading "Hola, lucia"',
     "sees": {"texts": [{"text": "Hola, {usuario}", "template": True}], "where": "cabecera", "none": None},
     "tests": [{"file": "tests/clases.test.js", "name": "REQ-F-013 AC2 saludo"}]}
v = F.vinculos(R, {"requirements": [{"id": "REQ-F-013", "priority": "Must", "criteria": [c]}]})
assert v == [], v
c2 = dict(c, sees=None)
v = F.vinculos(R, {"requirements": [{"id": "REQ-F-013", "priority": "Must", "criteria": [c2]}]})
assert v and v[0]["faltan_then"] == ["Hola, lucia"], v                 # sin «Se ve», como antes
(R / "tests" / "clases.test.js").unlink()
PY

# 4f. mutantes sin ahogar la máquina: nice y pocos workers (configurable); lo que no se pudo hacer llega a la puerta
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "mutantes: nice -n 10, --workers=2 / --maxWorkers=2, configurable por entorno" || bad "mutantes nice"
import os, sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
c = F._comando(["npx", "playwright", "test", "tests/e2e/a.spec.js"])
assert c == ["nice", "-n", "10", "npx", "playwright", "test", "--workers=2", "tests/e2e/a.spec.js"], c
assert F._comando(["npx", "vitest", "run", "x.test.js"])[-2:] == ["--maxWorkers=2", "x.test.js"]
os.environ["HSDD_MUT_WORKERS"] = "1"; os.environ["HSDD_MUT_NICE"] = "0"
assert F._comando(["npx", "playwright", "test"]) == ["npx", "playwright", "test", "--workers=1"]
PY
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PY' && ok "revisión de la puerta: mutantes_error, textos «no está en el código», capturas sin comprobar y lint de capturas" || bad "revisión fidelidad"
import json, sys; sys.path.insert(0, sys.argv[1]); import hsdd_revision as V
from pathlib import Path
R = Path(sys.argv[2]) / "rev"; (R / ".sdd" / "hermes").mkdir(parents=True)
(R / ".sdd" / "hermes" / "fidelidad-7.json").write_text(json.dumps({
  "mutantes_error": "git worktree add: fatal: ya existe",
  "mutantes": [{"req": "REQ-F-013", "ac": 1, "texto": "Ya estás apuntada", "resultado": "no está en el código", "grave": False}],
  "capturas": [{"req": "REQ-F-023", "ac": 4, "capturas": ["a.png"], "no_se_ve": [], "sin_comprobar": True, "grave": False, "motivo": "x"}],
  "lint_capturas": [{"codigo": "C-03", "fichero": "tests/e2e/fase-0.journey.spec.js", "linea": 168, "req": "REQ-F-008", "ac": 4,
                     "mensaje": "the capture \"AC-008-04\" of REQ-F-008 AC4 is taken inside the test …", "grave": True}]}))
av = {a["codigo"]: a for a in V._fidelidad(R, "7")}
assert "ya existe" in av["mutantes-sin-hacer"]["texto"], av
assert "«Ya estás apuntada»" in av["texto-fuera-del-codigo"]["texto"], av
assert "REQ-F-023 AC4" in av["captura-sin-comprobar"]["texto"], av
assert av["captura-mal-tomada"]["grave"] and "fase-0.journey.spec.js:168" in av["captura-mal-tomada"]["texto"], av
PY

# 4g. lint de capturas desde fidelidad (lo que corre antes de aceptar): la captura de REQ-F-008 AC4 en un test.step
# de un recorrido que no cita el criterio (club, FASE-0) es grave
L="$T/lint"; mkdir -p "$L/requirements" "$L/tests/e2e"; ( cd "$L" && git init -q -b main )
printf '### REQ-F-008: Reservar\n- **Verification:** test\n- **Acceptance criteria:**\n  - GIVEN a WHEN b THEN the user sees "Reservada"\n  - GIVEN a WHEN c THEN the user sees "Ocupada"\n  - GIVEN a WHEN d THEN the user sees "Libre"\n  - GIVEN a WHEN e THEN the user sees "Esa pista ya está reservada a esa hora"\n' > "$L/requirements/REQUIREMENTS.md"
cat > "$L/tests/e2e/fase-0.journey.spec.js" <<'J'
test('WF-001 REQ-F-008 AC1 REQ-F-008 AC2 REQ-F-008 AC3 la socia reserva', async ({ page }, testInfo) => {
  await test.step('el reenvío da «Esa pista ya está reservada a esa hora»', async () => {
    await expect(page.getByRole('alert')).toHaveText('Esa pista ya está reservada a esa hora')
    await captura(page, testInfo, 'REQ-F-008-AC4')
  })
})
J
( cd "$L" && git add -A && git commit -qm init )
o=$(python3 "$F" lint_capturas "$L" --json)
echo "$o" | jq -e '.lint_capturas | any(.codigo == "C-03" and .req == "REQ-F-008" and .ac == 4 and .grave)' >/dev/null \
  && ok "lint de capturas: la captura de REQ-F-008 AC4 en un test.step de otro test es grave" || bad "lint_capturas: $o"

# 4h. captura mala en un test YA ACEPTADO (existe en el último fase-*-accepted): el implementador no puede editarlo, así
# que no lanza la pasada de arreglo; llega a la puerta como pregunta «editar-test <fichero>». La de un test nuevo, sí
# va a la pasada. Con permiso firmado (test-edit tras la aceptación), el congelado también se arregla en la pasada.
G="$T/congeladas"; mkdir -p "$G/tests/e2e" "$G/requirements" "$G/.sdd/hermes" "$G/acceptance"; cd "$G"
git init -q -b main; git config user.email t@t; git config user.name t; git config commit.gpgsign false
printf '### REQ-F-002: Lista de espera con puesto\n' > requirements/REQUIREMENTS.md
echo "test('REQ-F-002 AC1', () => {})" > tests/e2e/viejo.spec.js; : > acceptance/decisions.jsonl
git add -A; git commit -qm fase0; git tag fase-0-accepted
echo "test('REQ-F-009 AC1', () => {})" > tests/e2e/nuevo.spec.js; git add -A; git commit -qm fase1
cat > .sdd/hermes/fidelidad-1.json <<'J'
{"graves": 3, "congelados": [], "capturas": [], "mutantes": [], "coherencia": [], "lint_capturas": [
 {"codigo": "C-01", "fichero": "tests/e2e/viejo.spec.js", "linea": 12, "req": "REQ-F-002", "ac": 1, "mensaje": "capture after an API check", "grave": true},
 {"codigo": "C-03", "fichero": "tests/e2e/viejo.spec.js", "linea": 30, "req": "REQ-F-002", "ac": 2, "mensaje": "capture in another test", "grave": true},
 {"codigo": "C-01", "fichero": "tests/e2e/nuevo.spec.js", "linea": 5, "req": "REQ-F-009", "ac": 1, "mensaje": "capture after an API check", "grave": true},
 {"codigo": "C-09", "fichero": "tests/e2e/viejo.spec.js", "linea": 40, "mensaje": "aviso", "grave": false}]}
J
REPO="$G"; FASE=1
eval "$(sed -n '/^graves_arreglables()/,/^}/p' "$ROOT/etapa.sh")"
n=$(graves_arreglables); H=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_hallazgos.py" lineas "$G" 1)
[ "$n" = 1 ] && echo "$H" | grep -q 'nuevo.spec.js:5' && ! echo "$H" | grep -q 'viejo.spec.js' \
  && ok "captura mala en un test ya aceptado: no cuenta para la pasada de arreglo; la del test nuevo, sí" || bad "arreglables: $n / $H"
q=$(cat .sdd/questions-fidelidad.md 2>/dev/null)
[ "$(grep -c '^## Q-fidelidad-' <<< "$q")" = 1 ] && grep -q '^## Q-fidelidad-001 \[OPEN\] .*congelado=fase-0-accepted' <<< "$q" \
  && grep -q '^     efecto: editar-test tests/e2e/viejo.spec.js$' <<< "$q" && grep -q 'C-03 line 30 (REQ-F-002 AC2)' <<< "$q" \
  && grep -q '^Para el cliente: Algunas capturas de una prueba que ya aceptaste (de «Lista de espera con puesto»)' <<< "$q" \
  && ok "…y llega a la puerta como pregunta propuesta «editar-test tests/e2e/viejo.spec.js» (una por fichero)" || bad "pregunta: $q"
python3 - "$ROOT/plugin/hermes-sdd" "$G" <<'PY' && ok "la pregunta es del formato nuevo y la puerta la enseña con su efecto" || bad "formato de la pregunta"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
f = Path(sys.argv[2]) / ".sdd/questions-fidelidad.md"
b = T.bloques_preguntas([f])["Q-fidelidad-001"]
assert T.errores_pregunta(b) == [], T.errores_pregunta(b)
assert T.efecto(b, "A")["efecto"] == "editar-test" and T.efecto(b, "A")["ficheros"] == ["tests/e2e/viejo.spec.js"]
assert T.opciones_json(b)["recomendada"] == "A" and T.efecto(b, "B")["efecto"] == "ninguno"
assert "(✏️ autoriza editar tests/e2e/viejo.spec.js)" in T.preguntas([f])
PY
graves_arreglables >/dev/null; sed -i.bak 's/\[OPEN\]/[ANSWERED]/' .sdd/questions-fidelidad.md; rm -f .sdd/questions-fidelidad.md.bak; graves_arreglables >/dev/null
[ "$(grep -c '^## Q-fidelidad-' .sdd/questions-fidelidad.md)" = 1 ] \
  && ok "no se repite la pregunta (abierta, o contestada «se queda como está») hasta la aceptación siguiente" || bad "repetida: $(cat .sdd/questions-fidelidad.md)"
echo '{"type":"test-edit","files":["tests/e2e/viejo.spec.js"],"question":"Q-fidelidad-001","head":"x"}' >> acceptance/decisions.jsonl
git commit -qam "docs(acceptance): test-edit"
[ "$(graves_arreglables)" = 3 ] && ok "con permiso firmado para editarlo, el test congelado vuelve a la pasada de arreglo" || bad "autorizado: $(graves_arreglables)"
jq -n '{graves: 1, error: "hsdd_fidelidad falló"}' > .sdd/hermes/fidelidad-1.json
[ "$(graves_arreglables)" = 1 ] && ok "si la fidelidad falló, sigue habiendo pasada de arreglo" || bad "error de fidelidad"
# 4g. pasadas de arreglo: hasta rondas_arreglo (1 de serie) mientras queden hallazgos arreglables; las dudas del criterio
# (SPEC-QUESTION) no lanzan arreglo (son de una persona); la marca antigua (vacía) cuenta como una ya hecha
(
  eval "$(sed -n '/^revision_independiente() {/,/^}/p' "$ROOT/etapa.sh")"
  ARNES=""; modelo_veredictos() { echo m; }; fidelidad() { :; }; hallazgos() { echo "- CH-1"; }; no_repitas() { :; }
  claude_etapa() { [ "$1" = task-implementer ] && echo x >> "$T/pasadas"; }
  quedan=5; hay_hallazgos() { [ "$quedan" -gt 0 ]; }
  FASE=7; rm -f ".sdd/hermes/fidelidad-arreglo-7" "$T/pasadas"; revision_independiente
  [ "$(wc -l < "$T/pasadas" | tr -d ' ')" = 1 ] && [ "$(cat .sdd/hermes/fidelidad-arreglo-7)" = 1 ] && echo "ok   1 pasada de arreglo de serie aunque queden hallazgos (lo que quede va a la puerta)" || echo "FAIL pasadas: $(cat "$T/pasadas" 2>/dev/null | wc -l)"
  echo '{"rondas_arreglo": 3}' > .sdd/hermes/hermes-sdd.json.r; cp .sdd/hermes/hermes-sdd.json "$T/hs.bak" 2>/dev/null || true
  jq -s '.[0] + .[1]' "$T/hs.bak" .sdd/hermes/hermes-sdd.json.r > .sdd/hermes/hermes-sdd.json 2>/dev/null || mv .sdd/hermes/hermes-sdd.json.r .sdd/hermes/hermes-sdd.json
  rm -f ".sdd/hermes/fidelidad-arreglo-7" "$T/pasadas"; quedan=0; revision_independiente
  [ ! -f "$T/pasadas" ] && echo "ok   sin hallazgos arreglables no hay pasada" || echo "FAIL pasada sin hallazgos"
  : > .sdd/hermes/fidelidad-arreglo-7; quedan=5; revision_independiente
  [ "$(wc -l < "$T/pasadas" | tr -d ' ')" = 2 ] && echo "ok   la marca antigua cuenta como una; rondas_arreglo 3 deja dos más" || echo "FAIL marca antigua: $(cat "$T/pasadas" 2>/dev/null | wc -l)"
  [ -f "$T/hs.bak" ] && cp "$T/hs.bak" .sdd/hermes/hermes-sdd.json; rm -f .sdd/hermes/hermes-sdd.json.r .sdd/hermes/fidelidad-arreglo-7
) | tee "$T/arreglo.out"; { grep -q '^FAIL' "$T/arreglo.out" || [ "$(grep -c '^ok' "$T/arreglo.out")" != 3 ]; } && { echo "FAIL pasadas de arreglo: no terminó"; fail=1; }
grep -q 'select(.state == "open" and .category != "SPEC-QUESTION")' "$ROOT/etapa.sh" && ok "las dudas del criterio no lanzan la pasada de arreglo" || bad "SPEC-QUESTION en el arreglo"
cd "$R"
# 4h. caché de mutantes por hash (fuente + test + mutación): un mutante ya ejecutado no se repite (re-aceptación, cierre);
# cambiar el fichero que lo contiene, su test o un helper lo invalida; una línea base que falla no se guarda
python3 - "$ROOT/plugin/hermes-sdd" "$T/mut" <<'PY' && ok "mutantes: caché por hash en .sdd/hermes, invalidada al cambiar la fuente, el test o un helper" || bad "caché de mutantes"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
R = Path(sys.argv[2]); C = R / "copia"
for d in ("src", "tests/helpers"): (C / d).mkdir(parents=True, exist_ok=True)
(C / "src" / "app.js").write_text("export const t = 'Hola mundo'\n")
(C / "src" / "otro.js").write_text("export const x = 1\n")
(C / "tests" / "app.test.js").write_text("it('REQ-F-001 AC1', () => expect(t).toBe('Hola mundo'))\n")
(C / "tests" / "helpers" / "h.js").write_text("export const h = 1\n")
acc = {"requirements": [{"id": "REQ-F-001", "priority": "Must", "criteria": [{"n": 1,
       "text": "GIVEN x WHEN y THEN ve el mensaje «Hola mundo»", "tests": [{"file": "tests/app.test.js", "name": "REQ-F-001 AC1"}]}]}]}
llamadas = []
def ejecuta(copia, cmd, minutos=10):
    llamadas.append(cmd); return "MUTANTE" not in (copia / "src" / "app.js").read_text()   # el test nota el mutante
F._ejecuta = ejecuta
def corre():
    llamadas.clear(); st = {}; out = F.mutantes(R, C, acc, stats=st); return out, st, len(llamadas)
out, st, n = corre()
assert out[0]["resultado"] == "solo lo detecta un unitario" and st == {"de_cache": 0, "ejecutados": 1} and n == 2, (out, st, n)
assert (R / ".sdd" / "hermes" / "mutantes-cache.json").is_file()
out2, st, n = corre()
assert n == 0 and st == {"de_cache": 1, "ejecutados": 0} and out2 == out, (out2, st, n)   # nada se repite
(C / "src" / "otro.js").write_text("export const x = 2\n")    # otro fichero de la app: la línea base, no el mutante
out, st, n = corre(); assert n == 1 and st["de_cache"] == 1, (st, n)
(C / "src" / "app.js").write_text("export const t = 'Hola mundo' // v2\n")   # la fuente del texto: se repite
out, st, n = corre(); assert st["ejecutados"] == 1, st
(C / "tests" / "app.test.js").write_text("it('REQ-F-001 AC1', () => expect(t).toContain('Hola'))\n")   # su test
out, st, n = corre(); assert st["ejecutados"] == 1, st
(C / "tests" / "helpers" / "h.js").write_text("export const h = 2\n")   # un helper de los tests
out, st, n = corre(); assert st["ejecutados"] == 1, st
out, st, n = corre(); assert n == 0, n
# una línea base que falla (quizá intermitente) no se guarda: la siguiente vez se vuelve a probar
F._ejecuta = lambda copia, cmd, minutos=10: (llamadas.append(cmd), False)[1]
(C / "src" / "otro.js").write_text("export const x = 3\n")
out, st, n = corre(); assert out[0]["resultado"] == "sus tests ya fallan sin mutar nada" and n == 1, (out, n)
out, st, n = corre(); assert n == 1, n
PY

# 5. OCR de verdad (solo en macOS): una imagen con texto
if command -v swiftc >/dev/null && command -v sips >/dev/null; then
  cat > "$T/img.swift" <<'S'
import AppKit
let img = NSImage(size: NSSize(width: 420, height: 90)); img.lockFocus()
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: 420, height: 90).fill()
("Vivienda 2ºB · Ocupada" as NSString).draw(at: NSPoint(x: 10, y: 30), withAttributes: [.font: NSFont.systemFont(ofSize: 28)])
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!; try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
S
  swift "$T/img.swift" "$T/c.png" 2>/dev/null
  python3 - "$ROOT/plugin/hermes-sdd" "$T/c.png" <<'PY' && ok "OCR: lee «Vivienda 2ºB» y «Ocupada» en una captura" || bad "ocr"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
t = F.norm(F.ocr(Path(sys.argv[2])))
assert F.norm("Vivienda 2ºB") in t and "ocupada" in t, t
PY
fi
# taller3: un e2e que pasó en la etapa (su JUnit) y falla en este ordenador no es «tests rotos» (grave): es el entorno
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PY' && ok "mutantes: el JUnit de la etapa distingue tests rotos de un entorno local que falla" || bad "junit de la etapa"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
r = Path(sys.argv[2]) / "junit"; (r / ".sdd/junit").mkdir(parents=True)
(r / ".sdd/junit/playwright.xml").write_text('<testsuites><testsuite><testcase name="a" classname="criterios.spec.js"/><testcase name="b" classname="otro.spec.js"><failure message="x"/></testcase></testsuite></testsuites>')
assert F._junit_pasa(r, "tests/e2e/criterios.spec.js") is True
assert F._junit_pasa(r, "tests/e2e/otro.spec.js") is False
assert F._junit_pasa(r, "tests/e2e/nadie.spec.js") is False
PY
# un texto que la app compone (plantilla + datos) tiene su parte fija en el código: no es «no está en el código»
# (material-montana2, FASE-1: «Reserva creada: Casco del 2026-12-11 al 2026-12-13»)
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PY' && ok "texto compuesto por la app: se reconoce su parte fija en el código" || bad "plantilla"
import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
d = Path(sys.argv[2]) / "plantilla"; d.mkdir(exist_ok=True); f = d / "reservas.js"
f.write_text("export const aviso = (r) => `Reserva creada: ${r.material} del ${r.desde} al ${r.hasta}`;\n")
assert F._prefijo_en_codigo("Reserva creada: Casco del 2026-12-11 al 2026-12-13", [f]) == "Reserva creada:", F._prefijo_en_codigo("Reserva creada: Casco del 2026-12-11 al 2026-12-13", [f])
assert F._prefijo_en_codigo("Ya estás apuntada", [f]) == ""
PY
exit $fail
