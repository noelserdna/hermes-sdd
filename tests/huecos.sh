#!/usr/bin/env bash
# Tareas [PLAN GAP] cuyas preguntas se contestaron en la puerta del plan (incidente hola-astro, 10/11/2026): antes de
# implementar la FASE se encadena la etapa «huecos», e implementar se niega a empezar con huecos pendientes.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/bin"; echo 0 > "$T/n"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
case "\$*" in
  "kanban boards list --json") echo '[{"slug":"demo"}]' ;;
  "kanban --board "*" create "*)
    n=\$(( \$(cat "$T/n") + 1 )); echo \$n > "$T/n"
    t=\$(printf '%s\n' "\$@" | sed -n '5p'); p=\$(printf '%s\n' "\$@" | awk 'f{print;exit} /^--parent$/{f=1}')
    b=\$(printf '%s\n' "\$@" | awk 'f{print;exit} /^--body$/{f=1}')
    echo "t\$n|\$t|\${p:--}|\${b##*etapa.sh }" >> "$T/cartas"; echo "{\"id\":\"t\$n\"}" ;;
  *) echo "hermes falso: \$*" >&2; exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"

R="$T/demo"; mkdir -p "$R/task" "$R/.sdd/hermes/puertas"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
cat > task/TASK-FASE-0.md <<'M'
- [x] TASK-F0-001 Scaffold | `package.json`
  - **Commit:** `chore(setup): scaffold`
  - **Acceptance:**
    - Verify: `npm test` → 0
- [ ] TASK-F0-007 [PLAN GAP] Journey FASE-0: abrir la página y capturar cada criterio
  - **Commit:** `test(e2e): journey FASE-0`
  - **Acceptance:**
    - Verify: capturas por criterio en evidencias/FASE-0/
- [ ] TASK-F0-008 Verificar los criterios de FASE-0 | `tests/`
  - **Commit:** `test(inicio): criterios de FASE-0`
  - **Acceptance:**
    - Verify: `npm test` → 0
M
git add -A && git commit -qm init
echo '{"tipo":"plan","fase":""}' > .sdd/hermes/puertas/gp.json
cartas() { cat "$T/cartas" 2>/dev/null; }

# 1. plan conforme con un [PLAN GAP]: huecos → implementar → aceptar
bash "$ROOT/lanzar.sh" siguiente "$R" gp conforme >/dev/null
o=$(cartas | cut -d'|' -f2,3,4 | tr '\n' ';')
[ "$o" = "Completar huecos del plan FASE-0|-|$R huecos 0;Implementar FASE-0|t1|$R implementar 0;Aceptar FASE-0|t2|$R aceptar 0;" ] \
  && ok "plan conforme con [PLAN GAP]: primero completa los huecos, luego implementa y acepta" || bad "con hueco: $o"

# 2. sin huecos: directamente implementar → aceptar
rm -f "$T/cartas"; sed -i.bak 's/^- \[ \] TASK-F0-007 \[PLAN GAP\]/- [ ] TASK-F0-007/' task/TASK-FASE-0.md && rm -f task/TASK-FASE-0.md.bak
bash "$ROOT/lanzar.sh" siguiente "$R" gp conforme >/dev/null
o=$(cartas | cut -d'|' -f2,3 | tr '\n' ';')
[ "$o" = "Implementar FASE-0|-;Aceptar FASE-0|t4;" ] && ok "sin huecos: implementar → aceptar, como siempre" || bad "sin hueco: $o"

# 3. un [PLAN GAP] ya hecho ([x]) no cuenta
rm -f "$T/cartas"; sed -i.bak 's/^- \[ \] TASK-F0-007/- [x] TASK-F0-007 [PLAN GAP]/' task/TASK-FASE-0.md && rm -f task/TASK-FASE-0.md.bak
bash "$ROOT/lanzar.sh" siguiente "$R" gp conforme >/dev/null
cartas | head -1 | grep -q '|Implementar FASE-0|' && ok "un [PLAN GAP] ya hecho no pide completar huecos" || bad "hecho: $(cartas)"

# 4. rehacer: FASE otra vez con tarjetas nuevas (y huecos si quedan)
rm -f "$T/cartas"; sed -i.bak 's/^- \[x\] TASK-F0-007 \[PLAN GAP\]/- [ ] TASK-F0-007 [PLAN GAP]/' task/TASK-FASE-0.md && rm -f task/TASK-FASE-0.md.bak
o=$(bash "$ROOT/lanzar.sh" rehacer "$R" 0)
[ "$(cartas | cut -d'|' -f2 | tr '\n' ';')" = "Completar huecos del plan FASE-0;Implementar FASE-0;Aceptar FASE-0;" ] && echo "$o" | grep -q "primero completa los huecos" \
  && ok "lanzar.sh rehacer: huecos → implementar → aceptar con tarjetas nuevas" || bad "rehacer: $o $(cartas)"
bash "$ROOT/lanzar.sh" rehacer "$R" 9 >/dev/null 2>&1 && bad "rehace una FASE que no existe" || ok "rehacer una FASE sin tareas: error"

# 5. implementar se niega a empezar con huecos (sin llamar al ejecutor)
git add -A && git commit -qm huecos
o=$(bash "$ROOT/etapa.sh" "$R" implementar 0 | tail -1)
echo "$o" | jq -e '.outcome == "failed" and (.reason | test("PLAN GAP"))' >/dev/null && ok "implementar con [PLAN GAP] pendiente falla al momento y dice cómo seguir" || bad "implementar: $o"

# 6. la etapa huecos completa los [PLAN GAP] y cierra las preguntas que el implementador dejó por ellos (y solo esas)
mkdir -p .sdd/hermes && echo '{"ejecutor":"claude","ejecutores":{"huecos":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
cat > .sdd/questions-task-implementer.md <<'Q'
# Questions

## Q-task-implementer-001 [OPEN] skill=sdd-task-implementer context=TASK-F0-007 (journey FASE-0, [PLAN GAP]) · IF-0-001
Question: ¿Cómo sigo?
  A) Rehacer plan y tareas (recommended)
  B) Otra cosa
Answer:

## Q-task-implementer-002 [OPEN] skill=sdd-task-implementer context=TASK-F0-008
Question: ¿Otra duda que no es de los huecos?
  A) Sí (recommended)
Answer:
Q
cat > .sdd/questions-plan-architect.md <<'Q'
## Q-plan-architect-001 [OPEN] skill=sdd-plan-architect context=TASK-F0-007
Question: ¿Contrato?
  A) x (recommended)
Answer:
Q
o=$(FALSO_MODO=huecos bash "$ROOT/etapa.sh" "$R" huecos 0 | tail -1)
echo "$o" | jq -e '.outcome == "done"' >/dev/null && ! grep -q 'PLAN GAP' task/TASK-FASE-0.md && ok "la etapa huecos deja la FASE sin [PLAN GAP] ($(echo "$o" | jq -r .resumen))" || bad "huecos: $o"
grep -q '^## Q-task-implementer-001 \[ANSWERED\]' .sdd/questions-task-implementer.md && grep -q '^Answer: resuelta por el arnés .*TASK-F0-007' .sdd/questions-task-implementer.md \
  && ok "cierra la pregunta del implementador sobre ese hueco" || bad "cerrar: $(cat .sdd/questions-task-implementer.md)"
grep -q '^## Q-task-implementer-002 \[OPEN\]' .sdd/questions-task-implementer.md && ok "no toca otra pregunta del implementador" || bad "otra: $(grep '^## ' .sdd/questions-task-implementer.md)"
grep -q '^## Q-plan-architect-001 \[OPEN\]' .sdd/questions-plan-architect.md && ok "no toca preguntas de contrato (plan), aunque nombren la tarea" || bad "contrato: $(cat .sdd/questions-plan-architect.md)"
exit $fail
