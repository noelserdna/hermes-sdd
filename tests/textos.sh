#!/usr/bin/env bash
# Textos de las puertas (hsdd_textos.py): claros para una persona, sin jerga del método, y con lo que pidió separado de
# lo que añadió el método. También el texto que llega por Telegram cuando se firma.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
TX="python3 $ROOT/plugin/hermes-sdd/hsdd_textos.py"
JERGA='REQ-|\bMust\b|\bShould\b|requirements-engineer|plan-architect|task-implementer|external_customer|\(recommended\)|\bdoubt\b|VERIFIED|FAILING'

R="$T/bar"; mkdir -p "$R/requirements" "$R/intent" "$R/.sdd/hermes" "$R/plan/fases" "$R/task"; cd "$R"
printf '# INT-001\n\nPetición literal (2026-11-10):\n\n> Una web para mi bar con las 5 mejores raciones\n> y la carta con precios.\n' > intent/INT-001.md
cat > requirements/REQUIREMENTS.md <<'M'
# Requirements
> **Version:** 1.2

### REQ-F-001: Las 5 mejores raciones
- **Para el cliente:** Se ven las cinco raciones estrella con su foto y su precio.
- **Priority:** Must have
- **Needs:** N-001

### REQ-F-002: Navegación
- **Para el cliente:** Un menú arriba lleva a cada sección.
- **Priority:** Should have
- **Needs:** N-001

### REQ-NF-001: Rendimiento
- **Priority:** Must have
- **Needs:** —

### REQ-C-001: Sitio estático
- **Para el cliente:** La web no necesita servidor propio.
- **Needs:** — (team)

### REQ-F-009: Algo que ya no vale
- **Status:** Deprecated
- **Priority:** Must have
- **Needs:** N-001
M
cat > .sdd/questions-x.md <<'Q'
## Q-x-001 [OPEN] skill=sdd-requirements-engineer
Question: ¿Qué foto ponemos de portada?
  A) La de las bravas (recommended)
  B) La de la barra
Answer:

## Q-x-002 [OPEN] skill=sdd-ux-designer
Question: ¿Pedimos confirmación al cancelar?
  A★) No, un clic
  B) Sí, y añadirlo como criterio (req-change)
Answer:

## Q-x-003 [OPEN]
Question: ¿Qué driver de SQLite?
Options: [A] el integrado (recomendada)  [B] better-sqlite3  [C] dejarlo
Answer:
Q

# ── requisitos ──────────────────────────────────────────────────────────────────────────────────────────────────
o=$($TX puerta requisitos "$R" --proyecto bar --version 1.2 | jq -r .texto)
echo "$o" | grep -q '^🗣 Lo que pediste:$' && echo "$o" | grep -q '^«Una web para mi bar con las 5 mejores raciones y la carta con precios.»$' \
  && ok "requisitos: empieza por lo que pediste, con tus palabras" || bad "petición: $o"
sec() { echo "$o" | sed -n "/^$1/,/^\$/p"; }
sec '✅ Sale de lo que pediste' | grep -q 'cinco raciones estrella' && ! sec '✅ Sale de lo que pediste' | grep -q 'Un menú arriba' \
  && ok "requisitos: lo imprescindible que sale de tu petición, con la frase para el cliente" || bad "pedido: $(sec '✅')"
sec '➕ Lo añade el método' | grep -q 'Un menú arriba' && sec '➕ Lo añade el método' | grep -q 'Rendimiento' \
  && ok "requisitos: aparte, lo que añadió el método (lo no imprescindible y lo que no sale de ninguna necesidad)" || bad "añadido: $(sec '➕')"
sec '🔧 Condiciones' | grep -q 'no necesita servidor' && ok "requisitos: las condiciones del proyecto, aparte" || bad "condiciones: $(sec '🔧')"
! echo "$o" | grep -q 'ya no vale' && ok "requisitos: no enseña los requisitos retirados" || bad "retirado aparece"
echo "$o" | grep -q '⭐ recomendada' && echo "$o" | grep -q '^1. ¿Qué foto ponemos de portada?$' && ok "preguntas: numeradas como los botones y con la recomendada marcada" || bad "preguntas: $o"
echo "$o" | grep -q '^   A) el integrado  ⭐ recomendada$' && echo "$o" | grep -q '^   C) dejarlo$' && ok "preguntas: opciones en una línea con [A] [B] [C], la recomendada marcada" || bad "corchetes: $o"
echo "$o" | grep -q '^   B) Sí, y añadirlo como criterio  (📝 abre un cambio de requisitos)$' && ok "preguntas: la opción que pide cambiar requisitos lo avisa (sin la marca del método)" || bad "req-change: $o"
echo "$o" | grep -q '^   A) No, un clic  ⭐ recomendada$' && ok "preguntas: «A★)» también es la recomendada (y la A no se pierde)" || bad "estrella: $o"
echo "$o" | grep -qE "$JERGA" && bad "requisitos con jerga: $(echo "$o" | grep -E "$JERGA")" || ok "requisitos: sin jerga del método"
echo "$o" | grep -q '(versión 1.2)' && ok "requisitos: dice qué versión se aprueba" || bad "versión"

# ── ruta ─────────────────────────────────────────────────────────────────────────────────────────────────────────
cat > .sdd/hermes/ruta.json <<'J'
{"stages": {"requirements-engineer": {"run": true}, "ux-designer": {"run": false}, "plan-architect": {"run": true},
            "security-auditor": {"run": true}, "task-implementer": {"run": true}},
 "factors": {"external_customer": {"p": 0.4, "value": "doubt"}, "sensitive_data": {"p": 0.02, "value": "no"}}}
J
o=$($TX puerta ruta "$R" --proyecto bar | jq -r .texto)
echo "$o" | grep -q 'el método propone: requisitos → plan por fases → revisión de seguridad → programación.' \
  && ok "ruta (sin rutas configuradas): los pasos con nombres normales" || bad "ruta: $o"
echo "$o" | grep -q 'no tengo claro si la web es para un cliente que tiene que revisarla' && ok "ruta: las dudas explicadas" || bad "duda: $o"
echo "$o" | grep -qE "$JERGA" && bad "ruta con jerga: $(echo "$o" | grep -E "$JERGA")" || ok "ruta: sin jerga del método"
# con las rutas configuradas: una línea por botón, la recomendada (o la fijada al crear el proyecto) marcada
cat > "$T/rutas.json" <<'J'
[{"verbo":"ruta-ligera","etiqueta":"⭐ Ligera","descripcion":"Solo lo esencial.","etapas":[],"hace":"ninguna etapa extra","recomendada":true,"fijada":true},
 {"verbo":"ruta-completa","etiqueta":"🧭 Completa","descripcion":"Todo.","etapas":["spec-auditor"],"hace":"auditoría de especificaciones","recomendada":false}]
J
o=$($TX puerta ruta "$R" --proyecto bar --opciones-ruta "$T/rutas.json" | jq -r .texto)
echo "$o" | grep -q '^⭐ Ligera (la fijaste al crear el proyecto): Solo lo esencial. → sin pasos extra.$' \
  && echo "$o" | grep -q '^🧭 Completa: Todo. → pasos extra: auditoría de especificaciones.$' && ! echo "$o" | grep -q 'el método propone' \
  && ok "ruta: una línea por ruta configurada, con sus pasos extra y la fijada marcada" || bad "rutas: $o"
echo "$o" | grep -qE "$JERGA|Hacerlo todo" && bad "ruta con jerga: $o" || ok "ruta con rutas: sin jerga"

# ── plan ─────────────────────────────────────────────────────────────────────────────────────────────────────────
printf '# FASE 0: La portada\n' > plan/fases/FASE-0-portada.md; printf '# FASE 1: La carta\n' > plan/fases/FASE-1-carta.md
printf -- '- [ ] TASK-F0-001 a\n- [ ] TASK-F0-002 b\n' > task/TASK-FASE-0.md
o=$($TX puerta plan "$R" --proyecto bar | jq -r .texto)
echo "$o" | grep -q '2 fases' && echo "$o" | grep -q '^• FASE-0: La portada (2 tareas)$' && echo "$o" | grep -q '^• FASE-1: La carta$' \
  && ok "plan: las fases por su nombre, en orden, con sus tareas" || bad "plan: $o"
mv plan/fases/FASE-1-carta.md "$T/"; echo compacta > .sdd/hermes/granularidad-plan
o=$($TX puerta plan "$R" --proyecto bar | jq -r .texto)
echo "$o" | grep -q '^🗺 Plan de «bar»: una sola fase.$' && echo "$o" | grep -q 'en la entrega final' && ! echo "$o" | grep -q 'antes de pasar a la siguiente' \
  && ok "plan de una sola fase: dice que se acepta con la entrega, no «antes de la siguiente»" || bad "plan único: $o"
echo fina > .sdd/hermes/granularidad-plan; o=$($TX puerta plan "$R" --proyecto bar | jq -r .texto)
echo "$o" | grep -q 'antes de pasar a la siguiente' && ok "plan fino de una fase: conserva su puerta de fase" || bad "plan fino: $o"
rm -f .sdd/hermes/granularidad-plan; mv "$T/FASE-1-carta.md" plan/fases/

# ── fase y entrega ───────────────────────────────────────────────────────────────────────────────────────────────
cat > "$T/g.md" <<'G'
| Requirement | Priority | Verification | Verdict | Criteria | Evidence |
|---|---|---|---|---|---|
| REQ-F-001 Las 5 mejores raciones | Must | test | VERIFIED | 3/3 | AC1: tests pass |
| REQ-F-002 Navegación | Should | test | MISSING | 0/1 | — |
G
o=$($TX puerta fase "$R" --proyecto bar --fase 0 --gate-md "$T/g.md" --rc 0 --tests-editados 0 --video 1 --capturas 4 | jq -r .texto)
echo "$o" | grep -q '^✅ Las 5 mejores raciones: funciona y está comprobado (3 de 3 criterios)$' && echo "$o" | grep -q '^⚠️ Navegación: sin comprobar todavía (0 de 1 criterio)$' \
  && ok "fase: cada requisito con su resultado, en palabras" || bad "fase: $o"
echo "$o" | grep -q '🎬 Demo: vídeo y 4 capturas.' && echo "$o" | grep -q 'No se ha tocado ningún test' && ok "fase: dice qué demo hay y si se tocaron tests" || bad "demo: $o"
o=$($TX puerta fase "$R" --proyecto bar --fase 0 --gate-md "$T/g.md" --rc 1 --tests-editados 2 | jq -r .texto)
echo "$o" | grep -q '^⛔ No pasa la comprobación' && echo "$o" | grep -q 'Se han cambiado 2 tests que ya existían' && echo "$o" | grep -q 'no trae demo' \
  && ok "fase: el bloqueo, los tests tocados y la falta de demo, dichos claro" || bad "fase mal: $o"
echo "$o" | grep -qE "$JERGA" && bad "fase con jerga: $(echo "$o" | grep -E "$JERGA")" || ok "fase: sin jerga del método"
o=$($TX puerta entrega "$R" --proyecto bar --gate-md "$T/g.md" --rc 0 --fases-aceptadas "fase-0-accepted fase-1-accepted" | jq -r .texto)
echo "$o" | grep -q 'está terminado y listo para entregar' && echo "$o" | grep -q 'Fases aceptadas: 2.' && ok "entrega: clara" || bad "entrega: $o"
echo "$o" | grep -q '^✅ Lo imprescindible está comprobado (1 de 2 requisitos). Queda 1 requisito sin comprobar que no es imprescindible' \
  && ! echo "$o" | grep -q 'Todo en orden' && ok "entrega: no dice «todo en orden» con requisitos sin comprobar" || bad "cabeza entrega: $o"

# ── lo que solo una persona puede comprobar (inspección o demo): 🔍 Lo he revisado y acepto ─────────────────────────
cat >> requirements/REQUIREMENTS.md <<'M'

### REQ-C-009: Textos en español
- **Para el cliente:** Todos los textos de la web están en español.
- **Priority:** Must have
- **Verification:** inspection — a person reviews the texts
M
gj() { jq -n --arg v "$1" --argjson a "${2:-0}" '{summary:{unshown:$a}, requirements:[{id:"REQ-F-001",priority:"Must",verdict:"VERIFIED"},{id:"REQ-C-009",priority:"Must",verdict:$v}]}'; }
o=$(gj MISSING | $TX revisar "$R" | jq -c '[.solo, [.revisar[] | .id + ":" + .como + ":" + .cliente]]')
[ "$o" = '[true,["REQ-C-009:inspection:Todos los textos de la web están en español."]]' ] && ok "revisar: la inspección pendiente es lo único que falta" || bad "revisar: $o"
o=$(gj MISSING 1 | $TX revisar "$R" | jq -c .solo); [ "$o" = false ] && ok "revisar: con otras alertas no basta con revisar" || bad "revisar alertas: $o"
o=$(gj VERIFIED | $TX revisar "$R" | jq -c '.revisar | length'); [ "$o" = 0 ] && ok "revisar: nada que revisar si ya está comprobado" || bad "revisar verificado: $o"
gj MISSING | $TX revisar "$R" > "$T/rev.json"
o=$($TX puerta entrega "$R" --proyecto bar --gate-md "$T/g.md" --rc 1 --revisar "$T/rev.json" | jq -r .texto)
echo "$o" | grep -q '^🔍 Solo falta tu revisión' && echo "$o" | grep -q '^• Textos en español: Todos los textos de la web están en español.$' \
  && echo "$o" | grep -q 'pulsa 🔍 Lo he revisado y acepto' && ! echo "$o" | grep -q 'solo puedes rechazarla' \
  && ok "entrega: enseña lo que revisas tú y el botón de revisado, sin decir «solo rechazar»" || bad "entrega revisar: $o"
o=$($TX puerta entrega "$R" --proyecto bar --gate-md "$T/g.md" --rc 1 | jq -r .texto)
echo "$o" | grep -q 'Pulsa ❌ Rechazar' && ! echo "$o" | grep -q 'Acepto la entrega' && ok "entrega bloqueada: no invita a aceptar" || bad "entrega bloqueada: $o"
o=$($TX puerta fase "$R" --proyecto bar --fase 0 --gate-md "$T/g.md" --rc 1 | jq -r .texto)
echo "$o" | grep -q '❌ Rechazar y di qué hay que corregir, o 🟡 Aceptar sin lo que falta' && ! echo "$o" | grep -q 'podrás aceptarla' && ok "fase bloqueada: no invita a aceptar; rechazar o eximir lo que falta" || bad "fase bloqueada: $o"
python3 - "$ROOT" <<'PY' && ok "Jev no puede elegir «revisado»: una inspección la confirma una persona" || bad "jev revisado"
import sys; sys.path.insert(0, sys.argv[1] + "/plugin/hermes-sdd"); import hsdd_nucleo as N
v = N.verbos_jev({"opciones": [{"verbo": "ver"}, {"verbo": "revisado", "etiqueta": "🔍"}, {"verbo": "acepto", "etiqueta": "✅"}]})
assert list(v) == ["acepto"], v
PY

# ── la puerta entera con puerta.sh (texto y datos para Jev) ──────────────────────────────────────────────────────
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false && git add -A && git commit -qm x
g=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" requisitos)
jq -e '.preguntas[1] | .opciones == ["A","B"] and .recomendada == "A"' "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null \
  && ok "puerta.sh: «A★)» es una opción y la recomendada en los botones Q" || bad "estrella: $(jq -c .preguntas "$HERMES_SDD_HOME/puertas/$g.json")"
jq -e '.preguntas[2] | .opciones == ["A","B","C"] and .recomendada == "A"' "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null \
  && ok "puerta.sh: «Options: [A] … (recomendada)  [B] …» en una línea también da botones Q" || bad "corchetes: $(jq -c .preguntas "$HERMES_SDD_HOME/puertas/$g.json")"
jq -e '.titulo == "Requisitos" and (.texto | test("Lo que pediste")) and .tests_editados == 0 and .bloqueo == false and (.opciones[0].etiqueta == "✅ Apruebo")' \
  "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null && ok "puerta.sh usa los textos nuevos y guarda los datos para Jev" || bad "puerta.sh: $(jq -c '{titulo, tests_editados, bloqueo}' "$HERMES_SDD_HOME/puertas/$g.json")"

# ── lo que llega a Telegram al firmar ────────────────────────────────────────────────────────────────────────────
o=$(python3 - "$ROOT" <<'PY'
import importlib.util, sys
from pathlib import Path
spec = importlib.util.spec_from_file_location("hsdd", Path(sys.argv[1]) / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
for r in ("FASE-0 aceptada por Ana (Cliente) — tag fase-0-accepted", "Ruta confirmada (acepto) por Ana (Cliente)",
          "FASE-1 rechazada por Ana (Cliente): falta el mapa", "Entrega 1 aceptada por Jev (jev-1) (Agente automático (modo auto)) — tag entrega-1"):
    print(m._resultado_claro(r).replace("\n", " | "))
PY
)
echo "$o" | sed -n 1p | grep -q '^✅ FASE-0 aceptada por Ana (Cliente). | 🏷 Queda guardado en el historial como «fase-0-accepted». | Sigue solo' \
  && echo "$o" | sed -n 2p | grep -q '^✅ Ruta confirmada por Ana (Cliente).' && echo "$o" | sed -n 3p | grep -q '^↩️ .*Se rehace con lo que has pedido' \
  && echo "$o" | sed -n 4p | grep -q '^✅ Entrega 1 aceptada por Jev, en modo automático. | .*🎉 Proyecto entregado.' && ok "al firmar: qué quedó registrado y qué pasa ahora, sin «— tag» en medio" || bad "resultado: $o"
# veredictos con motivo («missing (no visual evidence)») en castellano, y Jev dice qué regla le impide decidir
o=$(python3 - "$ROOT/plugin/hermes-sdd" <<'PY2'
import sys; sys.path.insert(0, sys.argv[1]); from pathlib import Path
import hsdd_textos as X, hsdd_nucleo as N
print(X._lineas_veredictos(Path("/nada"), X._filas_gate("| REQ-F-001 Reservar | Must | x | missing (no visual evidence) | 2/4 |"))[0])
print(N.describir_jev({"jev": {"choice": "persona", "p": 1.0, "decide": False, "modo": "auto", "motivo": "la puerta no pasa la comprobación de calidad"}}))
PY2
)
[ "$(sed -n 1p <<< "$o")" = "⚠️ Reservar: falta la captura que lo enseña (2 de 4 criterios)" ] && ok "veredicto con motivo: en castellano, sin «missing (no visual evidence)»" || bad "motivo: $o"
[ "$(sed -n 2p <<< "$o")" = "🤖 Jev no puede decidirla: la puerta no pasa la comprobación de calidad." ] && ok "Jev: dice la regla que le impide decidir, no «seguro al 100 %»" || bad "jev: $o"

# puerta de un cambio que solo ajusta criterios: dice cuáles, comparando con la última versión aprobada (tag requirements-v*)
C="$T/cambio"; mkdir -p "$C/requirements" "$C/intent"; cd "$C"; git init -q; git config user.email t@t; git config user.name t
printf '### REQ-F-001: Antelación\n- **Para el cliente:** Hasta 30 días antes.\n- **Acceptance criteria:**\n  - GIVEN hoy WHEN reserva a 30 días THEN se crea\n  - GIVEN hoy WHEN reserva en enero de 2027 THEN no se crea\n' > requirements/REQUIREMENTS.md
git add -A; git commit -qm v1; git tag requirements-v1.0
sed -i.bak '/enero de 2027/d' requirements/REQUIREMENTS.md; rm -f requirements/REQUIREMENTS.md.bak
printf '# INT-002\n\n> quita el criterio de enero\n' > intent/INT-002.md
o=$($TX puerta requisitos "$C" --proyecto sala --version 1.1 --cambio INT-002 | jq -r .texto)
echo "$o" | grep -q '^➖ Antelación: se quita el criterio «GIVEN hoy WHEN reserva en enero de 2027 THEN no se crea»$' \
  && ok "cambio de criterios: la puerta dice cuál se quita (no «el detalle está en changes/»)" || bad "ajustes: $o"
cd "$R"
exit $fail
