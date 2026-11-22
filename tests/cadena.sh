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

# Etapa 3: cada cláusula del THEN se ve (en «Se ve») o se declara no visible (en «No visible»); si no, la voz acaba
# prometiendo lo que el vídeo no enseña (montana11, REQ-F-002 AC4: «entra con la nueva y no con la antigua», por API)
w="$(cd "$m11" && node "$SDD" lint --needs --json 2>/dev/null || true)"
nw() { printf '%s' "$w" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const j=JSON.parse(s);const x=(j.warnings||[]).filter((w)=>w.code==="then-not-seen");process.stdout.write(String(eval(process.argv[1])))})' "$1"; }
[ "$(nw 'x.length >= 20 && x.some((w)=>/REQ-F-002 AC4/.test(w.msg) && /old one/.test(w.msg)) && !x.some((w)=>/REQ-F-002 AC1\b/.test(w.msg))')" = true ] \
  && ok "montana11 etapa 3: las cláusulas del THEN que ni se ven ni se declaran no visibles salen en el lint de requisitos" || mal "montana11 etapa 3: then-not-seen $(nw 'x.length')"

# Etapa 4: el expediente de cada criterio (prueba, captura, vídeo, voz, revisión de Jev, visible). FASE-1 de montana11:
# REQ-F-003 AC9 con la narración que Jev dio por incompleta y que nadie corrigió antes de la puerta
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 etapa 4: el expediente marca REQ-F-003 AC9 incompleto por la revisión de Jev, y solo los criterios de la FASE" || mal "montana11 etapa 4: expediente"
import sys
sys.path.insert(0, sys.argv[1])
import hsdd_expediente as E
e = E.expediente(sys.argv[2], "1", medios=False)
x = {c["criterio"]: c for c in e["criterios"]}
assert e["resumen"]["criterios"] == 14, e["resumen"]
assert x["REQ-F-003-AC9"]["piezas"]["revisión"] is False and x["REQ-F-003-AC9"]["estado"] == "incompleto", x["REQ-F-003-AC9"]
assert all(c["piezas"]["prueba"] and c["piezas"]["captura"] and c["piezas"]["vídeo"] for c in e["criterios"]), e
# lo que puede completar el implementador, sin lo que es de los requisitos (visible)
assert [c["criterio"] for c in E.arreglables(e)] == ["REQ-F-003-AC9"], E.arreglables(e)
PY

# La puerta de la FASE dice cuántos criterios llegan demostrados y cuáles no, con lo que les falta
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 etapa 4: la puerta enseña el expediente («7 de 14 criterios demostrados» y lo que falta)" || mal "montana11 etapa 4: puerta sin expediente"
import sys
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_expediente as E, hsdd_textos as T
E.guardar(Path(sys.argv[2]), "1", medios=False)
l = T.linea_expediente(Path(sys.argv[2]), "1")
assert l.startswith("🧾 Demostrados: 7 de 14 criterios") and "REQ-F-003 AC9" in l and "Jev" in l, l
PY

# F-4: lo que la persona aclara de una impugnación al rechazar queda registrado como su respuesta, llega a la ronda
# adversarial siguiente y la puerta lo recuerda (montana11: CH-007 aclarado en el rechazo, reabierto como CH-008 «no
# hay respuesta registrada» y con la recomendación contraria)
python3 - "$AQUI/plugin/hermes-sdd" "$m11" <<'PY' && ok "montana11 F-4: la aclaración de CH-007 en el rechazo queda registrada y llega a la ronda y a la puerta" || mal "montana11 F-4: la aclaración del rechazo se pierde"
import sys, json
from pathlib import Path
sys.path.insert(0, sys.argv[1])
import hsdd_textos as T
R = Path(sys.argv[2])
texto = [json.loads(l) for l in (R / ".sdd/hermes/puertas.jsonl").read_text().splitlines() if '"rechazo"' in l and '"fase":"5"' in l][0]["texto"]
xs = T.registrar_aclaraciones(R, "5", texto, "Andres Leon")
por = {x["challenge"]: x for x in xs}
assert set(por) == {"CH-006", "CH-007"}, xs
assert por["CH-007"]["req"] == "REQ-F-009" and por["CH-007"]["ac"] == 2 and por["CH-007"]["texto"].startswith("el Casco 2 sigue prestado"), por["CH-007"]
assert "CH-007" not in por["CH-006"]["texto"], por["CH-006"]
b = T.bloque_aclaraciones(R, "5")
assert "REQ-F-009 AC2" in b and "Casco 2 sigue prestado" in b and "do not reopen" in b, b
# la puerta: una duda nueva sobre ese criterio (CH-008) enseña lo que ya se respondió
assert "Ya respondiste" in T.ya_respondido(R, "REQ-F-009", 2), T.ya_respondido(R, "REQ-F-009", 2)
assert T.ya_respondido(R, "REQ-F-001", 1) == ""
PY

# F-2 (raíz): Q-03 por criterio, no por fichero. montana11 FASE-3: el unitario de REQ-F-006 AC2 lo citaba sin el texto
# «Sin multas» y el e2e del mismo criterio sí lo comprobaba en pantalla; Q-03 daba error, el criterio no pasaba y la
# pregunta recomendaba «A) se deja como está», que no lo arreglaba (costó un rechazo y editar un test ya aceptado)
f2="$tmp/f2"; rm -rf "$f2"; cp -R "$m11" "$f2"
python3 - "$f2/tests/unit/multas.test.js" <<'PY'
import sys; p = sys.argv[1]; s = open(p).read()
for l in ["    // Se ve: \"Sin multas\" en Multas: sin multa, Pablo no tiene nada que listar y el texto de la pantalla es \"Sin multas\"\n",
          "    expect(listarMisMultas(e.ctx(sesionDe(e, 'pablo@club.test', 'Nieve2026')))).toEqual([]);\n",
          "    expect(TEXTOS.sinMultas).toBe('Sin multas');\n"]:
    assert l in s, l; s = s.replace(l, "")
open(p, "w").write(s)
PY
q="$(cd "$f2" && node "$SDD" lint --quotes --json 2>/dev/null || true)"
sev() { printf '%s' "$q" | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const j=JSON.parse(s);const x=j.findings.filter((f)=>f.code==="Q-03"&&f.req==="REQ-F-006"&&f.ac===2);process.stdout.write(x.map((f)=>f.file.split("/").pop()+":"+f.severity).join())})'; }
[ "$(sev)" = "multas.test.js:warn" ] && ok "montana11 F-2: un unitario sin el literal, con el e2e del criterio que lo comprueba, es aviso y no error" || mal "montana11 F-2: Q-03 por fichero ($(sev))"

# --- material-montana12
m12="$(copia material-montana12)"

# G-7: la puerta de la FASE enseña el montaje (todos los criterios), no el primer vídeo: `ls` ordena todo junto y
# «AC-001-01.mp4» va antes que «MONTAJE-FASE-0.mp4» (montana12 FASE-0: la puerta enseñó 1 vídeo de 16)
(cd "$m12" && for j in evidencias/FASE-0/*.narracion.json; do : > "${j%.narracion.json}.mp4"; done; : > evidencias/FASE-0/MONTAJE-FASE-0.mp4)
v="$(cd "$m12" && ROOT="$AQUI" bash -c '. "$ROOT/lib/comun.sh"; video_fase 0')"
[ "$v" = evidencias/FASE-0/MONTAJE-FASE-0.mp4 ] && ok "montana12 G-7: la puerta de la FASE-0 enseña su montaje" || mal "montana12 G-7: la puerta enseña $v"


# G-5: la tercera puerta de requisitos (g179535243959a8, 14:00) estaba abierta cuando se llamó a `lanzar.sh esperar`
# por primera vez; esa llamada la apuntó como «ya vista» sin decirla y ninguna otra la avisó (54 min perdidos). Las
# puertas que ya están abiertas al empezar a esperar se avisan; solo lo cerrado se da por visto
g5="$tmp/g5"; rm -rf "$g5"; cp -R "$m12" "$g5"; hs="$tmp/g5-hs"; mkdir -p "$hs/puertas"
rm -f "$g5/.sdd/hermes/esperar-avisadas" "$g5/.sdd/hermes/esperar-linea"
for p in "$g5"/.sdd/hermes/puertas/*.json; do jq --arg r "$g5" '.repo = $r' "$p" > "$hs/puertas/$(basename "$p")"; done
for p in "$hs"/puertas/*.json; do jq '.estado = (if .id == "g179535243959a8" then "abierta" else "decidida" end)' "$p" > "$p.t" && mv "$p.t" "$p"; done
head -2 "$g5/.sdd/hermes/etapas.jsonl" > "$g5/e" && mv "$g5/e" "$g5/.sdd/hermes/etapas.jsonl"
e="$(HERMES_SDD_HOME="$hs" HERMES_SDD_ESPERA_INTERVALO_S=0.2 bash "$AQUI/lanzar.sh" esperar "$g5" --max 2 || true)"
[ "${e%%:*}" = "PUERTA g179535243959a8 requisitos abierta" ] && ok "montana12 G-5: la puerta ya abierta al empezar a esperar se avisa" || mal "montana12 G-5: esperar dice «${e}»"


# G-9 (montana12 AC-009-01): entre «entra» y «Reserva cancelada» el webm tenía un solo fotograma: el clic no se grabó y
# ninguna cámara lenta lo enseña. La grabación de evidencias (SDD_FASE) va con slowMo; la suite del agente y los
# mutantes (sin SDD_FASE), a toda velocidad
pw="$tmp/pw"; mkdir -p "$pw/node_modules/@playwright/test" "$pw/tests/e2e/fixtures"; (cd "$pw" && git init -q)
cp "$AQUI/templates/stacks/web-vite/playwright.config.js" "$pw/"; cp "$AQUI/templates/stacks/web-vite/tests/e2e/fixtures/evidence.js" "$pw/tests/e2e/fixtures/"
printf '{"name":"@playwright/test","type":"module","main":"index.js"}' > "$pw/node_modules/@playwright/test/package.json"
printf 'export const defineConfig = (c) => c; export const devices = { "Desktop Chrome": {} }; export const expect = {}; export const test = { extend: (o) => o };\n' > "$pw/node_modules/@playwright/test/index.js"
printf '{"type":"module"}' > "$pw/package.json"
sm() { (cd "$pw" && node --input-type=module -e 'const f = (await import(process.cwd() + "/tests/e2e/fixtures/evidence.js")).test.launchOptions; let v; await f[0]({ launchOptions: {} }, (x) => { v = x; }); console.log(v?.slowMo ?? 0)'); }
a="$(SDD_FASE=1 sm)"; b="$(env -u SDD_FASE bash -c "$(declare -f sm); pw=$pw; sm")"
[ "${a:-0}" -ge 100 ] && [ "$b" = 0 ] && ok "montana12 G-9: las evidencias se graban con slowMo ($a ms) y la suite del agente no" || mal "montana12 G-9: slowMo con SDD_FASE=${a}, sin él=${b}"


# G-6: montana12 se creó con la plantilla de evidencias de un arnés anterior; al actualizar el arnés, la regla dura la
# daba por «tocada» y la FASE-0 falló dos veces. Una versión anterior de la plantilla se pone al día con su propio
# commit; la que el agente tocó (no es ninguna versión del arnés) sigue siendo una regla rota
g6="$tmp/g6"; rm -rf "$g6"; cp -R "$m12" "$g6"
(cd "$g6" && git init -q -b main && git add -A && git -c user.email=t@t -c user.name=t commit -qm banco)
d="$(cd "$g6" && ROOT="$AQUI" SDD="$SDD" FASE=0 bash -c '. "$ROOT/lib/comun.sh"; plantilla_al_dia >/dev/null 2>&1; duras_implementar' 2>&1 | grep 'evidence.js' || true)"
if [ -z "$d" ] && cmp -s "$g6/tests/e2e/fixtures/evidence.js" "$AQUI/templates/stacks/web-vite/tests/e2e/fixtures/evidence.js" \
   && git -C "$g6" log -1 --format=%s | grep -q 'plantilla'; then ok "montana12 G-6: la plantilla anterior se pone al día con su commit y no es una regla rota"
else mal "montana12 G-6: ${d:-no se puso al día} ($(git -C "$g6" log -1 --format=%s))"; fi
echo "// el agente la toca" >> "$g6/tests/e2e/fixtures/evidence.js"; git -C "$g6" -c user.email=t@t -c user.name=t commit -qam toca
d="$(cd "$g6" && ROOT="$AQUI" SDD="$SDD" FASE=0 bash -c '. "$ROOT/lib/comun.sh"; plantilla_al_dia >/dev/null 2>&1; duras_implementar' 2>&1 | grep 'evidence.js' || true)"
[ -n "$d" ] && ok "montana12 G-6: la plantilla tocada por el agente sigue siendo una regla rota" || mal "montana12 G-6: la tocada se dio por buena"


# G-12: «Lucía still has one reservation of 2» no lleva comillas y su «Se ve» lo enseña con otras palabras en una línea
# propia («una sola fila "2 × Linterna…"»); el expediente daba esos criterios por incompletos (FASE-3: «4 de 9» con los
# 9 demostrados en vídeo). Cada cláusula sin texto de pantalla la cubre una línea «Se ve» que no use otra cláusula;
# las comillas de un dato tecleado («"Otra12345"») cuentan si esa línea «Se ve» las nombra
tns() { (cd "$1" && node "$SDD" lint --needs --json 2>/dev/null | node -e 'let s="";process.stdin.on("data",(d)=>{s+=d}).on("end",()=>{const j=JSON.parse(s);console.log([...(j.findings||[]),...(j.warnings||[])].filter((f)=>f.code==="then-not-seen").map((f)=>f.msg.split(":")[0]).join(";"))})'); }
t="$(tns "$m12")"
[ -z "$t" ] && ok "montana12 G-12: ningún then-not-seen en los requisitos finales (cada cláusula tiene su línea «Se ve»)" || mal "montana12 G-12: then-not-seen falsos: $t"
g12="$tmp/g12"; rm -rf "$g12"; cp -R "$m12" "$g12"
python3 - "$g12/requirements/REQUIREMENTS.md" <<'PY'
import sys; p = sys.argv[1]; L = open(p).read().split("\n")
i = next(k for k, l in enumerate(L) if "una sola fila \"2 × Linterna" in l); del L[i]; open(p, "w").write("\n".join(L))
PY
t="$(tns "$g12")"
[ "$t" = "REQ-F-003 AC3" ] && ok "montana12 G-12: sin la línea «una sola fila…», «Lucía still has one reservation of 2» vuelve a faltar" || mal "montana12 G-12: sin su línea, then-not-seen = «$t»"


# G-11 (= M5-10): c0abc18 añadió una línea a playwright.config.js y 57a31be la quitó (los dos commits reales, en
# tests/fixtures/banco/parches): la config acaba igual que la aceptada y fidelidad daba dos graves «test ya aceptado
# cambiado». Un fichero que vuelve a ser el aceptado no se ha cambiado
g11="$tmp/g11"; rm -rf "$g11"; cp -R "$m12" "$g11"
(cd "$g11" && git init -q -b main && git add -A && git -c user.email=t@t -c user.name=t commit -qm banco && git tag fase-0-accepted \
  && git -c user.email=t@t -c user.name=t am -q "$AQUI/tests/fixtures/banco/parches/montana12-G-11.patch")
python3 - "$AQUI/plugin/hermes-sdd" "$g11" <<'PY' && ok "montana12 G-11: añadir y quitar la misma línea de la config no es «test aceptado cambiado»" || mal "montana12 G-11: grave falso por un cambio que se deshizo"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
R = Path(sys.argv[2])
assert len(F.git(R, "log", "--format=%h", "fase-0-accepted..HEAD").split()) == 2
x = [c for c in F.congelados(R) if c["fichero"] == "playwright.config.js"]
assert not x, x
PY


# G-14: Q-task-implementer-001 (registro real) se firmó en la puerta g1795363352189a durante la FASE-1 para editar
# tests/e2e/fase-0.spec.js en la FASE-2; fase-1-accepted (otra puerta) quedó en medio y la edición, fa15b53, salió
# «sin autorización» (grave) y se volvió a preguntar. Una aceptación caduca la autorización si el test ya se editó
# antes de ella; una autorización sin usar sigue valiendo
g14="$tmp/g14"; rm -rf "$g14"; cp -R "$m12" "$g14"
python3 - "$AQUI/plugin/hermes-sdd" "$g14" <<'PY' && ok "montana12 G-14: la autorización firmada en la FASE-1 vale para la edición de la FASE-2" || mal "montana12 G-14: autorización sin usar caducada"
import sys, json, os, subprocess
from pathlib import Path
R = Path(sys.argv[2]); os.environ["HERMES_SDD_HOME"] = str(R / ".home")
sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
F.HOME = R / ".home"
g = lambda *a: subprocess.run(["git", "-C", str(R), "-c", "user.email=t@t", "-c", "user.name=t", *a], check=True, capture_output=True, text=True).stdout.strip()
reg = next(json.loads(l) for l in (R / "acceptance/decisions.jsonl").read_text().splitlines() if "Q-task-implementer-001" in l and '"test-edit"' in l)
(R / "acceptance/decisions.jsonl").write_text("")
g("init", "-q", "-b", "main"); g("add", "-A"); g("commit", "-qm", "FASE-1 en su puerta"); reg["head"] = g("rev-parse", "HEAD")
(R / "acceptance/decisions.jsonl").write_text(json.dumps(reg) + "\n"); g("commit", "-qam", "decision: Q-task-implementer-001")
g("commit", "-q", "--allow-empty", "-m", "accept FASE-1", "-m", "Gate-Id: g1795363504c778"); g("tag", "fase-1-accepted")
p = R / "tests/e2e/fase-0.spec.js"; p.write_text(p.read_text() + "\n// AC-007-10 sin la comprobación obsoleta\n")
g("commit", "-qam", "test(e2e): drop the obsolete check of AC-007-10", "-m", "Autoriza: Q-task-implementer-001")
ok, por = F._autorizada(R, g("rev-parse", "HEAD"), "tests/e2e/fase-0.spec.js")
assert ok, por
# y la que ya se usó antes de aceptar sí caduca: otra edición tras la aceptación de la FASE-2 necesita autorización nueva
g("commit", "-q", "--allow-empty", "-m", "accept FASE-2", "-m", "Gate-Id: gX"); g("tag", "fase-2-accepted")
p.write_text(p.read_text() + "// otra\n"); g("commit", "-qam", "otra edición")
ok, por = F._autorizada(R, g("rev-parse", "HEAD"), "tests/e2e/fase-0.spec.js")
assert not ok and "caducó" in por, por
PY


# G-18: 4dfb50f (autorizado «solo para endurecerlo», Q-task-implementer-007) cambió un `page.goto` por un reintento
# hasta 15 s; «timeout: 15000» contaba como «plazo muy alargado» y salía grave. Un plazo dentro de lo que ya tiene un test
# (30 s en Playwright) no alarga nada; uno mayor, 0 (sin plazo), test.setTimeout o test.slow, sí
python3 - "$AQUI/plugin/hermes-sdd" <<'PY' && ok "montana12 G-18: esperar a que cargue (15 s) no es debilitar; un plazo de 60 s sí" || mal "montana12 G-18: plazo"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
q = ["await page.goto(`${BASE}/material`);"]
p = ["// El servidor recién reiniciado puede abortar una primera navegación: se reintenta hasta que carga.",
     "await expect(async () => { await page.goto(`${BASE}/material`); }).toPass({ timeout: 15000 });"]
assert "plazo muy alargado" not in F.debilitamiento(q, p, set()), F.debilitamiento(q, p, set())
for x in ["await expect(fila).toBeVisible({ timeout: 60000 });", "test.setTimeout(120000);", "test.slow();", "use: { timeout: 0 },"]:
    assert "plazo muy alargado" in F.debilitamiento([], [x], set()), x
PY

exit $fallo
