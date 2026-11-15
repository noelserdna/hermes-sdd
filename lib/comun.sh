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
