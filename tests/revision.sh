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

# Tras una entrega, el plan se mide por lo que añade el cambio (club: «111 tareas para 3 requisitos» contaba las 108 de
# las entregas anteriores), con mínimos absolutos
C="$T/cambio"; mkdir -p "$C/requirements" "$C/plan/fases" "$C/task"; cd "$C"
git init -q; git config user.email t@t; git config user.name t; git config commit.gpgsign false
for i in 1 2 3 4 5 6; do printf '### REQ-F-00%s: R%s\n- **Needs:** N-001\n  - GIVEN a WHEN b THEN c\n' $i $i; done > requirements/REQUIREMENTS.md
for f in 0 1 2 3 4; do printf '# FASE-%s\n' $f > plan/fases/FASE-$f-X.md
  for k in $(seq 1 20); do printf -- '- [x] TASK-F%s-%03d hecho\n' $f $k; done > task/TASK-FASE-$f.md; done
git add -A; git commit -qm v1; git tag entrega-1
printf '### REQ-F-007: Nuevo\n- **Needs:** N-002\n  - GIVEN a WHEN b THEN c\n' >> requirements/REQUIREMENTS.md
printf '# FASE-5\n' > plan/fases/FASE-5-NUEVO.md; printf -- '- [ ] TASK-F5-001 a\n- [ ] TASK-F5-002 b\n- [ ] TASK-F5-003 c\n' > task/TASK-FASE-5.md
git add -A; git commit -qm cambio
o=$(python3 "$RV" revisar "$C" plan)
jq -e '[.avisos[].codigo] | (index("tareas-de-mas") | not) and (index("fases-de-mas") | not)' <<< "$o" >/dev/null \
  && ok "plan tras una entrega: 1 FASE y 3 tareas nuevas para 1 requisito nuevo no son «de más» (no cuenta las 100 anteriores)" || bad "delta: $o"
for k in $(seq 4 12); do printf -- '- [ ] TASK-F5-%03d x\n' $k; done >> task/TASK-FASE-5.md; git commit -qam mas
o=$(python3 "$RV" revisar "$C" plan)
jq -e '.avisos[] | select(.codigo == "tareas-de-mas") | .texto | test("^12 tareas en este cambio \\(desde entrega-1\\) para 1 requisito funcional nuevo:")' <<< "$o" >/dev/null \
  && ok "…y 12 tareas nuevas para 1 requisito nuevo sí, dicho como «en este cambio»" || bad "delta 12: $o"
# un aviso leve que la persona ya vio en una puerta firmada no se repite; uno grave sí
mkdir -p .sdd/hermes/puertas; jq -n --argjson a "$(jq -c '.avisos' <<< "$o")" '{encargado: {avisos: $a}}' > .sdd/hermes/puertas/g1.json
echo '{"puerta":"g1"}' > .sdd/hermes/puertas.jsonl
o=$(python3 "$RV" revisar "$C" plan)
jq -e '(.avisos | length) == 0 and .ya_vistos == 1' <<< "$o" >/dev/null && ok "un aviso leve ya visto en una puerta firmada se calla (y se cuenta)" || bad "silenciar: $o"
# si la comprobación de fidelidad falló, la puerta lo dice como grave (antes valía el JSON de la vez anterior)
echo '{"graves":1,"error":"hsdd_fidelidad falló"}' > .sdd/hermes/fidelidad-3.json
o=$(python3 "$RV" revisar "$C" fase --fase 3)
jq -e '.graves >= 1 and any(.avisos[]; .codigo == "fidelidad-sin-comprobar")' <<< "$o" >/dev/null && ok "fidelidad que no se pudo comprobar: aviso grave" || bad "fidelidad error: $o"
cd "$ROOT"

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
# Jev escala a una persona cuando le falta información o la opción es de una persona (datos de la puerta, no su texto)
o=$(python3 - "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" <<'PY'
import importlib.util, sys
spec = importlib.util.spec_from_file_location("hsdd_nucleo", sys.argv[1]); N = importlib.util.module_from_spec(spec); spec.loader.exec_module(N)
N.poner_modo("auto", "demo")
base = {"tablero": "demo", "tipo": "plan", "opciones": [{"verbo": "conforme", "etiqueta": "✅"}]}
q = lambda ef: [{"n": 1, "id": "Q-1", "opciones": ["A", "B"], "recomendada": "A", "efectos": {"A": {"efecto": ef}, "B": {"efecto": "ninguno"}}}]
print(N.puede_jev({**base, "preguntas_error": True})[0], N.puede_jev({**base, "preguntas": q("editar-test"), "texto": "sin marcas"})[0],
      N.puede_jev({**base, "preguntas": q("accion")})[0])
PY
)
[ "$o" = "False False True" ] && ok "Jev: preguntas ilegibles o una opción editar-test (por dato) escalan a una persona; una acción no" || bad "jev escala: $o"
# puerta.sh: si la revisión del encargado falla, la puerta sale con un aviso grave (Jev no decide a ciegas)
grep -q 'FALLO_REV=.*"graves":1' "$ROOT/puerta.sh" && grep -q 'PREG_ERROR=true' "$ROOT/puerta.sh" && ok "puerta.sh: revisión o preguntas caídas cierran a Jev" || bad "puerta.sh sin cierre ante fallo"
# «hecho» = desplegable: en la entrega, no desplegable es grave (Jev escala); sin comprobar, leve
o=$(python3 - "$ROOT/plugin/hermes-sdd" <<'PY'
import sys, json, tempfile; from pathlib import Path; sys.path.insert(0, sys.argv[1]); import hsdd_revision as V
d = Path(tempfile.mkdtemp()); (d / ".sdd/hermes").mkdir(parents=True)
r = []
r.append([a["codigo"] for a in V._desplegable(d)])
(d / ".sdd/hermes/desplegable.json").write_text(json.dumps({"ok": False, "fallos": ["solo escucha en localhost"]}))
r.append([(a["codigo"], a["grave"]) for a in V._desplegable(d)])
(d / ".sdd/hermes/desplegable.json").write_text(json.dumps({"ok": True}))
r.append(V._desplegable(d))
print(json.dumps(r))
PY
)
[ "$o" = '[["desplegable-sin-comprobar"], [["no-desplegable", true]], []]' ] && ok "entrega: no desplegable es aviso grave; sin comprobar, leve; desplegable, nada" || bad "desplegable: $o"
exit $fail
