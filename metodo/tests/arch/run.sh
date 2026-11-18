#!/usr/bin/env bash
# sdd lint --arch: una carpeta por caso de uso y ninguna feature se mete en otra (lib/arch-lint.mjs).
set -uo pipefail
SDD="$(cd "$(dirname "$0")/../.." && pwd)/scripts/sdd.mjs"
fail=0; pass() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
r="$tmp/app"; mkdir -p "$r/src"; (cd "$r" && git init -q)
node "$SDD" lint --arch --repo "$r" >/dev/null 2>&1 && pass "sin features/: nada que decir (exit 0)" || bad "sin features"
mkdir -p "$r/src/features/reservar" "$r/src/features/entregar" "$r/src/shared"
printf "import { fecha } from '../../shared/fechas.js';\nexport const reservar = () => fecha();\n" > "$r/src/features/reservar/reservar.js"
printf "export const fecha = () => 1;\n" > "$r/src/shared/fechas.js"; printf "import './features/reservar/reservar.js';\n" > "$r/src/main.js"
node "$SDD" lint --arch --repo "$r" >/dev/null 2>&1 && pass "feature que usa shared/ y main.js: limpio" || bad "limpio: $(node "$SDD" lint --arch --repo "$r")"
printf "import { reservar } from '../reservar/reservar.js';\nexport const entregar = () => import('../reservar/reservar.js');\n" > "$r/src/features/entregar/entregar.js"
printf "export const x = 1;\n" > "$r/src/utilidades.js"
out=$(node "$SDD" lint --arch --repo "$r" --json); rc=$?
c=$(printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log(j.findings.map(f=>f.code+":"+f.file+":"+f.line).join(","))})')
[ $rc = 1 ] && [ "$c" = "A-01:src/features/entregar/entregar.js:1,A-01:src/features/entregar/entregar.js:2,A-02:src/utilidades.js:1" ] \
  && pass "A-01 una feature importa otra (import y import()), A-02 un fichero suelto junto a features/" || bad "hallazgos: $rc $c"
# A-03: un test que fija la lista cerrada de pantallas o del menú (material-montana3 y 4: una parada por FASE)
t="$tmp/t"; mkdir -p "$t/tests/unit"; (cd "$t" && git init -q -b main && git -c user.email=t@t -c user.name=t commit -q --allow-empty -m init)
cat > "$t/tests/unit/menu.test.js" <<'JS'
it('menu', () => {
  expect([...document.querySelectorAll('nav a')].map((a) => a.textContent)).toEqual(['Inicio', 'Material']);
  expect(page.locator('nav a')).toHaveCount(3);
  expect(enlaces).toContainEqual(['Material', '#/material']);
  expect(reservas).toEqual([{ id: 1 }]);
  expect(Object.keys(rutas)).not.toEqual([]);
});
JS
codes() { node "$SDD" lint --arch --repo "$t" --json "$@" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).findings.map(f=>f.code+":"+f.line).join(",")))'; }
[ "$(codes)" = "A-03:2,A-03:3" ] && pass "A-03: toEqual de los enlaces del menú y toHaveCount de nav a; no toContainEqual, ni datos, ni .not" || bad "A-03: $(codes)"
(cd "$t" && git add -A && git -c user.email=t@t -c user.name=t commit -qm "test: menu" && git tag fase-0-accepted)
[ "$(codes --since fase-0-accepted)" = "" ] && pass "A-03 con --since: un test que ya existía (aceptado) no se marca" || bad "since: $(codes --since fase-0-accepted)"
[ $fail = 0 ] && echo "metodo/tests/arch: all passed"
exit $fail
