#!/usr/bin/env bash
# Encargado, fase 4 (revisar la documentación): avisos mecánicos dentro de la puerta, sin LLM y sin bloquear;
# un aviso grave impide que Jev apruebe la puerta solo.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
RV="$ROOT/plugin/hermes-sdd/hsdd_revision.py"
R="$T/demo"; mkdir -p "$R/requirements" "$R/plan/fases" "$R/task"
cat > "$R/requirements/REQUIREMENTS.md" <<'M'
## Functional
### REQ-F-001: Préstamo
- **Priority:** Must
- **Needs:** N-001
- **Verification:** test
  - GIVEN a book WHEN lent THEN 1 free copy
  - GIVEN the loan WHEN Marta opens "Mis préstamos" THEN the user sees "Rayuela"
### REQ-F-002: Mis préstamos
- **Priority:** Must
- **Needs:** N-002
- **Verification:** test
  - GIVEN a loan WHEN she opens her area THEN she sees it
### REQ-F-003: Algo sin criterios
- **Priority:** Should
- **Needs:** N-003
- **Verification:** test
### REQ-NF-001: Rápida
- **Priority:** Must
- **Verification:** demo
  - GIVEN the catalog WHEN it loads THEN it shows in under 2 seconds
## Constraints
### REQ-C-001: Stack del proyecto
- **Verification:** test — package.json lists vite
M
printf '# FASE-0 — Préstamos\n> **Requisitos:** REQ-F-001, REQ-F-003\n\n## Objetivo\n' > "$R/plan/fases/FASE-0-PRESTAMOS.md"
printf '# FASE-1 — Consultas\n> **Requisitos:** REQ-F-002\n\n## Objetivo\n' > "$R/plan/fases/FASE-1-CONSULTAS.md"
printf '# FASE-2 — Más\n> **Requisitos:** REQ-NF-001\n\n## Objetivo\n' > "$R/plan/fases/FASE-2-MAS.md"

o=$(python3 "$RV" revisar "$R" requisitos)
cods=$(jq -r '[.avisos[].codigo] | sort | join(" ")' <<< "$o")
[ "$cods" = "sin-criterios sin-necesidad verificable-con-test" ] && ok "requisitos: sin criterios, Must sin necesidad y demo que un test podría leer" || bad "requisitos: $cods"
[ "$(jq -r '.graves' <<< "$o")" = 1 ] && jq -r '.linea' <<< "$o" | head -1 | grep -q "🧭 Encargado: 3 avisos (1 grave" && ok "…«🧭 Encargado: 3 avisos (1 grave…)» y el grave primero" || bad "línea: $(jq -r .linea <<< "$o")"
jq -e '[.avisos[].texto] | any(test("REQ-C-001"))' <<< "$o" >/dev/null && bad "una restricción sin GIVEN no es un requisito sin criterios" || ok "las restricciones (comprobación en Verification) no cuentan como sin criterios"

o=$(python3 "$RV" revisar "$R" plan)
jq -e '[.avisos[] | select(.codigo == "criterio-de-otra-fase" and .grave)] | length == 1' <<< "$o" >/dev/null && ok "plan: un criterio que cita una pantalla de una FASE posterior es grave" || bad "plan: $o"
jq -e '[.avisos[].codigo] | index("fases-de-mas")' <<< "$o" >/dev/null && ok "plan: 3 FASEs para 3 requisitos funcionales, demasiadas" || bad "fases: $o"

o=$(python3 "$RV" revisar "$R" ruta); [ "$(jq '.avisos | length' <<< "$o")" = 0 ] && ok "ruta sin motivos: sin avisos" || bad "ruta: $o"
printf '%s\n' '- stack: web vite' > "$R/AGENTS.md"; mkdir -p "$R/.sdd/hermes"; echo '{"motivo":"no tiene pantallas"}' > "$R/.sdd/hermes/ruta.json"
o=$(python3 "$RV" revisar "$R" ruta); jq -e '.avisos[0].codigo == "ruta-contradice-stack"' <<< "$o" >/dev/null && ok "ruta: «no tiene pantallas» en un stack web" || bad "ruta web: $o"

# Jev no aprueba solo una puerta con un aviso grave del encargado
o=$(python3 - "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("hsdd_nucleo", sys.argv[1]); N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
N.poner_modo("auto", "demo")
base = {"tablero": "demo", "tipo": "plan", "opciones": [{"verbo": "conforme", "etiqueta": "✅"}]}
print(N.puede_jev({**base, "encargado": {"avisos": [{}], "graves": 1}})[0], N.puede_jev({**base, "encargado": {"avisos": [{}], "graves": 0}})[0])
PY
)
[ "$o" = "False True" ] && ok "Jev: con un aviso grave del encargado no puede aprobar solo; con avisos leves sí" || bad "jev: $o"
exit $fail
