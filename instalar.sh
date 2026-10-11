#!/usr/bin/env bash
# Instala el arnés hermes-sdd en este Mac (una vez; se puede repetir para actualizar).
#
#   bash instalar.sh
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
VERSION=$(jq -r .version "$SRC/metodo/.claude-plugin/plugin.json")
DEST="$HOME_SDD/$VERSION"
P=sdd-estacion

echo "· Arnés $VERSION → $DEST"
mkdir -p "$DEST" "$HOME_SDD/puertas" "$HOME_SDD/actas"
rsync -a --delete --exclude .git "$SRC/" "$DEST/"
ln -sfn "$DEST" "$HOME_SDD/actual"
jq -n --arg r "$HOME_SDD/actual" --arg v "$VERSION" '{root:$r, version:$v}' > "$HOME_SDD/instalacion.json"

if [ ! -f "$HOME_SDD/aprobadores.json" ]; then
  TG=$(grep '^TELEGRAM_ALLOWED_USERS=' "$HH/.env" 2>/dev/null | cut -d= -f2- | cut -d, -f1 | tr -d ' "' || true)
  jq -n --arg n "$(git config user.name || echo "$USER")" --arg tg "$TG" --arg u "$USER" \
    '{yo: {nombre:$n, rol:"Cliente", canales: ({local:$u} + (if $tg != "" then {telegram:$tg} else {} end))}}' \
    > "$HOME_SDD/aprobadores.json"
  echo "· aprobadores.json creado (tú; Telegram: $([ -n "$TG" ] && echo sí || echo 'no encontrado'))"
fi

echo "· Plugin de Telegram"
rm -rf "$HH/plugins/hermes-sdd"; mkdir -p "$HH/plugins"
cp -R "$DEST/plugin/hermes-sdd" "$HH/plugins/hermes-sdd"
hermes plugins enable hermes-sdd >/dev/null 2>&1 || echo "  AVISO: activa el plugin con: hermes plugins enable hermes-sdd"

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
  '["*accept record*","*git tag*","*update-ref*","*route --write*","*git push*","*firmar.sh*","*decidir.sh*","*hermes kanban*","*sqlite3*"]' >/dev/null

[ "$(hermes config get kanban.auto_decompose 2>/dev/null | tail -1)" = false ] ||
  echo "  AVISO: kanban.auto_decompose está activo; desactívalo con: hermes config set kanban.auto_decompose false"
echo "Listo. Reinicia el gateway para cargar el plugin: hermes gateway restart"
