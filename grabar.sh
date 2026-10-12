#!/usr/bin/env bash
# GRABA una ejecución real del arnés para poder reproducirla sin LLM (executors/replay.sh).
#
#   grabar.sh <repo-real> <carpeta-de-salida>
#
# Guarda:
#   repo.bundle      todo el historial del repo real
#   base.txt         commit del que parte la reproducción (antes de cualquier etapa del ejecutor)
#   ejecuciones.json [{nombre, commits:[sha…]}] en orden: los commits que produjo cada ejecución del ejecutor
#                    (deducidos de la hora de inicio y fin de cada run en .sdd/hermes/runs/); los del notario no
#   extras/          lo que no está en git y hace falta: evidencias/, respuestas de la ruta y preguntas abiertas
set -euo pipefail
REPO=$(cd "$1" && pwd); OUT=$2
mkdir -p "$OUT/extras"; OUT=$(cd "$OUT" && pwd)
cd "$REPO"
git bundle create "$OUT/repo.bundle" --all 2>/dev/null
git log --reverse --format=%H --grep='^chore(sdd): set up hermes-sdd' | head -1 > "$OUT/base.txt"
[ -s "$OUT/base.txt" ] || git rev-list --max-parents=0 HEAD > "$OUT/base.txt"

# Commits de cada ejecución: los que aparecen entre el inicio del run (nombre YYYYmmdd-HHMMSS) y el fin (mtime)
python3 - "$REPO" "$OUT" <<'PY'
import json, os, re, subprocess, sys, datetime
repo, out = sys.argv[1:3]
runs = sorted(f for f in os.listdir(f"{repo}/.sdd/hermes/runs") if f.endswith(".json"))
def antes(ts):  # commits alcanzables desde HEAD con fecha de commit <= ts
    r = subprocess.run(["git", "-C", repo, "rev-list", f"--before={int(ts)}", "HEAD"], capture_output=True, text=True)
    return set(r.stdout.split())
def es_del_notario(sha):
    msg = subprocess.run(["git", "-C", repo, "log", "-1", "--format=%B", sha], capture_output=True, text=True).stdout
    return "Gate-Id:" in msg
ejecuciones = []
for f in runs:
    m = re.match(r"(\d{8}-\d{6})-(.+)\.json$", f)
    if not m:
        continue
    inicio = datetime.datetime.strptime(m.group(1), "%Y%m%d-%H%M%S").timestamp()
    fin = os.path.getmtime(f"{repo}/.sdd/hermes/runs/{f}") + 1
    nuevos = antes(fin) - antes(inicio - 1)
    orden = subprocess.run(["git", "-C", repo, "rev-list", "--reverse", "HEAD"], capture_output=True, text=True).stdout.split()
    commits = [c for c in orden if c in nuevos and not es_del_notario(c)]
    ejecuciones.append({"nombre": m.group(2), "commits": commits})
json.dump(ejecuciones, open(f"{out}/ejecuciones.json", "w"), indent=1)
print(f"{len(ejecuciones)} ejecuciones, {sum(len(e['commits']) for e in ejecuciones)} commits del ejecutor")
PY

[ -d evidencias ] && cp -R evidencias "$OUT/extras/"
[ -f .sdd/route-answers.json ] && cp .sdd/route-answers.json "$OUT/extras/"
mkdir -p "$OUT/extras/preguntas"
for q in .sdd/questions-*.md; do   # las preguntas vuelven a estar abiertas: las contestará quien reproduzca
  [ -f "$q" ] || continue
  sed -E 's/\[ANSWERED\]/[OPEN]/; s/^Answer: .*/Answer:/' "$q" > "$OUT/extras/preguntas/$(basename "$q")"
done
echo "Grabación en $OUT"
