#!/usr/bin/env bash
# Encadenado idempotente: el notario puede repetir «lanzar.sh siguiente/cambio» tras caerse entre crear las tarjetas y
# apuntarlo en el acta. Con ORIGEN («puerta <id>») la segunda vez no crea tarjetas nuevas ni otro INT.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/repo"; mkdir -p "$R/plan/fases" "$R/.sdd/hermes/puertas"; cd "$R"; git init -q -b main
g() { git -c user.email=t@t -c user.name=t "$@"; }
touch plan/fases/FASE-0-x.md plan/fases/FASE-1-y.md; echo fina > .sdd/hermes/granularidad-plan
g add -A >/dev/null; g commit -qm init

# kanban falso que recuerda lo creado (título y cuerpo) y lo devuelve en list --json
mkdir -p "$T/bin"; echo '[]' > "$T/tarjetas.json"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
F="$T/tarjetas.json"
case "\$1 \$2" in
  "kanban boards") echo '[{"slug":"repo"}]'; exit 0 ;;
esac
[ "\$1" = kanban ] || exit 1
shift 3   # kanban --board <b>
case "\$1" in
  list) cat "\$F" ;;
  create)
    shift; titulo=\$1; shift; cuerpo=""
    while [ \$# -gt 0 ]; do [ "\$1" = --body ] && cuerpo=\$2; shift; done
    n=\$(( \$(jq length "\$F") + 1 ))
    jq --arg id "t\$n" --arg t "\$titulo" --arg b "\$cuerpo" '. + [{id:\$id, title:\$t, body:\$b, status:"todo", assignee:"sdd-estacion"}]' "\$F" > "\$F.t" && mv "\$F.t" "\$F"
    echo "{\"id\":\"t\$n\"}" ;;
  *) exit 0 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"

echo '{"tipo":"plan"}' > .sdd/hermes/puertas/p1.json
ORIGEN="puerta p1" bash "$ROOT/lanzar.sh" siguiente "$R" p1 conforme >/dev/null
n1=$(jq length "$T/tarjetas.json")
ORIGEN="puerta p1" bash "$ROOT/lanzar.sh" siguiente "$R" p1 conforme >/dev/null
n2=$(jq length "$T/tarjetas.json")
[ "$n1" = 2 ] && [ "$n2" = 2 ] && ok "repetir el encadenado de una puerta no duplica sus tarjetas ($n1 → $n2)" || bad "duplicado: $n1 → $n2 $(jq -c '[.[].title]' "$T/tarjetas.json")"
jq -e '.[0].body | split("\n") | .[0] == "Origen: puerta p1 · Implementar FASE-0" and (.[1] | startswith("Ejecuta: bash "))' "$T/tarjetas.json" >/dev/null \
  && ok "la tarjeta lleva su origen antes de la línea Ejecuta" || bad "cuerpo: $(jq -c '.[0].body' "$T/tarjetas.json")"
# otra puerta (otro origen) sí crea su tramo; sin ORIGEN (a mano) también
echo '{"tipo":"plan"}' > .sdd/hermes/puertas/p2.json
ORIGEN="puerta p2" bash "$ROOT/lanzar.sh" siguiente "$R" p2 conforme >/dev/null
[ "$(jq length "$T/tarjetas.json")" = 4 ] && ok "otra puerta crea su propio tramo" || bad "otra puerta: $(jq length "$T/tarjetas.json")"
bash "$ROOT/lanzar.sh" reintentar "$R" requisitos >/dev/null
[ "$(jq length "$T/tarjetas.json")" = 5 ] && ok "sin origen (a mano) se crea siempre" || bad "sin origen: $(jq length "$T/tarjetas.json")"
# una tarjeta archivada con ese origen no cuenta (el tramo se rehízo)
jq 'map(if .id == "t1" or .id == "t2" then .status = "archived" else . end)' "$T/tarjetas.json" > "$T/x" && mv "$T/x" "$T/tarjetas.json"
ORIGEN="puerta p1" bash "$ROOT/lanzar.sh" siguiente "$R" p1 conforme >/dev/null
[ "$(jq length "$T/tarjetas.json")" = 7 ] && ok "si las del origen están archivadas, se crean de nuevo" || bad "archivadas: $(jq length "$T/tarjetas.json")"

# cambio de requisitos: el mismo origen reutiliza su INT (antes: INT-002, INT-003… y un commit por vez)
ORIGEN="puerta f7" bash "$ROOT/lanzar.sh" cambio "$R" "quiero otra cosa" >/dev/null
ORIGEN="puerta f7" bash "$ROOT/lanzar.sh" cambio "$R" "quiero otra cosa" >/dev/null
[ "$(ls intent | wc -l | tr -d ' ')" = 1 ] && [ "$(git log --oneline | grep -c 'docs(intent)')" = 1 ] && [ "$(cat .sdd/hermes/cambio-actual)" = INT-001 ] \
  && ok "repetir un cambio con el mismo origen no abre otro INT ni otro commit" || bad "cambio: $(ls intent) $(git log --oneline | head -3)"
[ "$(jq '[.[] | select(.title == "Cambio INT-001")] | length' "$T/tarjetas.json")" = 1 ] && ok "ni otra tarjeta de cambio" || bad "tarjeta cambio"
bash "$ROOT/lanzar.sh" cambio "$R" "otra petición distinta" >/dev/null
[ "$(ls intent | wc -l | tr -d ' ')" = 2 ] && ok "un cambio sin origen (/cambio) abre su INT" || bad "cambio sin origen: $(ls intent)"

# el número de entrega queda fijado en el acta (al reanudar no se cuenta otra vez)
grep -q 'entrega_n // empty' "$ROOT/firmar.sh" && ok "firmar.sh fija el número de la entrega en el acta" || bad "entrega_n"
exit $fail
