#!/usr/bin/env bash
# Proyecto nuevo (hsdd_proyectos.py / nuevo.sh): carpeta, git, AGENTS.md del stack, petición literal y lanzar.sh iniciar.
# Con un `hermes` falso en el PATH que guarda los tableros y tarjetas creados (no toca tu kanban).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
echo "{\"root\": \"$ROOT\"}" > "$HERMES_SDD_HOME/instalacion.json"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/bin"; echo '[{"slug":"default"},{"slug":"recetas","default_workdir":"/x/recetas"}]' > "$T/tableros.json"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
echo "\$*" >> "$T/llamadas"
case "\$*" in
  "kanban boards list --json") cat "$T/tableros.json" ;;
  "kanban boards create "*) t=\$(mktemp); jq --arg s "\$4" --arg d "\$8" '. + [{slug:\$s, default_workdir:\$d}]' "$T/tableros.json" > "\$t" && mv "\$t" "$T/tableros.json" ;;
  "kanban --board "*" create "*) echo '{"id":"t_req"}' ;;
  *) echo "hermes falso: \$*" >&2; exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"
git config --global user.name >/dev/null || export GIT_AUTHOR_NAME=t GIT_AUTHOR_EMAIL=t@t GIT_COMMITTER_NAME=t GIT_COMMITTER_EMAIL=t@t
NUEVO="bash $ROOT/nuevo.sh"
QUE="Una web para turistas que visitan Bogotá: los barrios, qué ver en cada uno y cómo moverse entre ellos.
Que se pueda leer bien en el móvil."

# ── carpeta por defecto y proyecto nuevo ─────────────────────────────────────────────────────────────────────────
$NUEVO config --carpeta "$T/proyectos" >/dev/null
o=$($NUEVO "Bogotá Turismo" "$QUE" --stack web-astro 2>&1); rc=$?
R="$T/proyectos/bogota-turismo"
[ $rc -eq 0 ] && [ -d "$R/.git" ] && ok "crea el proyecto en <carpeta por defecto>/<nombre sin tildes> ($R)" || bad "nuevo: $o"
grep -q '^- stack: Astro + TypeScript + Vitest$' "$R/AGENTS.md" && grep -q '^- server: npx astro dev' "$R/AGENTS.md" && grep -q '^## SDD Stack Profile' "$R/AGENTS.md" \
  && ok "AGENTS.md con el Stack Profile del stack elegido" || bad "AGENTS.md: $(cat "$R/AGENTS.md")"
grep -q '^> Una web para turistas que visitan Bogotá' "$R/intent/INT-001.md" && grep -q '^> Que se pueda leer bien en el móvil.$' "$R/intent/INT-001.md" \
  && ok "la petición literal, tal cual, en intent/INT-001.md" || bad "intent: $(cat "$R/intent/INT-001.md")"
[ -z "$(git -C "$R" status --porcelain)" ] && [ "$(git -C "$R" rev-list --count HEAD)" = 2 ] && git -C "$R" log --format=%s | grep -q 'chore(sdd): set up hermes-sdd' \
  && ok "dos commits: la petición y la preparación de lanzar.sh; árbol limpio" || bad "git: $(git -C "$R" log --oneline; git -C "$R" status --short)"
grep -q "kanban boards create bogota-turismo --name bogota-turismo --default-workdir $R" "$T/llamadas" \
  && ok "crea el tablero del kanban con la carpeta del proyecto" || bad "tablero: $(cat "$T/llamadas")"
grep -q 'kanban --board bogota-turismo create Requisitos --assignee sdd-estacion' "$T/llamadas" \
  && ok "y la primera tarjeta (Requisitos) para la estación" || bad "tarjeta: $(cat "$T/llamadas")"
echo "$o" | grep -q "Proyecto bogota-turismo en $R (stack web-astro, Jev humano)" && ok "nuevo.sh dice dónde y con qué stack" || bad "salida: $o"

# ── otra carpeta, stack por defecto y Jev ────────────────────────────────────────────────────────────────────────
o=$($NUEVO tienda "$QUE" --carpeta "$T/otra" --jev consejo 2>&1)
[ -d "$T/otra/tienda/.git" ] && grep -q '^- stack: JavaScript (ES modules) + Vite + Vitest$' "$T/otra/tienda/AGENTS.md" \
  && ok "--carpeta manda sobre la de por defecto; sin --stack, el de por defecto" || bad "carpeta/stack: $o"
[ "$(jq -r '.proyectos.tienda' "$HERMES_SDD_HOME/jev.json")" = consejo ] && ok "--jev deja el modo de Jev del proyecto" || bad "jev: $(cat "$HERMES_SDD_HOME/jev.json")"

# ── lo que no procede, sin dejar nada a medias ───────────────────────────────────────────────────────────────────
mkdir -p "$T/proyectos/existe" && echo x > "$T/proyectos/existe/a.txt"
o=$($NUEVO existe "$QUE" 2>&1) && bad "crea encima de una carpeta con cosas" || {
  echo "$o" | grep -q "lanzar.sh adoptar" && [ ! -d "$T/proyectos/existe/.git" ] && ok "carpeta con cosas: no la toca y propone adoptarla" || bad "existe: $o"; }
o=$($NUEVO recetas "$QUE" --carpeta "$T/x" 2>&1) && bad "repite un tablero" || {
  echo "$o" | grep -q "Ya hay un tablero recetas" && [ ! -e "$T/x/recetas" ] && ok "tablero que ya existe: no crea nada" || bad "tablero: $o"; }
o=$($NUEVO algo "corto" 2>&1) && bad "acepta una petición vacía" || { echo "$o" | grep -q "Cuenta un poco más" && ok "pide una frase de lo que quieres" || bad "corto: $o"; }
o=$($NUEVO algo "$QUE" --stack cobol 2>&1) && bad "acepta un stack que no existe" || { echo "$o" | grep -q "No hay ningún stack cobol" && ok "stack desconocido: rechazado" || bad "stack: $o"; }
o=$($NUEVO default "$QUE" 2>&1) && bad "acepta un nombre reservado" || ok "nombre reservado (default): rechazado"
o=$($NUEVO config --carpeta relativa/x 2>&1) && bad "acepta una carpeta relativa" || { echo "$o" | grep -q "ruta completa" && ok "carpeta por defecto: debe ser una ruta completa" || bad "relativa: $o"; }

# ── stacks configurables ─────────────────────────────────────────────────────────────────────────────────────────
o=$(python3 - "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("hsdd_proyectos", sys.argv[1]); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
st = P.config()["stacks"]
mio = {"id": "go-api", "nombre": "API en Go", "stack": "Go 1.23 + testing", "test": "go test ./...", "test_file": "go test {file}"}
c = P.guardar_config(stacks=st + [mio], stack_defecto="go-api")
print("añadido" if c["stack_defecto"] == "go-api" and c["stacks"][-1]["test"] == "go test ./..." else "mal")
for malo, que in (({**mio, "id": "x", "test_file": "go test"}, "{file}"), ({**mio, "id": "Mal Id"}, "Id de stack"), (mio, "mismo id")):
    try:
        P.guardar_config(stacks=st + [mio, malo] if malo is not mio else st + [mio, mio]); print("coló " + que)
    except P.Rechazo as e:
        print("rechazo" if que in str(e) else f"otro rechazo: {e}")
PY
)
[ "$o" = "añadido
rechazo
rechazo
rechazo" ] && ok "stacks: se añaden y se validan (test_file con {file}, id, sin repetir)" || bad "stacks: $o"
o=$($NUEVO api-pagos "$QUE" 2>&1); grep -q '^- test: go test ./...$' "$T/proyectos/api-pagos/AGENTS.md" && ok "un stack añadido por ti se usa en el AGENTS.md" || bad "stack propio: $o"

# ── ventana para deshacer, en segundos ───────────────────────────────────────────────────────────────────────────
unset HERMES_SDD_DESHACER_S
o=$($NUEVO config --deshacer 90 2>&1); echo "$o" | grep -q "Ventana para deshacer: 90 s (1 min 30 s)" && ok "nuevo.sh config --deshacer guarda los segundos" || bad "deshacer: $o"
o=$($NUEVO config --deshacer 5 2>&1) && bad "acepta 5 s" || { echo "$o" | grep -q "va de 10 s" && ok "menos de 10 s: rechazado" || bad "5 s: $o"; }
o=$($NUEVO config --deshacer tres 2>&1) && bad "acepta texto" || ok "algo que no es un número: rechazado"
o=$(python3 - "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" "$T" <<'PY2'
import importlib.util, json, sys, time
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd_nucleo", sys.argv[1]); N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
(N.HOME / "puertas").mkdir(parents=True, exist_ok=True)
(N.HOME / "aprobadores.json").write_text(json.dumps({"yo": {"nombre": "Yo", "rol": "Cliente", "canales": {"local": "u"}}}))
repo = Path(sys.argv[2]) / "r"; repo.mkdir(exist_ok=True)
(N.HOME / "puertas" / "d1.json").write_text(json.dumps({"id": "d1", "tipo": "plan", "repo": str(repo), "estado": "abierta",
    "opciones": [{"verbo": "conforme", "etiqueta": "Conforme"}]}))
antes = time.time(); p = N.decidir("d1", "conforme", "", "yo", "local", "u", {})
print(round(p["firmar_en"] - antes), N.duracion(N.deshacer_s()))
PY2
)
[ "$o" = "90 1 min 30 s" ] && ok "una decisión nueva se firma pasados los segundos configurados (sin reiniciar)" || bad "firmar_en: $o"

# ── modelos por etapa ────────────────────────────────────────────────────────────────────────────────────────────
PR="python3 $ROOT/plugin/hermes-sdd/hsdd_proyectos.py"
o=$($PR modelo requisitos)/$($PR modelo implementar)/$($PR modelo ruta hermes)
[ "$o" = "opus/sonnet/anthropic/claude-sonnet-5.5" ] && ok "por defecto, Equilibrado: Opus planifica, Sonnet programa; la ruta con el id de Hermes" || bad "defecto: $o"
o=$($PR modelos --perfil rapido 2>&1 | head -1); [ "$($PR modelo requisitos)" = sonnet ] && echo "$o" | grep -q "Rápido" && ok "perfil Rápido: Sonnet también en requisitos" || bad "rápido: $o"
o=$(python3 - "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("hsdd_proyectos", sys.argv[1]); P = importlib.util.module_from_spec(spec); spec.loader.exec_module(P)
c = P.guardar_config(modelos={"implementar": "anthropic/claude-opus-5.5", "aceptar": "haiku"})
print(c["modelos"]["implementar"], P.modelo_para("implementar", "claude"), P.modelo_para("aceptar", "hermes")[:22], sorted(c["modelos_cambiados"]))
for malo in ({"inventada": "opus"}, {"plan": "opus; rm -rf /"}):
    try:
        P.guardar_config(modelos=malo); print("coló")
    except P.Rechazo:
        print("rechazo")
c = P.guardar_config(perfil_modelos="equilibrado"); print(c["modelos_cambiados"], c["modelos"]["implementar"])
PY
)
[ "$o" = "anthropic/claude-opus-5.5 claude-opus-5-5 anthropic/claude-haiku ['aceptar', 'implementar']
rechazo
rechazo
{} sonnet" ] && ok "cambios por etapa (traducidos a cada ejecutor), validados; elegir un perfil los quita" || bad "por etapa: $o"
exit $fail
