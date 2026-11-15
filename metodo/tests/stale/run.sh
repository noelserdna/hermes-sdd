#!/usr/bin/env bash
# Tests of what keeps the documents honest after the club run (Hermes, 11/2026: 144.000 words of documents for 3.070
# lines of code, six documents with texts a change had replaced, 79 questions outside git, an evidence report whose
# images did not travel with the tag): `sdd lint --stale` (S-01 old quoted text, S-02 nonexistent REQ/UC id, the
# «Desfasado por INT-…» mark), `sdd questions sync|list|view` and the copy made by `journal add --by`, the evidence
# manifest written by `sdd accept --report`, `sdd trace matrix`, and the twins (skills and references that restate the
# question format and the capture helper say the same thing). bash 3.2 and 5; needs git, node >= 18.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SDD="$ROOT/scripts/sdd.mjs"
fail=0
pass() { echo "ok   $1"; }
bad()  { echo "FAIL $1"; fail=1; }
contains() { case "$1" in *"$2"*) return 0 ;; *) return 1 ;; esac; }
run() { rc=0; out=$(cd "$repo" && node "$SDD" "$@" 2>&1) || rc=$?; }
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
commit() { ( cd "$repo" && git add -A && git commit -q --allow-empty -m "$1" ); }

# ---------------------------------------------------------------- 1. lint --stale
repo="$tmp/club"; mkdir -p "$repo/requirements" "$repo/ux" "$repo/plan/fases" "$repo/spec/use-cases" "$repo/test" "$repo/spec"
( cd "$repo" && git init -q -b main )
cat > "$repo/requirements/REQUIREMENTS.md" <<'MD'
# Requisitos

### REQ-F-001: Apuntarse a una clase
- **Statement:** WHEN un socio se apunta THE SYSTEM SHALL reservarle plaza
- **Acceptance Criteria:**
  - GIVEN "Iniciación" tiene 3 socios WHEN "lucia" se apunta THEN el usuario ve "Estás apuntada a Iniciación"
    - Se ve: "Estás apuntada a Iniciación" en Clases
MD
commit "docs(requirements): v1"
sed -i.bak 's/Estás apuntada a Iniciación/Te has apuntado a Iniciación/g' "$repo/requirements/REQUIREMENTS.md"; rm -f "$repo/requirements/REQUIREMENTS.md.bak"
commit "docs(requirements): INT-004"
printf '# Wireframes\n\nTras apuntarse se lee «Estás apuntada a Iniciación».\nEl texto nuevo: "Te has apuntado a Iniciación".\n' > "$repo/ux/WIREFRAMES.md"
printf '# FASE-1: Clases\n\nRequisitos: REQ-F-001, REQ-F-009\nCasos: UC-001, UC-023\n' > "$repo/plan/fases/FASE-1-CLASES.md"
printf "# UC-001: Apuntarse\nRefs: REQ-F-001\n" > "$repo/spec/use-cases/UC-001.md"
printf '> Desfasado por INT-004\n\n# Matriz\n\n| T01 | "Estás apuntada a Iniciación" |\n' > "$repo/test/TEST-MATRIX-UC-001.md"
printf '# E2E\n\nPaso 3: "Estás apuntada a Iniciación" (Desfasado por INT-004: lo corrige la FASE-2)\n' > "$repo/test/E2E-SCENARIOS.md"
printf '# Changelog\n\n- INT-004: "Estás apuntada a Iniciación" pasa a otro texto\n' > "$repo/spec/CHANGELOG.md"
run lint --stale --json
expect "lint --stale exits 1 with findings" "$rc" 1
expect "S-01: the wireframe still quotes the replaced text" "$(js 'j.findings.filter(f=>f.code==="S-01").map(f=>f.file+":"+f.line).join()')" "ux/WIREFRAMES.md:3"
expect "S-02: REQ-F-009 and UC-023 do not exist (REQ-F-001 and UC-001 do)" "$(js 'j.findings.filter(f=>f.code==="S-02").map(f=>f.id).sort().join()')" "REQ-F-009,UC-023"
expect "a document marked «Desfasado por INT-004» is listed, not checked" "$(js 'j.marked.map(m=>m.file+"="+m.by).join()')" "test/TEST-MATRIX-UC-001.md=INT-004"
expect "the mark on one line silences that line; CHANGELOGs are history" "$(js 'j.findings.filter(f=>/E2E|CHANGELOG/.test(f.file)).length')" 0
expect "the current text is never stale" "$(js 'j.findings.filter(f=>/Te has apuntado/.test(f.text||"")).length')" 0
run lint --stale
has "plain output names file, line and code" "ux/WIREFRAMES.md:3 S-01"
has "and the mark" "marked test/TEST-MATRIX-UC-001.md: INT-004"
printf '# Wireframes\n\nTras apuntarse se lee «Te has apuntado a Iniciación».\n' > "$repo/ux/WIREFRAMES.md"
printf '# FASE-1: Clases\n\nRequisitos: REQ-F-001\nCasos: UC-001\n' > "$repo/plan/fases/FASE-1-CLASES.md"
run lint --stale
expect "updated documents: exit 0" "$rc" 0

# ---------------------------------------------------------------- 2. questions: versioned copy and generated view
mkdir -p "$repo/.sdd" "$repo/status"
cat > "$repo/.sdd/questions-task-implementer.md" <<'MD'
# Questions — task-implementer

## Q-task-implementer-001 [ANSWERED] skill=sdd-task-implementer context=TASK-F1-002
Question: The capacity check runs before or after the waitlist?
Para el cliente: ¿Si la clase está llena, se apunta a la lista de espera?
Options:
  A) Waitlist (recommended)
     efecto: accion
  B) Refuse
     efecto: ninguno
Blocks: TASK-F1-002
Answer: A — elegida por Ana (2026-11-10T10:00:00Z)

## Q-task-implementer-002 [OPEN] skill=sdd-task-implementer context=TASK-F1-004
Question: Log denied zones too?
Para el cliente: ¿El registro apunta también los intentos en zonas que no son de la junta?
Options:
  A) Yes (recommended)
     efecto: editar-test tests/integration/accesos.test.js
  B) No
     efecto: ninguno
Blocks: TASK-F1-004
Answer:
MD
run journal add --stage task-implementer --kind done --text "Construida la entrega 1"
[ ! -e "$repo/status/questions" ] && pass "journal add without --by (a stage) copies nothing" || bad "a stage's journal line copied the questions"
run journal add --stage acceptance --kind decision --text "Ana respondió" --by "Ana (club)"
cmp -s "$repo/.sdd/questions-task-implementer.md" "$repo/status/questions/questions-task-implementer.md" \
  && pass "journal add --by copies .sdd/questions-*.md into status/questions/ (versioned)" || bad "no versioned copy"
before=$(ls -l "$repo/status/questions/questions-task-implementer.md")
run questions sync
has "sync with nothing new rewrites nothing" "already up to date"
run questions list --open --json
expect "list --open reads the open ones" "$(js 'j.questions.map(q=>q.id+"|"+q.options[0].effect).join()')" "Q-task-implementer-002|editar-test tests/integration/accesos.test.js"
mv "$repo/.sdd" "$repo/.sdd.off"
run questions list --json
expect "a clone without .sdd/ reads the versioned copy" "$(js 'j.from+"|"+j.questions.length')" "status/questions|2"
mv "$repo/.sdd.off" "$repo/.sdd"
run questions view
has "view: pending, with the customer's sentence" "| Q-task-implementer-002 | ¿El registro apunta también"
has "view: decided, with the answer" "| Q-task-implementer-001 | ¿Si la clase está llena, se apunta a la lista de espera? | A — elegida por Ana"
printf '# Reglas\n\nRN-004 [NEEDS CLARIFICATION: ¿cuántas plazas tiene la lista de espera?]\n' > "$repo/spec/RULES.md"
printf '# Clarifications pending\n\n- [NEEDS CLARIFICATION: ya resuelta hace semanas]\n' > "$repo/spec/CLARIFICATIONS-PENDING.md"
run questions view
has "view: the markers still in spec/ (what CLARIFICATIONS-PENDING should list)" '`spec/RULES.md:3` RN-004 [NEEDS CLARIFICATION'
hasnt "view: never the hand-written list itself" "ya resuelta hace semanas"
rm -f "$repo/spec/RULES.md" "$repo/spec/CLARIFICATIONS-PENDING.md"
( cd "$repo" && git check-ignore -q status/questions/questions-task-implementer.md ) && bad "status/questions is ignored" || pass "status/questions/ is not ignored"

# ---------------------------------------------------------------- 3. evidence manifest
mkdir -p "$repo/evidencias/FASE-1" "$repo/acceptance"
printf 'png-1' > "$repo/evidencias/FASE-1/REQ-F-001-AC1.png"
printf 'vid' > "$repo/evidencias/FASE-1/WF-001.webm"
printf other > "$repo/evidencias/notas.png"
commit "base"
run accept --fase 1 --report acceptance/ACCEPTANCE-REPORT.md
m="$repo/acceptance/evidence-manifest-FASE-1.json"
[ -f "$m" ] && pass "accept --report --fase 1 writes acceptance/evidence-manifest-FASE-1.json" || bad "no manifest ($out)"
out=$(cat "$m")
expect "manifest: every file of evidencias/FASE-1 with sha256 and size" "$(js 'j.files.map(f=>f.path+"|"+f.bytes+"|"+f.sha256.slice(0,7)).join()')" "evidencias/FASE-1/REQ-F-001-AC1.png|5|sha256:,evidencias/FASE-1/WF-001.webm|3|sha256:"
expect "manifest: kinds and the criteria the ledger bound" "$(js 'j.files.map(f=>f.kind+":"+f.criteria.join("+")).join()')" "image:REQ-F-001 AC1,video:"
expect "manifest: hash of the real bytes" "$(js 'j.files[0].sha256')" "sha256:$(printf 'png-1' | shasum -a 256 | cut -d' ' -f1)"
grep -q 'evidence-manifest-FASE-1.json' "$repo/acceptance/ACCEPTANCE-REPORT.md" && pass "the report names its manifest" || bad "report without manifest line"
( cd "$repo" && git check-ignore -q acceptance/evidence-manifest-FASE-1.json ) && bad "manifest ignored" || pass "the manifest is versioned (not ignored)"
cp "$m" "$tmp/m1"; run accept --fase 1 --report acceptance/ACCEPTANCE-REPORT.md
cmp -s "$m" "$tmp/m1" && pass "same evidence, same bytes (no timestamps)" || bad "manifest changed between two runs"
run accept record waiver --req REQ-F-001 --reason x --follow-up "#1" --by Ana --role cliente
[ "$(ls "$repo/acceptance" | grep -c manifest)" = 1 ] && pass "accept subcommands write no manifest" || bad "a subcommand wrote a manifest"
[ "$(grep -c '"path":' "$m")" = 2 ] && [ "$(wc -l < "$m" | tr -d ' ')" -le 12 ] && pass "one line per file (taller: 1 882 lines for 222 files)" || bad "manifest not one line per file: $(cat "$m")"
# Without --fase and with every file in one FASE's manifest (a project of one FASE): no -all.json that repeats it
mv "$repo/evidencias/notas.png" "$tmp/notas.png"
run accept --fase 1 --report acceptance/ACCEPTANCE-REPORT.md
run accept --report acceptance/ACCEPTANCE-REPORT.md
[ ! -f "$repo/acceptance/evidence-manifest-all.json" ] && pass "one FASE: no evidence-manifest-all.json repeating FASE-1's" || bad "duplicated manifest: $(ls "$repo/acceptance")"
tail -1 "$repo/acceptance/ACCEPTANCE-REPORT.md" | grep -q 'evidence-manifest-FASE-1.json' && pass "…and the report names the FASE manifest" || bad "report: $(tail -1 "$repo/acceptance/ACCEPTANCE-REPORT.md")"
mv "$tmp/notas.png" "$repo/evidencias/notas.png"
run accept --report acceptance/ACCEPTANCE-REPORT.md
[ -f "$repo/acceptance/evidence-manifest-all.json" ] && pass "evidence outside the FASE: evidence-manifest-all.json is written" || bad "no -all manifest with extra evidence ($out)"
rm -f "$repo/acceptance/evidence-manifest-all.json"

# ---------------------------------------------------------------- 4. trace matrix
mkdir -p "$repo/task" "$repo/tests"
printf '# Tasks\n\n- [x] TASK-F1-001 Apuntarse | `src/a.js`\n  - **Refs:** REQ-F-001\n' > "$repo/task/TASK-FASE-1.md"
printf "// REQ-F-001 AC1\n" > "$repo/tests/a.test.js"
commit "feat: apuntarse

Refs: REQ-F-001"
run trace matrix --out spec/TRACEABILITY-MATRIX.md
has "trace matrix --out writes the file" "written to spec/TRACEABILITY-MATRIX.md"
row=$(grep '^| REQ-F-001 ' "$repo/spec/TRACEABILITY-MATRIX.md" || true)
expect "row: spec UC-001, FASE-1, its task, its test and its commit" "$row" "| REQ-F-001 | UC-001 | FASE-1 | TASK-F1-001 | 1 file(s) | 1 |"
grep -q 'Do not edit by hand' "$repo/spec/TRACEABILITY-MATRIX.md" && pass "it says it is generated" || bad "no generated notice"

# ---------------------------------------------------------------- 5. twins: the question format and the capture helper
M="$ROOT"
for f in "$M/skills/sdd-task-implementer/SKILL.md" "$M/references/modo-arnes.md"; do
  for w in "Para el cliente:" "efecto:" "editar-test" "test-edit"; do
    grep -qF "$w" "$f" || bad "$(basename "$(dirname "$f")")/$(basename "$f") does not restate «${w}» of async-questions.md"
  done
done
pass "the implementer and modo-arnes restate the question format (Para el cliente, efecto, editar-test, test-edit)"
for w in "req-change" "editar-test FILE" "endurecer-test FILE" "accion" "ninguno"; do grep -qF "$w" "$M/references/async-questions.md" || bad "async-questions.md lost «${w}»"; done
grep -qF "efecto: A=<ninguno|accion|req-change|editar-test FILE...|endurecer-test FILE...>" "$M/skills/sdd-task-implementer/SKILL.md" \
  && pass "the PAUSE shape lists the same effects as async-questions.md" || bad "PAUSE effects differ"
sig='export async function captura(page: Page, testInfo: TestInfo, criterion: string, { ve = [] as string[] } = {})'
grep -qF "$sig" "$M/skills/sdd-task-implementer/references/construction-protocol.md" && pass "the capture helper keeps its signature" || bad "captura signature changed"
bad_imports=$(grep -rln "import {[^}]*captureCriterion" "$M/skills" || true)
[ -z "$bad_imports" ] && pass "no skill imports the old captureCriterion name" || bad "old import in: $bad_imports"
calls=$(grep -rhoE "captura\(page, testInfo, '[^']+'(, \{ ve: \[)?" "$M/skills" | grep -vc "{ ve: \[" || true)
expect "every captura(...) example passes its { ve }" "$calls" 0
for f in "$M/skills/sdd-task-implementer/SKILL.md" "$M/skills/sdd-task-implementer/references/tdd-workflow.md"; do
  grep -qF "lint --captures" "$f" || bad "$(basename "$f") does not run sdd lint --captures"
done
pass "the implementer runs sdd lint --captures"
d=""; for f in "$M"/references/*.md; do b=$(basename "$f"); t="$M/../docs/metodo/$b"; [ -f "$t" ] && { cmp -s "$f" "$t" || d="$d $b"; }; done
[ -z "$d" ] && pass "every reference copied to docs/metodo/ is identical" || bad "docs/metodo/ twins differ:$d"

[ "$fail" = 0 ] && echo "tests/stale: all passed"
exit $fail
