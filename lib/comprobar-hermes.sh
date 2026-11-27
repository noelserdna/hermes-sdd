#!/usr/bin/env bash
# ¿Sigue el Hermes instalado ofreciendo lo que el plugin usa sin ser API pública? Hermes publica a menudo (de 0.21.6 a
# 0.23.1 en un mes) y estas piezas pueden cambiar sin aviso: al actualizar, esto lo dice antes de que falle una puerta.
# Lo corren instalar.sh (aviso) y la batería (tests/hermes-interno.sh). Sale 1 si algo falta; sin Hermes, 0 («no se
# sabe»).
#
#   lib/comprobar-hermes.sh [--plugin <dir>]
#   lib/comprobar-hermes.sh --probada      versión y commit de Hermes con los que se ha probado el arnés (el CI instala esa)
set -uo pipefail
# La versión probada: la que corre el arnés en el Mac desde el 10-nov y con la que pasó la batería. Al subirla, que sea
# tras una batería en verde con la nueva (el CI la instala por este commit, no por el tag, que podría moverse).
HERMES_PROBADA=v0.23.1
HERMES_PROBADA_COMMIT=3b421578588243f920886e6fe79a6faa87ea026e
[ "${1:-}" = --probada ] && { echo "$HERMES_PROBADA $HERMES_PROBADA_COMMIT"; exit 0; }
PLUGIN="$(cd "$(dirname "$0")/.." && pwd)/plugin/hermes-sdd"
[ "${1:-}" = --plugin ] && PLUGIN=$2
command -v hermes >/dev/null || { echo "SIN HERMES: no se comprueba"; exit 0; }
SRC=${HERMES_AGENT_DIR:-$HOME/.hermes/hermes-agent}
mal=0
chk() {  # chk <qué> <orden que sale 0 si está>
  if eval "$2" >/dev/null 2>&1; then echo "ok    $1"; else echo "FALTA $1"; mal=1; fi
}
# 1. El manifiesto y la carga del plugin, como los valida Hermes
chk "hermes plugins validate" "hermes plugins validate '$PLUGIN' --json | jq -e '.ok == true'"
# 2. Opciones de la CLI que no están en la documentación de Hermes
chk "kanban create --initial-status (puertas como tarjetas bloqueadas)" "hermes kanban create --help | grep -q -- --initial-status"
chk "cron create --monitor-script (vigía del encargado)" "hermes cron create --help | grep -q -- --monitor-script"
chk "cron edit --monitor-script" "hermes cron edit --help | grep -q -- --monitor-script"
# 3. Internos que lee el código del plugin (si cambian de nombre, el panel daría 403 o el bucle no sabría dónde corre)
if [ -d "$SRC" ]; then
  chk "web_server: request.state.session / native_http_principal / app.state.auth_required (identidad del panel)" \
    "grep -q 'request.state, \"native_http_principal\"' '$SRC/hermes_cli/web_server.py' && grep -q 'auth_required' '$SRC/hermes_cli/web_server.py' && grep -rq 'state.session' '$SRC/hermes_cli/'"
  chk "observability.shared_metrics_process._STATE (¿corre en el gateway?)" \
    "grep -q '^_STATE' '$SRC/hermes_cli/observability/shared_metrics_process.py'"
fi
exit $mal
