#!/usr/bin/env bash
# lib/comprobar-hermes.sh: lo que el plugin usa de Hermes sin ser API pública sigue ahí (con el Hermes instalado) y,
# con un Hermes falso al que le falta una opción, lo dice.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
if command -v hermes >/dev/null && [ -d "${HERMES_AGENT_DIR:-$HOME/.hermes/hermes-agent}" ]; then
  o=$(bash "$ROOT/lib/comprobar-hermes.sh"); rc=$?
  [ $rc = 0 ] && ok "el Hermes instalado ofrece todo lo que usa el plugin" || bad "Hermes instalado: $o"
else
  echo "SKIP sin Hermes instalado: solo se prueba con uno falso"
fi
mkdir -p "$T/bin" "$T/src/hermes_cli/observability"
cat > "$T/bin/hermes" <<'H'
#!/usr/bin/env bash
case "$*" in
  "plugins validate"*) echo '{"ok": true}' ;;
  "kanban create --help") echo "usage: --body --json" ;;      # sin --initial-status
  "cron create --help"|"cron edit --help") echo "--monitor-script" ;;
esac
H
chmod +x "$T/bin/hermes"
o=$(PATH="$T/bin:$PATH" HERMES_AGENT_DIR="$T/src" bash "$ROOT/lib/comprobar-hermes.sh"); rc=$?
[ $rc = 1 ] && echo "$o" | grep -q '^FALTA kanban create --initial-status' && echo "$o" | grep -q '^FALTA web_server' \
  && ok "un Hermes sin --initial-status ni la identidad del panel: lo dice y sale 1" || bad "falso: $rc $o"
grep -q '^requires_hermes: ">=0.23"' "$ROOT/plugin/hermes-sdd/plugin.yaml" && ok "plugin.yaml declara la versión mínima de Hermes" || bad "requires_hermes"
exit $fail
