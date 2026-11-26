#!/usr/bin/env bash
# Defectos sembrados (M2a, línea base del análisis 11): un parche por defecto real conocido sobre los proyectos
# congelados del banco, para medir qué controles los cazan (M2b) sin modelo. Aquí solo se comprueba el banco de
# parches: que cada uno está en indice.json con sus campos, aplica limpio sobre una copia del proyecto
# (git apply --check), deja el defecto donde dice («señal» en el fichero tras aplicarlo) y se deshace limpio.
# Solo lee el banco: trabaja sobre copias temporales.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")/.." && pwd)"
BANCO="$AQUI/tests/fixtures/banco"
S="$BANCO/parches/sembrados"
fallo=0
ok()  { echo "ok   $1"; }
mal() { echo "FAIL $1"; fallo=1; }
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

if [ ! -f "$S/indice.json" ]; then mal "no hay $S/indice.json (banco de defectos sembrados)"; exit 1; fi

# El índice: campos obligatorios, tipos válidos, ids únicos, un parche por entrada y ninguna entrada sin parche
python3 - "$S" <<'PY' && ok "indice.json: cada defecto tiene id, proyecto, tipo, criterio, descripción, manifestación, parche y señal" || mal "indice.json mal formado"
import json, sys
from pathlib import Path
S = Path(sys.argv[1]); I = json.loads((S / "indice.json").read_text())
campos = {"id", "proyecto", "tipo", "criterio", "descripcion", "manifestacion", "parche", "senal", "origen", "tests_del_proyecto"}
ids = [d["id"] for d in I["defectos"]]
assert len(ids) == len(set(ids)), "ids repetidos"
for d in I["defectos"]:
    falta = campos - d.keys()
    assert not falta, (d.get("id"), falta)
    assert d["tipo"] in ("producto", "evidencia"), d["id"]
    assert d["proyecto"] in ("material-montana10", "material-montana11", "material-montana12"), d["id"]
    assert (S / d["parche"]).is_file(), d["parche"]
    assert d["senal"]["fichero"] and d["senal"]["texto"], d["id"]
huerfanos = {p.name for p in S.glob("*.patch")} - {d["parche"] for d in I["defectos"]}
assert not huerfanos, huerfanos
tipos = {t: sum(d["tipo"] == t for d in I["defectos"]) for t in ("producto", "evidencia")}
assert tipos["producto"] >= 7 and tipos["evidencia"] >= 7, tipos
PY

# Cada parche: aplica limpio sobre una copia, la señal (que el banco no tiene) queda en su fichero y se deshace limpio
python3 - "$S" "$BANCO" "$tmp" <<'PY2' || fallo=1
import json, shutil, subprocess, sys, filecmp
from pathlib import Path
S, BANCO, TMP = map(Path, sys.argv[1:])
def iguales(a, b):
    c = filecmp.dircmp(a, b)
    return not (c.left_only or c.right_only or c.diff_files or c.funny_files) and all(iguales(a / d, b / d) for d in c.common_dirs)
mal = 0
for d in json.loads((S / "indice.json").read_text())["defectos"]:
    i, proy, f, senal = d["id"], d["proyecto"], d["senal"]["fichero"], d["senal"]["texto"]
    c = TMP / proy
    if not c.exists(): shutil.copytree(BANCO / proy, c, symlinks=True)
    def git(*a): return subprocess.run(["git", "apply", *a, str(S / d["parche"])], cwd=c, capture_output=True, text=True)
    if senal in (BANCO / proy / f).read_text():
        print(f"FAIL {i}: la señal ya está en el banco sin parche ({f})"); mal = 1; continue
    r = git("--check")
    if r.returncode:
        print(f"FAIL {i}: {d['parche']} no aplica limpio sobre {proy}: {r.stderr.strip()[:200]}"); mal = 1; continue
    git()
    if senal in (c / f).read_text(): print(f"ok   {i}: aplica limpio sobre {proy} y el defecto queda en {f}")
    else: print(f"FAIL {i}: tras aplicarlo, {f} no contiene la señal"); mal = 1
    if git("-R").returncode or not iguales(BANCO / proy, c):
        print(f"FAIL {i}: no se deshace limpio: la copia no vuelve a ser el banco"); mal = 1
sys.exit(mal)
PY2
exit $fallo
