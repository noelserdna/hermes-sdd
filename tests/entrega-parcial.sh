#!/usr/bin/env bash
# Entrega parcial (material-montana: se cortó tras la FASE-2 y no había forma de entregar lo ya aceptado):
# «lanzar.sh entregar» deja en .sdd/hermes/entrega-parcial las FASEs aceptadas y abre su cierre; la puerta de calidad
# de esa entrega es la de cada FASE entregada (gate_entrega), no la global; la puerta lo dice; con todas aceptadas, es
# una entrega normal.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/repo"; mkdir -p "$R/plan/fases" "$R/.sdd/hermes"; cd "$R" || exit 1
git init -q -b main; git config user.email t@t; git config user.name t
touch plan/fases/FASE-0-a.md plan/fases/FASE-1-b.md plan/fases/FASE-2-c.md
git add -A; git commit -qm init; git tag fase-0-accepted; git tag fase-1-accepted

# kanban falso: apunta los títulos
mkdir -p "$T/bin"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
case "\$*" in
  "kanban boards list --json") echo '[{"slug":"repo"}]' ;;
  *" create "*) t=\$(printf '%s\n' "\$@" | awk 'f{print;exit} /^create$/{f=1}'); echo "\$t" >> "$T/cartas"; echo '{"id":"t1"}' ;;
  *" list "*) echo '[]' ;;
  *) exit 0 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"

o=$(bash "$ROOT/lanzar.sh" entregar "$R" 2>&1)
[ "$(tr '\n' ' ' < .sdd/hermes/entrega-parcial)" = "0 1 " ] && grep -qx 'Cierre: entrega de las FASEs 0 1' "$T/cartas" && echo "$o" | grep -q 'Entrega de 2 de 3 FASEs' \
  && ok "entregar: las FASEs aceptadas (2 de 3) y su cierre" || bad "entregar: $o | $(cat .sdd/hermes/entrega-parcial 2>&1) | $(cat "$T/cartas" 2>&1)"

# gate_entrega: FASE a FASE (lo peor manda; 3 si alguna tiene exenciones), con un node falso solo para «gate»
REAL_NODE=$(command -v node)
cat > "$T/bin/node" <<N
#!/usr/bin/env bash
case " \$* " in
  *" gate --fase "*) f=\$(printf '%s\n' "\$@" | awk 'f{print;exit} /^--fase$/{f=1}'); echo "fase \$f"; exit \$(cat "$T/rc-\$f" 2>/dev/null || echo 0) ;;
  *" gate "*) echo global; exit \$(cat "$T/rc-global" 2>/dev/null || echo 0) ;;
esac
exec "$REAL_NODE" "\$@"
N
chmod +x "$T/bin/node"
g() { (ROOT="$ROOT"; . "$ROOT/lib/comun.sh"; gate_entrega "$@"); }
echo 3 > "$T/rc-0"; echo 0 > "$T/rc-1"; echo 1 > "$T/rc-global"
g >/dev/null; r1=$?
echo 1 > "$T/rc-1"; g >/dev/null; r2=$?
o=$(g --md)
echo 0 > "$T/rc-1"; echo 0 > "$T/rc-0"; g >/dev/null; r3=$?
[ "$r1/$r2/$r3" = "3/1/0" ] && echo "$o" | grep -q 'fase 0' && echo "$o" | grep -q 'fase 1' && ! echo "$o" | grep -q global \
  && ok "gate_entrega parcial: cada FASE entregada, no la global (3 con exenciones, 1 si una falla)" || bad "gate_entrega: $r1/$r2/$r3 $o"
mv .sdd/hermes/entrega-parcial "$T/ep"; g >/dev/null; r=$?
[ "$r" = 1 ] && ok "sin entrega parcial: la puerta global, como siempre" || bad "global: $r"
mv "$T/ep" .sdd/hermes/entrega-parcial; rm -f "$T/bin/node"

# la puerta lo dice
python3 - "$ROOT/plugin/hermes-sdd" "$R" <<'PY' && ok "la puerta: «Entrega parcial», qué fases entran y que lo demás sigue pendiente" || bad "texto de la entrega parcial"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as X
from pathlib import Path
r = X.puerta_entrega(Path(sys.argv[2]), "montana", "", 0, ["fase-0-accepted", "fase-1-accepted"], parcial=["0", "1"])
assert r["titulo"] == "Entrega parcial: montana", r["titulo"]
assert "las fases 0, 1 (ya aceptadas una a una) de 3" in r["texto"] and "sigue pendiente" in r["texto"], r["texto"][:300]
PY

# con todas las FASEs aceptadas, es la entrega de siempre
git tag fase-2-accepted; rm -f "$T/cartas"
bash "$ROOT/lanzar.sh" entregar "$R" >/dev/null 2>&1
[ ! -f .sdd/hermes/entrega-parcial ] && grep -qx 'Cierre: entrega de las FASEs 0 1 2' "$T/cartas" && ok "todas aceptadas: entrega completa (sin marca de parcial)" || bad "completa"
git tag -d fase-0-accepted fase-1-accepted fase-2-accepted >/dev/null
bash "$ROOT/lanzar.sh" entregar "$R" >/dev/null 2>&1 && bad "sin FASEs aceptadas debía fallar" || ok "sin ninguna FASE aceptada: no hay nada que entregar"
exit $fail
