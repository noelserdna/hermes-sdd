#!/usr/bin/env bash
# executors/caja.sh (la caja local: Apple container o Docker) con un «container» FALSO que hace lo que haría la caja,
# sin máquina virtual ni LLM: lo legítimo (commits que descienden del enviado, lo ignorado permitido) se aplica; lo que
# no (una decisión fabricada, un fichero fuera de lo permitido, commits ajenos) no aplica nada. La copia que recibe la
# caja no lleva lo del orquestador (decisiones, puertas, candado). El token nunca va en la línea de órdenes.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
cat > "$T/bin/container" <<'FALSO'
#!/usr/bin/env bash
# container falso: system/image/builder/stop/rm no hacen nada; run hace el trabajo de la caja según $FALSO_CAJA
echo "$*" >> "$FALSO_LOG"
[ "$1" = run ] || exit 0
P=""; S=""; ENVF=""; prev=""
for a in "$@"; do
  case "$prev" in -v) case "$a" in *:/proyecto) P=${a%:/proyecto} ;; *:/salida) S=${a%:/salida} ;; esac ;; --env-file) ENVF=$a ;; esac
  prev=$a
done
cp "$ENVF" "$FALSO_LOG.env" 2>/dev/null
ls -a "$P/.sdd/hermes" > "$FALSO_LOG.contexto" 2>/dev/null
cd "$P"; BASE=$(git rev-parse HEAD); echo "$BASE" > "$S/base"
git -c user.email=c@c -c user.name=caja commit -q --allow-empty -m "feat: trabajo de la caja"
case "${FALSO_CAJA:-bien}" in
  ajeno) git -c user.email=c@c -c user.name=caja checkout -q --orphan otra && git -c user.email=c@c -c user.name=caja commit -q --allow-empty -m "ajeno" ;;
esac
git bundle create "$S/commits.bundle" "$BASE..HEAD" 2>/dev/null || git bundle create "$S/commits.bundle" HEAD 2>/dev/null
: > "$S/pendiente.patch"
mkdir -p .sdd/hermes evidencias; echo nota > .sdd/hermes/nota.txt
case "${FALSO_CAJA:-bien}" in
  decision) mkdir -p .sdd/hermes/decisiones; echo '{"verbo":"acepto"}' > .sdd/hermes/decisiones/falsa.json
            tar czf "$S/ignorados.tgz" --exclude=.sdd/hermes/caja .sdd ;;
  fuera)    echo x > fuera.txt; tar czf "$S/ignorados.tgz" --exclude=.sdd/hermes/caja .sdd fuera.txt ;;
  *)        tar czf "$S/ignorados.tgz" --exclude=.sdd/hermes/caja .sdd evidencias ;;
esac
echo '{"result":"hecho","total_cost_usd":0.01,"num_turns":2,"is_error":false,"session_id":"s"}' > "$S/claude.json"
echo 0 > "$S/rc"
FALSO
chmod +x "$T/bin/container"
proyecto() {  # un repo con lo del orquestador en .sdd/hermes (que la caja no debe recibir)
  local r="$T/$1"; mkdir -p "$r" && cd "$r" && git init -q -b main && git config user.email a@a && git config user.name Ana
  printf '.sdd/\n' > .gitignore; echo hola > README.md; git add -A; git commit -qm init
  mkdir -p .sdd/hermes/decisiones .sdd/hermes/puertas .sdd/hermes/lock; echo '{}' > .sdd/hermes/decisiones/d.json
  echo '{}' > .sdd/hermes/puertas/p.json; echo '{"caja":{"runtime":"container"}}' > .sdd/hermes/hermes-sdd.json
  cd - >/dev/null; echo "$r"
}
corre() {  # corre <repo> <modo> → última línea del ejecutor
  FALSO_CAJA=$2 FALSO_LOG="$T/log" PATH="$T/bin:$PATH" CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-falso \
    HERMES_SDD_CAJA_CACHE="$T/cache" bash "$ROOT/executors/caja.sh" "$1" implementar-0 "haz la tarea" | tail -1
}

r=$(proyecto bien); o=$(corre "$r" bien)
[ "$(echo "$o" | jq -r .outcome)" = done ] && git -C "$r" log -1 --format=%s | grep -q "trabajo de la caja" && [ -f "$r/.sdd/hermes/nota.txt" ] \
  && ok "lo legítimo se aplica: commits de la caja y lo ignorado permitido" || bad "bien: $o"
! grep -qE '^(decisiones|puertas|lock)$' "$T/log.contexto" && grep -q 'caja' "$T/log.contexto" \
  && ok "la copia que recibe la caja no lleva decisiones, puertas ni candado" || bad "contexto: $(tr '\n' ' ' < "$T/log.contexto")"
grep -q "sk-ant-oat01-falso" "$T/log" && bad "el token aparece en la línea de órdenes del contenedor" || ok "el token no va en la línea de órdenes"
grep -q "CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-falso" "$T/log.env" 2>/dev/null && ok "el token llega a la caja por un fichero de entorno" || bad "sin token en la caja"
[ ! -e "$T/log.env.missing" ] && ! ls "$T"/tmp.* >/dev/null 2>&1 && ok "el fichero de entorno con el token no queda en disco" || bad "queda el fichero del token"
grep -q -- "--mount type=bind,source=$ROOT,target=/arnes,readonly" "$T/log" && ok "el arnés entra en la caja en solo lectura" || bad "arnés: $(grep '^run' "$T/log" | tail -1)"

for modo in decision fuera ajeno; do
  r=$(proyecto "$modo"); antes=$(git -C "$r" rev-parse HEAD); o=$(corre "$r" "$modo")
  [ "$(echo "$o" | jq -r .outcome)" = failed ] && [ "$(git -C "$r" rev-parse HEAD)" = "$antes" ] && [ ! -f "$r/.sdd/hermes/decisiones/falsa.json" ] \
    && ok "caja que devuelve «${modo}»: no se aplica nada ($(echo "$o" | jq -r .reason | cut -c1-70))" || bad "$modo: $o"
done
[ $fail = 0 ] && echo "tests/caja-local.sh: all passed"
exit $fail
