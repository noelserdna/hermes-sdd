#!/usr/bin/env bash
# Instala el arnés hermes-sdd en esta máquina: macOS, Linux o Windows con WSL2 (ver docs/windows.md).
# Una vez; se puede repetir para actualizar.
#
#   bash instalar.sh [--sin-estacion]
#
# 1. Copia el arnés a ~/.hermes/hermes-sdd/<versión> (disco interno: los repos pueden estar en un disco externo)
# 2. Crea aprobadores.json (tú, con tu id de Telegram y tu usuario local) si no existe
# 3. Instala y activa el plugin de Telegram
# 4. Crea el perfil sdd-estacion LIMPIO: sin clonar tus tokens, solo la clave del modelo, permisos mínimos y plazos
#    largos (una etapa dura 10-30 min)
# No cambia la configuración global del kanban (otros tableros, como los del módulo 09, siguen igual); solo comprueba
# que kanban.auto_decompose está desactivado.
set -euo pipefail
SRC="$(cd "$(dirname "$0")" && pwd)"
HH="$HOME/.hermes"; HOME_SDD="$HH/hermes-sdd"
P=sdd-estacion

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

VERSION=$(jq -r .version "$SRC/metodo/.claude-plugin/plugin.json")
DEST="$HOME_SDD/$VERSION"
echo "· Arnés $VERSION → $DEST"
mkdir -p "$DEST" "$HOME_SDD/puertas" "$HOME_SDD/actas"
rsync -a --delete --exclude .git "$SRC/" "$DEST/"
ln -sfn "$DEST" "$HOME_SDD/actual"
# Skill llm-wiki de Hermes (oficial, opcional) para la memoria del encargado: solo esa, por skills.external_dirs
LW="$HH/hermes-agent/optional-skills/research/llm-wiki"
if [ -d "$LW" ]; then mkdir -p "$DEST/encargado/skills" && rsync -a --delete "$LW/" "$DEST/encargado/skills/llm-wiki/"
else echo "  AVISO: no encuentro la skill llm-wiki de Hermes ($LW): el encargado no tendrá su guía del wiki"; fi
jq -n --arg r "$HOME_SDD/actual" --arg v "$VERSION" '{root:$r, version:$v}' > "$HOME_SDD/instalacion.json"

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

echo "· Plugin (Telegram, pestaña SDD del panel y de Hermes Desktop)"
rm -rf "$HH/plugins/hermes-sdd"; mkdir -p "$HH/plugins"
cp -R "$DEST/plugin/hermes-sdd" "$HH/plugins/hermes-sdd"
hermes plugins enable hermes-sdd >/dev/null 2>&1 || echo "  AVISO: activa el plugin con: hermes plugins enable hermes-sdd"

# Rehacer los perfiles borra su estado: un worker en marcha se pierde y su tarjeta queda bloqueada («Kanban execution
# unknown»; propinas y biblioteca, 11/11/2026). Con etapas en marcha no se tocan, salvo que se pida con --forzar-perfiles.
SIN_PERFILES=false
[ "${1:-}" = --sin-estacion ] && SIN_PERFILES=true
if [ "${1:-}" != --forzar-perfiles ] && pgrep -f "etapa\.sh " >/dev/null 2>&1; then
  SIN_PERFILES=true
  echo "  AVISO: hay etapas en marcha: no rehago los perfiles sdd-estacion ni sdd-ejecutor (vuelve a instalar cuando acaben"
  echo "         si cambiaste algo de los perfiles, o usa --forzar-perfiles)"
fi
if [ "$SIN_PERFILES" != true ]; then   # --sin-estacion: no tocar los perfiles
echo "· Perfil $P (limpio)"
hermes profile list 2>/dev/null | grep -qw "$P" && { hermes profile delete -y "$P" >/dev/null 2>&1 || true; }
hermes profile create "$P" --no-alias --no-skills \
  --description "Estación hermes-sdd: ejecuta etapa.sh y mueve la tarjeta según su resultado. No decide nada." >/dev/null
PD="$HH/profiles/$P"
cp "$DEST/profiles/sdd-estacion/SOUL.md" "$PD/SOUL.md"
for k in default provider base_url api_mode; do
  v=$(hermes config get "model.$k" 2>/dev/null | tail -1); [ -n "$v" ] && hermes -p "$P" config set "model.$k" "$v" >/dev/null
done
{ grep '^OPENROUTER_API_KEY=' "$HH/.env" || true; echo "TERMINAL_MAX_FOREGROUND_TIMEOUT=5400"; } > "$PD/.env"; chmod 600 "$PD/.env"
hermes -p "$P" tools disable web browser vision image_gen tts computer_use cronjob delegation memory \
  code_execution connections clarify session_search file skills >/dev/null 2>&1 || true
for kv in "timeouts.tools.sequential_call 5400" "timeouts.tools.concurrent_batch 5400" \
          "auxiliary.background_review.enabled false" "curator.enabled false" "memory.memory_enabled false"; do
  hermes -p "$P" config set $kv >/dev/null
done
hermes -p "$P" config set approvals.deny \
  '["*accept record*","*git tag*","*update-ref*","*route --write*","*git push*","*firmar.sh*","*decidir.sh*","*jev.sh*","*nuevo.sh*","*hsdd_nucleo.py*","*hsdd_proyectos.py*","*jev.json*","*sdd.json*","*hermes kanban*","*sqlite3*"]' >/dev/null

echo "· Perfil sdd-ejecutor (ejecutor Hermes nativo para etapas ligeras)"
E=sdd-ejecutor
hermes profile list 2>/dev/null | grep -qw "$E" && { hermes profile delete -y "$E" >/dev/null 2>&1 || true; }
hermes profile create "$E" --no-alias --no-skills \
  --description "Ejecutor hermes-sdd: hace etapas ligeras del método con sus skills. Nunca firma ni toca el kanban." >/dev/null
ED="$HH/profiles/$E"
for k in default provider base_url api_mode; do
  v=$(hermes config get "model.$k" 2>/dev/null | tail -1); [ -n "$v" ] && hermes -p "$E" config set "model.$k" "$v" >/dev/null
done
{ grep '^OPENROUTER_API_KEY=' "$HH/.env" || true; echo "TERMINAL_MAX_FOREGROUND_TIMEOUT=5400"; } > "$ED/.env"; chmod 600 "$ED/.env"
hermes -p "$E" tools disable web browser vision image_gen tts computer_use cronjob delegation memory \
  code_execution connections clarify session_search kanban >/dev/null 2>&1 || true
for kv in "timeouts.tools.sequential_call 5400" "timeouts.tools.concurrent_batch 5400" \
          "auxiliary.background_review.enabled false" "curator.enabled false" "memory.memory_enabled false" \
          "skills.write_approval true"; do
  hermes -p "$E" config set $kv >/dev/null
done
hermes -p "$E" config set skills.external_dirs "[\"$HOME_SDD/actual/metodo/skills\"]" >/dev/null
hermes -p "$E" config set terminal.env_passthrough '["SDD_PLUGIN_ROOT","CLAUDE_PLUGIN_ROOT","SDD_EXECUTOR"]' >/dev/null
hermes -p "$E" config set approvals.deny \
  '["*accept record*","*git tag*","*update-ref*","*route --write*","*git push*","*firmar.sh*","*decidir.sh*","*jev.sh*","*nuevo.sh*","*hsdd_nucleo.py*","*hsdd_proyectos.py*","*jev.json*","*sdd.json*","*hermes kanban*","*sqlite3*"]' >/dev/null
hermes -p "$E" config set hooks.pre_tool_call \
  "[{\"matcher\":\"terminal|write_file|patch|execute_code\",\"command\":\"bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh\",\"timeout\":10,\"fail_closed\":true}]" >/dev/null
# Hermes solo ejecuta un hook de shell aprobado (si no, lo salta con un aviso en el log): se aprueba aquí
jq -n --arg c "bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{approvals: [{event: "pre_tool_call", command: $c, approved_at: $t}]}' > "$ED/shell-hooks-allowlist.json"
fi

# Menú de Telegram: Bot API admite como mucho 100 órdenes y Hermes muestra 60 por defecto; sin prioridad, las del
# arnés (plugin) quedan ocultas tras las de Hermes y las skills. Se ponen delante, conservando la prioridad que ya hubiera.
NUESTRAS='["nuevo","preparar","estado","puertas","cambio","encargado","jev","pausar","reanudar","anular","mantenimiento"]'
ANTES=$(hermes config get platforms.telegram.extra.command_menu.priority --json 2>/dev/null || echo '[]')
jq -e 'type == "array"' <<< "$ANTES" >/dev/null 2>&1 || ANTES='[]'
hermes config set platforms.telegram.extra.command_menu.priority \
  "$(jq -c --argjson n "$NUESTRAS" '$n + [.[] | select(. as $x | $n | index($x) | not)]' <<< "$ANTES")" >/dev/null &&
  echo "· Menú de Telegram: las órdenes del arnés (/nuevo, /preparar, /estado, /puertas…) primero"

# Encargados ya creados: se ponen al día (SOUL, guardia, skills); sus sesiones, su memoria y su wiki se conservan
if [ -s "$HOME_SDD/encargados.json" ]; then
  for r in $(jq -r '.[]' "$HOME_SDD/encargados.json"); do
    [ -d "$r" ] && bash "$DEST/encargado.sh" crear "$r" | head -1 | sed 's/^/· /'
  done
fi

DI=$(hermes config get kanban.dispatch_interval_seconds 2>/dev/null | tail -1)
[ -n "$DI" ] && [ "$DI" -gt 15 ] 2>/dev/null &&
  echo "  AVISO: el kanban mira las tarjetas cada ${DI} s; cada etapa espera hasta eso en arrancar. Para 10 s: hermes config set kanban.dispatch_interval_seconds 10"
[ "$(hermes config get kanban.auto_decompose 2>/dev/null | tail -1)" = false ] ||
  echo "  AVISO: kanban.auto_decompose está activo; desactívalo con: hermes config set kanban.auto_decompose false"
echo "Listo. Reinicia el gateway (hermes gateway restart) y el panel (hermes dashboard) para cargar el plugin"
echo "  Hermes Desktop: Capabilities → Plugins → Rescan y activa «SDD» (la primera vez está apagada)."
echo "  Jev en las puertas: bash jev.sh (modos humano, consejo, piloto, auto; ver docs/jev.md)"
