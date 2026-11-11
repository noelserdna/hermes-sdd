#!/usr/bin/env bash
# Tarjetas de etapa resueltas en otro intento (coches, 11/11/2026: «Tareas» bloqueada seguía a la vista con el proyecto
# entregado): lanzar.sh limpiar las comenta y archiva; etapa.sh lo hace al terminar bien.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/demo"; mkdir -p "$R" "$T/bin"
c() { jq -nc --arg i "$1" --arg s "$2" --arg e "$3" --argjson t "$4" --arg a "${5:-sdd-estacion}" \
  '{id:$i, title:$i, status:$s, assignee:$a, created_at:$t, body:("Ejecuta: bash /x/etapa.sh '"$R"' " + $e)}'; }
{ c viejo blocked "tareas" 1; c hijo todo "aceptar 0" 2; c impl-viejo blocked "implementar 0" 2
  c nuevo done "tareas" 3; c acep done "aceptar 0" 4; c impl-otra blocked "implementar 1" 5
  c puerta blocked "tareas" 1 nadie ; c cambio blocked "cambio" 6; } | jq -s . > "$T/cartas.json"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
case "\$*" in
  *" list --json") cat "$T/cartas.json" ;;
  *" comment "*) echo "\$5|\$6" >> "$T/comentarios" ;;
  *" archive "*) echo "\$5" >> "$T/archivadas" ;;
  *) exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"
o=$(bash "$ROOT/lanzar.sh" limpiar "$R")
a=$(sort "$T/archivadas" 2>/dev/null | tr '\n' ' ')
[ "$a" = "hijo viejo " ] && ok "archiva la bloqueada resuelta después y la que esperaba por un intento viejo" || bad "archivadas: $a"
grep -q '^viejo|Obsoleta: .*nuevo' "$T/comentarios" && ok "deja un comentario que dice dónde se resolvió" || bad "comentario: $(cat "$T/comentarios")"
echo "$a" | grep -qE "impl-otra|puerta|cambio|impl-viejo" && bad "archivó algo sin resolver" \
  || ok "no toca: otra FASE, una puerta, una etapa sin nuevo intento, ni la bloqueada sin intento posterior terminado"
echo "$o" | grep -q "archivada viejo (resuelta en nuevo)" && ok "dice qué archivó" || bad "salida: $o"
exit $fail
