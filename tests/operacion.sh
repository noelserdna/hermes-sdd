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
# Claude sin sesión (error de autenticación): se aparca 15 min y queda anotado como «sesion», no es un fallo de la etapa
FB=$(mktemp -d); cat > "$FB/claude" <<'C'
#!/usr/bin/env bash
echo '{"type":"result","is_error":true,"result":"Failed to authenticate. API Error: 403 Attention Required! | Cloudflare","total_cost_usd":0,"num_turns":0}'
exit 1
C
chmod +x "$FB/claude"; SB=$(mktemp -d); git -C "$SB" init -q
o=$(CLAUDE_BIN="$FB/claude" bash "$ROOT/executors/claude.sh" "$SB" prueba "hola" 2>/dev/null | tail -1)
[ "$(echo "$o" | jq -r .outcome)" = scheduled ] && [ "$(jq -r .motivo "$HERMES_SDD_HOME/cuota.json")" = sesion ] \
  && ok "Claude sin sesión → se aparca (no gasta el reintento) y queda anotado para avisar de /login" || bad "sin sesión: $o"
# límite semanal con la hora en texto («resets 6pm»): se aparca hasta esa hora, no es un fallo de la etapa
cat > "$FB/claude" <<'C'
#!/usr/bin/env bash
echo '{"type":"result","is_error":true,"result":"You have hit your weekly limit · resets 6pm (Europe/Madrid)","total_cost_usd":0,"num_turns":0}'
exit 1
C
rm -f "$HERMES_SDD_HOME/cuota.json"
o=$(CLAUDE_BIN="$FB/claude" bash "$ROOT/executors/claude.sh" "$SB" prueba "hola" 2>/dev/null | tail -1)
h=$(date -r "$(jq -r .reset_at "$HERMES_SDD_HOME/cuota.json")" +%H:%M 2>/dev/null || date -d "@$(jq -r .reset_at "$HERMES_SDD_HOME/cuota.json")" +%H:%M)
[ "$(echo "$o" | jq -r .outcome)" = scheduled ] && [ "$h" = 18:00 ] && ok "límite semanal «resets 6pm» → se aparca hasta las 18:00" || bad "semanal: $o $h"
rm -rf "$FB" "$SB" "$HERMES_SDD_HOME/cuota.json"

# Candado por etapa y etapa cortada desde fuera (el kanban pierde al worker): consta como «interrumpida», mata a su
# ejecutor y suelta el candado; lo que pidió la persona no se da por aplicado
FB=$(mktemp -d); printf '#!/usr/bin/env bash\nsleep 60\n' > "$FB/claude"; chmod +x "$FB/claude"
jq '.ejecutor="claude"' "$R/.sdd/hermes/hermes-sdd.json" > "$T/c" && cp "$T/c" "$R/.sdd/hermes/hermes-sdd.json"
mkdir -p "$R/.sdd/hermes/feedback"; echo "otra FASE para el filtro" > "$R/.sdd/hermes/feedback/plan.txt"
CLAUDE_BIN="$FB/claude" bash "$ROOT/etapa.sh" "$R" plan > "$T/etapa.out" 2>/dev/null &
EP=$!
for _ in $(seq 1 100); do pgrep -f "$FB/claude" >/dev/null && break; sleep 0.2; done
[ "$(cat "$R/.sdd/hermes/lock/pid" 2>/dev/null)" = "$EP" ] && [ "$(cat "$R/.sdd/hermes/lock/quien")" = etapa ] \
  && ok "la etapa tiene el candado del repo mientras dura (no solo cada ejecución de Claude)" || bad "candado: $(ls "$R/.sdd/hermes/lock" 2>&1)"
# otra etapa a la vez: «busy», sin matar los servidores de la que corre
mkdir -p "$R/node_modules/.bin"; printf '#!/usr/bin/env bash\nsleep 60\n' > "$R/node_modules/.bin/servidor"; chmod +x "$R/node_modules/.bin/servidor"
"$R/node_modules/.bin/servidor" & SV=$!
o=$(outcome ruta)
[ "$(echo "$o" | jq -r .outcome)" = busy ] && kill -0 "$SV" 2>/dev/null && ok "otra etapa a la vez: busy, y no mata los servidores de la que está en marcha" || bad "busy: $o"
{ kill "$SV"; wait "$SV"; } 2>/dev/null; rm -rf "$R/node_modules"
kill -TERM "$EP"; for _ in $(seq 1 50); do kill -0 "$EP" 2>/dev/null || break; sleep 0.2; done
u=$(tail -1 "$R/.sdd/hermes/etapas.jsonl")
! kill -0 "$EP" 2>/dev/null && [ "$(echo "$u" | jq -r .resultado)" = interrumpida ] && [ "$(echo "$u" | jq -r .subpaso)" = plan-architect ] \
  && echo "$u" | jq -e '(.segundos | type) == "number" and (.segundos_sin_llm | type) == "number"' >/dev/null \
  && ok "TERM: la etapa queda en etapas.jsonl como interrumpida, con su sub-paso y sus segundos" || bad "interrumpida: $u"
sleep 0.5; ! pgrep -f "$FB/claude" >/dev/null && [ ! -d "$R/.sdd/hermes/lock" ] \
  && ok "TERM: el ejecutor muere con ella y el candado se suelta" || bad "restos: $(pgrep -fl "$FB/claude") $(ls "$R/.sdd/hermes" | tr '\n' ' ')"
[ -s "$R/.sdd/hermes/feedback/plan.txt" ] && ok "TERM: lo que pidió la persona sigue pendiente para el reintento" || bad "feedback consumido"
rm -f "$R/.sdd/hermes/feedback/plan.txt"; pkill -f "$FB/claude" 2>/dev/null; rm -rf "$FB"
jq '.ejecutor="replay"' "$R/.sdd/hermes/hermes-sdd.json" > "$T/c" && cp "$T/c" "$R/.sdd/hermes/hermes-sdd.json"

# Candado (lib/candado.sh) tras un reinicio: el pid del dueño lo puede tener otro proceso. Antes «vivo» era solo
# kill -0 y la etapa quedaba «busy» (y el notario con 75) para siempre.
C="$T/cand"; L="$C/.sdd/hermes/lock"; mkdir -p "$C/.sdd/hermes"
sleep 60 & AJENO=$!   # un proceso vivo que no es el dueño del candado
cand() { ( . "$ROOT/lib/candado.sh"; "$@" ); }
mkdir -p "$L"; echo "$AJENO" > "$L/pid"; echo etapa > "$L/quien"; date +%s > "$L/desde"
echo "Thu Jan 1 00:00:00 1970" > "$L/arranque"
! cand candado_vivo "$C" && ok "candado: pid vivo pero con otra hora de arranque (pid reutilizado) → huérfano" || bad "pid reutilizado cuenta como vivo"
o=$(bash -c '. "$1/lib/candado.sh"; candado_tomar "$2" firma g1 && cat "$3/pid" "$3/arranque"' _ "$ROOT" "$C" "$L" 2>&1)
[ "$(echo "$o" | head -1)" != "$AJENO" ] && [ -n "$(echo "$o" | sed -n 2p)" ] \
  && ok "candado: se roba el huérfano y el nuevo guarda pid y hora de arranque" || bad "robo del huérfano: $o"
rm -rf "$L"; mkdir -p "$L"; echo "$AJENO" > "$L/pid"; date +%s > "$L/desde"
TZ=UTC LC_ALL=C ps -o lstart= -p "$AJENO" | tr -s ' ' | sed 's/^ //; s/ $//' > "$L/arranque"
cand candado_vivo "$C" && ok "candado: pid vivo con su misma hora de arranque → vivo" || bad "dueño vivo dado por muerto"
! cand candado_tomar "$C" etapa plan && ok "candado: con el dueño vivo, otro no lo toma" || bad "se robó un candado vivo"
rm "$L/arranque"
cand candado_vivo "$C" && ok "candado de un arnés anterior (sin arranque): manda el pid" || bad "candado viejo con pid vivo dado por muerto"
TZ=UTC LC_ALL=C ps -o lstart= -p "$AJENO" > "$L/arranque"; echo $(( $(date +%s) - 100 )) > "$L/desde"
e=$(HERMES_SDD_CANDADO_MAX_S=50 bash -c '. "$1/lib/candado.sh"; candado_vivo "$2"' _ "$ROOT" "$C" 2>&1) \
  && bad "candado más viejo que la edad máxima sigue vivo" \
  || { echo "$e" | grep -q "se da por abandonado" && ok "candado: más viejo que HERMES_SDD_CANDADO_MAX_S → abandonado, con aviso" || bad "sin aviso: $e"; }
HERMES_SDD_CANDADO_MAX_S=0 cand candado_vivo "$C" 2>/dev/null && ok "candado: HERMES_SDD_CANDADO_MAX_S=0 quita el tope" || bad "tope 0"
# el plugin y el encargado aplican la misma regla (hsdd_nucleo.candado_vivo)
py() { HERMES_SDD_CANDADO_MAX_S=${1} python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N; print(N.candado_vivo(sys.argv[2]))' "$ROOT/plugin/hermes-sdd" "$C" 2>/dev/null; }
a=$(py 0); echo "Thu Jan 1 00:00:00 1970" > "$L/arranque"; b=$(py 0); echo $(( $(date +%s) - 100 )) > "$L/desde"
TZ=UTC LC_ALL=C ps -o lstart= -p "$AJENO" > "$L/arranque"; c=$(py 50)
[ "$a/$b/$c" = "True/False/False" ] && ok "Python (plugin, encargado): misma regla que lib/candado.sh" || bad "Python: $a/$b/$c"
{ kill "$AJENO"; wait "$AJENO"; } 2>/dev/null
# mtime portable: con un stat GNU («-f» es el estado del sistema de ficheros) la edad salía de restar un texto
mkdir -p "$T/gnu"; cat > "$T/gnu/stat" <<'S'
#!/usr/bin/env bash
case "$1" in
  -c) python3 -c 'import os, sys; print(int(os.stat(sys.argv[1]).st_mtime))' "$3" ;;
  -f) echo "  File: \"$3\""; echo "    ID: 0 Namelen: 255 Type: apfs" ;;
esac
S
chmod +x "$T/gnu/stat"; rm -rf "$L"; mkdir -p "$L"
e=$(PATH="$T/gnu:$PATH" bash -c '. "$1/lib/candado.sh"; _candado_edad "$2"' _ "$ROOT" "$L" 2>&1)
[[ "$e" =~ ^[0-9]+$ ]] && [ "$e" -lt 30 ] && ok "candado: la edad se calcula también con stat de GNU (Linux)" || bad "edad con stat GNU: $e"
e=$(cand _candado_edad "$L"); [[ "$e" =~ ^[0-9]+$ ]] && [ "$e" -lt 30 ] && ok "candado: y con el stat de este sistema" || bad "edad: $e"
rm -rf "$C"

# Llegar a la FASE-0 aceptada y anularla
paso() { local o p v; o=$(outcome "$@" | tail -1); p=$(echo "$o" | jq -r '.puerta // empty'); [ -n "$p" ] || return 0
  v=${V:-acepto}; [ "$1" = ruta ] && v=$(jq -r '[.opciones[] | select(.auto == true) | .verbo][0] // [.opciones[] | select(.verbo | startswith("ruta-")) | .verbo][0]' "$HERMES_SDD_HOME/puertas/$p.json")   # un botón que la puerta ofrece
  bash "$ROOT/decidir.sh" "$p" "$v" >/dev/null; }
paso requisitos; paso ruta; paso plan; V=conforme paso tareas; paso implementar 0; paso aceptar 0
git -C "$R" rev-parse -q --verify refs/tags/fase-0-accepted >/dev/null && ok "FASE-0 aceptada" || bad "sin fase-0-accepted"
bash "$ROOT/anular.sh" "$R" 0 yo telegram 999 "prueba" >/dev/null 2>&1 && bad "anuló con una identidad no autorizada" || ok "anular exige identidad autorizada"
bash "$ROOT/anular.sh" "$R" 0 yo telegram 111 "la demo no cubría el caso X" >/dev/null 2>&1 && ok "anula la aceptación" || bad "anular falló"
git -C "$R" tag -l 'fase-0-revoked-*' | grep -q . && ok "tag de revocación creado" || bad "sin tag de revocación"
git -C "$R" rev-parse -q --verify refs/tags/fase-0-accepted >/dev/null && ok "el tag original se conserva" || bad "se borró el tag original"
[ "$(tail -1 "$R/acceptance/decisions.jsonl" | jq -r .result)" = rejected ] && ok "último registro de la FASE: rejected" || bad "registro"
exit $fail
