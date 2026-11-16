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
