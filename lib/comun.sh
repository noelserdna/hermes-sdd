# Lo común a los scripts del arnés que también necesita el plugin: una sola definición, en hsdd_nucleo.py, para que
# bash y Python no discrepen (antes el slug del tablero y «¿plan de una sola FASE?» estaban copiados en varios
# scripts y en el plugin, con matices distintos). Se carga con «. "$ROOT/lib/comun.sh"» (necesita $ROOT).
NUCLEO_PY="${ROOT:?lib/comun.sh necesita ROOT}/plugin/hermes-sdd/hsdd_nucleo.py"

slug() {  # slug <nombre>: el nombre del tablero de un proyecto (minúsculas sin tildes; lo demás, guiones)
  python3 "$NUCLEO_PY" slug "$1"
}

unica() {  # unica <repo>: ¿plan de una sola FASE, aún sin aceptar y no «fino»? (se acepta con la entrega)
  python3 "$NUCLEO_PY" unica "$1"
}

# Entrega parcial (lanzar.sh entregar): .sdd/hermes/entrega-parcial lleva las FASEs aceptadas que se entregan, y la
# puerta de calidad de la entrega es la de cada una de esas FASEs (todas 0 o 3), no la global: lo que aún no se hizo
# no cuenta como hueco (material-montana: se cortó tras la FASE-2 y no había forma de entregar lo aceptado).
parcial() { [ -s .sdd/hermes/entrega-parcial ]; }   # (en el repo)
gate_entrega() {  # gate_entrega [--md]: como «sdd gate», global o FASE a FASE si la entrega es parcial
  local sdd="$ROOT/metodo/scripts/sdd.mjs"
  if ! parcial; then node "$sdd" gate "$@"; return; fi
  local n r peor=0
  for n in $(cat .sdd/hermes/entrega-parcial); do
    r=0; node "$sdd" gate --fase "$n" "$@" || r=$?
    [ "$#" -gt 0 ] && echo
    if [ "$r" != 0 ] && [ "$r" != 3 ]; then { [ "$peor" = 0 ] || [ "$peor" = 3 ]; } && peor=$r
    elif [ "$r" = 3 ] && [ "$peor" = 0 ]; then peor=3; fi
  done
  return "$peor"
}

# duras_implementar: una línea por regla dura que el código de la FASE incumple (vacío si ninguna)
perfil() { cat AGENTS.md CLAUDE.md 2>/dev/null | grep -m1 -E "^- $1:" | sed -E "s/^- $1: *//"; }
duras_implementar() {  # usa $SDD, $FASE y $ROOT; en el directorio del repo
  local ce l a t
  # capturas: solo los errores estáticos (con línea); los del ledger dependen del último JUnit (material-montana2, M13)
  ce=$(node "$SDD" lint --captures --fase "$FASE" --json 2>/dev/null | jq -r '.findings[]? | select(.severity == "error" and ((.line // 0) > 0 or .code == "C-07" or .code == "C-08"))
    | "sdd lint --captures: \(.file):\(.line) \(.code) \(.message[0:160])"' 2>/dev/null | head -5)
  [ -n "$ce" ] && printf '%s\n' "$ce"
  # A-03 (tests que fijan la lista cerrada de pantallas o del menú) solo en ficheros nuevos desde la última FASE aceptada
  local desde; desde=$(git describe --tags --abbrev=0 --match 'fase-*-accepted' 2>/dev/null || true)
  a=$(node "$SDD" lint --arch ${desde:+--since "$desde"} --json 2>/dev/null | jq -r '.findings[]? | select(.severity == "error") | "sdd lint --arch: \(.file):\(.line) \(.code) \(.message[0:160])"' 2>/dev/null | head -5)
  [ -n "$a" ] && printf '%s\n' "$a"
  if [ -n "$(perfil lint)" ] && [ -f package.json ] && jq -e '.scripts.lint' package.json >/dev/null 2>&1; then
    if [ -x node_modules/.bin/eslint ] || [ "$(perfil lint)" != "npm run lint" ]; then l=$(eval "$(perfil lint)" 2>&1) || printf 'lint (%s): %s\n' "$(perfil lint)" "$(printf '%s' "$l" | grep -E 'error' | head -3 | tr '\n' ' ')"
    else l=$(npx --yes eslint@9.17.0 . 2>&1) || printf 'lint (eslint): %s\n' "$(printf '%s' "$l" | grep -E 'error' | head -3 | tr '\n' ' ')"; fi
  fi
  t=$(ls "$ROOT"/templates/stacks/*/tests/e2e/fixtures/evidence.js 2>/dev/null | head -1)
  if [ -f tests/e2e/fixtures/evidence.js ] && [ -n "$t" ] && grep -q 'Plantilla del arnés' tests/e2e/fixtures/evidence.js && ! cmp -s "$t" tests/e2e/fixtures/evidence.js; then
    echo "tests/e2e/fixtures/evidence.js cambió: es la plantilla del arnés (captura, vídeo y locución) y no se toca"
  fi
  return 0
}

# narrar_demo <fase>: la voz en off de los vídeos narrados de la FASE (sdd demo narrate, en esta máquina: say o
# espeak-ng y ffmpeg) → evidencias/FASE-N/*.mp4, el vídeo que se ve en la puerta y en Telegram. Sin TTS, mp4 sin voz.
narrar_demo() {
  case "$(perfil narration)" in required|warn) ;; *) return 0 ;; esac
  node "$SDD" demo narrate --fase "$1" > .sdd/hermes/demo-narrada-$1.txt 2>&1 || true
  # y el montaje: todos los criterios de la FASE seguidos, en el orden del guion (lo que enseña la puerta)
  node "$SDD" demo montaje --fase "$1" >> .sdd/hermes/demo-narrada-$1.txt 2>&1 || true
}
# montaje_entrega: los montajes de todas las FASEs en evidencias/ENTREGA/MONTAJE-ENTREGA.mp4 (la demo de la entrega:
# con ella la acepta una persona que la ve; material-montana11: sin demo, Jev la aceptó a los 14 s)
montaje_entrega() {
  case "$(perfil narration)" in required|warn) ;; *) return 0 ;; esac
  node "$SDD" demo montaje --entrega > .sdd/hermes/demo-entrega.txt 2>&1 || true
}
