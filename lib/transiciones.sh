# Consultas a la tabla de transiciones de las puertas (lib/transiciones.json): qué verbos valen por tipo, a qué
# resultado lleva cada uno y qué tramo lanza cada resultado. Las usan firmar.sh y lanzar.sh; la tabla es lo único que
# dice el mapa, el código de cada paso sigue en su script. Se carga con «. "$ROOT/lib/transiciones.sh"» (necesita $ROOT).
TRANSICIONES="${ROOT:?lib/transiciones.sh necesita ROOT}/lib/transiciones.json"

# entrada($mapa; $clave): la de esa clave o, si no está, la de un comodín «prefijo*» que case (ruta-* → ruta-normal)
_TRANS_JQ='def entrada($m; $k): if ($m | has($k)) then $m[$k]
  else first($m | to_entries[] | .key as $p | select(($p | endswith("*")) and ($k | startswith($p[:-1]))) | .value) // null end;
def con_verbo($v): if type == "string" then gsub("\\{verbo\\}"; $v) else . end;'

trans_verbo() {  # trans_verbo <tipo> <verbo>: la entrada del verbo (JSON en una línea); sale con 1 si no vale para ese tipo
  jq -ce --arg t "$1" --arg v "$2" "$_TRANS_JQ"'
    entrada(.puertas[$t].verbos // {}; $v) | select(. != null) | map_values(con_verbo($v))' "$TRANSICIONES"
}

trans_campo() {  # trans_campo <tipo> <verbo> <campo>: un campo de la entrada del verbo (vacío si no lo tiene)
  jq -r --arg t "$1" --arg v "$2" --arg c "$3" "$_TRANS_JQ"'
    (entrada(.puertas[$t].verbos // {}; $v) // {})[$c] // empty | con_verbo($v) | if type == "array" then join(" ") else tostring end' "$TRANSICIONES"
}

trans_tiene() {  # trans_tiene <tipo> <verbo> <campo> <valor>: ¿la lista <campo> del verbo incluye <valor>? (respuestas)
  jq -e --arg t "$1" --arg v "$2" --arg c "$3" --arg x "$4" "$_TRANS_JQ"'
    (entrada(.puertas[$t].verbos // {}; $v) // {})[$c] // [] | index($x) != null' "$TRANSICIONES" >/dev/null
}

trans_destino() {  # trans_destino <tipo> <resultado>: la entrada del resultado ({tramo, negativo, mensaje}); 1 si no hay
  jq -ce --arg t "$1" --arg r "$2" "$_TRANS_JQ"'
    entrada(.puertas[$t].resultados // {}; $r) | select(. != null)' "$TRANSICIONES"
}
