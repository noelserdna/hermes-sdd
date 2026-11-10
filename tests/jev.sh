#!/usr/bin/env bash
# Jev en las puertas (modos humano, consejo, piloto, auto): núcleo, notario y consulta con un Jev falso local.
# Sin red ni TypeSafe de verdad: SDD_JEV_URL apunta a un servidor de prueba que contesta lo que le digamos.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); SRV=; trap '[ -n "$SRV" ] && { kill $SRV; wait $SRV; } 2>/dev/null; rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
NUCLEO="$ROOT/plugin/hermes-sdd/hsdd_nucleo.py"

R="$T/repo"; cp -R "$ROOT/metodo/examples/todo-app" "$R"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json; printf "pipeline-state.json\n.sdd/\n" >> .gitignore
sed -i.bak -E 's/^> \*\*Status:\*\*.*/> **Status:** Review/' requirements/REQUIREMENTS.md && rm -f requirements/REQUIREMENTS.md.bak
git add -A && git commit -qm "chore: toy project"
echo '{"andres": {"nombre": "Andrés", "rol": "Cliente", "canales": {"telegram": "111"}}}' > "$HERMES_SDD_HOME/aprobadores.json"

# puerta <id> <tipo> [texto] [opciones]: índice global (lo que leen los canales) y copia del repo (lo que lee el notario)
OPC_REQ='[{"verbo":"acepto","etiqueta":"✅ Apruebo"},{"verbo":"cambios","etiqueta":"✏️ Cambios","texto":true}]'
puerta() {
  mkdir -p .sdd/hermes/puertas
  jq -n --arg id "$1" --arg t "$2" --arg b "${TAB-demo}" --arg x "${3:-Todo bien}" --argjson o "${4:-$OPC_REQ}" --arg s "$(git rev-parse HEAD)" --arg r "$R" \
    '{id:$id, tipo:$t, fase:"", tablero:$b, tarjeta:"", sha:$s, creada:"2000-01-01T00:00:00Z", repo:$r, titulo:"P",
      texto:$x, opciones:$o, preguntas:[], estado:"abierta"}' | tee ".sdd/hermes/puertas/$1.json" > "$HERMES_SDD_HOME/puertas/$1.json"; }
py() { python3 - "$NUCLEO" "$@"; }
CABECERA='import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("hsdd_nucleo", sys.argv[1]); N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)'
modo() { python3 "$NUCLEO" modo "$@" >/dev/null; }
aplicar() {  # aplicar <puerta> <choice> <p> → estado de la puerta
  py "$1" "$2" "$3" <<PY
$CABECERA
p = N.aplicar_jev(sys.argv[2], {"choice": sys.argv[3], "p": float(sys.argv[4]), "confidence": "high", "modelo": "jev-test"})
print(p["estado"], "|", p["jev"]["motivo"])
PY
}

# ── 1. modos y reglas ────────────────────────────────────────────────────────────────────────────────────────────
puerta g1 requisitos
o=$(aplicar g1 acepto 0.99); [[ "$o" == abierta* ]] && echo "$o" | grep -q "modo humano" && ok "humano (por defecto): Jev no decide" || bad "humano: $o"
puerta g2 requisitos; modo consejo demo
o=$(aplicar g2 acepto 0.99); [[ "$o" == abierta* ]] && ok "consejo: guarda la recomendación y no decide" || bad "consejo: $o"
puerta g3 requisitos; modo piloto demo
o=$(aplicar g3 acepto 0.99); [[ "$o" == abierta* ]] && echo "$o" | grep -q "las decide una persona" && ok "piloto: requisitos siguen siendo de una persona" || bad "piloto requisitos: $o"
puerta g4 plan "4 FASEs" '[{"verbo":"conforme","etiqueta":"✅ Conforme"},{"verbo":"cambios","etiqueta":"✏️","texto":true}]'
o=$(aplicar g4 conforme 0.95); [[ "$o" == decidida* ]] && ok "piloto: Jev decide el plan si está seguro" || bad "piloto plan: $o"
puerta g5 plan "4 FASEs" '[{"verbo":"conforme","etiqueta":"✅ Conforme"},{"verbo":"cambios","etiqueta":"✏️","texto":true}]'
o=$(aplicar g5 conforme 0.6); [[ "$o" == abierta* ]] && echo "$o" | grep -q "no está seguro" && ok "por debajo del umbral, decide una persona" || bad "umbral: $o"
puerta g6 requisitos; modo auto demo
o=$(aplicar g6 persona 0.97); [[ "$o" == abierta* ]] && echo "$o" | grep -q "una persona" && ok "si Jev elige «persona», la puerta queda para ti" || bad "persona: $o"
o=$(aplicar g6 cambios 0.99); [[ "$o" == abierta* ]] && ok "Jev nunca elige un verbo que pide motivo (cambios)" || bad "cambios: $o"
puerta g7 fase "⛔ La puerta de calidad no se cumple (código 1): solo se puede rechazar"
o=$(aplicar g7 acepto 0.99); [[ "$o" == abierta* ]] && echo "$o" | grep -q "no pasa la comprobación" && ok "auto: con ⛔ en la puerta, decide una persona" || bad "⛔: $o"
puerta g8 fase "✅ Sin alertas
Tests existentes con líneas borradas o cambiadas: 2"
o=$(aplicar g8 acepto 0.99); [[ "$o" == abierta* ]] && echo "$o" | grep -q "tests que ya existían" && ok "auto: tests existentes modificados → una persona" || bad "art 12: $o"

# ── 2. decisión de Jev, ventana y veto ──────────────────────────────────────────────────────────────────────────
puerta g9 requisitos
o=$(aplicar g9 acepto 0.97); [[ "$o" == decidida* ]] && ok "auto: Jev aprueba los requisitos" || bad "auto: $o"
o=$(jq -r '.actor.canal + " " + .actor.persona + " " + .prueba.modo + " " + .prueba.p' .sdd/hermes/decisiones/g9.json)
[ "$o" = "jev jev auto 0.970" ] && ok "la decisión dice que es de Jev, con modo y seguridad ($o)" || bad "decisión: $o"
o=$(py g9 <<PY
$CABECERA
try:
    N.deshacer(sys.argv[2], "")
    print("deshecho sin persona")
except N.Rechazo:
    p = N.deshacer(sys.argv[2], "andres"); print(p["estado"], p["jev_vetado"]["por"])
PY
)
[ "$o" = "abierta andres" ] && ok "cualquier persona autorizada deshace a Jev (y nadie más)" || bad "deshacer: $o"
o=$(aplicar g9 acepto 0.99); [[ "$o" == abierta* ]] && echo "$o" | grep -q "deshizo" && ok "una puerta deshecha ya no la vuelve a decidir Jev" || bad "veto: $o"
o=$(py g9 <<PY
$CABECERA
try:
    N.decidir(sys.argv[2], "acepto", "", "jev", "jev", "jev", {}); print("coló")
except N.Rechazo as e:
    print("rechazo")
PY
)
[ "$o" = rechazo ] && ok "nadie puede hacerse pasar por Jev con decidir()" || bad "suplantar: $o"

# ── 3. el notario ────────────────────────────────────────────────────────────────────────────────────────────────
firmar() { out=$(bash "$ROOT/firmar.sh" "$R" "$1" 2>&1); rc=$?; }
jevdecide() {  # decisión de Jev escrita a mano (como si la hubiera dejado el gateway)
  mkdir -p .sdd/hermes/decisiones
  jq -n --arg v "$2" --arg p "$3" --arg a "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    '{verbo:$v, texto:"", actor:{persona:"jev", canal:"jev", id:"jev-test"}, prueba:{modelo:"jev-test", p:$p, modo:"auto"}, at:$a}' \
    > ".sdd/hermes/decisiones/$1.json"; }
TAB=; modo consejo local; puerta n1 requisitos; jevdecide n1 acepto 0.97; firmar n1
[ $rc -ne 0 ] && echo "$out" | grep -q "Jev no puede decidir esta puerta: modo consejo" && ok "notario: en modo consejo no firma una decisión de Jev" || bad "notario consejo: $out"
modo auto local; puerta n2 requisitos; jevdecide n2 acepto 0.5; firmar n2
[ $rc -ne 0 ] && echo "$out" | grep -q "umbral" && ok "notario: no firma una decisión de Jev por debajo del umbral" || bad "notario umbral: $out"
puerta n3 requisitos; jevdecide n3 acepto 0.97; firmar n3
[ $rc -eq 0 ] && ok "notario: en modo auto firma la decisión de Jev ($out)" || bad "notario auto: $out"
T3=$(git tag -l 'requirements-v*' | head -1)
git tag -n20 -l "$T3" | grep -q "Approved-by: Jev (jev-test)" && git tag -n20 -l "$T3" | grep -q "Approver-role: Agente automático (modo auto)" \
  && ok "el tag dice que aprobó Jev, en modo auto (no una persona)" || bad "tag: $(git tag -n20 -l "$T3")"
grep -q "^> \*\*Approved by:\*\* Jev (jev-test) (Agente automático (modo auto))" requirements/REQUIREMENTS.md \
  && ok "REQUIREMENTS.md: Approved by Jev" || bad "Approved by: $(grep 'Approved by' requirements/REQUIREMENTS.md)"
git tag -d "$T3" >/dev/null   # que la siguiente prueba pueda volver a etiquetar
puerta n4 requisitos; mkdir -p .sdd/hermes/decisiones
jq -n --arg a "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '{verbo:"acepto", texto:"", actor:{persona:"andres", canal:"jev", id:"x"}, prueba:{p:"0.99"}, at:$a}' \
  > .sdd/hermes/decisiones/n4.json; firmar n4
[ $rc -ne 0 ] && echo "$out" | grep -q "debe ser de jev" && ok "notario: el canal jev no sirve para firmar en nombre de una persona" || bad "notario suplantar: $out"
puerta n5 requisitos; jq '.jev_vetado = {"por":"andres"}' "$HERMES_SDD_HOME/puertas/n5.json" > "$T/x" && mv "$T/x" "$HERMES_SDD_HOME/puertas/n5.json"
jevdecide n5 acepto 0.99; firmar n5
[ $rc -ne 0 ] && echo "$out" | grep -q "deshizo" && ok "notario: no firma a Jev en una puerta que una persona le quitó" || bad "notario veto: $out"

# ── 4. consulta real (sdd-jev.mjs judge) contra un Jev falso ────────────────────────────────────────────────────
cat > "$T/jev_falso.py" <<'PY'
import json, os, sys
from http.server import BaseHTTPRequestHandler, HTTPServer
class H(BaseHTTPRequestHandler):
    def do_POST(s):
        body = json.loads(s.rfile.read(int(s.headers["Content-Length"])))
        open(os.environ["VISTO"], "w").write(json.dumps(body))
        opciones = list(body["questions"]["decision"]["criteria"])
        elegida = os.environ.get("ELIGE", opciones[0])
        p = {o: (0.93 if o == elegida else round(0.07 / max(1, len(opciones) - 1), 3)) for o in opciones}
        r = json.dumps({"model": "jev-falso", "usage": {"input_tokens": 10},
                        "answers": {"decision": {"type": "choice", "choice": elegida, "confidence": "high", "probabilities": p}}}).encode()
        s.send_response(200); s.send_header("Content-Type", "application/json"); s.end_headers(); s.wfile.write(r)
    def log_message(s, *a): pass
srv = HTTPServer(("127.0.0.1", 0), H); print(srv.server_port, flush=True); srv.serve_forever()
PY
VISTO="$T/visto.json" python3 "$T/jev_falso.py" > "$T/puerto" & SRV=$!
for _ in $(seq 50); do [ -s "$T/puerto" ] && break; sleep 0.1; done
export SDD_JEV_URL="http://127.0.0.1:$(cat "$T/puerto")" TYPESAFE_API_KEY=prueba
echo "{\"root\": \"$ROOT\"}" > "$HERMES_SDD_HOME/instalacion.json"
TAB=demo; modo auto demo; puerta c1 requisitos
o=$(python3 - "$ROOT" <<'PY'
import asyncio, importlib.util, json, os, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd", Path(sys.argv[1]) / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
idx = m.HOME / "puertas" / "c1.json"
p = asyncio.run(m._jev_en_puerta(idx, json.loads(idx.read_text())))
print(p["estado"], p["jev"].get("choice"), p["jev"].get("p"), p["jev"].get("modelo"))
PY
)
[ "$o" = "decidida acepto 0.93 jev-falso" ] && ok "el gateway pregunta a Jev con sdd-jev.mjs y aplica su respuesta ($o)" || bad "gateway: $o"
jq -e '.state.contexto["requirements/REQUIREMENTS.md"] and .state.contexto["requirements/CUSTOMER-NEEDS.md"] and (.questions.decision.criteria | keys == ["acepto","persona"])' \
  "$T/visto.json" >/dev/null && ok "Jev recibe necesidades y requisitos, y solo puede elegir acepto o persona" || bad "lo que ve Jev: $(head -c 300 "$T/visto.json")"
# Instalado, el arnés está detrás de un enlace (actual → versión): sdd-jev.mjs debe ejecutarse igual (incidente 10/11/2026:
# salía con 0 y sin salida, y la puerta quedaba en «Jev no respondió»)
ln -s "$ROOT" "$T/actual"
o=$(TYPESAFE_API_KEY= node "$T/actual/metodo/scripts/sdd-jev.mjs" status 2>&1); rc=$?
[ $rc -eq 3 ] && echo "$o" | grep -q "disabled" && ok "sdd-jev.mjs llamado a través de un enlace sí se ejecuta" || bad "enlace: rc=${rc} «${o}»"
echo "{\"root\": \"$T/actual\"}" > "$HERMES_SDD_HOME/instalacion.json"
consulta() { python3 - "$ROOT" <<'PY'
import asyncio, importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd", Path(sys.argv[1]) / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
r = asyncio.run(m._consultar_jev(json.loads((m.HOME / "puertas" / "c1.json").read_text())))
print(r.get("error", "")[:40] if r.get("error") else f"{r.get('choice')} {r.get('p')}")
PY
}
o=$(consulta); [ "$o" = "acepto 0.93" ] && ok "el gateway consulta a Jev con el arnés instalado detrás de un enlace" || bad "gateway con enlace: $o"
o=$(TYPESAFE_API_KEY= consulta); [[ "$o" == "Jev apagado"* ]] && ok "con el enlace y sin clave: «Jev apagado», no «sin respuesta»" || bad "apagado con enlace: $o"
echo "{\"root\": \"$ROOT\"}" > "$HERMES_SDD_HOME/instalacion.json"
o=$(bash "$ROOT/jev.sh" probar c1 2>&1); echo "$o" | grep -q "Jev elige: acepto (p 0.93" && ok "jev.sh probar enseña la respuesta sin decidir" || bad "probar: $o"
o=$(TYPESAFE_API_KEY= python3 - "$ROOT" <<'PY'
import asyncio, importlib.util, json, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd", Path(sys.argv[1]) / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(asyncio.run(m._consultar_jev(json.loads((m.HOME / "puertas" / "c1.json").read_text()))).get("error", "")[:40])
PY
)
[[ "$o" == "Jev apagado"* ]] && ok "sin clave de TypeSafe, Jev queda apagado y decide una persona" || bad "sin clave: $o"

# ── 4b. preguntas abiertas según el modo, y volver a preguntar ──────────────────────────────────────────────────
TAB=demo; puerta q1 requisitos
jq '.preguntas = [{"n":1,"id":"Q-x-001","opciones":["A","B"],"recomendada":"A"}]' "$HERMES_SDD_HOME/puertas/q1.json" > "$T/x" && mv "$T/x" "$HERMES_SDD_HOME/puertas/q1.json"
mkdir -p .sdd && printf '## Q-x-001 [OPEN]\nQuestion: ¿Texto?\n  A) Hola (recommended)\n  B) Adiós\n' > .sdd/questions-x.md
pregunta() { py q1 <<PY
$CABECERA
p = json.load(open(N.indice(sys.argv[2])))
q = N.pregunta_jev(p)["decision"]; s = N.estado_jev(p)
print(("RECOMMENDED" in q["instructions"]), ("open questions" in q["criteria"]["persona"]), (".sdd/questions-x.md" in s["contexto"]),
      ("delegated this decision" in q["instructions"]), ("concrete problem" in q["criteria"]["persona"]))
PY
}
modo auto demo; o=$(pregunta); [ "$o" = "True False True True True" ] && ok "auto: el cliente delegó; Jev juzga las recomendadas y solo devuelve la puerta ante un problema concreto" || bad "auto preguntas: $o"
modo consejo demo; o=$(pregunta); [ "$o" = "False True True False False" ] && ok "consejo: instrucción prudente y las preguntas siguen siendo motivo para una persona" || bad "consejo preguntas: $o"
modo auto demo; aplicar q1 persona 0.99 >/dev/null
o=$(python3 "$NUCLEO" rejuzgar q1 2>&1; jq -r 'has("jev")' "$HERMES_SDD_HOME/puertas/q1.json")
echo "$o" | grep -q "volverá a preguntar" && echo "$o" | grep -qx false && ok "rejuzgar borra el juicio para que el gateway pregunte otra vez" || bad "rejuzgar: $o"
jq '.jev_vetado = {"por":"andres"}' "$HERMES_SDD_HOME/puertas/q1.json" > "$T/x" && mv "$T/x" "$HERMES_SDD_HOME/puertas/q1.json"
python3 "$NUCLEO" rejuzgar q1 >/dev/null 2>&1 && bad "rejuzga una puerta vetada" || ok "rejuzgar no vale si una persona deshizo a Jev"
rm -f .sdd/questions-x.md

# ── 4c. la puerta de requisitos lista también las restricciones (REQ-C) ───────────────────────────────────────────
cat >> requirements/REQUIREMENTS.md <<'R'

### REQ-C-901: Sin servidor
- **Statement:** The tool runs without a server.
- **Needs:** N-001
R
git add -A && git commit -qm "test: restricción"
o=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" requisitos); 
jq -r '.texto' "$HERMES_SDD_HOME/puertas/$o.json" | sed -n '/^🔧 Condiciones/,/^$/p' | grep -q '^• Sin servidor$' && ok "la puerta de requisitos muestra las restricciones, aparte" || bad "REQ-C: $(jq -r .texto "$HERMES_SDD_HOME/puertas/$o.json" | head -12)"

# ── 5. jev.sh ────────────────────────────────────────────────────────────────────────────────────────────────────
bash "$ROOT/jev.sh" umbral 0.8 >/dev/null && bash "$ROOT/jev.sh" piloto ruta,plan,mantenimiento >/dev/null && bash "$ROOT/jev.sh" recetas piloto >/dev/null
o=$(jq -c '[.umbral, .piloto, .proyectos.recetas, .proyectos.demo]' "$HERMES_SDD_HOME/jev.json")
[ "$o" = '[0.8,["ruta","plan","mantenimiento"],"piloto","auto"]' ] && ok "jev.sh cambia umbral, tipos de piloto y modo por proyecto" || bad "jev.sh: $o"
bash "$ROOT/jev.sh" recetas sinsentido >/dev/null 2>&1 && bad "jev.sh acepta un modo desconocido" || ok "jev.sh rechaza un modo desconocido"
exit $fail
