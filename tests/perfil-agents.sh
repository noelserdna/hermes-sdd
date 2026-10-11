#!/usr/bin/env bash
# El Stack Profile se lee de AGENTS.md (hermes-sdd), y AGENTS.md tiene prioridad sobre CLAUDE.md.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
leer() { node -e 'import(process.argv[1]).then(m=>console.log(JSON.stringify(m.stackProfileWithSource(process.argv[2]))))' \
  "$ROOT/metodo/scripts/lib/git-log.mjs" "$T"; }
printf '# x\n## SDD Stack Profile\n- test: uv run pytest -q\n' > "$T/AGENTS.md"
printf '# x\n## SDD Stack Profile\n- test: npm test\n' > "$T/CLAUDE.md"
out=$(leer)
echo "$out" | grep -q '"test":"uv run pytest -q"' && echo "ok   AGENTS.md tiene prioridad" || { echo "FAIL $out"; exit 1; }
rm "$T/AGENTS.md"; out=$(leer)
echo "$out" | grep -q '"test":"npm test"' && echo "ok   sin AGENTS.md cae a CLAUDE.md" || { echo "FAIL $out"; exit 1; }
