#!/usr/bin/env bash
# evals/medir/sembrados.sh (M2b): la matriz defecto × control sin modelo sobre el banco de defectos sembrados.
# Con tres defectos de montana12 y sin dependencias del proyecto (los tests salen como no medidos): el literal cambiado
# tras la firma lo ven --quotes y --stale; quitar la guarda de titular no lo ve ningún lint; la copia limpia no hace
# fallar ningún lint; los mutantes salen como no medidos (null), nunca como 0. Solo lee el banco.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
M="$ROOT/evals/medir/sembrados.sh"
[ -f "$M" ] || { bad "no existe evals/medir/sembrados.sh"; exit 1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
bash "$M" --json --solo E-06-literal-cambiado-tras-firma,P-07-guarda-de-titular,E-01-expect-true --salida "$T/s" > "$T/m.json" 2>"$T/err" \
  || { bad "sembrados.sh sale con error: $(tail -3 "$T/err")"; exit 1; }
[ -s "$T/s/matriz.json" ] && [ -s "$T/s/matriz.md" ] && ok "--salida escribe matriz.json y matriz.md" || bad "--salida no escribe matriz.json y matriz.md"
python3 - "$T/m.json" <<'PY' && ok "E-06 lo ven quotes y stale; P-07 ningún lint; limpia sin salidas ≠ 0; tests y mutantes no medidos (null)" || bad "matriz inesperada"
import json, sys
j = json.load(open(sys.argv[1]))
D = {d["id"]: d["controles"] for d in j["defectos"]}
assert set(D) == {"E-06-literal-cambiado-tras-firma", "P-07-guarda-de-titular", "E-01-expect-true"}, D.keys()
e6 = D["E-06-literal-cambiado-tras-firma"]
assert e6["quotes"]["detecta"] is True and e6["stale"]["detecta"] is True, e6
p7 = D["P-07-guarda-de-titular"]
assert not any(p7[k]["detecta"] for k in ("quotes", "captures", "floor", "stale", "arch", "accept", "registros")), p7
for c in D.values():
    assert c["tests"]["detecta"] is None and c["mutantes"]["detecta"] is None, c
L = j["limpia"]["material-montana12"]
assert all(v["salida"] == 0 for v in L["lints"].values()), L
assert L["tests"] is None, L
assert j["commit_arnes"], j
PY
grep -q '| recall |' "$T/s/matriz.md" && ok "la tabla lleva la fila de recall" || bad "matriz.md sin fila de recall"
exit $fail
