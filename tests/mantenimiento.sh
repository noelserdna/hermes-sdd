#!/usr/bin/env bash
# Mantenimiento por umbrales (vigilar.sh) + puerta de mantenimiento + notario, sin LLM, kanban ni red.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home" HERMES_SDD_SIN_KANBAN=1 HERMES_SDD_SIN_RED=1; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
jq -n --arg u "$USER" '{yo:{nombre:"Ana", rol:"Cliente", canales:{local:$u}}}' > "$HERMES_SDD_HOME/aprobadores.json"

R="$T/repo"; cp -R "$ROOT/metodo/examples/todo-app" "$R"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
printf "pipeline-state.json\n.sdd/\n" >> .gitignore
cat > AGENTS.md <<'A'
## SDD Stack Profile
- test: test ! -f ROTO || { echo "FAIL tests/roto.test.ts"; exit 1; }
- code_paths: src/
- test_paths: tests/
A
git add -A && git commit -qm "chore: proyecto entregado" && git tag entrega-1
GATE_OK=0; node "$ROOT/metodo/scripts/sdd.mjs" gate >/dev/null 2>&1 || GATE_OK=$?

vigilar() { out=$(bash "$ROOT/vigilar.sh" "$R" 2>&1); rc=$?; }
decidir() { bash "$ROOT/decidir.sh" "$1" "$2" "${3:-}" 2>&1; }
claves() { jq -r '.hallazgos[].clave' ".sdd/hermes/puertas/$1.json" | cut -d: -f1 | sort | tr '\n' ' '; }

# 0. el ejemplo no tiene la puerta de calidad global cumplida: primer hallazgo, que se ignora con motivo
vigilar
if [ "$GATE_OK" = 0 ] || [ "$GATE_OK" = 3 ]; then
  echo "$out" | grep -q "sin hallazgos nuevos" && ok "proyecto sano: sin hallazgos" || bad "sano: $out"
else
  G0=$(echo "$out" | tail -1)
  [ "$(claves "$G0")" = "gate " ] && ok "gate global incumplido → puerta de mantenimiento" || bad "gate: $out"
  r=$(decidir "$G0" ignoro); echo "$r" | grep -q "necesita un texto" && ok "ignorar exige motivo" || bad "ignorar sin motivo: $r"
  rm -f "$HERMES_SDD_HOME/actas/local/$G0.json"
  decidir "$G0" ignoro "es el ejemplo del curso" >/dev/null && ok "ignorado con motivo" || bad "ignorar"
  vigilar; echo "$out" | grep -q "sin hallazgos nuevos" && ok "lo ignorado no vuelve a preguntarse" || bad "repite: $out"
fi

# 1. deriva + tests rojos: alguien cambia código sin pasar por el método
mkdir -p src; echo "export const x = 1;" > src/atajo.ts; touch ROTO; git add -A && git commit -qm "hotfix rápido"
vigilar; G1=$(echo "$out" | tail -1)
[ "$(claves "$G1")" = "deriva tests " ] && ok "detecta deriva y tests rojos ($(claves "$G1"))" || bad "deriva/tests: $out"
jq -r .texto ".sdd/hermes/puertas/$G1.json" | grep -q "hotfix rápido" && ok "la puerta enseña los commits fuera del método" || bad "texto"
vigilar; echo "$out" | grep -q "ya hay una puerta de mantenimiento abierta" && ok "no apila puertas" || bad "apila: $out"

# 2. lanzar el cambio: la petición sale de lo que la persona vio, más su comentario; queda en el diario
r=$(decidir "$G1" cambio "y añade un test del atajo") || true
P=".sdd/hermes/mantenimiento/peticion-$G1.txt"
[ -f "$P" ] && grep -q "commit(s) de código fuera del método" "$P" && grep -q "Los tests fallan" "$P" \
  && grep -q "añade un test del atajo" "$P" && ok "la petición del cambio recoge hallazgos y comentario" || bad "petición: $r"
grep -q '"stage":"maintenance"' status/journal.jsonl && ok "decisión de mantenimiento en el diario" || bad "diario"
git log -1 --format=%B | grep -q "Gate-Id: $G1" && ok "commit del notario con Gate-Id" || bad "commit"
exit $fail
