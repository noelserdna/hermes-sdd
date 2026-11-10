#!/usr/bin/env bash
# Pestaña SDD: las dos salidas están generadas desde ui/sdd.js, son JavaScript válido y cada sección se pinta bien.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
python3 "$ROOT/plugin/hermes-sdd/ui/construir.py" --comprobar && ok "panel y Desktop generados desde ui/sdd.js" || bad "sin regenerar"
node --check "$ROOT/plugin/hermes-sdd/dashboard/dist/index.js" && ok "dashboard/dist/index.js es JavaScript válido" || bad "index.js"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
cp "$ROOT/plugin/hermes-sdd/desktop/plugin.js" "$T/plugin.mjs"
node --check "$T/plugin.mjs" && ok "desktop/plugin.js es un módulo válido" || bad "plugin.js"
# Desktop solo resuelve @hermes/plugin-sdk y react: cualquier otro import no cargaría
imp=$(grep -oE "from '[^']+'" "$ROOT/plugin/hermes-sdd/desktop/plugin.js" | sort -u | tr '\n' ' ')
[ "$imp" = "from '@hermes/plugin-sdk' from 'react' " ] && ok "Desktop importa solo react y @hermes/plugin-sdk" || bad "imports: $imp"
REACT_DIR=${REACT_DIR:-}
for d in "$HOME/.hermes/hermes-agent/apps/desktop/node_modules" "$HOME/.hermes/hermes-agent/web/node_modules"; do
  [ -z "$REACT_DIR" ] && [ -f "$d/react-dom/server.js" ] && REACT_DIR=$d
done
if [ -n "$REACT_DIR" ]; then
  REACT_DIR="$REACT_DIR" node "$ROOT/tests/ui.mjs" || fail=1
else echo "SKIP render: no encuentro react-dom (REACT_DIR=<node_modules con react y react-dom>)"; fi
exit $fail
