#!/usr/bin/env bash
# Encargado, fase 5 (lecciones entre proyectos): con evidencia que exista, generales, confirmadas por una persona,
# usadas en las etapas de otros proyectos y revisadas tras 3 usos.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
L="$ROOT/plugin/hermes-sdd/hsdd_lecciones.py"
nuevo() { mkdir -p "$T/$1/.sdd/hermes"; git -C "$T/$1" init -q -b main; git -C "$T/$1" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "feat: algo"; }
nuevo origen; nuevo otro1; nuevo otro2; nuevo otro3
jq -n --arg r "$T/origen" '{id:"g0123456789ab", tablero:"origen", repo:$r, titulo:"Aceptar FASE-1", estado:"firmada", decision:{verbo:"rechazo"}}' > "$HERMES_SDD_HOME/puertas/g0123456789ab.json"
REGLA="Ningún criterio de una FASE debe depender de una pantalla que entrega una FASE posterior"

o=$(python3 "$L" proponer "$T/origen" plan "$REGLA" g0123456789ab 2>&1)
echo "$o" | grep -q "L-001 propuesta" && echo "$o" | grep -q "Aceptar FASE-1: firmada (rechazo)" && ok "propone con una evidencia que existe (la puerta rechazada)" || bad "proponer: $o"
o=$(python3 "$L" proponer "$T/origen" plan "Regla general cualquiera bien escrita" gffffffffffff 2>&1) && bad "acepta sin evidencia" || { echo "$o" | grep -q "evidencia" && ok "sin evidencia que exista: no" || bad "evidencia: $o"; }
o=$(python3 "$L" proponer "$T/origen" plan "En origen hay que mover los criterios" g0123456789ab 2>&1) && bad "acepta el nombre del proyecto" || ok "con el nombre del proyecto: no (no sería general)"
o=$(python3 "$L" proponer "$T/origen" plan "El criterio de REQ-F-004 no puede citar pantallas" g0123456789ab 2>&1) && bad "acepta un id del proyecto" || ok "con ids del proyecto (REQ-F-…): no"
o=$(python3 "$L" proponer "$T/origen" volar "$REGLA otra" g0123456789ab 2>&1) && bad "acepta una etapa inventada" || ok "etapa desconocida: no"

[ -z "$(python3 "$L" para-etapa plan --repo "$T/otro1" --registrar)" ] && ok "sin confirmar no llega a ninguna etapa" || bad "propuesta usada"
python3 "$L" decidir L-001 confirmar Ana >/dev/null
o=$(python3 "$L" para-etapa plan --repo "$T/otro1" --registrar)
echo "$o" | grep -q "\[L-001\] $REGLA" && ok "confirmada: llega al prompt de su etapa en otro proyecto" || bad "para-etapa: $o"
[ -z "$(python3 "$L" para-etapa tareas --repo "$T/otro1")" ] && ok "…y solo a su etapa" || bad "otra etapa"
python3 "$L" para-etapa plan --repo "$T/origen" --registrar >/dev/null; python3 "$L" para-etapa plan --repo "$T/otro1" --registrar >/dev/null
python3 "$L" para-etapa plan --repo "$T/otro2" --registrar >/dev/null
[ "$(python3 "$L" listar confirmada | cut -d' ' -f1)" = L-001 ] && ok "2 proyectos (el de origen y repetir no cuentan): sigue confirmada" || bad "usos: $(python3 "$L" listar)"
python3 "$L" para-etapa plan --repo "$T/otro3" --registrar >/dev/null
[ "$(python3 "$L" listar revisar | cut -d' ' -f1)" = L-001 ] && ok "al tercer proyecto pasa a «revisar» (decide una persona)" || bad "revisar: $(python3 "$L" listar)"
python3 "$L" decidir L-001 mantener Ana >/dev/null
[ "$(python3 "$L" listar confirmada | cut -d' ' -f1)" = L-001 ] && ok "mantener: vuelve a confirmada (y cuenta otros 3 usos desde ahí)" || bad "mantener"
o=$(python3 "$L" decidir L-001 confirmar Ana 2>&1) && bad "confirma dos veces" || ok "no se decide dos veces lo mismo"
HIST=$(git -C "$HERMES_SDD_HOME/lecciones" log --oneline); grep -q "L-001 confirmada por Ana" <<< "$HIST" && grep -q "L-001" "$HERMES_SDD_HOME/lecciones/LECCIONES.md" \
  && ok "todo queda en el repositorio git de lecciones y en LECCIONES.md" || bad "git"
exit $fail
