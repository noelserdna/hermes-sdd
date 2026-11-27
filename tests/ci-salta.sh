#!/usr/bin/env bash
# En CI, un SALTA de tests/simulador.sh o de tests/cadena.sh no es un verde: son las dos únicas pruebas de cadena
# (kanban real y banco de proyectos reales). El CI de f0290a7 llevaba el simulador saltado en los dos sistemas y nadie
# lo veía (análisis 11). Fuera de CI (un portátil sin hermes) un SALTA sigue siendo solo un aviso.
# La excepción se declara, no se calla: SDD_CI_SALTA_AVISO="tests/<prueba>.sh" deja ese SALTA como aviso visible
# (::warning:: y resumen del job). El simulador la tuvo hasta T1 (27-nov), cuando el CI pasó a instalar Hermes.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
# sin la lista acotada, todo.sh correría la batería entera seis veces: se dice y no se lanza
grep -q 'SDD_TODO_SOLO' "$ROOT/tests/todo.sh" || { bad "tests/todo.sh no admite SDD_TODO_SOLO: no se puede probar qué hace con un SALTA"; exit 1; }
mkdir -p "$T/tests"
# lo que dice de verdad el simulador sin hermes (tests/simulador.sh:14; log del CI de f0290a7)
salta='echo "SKIP sin hermes: el simulador usa el kanban real"; exit 0'
for t in simulador cadena otra; do echo "$salta" > "$T/tests/$t.sh"; done
echo 'echo "ok   uno"' > "$T/tests/bien.sh"
todo() { (cd "$T" && env -u CI -u GITHUB_ACTIONS -u GITHUB_STEP_SUMMARY -u SDD_CI_SALTA_AVISO "$@" SDD_TODO_SOLO="$T/tests/bien.sh $T/tests/$P.sh" bash "$ROOT/tests/todo.sh" 2>&1); }

P=simulador; out=$(todo); rc=$?
[ $rc = 0 ] && echo "$out" | grep -q 'SALTA: sin hermes' && ok "fuera de CI, un SALTA del simulador es un aviso" || bad "fuera de CI: rc=$rc $out"
out=$(todo CI=true); rc=$?
[ $rc != 0 ] && echo "$out" | grep -q 'simulador.sh.*FALLA.*SALTA' && ok "en CI, un SALTA del simulador cuenta como fallo" || bad "CI simulador: rc=$rc $out"
P=cadena; out=$(todo CI=true); rc=$?
[ $rc != 0 ] && echo "$out" | grep -q 'cadena.sh.*FALLA.*SALTA' && ok "en CI, un SALTA de la cadena cuenta como fallo" || bad "CI cadena: rc=$rc $out"
P=otra; out=$(todo CI=true); rc=$?
[ $rc = 0 ] && echo "$out" | grep -q 'SALTA' && ok "en CI, el SALTA de otra prueba sigue siendo un aviso" || bad "CI otra: rc=$rc $out"
# la excepción declarada: no falla, pero se ve (anotación de GitHub y resumen del job)
P=simulador; out=$(todo CI=true GITHUB_STEP_SUMMARY="$T/resumen.md" SDD_CI_SALTA_AVISO="tests/simulador.sh"); rc=$?
[ $rc = 0 ] && echo "$out" | grep -q '^::warning.*simulador.sh.*sin hermes' && grep -q 'simulador.sh.*sin hermes' "$T/resumen.md" 2>/dev/null \
  && ok "la excepción declarada no falla y deja el aviso en el resumen del CI" || bad "excepción: rc=$rc $out / $(cat "$T/resumen.md" 2>/dev/null)"
P=cadena; out=$(todo CI=true GITHUB_STEP_SUMMARY="$T/resumen.md" SDD_CI_SALTA_AVISO="tests/simulador.sh"); rc=$?
[ $rc != 0 ] && ok "la excepción vale solo para la prueba que nombra" || bad "excepción de más: rc=$rc $out"
# y el CI instala Hermes de verdad (decidido el 25-nov: no un doble del kanban), en la versión que el arnés da por
# probada, fijada a su commit; sin excepción para el simulador: desde entonces su SALTA en CI es un fallo
W="$ROOT/.github/workflows/tests.yml"
! grep -q 'SDD_CI_SALTA_AVISO:.*simulador' "$W" && ok "el workflow ya no exime al simulador" || bad "tests.yml sigue eximiendo al simulador (SDD_CI_SALTA_AVISO)"
read -r v c < <(bash "$ROOT/lib/comprobar-hermes.sh" --probada 2>/dev/null)
echo "${v:-}" | grep -qE '^v[0-9]+\.[0-9]+\.[0-9]+$' && echo "${c:-}" | grep -qE '^[0-9a-f]{40}$' \
  && ok "lib/comprobar-hermes.sh --probada dice versión y commit ($v ${c:0:8})" || bad "comprobar-hermes.sh --probada: «${v:-} ${c:-}»"
I="$ROOT/.github/scripts/instalar-hermes.sh"
grep -q 'instalar-hermes.sh' "$W" && [ -f "$I" ] && grep -q 'comprobar-hermes.sh" --probada' "$I" && grep -q 'uv sync --frozen' "$I" \
  && ok "el workflow instala Hermes fijado (versión de comprobar-hermes, dependencias de su uv.lock)" || bad "el workflow no instala Hermes fijado"
exit $fail
