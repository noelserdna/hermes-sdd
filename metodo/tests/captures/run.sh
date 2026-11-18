#!/usr/bin/env bash
# Tests of the «Se ve» contract and the captures before the acceptance, with the cases of the club project (Hermes,
# 11/2026): the `- Se ve:` / `- No visible:` lines (sdd-jev.mjs parseSees, `sdd req show`), the typed literals of
# `sdd lint --quotes` (exact text, template {variable}, data of the example: «lucia» / «pablo»), the warnings of
# `sdd lint --needs` (no-sees, one-actor: «Ya estás apuntada» for everybody), `sdd lint --captures` (C-01 capture after
# an API check, C-03 capture taken in a test.step of a test that does not cite the criterion — REQ-F-008 AC4 —, C-02,
# C-04) and the ledger: a capture attached by a test that does not cite the criterion does not show it, the sidecar of
# the capture helper, criterion → video and `criterion_video`. bash 3.2 and 5; needs git, node >= 18.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SDD="$ROOT/scripts/sdd.mjs"
fail=0
pass() { echo "ok   $1"; }
bad()  { echo "FAIL $1"; fail=1; }
contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
run() { rc=0; out=$(cd "$repo" && node "$SDD" "$@" 2>&1) || rc=$?; }
runo() { rc=0; out=$(cd "$repo" && node "$SDD" "$@" 2>/dev/null) || rc=$?; }
js() { printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const j=JSON.parse(s);process.stdout.write(String(eval(process.argv[1])))})' "$1"; }
expect() { if [ "$2" = "$3" ]; then pass "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
has() { if contains "$out" "$2"; then pass "$1"; else bad "$1 (missing: $2)"; fi; }
hasnt() { if contains "$out" "$2"; then bad "$1 (unexpected: $2)"; else pass "$1"; fi; }

tmp="$(mktemp -d)"; tmp="$(cd "$tmp" && pwd -P)"
trap 'rm -rf "$tmp"' EXIT
unset SDD_ROLE SDD_STATE_ROOT SDD_PLUGIN_ROOT CLAUDE_PROJECT_DIR CLAUDE_PLUGIN_ROOT || true
export HOME="$tmp/home" GIT_CONFIG_NOSYSTEM=1
export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
mkdir -p "$HOME"
n=0
commit() { n=$((n + 1)); local d; d="2026-01-01T00:$(printf %02d "$n"):00"; ( cd "$repo" && git add -A && GIT_AUTHOR_DATE="$d" GIT_COMMITTER_DATE="$d" git commit -q --allow-empty -m "$1" ); }

repo="$tmp/club"; mkdir -p "$repo/requirements" "$repo/tests/e2e" "$repo/tests/unit" "$repo/src" "$repo/.sdd/junit"
( cd "$repo" && git init -q -b main )
cat > "$repo/requirements/CUSTOMER-NEEDS.md" <<'MD'
### N-001: Clases
- **Quote:** "que se apunten solos"
- **Status:** confirmed
MD
cat > "$repo/requirements/REQUIREMENTS.md" <<'MD'
> **Examples reviewed by:** Ana (club), 2026-11-01

### REQ-F-001: Apuntarse a una clase
- **Statement:** WHEN a socio signs up THE system SHALL keep the place
- **Para el cliente:** Te apuntas a una clase.
- **Priority:** Must have
- **Needs:** N-001
- **Verification:** test
- **Acceptance criteria:**
  - GIVEN "Iniciación" has 3 socios WHEN the socio "lucia" signs up THEN the user sees "Ya estás apuntada a Iniciación"
    - Se ve: "Ya estás apuntada a Iniciación" en Clases
  - GIVEN "lucia" has an open session WHEN she opens "Clases" THEN the user sees the heading "Hola, lucia"
    - Se ve: "Hola, {usuario}" en la cabecera
  - GIVEN "lucia" dada de baja on 2026-11-13 WHEN the date is 2032-11-12 THEN her payments are still available
    - No visible: lo comprueba el CSV de pagos
  - GIVEN "Iniciación" has 4 socios WHEN "pablo" tries to sign up THEN the system refuses
- **Dependencies:** None

### REQ-F-002: Lista de socios
- **Statement:** THE system SHALL list the socios
- **Para el cliente:** La junta ve a los socios.
- **Priority:** Must have
- **Needs:** N-001
- **Verification:** test
- **Acceptance criteria:**
  - GIVEN the socio "lucia" WHEN the junta opens "Socios" THEN the user sees "Lucía Pérez — lucia"
- **Dependencies:** None
MD
commit "init"

# ---------------------------------------------------------------- 1. the «Se ve» lines
run req show REQ-F-001 --json
expect "Se ve: exact text, screen" "$(js 'j.criteria[0].sees.texts[0].text + "|" + j.criteria[0].sees.texts[0].template + "|" + j.criteria[0].sees.where')" "Ya estás apuntada a Iniciación|false|Clases"
expect "Se ve: a {variable} is a template" "$(js 'j.criteria[1].sees.texts[0].template')" true
expect "No visible: the reason" "$(js 'j.criteria[2].sees.none + "|" + j.criteria[2].sees.texts.length')" "lo comprueba el CSV de pagos|0"
expect "a criterion without the lines has no sees" "$(js 'String(j.criteria[3].sees)')" undefined
expect "criteria stay 4 (the Se ve lines are not criteria)" "$(js 'j.criteria.length')" 4
run req show REQ-F-001 --ac 1
expect "req show --ac stays one line (the quote above the assert)" "$out" 'REQ-F-001 AC1: GIVEN "Iniciación" has 3 socios WHEN the socio "lucia" signs up THEN the user sees "Ya estás apuntada a Iniciación"'

# ---------------------------------------------------------------- 2. lint --needs: no-sees and one-actor
run lint --needs --json
expect "no-sees: REQ-F-001 AC4 and REQ-F-002 AC1 without Se ve / No visible" "$(js 'j.warnings.filter(w=>w.code==="no-sees").map(w=>w.msg.split(":")[0]).join(",")')" "REQ-F-001 AC4,REQ-F-002 AC1"
expect "one-actor: «Ya estás apuntada» only for lucia (club: shown to pablo too)" "$(js 'j.warnings.filter(w=>w.code==="one-actor"&&w.msg.startsWith("REQ-F-001 AC1:")).map(w=>w.msg.slice(0,40)).join(",")')" 'REQ-F-001 AC1: "Ya estás apuntada a Inic'
expect "one-actor: also the template «Hola, {usuario}» with one example" "$(js 'j.warnings.filter(w=>w.code==="one-actor").length')" 2
expect "lint --needs still exits 0 (warnings)" "$rc" 0
# The fix: a neutral text, a second actor with other data for each
node -e 'const fs=require("fs"),f=process.argv[1];let t=fs.readFileSync(f,"utf8");
t=t.split("Ya estás apuntada a Iniciación").join("Te has apuntado a Iniciación");
t=t.replace("  - GIVEN \"lucia\" dada de baja","  - GIVEN \"Iniciación\" has 3 socios WHEN the socio \"pablo\" signs up THEN the user sees \"Te has apuntado a Iniciación\"\n    - Se ve: \"Te has apuntado a Iniciación\" en Clases\n  - GIVEN \"pablo\" has an open session WHEN he opens \"Clases\" THEN the user sees the heading \"Hola, pablo\"\n    - Se ve: \"Hola, {usuario}\" en la cabecera\n  - GIVEN \"lucia\" dada de baja");
fs.writeFileSync(f,t)' "$repo/requirements/REQUIREMENTS.md"
commit "req: second actor"
run lint --needs --json
expect "a second actor with other data: no one-actor" "$(js 'j.warnings.filter(w=>w.code==="one-actor").length')" 0

# ---------------------------------------------------------------- 3. lint --quotes: typed literals
cat > "$repo/tests/unit/clases.test.js" <<'J'
it('REQ-F-001 AC1 otro socio se apunta', () => {
  // REQ-F-001 AC1: "GIVEN "Iniciación" has 3 socios WHEN the socio "lucia" signs up THEN the user sees "Te has apuntado a Iniciación""
  const usuario = 'pablo'
  expect(apuntar('Iniciación', usuario)).toBe('Te has apuntado a Iniciación')
})
it('REQ-F-001 AC2 saludo', () => {
  // REQ-F-001 AC2: "GIVEN "lucia" has an open session WHEN she opens "Clases" THEN the user sees the heading "Hola, lucia""
  const usuario = 'pablo'
  expect(cabecera(usuario)).toBe(`Hola, ${usuario}`)
})
it('REQ-F-002 AC1 lista', () => {
  // REQ-F-002 AC1: "GIVEN the socio "lucia" WHEN the junta opens "Socios" THEN the user sees "Lucía Pérez — lucia""
  expect(fila('pablo')).toBe('Pablo — pablo')
})
J
run lint --quotes --json
expect "Q-03: «lucia» is data of the example when the criterion has Se ve (AC1 tested with pablo)" "$(js 'j.findings.filter(f=>f.code==="Q-03"&&f.req==="REQ-F-001"&&f.ac===1).length')" 0
expect "Q-03: the template «Hola, {usuario}» needs only its form («Hola,»)" "$(js 'j.findings.filter(f=>f.code==="Q-03"&&f.req==="REQ-F-001"&&f.ac===2).length')" 0
expect "Q-03: without Se ve every literal is still required (REQ-F-002: lucia, Socios, the row)" "$(js 'j.findings.filter(f=>f.code==="Q-03"&&f.req==="REQ-F-002").map(f=>f.literal).join("|")')" "lucia|Socios|Lucía Pérez — lucia"
sed -i.bak 's/`Hola, ${usuario}`/usuario/' "$repo/tests/unit/clases.test.js"; rm -f "$repo/tests/unit/clases.test.js.bak"
run lint --quotes --json
expect "Q-03: a test without the template's form fails it" "$(js 'j.findings.filter(f=>f.code==="Q-03"&&f.req==="REQ-F-001"&&f.ac===2).map(f=>f.message.slice(0,60)).join()')" 'the form of the template "Hola, {usuario}" ("Hola,") of REQ-'
sed -i.bak "s/toBe('Te has apuntado a Iniciación')/toBe('Ya estás apuntada')/" "$repo/tests/unit/clases.test.js"; rm -f "$repo/tests/unit/clases.test.js.bak"
run lint --quotes --json
expect "Q-03: the Se ve text is exact («Ya estás apuntada» does not pass for it)" "$(js 'j.findings.filter(f=>f.code==="Q-03"&&f.req==="REQ-F-001"&&f.ac===1).map(f=>f.literal).join()')" "Te has apuntado a Iniciación"
rm -f "$repo/tests/unit/clases.test.js"

# ---------------------------------------------------------------- 4. lint --captures
cat > "$repo/tests/e2e/clases.spec.js" <<'J'
async function captura(page, testInfo, id, opciones = {}) {
  await page.screenshot({ path: `evidencias/${id}.png` })
}
test('REQ-F-001 AC3 los pagos de «lucia» siguen ahí (UC-099)', async ({ page }, testInfo) => {
  await expect(page.getByRole('heading')).toHaveText('Socios')
  expect(await (await page.request.get('/api/pagos.csv?mes=2026-10')).text()).toContain('lucia')
  await captura(page, testInfo, 'REQ-F-001-AC3')
})
test('REQ-F-001 AC1 se apunta y lo ve', async ({ page }, testInfo) => {
  const r = await page.evaluate(() => fetch('/api/clases/apuntar', { method: 'POST' }))
  await expect(page.getByRole('status')).toHaveText('Te has apuntado a Iniciación')
  await captura(page, testInfo, 'REQ-F-001-AC1')
})
test('REQ-F-001 AC5 pablo se apunta', async ({ page }, testInfo) => {
  await page.request.post('/api/clases/apuntar')
  await captura(page, testInfo, 'REQ-F-001-AC5', { ve: ['Te has apuntado a Iniciación'] })
})
test('WF-001 REQ-F-001 AC6 recorrido', async ({ page }, testInfo) => {
  await test.step('lucia ve su saludo', async () => {
    await expect(page.getByRole('heading')).toHaveText('Hola, lucia')
    await captura(page, testInfo, 'REQ-F-001-AC2')
  })
})
test('REQ-F-001 AC4 pablo ve su saludo', async ({ page }, testInfo) => {
  await captura(page, testInfo, 'REQ-F-001-AC4', { ve: ['Hola'] })
})
J
run lint --captures --json
expect "lint --captures exits 1 on errors" "$rc" 1
expect "C-01: capture right after a CSV check by API (club: fase-7.plazos.spec.js:129)" "$(js 'j.findings.filter(f=>f.code==="C-01").map(f=>f.req+" AC"+f.ac).join()')" "REQ-F-001 AC3"
expect "C-01: no error when the screen is asserted after the API call, or the helper asserts { ve }" "$(js 'j.findings.filter(f=>f.code==="C-01"&&(f.ac===1||f.ac===5)).length')" 0
expect "C-03: capture in a test.step of a test that does not cite the criterion (club: REQ-F-008 AC4)" "$(js 'j.findings.filter(f=>f.code==="C-03").map(f=>f.req+" AC"+f.ac+" "+f.line).join()')" "REQ-F-001 AC2 21"
expect "C-04: UC-099 exists nowhere in the documents" "$(js 'j.findings.filter(f=>f.code==="C-04"&&f.message.startsWith("UC")).map(f=>f.message.slice(0,6)).join()')" "UC-099"
run lint --captures --json
expect "C-05: a capture of a criterion with «Se ve» that does not pass { ve } (AC1, AC2, AC3)" "$(js 'j.findings.filter(f=>f.code==="C-05").map(f=>f.req+" AC"+f.ac).sort().join()')" "REQ-F-001 AC1,REQ-F-001 AC2,REQ-F-001 AC3"
expect "C-06: its inline ve lacks the «Se ve» text (AC4: «Hola» for «Hola, {usuario}»)" "$(js 'j.findings.filter(f=>f.code==="C-06").map(f=>f.req+" AC"+f.ac+" "+f.severity).join()')" "REQ-F-001 AC4 error"
run lint --captures
run lint --captures
has "text output: file:line code severity" "tests/e2e/clases.spec.js:7 C-01 error REQ-F-001 AC3"

# ---------------------------------------------------------------- 5. the ledger: who took the capture
rm -f "$repo/tests/e2e/clases.spec.js"
mkdir -p "$repo/evidencias/FASE-1" "$repo/test-results/a" "$repo/test-results/b"
commit "tests"
printf 'png-ac2-lucia' > "$repo/evidencias/FASE-1/REQ-F-001-AC2.png"
cp "$repo/evidencias/FASE-1/REQ-F-001-AC2.png" "$repo/test-results/a/REQ-F-001-AC2-1a2b3c.png"
printf 'png-ac1' > "$repo/test-results/b/REQ-F-001-AC1-9f8e.png"
printf 'png-otra' > "$repo/test-results/b/REQ-F-002-AC1-77aa.png"
printf 'png-ac6' > "$repo/test-results/a/REQ-F-001-AC6-5d.png"
junit() {
  cat > "$repo/.sdd/junit/e2e.xml" <<XML
<testsuites><testsuite name="clases.spec.js">
<testcase classname="clases.spec.js" name="WF-001 REQ-F-001 AC6 recorrido"><system-out><![CDATA[[[ATTACHMENT|../../test-results/a/REQ-F-001-AC2-1a2b3c.png]]
[[ATTACHMENT|../../test-results/a/REQ-F-001-AC6-5d.png]]
$1
]]></system-out></testcase>
<testcase classname="clases.spec.js" name="REQ-F-001 AC1 se apunta y lo ve"><system-out><![CDATA[[[ATTACHMENT|../../test-results/b/REQ-F-001-AC1-9f8e.png]]
[[ATTACHMENT|../../test-results/b/REQ-F-002-AC1-77aa.png]]
$2
]]></system-out></testcase>
<testcase classname="clases.spec.js" name="REQ-F-001 AC2 saludo de lucia"/>
</testsuite></testsuites>
XML
}
junit "" ""
run accept --json --no-out
C='(n)=>j.requirements.find(r=>r.id==="REQ-F-001").criteria[n-1]'
expect "AC1: its own test attached REQ-F-001-AC1 → shown by it" "$(js "($C)(1).visual + '|' + ($C)(1).shown_by.join()")" "shown|test-results/b/REQ-F-001-AC1-9f8e.png"
expect "AC2: the capture was attached by a test that does not cite it → not counted, unshown" "$(js "($C)(2).visual + '|' + ($C)(2).state + '|' + ($C)(2).unbound_captures[0].ref")" "missing|unshown|evidencias/FASE-1/REQ-F-001-AC2.png"
expect "AC2: the reason names the test" "$(js "($C)(2).unbound_captures[0].reason")" 'attached by the test "WF-001 REQ-F-001 AC6 recorrido", whose title does not cite REQ-F-001 AC2'
expect "summary.unbound_captures counts it" "$(js 'j.summary.unbound_captures')" 1
expect "REQ-F-002 AC1 is not shown by an image named after it in a test bound to REQ-F-001 AC1 only (no binding)" "$(js 'j.requirements.find(r=>r.id==="REQ-F-002").criteria[0].visual')" missing
run accept --no-out
has "accept says why the capture does not count" "evidencias/FASE-1/REQ-F-001-AC2.png not counted: attached by the test"
run lint --captures --json
expect "lint --captures: C-03 from the ledger for the unbound capture" "$(js 'j.findings.filter(f=>f.code==="C-03").map(f=>f.file+" "+f.req+" AC"+f.ac).join()')" "evidencias/FASE-1/REQ-F-001-AC2.png REQ-F-001 AC2"
expect "C-03 is an error when the criterion has no capture of its own (AC2 is unshown)" "$(js 'j.findings.filter(f=>f.code==="C-03").map(f=>f.severity+"|"+f.message.slice(0,30)).join()')" "error|not counted for REQ-F-001 AC2:"
# The capture helper's sidecar names the test that took it: a test that cites AC2 and passes → it counts
printf '{"criterio":"REQ-F-001-AC2","test":"REQ-F-001 AC2 saludo de lucia","ve":["Hola, lucia"],"url":"http://x/clases"}' > "$repo/evidencias/FASE-1/REQ-F-001-AC2.json"
run accept --json --no-out
expect "sidecar: taken by «REQ-F-001 AC2 saludo de lucia», which cites AC2 and passes → shown" "$(js "($C)(2).visual + '|' + ($C)(2).evidence.find(e=>e.kind==='capture').binding")" "shown|sidecar"
printf '{"criterio":"REQ-F-001-AC2","test":"WF-001 REQ-F-001 AC6 recorrido","ve":["Hola, lucia"]}' > "$repo/evidencias/FASE-1/REQ-F-001-AC2.json"
run accept --json --no-out
expect "sidecar: taken by the journey that does not cite AC2 → not counted" "$(js "($C)(2).visual + '|' + ($C)(2).unbound_captures[0].reason.slice(0,24)")" "missing|taken by the test \"WF-00"
# the sidecar names a test that is not in any report (it did not run: material-montana2, a partial delivery with the
# junit of the last FASE only): the reason says so instead of blaming the title
printf '{"criterio":"REQ-F-001-AC2","test":"REQ-F-001 AC2 una prueba de otra FASE","ve":["Hola, lucia"]}' > "$repo/evidencias/FASE-1/REQ-F-001-AC2.json"
run accept --json --no-out
expect "sidecar: taken by a test that is not in the reports → says it did not run" "$(js "($C)(2).unbound_captures[0].reason.split(', ')[1]")" "which is not in the test reports (it did not run)"
rm -f "$repo/evidencias/FASE-1/REQ-F-001-AC2.json"
# A capture named after a criterion that nobody attached (minitest) keeps counting by its name
printf 'png-ac4' > "$repo/evidencias/FASE-1/REQ-F-001-AC1-extra.png"
run accept --json --no-out
expect "a name-bound capture no test attached: binding name (retrocompatible)" "$(js "($C)(1).evidence.find(e=>e.ref==='evidencias/FASE-1/REQ-F-001-AC1-extra.png').binding")" name
# Video per criterion: indexed from the attachments of its browser tests; criterion_video required holds it
printf 'vid' > "$repo/test-results/b/video.webm"
junit "" "[[ATTACHMENT|../../test-results/b/video.webm]]"
run accept --json --no-out
expect "criterion → video index" "$(js "($C)(1).video + '|' + ($C)(1).videos.join()")" "present|test-results/b/video.webm"
expect "the journey's criterion AC6 has no video: missing (warn by default)" "$(js "($C)(6).video + '|' + j.criterion_video + '|' + ($C)(6).state")" "missing|warn|pass"
printf '# p\n\n## SDD Stack Profile\n- criterion_video: required\n' > "$repo/CLAUDE.md"; commit "profile"
touch "$repo/.sdd/junit/e2e.xml" "$repo/evidencias/FASE-1/"*.png
run accept --json --no-out
expect "criterion_video: required → a passing criterion without video is unshown" "$(js "($C)(6).state + '|' + j.summary.criteria_without_video")" "unshown|2"
run accept --report acceptance/R.md --no-out
grep -q '^| REQ-F-001 | AC1 | pass | test-results/b/REQ-F-001-AC1-9f8e.png | test-results/b/video.webm |' "$repo/acceptance/R.md" && pass "report: screenshot and video per criterion" || bad "report: video column ($(grep 'REQ-F-001 | AC1 ' "$repo/acceptance/R.md"))"

# ---------------------------------------------------------------- 7. narration: what is said is what is seen
nr="$tmp/narra"; mkdir -p "$nr/requirements" "$nr/evidencias/FASE-0" "$nr/tests/e2e"; ( cd "$nr" && git init -q -b main )
printf '# P\n\n## SDD Stack Profile\n\n- narration: required\n' > "$nr/CLAUDE.md"
cat > "$nr/requirements/REQUIREMENTS.md" <<'MD'
### REQ-F-001: Reservar material
- **Statement:** THE system SHALL book
- **Priority:** Must have
- **Verification:** test
- **Acceptance criteria:**
  - GIVEN "lucia" WHEN she books "Casco" THEN the user sees "Reserva creada: Casco"
    - Se ve: "Reserva creada: Casco" en Mis reservas
  - GIVEN "lucia" WHEN she opens "Mis reservas" THEN the user sees "Hola, lucia"
    - Se ve: "Hola, {usuario}" en la cabecera
  - GIVEN "lucia" WHEN she cancels THEN nothing changes on screen
    - No visible: lo comprueba el almacén
MD
nrun() { rc=0; out=$(cd "$nr" && node "$SDD" lint --captures --fase 0 --json 2>&1) || rc=$?; }
nrun; expect "narration: before the run (no captures) there is nothing to say" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).length')" 0
printf '{"criterio":"REQ-F-001-AC1","imagen":"REQ-F-001-AC1.png","narrado":"Reservar material. En Mis reservas se ve «Reserva creada: Casco»."}' > "$nr/evidencias/FASE-0/REQ-F-001-AC1.json"
printf '{"criterio":"REQ-F-001-AC2","imagen":"REQ-F-001-AC2.png","narrado":null}' > "$nr/evidencias/FASE-0/REQ-F-001-AC2.json"
nrun
expect "C-07: a visible criterion nobody narrates (AC2); AC1 narrated with its text; AC3 not visible" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).map(f=>f.code+" AC"+f.ac+" "+f.severity).join()')" "C-07 AC2 error"
printf '{"video":"WF-001-x.webm","narraciones":[{"t":1,"texto":"Lucía abre Mis reservas y ve su saludo","criterio":"REQ-F-001-AC2"}]}' > "$nr/evidencias/FASE-0/WF-001-x.narracion.json"
nrun
expect "C-08: narrated without saying its «Se ve» text (the fixed part «Hola,»)" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).map(f=>f.code+" AC"+f.ac).join()')" "C-08 AC2"
printf '{"video":"WF-001-x.webm","narraciones":[{"t":1,"texto":"En la cabecera se ve «Hola, lucia»","criterio":"REQ-F-001-AC2"}]}' > "$nr/evidencias/FASE-0/WF-001-x.narracion.json"
nrun; expect "narration that says what the capture shows: clean" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).length')" 0
node --input-type=module -e 'import { saysPart } from "'"$(dirname "$SDD")"'/lib/captures-lint.mjs"; process.exit(saysPart("Multa (1 día de retraso)", "día(s) de retraso)") && saysPart("3 días de retraso", "día(s) de retraso") && !saysPart("3 dia de retraso", "día(s) de retraso") ? 0 : 1)' \
  && pass "C-08: «día(s)» in the criterion is said as «1 día» or «3 días»" || bad "saysPart (s)"
# global (sin --fase): solo las FASEs con evidencias; un requisito de una FASE aún sin hacer no cuenta (material-montana4)
cat >> "$nr/requirements/REQUIREMENTS.md" <<'MD'
### REQ-F-002: Entregar material
- **Statement:** THE system SHALL deliver
- **Priority:** Must have
- **Verification:** test
- **Acceptance criteria:**
  - GIVEN a booking WHEN the keeper delivers it THEN the user sees "Entregado"
    - Se ve: "Entregado" en Entregas
MD
mkdir -p "$nr/plan/fases"; printf '# FASE-0

**Requisitos:** REQ-F-001

## Demo
' > "$nr/plan/fases/FASE-0-reservar.md"
printf '# FASE-1

**Requisitos:** REQ-F-002

## Demo
' > "$nr/plan/fases/FASE-1-entregar.md"
grun() { rc=0; out=$(cd "$nr" && node "$SDD" lint --captures --json 2>&1) || rc=$?; }
grun; expect "global: a criterion of a FASE without evidence yet is not «not narrated»" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).map(f=>f.req).join()')" ""
mkdir -p "$nr/evidencias/FASE-1"; printf '{"criterio":"REQ-F-002-AC1","imagen":"x.png","narrado":null}' > "$nr/evidencias/FASE-1/REQ-F-002-AC1.json"
grun; expect "global: once that FASE has evidence, its criterion counts" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).map(f=>f.code+" "+f.req).join()')" "C-07 REQ-F-002"
rm -rf "$nr/evidencias/FASE-1" "$nr/plan"
printf '# P\n\n## SDD Stack Profile\n\n- narration: off\n' > "$nr/CLAUDE.md"; rm "$nr/evidencias/FASE-0/WF-001-x.narracion.json"
nrun; expect "narration: off → no C-07/C-08" "$(js 'j.findings.filter(f=>/C-0[78]/.test(f.code)).length')" 0

[ "$fail" = 0 ] && echo "tests/captures: all passed"
exit $fail
