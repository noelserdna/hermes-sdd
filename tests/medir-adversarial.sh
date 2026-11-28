#!/usr/bin/env bash
# evals/medir/adversarial.sh (M2c): la ronda adversarial de aceptar, sola, sobre una copia del banco con un defecto
# sembrado. Sin modelo: --seco prepara la copia y el prompt, y un ejecutor falso (mismo contrato que executors/caja.sh)
# añade una impugnación a la copia. Comprueba que el prompt es el de la ronda completa de etapa.sh (no el incremental),
# que la copia lleva el parche en su último commit y lo de la etapa ignorado, que se recogen solo las impugnaciones
# nuevas con su coste, y que el banco no se toca.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
M="$ROOT/evals/medir/adversarial.sh"
[ -f "$M" ] || { bad "no existe evals/medir/adversarial.sh"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
B="$ROOT/tests/fixtures/banco"; ANTES=$(cd "$B" && find . -type f -newer "$M" | wc -l)

bash "$M" --defecto P-07-guarda-de-titular --fase 1 --salida "$T/seco" --seco > /dev/null 2>"$T/err" || bad "--seco sale con error: $(tail -3 "$T/err")"
P="$T/seco/prompt.txt"
grep -q '^/sdd-acceptance --adversarial --fase 1 — Modo arnés (hermes-sdd)' "$P" && ok "prompt de la ronda adversarial de la FASE-1 con el texto ARNES" || bad "prompt inesperado: $(head -c 200 "$P")"
grep -q 'One verifier is dedicated to captures' "$P" && grep -q 'TESTS ALREADY RUN' "$P" && grep -q 'Project wiki: ' "$P" &&
  ok "lleva la línea de fidelidad(), no_repitas() y la wiki de etapa.sh" || bad "faltan piezas del prompt de etapa.sh"
grep -q 'INCREMENTAL ROUND' "$P" && bad "el prompt es el de la ronda incremental" || ok "ronda completa (sin INCREMENTAL ROUND)"
C="$T/seco/copia"
[ "$(git -C "$C" log -1 --format=%s)" = "sembrado P-07-guarda-de-titular.patch" ] && ok "el parche es el último commit de la copia" || bad "la copia no lleva el parche en su último commit"
git -C "$C" diff --quiet HEAD~1 HEAD -- src/server/servicios/prestamos.js && bad "el commit sembrado no cambia prestamos.js" || ok "el commit sembrado cambia src/server/servicios/prestamos.js"
[ "$(git -C "$C" check-ignore .sdd/junit evidencias pipeline-state.json | wc -l | tr -d " ")" = 3 ] && [ -z "$(git -C "$C" status --porcelain --untracked-files=no)" ] &&
  ok ".sdd/, evidencias/ y pipeline-state.json ignorados y árbol limpio (como lo deja etapa.sh)" || bad "la copia no queda como un proyecto real"
jq -e '.defecto == "P-07-guarda-de-titular" and .proyecto == "material-montana12" and .fase == 1 and .seco == true and .nuevas == 0 and (.commit_arnes | length) == 40' "$T/seco/meta.json" >/dev/null &&
  ok "meta.json en seco" || bad "meta.json en seco: $(cat "$T/seco/meta.json")"

# ejecutor falso: comprueba lo que recibe y deja una impugnación en la copia
cat > "$T/falso.sh" <<'EOF'
#!/usr/bin/env bash
cd "$1" || exit 1
{ echo "nombre=$2"; echo "modelo=$4"; echo "paso=${SDD_PASO:-}"; echo "tope=${SDD_TOPE_USD:-}"; } > "$FALSO_LOG"
echo '{"id":"CH-999","req":"REQ-F-004","ac":1,"category":"BYPASS-PATH","quote":"q","why":"cancela la de otro"}' >> acceptance/challenges.jsonl
echo 'ruido'
echo '{"outcome":"done","reason":"ok","run":"r","cost_usd":1.25,"minutes":7,"turns":30}'
EOF
FALSO_LOG="$T/falso.log" bash "$M" --defecto P-07-guarda-de-titular --fase 1 --rep 2 --salida "$T/r" --ejecutor "$T/falso.sh" --tope-usd 4 > /dev/null 2>"$T/err2" ||
  bad "con ejecutor sale con error: $(tail -3 "$T/err2")"
grep -qx 'nombre=aceptar-1' "$T/falso.log" && grep -qx 'modelo=sonnet' "$T/falso.log" && grep -qx 'paso=acceptance' "$T/falso.log" && grep -qx 'tope=4' "$T/falso.log" &&
  ok "el ejecutor recibe aceptar-1, sonnet, SDD_PASO=acceptance y SDD_TOPE_USD" || bad "el ejecutor recibe: $(tr '\n' ' ' < "$T/falso.log" 2>/dev/null)"
[ "$(grep -c . "$T/r/impugnaciones.jsonl")" = 1 ] && jq -e '.id == "CH-999"' "$T/r/impugnaciones.jsonl" >/dev/null &&
  ok "recoge solo la impugnación nueva" || bad "impugnaciones.jsonl: $(head -c 300 "$T/r/impugnaciones.jsonl")"
jq -e '.nuevas == 1 and .rep == 2 and .coste_usd == 1.25 and .minutos == 7 and .outcome == "done" and .seco == false' "$T/r/meta.json" >/dev/null &&
  ok "meta.json con nuevas, coste y minutos" || bad "meta.json: $(cat "$T/r/meta.json")"

bash "$M" --limpia material-montana11 --fase 0 --salida "$T/l" --seco > /dev/null 2>&1 && [ "$(git -C "$T/l/copia" rev-list --count HEAD)" = 1 ] &&
  ok "--limpia: la copia es el banco sin parche" || bad "--limpia no da la copia limpia"
bash "$M" --defecto P-99 --fase 1 --salida "$T/x" --seco > /dev/null 2>&1 && bad "acepta un defecto que no existe" || ok "rechaza un defecto que no existe"
bash "$M" --defecto P-07-guarda-de-titular --fase 9 --salida "$T/x" --seco > /dev/null 2>&1 && bad "acepta una FASE que no existe" || ok "rechaza una FASE que no existe"
[ "$(cd "$B" && find . -type f -newer "$M" | wc -l)" = "$ANTES" ] && ok "el banco no se toca" || bad "algo escribió en el banco"
exit $fail
