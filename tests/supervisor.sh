#!/usr/bin/env bash
# El supervisor del ejecutor (executors/claude.sh) con un Claude falso: resultado, cuota, error, candado y huérfanos.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'pkill -f "$T" 2>/dev/null; rm -rf "$T"' EXIT
export TMPDIR="$T/"; export CLAUDE_BIN="$ROOT/evals/fake-claude.sh"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
modo() { echo "$1" > "$T/fake-claude-mode"; }
R="$T/repo"; mkdir -p "$R"; git -C "$R" init -q
sup() { bash "$ROOT/executors/claude.sh" "$R" prueba "haz algo" | tail -1; }

modo ok; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = done ] && [ "$(echo "$o" | jq -r .session_id)" = s-1 ] && ok "done con session_id y coste" || bad "ok: $o"
ls "$R/.sdd/hermes/runs/"*-prueba.json >/dev/null 2>&1 && ok "guarda el run en su propio fichero" || bad "sin fichero de run"
modo cuota; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = scheduled ] && [ "$(echo "$o" | jq -r .reset_at)" = 1791800000 ] && ok "cuota → scheduled con reset_at" || bad "cuota: $o"
modo error; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = failed ] && ok "error → failed" || bad "error: $o"
modo sinjson; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = failed ] && echo "$o" | grep -q "no auth" && ok "sin JSON → failed con el motivo" || bad "sinjson: $o"
[ ! -d "$R/.sdd/hermes/lock" ] && ok "libera el candado al terminar" || bad "candado sin liberar"

# Candado: con una ejecución viva, la segunda sale "busy"
modo lento; bash "$ROOT/executors/claude.sh" "$R" larga "x" >/dev/null & S1=$!
sleep 2; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = busy ] && ok "segunda ejecución → busy" || bad "busy: $o"
# Matar el supervisor: el Claude de su grupo no debe quedar huérfano
kill -TERM $S1; sleep 2
pgrep -f "fake-claude.sh" >/dev/null && bad "quedó un Claude huérfano" || ok "al matar el supervisor muere su Claude"
[ ! -d "$R/.sdd/hermes/lock" ] && ok "candado liberado tras matar" || bad "candado tras kill"
# Candado huérfano (pid muerto) no bloquea
mkdir -p "$R/.sdd/hermes/lock"; echo 999999 > "$R/.sdd/hermes/lock/pid"
modo ok; o=$(sup); [ "$(echo "$o" | jq -r .outcome)" = done ] && ok "ignora un candado huérfano" || bad "huérfano: $o"
exit $fail
