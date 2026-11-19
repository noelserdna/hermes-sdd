#!/usr/bin/env bash
# encargado.sh destino: a dónde avisa el vigía. Con tema propio, a ese tema; sin tema, al chat principal; sin chat
# principal, en local. Nunca «telegram» a secas: en el perfil del encargado no tiene destino y cada ronda fallaba
# sin que el encargado llegara a actuar (montana8, M8-4).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/bin" "$T/repo"
cat > "$T/bin/hermes" <<'H'
#!/usr/bin/env bash
case "$*" in
  "config get gateway.profile_routes --json") cat "$FALSO/rutas" 2>/dev/null || echo '[]' ;;
  "config get platforms.telegram.home_channel.chat_id") cat "$FALSO/home" 2>/dev/null ;;
esac
H
chmod +x "$T/bin/hermes"
d() { FALSO="$T" PATH="$T/bin:$PATH" HERMES_SDD_HOME="$T/sdd" bash "$ROOT/encargado.sh" destino "$T/repo" 2>&1; }
B=$(basename "$T/repo")
echo '"12345"' > "$T/home"
[ "$(d)" = "telegram:12345" ] && ok "sin tema propio: al chat principal" || bad "sin tema: $(d)"
jq -n --arg n "encargado-$B" '[{name:$n, chat_id:"12345", thread_id:"77"}]' > "$T/rutas"
[ "$(d)" = "telegram:12345:77" ] && ok "con tema propio: a ese tema" || bad "con tema: $(d)"
rm -f "$T/rutas" "$T/home"
[ "$(d)" = "local" ] && ok "sin tema ni chat principal: local (nunca «telegram» a secas)" || bad "sin nada: $(d)"
exit $fail
