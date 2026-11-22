#!/usr/bin/env bash
# El banco: proyectos reales congelados (tests/fixtures/banco/, sin vídeos ni imágenes) sobre los que pasa la cadena
# criterio → test → captura → narración → veredicto sin modelo. Cada fallo de una prueba larga se reproduce aquí en
# rojo antes de arreglarlo (análisis 10 de la wiki: los arreglos probados con un solo caso inventado trajeron 9
# regresiones). Solo lee el banco: trabaja sobre una copia temporal.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
SDD="$AQUI/metodo/scripts/sdd.mjs"
BANCO="$AQUI/tests/fixtures/banco"
fallo=0
ok()  { echo "ok   $1"; }
mal() { echo "FAIL $1"; fallo=1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
copia() { rm -rf "$tmp/$1"; cp -R "$BANCO/$1" "$tmp/$1"; echo "$tmp/$1"; }

# --- material-montana11
m11="$(copia material-montana11)"
q="$(cd "$m11" && node "$SDD" lint --quotes 2>&1 || true)"
# F-3: «{tipo}: {n} unidades» está comprobado en el e2e como «Crampones: 2 unidades»; no falta la letra
if echo "$q" | grep -q 'fase-1-reservas.spec.js.*Q-03 REQ-F-008 AC1'; then mal "montana11 F-3: Q-03 falso en el e2e que comprueba «Crampones: 2 unidades»"; else ok "montana11 F-3: el e2e de REQ-F-008 AC1 lleva la plantilla en plural"; fi
if echo "$q" | grep 'Q-03 REQ-F-008 AC1' | grep -vq excepted; then mal "montana11 F-3: quedan Q-03 de REQ-F-008 AC1 por «unidad(es)»"; else ok "montana11 F-3: ningún Q-03 de REQ-F-008 AC1"; fi

# F-5: «Pablo Ruiz» y «Nieve2026» son datos que el usuario teclea en el criterio (GIVEN/WHEN), no textos de la app: no
# son «texto fuera del código» y el aviso del Encargado en la entrega no debe salir por ellos
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 F-5: un dato tecleado en el criterio no es «texto fuera del código»" || mal "montana11 F-5: aviso falso por «Pablo Ruiz» / «Nieve2026»"
import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_fidelidad as F
R = Path(sys.argv[2])
acc = json.loads((R / ".sdd" / "acceptance.json").read_text())
quiero = {("REQ-F-002", 1), ("REQ-NF-001", 3)}
acc["requirements"] = [{**r, "criteria": [c for c in r["criteria"] if (r["id"], c.get("n")) in quiero]} for r in acc["requirements"] if r["id"] in {q[0] for q in quiero}]
acc.pop("scope", None)
def _no(*a, **k): raise AssertionError("no debe ejecutar tests: no hay nada que mutar")
F._ejecuta = _no
out = F.mutantes(R, R, acc, solo_must=False)
fuera = [x for x in out if x["resultado"] == "no está en el código"]
assert not fuera, fuera
assert {x["texto"] for x in out if x["resultado"].startswith("dato del ejemplo")} == {"Pablo Ruiz", "Nieve2026"}, out
PY

# H-1: el e2e de REQ-F-006 AC4 comprueba «Tienes una multa pendiente…» (fase-3-ciclo-multas.spec.js:137); el control de
# vínculos no encontraba su cuerpo (Playwright separa describe y test con « › », no con « > ») y daba un grave falso
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 H-1: vínculos lee el cuerpo de un test de Playwright dentro de un describe" || mal "montana11 H-1: grave falso de vínculos en REQ-F-006 AC4"
import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_fidelidad as F
R = Path(sys.argv[2])
acc = json.loads((R / ".sdd" / "acceptance.json").read_text())
assert "toHaveText('Tienes una multa pendiente" in F._cuerpo_test(R, "fase-3-ciclo-multas.spec.js", "WF-001 FASE-3 Multas, bloqueo y pago (UC-011, UC-012) › WF-001 AC-010-04 REQ-F-006 AC4 pablo con multa Pendiente de 6,00 € y una reserva del 2026-12-20")
graves = [(x["req"], x["ac"]) for x in F.vinculos(R, acc) if x["grave"]]
assert ("REQ-F-006", 4) not in graves, graves
print("   graves de vínculos en montana11:", sorted(set(graves)))
PY

# H-1/H-2: lo que la aceptación dejó en fidelidad-global.json llega a la puerta: un grave de vínculos (antes ninguna
# puerta lo decía) y los mutantes que no se pudieron ejecutar (47 de 49: el control no corrió y la puerta callaba)
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 H-1/H-2: la puerta dice los graves de vínculos y los mutantes sin ejecutar" || mal "montana11 H-1/H-2: controles apagados sin aviso en la puerta"
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_revision as V
av = {a["codigo"]: a for a in V._fidelidad(Path(sys.argv[2]), None)}
assert av["test-sin-el-texto"]["grave"] and "REQ-F-006 AC4" in av["test-sin-el-texto"]["texto"], av.keys()
m = av["mutantes-sin-ejecutar"]
assert "47 de 49" in m["texto"], m
PY

# H-2: la línea base de los mutantes (¿pasan los tests sin mutar nada?) se repite una vez si falla: en PcWindows el
# primer e2e en frío agotó sus 30 s y dejaba «sin comprobar» todos los textos de su criterio
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 H-2: un fallo aislado de la línea base no deja los mutantes sin ejecutar" || mal "montana11 H-2: la línea base no se reintenta"
import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_fidelidad as F
R = Path(sys.argv[2])
acc = json.loads((R / ".sdd" / "acceptance.json").read_text())
acc["requirements"] = [{**r, "criteria": [c for c in r["criteria"] if c.get("n") == 4]} for r in acc["requirements"] if r["id"] == "REQ-F-006"]
acc.pop("scope", None)
n = {"e2e": 0}
def ej(copia, cmd, minutos=10):
    if "playwright" in cmd:
        n["e2e"] += 1
        return n["e2e"] != 1          # el primer e2e falla (arranque en frío); después pasa
    return True
F._ejecuta = ej
out = F.mutantes(R, R, acc, solo_must=False)
assert out and not any("sin comprobar" in x["resultado"] or x.get("grave") and x.get("fallan") for x in out), out
PY

# Presentación del criterio (Andrés, 22-nov): cada vídeo abre diciendo y escribiendo qué requisito es, qué pide, cuáles
# son sus criterios de aceptación y cuál demuestra este vídeo; después viene la demostración en vivo. Sale del guion
# (requisitos + escenarios BDD en castellano), no lo escribe el agente
g="$(cd "$m11" && node "$SDD" demo script --fase 4 --json 2>/dev/null)"
pj() { printf '%s' "$g" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const j=JSON.parse(s);const c=j.criterios.find((x)=>x.id==="AC-004-01")||{};const p=c.presentacion||{};process.stdout.write(String(eval(process.argv[1])))})' "$1"; }
[ "$(pj 'p.requisito + "|" + p.titulo + "|" + p.n + "/" + p.total')" = "REQ-F-002|Gestionar las cuentas de socios|4/7" ] \
  && ok "montana11 presentación: el guion dice de qué requisito es cada criterio y cuál de cuántos" || mal "montana11 presentación: $(pj 'JSON.stringify(p)' | cut -c1-200)"
[ "$(pj 'p.pasos.map((x)=>x.k).join()')" = "Dado,Cuando,Entonces,Y" ] && [ "$(pj 'p.pasos[2].texto')" = 'el usuario ve "Contraseña restablecida"' ] \
  && ok "montana11 presentación: el criterio en castellano, del escenario BDD (Dado, Cuando, Entonces)" || mal "montana11 presentación: pasos $(pj 'JSON.stringify(p.pasos)')"
[ "$(pj 'p.criterios.length + "|" + p.criterios.filter((x)=>x.actual).map((x)=>x.n+":"+x.titulo).join()')" = "7|4:Restablecer contraseña" ] \
  && ok "montana11 presentación: la lista de los criterios del requisito, con el de este vídeo marcado" || mal "montana11 presentación: lista $(pj 'JSON.stringify(p.criterios)')"
v="$(pj 'p.voz')"
case "$v" in "Requisito funcional 2: Gestionar las cuentas de socios."*"Tiene 7 criterios de aceptación. Este vídeo demuestra el criterio 4: Restablecer contraseña. Dado que "*"cuando fija la nueva"*"entonces el usuario ve"*"Contraseña restablecida"*) ok "montana11 presentación: la voz presenta requisito, criterios y el criterio que se demuestra";; *) mal "montana11 presentación: voz «$v»";; esac

exit $fallo
