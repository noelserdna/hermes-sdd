#!/usr/bin/env bash
# A dónde avisa el encargado. Solo puede enviar por un tema de Telegram enlazado como ruta del gateway: sin ruta, su
# perfil no tiene bot («platform 'telegram' not configured», ni al chat principal; montana8 M8-4, montana9 M9-1).
# Por eso al crearlo se le crea el tema con el bot (como /encargado); y el vigía se rearma, porque Hermes da por visto
# lo que una ronda no pudo entregar (M9-2).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); SRV=; trap '[ -n "$SRV" ] && { kill $SRV; wait $SRV; } 2>/dev/null; rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/bin" "$T/repo" "$T/h/.hermes"
cat > "$T/bin/hermes" <<'H'
#!/usr/bin/env bash
case "$*" in
  "config get gateway.profile_routes --json") cat "$FALSO/rutas" 2>/dev/null || echo '[]' ;;
  "config get platforms.telegram.home_channel.chat_id") cat "$FALSO/home" 2>/dev/null ;;
esac
H
chmod +x "$T/bin/hermes"
e() { FALSO="$T" PATH="$T/bin:$PATH" HOME="$T/h" HERMES_SDD_HOME="$T/sdd" bash "$ROOT/encargado.sh" "$@" "$T/repo" 2>&1; }
B=$(basename "$T/repo")
echo '"12345"' > "$T/home"
[ "$(e destino)" = "local" ] && ok "sin tema enlazado: local, aunque haya chat principal (sin ruta no hay bot)" || bad "sin tema: $(e destino)"
jq -n --arg n "encargado-$B" '[{name:$n, chat_id:"12345", thread_id:"77"}]' > "$T/rutas"
[ "$(e destino)" = "telegram:12345:77" ] && ok "con tema enlazado: a ese tema" || bad "con tema: $(e destino)"
# el tema lo crea el bot de Hermes (createForumTopic en el chat principal) y le da la bienvenida
cat > "$T/api.mjs" <<'JS'
import http from "node:http"; import fs from "node:fs";
http.createServer((q, r) => { let b = ""; q.on("data", d => b += d); q.on("end", () => {
  fs.appendFileSync(process.env.LOG, q.url.replace(/bot[^/]+/, "bot<token>") + " " + b + "\n");
  r.end(JSON.stringify({ ok: true, result: { message_thread_id: 4242, message_id: 1 } })); }); })
  .listen(0, "127.0.0.1", function () { console.log(this.address().port); });
JS
LOG="$T/api.log" node "$T/api.mjs" > "$T/puerto" & SRV=$!
for _ in $(seq 50); do [ -s "$T/puerto" ] && break; sleep 0.1; done
echo "TELEGRAM_BOT_TOKEN=tok-prueba" > "$T/h/.hermes/.env"
o=$(HERMES_SDD_TELEGRAM_API="http://127.0.0.1:$(cat "$T/puerto")" e tema-nuevo)
[ "$o" = "12345 4242" ] && grep -q "createForumTopic .*\"chat_id\": 12345.* $B\"" "$T/api.log" && grep -q "sendMessage .*4242" "$T/api.log" \
  && ! grep -q "tok-prueba" <<< "$o" && ok "tema nuevo: el bot lo crea en el chat principal, da la bienvenida y devuelve chat e hilo" || bad "tema nuevo: $o $(cat "$T/api.log")"
rm -f "$T/home"; o=$(HERMES_SDD_TELEGRAM_API="http://127.0.0.1:$(cat "$T/puerto")" e tema-nuevo); [ $? -ne 0 ] && [ -z "$o" ] \
  && ok "sin chat principal no crea tema" || bad "sin chat principal: $o"
# rearmar: olvida lo visto por el vigía (su monitor_state), sin tocar lo demás del trabajo
mkdir -p "$T/h/.hermes/profiles/sdd-p-$B/cron"
echo '{"jobs":[{"id":"a","name":"vigia","deliver":"local","monitor_state":{"hash":"x"}},{"id":"b","name":"otro","monitor_state":{"hash":"y"}}]}' > "$T/h/.hermes/profiles/sdd-p-$B/cron/jobs.json"
e rearmar >/dev/null
jq -e '(.jobs[0] | has("monitor_state") | not) and .jobs[0].deliver == "local" and .jobs[1].monitor_state.hash == "y"' "$T/h/.hermes/profiles/sdd-p-$B/cron/jobs.json" >/dev/null \
  && ok "rearmar: el vigía olvida lo visto (la próxima ronda despierta al encargado)" || bad "rearmar: $(cat "$T/h/.hermes/profiles/sdd-p-$B/cron/jobs.json")"
exit $fail
