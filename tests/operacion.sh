#!/usr/bin/env bash
# Operación: pausa, cuota agotada y anulación de una aceptación (sobre una práctica reproducida, sin LLM).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home" HERMES_SDD_SIN_KANBAN=1; mkdir -p "$HERMES_SDD_HOME"
jq -n --arg u "$USER" '{yo:{nombre:"Alumna", rol:"Cliente", canales:{local:$u, telegram:"111"}}}' > "$HERMES_SDD_HOME/aprobadores.json"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/practica"; bash "$ROOT/practicar.sh" "$ROOT/grabaciones/todo-app" "$R" --sin-kanban >/dev/null
git -C "$R" config user.email a@a; git -C "$R" config user.name Alumna
B=$(basename "$R" | tr '[:upper:]' '[:lower:]')
outcome() { bash "$ROOT/etapa.sh" "$R" "$@" | tail -1; }

mkdir -p "$HERMES_SDD_HOME/pausa"; touch "$HERMES_SDD_HOME/pausa/$B"
o=$(outcome plan); [ "$(echo "$o" | jq -r .outcome)" = scheduled ] && ok "proyecto en pausa → la etapa se aparca" || bad "pausa: $o"
rm "$HERMES_SDD_HOME/pausa/$B"; touch "$HERMES_SDD_HOME/pausa/_todo"
o=$(outcome plan); [ "$(echo "$o" | jq -r .outcome)" = scheduled ] && ok "pausa global → también se aparca" || bad "pausa global: $o"
rm "$HERMES_SDD_HOME/pausa/_todo"

# Cuota agotada: solo afecta al ejecutor claude
jq -n --arg r "$(( $(date +%s) + 600 ))" '{reset_at: ($r|tonumber)}' > "$HERMES_SDD_HOME/cuota.json"
jq '.ejecutor="claude"' "$R/.sdd/hermes/hermes-sdd.json" > "$T/c" && cp "$T/c" "$R/.sdd/hermes/hermes-sdd.json"
o=$(outcome plan); [ "$(echo "$o" | jq -r .outcome)" = scheduled ] && [ -n "$(echo "$o" | jq -r .reset_at)" ] && ok "cuota agotada → se aparca con la hora de reinicio" || bad "cuota: $o"
jq '.ejecutor="replay"' "$R/.sdd/hermes/hermes-sdd.json" > "$T/c" && cp "$T/c" "$R/.sdd/hermes/hermes-sdd.json"
rm "$HERMES_SDD_HOME/cuota.json"

# Llegar a la FASE-0 aceptada y anularla
paso() { local o p; o=$(outcome "$@" | tail -1); p=$(echo "$o" | jq -r '.puerta // empty'); [ -n "$p" ] && bash "$ROOT/decidir.sh" "$p" "${V:-acepto}" >/dev/null; }
paso requisitos; paso ruta; paso plan; V=conforme paso tareas; paso implementar 0; paso aceptar 0
git -C "$R" rev-parse -q --verify refs/tags/fase-0-accepted >/dev/null && ok "FASE-0 aceptada" || bad "sin fase-0-accepted"
bash "$ROOT/anular.sh" "$R" 0 yo telegram 999 "prueba" >/dev/null 2>&1 && bad "anuló con una identidad no autorizada" || ok "anular exige identidad autorizada"
bash "$ROOT/anular.sh" "$R" 0 yo telegram 111 "la demo no cubría el caso X" >/dev/null 2>&1 && ok "anula la aceptación" || bad "anular falló"
git -C "$R" tag -l 'fase-0-revoked-*' | grep -q . && ok "tag de revocación creado" || bad "sin tag de revocación"
git -C "$R" rev-parse -q --verify refs/tags/fase-0-accepted >/dev/null && ok "el tag original se conserva" || bad "se borró el tag original"
[ "$(tail -1 "$R/acceptance/decisions.jsonl" | jq -r .result)" = rejected ] && ok "último registro de la FASE: rejected" || bad "registro"
exit $fail
