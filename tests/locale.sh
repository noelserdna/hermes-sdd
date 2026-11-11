#!/usr/bin/env bash
# El gateway lanza los scripts sin locale UTF-8: ahí bash lee «$BOARD»» como una variable con un byte de «»» en el
# nombre (unbound variable con set -u; /encargado, 11-12/11/2026). Ninguna variable pegada a un carácter no ASCII.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
malas=$(LC_ALL=C grep -nE '\$[A-Za-z_][A-Za-z0-9_]*[^ -~]' ./*.sh executors/*.sh metodo/hooks/*.sh 2>/dev/null || true)
[ -z "$malas" ] && echo "ok   ninguna \$VARIABLE pegada a un carácter no ASCII (usa \${VARIABLE})" || { echo "FAIL variables pegadas a no ASCII:"; echo "$malas"; exit 1; }
o=$(LC_ALL=C LANG=C bash -uc 'B=sala; echo "«🧭 ${B}»"' 2>&1) && echo "ok   con llaves funciona sin locale UTF-8" || { echo "FAIL llaves: $o"; exit 1; }
