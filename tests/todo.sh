#!/usr/bin/env bash
# Todas las pruebas del arnés, sin LLM. Úsalo antes de dar por buena cualquier actualización de Hermes, Claude Code
# o del propio arnés (es el "eval --smoke" del método: cada incidente real acaba aquí como un caso).
cd "$(dirname "$0")/.."
export SDD_JEV=off   # sin red: ningún test manda datos a Jev (la ayuda de la puerta de requisitos se prueba con su resultado simulado)
fail=0
# En CI, un SALTA de las dos pruebas de cadena (simulador: kanban real; cadena: banco de proyectos reales) cuenta como
# fallo: saltadas, el verde no dice nada de la cadena etapa → puerta → notario → tramo. Fuera de CI es un aviso.
# SDD_CI_SALTA_AVISO="tests/simulador.sh" declara una excepción: ese SALTA no falla, pero sale como anotación de
# GitHub y en el resumen del job. SDD_TODO_SOLO="<pruebas>" corre solo esas, sin las suites del método (tests/ci-salta.sh).
TESTS="tests/perfil-agents.sh tests/notario.sh tests/efectos.sh tests/requisitos.sh tests/guard.sh tests/registros.sh tests/supervisor.sh tests/plugin_telegram.sh tests/plugin_bucle.sh tests/plugin_dashboard.sh tests/jev.sh tests/nuevo.sh tests/huecos.sh tests/limpiar.sh tests/rutas.sh tests/cambio.sh tests/encargado.sh tests/preparar.sh tests/supervisar.sh tests/encargado-destino.sh tests/revision.sh tests/lecciones.sh tests/locale.sh tests/textos.sh tests/ui.sh tests/mantenimiento.sh tests/operacion.sh tests/instalar.sh tests/replay-e2e.sh tests/simulador.sh tests/fidelidad.sh tests/aceptar-incremental.sh tests/encadenado.sh tests/topes.sh tests/desplegable.sh tests/caja-github.sh tests/caja-local.sh tests/caja-token.sh tests/transcripcion.sh tests/wiki.sh tests/hermes-interno.sh tests/metricas.sh tests/transiciones.sh tests/preguntas-json.sh tests/entrega-parcial.sh tests/duras.sh tests/evals.sh tests/cadena.sh tests/ci-salta.sh tests/versiones.sh tests/medir.sh"
salta() {  # salta <prueba> <motivo>: imprime la línea y devuelve 1 si ese SALTA es un fallo
  local b; b=$(basename "$1")
  if [ -z "${CI:-}" ] || { [ "$b" != simulador.sh ] && [ "$b" != cadena.sh ]; }; then echo "SALTA: $2"; return 0; fi
  case " ${SDD_CI_SALTA_AVISO:-} " in *" tests/$b "*)
    echo "SALTA: $2"; echo "::warning title=Prueba de cadena saltada::tests/$b no ha corrido en este CI: $2"
    [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "⚠️ **tests/$b no ha corrido** (excepción declarada en SDD_CI_SALTA_AVISO): $2" >> "$GITHUB_STEP_SUMMARY"
    return 0 ;;
  esac
  echo "FALLA (SALTA en CI: $2)"; return 1
}
for t in ${SDD_TODO_SOLO:-$TESTS}; do
  printf '%-28s ' "$t"
  if out=$(bash "$t" 2>&1); then n=$(echo "$out" | grep -c '^ok'); if [ "$n" = 0 ] && echo "$out" | grep -q '^SKIP'; then salta "$t" "$(echo "$out" | grep -m1 '^SKIP' | cut -c6-)" || fail=1; else echo "ok ($n casos)"; fi; else echo FALLA; echo "$out" | grep -E 'FAIL|Error' | head -5; fail=1; fi
done
[ -n "${SDD_TODO_SOLO:-}" ] && exit $fail
for s in git acceptance plan tasks route quotes match floor captures stale arch demo; do
  printf '%-28s ' "metodo/tests/$s"
  bash "metodo/tests/$s/run.sh" >/dev/null 2>&1 && echo ok || { echo FALLA; fail=1; }
done
exit $fail
