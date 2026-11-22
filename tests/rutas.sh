#!/usr/bin/env bash
# Rutas configurables (0.3.0): SDD → Configuración → Rutas; la puerta de ruta ofrece una por botón (la recomendada
# primero), el notario fija cada etapa opcional a lo que mostraba el botón y lanzar.sh encadena esas etapas antes del
# plan (y los huecos entre especificación y código antes del cierre).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"; unset TYPESAFE_API_KEY
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
PR="$ROOT/plugin/hermes-sdd/hsdd_proyectos.py"
py() { python3 - "$ROOT/plugin/hermes-sdd" "$@"; }

# 1. rutas de serie, la recomendada primero y la fijada al crear el proyecto
o=$(python3 "$PR" opciones-ruta demo | jq -r '[.[].verbo] | join(" ")')
[ "$o" = "ruta-adaptativa ruta-ligera ruta-con-diseno ruta-completa" ] && ok "rutas de serie, la adaptativa recomendada primero" || bad "orden: $o"
echo '{"rutas_proyecto":{"demo":"ligera"}}' > "$HERMES_SDD_HOME/sdd.json"
o=$(python3 "$PR" opciones-ruta demo | jq -c '.[0] | {verbo, etiqueta, fijada, etapas}')
[ "$o" = '{"verbo":"ruta-ligera","etiqueta":"⭐ Ligera","fijada":true,"etapas":[]}' ] && ok "la ruta fijada al crear el proyecto sale primera y marcada" || bad "fijada: $o"
python3 "$PR" opciones-ruta demo | jq -e '.[0].criterio | test("fixed this route")' >/dev/null && ok "Jev sabe que el cliente la fijó" || bad "criterio fijada"
cat > "$T/prop.json" <<'J'
{"stages": {"ux-designer": {"run": true}, "spec-auditor": {"run": false}, "plan-architect": {"run": true}}}
J
o=$(python3 "$PR" opciones-ruta otro "$T/prop.json" | jq -c '.[] | select(.verbo == "ruta-adaptativa") | {etapas, auto}')
[ "$o" = '{"etapas":["ux-designer"],"auto":true}' ] && ok "la adaptativa muestra las etapas extra que propone el método" || bad "auto: $o"

# 2. guardar rutas: validación
py <<'P' && ok "rutas: valida etapas, ids repetidos y la de por defecto; guarda una nueva" || bad "validación de rutas"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_proyectos as PR
def rechaza(**kw):
    try: PR.guardar_config(**kw)
    except PR.Rechazo: return True
    return False
assert rechaza(rutas_cfg=[{"id": "x", "nombre": "X", "etapas": ["inventada"]}])
assert rechaza(rutas_cfg=[{"id": "x", "nombre": "X", "etapas": []}, {"id": "x", "nombre": "Y", "etapas": []}])
assert rechaza(rutas_cfg=[])
assert rechaza(ruta_defecto="no-existe")
c = PR.guardar_config(rutas_cfg=PR.RUTAS_DEFECTO + [{"id": "mia", "nombre": "Mía", "descripcion": "a mi gusto", "etapas": ["ux-designer", "spec-auditor"]}], ruta_defecto="mia")
assert c["ruta_defecto"] == "mia" and c["rutas"][-1]["etapas"] == ["spec-auditor", "ux-designer"], c["rutas"][-1]
P
python3 "$PR" rutas | grep -q '^\* mia ' && ok "rutas: la nueva, por defecto" || bad "rutas cli: $(python3 "$PR" rutas)"

# 3. notario: cada etapa opcional queda como decía el botón
R="$T/repo"; cp -R "$ROOT/metodo/examples/todo-app" "$R"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json; printf "pipeline-state.json\n.sdd/\n" >> .gitignore
mkdir -p .sdd && cp "$ROOT/metodo/tests/fixtures/route/todo-answers.json" .sdd/route-answers.json
git add -A && git commit -qm "chore: toy project"
cat > "$HERMES_SDD_HOME/aprobadores.json" <<J
{"andres": {"nombre": "Andrés León", "rol": "Cliente", "canales": {"local": "tester"}}}
J
puerta() {  # puerta <id> → con los botones que abriría puerta.sh
  mkdir -p .sdd/hermes/puertas
  python3 "$PR" opciones-ruta demo | jq --arg s "$(git rev-parse HEAD)" \
    '{tipo:"ruta", fase:"", tablero:"", tarjeta:"", sha:$s, creada:"2000-01-01T00:00:00Z", opciones: ([.[] | {verbo, etiqueta, etapas, auto}] + [{verbo:"rechazo", etiqueta:"❌", texto:true}])}' \
    > ".sdd/hermes/puertas/$1.json"; }
decidir() { mkdir -p .sdd/hermes/decisiones
  jq -n --arg v "$2" --arg a "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{verbo:$v, texto:"", actor:{persona:"andres", canal:"local", id:"tester"}, prueba:{}, at:$a}' > ".sdd/hermes/decisiones/$1.json"; }
gemelo_() {  # lo que haría un canal: la misma decisión en el índice de puertas de Hermes (el notario los compara)
  local f="$HERMES_SDD_HOME/puertas/$1.json"; mkdir -p "$HERMES_SDD_HOME/puertas"
  [ -f "$f" ] || cp ".sdd/hermes/puertas/$1.json" "$f"
  jq --slurpfile d ".sdd/hermes/decisiones/$1.json" --arg r "$R" '.repo = $r | .estado = "decidida" | .decision = $d[0]' "$f" > "$f.t" && mv "$f.t" "$f"; }
_dec() { decidir "$@"; gemelo_ "$1"; }
st() { jq -r --arg k "$1" '"\(.route.stages[$k].run)/\(.stages[$k].status)"' pipeline-state.json; }
puerta r1; _dec r1 ruta-mia; out=$(bash "$ROOT/firmar.sh" "$R" r1 2>&1); rc=$?
[ $rc -eq 0 ] && [ "$(st ux-designer | cut -d/ -f1)" = true ] && [ "$(st spec-auditor)" = "true/pending" ] && [ "$(st specifications-engineer)" = "false/skipped" ] && [ "$(st gap-detector)" = "false/skipped" ] \
  && ok "firma una ruta configurada: sus etapas a run, las demás saltadas" || bad "firma mía ($rc): $out | ux=$(st ux-designer) audit=$(st spec-auditor) spec=$(st specifications-engineer)"
echo "$out" | grep -q 'Ruta «Mía» elegida por Andrés León' && ok "el resumen dice qué ruta se eligió, por su nombre" || bad "resumen: $out"
git commit -q --allow-empty -m "chore: otra"; puerta r2; _dec r2 ruta-inventada; out=$(bash "$ROOT/firmar.sh" "$R" r2 2>&1)
echo "$out" | grep -q "no ofrecía la ruta" && ok "no firma una ruta que la puerta no ofrecía" || bad "inventada: $out"

# 4. lanzar.sh: tras la ruta, las etapas que tocan → Plan → Tareas; antes del cierre, los huecos (si tocan)
mkdir -p "$T/bin"; echo 0 > "$T/n"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
case "\$*" in
  "kanban boards list --json") echo '[{"slug":"repo"}]' ;;
  "kanban --board "*" create "*)
    n=\$(( \$(cat "$T/n") + 1 )); echo \$n > "$T/n"
    t=\$(printf '%s\n' "\$@" | sed -n '5p'); p=\$(printf '%s\n' "\$@" | awk 'f{print;exit} /^--parent\$/{f=1}')
    echo "\$t<\${p:--}" >> "$T/cartas"; echo "{\"id\":\"t\$n\"}" ;;
  *) exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"
echo '{"tipo":"ruta"}' > .sdd/hermes/puertas/r9.json
bash "$ROOT/lanzar.sh" siguiente "$R" r9 ruta-mia >/dev/null
o=$(tr '\n' ';' < "$T/cartas")
[ "$o" = "Auditoría de especificaciones<-;Diseño visual y de uso<t1;Dudas de diseño<t2;Plan<t3;Tareas<t4;" ] && ok "lanzar: auditoría → diseño visual → dudas de diseño → plan → tareas, encadenadas por lanzar.sh" || bad "cadena: $o"
# material-montana (C6, C11): las dudas de diseño se deciden juntas antes del plan. Sin ninguna abierta, sigue el plan;
# con alguna, una sola puerta «Dudas antes del plan» y, al responder, Plan → Tareas
rm -f "$T/cartas"; mkdir -p .sdd; mv .sdd/questions-spec-auditor.json "$T/qsa.json" 2>/dev/null; rm -f .sdd/questions-spec-auditor.md
o=$(bash "$ROOT/etapa.sh" "$R" dudas | tail -1)
echo "$o" | jq -e '.outcome == "done"' >/dev/null && [ ! -s "$T/cartas" ] \
  && ok "dudas sin preguntas abiertas: acaba bien y sigue el Plan que ya cuelga de ella (no toca el kanban: dentro de Hermes no puede)" || bad "dudas sin abiertas: $o $(tr '\n' ';' < "$T/cartas" 2>/dev/null)"
node "$ROOT/metodo/scripts/sdd.mjs" questions add --role spec-auditor >/dev/null 2>&1 <<'J'
{"skill": "sdd-spec-auditor", "tema": "reservas-solapadas", "pregunta": "Overlapping bookings?", "para_cliente": "¿Se pueden solapar dos reservas del mismo material?",
 "opciones": [{"letra": "A", "texto": "No", "recomendada": true, "efecto": "ninguno", "cliente": "No: la segunda se rechaza"},
              {"letra": "B", "texto": "Yes", "efecto": "req-change", "cliente": "Sí, avisando"}]}
J
rm -f "$T/cartas"; o=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/etapa.sh" "$R" dudas | tail -1); G=$(echo "$o" | jq -r '.puerta // empty')
[ -n "$G" ] && jq -e '.tipo == "preguntas" and .titulo == "Dudas antes del plan" and ([.opciones[].verbo] == ["respondo"])' ".sdd/hermes/puertas/$G.json" >/dev/null \
  && [ -f .sdd/hermes/dudas-diseno ] && [ ! -s "$T/cartas" ] && ok "dudas abiertas: una sola puerta «Dudas antes del plan», sin plan todavía" || bad "dudas abiertas: $o"
bash "$ROOT/lanzar.sh" siguiente "$R" "$G" respondo >/dev/null
[ "$(tr '\n' ';' < "$T/cartas")" = "Plan<-;Tareas<t6;" ] && [ ! -f .sdd/hermes/dudas-diseno ] && ok "al responderlas: Plan → Tareas" || bad "tras dudas: $(tr '\n' ';' < "$T/cartas")"
# la consolidación de dudas solo fusiona preguntas: si toca un fichero fuera de .sdd/, la etapa para (antes, prosa)
for t in uno dos; do printf '{"skill":"s","tema":"duda-%s","pregunta":"q","para_cliente":"¿Vale así?","opciones":[{"letra":"A","texto":"a","efecto":"ninguno","recomendada":true},{"letra":"B","texto":"b","efecto":"accion"}]}' "$t" \
  | node "$ROOT/metodo/scripts/sdd.mjs" questions add --role dudas-x >/dev/null 2>&1; done
cp .sdd/hermes/hermes-sdd.json "$T/hs.bak" 2>/dev/null; echo '{"ejecutor":"claude","ejecutores":{"dudas":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
h0=$(git rev-parse HEAD)
o=$(FALSO_MODO=toca HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/etapa.sh" "$R" dudas | tail -1)
echo "$o" | jq -e '.outcome == "failed" and (.reason | test("fuera de .sdd/: fuera-de-sdd.txt"))' >/dev/null && ok "dudas: si la consolidación toca algo fuera de .sdd/, la etapa para" || bad "dudas toca: $o"
# … y lo deshace: lo de fuera no se queda en la historia ni en el árbol (material-montana11, F-1: el commit 2126c6b con
# el plan entero hecho por la etapa de dudas se quedó en la historia del proyecto)
[ "$(git rev-parse HEAD)" = "$h0" ] && [ ! -e fuera-de-sdd.txt ] && echo "$o" | jq -e '.reason | test("deshecho")' >/dev/null \
  && ok "dudas: lo que la consolidación tocó fuera de .sdd/ se deshace" || bad "dudas no deshace: $(git log --oneline -2 | tr '\n' ' ') $(ls fuera-de-sdd.txt 2>&1)"
rm -f fuera-de-sdd.txt .sdd/questions-dudas-x.* .sdd/hermes/dudas-diseno; if [ -f "$T/hs.bak" ]; then mv "$T/hs.bak" .sdd/hermes/hermes-sdd.json; else rm -f .sdd/hermes/hermes-sdd.json; fi
rm -f .sdd/questions-spec-auditor.*; mv "$T/qsa.json" .sdd/questions-spec-auditor.json 2>/dev/null; node "$ROOT/metodo/scripts/sdd.mjs" questions render >/dev/null 2>&1
rm -f "$T/cartas"
rm -f "$T/cartas"; jq '.route.stages["gap-detector"].run = true' pipeline-state.json > p.tmp && mv p.tmp pipeline-state.json
echo '{"tipo":"fase","fase":"0"}' > .sdd/hermes/puertas/f9.json; git tag fase-0-accepted 2>/dev/null; mkdir -p plan/fases; touch plan/fases/FASE-0-x.md
bash "$ROOT/lanzar.sh" siguiente "$R" f9 acepto >/dev/null
o=$(tr '\n' ';' < "$T/cartas")
[ "$o" = "Huecos entre especificación y código<-;Cierre: puerta global y entrega<t8;" ] && ok "lanzar: huecos entre especificación y código antes del cierre" || bad "cierre: $o"

# 5. etapa opcional: sin su producto, falla con lo que dijo el ejecutor
mkdir -p .sdd/hermes; echo '{"ejecutor":"claude","ejecutores":{"ux":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
o=$(FALSO_RESUMEN=$'stage=ux-designer status=blocked\nNo hay pantallas.' bash "$ROOT/etapa.sh" "$R" ux | tail -1)
echo "$o" | jq -e '.outcome == "failed" and (.reason | test("ux-designer no dejó ux: No hay pantallas"))' >/dev/null && ok "etapa ux sin ux/: falla y dice por qué" || bad "ux: $o"
mkdir -p ux && echo x > ux/UI-DESIGN-SYSTEM.md && git add ux && git commit -qm "docs(ux): x"
o=$(bash "$ROOT/etapa.sh" "$R" ux | tail -1)
echo "$o" | jq -e '.outcome == "done" and .resumen == "Diseño visual y de uso escrito"' >/dev/null && ok "etapa ux con ux/: hecha" || bad "ux hecha: $o"
# material-montana (C9): tras un cambio de requisitos la etapa ya hecha («stale») solo toca lo que cambió
cp -R requirements "$T/req.bak" 2>/dev/null || true
mkdir -p requirements; printf '# R\n\n### REQ-F-001: Uno\nx\n\n### REQ-F-002: Dos\ny\n' > requirements/REQUIREMENTS.md
git add requirements && git commit -qm "docs(requirements): v1" && git tag requirements-v9.0
printf '# R\n\n### REQ-F-001: Uno\nx cambiado\n\n### REQ-F-002: Dos\ny\n\n### REQ-F-003: Tres\nz\n' > requirements/REQUIREMENTS.md
git add requirements && git commit -qm "docs(requirements): v2" && git tag requirements-v9.1
bash "$ROOT/metodo/scripts/sdd-state.sh" set ux-designer stale >/dev/null
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" ux >/dev/null
grep -q 'UPDATE MODE: .*(added: REQ-F-003; modified: REQ-F-001)' "$T/prompt" && ok "etapa ya hecha tras un cambio: solo actualiza los requisitos que cambiaron" || bad "ux incremental: $(grep -o 'UPDATE.*' "$T/prompt" | head -c 300)"
bash "$ROOT/metodo/scripts/sdd-state.sh" set ux-designer done >/dev/null
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" ux >/dev/null
! grep -q 'UPDATE MODE' "$T/prompt" && ok "…y si no estaba «stale», como siempre" || bad "ux no stale: actualizó"
# material-montana4: tras un cambio, las etapas de diseño ya hechas se ponen al día juntas, en una sola sesión
cp pipeline-state.json "$T/ps.bak"
jq '.route.stages["tech-designer"].run = true | .route.stages["ux-designer"].run = true | .route.stages["spec-auditor"].run = false' pipeline-state.json > "$T/ps" && cp "$T/ps" pipeline-state.json
bash "$ROOT/metodo/scripts/sdd-state.sh" set tech-designer stale >/dev/null; bash "$ROOT/metodo/scripts/sdd-state.sh" set ux-designer stale >/dev/null
echo '{"ejecutor":"claude","ejecutores":{"ux":"../tests/ejecutor-falso","actualizar-diseno":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
o=$(FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" actualizar-diseno | tail -1)
grep -q 'several stages in this one session: .*(added: REQ-F-003; modified: REQ-F-001).*/sdd-tech-designer, /sdd-ux-designer' "$T/prompt" \
  && echo "$o" | jq -e '.outcome == "failed" and (.reason | test("no cerró tech-designer"))' >/dev/null \
  && ok "puesta al día del diseño: una sesión con las etapas «stale»; si deja alguna sin cerrar, falla" || bad "actualizar-diseno: $o / $(grep -o 'several.*' "$T/prompt" | head -c 200)"
bash "$ROOT/metodo/scripts/sdd-state.sh" set tech-designer done >/dev/null; bash "$ROOT/metodo/scripts/sdd-state.sh" set ux-designer done >/dev/null
o=$(bash "$ROOT/etapa.sh" "$R" actualizar-diseno | tail -1)
echo "$o" | jq -e '.outcome == "done" and (.resumen | test("ya estaba al día"))' >/dev/null && ok "…y sin etapas «stale», no lanza nada" || bad "actualizar-diseno vacío: $o"
cp "$T/ps.bak" pipeline-state.json
# material-montana4 → meta 2 h: pruebas, seguridad, técnico y UX en paralelo (una sesión con subagentes); lo que no
# deje su documento se hace después una a una
jq '.route.stages |= (. + {"test-planner":{"run":true},"security-auditor":{"run":true},"tech-designer":{"run":true},"ux-designer":{"run":true}})
    | .stages["test-planner"].status = "pending" | .stages["security-auditor"].status = "pending" | .stages["tech-designer"].status = "pending" | .stages["ux-designer"].status = "pending"' pipeline-state.json > "$T/ps" && cp "$T/ps" pipeline-state.json
rm -rf test/TEST-PLAN.md design audits/SECURITY-AUDIT-BASELINE.md ux
echo '{"ejecutor":"claude","ejecutores":{"disenar":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
: > "$T/disena.jsonl"; o=$(FALSO_MODO=disena FALSO_LOG="$T/disena.jsonl" bash "$ROOT/etapa.sh" "$R" disenar | tail -1)
[ "$(jq -s 'length' "$T/disena.jsonl")" = 3 ] && jq -s -e '.[0].prompt | test("PARALLEL DESIGN") and test("/sdd-test-planner") and test("/sdd-ux-designer")' "$T/disena.jsonl" >/dev/null \
  && echo "$o" | jq -e '.outcome == "done" and (.resumen | test("en paralelo"))' >/dev/null \
  && [ "$(for k in test-planner security-auditor tech-designer ux-designer; do bash "$ROOT/metodo/scripts/sdd-state.sh" get $k; done | sort -u)" = done ] \
  && ok "diseño en paralelo: una sesión para las cuatro; las dos que no dejaron documento, una a una; todas done" || bad "disenar: $o / $(jq -s -c 'map(.prompt[0:40])' "$T/disena.jsonl") / $(for k in test-planner security-auditor tech-designer ux-designer; do bash "$ROOT/metodo/scripts/sdd-state.sh" get $k; done | tr '\n' ' ')"
rm -rf test/TEST-PLAN.md design audits/SECURITY-AUDIT-BASELINE.md ux; git add -A >/dev/null 2>&1; git commit -qm "test: limpia diseño" >/dev/null 2>&1
# tras_ruta: las cuatro en una sola tarjeta «Diseño en paralelo», detrás de especificar y auditar
(
  eval "$(sed -n -e '/^OPCIONALES="/,/^ux-designer|ux|/p' -e '/^toca() /,/^}$/p' -e '/^archivar_dudas() /,/^}$/p' -e '/^tras_ruta() /,/^}$/p' "$ROOT/lanzar.sh")"
  REPO=$PWD; K=(true); tarjeta() { echo "$1" >> "$T/tarjetas"; echo "t$RANDOM"; }
  jq '.route.stages |= (. + {"specifications-engineer":{"run":true},"spec-auditor":{"run":true}}) | reduce ("specifications-engineer","spec-auditor","test-planner","security-auditor","tech-designer","ux-designer") as $k (.; .stages[$k].status = "pending")' pipeline-state.json > "$T/ps2" && cp "$T/ps2" pipeline-state.json
  : > "$T/tarjetas"; tras_ruta >/dev/null
  [ "$(tr '\n' '|' < "$T/tarjetas")" = "Especificaciones|Auditoría de especificaciones|Diseño en paralelo: pruebas, seguridad, técnico y UX|Dudas de diseño|Plan|Tareas|" ] \
    && echo "ok   tras_ruta: especificar y auditar en fila, las otras cuatro en una tarjeta en paralelo" || echo "FAIL tras_ruta: $(tr '\n' '|' < "$T/tarjetas")"
) | tee "$T/tr.out"; grep -q '^FAIL' "$T/tr.out" && fail=1
cp "$T/ps.bak" pipeline-state.json
git tag -d requirements-v9.0 requirements-v9.1 >/dev/null; rm -rf requirements; cp -R "$T/req.bak" requirements 2>/dev/null || true; git add -A requirements; git commit -qm "test: requisitos de antes" >/dev/null 2>&1

# 6. Jev: el criterio de cada ruta y su propio umbral en modo auto
py <<'P' && ok "Jev: cada ruta con su criterio; en auto decide con umbral_auto (0.8 de serie)" || bad "jev rutas"
import sys, json; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N; (N.HOME / "puertas").mkdir(parents=True, exist_ok=True)
p = {"tipo": "ruta", "tablero": "demo", "opciones": [{"verbo": "ruta-ligera", "etiqueta": "⭐ Ligera", "criterio": "Use the route «Ligera»"},
     {"verbo": "rechazo", "etiqueta": "❌", "texto": True}]}
q = N.pregunta_jev(p)["decision"]["criteria"]
assert q["ruta-ligera"] == "Use the route «Ligera»" and "persona" in q and "rechazo" not in q, q
N.poner_modo("auto", "demo")
import tempfile; p.update({"id": "gz", "estado": "abierta", "creada": "2000-01-01T00:00:00Z", "repo": tempfile.mkdtemp()}); N.escribir(N.indice("gz"), p)
r = N.aplicar_jev("gz", {"choice": "ruta-ligera", "p": 0.83, "modelo": "jev"})
assert r["jev"]["decide"] and r["jev"]["umbral"] == 0.8, r["jev"]
N.poner_modo("piloto", "demo"); N.ajustar_jev(piloto=["ruta"])
p["estado"] = "abierta"; p.pop("decision", None); N.escribir(N.indice("gz"), p)
r = N.aplicar_jev("gz", {"choice": "ruta-ligera", "p": 0.83, "modelo": "jev"})
assert not r["jev"]["decide"] and r["jev"]["umbral"] == 0.9, r["jev"]
P
# 7. granularidad: la de la ruta firmada, «auto» por tamaño, e instrucciones al ejecutor
echo compacta > .sdd/hermes/granularidad 2>/dev/null || true
grep -q '^compacta$' .sdd/hermes/granularidad || bad "firmar no guardó la granularidad"
echo '{"ejecutor":"claude","ejecutores":{"plan":"../tests/ejecutor-falso","tareas":"../tests/ejecutor-falso","implementar":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
rm -f "$T/llamadas"; FALSO_LOG="$T/llamadas" bash "$ROOT/etapa.sh" "$R" plan >/dev/null; jq -rs '.[0].prompt' "$T/llamadas" > "$T/prompt"
grep -q 'COMPACT PLAN (small project): exactly ONE FASE' "$T/prompt" && [ "$(cat .sdd/hermes/granularidad-plan)" = compacta ] \
  && ok "compacta: el plan pide una sola FASE y deja constancia de la granularidad usada" || bad "plan compacto: $(cat "$T/prompt")"
grep -q "Plan-Size:\*\* compact" "$T/prompt" && grep -q 'no ARCHITECTURE.md, RESEARCH.md, CLARIFY-LOG.md, fases/README.md nor fase-plans/' "$T/prompt" \
  && ok "compacta: el plan en dos ficheros (PLAN.md y el de la FASE), sin los otros cinco" || bad "plan compacto en dos ficheros: $(cat "$T/prompt")"
jq -e -s 'length == 2 and (.[1].prompt | test("Fix the shape of plan/") and test("Plan-Size"))' "$T/llamadas" >/dev/null \
  && ok "compacta: si el plan no tiene la forma (aquí, sin Plan-Size), una pasada de arreglo con la lista de fallos" || bad "forma plan: $(jq -c '[.[].prompt[0:60]]' -s "$T/llamadas")"
# material-montana: lo que el cliente decidió (aquí, la hora de España) llega al prompt de las etapas siguientes
mkdir -p .sdd
node "$ROOT/metodo/scripts/sdd.mjs" questions add --role spec-auditor >/dev/null 2>&1 <<'J'
{"skill": "sdd-spec-auditor", "contexto": "RN-002", "tema": "reloj-hoy", "pregunta": "Which clock decides today?",
 "para_cliente": "¿Qué hora manda para decidir qué día es hoy?",
 "opciones": [{"letra": "A", "texto": "Europe/Madrid", "recomendada": true, "efecto": "ninguno", "cliente": "La hora de España"},
              {"letra": "B", "texto": "UTC", "efecto": "ninguno", "cliente": "La hora universal"}]}
J
node "$ROOT/metodo/scripts/sdd.mjs" questions answer Q-spec-auditor-001 --letter A --by "Ana (Cliente)" >/dev/null 2>&1
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" tareas >/dev/null
grep -q 'Decisiones del cliente que ya están tomadas' "$T/prompt" && grep -q 'Q-spec-auditor-001: ¿Qué hora manda para decidir qué día es hoy? → La hora de España' "$T/prompt" \
  && ok "las decisiones del cliente van en el prompt de las etapas" || bad "decisiones en el prompt: $(grep -o 'Decisiones.*' "$T/prompt" | head -c 400)"
# material-montana (C16): una cita de un test que un cambio de requisitos dejó vieja se pide volver a citar al implementar
mkdir -p tests/citas; printf '// REQ-F-001 AC1: "un texto que el criterio ya no dice"\ntest("REQ-F-001 AC1 x", () => {});\n' > tests/citas/vieja.test.js
mkdir -p task; [ -f task/TASK-FASE-0.md ] || { printf -- '- [x] TASK-F0-001 x\n' > task/TASK-FASE-0.md; NUEVA_TAREA=1; }
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" implementar 0 >/dev/null 2>&1
grep -q 'Stale quotes: tests/citas/vieja.test.js:1 REQ-F-001 AC1' "$T/prompt" && grep -q 'update ONLY those quote comments' "$T/prompt" \
  && ok "implementar: pide volver a citar los tests que el cambio de requisitos dejó con el texto viejo" || bad "citas viejas: $(grep -o 'Stale quotes.*' "$T/prompt" | head -c 200) $(node "$ROOT/metodo/scripts/sdd.mjs" lint --quotes 2>&1 | head -3)"
rm -rf tests/citas; [ -n "${NUEVA_TAREA:-}" ] && rm -f task/TASK-FASE-0.md; git checkout -q -- . 2>/dev/null; git clean -qfd tests task 2>/dev/null
# demo narrada: con «narration: required» en el Stack Profile, el implementador recibe el guion (casos de uso, workflow y
# una frase por criterio) y la orden de decir cada criterio justo antes de su captura
cp AGENTS.md "$T/agents.bak" 2>/dev/null || touch "$T/agents.nuevo"; printf '\n## SDD Stack Profile\n- narration: required\n' >> AGENTS.md
mkdir -p task; [ -f task/TASK-FASE-0.md ] || { printf -- '- [x] TASK-F0-001 x\n' > task/TASK-FASE-0.md; NUEVA_TAREA=1; }
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" implementar 0 >/dev/null 2>&1
grep -q 'NARRATED DEMO: .sdd/demo/GUION-FASE-0.md is the script' "$T/prompt" && [ -f .sdd/demo/GUION-FASE-0.md ] \
  && ok "narration required: el implementador recibe el guion de la demo y narra cada criterio antes de su captura" || bad "narra: $(grep -o 'NARRATED.\{0,80\}' "$T/prompt") $(ls .sdd/demo 2>&1)"
if [ -f "$T/agents.bak" ]; then mv "$T/agents.bak" AGENTS.md; else rm -f AGENTS.md; fi
[ -n "${NUEVA_TAREA:-}" ] && rm -f task/TASK-FASE-0.md; git checkout -q -- . 2>/dev/null; git clean -qfd tests task 2>/dev/null
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" tareas >/dev/null
grep -q 'COMPACT TASKS: 3 to 6 tasks' "$T/prompt" && grep -q 'TEST POLICY: one test per acceptance criterion' "$T/prompt" \
  && ok "compacta: tareas gruesas y un test por criterio" || bad "tareas compactas: $(cat "$T/prompt")"
grep -q 'write only task/TASK-FASE-0.md' "$T/prompt" && grep -q -- '--compact task format' "$T/prompt" \
  && ok "compacta: las tareas en un solo fichero, formato compacto y sin TASK-ORDER.md" || bad "tareas en un fichero: $(cat "$T/prompt")"
echo fina > .sdd/hermes/granularidad; FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" tareas >/dev/null
! grep -qE 'COMPACT|TEST POLICY' "$T/prompt" && ok "fina: como siempre (sin recortes)" || bad "fina: $(cat "$T/prompt")"
echo auto > .sdd/hermes/granularidad
echo '{"facts":{"req_f":6,"needs":7},"factors":{"integrations":{"value":"no"}}}' > .sdd/hermes/ruta.json   # vasos
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" plan >/dev/null; g1=$(cat .sdd/hermes/granularidad-plan)
echo '{"facts":{"req_f":5,"needs":1},"factors":{"integrations":{"value":"yes"}}}' > .sdd/hermes/ruta.json
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" plan >/dev/null; g2=$(cat .sdd/hermes/granularidad-plan)
echo '{"facts":{"req_f":12,"needs":4},"factors":{}}' > .sdd/hermes/ruta.json
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" plan >/dev/null; g3=$(cat .sdd/hermes/granularidad-plan)
[ "$g1/$g2/$g3" = compacta/normal/normal ] && ok "auto: compacta si es pequeño (aunque enumere muchas necesidades), normal con integraciones o más de 7 REQ-F" || bad "auto: $g1/$g2/$g3"

# 8. una sola FASE compacta: implementar → cierre (sin puerta de FASE); la entrega trae la demo y acepta la FASE
echo compacta > .sdd/hermes/granularidad-plan; git tag -d fase-0-accepted >/dev/null 2>&1
rm -f plan/fases/*; touch plan/fases/FASE-0-todo.md; rm -f "$T/cartas"
jq '.route.stages["gap-detector"].run = false' pipeline-state.json > p.tmp && mv p.tmp pipeline-state.json
echo '{"tipo":"plan"}' > .sdd/hermes/puertas/p9.json
bash "$ROOT/lanzar.sh" siguiente "$R" p9 conforme >/dev/null
o=$(cut -d'<' -f1 "$T/cartas" | tr '\n' ';')
[ "$o" = "Implementar FASE-0;Cierre: demo, puerta global y entrega;" ] && ok "una FASE compacta: implementar → cierre con demo, sin puerta de FASE" || bad "única: $o"
for g in normal fina; do
  echo $g > .sdd/hermes/granularidad-plan; rm -f "$T/cartas"
  bash "$ROOT/lanzar.sh" siguiente "$R" p9 conforme >/dev/null
  eval "o_$g=\"$(cut -d'<' -f1 "$T/cartas" | tr '\n' ';')\""
done
[ "$o_normal" = "Implementar FASE-0;Cierre: demo, puerta global y entrega;" ] && [ "$o_fina" = "Implementar FASE-0;Aceptar FASE-0;" ] \
  && ok "una sola FASE en normal también va a cierre; en fina conserva su puerta de FASE" || bad "única normal/fina: $o_normal | $o_fina"
echo compacta > .sdd/hermes/granularidad-plan
mkdir -p evidencias/FASE-0 && touch evidencias/FASE-0/a.png evidencias/FASE-0/b.png
git add -A >/dev/null 2>&1; git commit -qm "chore: plan compacto" >/dev/null 2>&1
G=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" entrega 2>/dev/null)
P=".sdd/hermes/puertas/$G.json"
# (el todo-app de ejemplo no pasa la puerta global: rechazar o eximir lo que falta tras ver la demo, y el texto no promete aceptar)
jq -e '.unica == true and [.opciones[].verbo] == ["ver","eximo","rechazo"]' "$P" >/dev/null && jq -r .texto "$P" | grep -q 'al aceptar la entrega aceptas también esa fase' \
  && ! jq -r .texto "$P" | grep -q 'podrás aceptar' \
  && jq -r .texto "$P" | grep -q '🎬 Demo: 2 capturas.' && ok "la entrega de una FASE única trae la demo y lo dice" || bad "entrega única: $(jq -c '{unica, opciones}' "$P" 2>&1) $(jq -r .texto "$P" 2>&1)"
python3 - "$ROOT/plugin/hermes-sdd" "$R" "$G" <<'P' && ok "los canales enseñan la demo de la FASE-0 en la entrega" || bad "evidencias en la entrega"
import sys, json; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N
p = json.load(open(f"{sys.argv[2]}/.sdd/hermes/puertas/{sys.argv[3]}.json"))
assert N.evidencias(p) == ["a.png", "b.png"], N.evidencias(p)
P
# material-montana: una duda del propio criterio con el gate en 1 (falta algo) no se esconde: sale con su porqué y se
# puede corregir el requisito o descartarla, además de eximir o rechazar
node "$ROOT/metodo/scripts/sdd.mjs" accept challenge add --req REQ-F-001 --ac 1 --category SPEC-QUESTION --quote "unique incremental id" \
  --why "el criterio no dice si el id vuelve a empezar" --evidence package.json:1 --verifier v --counter confirmed >/dev/null 2>&1
git add -A >/dev/null 2>&1; git commit -qm "test: duda" >/dev/null 2>&1
G=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" entrega 2>/dev/null); P=".sdd/hermes/puertas/$G.json"
jq -e '[.opciones[].verbo] == ["ver","corrijo","descarto","eximo","rechazo"]' "$P" >/dev/null && jq -r .texto "$P" | grep -q '❓ el criterio no dice si el id vuelve a empezar' \
  && ok "gate 1 con una duda del criterio: la puerta la enseña con su porqué y ofrece corregir o descartar" || bad "duda con gate 1: $(jq -c '[.opciones[].verbo]' "$P" 2>&1)"

# Una ruta fijada por el cliente: Jev solo puede confirmarla (taller2: cambió la «ligera» fijada por la «adaptativa»), y
# la puerta conserva la marca «fijada» en sus botones
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "ruta fijada: Jev solo puede elegirla; sin fijar, cualquiera sin texto" || bad "jev y ruta fijada"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N
p = {"tipo": "ruta", "opciones": [{"verbo": "ruta-ligera", "etiqueta": "⭐ Ligera", "fijada": True},
     {"verbo": "ruta-adaptativa", "etiqueta": "Adaptativa", "fijada": False}, {"verbo": "rechazo", "etiqueta": "❌", "texto": True}]}
assert list(N.verbos_jev(p)) == ["ruta-ligera"], N.verbos_jev(p)
p["opciones"][0]["fijada"] = False
assert list(N.verbos_jev(p)) == ["ruta-ligera", "ruta-adaptativa"], N.verbos_jev(p)
PY
grep -q 'criterio, fijada}' "$ROOT/puerta.sh" && ok "puerta.sh guarda «fijada» en los botones de la ruta" || bad "fijada se pierde en puerta.sh"
# la forma que pide la granularidad, comprobada (antes, prosa del prompt): plan compacto de una FASE sin ficheros de
# más; tareas dentro de su tope y sin tareas de «verificar criterios»
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PY' && ok "forma del plan y de las tareas según la granularidad: comprobada (también el tope de FASEs)" || bad "forma"
import sys; from pathlib import Path; sys.path.insert(0, sys.argv[1]); import hsdd_plan as P
r = Path(sys.argv[2]) / "forma"; (r / "plan" / "fases").mkdir(parents=True); (r / "task").mkdir()
(r / "plan" / "PLAN.md").write_text("> **Plan-Size:** compact\n"); (r / "plan" / "fases" / "FASE-0-SKELETON.md").write_text("x")
assert P.forma(r, "plan", "compacta") == [], P.forma(r, "plan", "compacta")
(r / "plan" / "ARCHITECTURE.md").write_text("x"); (r / "plan" / "fases" / "FASE-1-HARDENING.md").write_text("x")
f = P.forma(r, "plan", "compacta")
assert any("exactamente una FASE" in x for x in f) and any("ARCHITECTURE.md" in x for x in f) and any("HARDENING" in x for x in f), f
tareas = "\n".join(f"- [ ] TASK-F0-00{i} Porción {i}" for i in range(1, 8)) + "\n- [ ] TASK-F0-008 Verificar los criterios de aceptación\n"
(r / "task" / "TASK-FASE-0.md").write_text(tareas); (r / "task" / "TASK-ORDER.md").write_text("x")
f = P.forma(r, "tareas", "compacta")
assert any("8 tareas" in x for x in f) and any("TASK-F0-008" in x for x in f) and any("TASK-ORDER" in x for x in f), f
assert not any("tareas;" in x for x in P.forma(r, "tareas", "fina")), P.forma(r, "tareas", "fina")
(r / "task" / "TASK-FASE-0.md").write_text("- [ ] TASK-F0-001 Porción\n- [ ] TASK-F0-002 Porción\n- [ ] TASK-F0-003 Verify all FASE-0 criteria end to end | `tests/e2e/viaje.spec.js`\n")
assert not any("TASK-F0-003" in x for x in P.forma(r, "tareas", "compacta")), P.forma(r, "tareas", "compacta")
# tope de FASEs (material-montana6: 9 FASEs con granularidad normal; cada una cuesta su ronda fija)
n = Path(sys.argv[2]) / "fases"; (n / "plan" / "fases").mkdir(parents=True)
for i in range(6): (n / "plan" / "fases" / f"FASE-{i}-X.md").write_text("x")
assert not any("FASEs;" in x for x in P.forma(n, "plan", "normal")), P.forma(n, "plan", "normal")
for i in range(6, 9): (n / "plan" / "fases" / f"FASE-{i}-X.md").write_text("x")
assert any("tiene 9 FASEs" in x and "como mucho 6" in x for x in P.forma(n, "plan", "normal")), P.forma(n, "plan", "normal")
assert not any("FASEs;" in x for x in P.forma(n, "plan", "fina")), P.forma(n, "plan", "fina")
PY
exit $fail
