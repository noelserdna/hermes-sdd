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
[ "$o" = "Auditoría de especificaciones<-;Diseño visual y de uso<t1;Plan<t2;Tareas<t3;" ] && ok "lanzar: auditoría → diseño visual → plan → tareas, encadenadas" || bad "cadena: $o"
rm -f "$T/cartas"; jq '.route.stages["gap-detector"].run = true' pipeline-state.json > p.tmp && mv p.tmp pipeline-state.json
echo '{"tipo":"fase","fase":"0"}' > .sdd/hermes/puertas/f9.json; git tag fase-0-accepted 2>/dev/null; mkdir -p plan/fases; touch plan/fases/FASE-0-x.md
bash "$ROOT/lanzar.sh" siguiente "$R" f9 acepto >/dev/null
o=$(tr '\n' ';' < "$T/cartas")
[ "$o" = "Huecos entre especificación y código<-;Cierre: puerta global y entrega<t5;" ] && ok "lanzar: huecos entre especificación y código antes del cierre" || bad "cierre: $o"

# 5. etapa opcional: sin su producto, falla con lo que dijo el ejecutor
mkdir -p .sdd/hermes; echo '{"ejecutor":"claude","ejecutores":{"ux":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
o=$(FALSO_RESUMEN=$'stage=ux-designer status=blocked\nNo hay pantallas.' bash "$ROOT/etapa.sh" "$R" ux | tail -1)
echo "$o" | jq -e '.outcome == "failed" and (.reason | test("ux-designer no dejó ux: No hay pantallas"))' >/dev/null && ok "etapa ux sin ux/: falla y dice por qué" || bad "ux: $o"
mkdir -p ux && echo x > ux/UI-DESIGN-SYSTEM.md && git add ux && git commit -qm "docs(ux): x"
o=$(bash "$ROOT/etapa.sh" "$R" ux | tail -1)
echo "$o" | jq -e '.outcome == "done" and .resumen == "Diseño visual y de uso escrito"' >/dev/null && ok "etapa ux con ux/: hecha" || bad "ux hecha: $o"

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
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" plan >/dev/null
grep -q 'COMPACT PLAN (small project): exactly ONE FASE' "$T/prompt" && [ "$(cat .sdd/hermes/granularidad-plan)" = compacta ] \
  && ok "compacta: el plan pide una sola FASE y deja constancia de la granularidad usada" || bad "plan compacto: $(cat "$T/prompt")"
FALSO_PROMPT="$T/prompt" bash "$ROOT/etapa.sh" "$R" tareas >/dev/null
grep -q 'COMPACT TASKS: 3 to 6 tasks' "$T/prompt" && grep -q 'TEST POLICY: one test per acceptance criterion' "$T/prompt" \
  && ok "compacta: tareas gruesas y un test por criterio" || bad "tareas compactas: $(cat "$T/prompt")"
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

exit $fail
