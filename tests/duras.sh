#!/usr/bin/env bash
# Reglas duras del código entregado (lib/comun.sh duras_implementar): lo que antes eran frases del prompt del
# implementador y ahora para la etapa tras una pasada de arreglo (Lauren Tan, AI Engineer Code Summit 11/2026).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
SDD="$ROOT/metodo/scripts/sdd.mjs"; FASE=0
. "$ROOT/lib/comun.sh"
R="$T/app"; mkdir -p "$R"; cd "$R"; git init -q -b main
cp -R "$ROOT/templates/stacks/web-vite/." .
printf '# App\n\n## SDD Stack Profile\n- code_paths: src/\n- test_paths: tests/\n' > AGENTS.md   # sin lint: no hace falta eslint aquí
mkdir -p src/features/reservar src/shared
printf "export const reservar = () => 1;\n" > src/features/reservar/reservar.js
git add -A && git -c user.email=t@t -c user.name=t commit -qm init
[ -z "$(duras_implementar)" ] && ok "la plantilla tal cual y una feature limpia: ninguna regla rota" || bad "limpio: $(duras_implementar)"
mkdir -p src/features/entregar; printf "import { reservar } from '../reservar/reservar.js';\n" > src/features/entregar/entregar.js
echo "// cambio" >> tests/e2e/fixtures/evidence.js
d=$(duras_implementar)
echo "$d" | grep -q 'sdd lint --arch: src/features/entregar/entregar.js:1 A-01' && echo "$d" | grep -q 'evidence.js cambió' \
  && ok "una feature que importa otra y el helper de evidencias tocado: las dos reglas, con su sitio" || bad "rotas: $d"
printf '# App\n\n## SDD Stack Profile\n- lint: false\n' > AGENTS.md
jq '.scripts.lint = "false"' package.json > p.tmp && mv p.tmp package.json
echo "$(duras_implementar)" | grep -q '^lint (false)' && ok "el lint del Stack Profile en rojo: regla rota" || bad "lint: $(duras_implementar)"
# lib/plantilla-versiones.txt tiene cada versión anterior de la plantilla de evidencias (si no, un proyecto creado con
# ella no se pondría al día y fallaría la regla dura: material-montana12 G-6)
if git -C "$ROOT" rev-parse >/dev/null 2>&1; then
  F=templates/stacks/web-vite/tests/e2e/fixtures/evidence.js; falta=""
  for h in $(git -C "$ROOT" log --format=%h -- "$F"); do
    s=$(git -C "$ROOT" show "$h:$F" | shasum -a 256 | cut -d' ' -f1)
    cmp -s <(git -C "$ROOT" show "$h:$F") "$ROOT/$F" || grep -qx "$s" "$ROOT/lib/plantilla-versiones.txt" || falta="$falta $h"
  done
  [ -z "$falta" ] && ok "cada versión anterior de la plantilla de evidencias está en lib/plantilla-versiones.txt" || bad "faltan en lib/plantilla-versiones.txt las versiones de:$falta"
fi
exit $fail
