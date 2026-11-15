#!/usr/bin/env bash
# Instala el arnés hermes-sdd en esta máquina: macOS, Linux o Windows con WSL2 (ver docs/windows.md).
# Una vez; se puede repetir para actualizar.
#
#   bash instalar.sh [--sin-estacion] [--esperar] [--forzar]
#
# 1. Copia el arnés a ~/.hermes/hermes-sdd/<versión>-<commit> (un directorio NUEVO por commit; disco interno: los repos
#    pueden estar en un disco externo) y cambia el enlace «actual» de golpe (rename atómico). Deja las 3 últimas.
# 2. Crea aprobadores.json (tú, con tu id de Telegram y tu usuario local) si no existe
# 3. Instala y activa el plugin de Telegram (solo si cambió)
# 4. Perfiles sdd-estacion y sdd-ejecutor LIMPIOS: sin clonar tus tokens, solo la clave del modelo, permisos mínimos y
#    plazos largos (una etapa dura 10-30 min). Se crean si no existen y NUNCA se borran: cada ajuste se escribe solo si
#    cambia (cada «config set» hace que Hermes reescanee el perfil; borrar y recrear el perfil perdía al worker en
#    marcha: «Kanban execution unknown», 11/11/2026 y otra vez en la prueba siguiente).
# Del kanban global solo fija kanban.max_in_progress = 1 si no tiene valor (una etapa a la vez en toda la máquina: en
# macOS Hermes no pone tope; uno puesto a mano se respeta) y comprueba que kanban.auto_decompose está desactivado.
#
# Con trabajo en marcha no instala: tarjetas del arnés en running/ready/todo, una etapa o firma con el candado del repo
# o una puerta «decidida» pendiente de firmar. --esperar espera a que no lo haya; --forzar instala igual (no lo uses
# con etapas en marcha). --sin-estacion no toca los perfiles.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
HH="$HOME/.hermes"; HOME_SDD="$HH/hermes-sdd"
P=sdd-estacion
SIN_PERFILES=false; ESPERAR=false; FORZAR=false
for a in "$@"; do
  case "$a" in
    --sin-estacion) SIN_PERFILES=true ;;
    --esperar) ESPERAR=true ;;
    --forzar|--forzar-perfiles) FORZAR=true ;;
    *) echo "uso: bash instalar.sh [--sin-estacion] [--esperar] [--forzar]" >&2; exit 2 ;;
  esac
done

# ── Comprobaciones previas: dependencias y, en WSL, que nada viva en el disco de Windows ──────────────────────────
falta=()
for c in jq rsync git node python3 perl openssl hermes; do command -v "$c" >/dev/null || falta+=("$c"); done
if [ ${#falta[@]} -gt 0 ]; then
  echo "ERROR: faltan: ${falta[*]}" >&2
  if command -v apt-get >/dev/null; then echo "  Linux/WSL: sudo apt install jq rsync git python3 perl openssl; Node ≥ 18 y Hermes según docs/windows.md" >&2
  else echo "  macOS: brew install jq rsync node; Hermes según su README" >&2; fi
  exit 1
fi
command -v claude >/dev/null || echo "  AVISO: no encuentro Claude Code (claude); el ejecutor de las etapas pesadas lo necesita"
if [ -n "${WSL_DISTRO_NAME:-}" ] || [ -e /proc/sys/fs/binfmt_misc/WSLInterop ]; then
  case "$SRC/:$HOME/" in */mnt/[a-z]/*)
    echo "  AVISO (WSL): el arnés o tu HOME están en el disco de Windows (/mnt/…): mucho más lento y chmod 600 no protege" \
         "las claves. Clónalo dentro de ~ (ext4). Ver docs/windows.md" >&2;; esac
fi

# ── ¿Hay trabajo en marcha? Entonces no se toca nada (o se espera) ─────────────────────────────────────────────────────
. "$SRC/lib/candado.sh"
en_marcha() {  # imprime qué hay en marcha (una línea por cosa); nada si se puede instalar
  local b l
  for b in $(hermes kanban boards list --json 2>/dev/null | jq -r '.[]?.slug' 2>/dev/null); do
    l=$(hermes kanban --board "$b" list --json 2>/dev/null) || continue
    printf '%s' "$l" | jq -r --arg b "$b" '(if type == "array" then . else .tasks // [] end)[]
      | select(.assignee == "sdd-estacion" and (.status | IN("running", "ready", "todo")))
      | "tarjeta \($b)/\(.id) «\(.title)» (\(.status))"' 2>/dev/null || true
  done
  for f in "$HOME_SDD"/puertas/*.json; do
    [ -f "$f" ] || continue
    jq -r 'select(.estado == "decidida") | "puerta \(.id) «\(.titulo // .tipo)» decidida, pendiente de firmar"' "$f" 2>/dev/null || true
    r=$(jq -r '.repo // empty' "$f" 2>/dev/null)
    if [ -n "$r" ] && [ -d "$r" ] && candado_vivo "$r"; then echo "candado vivo en $r (${CANDADO_QUIEN:-etapa})"; fi
  done | sort -u
  return 0   # (con pipefail, la última comprobación falsa del bucle no es un error)
}
if ! $FORZAR; then
  hasta=$(( $(date +%s) + ${HERMES_SDD_ESPERA_MAX_S:-14400} ))
  while ocupado=$(en_marcha) && [ -n "$ocupado" ]; do
    if ! $ESPERAR; then
      echo "No instalo: hay trabajo en marcha (instalar reescanea los perfiles y el worker se perdería):" >&2
      printf '  %s\n' "$ocupado" | head -10 >&2
      echo "  Vuelve a probar cuando acabe, o usa --esperar (espera a que no haya nada) o --forzar." >&2
      exit 1
    fi
    [ "$(date +%s)" -lt "$hasta" ] || { echo "ERROR: sigue habiendo trabajo en marcha tras esperar; no instalo" >&2; exit 1; }
    echo "  … esperando: $(printf '%s' "$ocupado" | head -1)$( [ "$(printf '%s\n' "$ocupado" | wc -l)" -gt 1 ] && echo " (y más)")"
    sleep "${HERMES_SDD_ESPERA_INTERVALO_S:-30}"
  done
fi

# ── Copia: un directorio nuevo por commit; el enlace «actual» se cambia de golpe ─────────────────────────────────────
VERSION=$(jq -r .version "$SRC/metodo/.claude-plugin/plugin.json")
if REV=$(git -C "$SRC" rev-parse --short=8 HEAD 2>/dev/null); then
  # con cambios sin commit: la huella de esos cambios (el mismo contenido, el mismo directorio)
  [ -z "$(git -C "$SRC" status --porcelain --untracked-files=no 2>/dev/null)" ] ||
    REV="$REV-cambios-$(git -C "$SRC" diff HEAD 2>/dev/null | { shasum 2>/dev/null || sha1sum; } | cut -c1-8)"
else REV=$(date +%Y%m%d%H%M%S); fi
DEST="$HOME_SDD/$VERSION-$REV"
mkdir -p "$HOME_SDD/puertas" "$HOME_SDD/actas"
NUEVO="$HOME_SDD/.instalando-$$"; trap 'rm -rf "$NUEVO"' EXIT
rsync -a --delete --exclude .git --exclude __pycache__ --exclude '*.pyc' "$SRC/" "$NUEVO/"
# Skill llm-wiki de Hermes (oficial, opcional) para la memoria del encargado: solo esa, por skills.external_dirs
LW="$HH/hermes-agent/optional-skills/research/llm-wiki"
if [ -d "$LW" ]; then mkdir -p "$NUEVO/encargado/skills" && rsync -a --delete "$LW/" "$NUEVO/encargado/skills/llm-wiki/"
else echo "  AVISO: no encuentro la skill llm-wiki de Hermes ($LW): el encargado no tendrá su guía del wiki"; fi
if [ -d "$DEST" ] && diff -rq "$NUEVO" "$DEST" >/dev/null 2>&1; then
  rm -rf "$NUEVO"                     # el mismo commit, ya instalado: no se toca el directorio en uso
else
  [ -d "$DEST" ] && DEST="$DEST-$(date +%Y%m%d%H%M%S)"   # el mismo commit con otro contenido: otro directorio
  mv "$NUEVO" "$DEST"; touch "$DEST"   # (la fecha decide qué versiones viejas se borran)
fi
trap - EXIT
ANTES_ACTUAL=$(readlink "$HOME_SDD/actual" 2>/dev/null || true)
if [ "$ANTES_ACTUAL" != "$DEST" ]; then
  ln -sfn "$DEST" "$HOME_SDD/.actual-$$"
  python3 -c 'import os, sys; os.replace(sys.argv[1], sys.argv[2])' "$HOME_SDD/.actual-$$" "$HOME_SDD/actual"   # atómico
fi
echo "· Arnés $VERSION → $DEST"
# commit: el completo, para que una caja remota (executors/github.sh) descargue exactamente este arnés
COMMIT=$(git -C "$SRC" rev-parse HEAD 2>/dev/null || true); case "$REV" in *-cambios-*) COMMIT="" ;; esac   # con cambios sin commit no hay commit que descargar
jq -n --arg r "$HOME_SDD/actual" --arg v "$VERSION" --arg d "$DEST" --arg c "$COMMIT" '{root:$r, version:$v, directorio:$d} + (if $c == "" then {} else {commit:$c} end)' > "$HOME_SDD/instalacion.json.tmp" &&
  mv "$HOME_SDD/instalacion.json.tmp" "$HOME_SDD/instalacion.json"
# Versiones viejas: se quedan las 3 más recientes (y siempre la que está en uso)
VIEJAS=$(find "$HOME_SDD" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*.[0-9]*' -print0 2>/dev/null | xargs -0 ls -dt 2>/dev/null | tail -n +4 || true)
for v in $VIEJAS; do
  [ "$v" = "$DEST" ] && continue
  rm -rf "$v" && echo "· Versión vieja borrada: $(basename "$v")"
done

if [ ! -f "$HOME_SDD/aprobadores.json" ]; then
  TG=$(grep '^TELEGRAM_ALLOWED_USERS=' "$HH/.env" 2>/dev/null | cut -d= -f2- | cut -d, -f1 | tr -d ' "' || true)
  jq -n --arg n "$(git config user.name || echo "$USER")" --arg tg "$TG" --arg u "$USER" \
    '{yo: {nombre:$n, rol:"Cliente", canales: ({local:$u, dashboard:$u} + (if $tg != "" then {telegram:$tg} else {} end))}}' \
    > "$HOME_SDD/aprobadores.json"
  echo "· aprobadores.json creado (tú; Telegram: $([ -n "$TG" ] && echo sí || echo 'no encontrado'))"
fi
# Canal dashboard (panel web local): quien decide en esta máquina como usuario local, decide también en el panel
if jq -e --arg u "$USER" 'any(.[]; .canales.local == $u and (.canales.dashboard // "") == "")' "$HOME_SDD/aprobadores.json" >/dev/null; then
  t=$(mktemp); jq --arg u "$USER" 'map_values(if .canales.local == $u and (.canales.dashboard // "") == "" then .canales.dashboard = $u else . end)' \
    "$HOME_SDD/aprobadores.json" > "$t" && mv "$t" "$HOME_SDD/aprobadores.json"
  echo "· aprobadores.json: canal dashboard añadido para el usuario local $USER"
fi

PLUGIN_CAMBIA=false
if ! diff -rq -x __pycache__ "$DEST/plugin/hermes-sdd" "$HH/plugins/hermes-sdd" >/dev/null 2>&1; then
  echo "· Plugin (Telegram, pestaña SDD del panel y de Hermes Desktop)"
  mkdir -p "$HH/plugins"; rm -rf "$HH/plugins/.hermes-sdd-nuevo"
  cp -R "$DEST/plugin/hermes-sdd" "$HH/plugins/.hermes-sdd-nuevo"
  rm -rf "$HH/plugins/hermes-sdd"; mv "$HH/plugins/.hermes-sdd-nuevo" "$HH/plugins/hermes-sdd"
  PLUGIN_CAMBIA=true
fi
hermes plugins enable hermes-sdd >/dev/null 2>&1 || echo "  AVISO: activa el plugin con: hermes plugins enable hermes-sdd"

# ── Ajustes: solo se escriben si cambian (cada escritura hace que Hermes reescanee) ───────────────────────────────────
CAMBIOS=0
poner() {  # poner <perfil|-> <clave> <valor>: config set solo si el valor actual es otro (JSON o texto)
  local pf=() actual
  [ "$1" != - ] && pf=(-p "$1")
  actual=$(hermes ${pf[@]+"${pf[@]}"} config get "$2" --json 2>/dev/null | tail -1 || true)
  if jq . <<< "$3" >/dev/null 2>&1 && jq . <<< "$actual" >/dev/null 2>&1; then
    [ "$(jq -cS . <<< "$actual")" = "$(jq -cS . <<< "$3")" ] && return 0
  else
    [ "$(jq -r 'if type == "string" then . else tostring end' <<< "$actual" 2>/dev/null || echo "$actual")" = "$3" ] && return 0
  fi
  hermes ${pf[@]+"${pf[@]}"} config set "$2" "$3" >/dev/null
  CAMBIOS=$((CAMBIOS + 1))
}
fichero() {  # fichero <destino> [modo]: escribe stdin en <destino> solo si cambia
  local t; t=$(mktemp); cat > "$t"
  if cmp -s "$t" "$1"; then rm -f "$t"; else mv "$t" "$1"; CAMBIOS=$((CAMBIOS + 1)); fi
  [ -n "${2:-}" ] && chmod "$2" "$1"; return 0
}
perfil() {  # perfil <nombre> <descripción>: lo crea si no existe (nunca se borra); 0 si es nuevo
  if hermes profile list 2>/dev/null | grep -qw "$1"; then return 1; fi
  hermes profile create "$1" --no-alias --no-skills --description "$2" >/dev/null
  return 0
}
DENY='["*accept record*","*git tag*","*update-ref*","*route --write*","*git push*","*firmar.sh*","*decidir.sh*","*jev.sh*","*nuevo.sh*","*hsdd_nucleo.py*","*hsdd_proyectos.py*","*jev.json*","*sdd.json*","*hermes kanban*","*sqlite3*"]'
ENV_PERFIL=$({ grep '^OPENROUTER_API_KEY=' "$HH/.env" || true; echo "TERMINAL_MAX_FOREGROUND_TIMEOUT=5400"; })

if [ "$SIN_PERFILES" != true ]; then   # --sin-estacion: no tocar los perfiles
echo "· Perfil $P"
NUEVO_P=false; perfil "$P" "Estación hermes-sdd: ejecuta etapa.sh y mueve la tarjeta según su resultado. No decide nada." && NUEVO_P=true
PD="$HH/profiles/$P"; mkdir -p "$PD"
fichero "$PD/SOUL.md" < "$DEST/profiles/sdd-estacion/SOUL.md"
for k in default provider base_url api_mode; do
  v=$(hermes config get "model.$k" 2>/dev/null | tail -1 || true); [ -n "$v" ] && poner "$P" "model.$k" "$v"
done
printf '%s\n' "$ENV_PERFIL" | fichero "$PD/.env" 600
if $NUEVO_P; then   # herramientas: al crearlo (desactivarlas otra vez reescribe el perfil)
  hermes -p "$P" tools disable web browser vision image_gen tts computer_use cronjob delegation memory \
    code_execution connections clarify session_search file skills >/dev/null 2>&1 || true
fi
poner "$P" timeouts.tools.sequential_call 5400; poner "$P" timeouts.tools.concurrent_batch 5400
poner "$P" auxiliary.background_review.enabled false; poner "$P" curator.enabled false; poner "$P" memory.memory_enabled false
poner "$P" approvals.deny "$DENY"

echo "· Perfil sdd-ejecutor (ejecutor Hermes nativo para etapas ligeras)"
E=sdd-ejecutor
NUEVO_E=false; perfil "$E" "Ejecutor hermes-sdd: hace etapas ligeras del método con sus skills. Nunca firma ni toca el kanban." && NUEVO_E=true
ED="$HH/profiles/$E"; mkdir -p "$ED"
for k in default provider base_url api_mode; do
  v=$(hermes config get "model.$k" 2>/dev/null | tail -1 || true); [ -n "$v" ] && poner "$E" "model.$k" "$v"
done
printf '%s\n' "$ENV_PERFIL" | fichero "$ED/.env" 600
if $NUEVO_E; then
  hermes -p "$E" tools disable web browser vision image_gen tts computer_use cronjob delegation memory \
    code_execution connections clarify session_search kanban >/dev/null 2>&1 || true
fi
poner "$E" timeouts.tools.sequential_call 5400; poner "$E" timeouts.tools.concurrent_batch 5400
poner "$E" auxiliary.background_review.enabled false; poner "$E" curator.enabled false; poner "$E" memory.memory_enabled false
poner "$E" skills.write_approval true
poner "$E" skills.external_dirs "[\"$HOME_SDD/actual/metodo/skills\"]"
poner "$E" terminal.env_passthrough '["SDD_PLUGIN_ROOT","CLAUDE_PLUGIN_ROOT","SDD_EXECUTOR"]'
poner "$E" approvals.deny "$DENY"
poner "$E" hooks.pre_tool_call \
  "[{\"matcher\":\"terminal|write_file|patch|execute_code\",\"command\":\"bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh\",\"timeout\":10,\"fail_closed\":true}]"
# Hermes solo ejecuta un hook de shell aprobado (si no, lo salta con un aviso en el log): se aprueba aquí (una vez)
if ! jq -e --arg c "bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh" 'any(.approvals[]?; .command == $c)' "$ED/shell-hooks-allowlist.json" >/dev/null 2>&1; then
  jq -n --arg c "bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{approvals: [{event: "pre_tool_call", command: $c, approved_at: $t}]}' > "$ED/shell-hooks-allowlist.json"
fi
fi

# Una etapa a la vez en toda la máquina: en macOS (y Windows) Hermes no pone tope a los workers del kanban. Es un tope
# GLOBAL (frena también los tableros que no son del arnés): Hermes no tiene uno por tablero ni por perfil asignado a
# toda la máquina (max_in_progress_per_profile cuenta solo dentro de cada tablero y vale para todos los perfiles). Solo
# se pone si no hay ninguno: un valor que alguien puso a mano se respeta (README, «Tope de etapas a la vez»).
MIP=$(hermes config get kanban.max_in_progress --json 2>/dev/null | tail -1 || true)
case "$MIP" in
  ""|null|'""') poner - kanban.max_in_progress 1 ;;
  1) ;;
  *) echo "  AVISO: kanban.max_in_progress = $MIP (puesto a mano): se respeta; con más de 1 pueden correr varias etapas a la vez" ;;
esac

# Menú de Telegram: Bot API admite como mucho 100 órdenes y Hermes muestra 60 por defecto; sin prioridad, las del
# arnés (plugin) quedan ocultas tras las de Hermes y las skills. Se ponen delante, conservando la prioridad que ya hubiera.
NUESTRAS='["nuevo","preparar","estado","puertas","cambio","encargado","lecciones","jev","pausar","reanudar","anular","mantenimiento"]'
ANTES=$(hermes config get platforms.telegram.extra.command_menu.priority --json 2>/dev/null || echo '[]')
jq -e 'type == "array"' <<< "$ANTES" >/dev/null 2>&1 || ANTES='[]'
poner - platforms.telegram.extra.command_menu.priority "$(jq -c --argjson n "$NUESTRAS" '$n + [.[] | select(. as $x | $n | index($x) | not)]' <<< "$ANTES")" &&
  echo "· Menú de Telegram: las órdenes del arnés (/nuevo, /preparar, /estado, /puertas…) primero"

# Encargados ya creados: se ponen al día (SOUL, guardia, skills); sus sesiones, su memoria y su wiki se conservan
if [ -s "$HOME_SDD/encargados.json" ]; then
  for r in $(jq -r '.[]' "$HOME_SDD/encargados.json"); do
    # sin «| head -1»: cerrar la tubería pronto mataba crear (SIGPIPE) y, con pipefail + set -e, el instalador entero
    [ -d "$r" ] || continue
    if salida=$(bash "$DEST/encargado.sh" crear "$r" 2>&1); then echo "· ${salida%%$'\n'*}"
    else echo "  AVISO: no se pudo poner al día el encargado de $r: ${salida##*$'\n'}"; fi
  done
fi

DI=$(hermes config get kanban.dispatch_interval_seconds 2>/dev/null | tail -1 || true)
[ -n "$DI" ] && [ "$DI" -gt 15 ] 2>/dev/null &&
  echo "  AVISO: el kanban mira las tarjetas cada ${DI} s; cada etapa espera hasta eso en arrancar. Para 10 s: hermes config set kanban.dispatch_interval_seconds 10"
[ "$(hermes config get kanban.auto_decompose 2>/dev/null | tail -1 || true)" = false ] ||
  echo "  AVISO: kanban.auto_decompose está activo; desactívalo con: hermes config set kanban.auto_decompose false"
echo "· Ajustes cambiados: $CAMBIOS"
if $PLUGIN_CAMBIA || [ "$ANTES_ACTUAL" != "$DEST" ]; then
  echo "Listo. Reinicia el gateway (hermes gateway restart) y el panel (hermes dashboard) para cargar el plugin"
  echo "  Hermes Desktop: Capabilities → Plugins → Rescan y activa «SDD» (la primera vez está apagada)."
else
  echo "Listo. Nada nuevo que cargar: no hace falta reiniciar el gateway."
fi
echo "  Jev en las puertas: bash jev.sh (modos humano, consejo, piloto, auto; ver docs/jev.md)"
