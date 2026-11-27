#!/usr/bin/env bash
# El instalador con un HOME temporal y un `hermes` falso: no borra perfiles, solo escribe lo que cambia, no instala con
# trabajo en marcha, un directorio por commit con el enlace «actual» y como mucho 3 versiones.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
export HOME="$T/home"; mkdir -p "$HOME/.hermes"; unset HERMES_SDD_HOME
echo "OPENROUTER_API_KEY=sk-prueba" > "$HOME/.hermes/.env"
mkdir -p "$T/bin"; : > "$T/log"
echo '{"global": {"model": {"default": "anthropic/claude-sonnet"}, "kanban": {"auto_decompose": false}}, "perfiles": {}}' > "$T/conf.json"
echo '{"boards": [{"slug": "demo"}], "tareas": {"demo": []}}' > "$T/kanban.json"
cat > "$T/bin/hermes" <<'PY'
#!/usr/bin/env python3
import json, os, sys
T = os.environ["FALSO"]; a = sys.argv[1:]
open(f"{T}/log", "a").write(" ".join(a) + "\n")
conf = json.load(open(f"{T}/conf.json")); kb = json.load(open(f"{T}/kanban.json"))
perfil = None
if a[:1] == ["-p"]:
    perfil, a = a[1], a[2:]
def nodo():
    return conf["global"] if perfil is None else conf["perfiles"].setdefault(perfil, {})
def guardar():
    json.dump(conf, open(f"{T}/conf.json", "w"))
if a[:2] == ["profile", "list"]:
    print("\n".join(conf["perfiles"]))
elif a[:2] == ["profile", "create"]:
    conf["perfiles"][a[2]] = {}; os.makedirs(f"{os.environ['HOME']}/.hermes/profiles/{a[2]}", exist_ok=True); guardar()
elif a[:2] == ["config", "get"]:
    v = nodo()
    for k in a[2].split("."):
        v = v.get(k) if isinstance(v, dict) else None
    if "--json" in a:
        print(json.dumps(v))
    elif v is not None:
        print(v if isinstance(v, str) else json.dumps(v))
elif a[:2] == ["config", "set"]:
    try:
        v = json.loads(a[3])
    except ValueError:
        v = a[3]
    n = nodo(); ks = a[2].split(".")
    for k in ks[:-1]:
        n = n.setdefault(k, {})
    n[ks[-1]] = v; guardar()
elif a[:3] == ["kanban", "boards", "list"]:
    print(json.dumps(kb["boards"]))
elif a[:1] == ["kanban"] and "list" in a:   # como el real: «list» no trae las madres
    print(json.dumps([{k: v for k, v in t.items() if k != "parents"} for t in kb["tareas"].get(a[2], [])]))
elif a[:1] == ["kanban"] and "show" in a:   # «show» sí: {"task": …, "parents": [ids]}
    t = next((t for t in kb["tareas"].get(a[2], []) if t["id"] == a[a.index("show") + 1]), None)
    if t is None:
        sys.exit(1)
    print(json.dumps({"task": {k: v for k, v in t.items() if k != "parents"}, "parents": t.get("parents", []), "children": []}))
PY
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH" FALSO="$T"
H="$HOME/.hermes/hermes-sdd"

# 1. primera instalación: perfiles creados, un directorio <versión>-<commit> y el enlace «actual» a él
o=$(bash "$ROOT/instalar.sh" 2>&1); rc=$?
D=$(readlink "$H/actual")
[ $rc -eq 0 ] && [ -d "$D" ] && [ -f "$D/etapa.sh" ] && basename "$D" | grep -qE '^[0-9]+\.[0-9]+\.[0-9]+-' && [ ! -d "$D/.git" ] \
  && ok "instala en un directorio por commit ($(basename "$D")) y «actual» apunta a él" || bad "primera: $rc $o"
grep -q "profile create sdd-estacion" "$T/log" && grep -q "profile create sdd-ejecutor" "$T/log" && [ -f "$HOME/.hermes/profiles/sdd-estacion/SOUL.md" ] \
  && ok "crea los perfiles que faltan" || bad "perfiles: $(cat "$T/log")"
[ "$(jq -r '.global.kanban.max_in_progress' "$T/conf.json")" = 1 ] && ok "fija kanban.max_in_progress = 1 (una etapa a la vez)" || bad "max_in_progress"
[ "$(jq -r '.perfiles["sdd-estacion"].timeouts.tools.sequential_call' "$T/conf.json")" = 5400 ] && ok "ajustes del perfil escritos" || bad "ajustes: $(cat "$T/conf.json")"

# 2. repetir: no borra ni recrea perfiles, ningún «config set» (cada uno reescanea el perfil) y no toca «actual»
: > "$T/log"; o=$(bash "$ROOT/instalar.sh" 2>&1); rc=$?
[ $rc -eq 0 ] && ! grep -q "profile delete\|profile create" "$T/log" && ! grep -q "config set" "$T/log" && ! grep -q "tools disable" "$T/log" \
  && echo "$o" | grep -q "Ajustes cambiados: 0" && [ "$(readlink "$H/actual")" = "$D" ] \
  && ok "reinstalar lo mismo: ni borra perfiles ni escribe ajustes iguales; «actual» sigue igual" || bad "repetir: $o $(grep -E 'set|profile' "$T/log")"
# un ajuste distinto: se escribe solo ese
jq '.perfiles["sdd-estacion"].curator.enabled = true' "$T/conf.json" > "$T/c" && mv "$T/c" "$T/conf.json"
: > "$T/log"; bash "$ROOT/instalar.sh" >/dev/null 2>&1
[ "$(grep -c "config set" "$T/log")" = 1 ] && grep -q "\-p sdd-estacion config set curator.enabled false" "$T/log" \
  && ok "un ajuste cambiado a mano: se corrige solo ese" || bad "un ajuste: $(grep 'config set' "$T/log")"
# kanban.max_in_progress es global (frena tableros que no son del arnés): uno puesto a mano no se pisa
jq '.global.kanban.max_in_progress = 3' "$T/conf.json" > "$T/c" && mv "$T/c" "$T/conf.json"
: > "$T/log"; o=$(bash "$ROOT/instalar.sh" 2>&1)
[ "$(jq -r '.global.kanban.max_in_progress' "$T/conf.json")" = 3 ] && ! grep -q "config set kanban.max_in_progress" "$T/log" \
  && echo "$o" | grep -q "kanban.max_in_progress = 3 (puesto a mano)" \
  && ok "kanban.max_in_progress puesto a mano: se respeta y se avisa" || bad "max_in_progress a mano: $(grep 'config set' "$T/log") $o"
jq '.global.kanban.max_in_progress = 1' "$T/conf.json" > "$T/c" && mv "$T/c" "$T/conf.json"

# 3. con trabajo en marcha no instala: una tarjeta de la estación en marcha, o una puerta decidida
jq '.tareas.demo = [{"id":"t_1","title":"Implementar FASE-0","status":"running","assignee":"sdd-estacion"}]' "$T/kanban.json" > "$T/k" && mv "$T/k" "$T/kanban.json"
: > "$T/log"; o=$(bash "$ROOT/instalar.sh" 2>&1) && bad "instala con una etapa en marcha" || {
  echo "$o" | grep -q "No instalo" && echo "$o" | grep -q "demo/t_1" && ! grep -q "config set\|profile" "$T/log" \
    && ok "con una tarjeta en marcha no instala ni toca nada (y dice cuál)" || bad "en marcha: $o"; }
o=$(HERMES_SDD_ESPERA_MAX_S=1 HERMES_SDD_ESPERA_INTERVALO_S=1 bash "$ROOT/instalar.sh" --esperar 2>&1) && bad "--esperar instala" \
  || { echo "$o" | grep -q "tras esperar" && ok "--esperar espera y, si sigue ocupado, no instala" || bad "esperar: $o"; }
# 3b. una tarjeta en «todo» cuya madre está «blocked» no es trabajo en marcha: no puede despacharse. Tablero real de
#     material-montana12 (hermes-win, 25-nov): la de cierre espera a «Mantenimiento», bloqueada desde el 23-nov, y
#     paró dos despliegues. Las «todo» con la madre viva, y las «running»/«ready», siguen parando.
M12='[{"id":"t_d26917c7","title":"PUERTA Etapa parada: implementar FASE-0","status":"blocked","assignee":null},
 {"id":"t_eb131875","title":"Mantenimiento","status":"blocked","assignee":"sdd-estacion"},
 {"id":"t_639c0c16","title":"Cierre: puerta global y entrega (mantenimiento)","status":"todo","assignee":"sdd-estacion","parents":["t_eb131875"]},
 {"id":"t_0a931b8c","title":"PUERTA Preguntas del mantenimiento","status":"blocked","assignee":null},
 {"id":"t_ed1a12ca","title":"PUERTA Mantenimiento","status":"blocked","assignee":null}]'
jq -n --argjson t "$M12" '{boards: [{slug: "material-montana12"}], tareas: {"material-montana12": $t}}' > "$T/kanban.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && echo "$o" | grep -q "ignoro 1 tarjeta en espera de una bloqueada" \
  && ok "montana12: la «todo» hija de una «blocked» no para la instalación, y lo dice" || bad "todo con madre bloqueada: $o"
# en cadena: la nieta de una bloqueada tampoco puede despacharse
jq --argjson t '{"id":"t_nieta","title":"Después del cierre","status":"todo","assignee":"sdd-estacion","parents":["t_639c0c16"]}' \
  '.tareas["material-montana12"] += [$t]' "$T/kanban.json" > "$T/k" && mv "$T/k" "$T/kanban.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && echo "$o" | grep -q "ignoro 2 tarjetas en espera de una bloqueada" \
  && ok "la nieta de una bloqueada tampoco para" || bad "nieta: $o"
# con la madre viva (en marcha) la «todo» sí para
jq '(.tareas["material-montana12"][] | select(.id == "t_eb131875") | .status) = "running"' "$T/kanban.json" > "$T/k" && mv "$T/k" "$T/kanban.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && bad "instala con la madre en marcha: $o" || {
  echo "$o" | grep -q "t_639c0c16" && echo "$o" | grep -q "t_eb131875" && ok "con la madre en marcha, la madre y la hija paran" || bad "madre viva: $o"; }
jq '(.tareas["material-montana12"][] | select(.id == "t_eb131875") | .status) = "ready"' "$T/kanban.json" > "$T/k" && mv "$T/k" "$T/kanban.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && bad "instala con la madre lista: $o" || {
  echo "$o" | grep -q "t_eb131875.*(ready)" && ok "una «ready» sigue parando" || bad "ready: $o"; }
# sin madres y en «todo» (esperando hueco, no a una bloqueada): para, como siempre
jq '.tareas = {"material-montana12": [{"id":"t_suelta","title":"Implementar FASE-1","status":"todo","assignee":"sdd-estacion"}]}' "$T/kanban.json" > "$T/k" && mv "$T/k" "$T/kanban.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && bad "instala con una «todo» sin madre: $o" || { echo "$o" | grep -q "t_suelta" && ok "una «todo» sin madre sigue parando" || bad "todo suelta: $o"; }
echo '{"boards": [], "tareas": {}}' > "$T/kanban.json"
mkdir -p "$H/puertas"; echo '{"id":"g1","tipo":"plan","titulo":"Plan","estado":"decidida","repo":"/no/existe"}' > "$H/puertas/g1.json"
o=$(bash "$ROOT/instalar.sh" 2>&1) && bad "instala con una puerta decidida: $o" || { echo "$o" | grep -q "puerta g1" && ok "con una puerta decidida sin firmar no instala" || bad "decidida: $o"; }
o=$(bash "$ROOT/instalar.sh" --forzar 2>&1) && ok "--forzar instala igual" || bad "forzar: $o"
rm -f "$H/puertas/g1.json"

# 4. versiones viejas: se quedan 3 (y nunca se borra la que está en uso)
for i in 1 2 3 4; do mkdir -p "$H/0.0.$i"; touch -t "20200101010$i" "$H/0.0.$i"; done
bash "$ROOT/instalar.sh" >/dev/null 2>&1
n=$(find "$H" -mindepth 1 -maxdepth 1 -type d -name '[0-9]*.[0-9]*' | wc -l | tr -d ' ')
[ "$n" = 3 ] && [ -d "$(readlink "$H/actual")" ] && [ ! -d "$H/0.0.1" ] && ok "purga: quedan 3 versiones y la actual" || bad "purga: $n $(ls "$H")"
exit $fail
