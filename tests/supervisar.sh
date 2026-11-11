#!/usr/bin/env bash
# Encargado, fase 3 (supervisar y arreglar): el vigía (sin LLM) y las acciones de encargado.sh.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/demo"
mkdir -p "$T/bin"; echo 10 > "$T/n"; : > "$T/log"
# kanban falso: t_1 (Implementar FASE-2, parada) con una hija t_2 (Aceptar FASE-2, esperando)
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
echo "\$*" >> "$T/log"
case "\$*" in
  "kanban boards list --json") echo '[{"slug":"demo"}]' ;;
  "kanban --board demo list --json") cat <<J
[{"id":"t_1","title":"Implementar FASE-2","status":"blocked","assignee":"sdd-estacion","created_at":1,"last_failure_error":"quedan tareas de la FASE-2 sin hacer","body":"Ejecuta: bash /x/etapa.sh $R implementar 2"},
 {"id":"t_2","title":"Aceptar FASE-2","status":"todo","assignee":"sdd-estacion","created_at":2,"body":"Ejecuta: bash /x/etapa.sh $R aceptar 2"}]
J
  ;;
  "kanban --board demo show t_1 --json") echo '{"task":{"id":"t_1","status":"blocked","body":"Ejecuta: bash /x/etapa.sh $R implementar 2"},"children":["t_2"]}' ;;
  "kanban --board demo create "*) n=\$(( \$(cat "$T/n") + 1 )); echo \$n > "$T/n"; echo "{\"id\":\"t_\$n\"}" ;;
  "kanban --board demo "*) ;;   # link, unlink, comment, archive
  *) echo "hermes falso: \$*" >&2; exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"
mkdir -p "$R/.sdd/hermes"; cd "$R"; git init -q -b main; git config user.email t@t; git config user.name t
printf ".sdd/\nwiki/\n" > .gitignore; echo base > a.txt; git add a.txt .gitignore; git commit -qm base

# 1. vigía: la etapa parada, con su motivo
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$R")
[ "$o" = "PARADA | Implementar FASE-2 (t_1) | quedan tareas de la FASE-2 sin hacer" ] && ok "vigía: una etapa parada, con su motivo (salida estable)" || bad "vigía: $o"

# 2. reintentar: en seco no toca nada; de verdad crea la nueva y le pasa la hija; una sola vez
o=$(bash "$ROOT/encargado.sh" reintentar "$R" t_1 --seco 2>&1)
echo "$o" | grep -q "(en seco) reintentaría implementar FASE-2" && ! grep -q "create" "$T/log" && ok "reintentar --seco: dice qué haría y no crea nada" || bad "seco: $o"
o=$(bash "$ROOT/encargado.sh" reintentar "$R" t_1 2>&1)
grep -q "kanban --board demo link t_11 t_2" "$T/log" && grep -q "kanban --board demo unlink t_1 t_2" "$T/log" && echo "$o" | grep -q "t_1 → t_11" \
  && ok "reintentar: tarjeta nueva y la hija (Aceptar FASE-2) pasa a esperarla" || bad "reintentar: $o $(cat "$T/log")"
o=$(bash "$ROOT/encargado.sh" reintentar "$R" t_1 2>&1) && bad "reintenta dos veces" || { echo "$o" | grep -q "ya reintenté t_1 una vez" && ok "reintentar otra vez la misma: no (decide la persona)" || bad "segunda: $o"; }
grep -q '"accion":"reintentar"' .sdd/hermes/encargado-acciones.jsonl && ok "la acción queda anotada en encargado-acciones.jsonl" || bad "sin anotar"

# 3. apartar: los restos sin commit van a un stash con nombre, no se pierden
echo cambio >> a.txt; echo nuevo > b.txt
o=$(bash "$ROOT/encargado.sh" apartar "$R" 2>&1)
[ -z "$(git status --porcelain)" ] && git stash list | grep -q "encargado: restos sin commit" && git stash show -p --include-untracked stash@{0} 2>/dev/null | grep -q "nuevo" \
  && ok "apartar: restos (también los nuevos) a un stash con nombre; el árbol queda limpio" || bad "apartar: $o $(git status --short)"

# 4. una puerta pendiente impide reintentar (un commit le impediría firmarse)
jq -n --arg r "$R" '{id:"g1", tablero:"demo", estado:"abierta", repo:$r, titulo:"Aceptar FASE-1"}' > "$HERMES_SDD_HOME/puertas/g1.json"
sed -i.bak '/reintentar/d' .sdd/hermes/encargado-acciones.jsonl && rm -f .sdd/hermes/encargado-acciones.jsonl.bak
o=$(bash "$ROOT/encargado.sh" reintentar "$R" t_1 2>&1) && bad "reintenta con una puerta abierta" || { echo "$o" | grep -q "puerta pendiente" && ok "con una puerta pendiente no reintenta" || bad "puerta: $o"; }
# 5. en preparación, lo que hay sin commit es la entrada del encargado: ni es «restos» ni se aparta
rm -f "$HERMES_SDD_HOME/puertas/g1.json"; touch .sdd/hermes/preparando; mkdir -p requirements; echo "1. algo" > requirements/REQUIREMENTS.md
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$R"); echo "$o" | grep -q "RESTOS" && bad "vigía: la entrada en preparación como restos" || ok "en preparación, la entrada sin commit no es «restos»"
o=$(bash "$ROOT/encargado.sh" apartar "$R" 2>&1) && bad "aparta la entrada en preparación" || { [ -f requirements/REQUIREMENTS.md ] && ok "apartar en preparación: no (la entrada se queda)" || bad "apartó: $o"; }
exit $fail
