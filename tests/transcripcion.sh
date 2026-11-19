#!/usr/bin/env bash
# hsdd_transcripcion.py: de la transcripción de una sesión de etapa (stream-json de Claude Code, la que guarda la caja),
# qué ficheros leyó y cuánto, por carpeta del método, y cuántas veces buscó. Para medir, nunca para decidir.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/repo/.sdd/hermes/runs"
python3 - "$T/repo/.sdd/hermes/runs/20261119-100000-implementar-1.transcripcion.jsonl" <<'PY'
import json, sys
def a(*usos): return {"type": "assistant", "message": {"usage": {"input_tokens": 10, "output_tokens": 5}, "content": [{"type": "tool_use", "id": i, "name": n, "input": x} for i, n, x in usos]}}
def r(i, texto): return {"type": "user", "message": {"content": [{"type": "tool_result", "tool_use_id": i, "content": texto}]}}
L = [a(("1", "Read", {"file_path": "/proyecto/spec/use-cases/UC-001.md"})), r("1", "x" * 3000),
     a(("2", "Grep", {"pattern": "REQ-F-004"}), ("3", "Bash", {"command": "cat requirements/REQUIREMENTS.md | head -50"})), r("3", "y" * 2000),
     a(("4", "Read", {"file_path": "/proyecto/spec/use-cases/UC-001.md"})), r("4", "x" * 3000),
     a(("5", "Bash", {"command": "find spec -name '*.md'"})),
     {"type": "result", "num_turns": 4, "total_cost_usd": 0.1, "duration_ms": 1000, "is_error": False}]
open(sys.argv[1], "w").write("\n".join(json.dumps(x) for x in L))
PY
gzip "$T/repo/.sdd/hermes/runs/"*.jsonl
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_transcripcion.py" proyecto "$T/repo" --json)
echo "$o" | jq -e '.[0] | .etapa == "implementar-1" and .mensajes == 4 and .busquedas == 2 and .lecturas == 3
  and .por_carpeta.spec == {"ficheros": 1, "lecturas": 2, "caracteres": 6000} and .por_carpeta.requirements.caracteres == 2000
  and .herramientas.Read == 2 and .resultado.num_turns == 4' >/dev/null \
  && ok "resumen: lecturas por carpeta (Read y cat), búsquedas (Grep y find) y el resultado de la sesión" || bad "resumen: $o"
[ $fail = 0 ] && echo "tests/transcripcion.sh: all passed"
exit $fail
