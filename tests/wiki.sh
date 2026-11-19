#!/usr/bin/env bash
# hsdd_wiki.py: la wiki del proyecto generada de sus artefactos (una página por identificador con su definición, lo
# relacionado por tipo, quién lo cita, dónde está en el código y los tests y su veredicto) y su uso en las etapas.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
R="$T/p"; mkdir -p "$R"/{requirements,spec/use-cases,spec/domain,spec/tests,task,tests/e2e,src,.sdd}
cat > "$R/requirements/REQUIREMENTS.md" <<'MD'
# Requisitos

### REQ-F-001: Reservar material
- **Needs:** N-001
- GIVEN 2 cascos WHEN Ana reserva 1 THEN ve «Reservado»

## Supuestos

- La reserva dura como mucho 14 días.
MD
printf '# UC-001 Reservar\n\n| Refs | REQ-F-001; INV-RES-001 |\n' > "$R/spec/use-cases/UC-001-reservar.md"
printf '# Invariantes\n\n| ID | Regla |\n|---|---|\n| INV-RES-001 | No se reserva en el pasado (REQ-F-001) |\n' > "$R/spec/domain/INVARIANTS.md"
printf 'Feature: reservar\n\nScenario: AC-001-01 — reservar [REQ-F-001 AC1]\n  When Ana reserva\n  Then ve «Reservado»\n' > "$R/spec/tests/BDD-UC-001.md"
printf '# FASE-0\n\n- [ ] TASK-F0-001 Reservar (UC-001) | `src/reservar.js`\n  - **Commit:** feat: reservar\n' > "$R/task/TASK-FASE-0.md"
printf "test('REQ-F-001 AC1 reservar', () => {})\n" > "$R/tests/e2e/fase-0.spec.js"
echo '{"requirements":[{"id":"REQ-F-001","verdict":"VERIFIED","priority":"Must","criteria":[{"state":"pass"}]}]}' > "$R/.sdd/acceptance.json"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_wiki.py" construir "$R")
W="$R/.sdd/wiki"
[ -f "$W/index.md" ] && grep -q '\[\[REQ-F-001\]\] — Reservar material' "$W/index.md" && grep -q 'La reserva dura como mucho 14 días' "$W/index.md" \
  && ok "índice: cada identificador con su título, y los supuestos" || bad "índice: $o $(cat "$W/index.md" 2>/dev/null | head -20)"
p=$(cat "$W/REQ-F-001.md" 2>/dev/null)
echo "$p" | grep -q 'Definido en `requirements/REQUIREMENTS.md:3`' && echo "$p" | grep -q '\*\*caso de uso\*\*: \[\[UC-001\]\]' \
  && echo "$p" | grep -q '\*\*necesidad\*\*: \[\[N-001\]\]' && echo "$p" | grep -q '`tests/e2e/fase-0.spec.js`' \
  && echo "$p" | grep -q 'VERIFIED (prioridad Must; criterios: 1 de 1 pasan)' \
  && ok "página de un requisito: definición, relacionados por tipo, test que lo cita y veredicto" || bad "REQ-F-001: $p"
grep -q 'No se reserva en el pasado' "$W/INV-RES-001.md" && grep -q 'When Ana reserva' "$W/AC-001-01.md" && grep -q 'feat: reservar' "$W/TASK-F0-001.md" \
  && ok "definiciones en una fila de tabla, en un escenario y en una línea de tarea" || bad "definiciones: $(ls "$W")"
grep -q 'hsdd_wiki.py" construir' "$ROOT/etapa.sh" && grep -q '.sdd/wiki/index.md' "$ROOT/etapa.sh" && grep -q 'exclude=.sdd/wiki' "$ROOT/templates/caja/etapa.sh" \
  && ok "las etapas la reconstruyen antes de cada sesión y la conocen; la caja no la devuelve" || bad "integración de la wiki"
[ $fail = 0 ] && echo "tests/wiki.sh: all passed"
exit $fail
