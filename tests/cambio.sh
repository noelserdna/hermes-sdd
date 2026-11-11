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
exit $fail
