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
# 6. lanzar.sh reintentar --de (lo usa el gateway cuando el kanban pierde al worker): nueva, hijas a la nueva, vieja archivada
: > "$T/log"; o=$(bash "$ROOT/lanzar.sh" reintentar "$R" implementar 2 --de t_1 2>&1)
grep -q "create Reintento: implementar FASE-2" "$T/log" && grep -q "link $o t_2" "$T/log" && grep -q "unlink t_1 t_2" "$T/log" \
  && grep -q "archive t_1" "$T/log" && ok "reintentar --de: tarjeta nueva ($o), la hija la espera y la vieja se archiva" || bad "reintentar --de: $o $(cat "$T/log")"
# 7. lanzar.sh esperar: una línea por evento (etapa terminada, puerta abierta o en error, tag) o TIEMPO
export HERMES_SDD_ESPERA_INTERVALO_S=0.2
esp() { bash "$ROOT/lanzar.sh" esperar "$R" "$@" > "$T/esp" 2>&1 & EPID=$!; sleep 0.5; }
fin_esp() { for _ in $(seq 1 50); do kill -0 "$EPID" 2>/dev/null || break; sleep 0.1; done; wait "$EPID" 2>/dev/null; cat "$T/esp"; }
esp --max 20; echo '{"etapa":"implementar","fase":"2","resultado":"failed","motivo":"quedan tareas"}' >> .sdd/hermes/etapas.jsonl
[ "$(fin_esp)" = "ETAPA implementar FASE-2 failed: quedan tareas" ] && ok "esperar: etapa terminada, en una línea" || bad "esperar etapa: $(cat "$T/esp")"
esp --max 20; jq -n --arg r "$R" '{id:"g7", tipo:"fase", fase:"2", repo:$r, titulo:"Aceptar FASE-2", estado:"abierta"}' > "$HERMES_SDD_HOME/puertas/g7.json"
[ "$(fin_esp)" = "PUERTA g7 fase FASE-2 abierta: Aceptar FASE-2" ] && ok "esperar: puerta abierta" || bad "esperar puerta: $(cat "$T/esp")"
esp --max 20; jq '.estado = "error" | .error = "HEAD no es el commit mostrado"' "$HERMES_SDD_HOME/puertas/g7.json" > "$T/g" && mv "$T/g" "$HERMES_SDD_HOME/puertas/g7.json"
[ "$(fin_esp)" = "PUERTA g7 fase FASE-2 error: HEAD no es el commit mostrado" ] && ok "esperar: puerta que el notario no pudo firmar" || bad "esperar error: $(cat "$T/esp")"
esp --tag 'entrega-*' --max 20; git tag entrega-1
[ "$(fin_esp)" = "TAG entrega-1" ] && ok "esperar --tag: aparece el tag" || bad "esperar tag: $(cat "$T/esp")"
o=$(bash "$ROOT/lanzar.sh" esperar "$R" --max 1); [ $? = 3 ] && [ "$o" = TIEMPO ] && ok "esperar --max: sin nada, TIEMPO y sale con 3" || bad "tiempo: $o"
rm -f "$HERMES_SDD_HOME/puertas/g7.json"
# 8. vigía: gateway callado, aparcada que nadie reanuda, lista que el kanban no despacha
python3 - "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" "$R" > "$T/v" 2>&1 <<'PY'
import importlib.util, json, sys, time
spec = importlib.util.spec_from_file_location("hsdd_proyectos", sys.argv[1]); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
ahora = time.time()
(P.N.HOME / "latido.json").write_text(json.dumps({"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime(ahora - 700))}))
ts = [{"id": "t_a", "title": "Plan", "status": "scheduled", "assignee": "sdd-estacion"},
      {"id": "t_r", "title": "Tareas", "status": "ready", "assignee": "sdd-estacion"}]
o1 = P.vigia(sys.argv[2], "demo", ts, ahora)
o2 = P.vigia(sys.argv[2], "demo", ts, ahora + 700)
print("\n".join(o1)); print("--"); print("\n".join(o2))
PY
grep -q "^GATEWAY CALLADO | hermes-sdd | sin latido desde hace más de 10 min" "$T/v" && ok "vigía: gateway sin latido" || bad "latido: $(cat "$T/v")"
grep -q "^APARCADA SIN REANUDAR | Plan (t_a)" "$T/v" && ok "vigía: aparcada con la cuota ya renovada" || bad "aparcada: $(cat "$T/v")"
! sed -n '1,/^--$/p' "$T/v" | grep -q "SIN DESPACHAR" && sed -n '/^--$/,$p' "$T/v" | grep -q "^SIN DESPACHAR | Tareas (t_r)" \
  && ok "vigía: lista que el kanban no toma en 10 min (no a la primera)" || bad "sin despachar: $(cat "$T/v")"
rm -f "$HERMES_SDD_HOME/latido.json"
# 9. vigía: una puerta que queda para la persona se menciona AL MOMENTO (el encargado le prepara la recomendación);
#    mientras Jev no ha juzgado, no (la firma él o una regla en segundos)
jq -n '{id:"g8", tablero:"demo", estado:"abierta", titulo:"Aceptar FASE-2", creada:"2026-11-19T20:27:26Z"}' > "$HERMES_SDD_HOME/puertas/g8.json"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$R"); echo "$o" | grep -q "PUERTA PARA TI" && bad "vigía: puerta sin juzgar ya «para ti»" || ok "vigía: puerta aún sin juicio de Jev, no se menciona"
jq '.jev = {choice:"persona", decide:false, motivo:"se modificaron tests que ya existían (lo revisa una persona)"}' "$HERMES_SDD_HOME/puertas/g8.json" > "$T/g" && mv "$T/g" "$HERMES_SDD_HOME/puertas/g8.json"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$R")
echo "$o" | grep -q "^PUERTA PARA TI | Aceptar FASE-2 (g8) | se modificaron tests que ya existían" && ok "vigía: puerta que va a la persona, al momento y con el motivo" || bad "para ti: $o"
jq '.jev.decide = true | .jev.choice = "acepto"' "$HERMES_SDD_HOME/puertas/g8.json" > "$T/g" && mv "$T/g" "$HERMES_SDD_HOME/puertas/g8.json"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$R"); echo "$o" | grep -q "PUERTA PARA TI" && bad "vigía: la firma Jev y aun así «para ti»" || ok "vigía: puerta que firma Jev, no se menciona"
rm -f "$HERMES_SDD_HOME/puertas/g8.json"
exit $fail
