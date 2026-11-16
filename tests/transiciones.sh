#!/usr/bin/env bash
# La tabla de transiciones de las puertas (lib/transiciones.json) recorrida entera, y los contratos que dependen de ella:
# firmar.sh valida con ella, lanzar.sh siguiente elige con ella el tramo, y ninguno de los dos guarda su propio mapa.
# También lo que se unificó con ella: el slug del tablero y «¿plan de una sola FASE?» (lib/comun.sh → hsdd_nucleo), la
# firma estructurada que leen los canales y la etapa de una tarjeta con su línea «Origen:». Sin LLM ni kanban.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }

# ── 1. la tabla, entera: cada verbo lleva a un resultado y cada resultado a un tramo (o a «fin») ────────────────────
o=$(python3 - "$ROOT" <<'PY'
import json, re, sys
from pathlib import Path
root = Path(sys.argv[1])
tabla = json.loads((root / "lib/transiciones.json").read_text())["puertas"]
lanzar = (root / "lanzar.sh").read_text()
funciones = set(re.findall(r"^tramo_([a-z_]+)\(\)", lanzar, re.M))
errs, usados = [], set()
def entrada(m, k):
    if k in m:
        return m[k]
    return next((v for c, v in m.items() if c.endswith("*") and k.startswith(c[:-1])), None)
for tipo, d in tabla.items():
    verbos, resultados = d.get("verbos") or {}, d.get("resultados") or {}
    if not verbos:
        errs.append(f"{tipo}: sin verbos")
    for v, e in verbos.items():
        if not e.get("resultado"):
            errs.append(f"{tipo}:{v} sin resultado"); continue
        ejemplo = v[:-1] + "x" if v.endswith("*") else v
        r = e["resultado"].replace("{verbo}", ejemplo)
        if entrada(resultados, r) is None:
            errs.append(f"{tipo}:{v} lleva a «{r}», que no tiene tramo")
        if e.get("como") and e["como"] not in verbos:
            errs.append(f"{tipo}:{v} se firma como «{e['como']}», que no es un verbo de {tipo}")
        if e.get("como") and e["resultado"] != verbos[e["como"]]["resultado"]:
            errs.append(f"{tipo}:{v} y su «como» llevan a resultados distintos")
        if e.get("si_distintas") and e["si_distintas"] not in verbos:
            errs.append(f"{tipo}:{v} si_distintas → «{e['si_distintas']}», que no es un verbo de {tipo}")
        if not set(e.get("respuestas") or []) <= {"cambio", "aplicar"}:
            errs.append(f"{tipo}:{v} respuestas desconocidas {e.get('respuestas')}")
        if e.get("persona") and not e.get("opcion"):
            errs.append(f"{tipo}:{v} solo para personas pero sin «opcion» (la puerta tiene que ofrecerlo)")
    alcanzados = set()
    for v, e in verbos.items():
        alcanzados.add(e["resultado"].replace("{verbo}", v) if "{verbo}" in e["resultado"] else e["resultado"])
    for r, dest in resultados.items():
        if r not in alcanzados:
            errs.append(f"{tipo}: el resultado «{r}» no sale de ningún verbo")
        t = dest.get("tramo")
        if not t:
            errs.append(f"{tipo}:{r} sin tramo")
        elif t == "fin":
            if not dest.get("mensaje"):
                errs.append(f"{tipo}:{r} acaba sin decir por qué («mensaje»)")
        elif t not in funciones:
            errs.append(f"{tipo}:{r} → tramo «{t}», que lanzar.sh no tiene (tramo_{t})")
        else:
            usados.add(t)
        if not isinstance(dest.get("negativo", False), bool):
            errs.append(f"{tipo}:{r} negativo no es true/false")
for f in sorted(funciones - usados):
    errs.append(f"lanzar.sh tiene tramo_{f}, que la tabla no usa")
print("\n".join(errs) or "BIEN")
PY
)
[ "$o" = BIEN ] && ok "tabla: cada verbo tiene resultado, cada resultado su tramo (o «fin» con su porqué) y lanzar.sh no tiene tramos de más" || bad "tabla: $o"

# ── 2. firmar.sh no guarda su propio mapa: cada rama de lo que aplica es de la tabla, y cada verbo de la tabla tiene rama
o=$(python3 - "$ROOT" <<'PY'
import fnmatch, json, re, sys
from pathlib import Path
root = Path(sys.argv[1])
tabla = json.loads((root / "lib/transiciones.json").read_text())["puertas"]
f = (root / "firmar.sh").read_text()
errs = []
# lo que se aplica: el case de «2. aplicar según el tipo de puerta»
bloque = f[f.index("# ── 2. aplicar según el tipo de puerta"):]
bloque = bloque[:bloque.index("\nesac\n")]
ramas = [p for linea in re.findall(r"^  ([a-z][a-z|:*-]*)\)", bloque, re.M) for p in linea.split("|")]
if not ramas:
    errs.append("no encuentro las ramas de firmar.sh")
pares = [(t, v) for t, d in tabla.items() for v, e in d["verbos"].items() if not e.get("como")]
for r in ramas:
    t, _, v = r.partition(":")
    if not any(t == tt and (fnmatch.fnmatch(vv, v) or fnmatch.fnmatch(v, vv)) for tt, vv in pares):
        errs.append(f"firmar.sh aplica {r}, que no está en la tabla (verbo huérfano)")
for t, v in pares:
    if not any(fnmatch.fnmatch(f"{t}:{v}", r) for r in ramas):
        errs.append(f"la tabla tiene {t}:{v} y firmar.sh no sabe aplicarlo")
# y no quedan las listas viejas: «Verbos válidos por tipo», resultados a mano, PIDEN/ACCIONES por tipo:verbo
if re.search(r'RESULTADO="', f):
    errs.append("firmar.sh vuelve a fijar RESULTADO a mano")
if len(re.findall(r'case "\$TIPO:\$VERBO" in', f)) != 1:
    errs.append("firmar.sh tiene otro case \"$TIPO:$VERBO\" además del que aplica")
l = (root / "lanzar.sh").read_text()
if re.search(r'case "\$TIPO:\$RESULTADO"', l):
    errs.append("lanzar.sh vuelve a tener su case \"$TIPO:$RESULTADO\"")
print("\n".join(errs) or "BIEN")
PY
)
[ "$o" = BIEN ] && ok "firmar.sh: ninguna rama sin tabla ni verbo de la tabla sin rama; lanzar.sh sin case propio" || bad "firmar/lanzar: $o"

# ── 3. lo que ofrecen las puertas (puerta.sh) es lo que la tabla admite, con el mismo «necesita texto» ──────────────
o=$(python3 - "$ROOT" <<'PY'
import json, re, sys
from pathlib import Path
root = Path(sys.argv[1])
tabla = json.loads((root / "lib/transiciones.json").read_text())["puertas"]
p = (root / "puerta.sh").read_text()
errs = []
texto_tabla = {}
for d in tabla.values():
    for v, e in d["verbos"].items():
        texto_tabla.setdefault(v, set()).add(bool(e.get("texto")))
for m in re.finditer(r'\{"verbo":"([a-z-]+)"[^{}]*\}', p):
    v, lit = m.group(1), m.group(0)
    if v == "ver":   # ver la demo no decide nada
        continue
    if v not in texto_tabla:
        errs.append(f"puerta.sh ofrece «{v}», que la tabla no conoce"); continue
    if texto_tabla[v] != {'"texto":true' in lit}:
        errs.append(f"«{v}»: puerta.sh y la tabla no coinciden en si necesita texto")
print("\n".join(errs) or "BIEN")
PY
)
[ "$o" = BIEN ] && ok "las opciones de puerta.sh son verbos de la tabla y piden texto cuando la tabla lo pide" || bad "opciones: $o"

# ── 4. las consultas de lib/transiciones.sh ────────────────────────────────────────────────────────────────────────
(
  . "$ROOT/lib/transiciones.sh"
  r=""
  [ "$(trans_campo ruta ruta-mia resultado)" = ruta-mia ] || r="$r ruta-*"
  [ "$(trans_campo ruta ruta-mia opcion)" = "la puerta no ofrecía la ruta ruta-mia" ] || r="$r opcion"
  [ "$(trans_campo requisitos acepto resultado)" = aprobado ] || r="$r aprobado"
  [ "$(trans_destino ruta ruta-mia | jq -r .tramo)" = tras_ruta ] || r="$r tramo-ruta"
  trans_verbo plan acepto >/dev/null && r="$r plan:acepto"
  trans_verbo fase revisado >/dev/null || r="$r revisado"
  [ "$(trans_campo fase eximo como)" = acepto ] || r="$r como"
  trans_tiene fase acepto respuestas aplicar || r="$r aplicar"
  trans_tiene plan conforme respuestas aplicar && r="$r plan-aplicar"
  [ "$(trans_destino fase rechazo | jq .negativo)" = true ] && [ "$(trans_destino fase acepto | jq '.negativo // false')" = false ] || r="$r negativo"
  trans_destino fase nada >/dev/null && r="$r nada"
  echo "${r:-BIEN}"
) > "$T/q" 2>&1
[ "$(cat "$T/q")" = BIEN ] && ok "consultas: comodín ruta-*, alias, respuestas, negativo y lo que no existe" || bad "consultas: $(cat "$T/q")"

# ── 5. lanzar.sh siguiente: «fin» dice su porqué; un resultado sin tabla, que no hay tramo ──────────────────────────
R="$T/repo"; mkdir -p "$R/.sdd/hermes/puertas" "$T/bin"; git -C "$R" init -q
printf '#!/bin/sh\necho "$*" >> "%s/klog"; echo "[]"\n' "$T" > "$T/bin/hermes"; chmod +x "$T/bin/hermes"
echo '{"tipo":"mantenimiento","fase":""}' > "$R/.sdd/hermes/puertas/m1.json"
echo '{"tipo":"fase","fase":"2"}' > "$R/.sdd/hermes/puertas/f1.json"
o1=$(PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" m1 ignoro 2>&1)
o2=$(PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" f1 corrijo 2>&1)
o3=$(PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" f1 inventado 2>&1)
[ "$o1" = "Hallazgos ignorados; no se vuelve a preguntar mientras no cambien" ] && echo "$o2" | grep -q "lo lanza el notario" \
  && [ "$o3" = "Sin tramo siguiente para fase:inventado" ] && ! grep -q create "$T/klog" 2>/dev/null \
  && ok "siguiente: «fin» sin tarjetas y con su porqué; un resultado fuera de la tabla no lanza nada" || bad "siguiente: $o1 | $o2 | $o3"

# ── 6. un solo slug y una sola «unica» para bash y Python ────────────────────────────────────────────────────────────
o=$(ROOT="$ROOT" bash -c '. "$ROOT/lib/comun.sh"; slug "Café Óscar_2"; slug "--Mi  Repo--"')
p=$(python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N, hsdd_proyectos as P; print(N.slug("Café Óscar_2")); print(P.slug("--Mi  Repo--"))' "$ROOT/plugin/hermes-sdd")
[ "$o" = "$(printf 'cafe-oscar-2\nmi-repo')" ] && [ "$o" = "$p" ] && ok "slug del tablero: el mismo en bash y en el plugin (sin tildes)" || bad "slug: bash=$o python=$p"
! grep -nE "tr '\[:upper:\]' '\[:lower:\]' \| sed -E 's/\[\^a-z0-9\]\+/-/g" "$ROOT"/*.sh >/dev/null \
  && ! grep -nE 'unica\(\) *\{ *\[' "$ROOT"/*.sh >/dev/null && ok "ningún script guarda su copia del slug ni de unica()" || bad "copias: $(grep -nE "sed -E 's/\[\^a-z0-9\]|unica\(\) *\{ *\[" "$ROOT"/*.sh)"
U="$T/u"; mkdir -p "$U/plan/fases" "$U/.sdd/hermes"; git -C "$U" init -q; git -C "$U" -c user.email=t@t -c user.name=t commit -q --allow-empty -m x
unica_py() { python3 -c 'import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as X; from pathlib import Path; print(X._unica_plan(Path(sys.argv[2]), 1))' "$ROOT/plugin/hermes-sdd" "$U"; }
unica_sh() { ROOT="$ROOT" bash -c '. "$ROOT/lib/comun.sh"; unica "$1" && echo True || echo False' _ "$U"; }
r=""
touch "$U/plan/fases/FASE-0-x.md"; r="$r $(unica_sh)/$(unica_py)"                       # sin granularidad
echo compacta > "$U/.sdd/hermes/granularidad-plan"; r="$r $(unica_sh)/$(unica_py)"      # compacta, una FASE
echo fina > "$U/.sdd/hermes/granularidad-plan"; r="$r $(unica_sh)/$(unica_py)"          # fina
echo normal > "$U/.sdd/hermes/granularidad-plan"; git -C "$U" tag fase-0-accepted; r="$r $(unica_sh)/$(unica_py)"   # ya aceptada
git -C "$U" tag -d fase-0-accepted >/dev/null; touch "$U/plan/fases/FASE-1-y.md"; r="$r $(unica_sh)/$(unica_py)"    # dos FASEs
[ "$r" = " False/False True/True False/False False/False False/False" ] && ok "unica: la misma respuesta en lanzar/etapa (bash) y en la puerta del plan" || bad "unica:$r"

# ── 7. la etapa de una tarjeta, con o sin la línea «Origen:» delante ────────────────────────────────────────────────
o=$(python3 - "$ROOT/plugin/hermes-sdd" <<'PY'
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_proyectos as P
casos = [("Ejecuta: bash /a/etapa.sh /r/x implementar 2", ("implementar", "2")),
         ("Origen: puerta g1 · Implementar FASE-2\nEjecuta: bash /a/etapa.sh /r/x implementar 2", ("implementar", "2")),
         ("Origen: puerta g1 · Plan\nEjecuta: bash /a/etapa.sh /r/x plan", ("plan", None)),
         ("Ejecuta: bash /a/etapa.sh /r/x plan\nnota de alguien", ("plan", None)),
         ("sin etapa", ("", None))]
print("BIEN" if all(P._etapa_de({"body": b}) == e for b, e in casos) else [(b, P._etapa_de({"body": b})) for b, e in casos])
PY
)
[ "$o" = BIEN ] && ok "etapa y fase de una tarjeta: también con «Origen:» delante, y sin tomar la línea siguiente como fase" || bad "etapa_de: $o"
# … y las tarjetas que crea lanzar.sh con ORIGEN se leen así
: > "$T/klog"
cat > "$T/bin/hermes" <<H
#!/bin/sh
echo "\$*" >> "$T/klog"
case "\$*" in *" list "*|*"list --json"*) echo "[]" ;; *" create "*) echo '{"id":"t_1"}' ;; esac
H
chmod +x "$T/bin/hermes"; echo '{"tipo":"fase","fase":"2"}' > "$R/.sdd/hermes/puertas/f2.json"; mkdir -p "$R/plan/fases" "$R/task"; touch "$R/plan/fases/FASE-2-x.md"
ORIGEN="puerta f2" PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" f2 rechazo >/dev/null 2>&1
o=$(python3 - "$ROOT/plugin/hermes-sdd" "$T/klog" <<'PY'
import re, sys; sys.path.insert(0, sys.argv[1]); import hsdd_proyectos as P
m = re.search(r" create Implementar FASE-2.*? --body (.*?) --json", open(sys.argv[2]).read(), re.S)   # el cuerpo ocupa dos líneas
print(P._etapa_de({"body": m.group(1)}) if m else "sin tarjeta")
PY
)
[ "$o" = "('implementar', '2')" ] && ok "la tarjeta que encadena el notario (con «Origen:») se reconoce: implementar FASE-2" || bad "tarjeta con origen: $o $(cat "$T/klog")"

# ── 8. lo que ven los canales al firmar sale de la firma estructurada, no de adivinar en el texto ──────────────────
o=$(python3 - "$ROOT" <<'PY'
import importlib.util, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd", Path(sys.argv[1]) / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
# una aceptación de alguien llamado «Ignacio Rechazo»: la regex de antes la daba por un rechazo
r1 = m._resultado_claro("FASE-1 aceptada por Ignacio Rechazo (Cliente) — tag fase-1-accepted · fase-1-x fusionada en main",
                        {"tipo": "fase", "resultado": "acepto", "negativo": False, "tag": "fase-1-accepted"})
# corregir el requisito no decía «rechaz» y salía como si todo siguiera: es un «no» y vuelve a la persona
r2 = m._resultado_claro("Ana (Cliente) pide corregir el requisito: el precio va sin IVA",
                        {"tipo": "fase", "resultado": "corrijo", "negativo": True, "tag": ""})
r3 = m._resultado_claro("Entrega 2 aceptada por Ana (Cliente) — tag entrega-2",
                        {"tipo": "entrega", "resultado": "acepto", "negativo": False, "tag": "entrega-2"})
r4 = m._resultado_claro("FASE-1 rechazada por Ana (Cliente): falta el mapa")   # sin firma (puertas de antes): como siempre
print(r1.replace("\n", " | ")); print(r2.replace("\n", " | ")); print(r3.replace("\n", " | ")); print(r4.replace("\n", " | "))
PY
)
echo "$o" | sed -n 1p | grep -q '^✅ FASE-1 aceptada por Ignacio Rechazo (Cliente) · fase-1-x fusionada en main. | 🏷 Queda guardado en el historial como «fase-1-accepted». | Sigue solo' \
  && echo "$o" | sed -n 2p | grep -q '^↩️ Ana (Cliente) pide corregir el requisito.*Se rehace con lo que has pedido' \
  && echo "$o" | sed -n 3p | grep -q '«entrega-2».*🎉 Proyecto entregado' && echo "$o" | sed -n 4p | grep -q '^↩️ FASE-1 rechazada' \
  && ok "canal: negativo y tag de la firma (un nombre con «Rechazo» no es un rechazo); sin firma, como antes" || bad "resultado claro: $o"

# ── 9. las respuestas marcadas viajan como campo de la decisión (y siguen en el texto, para leerlo) ───────────────
o=$(python3 - "$ROOT/plugin/hermes-sdd" "$T/r9" <<'PY'
import json, os, sys
from pathlib import Path
os.environ["HERMES_SDD_HOME"] = sys.argv[2] + "/home"
sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N, hsdd_textos as X
home = Path(sys.argv[2]) / "home"; (home / "puertas").mkdir(parents=True); repo = Path(sys.argv[2]) / "repo"; repo.mkdir()
N.HOME = home
(home / "aprobadores.json").write_text(json.dumps({"ana": {"nombre": "Ana", "rol": "Cliente", "canales": {"telegram": "1"}}}))
def puerta(gid, tipo, marcadas):
    p = {"id": gid, "repo": str(repo), "tipo": tipo, "estado": "abierta", "respuestas": marcadas,
         "preguntas": [{"n": 1, "id": "Q-1", "opciones": ["A", "B"], "recomendada": "A"},
                       {"n": 2, "id": "Q-2", "opciones": ["A", "B"], "recomendada": "B"}],
         "opciones": [{"verbo": "acepto", "etiqueta": "ok"}, {"verbo": "descarto", "etiqueta": "d", "texto": True},
                      {"verbo": "rechazo", "etiqueta": "no", "texto": True}]}
    (home / "puertas" / f"{gid}.json").write_text(json.dumps(p))
res = []
puerta("a", "fase", {"1": "B", "2": "A"})
d = N.decidir("a", "acepto", "Q2: B y lo demás bien", "ana", "telegram", "1", {})["decision"]
res.append(d.get("respuestas") == {"1": "B"} and d["texto"] == "Q2: B y lo demás bien. Q1: B")   # Q2 ya la escribió a mano
puerta("b", "fase", {"1": "B"})
d = N.decidir("b", "descarto", "CH-001 no es un fallo", "ana", "telegram", "1", {})["decision"]
res.append("respuestas" not in d and d["texto"] == "CH-001 no es un fallo")                       # descartar no contesta
puerta("c", "requisitos", {"1": "B"})
d = N.decidir("c", "rechazo", "no", "ana", "telegram", "1", {})["decision"]
res.append("respuestas" not in d)                                                                 # rechazo fuera de fase/entrega
puerta("e", "entrega", {"1": "B"})
d = N.decidir("e", "rechazo", "no", "ana", "telegram", "1", {})["decision"]
res.append(d.get("respuestas") == {"1": "B"})                                                     # rechazo en entrega: sí
# el notario lee el campo: las mismas reglas que con el texto
qs = [{"n": 1, "id": "Q-1", "opciones": ["A", "B"], "recomendada": "A"}]
res.append(X.elegidas("", qs, {"1": "B"}) == ({1: "B"}, []))
res.append(X.elegidas("Q1: A", qs, {"1": "B"})[1] == ["Q1 tiene dos respuestas distintas (B y A)"])
res.append(X.elegidas("", qs, {"x": "B"})[1] != [] and X.elegidas("", qs, {"1": "b"})[1] != [])     # nada se ignora en silencio
res.append(X.elegidas("Q1: B", qs, {"1": "B"}) == ({1: "B"}, []))                                  # decisiones nuevas: los dos dicen lo mismo
print(res)
PY
)
[ "$o" = "[True, True, True, True, True, True, True, True]" ] \
  && ok "respuestas como campo: solo las marcadas, no las de descartar ni rechazar requisitos, y el notario las valida igual" || bad "campo respuestas: $o"
o=$(cd "$T" && echo '{"preguntas":[{"n":1,"id":"Q-1","opciones":["A","B"],"recomendada":"A"}]}' > p.json \
  && python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" respuestas distintas --puerta p.json --verbo conforme --respuestas '{"1":"B"}'; \
  python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" respuestas validar --puerta p.json --verbo conforme --respuestas '["B"]' 2>&1; echo "rc=$?")
[ "$o" = "$(printf 'Q-1 = B\nel campo «respuestas» de la decisión no es {pregunta: letra}\nrc=1')" ] \
  && ok "CLI del notario: --respuestas da las elegidas; un campo mal formado rechaza la decisión" || bad "cli respuestas: $o"
# material-montana: «Conforme» con una respuesta distinta sin efecto (o que ya lanza su cambio) sigue siendo «Conforme»
o=$(cd "$T" && echo '{"preguntas":[{"n":1,"id":"Q-1","opciones":["A","B"],"recomendada":"A","efectos":{"B":{"efecto":"ninguno"}}},
 {"n":2,"id":"Q-2","opciones":["A","B"],"recomendada":"A","efectos":{"B":{"efecto":"req-change"}}},
 {"n":3,"id":"Q-3","opciones":["A","B"],"recomendada":"A","efectos":{"B":{"efecto":"accion"}}}]}' > p.json \
  && python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" respuestas distintas --puerta p.json --verbo conforme --respuestas '{"1":"B","2":"B"}'; \
  python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" respuestas distintas --puerta p.json --verbo conforme --respuestas '{"1":"B","3":"B"}')
[ "$o" = "$(printf '\nQ-3 = B')" ] && ok "respuestas distintas sin efecto o con req-change: «Conforme» no se vuelve «cambios»; las de trabajo, sí" || bad "distintas por efecto: $o"
exit $fail
