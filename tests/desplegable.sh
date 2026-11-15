#!/usr/bin/env bash
# «Hecho» = desplegable (plugin/hermes-sdd/hsdd_desplegable.py): README, `npm start` que responde en PORT y no solo en
# localhost; sin package.json no se sabe (ok null); desactivable por proyecto.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
command -v node >/dev/null && command -v npm >/dev/null || { echo "SKIP sin node/npm"; exit 0; }
D="$ROOT/plugin/hermes-sdd/hsdd_desplegable.py"
app() {  # app <dir> <host del listen>
  mkdir -p "$1/.sdd/hermes"
  cat > "$1/server.js" <<JS
require('http').createServer((q, r) => r.end('hola')).listen(Number(process.env.PORT) || 3000, $2);
JS
  echo '{"name":"x","private":true,"scripts":{"start":"node server.js","test":"true"}}' > "$1/package.json"
  printf '# x\n\n    npm install\n    npm start\n' > "$1/README.md"
}
app "$T/bien" "process.env.HOST || '0.0.0.0'"
o=$(python3 "$D" "$T/bien"); URL=$(jq -r .url <<< "$o")
jq -e '.ok == true and (.hecho | any(test("responde")))' <<< "$o" >/dev/null && ok "app que arranca con npm start en PORT y HOST: desplegable" || bad "bien: $o"
if command -v lsof >/dev/null; then
  app "$T/local" "'127.0.0.1'"
  o=$(python3 "$D" "$T/local")
  jq -e '.ok == false and (.fallos | any(test("solo escucha en localhost")))' <<< "$o" >/dev/null && ok "escucha solo en 127.0.0.1: no desplegable" || bad "local: $o"
fi
app "$T/sinreadme" "'0.0.0.0'"; rm "$T/sinreadme/README.md"
o=$(python3 "$D" "$T/sinreadme")
jq -e '.ok == false and (.fallos | any(test("README")))' <<< "$o" >/dev/null && ok "sin README: no desplegable" || bad "readme: $o"
app "$T/dev" "'0.0.0.0'"; echo '{"scripts":{"dev":"vite","test":"vitest"}}' > "$T/dev/package.json"
o=$(python3 "$D" "$T/dev")
jq -e '.ok == false and (.fallos | any(test("no tiene script «start»")))' <<< "$o" >/dev/null && ok "solo «dev»: no desplegable y dice qué scripts hay" || bad "dev: $o"
app "$T/vite" "'0.0.0.0'"; echo '{"scripts":{"start":"vite","test":"vitest"}}' > "$T/vite/package.json"
o=$(python3 "$D" "$T/vite")
jq -e '.ok == false and (.fallos | any(test("servidor de desarrollo")))' <<< "$o" >/dev/null && ok "start = vite (desarrollo): no desplegable" || bad "vite: $o"
mkdir -p "$T/py"; o=$(python3 "$D" "$T/py")
jq -e '.ok == null' <<< "$o" >/dev/null && ok "sin package.json: no se sabe (ok null)" || bad "py: $o"
echo '{"desplegable": false}' > "$T/vite/.sdd/hermes/hermes-sdd.json"; o=$(python3 "$D" "$T/vite")
jq -e '.ok == null and (.motivo | test("desactivada"))' <<< "$o" >/dev/null && ok "desactivable por proyecto" || bad "desactivada: $o"
# nada se queda escuchando: el grupo de npm start se mata al acabar
sleep 1; ! curl -s -m 2 "$URL" >/dev/null && ok "npm start se detiene al acabar (su puerto ya no responde)" || bad "quedó vivo en $URL"
exit $fail
