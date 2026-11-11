#!/usr/bin/env bash
# Encargado, fase 1 (lee y conversa): su guardia (encargado/guardia.py) solo deja leer y escribir en su wiki.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/proyecto"; mkdir -p "$R/wiki" "$R/src"
mkdir -p "$T/arnes/0.9.9/plugin/hermes-sdd" "$T/arnes/0.9.9/metodo/scripts"; ln -s "$T/arnes/0.9.9" "$T/arnes/actual"
A="$T/arnes/actual"; G="$ROOT/encargado/guardia.py"

t() { printf '%s' "$2" | python3 -I "$G" "$R" "$A" >/dev/null 2>&1; rc=$?
      [ "$rc" = "$1" ] && ok "$3" || bad "$3 (salió $rc, esperaba $1)"; }
c() { jq -nc --arg c "$1" '{tool_name:"terminal",tool_input:{command:$c}}'; }
w() { jq -nc --arg t "$1" --arg p "$2" '{tool_name:$t,tool_input:{path:$p,content:"x"}}'; }

# lee
t 0 "$(c 'git log --oneline -5')" "permite: git log"
t 0 "$(c 'cat requirements/REQUIREMENTS.md | grep REQ-F | head')" "permite: cat | grep | head"
t 0 "$(c "python3 $A/plugin/hermes-sdd/hsdd_proyectos.py estado $R --json")" "permite: hsdd_proyectos.py estado del arnés"
t 0 "$(c "node $A/metodo/scripts/sdd.mjs gate --fase 1 --md")" "permite: sdd gate"
t 0 "$(c 'git tag -l')" "permite: git tag -l"
t 0 "$(c 'ls 2>/dev/null; git status 2>&1 | head')" "permite: 2>/dev/null y 2>&1"
# escribe en su wiki (un repositorio git propio)
t 0 "$(w write_file wiki/concepts/x.md)" "permite: write_file en wiki/"
t 0 "$(c 'git -C wiki add -A && git -C wiki commit -m "x"')" "permite: commit en el wiki"
t 0 "$(c 'cd wiki && git commit -am x')" "permite: cd wiki && git commit"
# nada más
t 2 "$(w write_file src/app.js)" "deniega: write_file en el código"
t 2 "$(w patch wiki/.git/config)" "deniega: patch en wiki/.git"
t 2 "$(w write_file wiki/../requirements/REQUIREMENTS.md)" "deniega: salir del wiki con ../"
t 2 "$(c 'git commit -am x')" "deniega: commit en el proyecto (cambiaría el HEAD de las puertas)"
t 2 "$(c 'cd .. && git -C wiki commit -m x')" "deniega: wiki relativo tras salir del proyecto"
t 2 "$(c 'git tag fase-9-accepted')" "deniega: crear un tag"
t 2 "$(c 'git -C wiki push')" "deniega: push del wiki"
t 2 "$(c 'echo x > src/a.js')" "deniega: redirección a un fichero"
t 2 "$(c 'cat $(echo x)')" "deniega: sustitución de órdenes"
t 2 "$(c 'rm -rf src')" "deniega: rm"
t 2 "$(c "node $A/metodo/scripts/sdd.mjs accept record demo")" "deniega: accept record"
t 2 "$(c "node $A/metodo/scripts/sdd.mjs accept --report x.md")" "deniega: accept --report"
t 2 "$(c 'cat ~/.hermes/.env')" "deniega: leer ~/.hermes"
t 2 "$(c 'cat .sdd/hermes/decisiones/g1.json')" "deniega: decisiones"
t 2 "$(c "bash $A/lanzar.sh rehacer $R 1")" "deniega: lanzar.sh (fase 1: no actúa)"
t 2 "$(c 'python3 -c "print(1)"')" "deniega: python suelto"
t 2 "$(c "python3 $A/plugin/hermes-sdd/hsdd_nucleo.py")" "deniega: otro script del arnés"
t 2 "$(c 'sed -i s/a/b/ x')" "deniega: sed -i"
t 2 "$(c 'find . -delete')" "deniega: find -delete"
t 2 '{"tool_name":"execute_code","tool_input":{}}' "deniega: execute_code"
t 2 'no es json' "deniega: evento ilegible (fail-closed)"
exit $fail
