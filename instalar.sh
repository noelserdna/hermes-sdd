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

if [ "${1:-}" != --sin-estacion ]; then   # --sin-estacion: no tocar el perfil de la estación (p. ej. con etapas en marcha)
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

fi
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
  "[{\"matcher\":\"terminal\",\"command\":\"bash $HOME_SDD/actual/metodo/hooks/sdd-executor-deny.sh\",\"timeout\":10,\"fail_closed\":true}]" >/dev/null

DI=$(hermes config get kanban.dispatch_interval_seconds 2>/dev/null | tail -1)
[ -n "$DI" ] && [ "$DI" -gt 15 ] 2>/dev/null &&
  echo "  AVISO: el kanban mira las tarjetas cada ${DI} s; cada etapa espera hasta eso en arrancar. Para 10 s: hermes config set kanban.dispatch_interval_seconds 10"
[ "$(hermes config get kanban.auto_decompose 2>/dev/null | tail -1)" = false ] ||
  echo "  AVISO: kanban.auto_decompose está activo; desactívalo con: hermes config set kanban.auto_decompose false"
echo "Listo. Reinicia el gateway (hermes gateway restart) y el panel (hermes dashboard) para cargar el plugin"
echo "  Hermes Desktop: Capabilities → Plugins → Rescan y activa «SDD» (la primera vez está apagada)."
echo "  Jev en las puertas: bash jev.sh (modos humano, consejo, piloto, auto; ver docs/jev.md)"
