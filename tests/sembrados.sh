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

# Cada parche: aplica limpio sobre una copia, el defecto queda en su fichero y se deshace limpio
python3 - "$S" > "$tmp/lista" <<'PY'
import json, sys
from pathlib import Path
for d in json.loads((Path(sys.argv[1]) / "indice.json").read_text())["defectos"]:
    print("\t".join([d["id"], d["proyecto"], d["parche"], d["senal"]["fichero"], d["senal"]["texto"]]))
PY
while IFS=$'\t' read -r id proy parche fich senal; do
  c="$tmp/$proy"; [ -d "$c" ] || cp -R "$BANCO/$proy" "$c"
  if ! (cd "$c" && git apply --check "$S/$parche" 2>"$tmp/err"); then mal "$id: $parche no aplica limpio sobre $proy: $(head -2 "$tmp/err")"; continue; fi
  (cd "$c" && git apply "$S/$parche")
  if grep -qF -- "$senal" "$c/$fich"; then ok "$id: aplica limpio sobre $proy y el defecto queda en $fich"; else mal "$id: tras aplicarlo, $fich no contiene «$senal»"; fi
  (cd "$c" && git apply -R "$S/$parche") || mal "$id: no se deshace limpio"
  diff -rq "$BANCO/$proy" "$c" >/dev/null || mal "$id: la copia no vuelve a ser el banco tras deshacerlo"
done < "$tmp/lista"
exit $fallo
