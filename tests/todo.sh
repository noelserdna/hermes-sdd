#!/usr/bin/env bash
# Todas las pruebas del arnés, sin LLM. Úsalo antes de dar por buena cualquier actualización de Hermes, Claude Code
# o del propio arnés (es el "eval --smoke" del método: cada incidente real acaba aquí como un caso).
cd "$(dirname "$0")/.."
fail=0
for t in tests/perfil-agents.sh tests/notario.sh tests/guard.sh tests/registros.sh tests/supervisor.sh tests/plugin_telegram.sh tests/plugin_dashboard.sh tests/mantenimiento.sh tests/operacion.sh tests/replay-e2e.sh; do
  printf '%-28s ' "$t"
  if out=$(bash "$t" 2>&1); then echo "ok ($(echo "$out" | grep -c '^ok') casos)"; else echo FALLA; echo "$out" | grep -E 'FAIL|Error' | head -5; fail=1; fi
done
for s in git acceptance plan tasks route quotes floor; do
  printf '%-28s ' "metodo/tests/$s"
  bash "metodo/tests/$s/run.sh" >/dev/null 2>&1 && echo ok || { echo FALLA; fail=1; }
done
exit $fail
