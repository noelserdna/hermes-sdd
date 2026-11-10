#!/usr/bin/env bash
# Requisitos antes de su puerta: el lint del método los lee y la puerta de un cambio se abre, sin LLM ni kanban.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SDD="$ROOT/metodo/scripts/sdd.mjs"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }

R="$T/repo"; cp -R "$ROOT/metodo/examples/todo-app" "$R"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
printf ".sdd/\n" >> .gitignore
git add -A && git commit -qm "chore: toy project" && git tag -a requirements-v1.0 -m "v1.0"

# 1. el ejemplo del método pasa el lint de requisitos
node "$SDD" lint --needs >/dev/null 2>&1 && ok "los criterios '- GIVEN …' se leen" || bad "el ejemplo no pasa lint --needs"

# 2. criterios con prefijo "- AC1: GIVEN …": el método no los cuenta y el lint lo dice (antes la puerta los dejaba pasar)
cp requirements/REQUIREMENTS.md "$T/R.md"
awk '/^### REQ-/{n=0} /^  - GIVEN/{n++; sub(/^  - GIVEN/, "  - AC" n ": GIVEN")} {print}' "$T/R.md" > requirements/REQUIREMENTS.md
out=$(node "$SDD" lint --needs 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "no-criteria" && echo "$out" | grep -q 'drop the "ACn:" prefix' \
  && ok "criterios con prefijo ACn: error no-criteria con la pista" || bad "prefijo ACn: rc=$rc $(echo "$out" | tail -2)"
cp "$T/R.md" requirements/REQUIREMENTS.md

# 3. la puerta de un cambio que solo modifica criterios (no añade ni quita REQ) se abre
mkdir -p intent .sdd/hermes
printf '# INT-001\n\n> que el título admita 120 caracteres\n' > intent/INT-001.md; echo INT-001 > .sdd/hermes/cambio-actual
sed -i.bak -E 's/^> \*\*Version:\*\* *1\.0/> **Version:** 1.1/' requirements/REQUIREMENTS.md && rm -f requirements/REQUIREMENTS.md.bak
awk '!d && /^  - GIVEN/{sub(/THEN/, "THEN (v1.1)"); d=1} {print}' requirements/REQUIREMENTS.md > "$T/R2.md" && cp "$T/R2.md" requirements/REQUIREMENTS.md
git add -A && git commit -qm "docs(requirements): v1.1"
out=$(bash "$ROOT/puerta.sh" "$R" requisitos 2>&1); rc=$?
id=$(echo "$out" | tail -1)
[ $rc -eq 0 ] && [ -f ".sdd/hermes/puertas/$id.json" ] \
  && jq -r .texto ".sdd/hermes/puertas/$id.json" | grep -q "criterios modificados" \
  && ok "puerta de cambio sin REQ nuevos: se abre y lo explica" || bad "puerta de cambio: rc=$rc $out"
exit $fail
