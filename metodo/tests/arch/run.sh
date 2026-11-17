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
[ $fail = 0 ] && echo "metodo/tests/arch: all passed"
exit $fail
