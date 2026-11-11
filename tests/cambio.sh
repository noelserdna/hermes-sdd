#!/usr/bin/env bash
# Cambio sin replanificar: aprobado un cambio de requisitos, si no añade ni quita requisitos y cada requisito cambiado
# está en una FASE sin aceptar, se rehacen esas FASEs en vez de relanzar ruta, especificaciones, plan y tareas.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
REPO="$T/r"; mkdir -p "$REPO/requirements" "$REPO/plan/fases"; cd "$REPO"; git init -q
g() { git -c user.email=t@t -c user.name=t "$@"; }
cat > requirements/REQUIREMENTS.md <<'R'
## Functional
### REQ-F-001: Uno
- **Statement:** a
### REQ-F-002: Dos
- **Statement:** b
  - GIVEN x WHEN y THEN "Mis préstamos"
### REQ-F-003: Tres
- **Statement:** c
R
printf '# FASE-0\n> **Requisitos:** REQ-F-001\n\n## Objetivo\n' > plan/fases/FASE-0-BASE.md
printf '# FASE-1\n> **Requisitos:** REQ-F-002\n\n## Objetivo\n' > plan/fases/FASE-1-UNO.md
printf '# FASE-2\n> **Requisitos:** REQ-F-003\n\n## Objetivo\n' > plan/fases/FASE-2-DOS.md
g add -A; g commit -qm base; g tag requirements-v1.0; g tag fase-0-accepted
eval "$(sed -n '/^cambio_corto() {/,/^}/p' "$ROOT/lanzar.sh")"
cambiar() { python3 - "$1" "$2" <<'PY'
import sys; from pathlib import Path
p = Path("requirements/REQUIREMENTS.md"); p.write_text(p.read_text().replace(sys.argv[1], sys.argv[2], 1))
PY
g commit -qam cambio; git tag -d requirements-v1.1 >/dev/null 2>&1; g tag requirements-v1.1; }

cambiar '  - GIVEN x WHEN y THEN "Mis préstamos"' '  - GIVEN x WHEN y THEN closed'
o=$(cambio_corto); [ "$o" = 1 ] && ok "un criterio de una FASE sin aceptar: se rehace solo esa FASE" || bad "corto: [$o]"
cambiar '- **Statement:** c' '- **Statement:** c2'
o=$(cambio_corto); [ "$o" = "1 2" ] && ok "dos FASEs sin aceptar: se rehacen las dos" || bad "dos: [$o]"
cambiar '- **Statement:** a' '- **Statement:** a2'
o=$(cambio_corto); [ -z "$o" ] && ok "un requisito de una FASE ya aceptada: cascada completa" || bad "aceptada: [$o]"
git reset -q --hard requirements-v1.0; printf '### REQ-F-004: Nuevo\n- **Statement:** d\n' >> requirements/REQUIREMENTS.md
g commit -qam nuevo; git tag -d requirements-v1.1 >/dev/null; g tag requirements-v1.1
o=$(cambio_corto); [ -z "$o" ] && ok "un requisito nuevo: cascada completa (hay que planificarlo)" || bad "nuevo: [$o]"

# ── plan: criterios que citan una pantalla de una FASE posterior ───────────────────────────────────────────────────
D="$T/d"; mkdir -p "$D/requirements" "$D/plan/fases"
cat > "$D/requirements/REQUIREMENTS.md" <<'R'
## Functional
### REQ-F-001: Préstamo
- **Statement:** a
  - GIVEN a book WHEN lent THEN 1 free copy
  - GIVEN the loan WHEN Marta opens "Mis préstamos" THEN the user sees "Rayuela"
### REQ-F-002: Mis préstamos y mis reservas
- **Statement:** b
  - GIVEN a loan WHEN she opens her area THEN the user sees "Rayuela — devolver antes del 25/11"
R
printf '# FASE-0 — Préstamos\n> **Requisitos:** REQ-F-001\n\n## Objetivo\n' > "$D/plan/fases/FASE-0-PRESTAMOS.md"
printf '# FASE-1 — Consultas\n> **Requisitos:** REQ-F-002\n\n## Objetivo\n' > "$D/plan/fases/FASE-1-CONSULTAS.md"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_plan.py" dependencias "$D" | jq -r '.[] | "\(.requisito) \(.criterio) \(.cita) \(.fase_vista)"')
[ "$o" = "REQ-F-001 AC2 Mis préstamos 1" ] && ok "plan: un criterio que cita una pantalla de una FASE posterior se detecta" || bad "dependencias: [$o]"
printf '# FASE-0 — Préstamos\n> **Requisitos:** REQ-F-001, REQ-F-002\n\n## Objetivo\n' > "$D/plan/fases/FASE-0-PRESTAMOS.md"; rm "$D/plan/fases/FASE-1-CONSULTAS.md"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_plan.py" dependencias "$D")
[ "$o" = "[]" ] && ok "plan: si la pantalla llega en la misma FASE no hay aviso" || bad "misma FASE: $o"
# ── estado del proyecto (hsdd_proyectos.py estado): la foto que leen /estado, el panel y el encargado ───────────────
cd "$REPO"; git reset -q --hard requirements-v1.0; mkdir -p .sdd/hermes
echo '{"etapa":"plan","resultado":"done"}' > .sdd/hermes/etapas.jsonl
o=$(HERMES_SDD_HOME="$T/home" python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" estado "$REPO" --json 2>/dev/null |
  jq -c '[.fases[] | "\(.n)\(if .aceptada then "+" else "-" end)"] + [.requisitos, (.ultimas_etapas[0].etapa), (.entregado | tostring)]')
[ "$o" = '["0+","1-","2-","requirements-v1.1","plan","false"]' ] && ok "estado: fases aceptadas, versión de requisitos y últimas etapas" || bad "estado: $o"
exit $fail
