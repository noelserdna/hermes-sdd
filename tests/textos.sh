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
- **Origin:** method

### REQ-F-003: La carta con precios
- **Para el cliente:** La carta entera, con el precio de cada plato.
- **Priority:** Should have
- **Needs:** N-002

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
  && ok "requisitos: lo que sale de tu petición, con la frase para el cliente" || bad "pedido: $(sec '✅')"
sec '✅ Sale de lo que pediste' | grep -q 'La carta entera' && ! sec '➕ Lo añade el método' | grep -q 'La carta entera' \
  && ok "requisitos: un Should que pediste es tuyo (la prioridad no dice de dónde viene; compra-piso)" || bad "should pedido: $(sec '✅')"
sec '➕ Lo añade el método' | grep -q 'Un menú arriba' && sec '➕ Lo añade el método' | grep -q 'Rendimiento' \
  && ok "requisitos: aparte, lo que añadió el método (Origin: method, o lo que no sale de ninguna necesidad)" || bad "añadido: $(sec '➕')"
sec '🔧 Condiciones' | grep -q 'no necesita servidor' && ok "requisitos: las condiciones del proyecto, aparte" || bad "condiciones: $(sec '🔧')"
! echo "$o" | grep -q 'ya no vale' && ok "requisitos: no enseña los requisitos retirados" || bad "retirado aparece"
echo "$o" | grep -q '⭐ recomendada' && echo "$o" | grep -q '^1. ¿Qué foto ponemos de portada?$' && ok "preguntas: numeradas como los botones y con la recomendada marcada" || bad "preguntas: $o"
echo "$o" | grep -q '^   A) el integrado  ⭐ recomendada  (🛠 lanza trabajo)$' && echo "$o" | grep -q '^   C) dejarlo$' && ok "preguntas: opciones en una línea con [A] [B] [C], la recomendada marcada" || bad "corchetes: $o"
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

o=$($TX puerta preguntas "$R" --proyecto bar --fase 5 | jq -r '.titulo + "|" + .texto')
echo "$o" | grep -q '^Preguntas de la FASE-5|⏸ La FASE-5 de «bar» se ha parado' && echo "$o" | grep -q '✅ Responder' && echo "$o" | grep -q '^1\. ' \
  && ok "puerta de preguntas de una FASE: qué pasa al responder y las preguntas con sus opciones" || bad "preguntas: $o"
# puerta de FASE con impugnaciones abiertas (gate 4): las enseña en castellano y ofrece descartarlas, no eximir
echo '[{"id":"CH-005","req":"REQ-F-001","ac":3,"category":"WRONG-CAPTURE","quote":"GIVEN el formulario de lucia"}]' > "$T/imp.json"
o=$($TX puerta fase "$R" --proyecto bar --fase 0 --rc 4 --impugnaciones "$T/imp.json" | jq -r .texto)
echo "$o" | grep -q 'la revisión independiente ha encontrado algo que no prueban' && echo "$o" | grep -q '🔧 Siguen abiertas tras los arreglos automáticos (técnicas: la captura no enseña lo que dice el criterio: CH-005)' \
  && echo "$o" | grep -q '🗑 Descartar las que no sean un fallo' && ! echo "$o" | grep -q '🟡' && ! echo "$o" | grep -q 'fallan o sin comprobar' \
  && ok "puerta con impugnaciones: las enseña, ofrece 🗑 descartar y no promete 🟡" || bad "impugnaciones: $o"
echo '[{"id":"CH-017","req":"REQ-F-001","ac":5,"category":"SPEC-QUESTION","quote":"el 2027-01-03 sigue Moroso"}]' > "$T/imp2.json"
o=$($TX puerta fase "$R" --proyecto bar --fase 2 --rc 4 --impugnaciones "$T/imp2.json" | jq -r .texto)
echo "$o" | grep -q '🤔 La revisión independiente tiene dudas sobre lo que pide el propio requisito; esto es tuyo' && echo "$o" | grep -q '• CH-017 · .*«el 2027-01-03 sigue Moroso»' && echo "$o" | grep -q '✏️ Corregir el requisito' \
  && ! ($TX puerta fase "$R" --proyecto bar --fase 0 --rc 4 --impugnaciones "$T/imp.json" | jq -r .texto | grep -q 'Corregir el requisito') \
  && ok "con una duda del criterio ofrece ✏️ Corregir el requisito (y solo entonces)" || bad "corregir: $o"
# lo técnico, en una línea por tipo; lo del cliente (dudas del criterio), una por una (puerta de una pantalla)
printf '%s' '[{"id":"CH-001","req":"REQ-F-001","ac":1,"category":"WEAKENED-ASSERT","quote":"x"},{"id":"CH-002","req":"REQ-F-001","ac":2,"category":"WEAKENED-ASSERT","quote":"y"},{"id":"CH-003","req":"REQ-F-001","ac":3,"category":"NOT-IMPLEMENTED","quote":"z"},{"id":"CH-004","req":"REQ-F-001","ac":4,"category":"SPEC-QUESTION","quote":"duda"}]' > "$T/imp3.json"
o=$($TX puerta entrega "$R" --proyecto bar --rc 4 --impugnaciones "$T/imp3.json" | jq -r .texto)
echo "$o" | grep -q 'técnicas: el test comprueba menos de lo que pide el criterio: CH-001, CH-002; no está hecho: CH-003)' \
  && [ "$(echo "$o" | grep -c '^• CH-')" = 1 ] && echo "$o" | grep -q '^• CH-004 · ' \
  && ok "entrega: lo técnico agrupado en una línea; solo la duda del criterio va una por una" || bad "agrupado: $o"
# preguntas escritas sin la cabecera «## » y con números repetidos (club, FASE-0..3): se normalizan y se ven
N="$T/norm"; mkdir -p "$N/.sdd"; printf '# P\n\nQ-task-implementer-001 [OPEN]\nQuestion: ¿uno?\nOptions: [A] sí (recomendada, implementada) [B] no\n\nQ-task-implementer-001 [OPEN]\nQuestion: ¿dos?\nOptions: [A] a [B] b (recomendada)\n' > "$N/.sdd/questions-task-implementer.md"
python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" normalizar-preguntas "$N" >/dev/null
o=$(python3 - "$ROOT/plugin/hermes-sdd" "$N" <<'PY'
import sys, re; sys.path.insert(0, sys.argv[1]); import hsdd_textos as X
t = open(sys.argv[2] + "/.sdd/questions-task-implementer.md").read()
bs = re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", t, flags=re.M | re.S)
print(" ".join(b.split()[1] + "=" + X.opciones_json(b)["recomendada"] for b in bs))
PY
)
[ "$o" = "Q-task-implementer-001=A Q-task-implementer-002=B" ] && ok "preguntas sin «## » y repetidas: cabecera, renumeradas y con su recomendada" || bad "normalizar: $o"
o=$(python3 - "$ROOT/plugin/hermes-sdd" <<'PY'
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as X
b = "## Q-x-007 [OPEN]\nQuestion: ¿Se cambia UC-005?\nOptions: [A] Sí: reordenar (recomendada; requiere sdd-req-change) [B] No\n"
print(X.opciones_json(b)["recomendada"], bool(X.peticion_cambio(b, "A")), X.opciones(b)[0][1])
PY
)
[ "$o" = "A True Sí: reordenar (requiere sdd-req-change)" ] && ok "«(recomendada; requiere sdd-req-change)»: es la recomendada y sigue pidiendo un cambio" || bad "paréntesis: $o"
# ── la puerta entera con puerta.sh (texto y datos para Jev) ──────────────────────────────────────────────────────
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false && git add -A && git commit -qm x
g=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" requisitos)
jq -e '.preguntas[1] | .opciones == ["A","B"] and .recomendada == "A"' "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null \
  && ok "puerta.sh: «A★)» es una opción y la recomendada en los botones Q" || bad "estrella: $(jq -c .preguntas "$HERMES_SDD_HOME/puertas/$g.json")"
jq -e '.preguntas[2] | .opciones == ["A","B","C"] and .recomendada == "A"' "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null \
  && ok "puerta.sh: «Options: [A] … (recomendada)  [B] …» en una línea también da botones Q" || bad "corchetes: $(jq -c .preguntas "$HERMES_SDD_HOME/puertas/$g.json")"
jq -e '.titulo == "Requisitos" and (.texto | test("Lo que pediste")) and .tests_editados == 0 and .bloqueo == false and (.opciones[0].etiqueta == "✅ Apruebo")' \
  "$HERMES_SDD_HOME/puertas/$g.json" >/dev/null && ok "puerta.sh usa los textos nuevos y guarda los datos para Jev" || bad "puerta.sh: $(jq -c '{titulo, tests_editados, bloqueo}' "$HERMES_SDD_HOME/puertas/$g.json")"
# tests editados: cuenta el código de test que ya existía, no los documentos de test/ (TEST-PLAN.md, matrices)
mkdir -p tests test; printf 'expect(a).toBe(1)\n' > tests/a.test.js; printf '# Plan\nviejo\n' > test/TEST-PLAN.md
git add -A && git commit -qm t && git tag fase-0-accepted
printf 'expect(a).toBe(2)\n' > tests/a.test.js; printf '# Plan\nnuevo\n' > test/TEST-PLAN.md; git commit -qam t2
g=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" fase 1 2>/dev/null)
[ "$(jq -r .tests_editados "$HERMES_SDD_HOME/puertas/$g.json")" = 1 ] && ok "tests editados: el .test.js cuenta, TEST-PLAN.md no" || bad "tests editados: $(jq -r .tests_editados "$HERMES_SDD_HOME/puertas/$g.json")"
# reabrir la puerta de la misma FASE deja la anterior «superada», no dos abiertas a la vez (club: entrega reabierta)
g2=$(HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/puerta.sh" "$R" fase 1 2>/dev/null)
[ "$(jq -r '.estado + " " + .superada_por' "$HERMES_SDD_HOME/puertas/$g.json")" = "superada $g2" ] && [ "$(jq -r .estado "$HERMES_SDD_HOME/puertas/$g2.json")" = abierta ] \
  && ok "reabrir una puerta de la misma FASE supera la anterior" || bad "superada: $(jq -c '{estado, superada_por}' "$HERMES_SDD_HOME/puertas/$g.json")"

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
echo "$o" | grep -q '^➖ Antelación: se quita el criterio «hoy; cuando reserva en enero de 2027 → no se crea»$' \
  && ok "cambio de criterios: la puerta dice cuál se quita (no «el detalle está en changes/»)" || bad "ajustes: $o"
# … y si solo cambia cómo se verifica (sala, INT-005), también lo dice, en castellano
git checkout -q requirements/REQUIREMENTS.md; printf -- '- **Verification:** test — sin versión fija\n' >> requirements/REQUIREMENTS.md
sed -i.bak 's/^- \*\*Para el cliente:\*\*.*/&/' requirements/REQUIREMENTS.md; rm -f requirements/REQUIREMENTS.md.bak
git commit -qam v1b; git tag -d requirements-v1.0 >/dev/null; git tag requirements-v1.0
sed -i.bak 's/sin versión fija/la versión mayor no queda fijada/' requirements/REQUIREMENTS.md; rm -f requirements/REQUIREMENTS.md.bak
o=$($TX puerta requisitos "$C" --proyecto sala --version 1.1 --cambio INT-002 | jq -r .texto)
echo "$o" | grep -q '^✏️ Antelación: cómo se comprueba pasa a «la versión mayor no queda fijada»$' && ! echo "$o" | grep -q 'changes/' \
  && ok "cambio que solo toca la verificación: la puerta lo dice (no «el detalle está en changes/»)" || bad "verificación: $o"
# … y si cambia el enunciado sin tocar la frase para el cliente, también (club, INT-004: REQ-F-012 «4 plazas fijas»)
git checkout -q requirements/REQUIREMENTS.md; printf -- '- **Statement:** THE system SHALL accept bookings up to 30 days ahead\n' >> requirements/REQUIREMENTS.md
git commit -qam v1c; git tag -d requirements-v1.0 >/dev/null; git tag requirements-v1.0
sed -i.bak 's/up to 30 days ahead/up to 30 days ahead with 4 places/' requirements/REQUIREMENTS.md; rm -f requirements/REQUIREMENTS.md.bak
o=$($TX puerta requisitos "$C" --proyecto sala --version 1.1 --cambio INT-002 | jq -r .texto)
echo "$o" | grep -q '^✏️ Antelación: cambia lo que exige el requisito; ahora dice «THE system SHALL accept bookings up to 30 days ahead with 4 places»$' \
  && ok "cambio del enunciado sin tocar la frase para el cliente: la puerta lo enseña" || bad "enunciado: $o"
# la ruta de un cambio sobre un proyecto ya entregado recomienda la ligera
git checkout -q requirements/REQUIREMENTS.md
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta sala | jq -r '.[0].verbo + " " + (.[0].tras_entrega | tostring)')
git tag entrega-1
o2=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta sala | jq -r '.[0].verbo + " " + (.[0].tras_entrega | tostring)')
o3=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" opciones-ruta sala | jq -r '[.[] | select(.fijada) | .verbo] | join(",")')
git tag -d entrega-1 >/dev/null
[ "$o2" = "ruta-ligera true" ] && [ "$o" != "ruta-ligera true" ] && ok "ruta tras una entrega: recomienda la ligera (antes, la del proyecto)" || bad "ruta tras entrega: $o / $o2"
[ "$o3" = "ruta-ligera" ] && ok "… y cuenta como fijada: Jev solo puede confirmarla (taller3 eligió la adaptativa)" || bad "fijada tras entrega: [$o3]"
# … si lo pidió un mantenimiento en curso, lo dice así y no promete replanificar
printf '# INT-003\n\n> Mantenimiento detectado el 2026-11-13 por la revisión periódica: sube vite\n' > intent/INT-003.md
mkdir -p .sdd/hermes/mantenimiento; echo x > .sdd/hermes/mantenimiento/en-curso.txt
o=$($TX puerta requisitos "$C" --proyecto sala --version 1.1 --cambio INT-003 | jq -r .texto)
echo "$o" | grep -q '^✏️ Cambio que pide el mantenimiento de «sala»:' && echo "$o" | grep -q 'el mantenimiento sigue con esta versión' && ! echo "$o" | grep -q 'pediste' \
  && ok "cambio de un mantenimiento: dice de dónde viene y qué pasa al aprobar" || bad "origen: $o"
rm -rf .sdd/hermes/mantenimiento
# un requisito que pasa sus tests pero tiene una impugnación abierta no sale en verde (club FASE-7, CH-047)
python3 - "$ROOT/plugin/hermes-sdd" <<'PYT' && ok "impugnado: ⚠️ con su CH y la cabecera dice que hay duda, no «sin comprobar»" || bad "impugnado"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
f = T._filas_gate("| REQ-F-001 A | Must | test | VERIFIED | 2/2 | x |\n| REQ-F-002 Plazo | Should | test | VERIFIED · challenged CH-047 | 3/3 | x |\n")
c = T._cabeza_ok(f, True); l = T._lineas_veredictos(Path("/nonexistent"), f)
assert "duda" in c and "sin comprobar" not in c, c
assert l[1].startswith("⚠️ Plazo: pasa sus pruebas") and "CH-047" in l[1] and l[0].startswith("✅"), l
PYT
# una exención cuyo requisito ya se cumple se cierra en PENDIENTES.md (club: CLUB-1 con REQ-F-012 ya 8/8)
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PYT' && ok "PENDIENTES: se cierra la fila de un requisito que ya se cumple; la otra sigue abierta" || bad "cerrar pendientes"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_proyectos as P
from pathlib import Path
r = Path(sys.argv[2]) / "pend"; (r / "acceptance").mkdir(parents=True)
f = r / "acceptance" / "PENDIENTES.md"
f.write_text("| Id | Requisito | Qué falta | Motivo | Quién | Fecha | Puerta | Estado |\n|---|---|---|---|---|---|---|---|\n"
             "| CLUB-1 | REQ-F-012 Clases | AC7 | m | Ana | 2026-11-14 | g1 | abierto |\n"
             "| CLUB-2 | REQ-F-013 Otra | AC1 | m | Ana | 2026-11-14 | g2 | abierto |\n")
c = P.cerrar_pendientes(r, {"requirements": [{"id": "REQ-F-012", "verdict": "VERIFIED"}, {"id": "REQ-F-013", "verdict": "WAIVED"}]}, "2026-11-14")
t = f.read_text()
assert c == ["CLUB-1"], c
assert "| CLUB-1 | REQ-F-012 Clases | AC7 | m | Ana | 2026-11-14 | g1 | cerrado: se cumple desde el 2026-11-14 |" in t, t
assert "| g2 | abierto |" in t, t
assert P.cerrar_pendientes(r, {"requirements": [{"id": "REQ-F-012", "verdict": "VERIFIED"}]}, "2026-11-15") == []
PYT
# «Ratificar ambas ediciones tal cual» no pide hacer nada: no lanza «aplicar respuestas» (club, FASE-8)
python3 - "$ROOT/plugin/hermes-sdd" <<'PYT' && ok "una respuesta que ratifica lo hecho no pide ninguna acción" || bad "ratificar"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
assert T._SIN_ACCION.match("Ratificar ambas ediciones tal cual") and T._SIN_ACCION.match("Ratify both edits")
assert not T._SIN_ACCION.match("Revertirlas: el test del catálogo queda en rojo")
PYT

# ── casos reales del club (puertas de ~/.hermes/hermes-sdd/puertas, 14/11/2026) ─────────────────────────────────────
K="$T/club"; mkdir -p "$K/requirements" "$K/.sdd/hermes"; cd "$K"
printf '### REQ-NF-002: Tono cercano en los textos\n- **Para el cliente:** La web suena como habláis en el club: cercana, sin lenguaje de ventanilla.\n- **Priority:** Should have\n- **Needs:** N-015\n- **Verification:** inspection — una persona del club lee los textos\n' > requirements/REQUIREMENTS.md
# entrega g17946730262624: 29 líneas ✅ iguales y «⚠️ Tono cercano: sin comprobar todavía (0 de 2)» justo encima de
# «🔍 … lo compruebas tú» con el mismo requisito
{ for x in "Entrada con usuario y contraseña" "Contraseña de al menos 10 caracteres" "Alta de socios" "Cuota mensual de 30 €" \
    "El administrador marca quién ha pagado" "Socio moroso el día 5" "El moroso no puede reservar" "Reservar una pista" \
    "Máximo 2 reservas activas" "Cancelar una reserva" "Una reserva de tarde" "Clases semanales" "Los socios se apuntan" \
    "Pista con clase" "Torneo de 8 parejas" "El torneo ocupa las pistas" "Resultados del torneo" "CSV de pagos" "Botón Salir" \
    "La sesión caduca" "Cambiar la contraseña" "Cinco fallos seguidos" "La junta da de baja" "Registro de seguridad" \
    "Plazo de conservación" "Tratamiento de tú" "Todos los textos en español" "Stack JavaScript" "Un servidor del club"; do
    printf '| REQ-F-0%02d %s | Must | test | VERIFIED | 4/4 | x |\n' $((n=${n:-0}+1)) "$x"; done
  printf '| REQ-NF-002 Tono cercano en los textos | Should | inspection | MISSING | 0/2 | x |\n'; } > "$T/entrega.md"
echo '{"revisar":[{"id":"REQ-NF-002","titulo":"Tono cercano en los textos","cliente":"La web suena como habláis en el club","como":"inspection"}],"solo":false}' > "$T/rev.json"
o=$($TX puerta entrega "$K" --proyecto club --gate-md "$T/entrega.md" --rc 0 --revisar "$T/rev.json" | jq -r .texto)
echo "$o" | grep -q '^✅ 29 requisitos funcionan y están comprobados: Entrada con usuario' && [ "$(echo "$o" | grep -c '^✅')" = 2 ] \
  && ok "club, entrega: los 29 ✅ en una línea y solo las excepciones una a una" || bad "agrupar: $o"
echo "$o" | grep -q '^🔍 Tono cercano en los textos: lo compruebas tú' && ! echo "$o" | grep -q '⚠️ Tono cercano' \
  && ok "club, entrega: lo que revisa la persona sale con 🔍, no como «⚠️ sin comprobar todavía»" || bad "tono: $o"
# FASE-5 g1794643938d0fc: «Solo puedes rechazarla» con el botón «🟡 Aceptar sin lo que falta» debajo
o=$($TX puerta fase "$K" --proyecto club --fase 5 --rc 1 | jq -r .texto)
! echo "$o" | grep -qi 'solo puedes rechazarla' && echo "$o" | grep -q 'acéptala sin ello' && echo "$o" | grep -q '🟡 Aceptar sin lo que falta' \
  && ok "club, FASE-5 bloqueada: el texto no dice «solo puedes rechazarla» si hay 🟡 Aceptar sin lo que falta" || bad "contradicción: $o"
# FASE-7 g1794652544f502: «⚠️ Se ha cambiado 1 test… conviene saber por qué» bajo un aviso que ya decía que estaba
# autorizado; ahora la puerta dice quién lo autorizó y qué aserciones se quitan y se ponen
jq -n '{congelados: [{commit:"abc1234", fichero:"tests/integration/seguridad.test.js", autorizado:true,
   autorizacion:"Q-task-implementer-029: Andres Leon (Cliente), puerta g1", debilitamiento:["quita 7 aserción(es)"],
   aserciones_quitadas:["expect(res.registro).toEqual([])", "expect(r.status).toBe(403)"], aserciones_puestas:["expect(res.registro).toHaveLength(1)"]}]}' > .sdd/hermes/fidelidad-7.json
o=$($TX puerta fase "$K" --proyecto club --fase 7 --rc 0 --tests-editados 1 | jq -r .texto)
echo "$o" | grep -q '^✏️ Se ha cambiado 1 test que ya existía, con la autorización que firmaste:' && ! echo "$o" | grep -q 'conviene saber por qué' \
  && echo "$o" | grep -q '^   quita: expect(res.registro).toEqual(\[\]) · expect(r.status).toBe(403)$' && echo "$o" | grep -q '^   pone: expect(res.registro).toHaveLength(1)$' \
  && ok "club, FASE-7: test cambiado con autorización firmada: quién y qué aserciones se quitan y se ponen (≤3 líneas)" || bad "tests autorizados: $o"
jq '.congelados[0].autorizado = false' .sdd/hermes/fidelidad-7.json > "$T/f" && mv "$T/f" .sdd/hermes/fidelidad-7.json
o=$($TX puerta fase "$K" --proyecto club --fase 7 --rc 0 --tests-editados 1 | jq -r .texto)
echo "$o" | grep -q '^⛔ Se ha cambiado 1 test que ya existía y no lo autorizó nadie con su firma' && echo "$o" | grep -q 'SIN autorización firmada' \
  && ok "…y sin autorización firmada lo dice con ⛔" || bad "tests sin autorizar: $o"
# FASE-7: preguntas del implementador con jerga (`estadoVacio()`, art. 12, E_ZONA_SOLO_JUNTA): en el formato nuevo, la
# frase para el cliente delante, lo técnico plegado, el efecto de cada opción y qué lanzará firmar
cat > .sdd/questions-task-implementer.md <<'Q'
## Q-task-implementer-030 [OPEN] skill=sdd-task-implementer context=TASK-F7-001
Question: FASE-7, TASK-F7-001: la tarea pide migrar `club.json` a `version` 2 y que `estadoVacio()` nazca en `version` 2. Eso obliga a editar dos tests que ya existían (art. 12): `tests/integration/store.test.js:42` y `:63`.
Para el cliente: ¿Cambiamos el formato en que se guardan los datos del club? Hoy funciona sin cambiarlo.
Options:
  A) Dejarlo así: campos opcionales en `version` 1, sin migración (recommended)
     efecto: ninguno
     cliente: Dejarlo como está: todo funciona y no hay nada que pasar al formato nuevo
  B) Que una persona autorice editar esos dos tests y añadir la migración v1→v2
     efecto: editar-test tests/integration/store.test.js
     cliente: Cambiar el formato y adaptar la prueba que lo comprueba
Blocks: nada
Answer:

## Q-task-implementer-031 [OPEN] skill=sdd-task-implementer context=TASK-F7-004
Question: REQ-F-024 AC2: solo anoto «Acceso denegado» con `E_ZONA_SOLO_JUNTA`. ¿Se amplía a `E_NO_AUTORIZADO`?
Para el cliente: ¿El registro de seguridad apunta también los intentos de entrar en zonas que no son de la junta?
Options:
  A) Sí, y que la prueba de accesos lo compruebe (recommended)
     efecto: editar-test `tests/integration/accesos.test.js`, tests/e2e/helpers/servidor.js
  B) No
     efecto: ninguno
  C) Cambiar el criterio
     efecto: req-change
Answer:
Q
o=$($TX puerta preguntas "$K" --proyecto club --fase 7 | jq -r .texto)
echo "$o" | grep -q '^1. ¿Cambiamos el formato en que se guardan los datos del club?' && echo "$o" | grep -q '^   🔧 Detalle técnico: FASE-7, TASK-F7-001' \
  && echo "$o" | grep -q '^   A) Dejarlo como está: todo funciona.*⭐ recomendada$' \
  && echo "$o" | grep -q '^   B) Cambiar el formato y adaptar la prueba que lo comprueba  (✏️ autoriza editar tests/integration/store.test.js)$' \
  && ok "club, FASE-7: la pregunta sale con su frase para el cliente y lo técnico plegado en una línea" || bad "para el cliente: $o"
echo "$o" | grep -q '^👉 Si firmas sin tocar los botones Q, esto lanzará: ✏️ autoriza editar tests que ya existían: tests/integration/accesos.test.js (Q2), tests/e2e/helpers/servidor.js (Q2) · sin más efecto: Q1.$' \
  && echo "$o" | grep -q '(📝 abre un cambio de requisitos)' \
  && ok "antes de firmar: «esto lanzará…» con los tests que se autoriza editar" || bad "esto lanzará: $o"
python3 - "$ROOT/plugin/hermes-sdd" <<'PYT' && ok "efecto declarado manda sobre la regex: «Sí: se mantiene el aplazamiento» no lanza trabajo; «No: quitar el límite y borrar el test» sí" || bad "efecto declarado"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
b = ("## Q-x-001 [OPEN]\nQuestion: ¿?\nPara el cliente: ¿?\nOptions:\n  A) Sí: se mantiene el aplazamiento (recommended)\n     efecto: ninguno\n"
     "  B) No: quitar el límite y borrar el test\n     efecto: accion\nAnswer:\n")
assert T.accion_respuesta(b, "A") == "" and T.accion_respuesta(b, "B"), (T.efecto(b, "A"), T.efecto(b, "B"))
# sin efecto (preguntas antiguas) se adivina como antes, y eso es lo que fallaba
v = b.replace("     efecto: ninguno\n", "").replace("     efecto: accion\n", "")
assert T.accion_respuesta(v, "A") and not T.accion_respuesta(v, "B")
assert T.errores_pregunta(b) == [] and T.errores_pregunta(v) == []
assert T.errores_pregunta(b.replace("efecto: accion", "efecto: editar-test")) == ["la opción B autoriza editar tests sin decir cuáles"]
assert "le falta «Para el cliente:»" in T.errores_pregunta(b.replace("Para el cliente: ¿?\n", ""))
PYT
# cambio de una frase de un criterio: ✏️ con las palabras que cambian, no ➖/➕ casi iguales (club, INT-004)
python3 - "$ROOT/plugin/hermes-sdd" <<'PYT' && ok "criterio cambiado en unas palabras: «x» pasa a «y», no ➖ y ➕ casi iguales" || bad "diff por palabras"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
a = 'GIVEN "Iniciación" has 3 socios WHEN "lucia" signs up THEN the user sees "Estás apuntada a Iniciación" and the class shows "4 de 4 plazas"'
b = 'GIVEN "Iniciación" has 3 socios WHEN "lucia" signs up THEN the user sees "Te has apuntado a Iniciación" and the class shows "4 de 4 plazas"'
assert T._parecido(a, b) >= 0.6
assert T._cambio_palabras(a, b) == '«"Estás apuntada» pasa a «"Te has apuntado»', T._cambio_palabras(a, b)
PYT
# el formato de pregunta del método: el ejemplo de references/async-questions.md es válido para el parser, y el gemelo
# de docs/metodo/ es idéntico (estaba desincronizado: le faltaba «(req-change)»)
python3 - "$ROOT/plugin/hermes-sdd" "$ROOT/metodo/references/async-questions.md" <<'PYT' && ok "el ejemplo de async-questions.md lo entiende el parser (efecto, ficheros, para el cliente)" || bad "ejemplo del formato"
import re, sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
ej = re.findall(r"```markdown\n(## Q-task-implementer-031.*?)```", open(sys.argv[2]).read(), re.S)[0]
assert T.errores_pregunta(ej) == [], T.errores_pregunta(ej)
assert T.efecto(ej, "A") == {"efecto": "editar-test", "ficheros": ["tests/integration/accesos.test.js"], "declarado": True,
                             "cliente": "Sí, todos los intentos; se adapta la prueba que ya lo comprobaba"}, T.efecto(ej, "A")
assert T.efecto(ej, "C")["efecto"] == "req-change" and T.efecto(ej, "B")["efecto"] == "ninguno"
assert T.para_cliente(ej).startswith("¿El registro de seguridad")
PYT
d=""; for f in async-questions git-conventions handoff-protocol sdd-constitution; do cmp -s "$ROOT/metodo/references/$f.md" "$ROOT/docs/metodo/$f.md" || d="$d $f"; done
[ -z "$d" ] && ok "docs/metodo/ y metodo/references/ dicen lo mismo" || bad "gemelos distintos:$d"

# ── casos reales del taller (puertas g17946895473328 requisitos v1.0, g179469031011fd cambio INT-002, ruta; 14/11/2026) ──
# «Esto dirá la web»: los textos exactos de las líneas «Se ve:» agrupados por pantalla, sin repetir, con un ejemplo del
# propio criterio para las plantillas; en un cambio, solo los nuevos
W="$T/taller"; mkdir -p "$W/requirements" "$W/intent" "$W/.sdd"; cd "$W"; git init -q; git config user.email t@t; git config user.name t
cat > requirements/REQUIREMENTS.md <<'M'
# Requirements
### REQ-F-001: Apuntarse con plaza libre
- **Para el cliente:** Escribes tu nombre y, si quedan plazas, quedas apuntada o apuntado al momento.
- **Priority:** Must have
- **Needs:** N-001
- **Acceptance criteria:**
  - GIVEN el taller tiene 2 plazas WHEN "Lucía" envía su nombre THEN the user sees "Tienes plaza en el taller, Lucía"
    - Se ve: "Tienes plaza en el taller, {nombre}" en la pantalla de inscripción
  - GIVEN "Lucía" apuntada WHEN "Pablo" envía su nombre THEN the user sees "Tienes plaza en el taller, Pablo"
    - Se ve: "Tienes plaza en el taller, {nombre}" en la pantalla de inscripción
  - GIVEN el nombre está vacío WHEN se envía THEN the user sees "Escribe tu nombre para apuntarte"
    - Se ve: "Escribe tu nombre para apuntarte" en la pantalla de inscripción
### REQ-F-005: Consultar
- **Para el cliente:** Ves si tienes plaza.
- **Priority:** Must have
- **Needs:** N-002
- **Acceptance criteria:**
  - GIVEN "Marta" apuntada WHEN consulta THEN the user sees "Tienes plaza en el taller, Marta"
    - Se ve: "Tienes plaza en el taller, {nombre}" en la pantalla de consulta
### REQ-F-006: La organizadora ve apuntados
- **Para el cliente:** La organizadora ve quién está apuntado.
- **Priority:** Must have
- **Needs:** N-003
- **Acceptance criteria:**
  - GIVEN 2 plazas y "Lucía" y "Pablo" WHEN abre su vista THEN the user sees "Apuntados: 2 de 2" y "Lista de espera: 0"
    - Se ve: "Apuntados: {n} de {plazas}", "Lista de espera: {n}" en la vista de la organizadora
### REQ-C-001: Stack del proyecto
- **Para el cliente:** La web se construye con las herramientas ya elegidas.
- **Verification:** test — package.json declara vite
M
git add -A; git commit -qm v1; git tag requirements-v1.0
o=$($TX puerta requisitos "$W" --proyecto taller --version 1.0 | jq -r .texto)
web=$(echo "$o" | sed -n '/^💬/,/^$/p')
[ "$(echo "$web" | sed -n 2p)" = "En la pantalla de inscripción:" ] \
  && echo "$web" | grep -qx '• «Tienes plaza en el taller, {nombre}» (p. ej. «Tienes plaza en el taller, Lucía»); también en la pantalla de consulta' \
  && echo "$web" | grep -qx '• «Escribe tu nombre para apuntarte»' && echo "$web" | grep -qx 'En la vista de la organizadora:' \
  && echo "$web" | grep -qx '• «Apuntados: {n} de {plazas}» (p. ej. «Apuntados: 2 de 2»)' \
  && [ "$(echo "$web" | grep -c 'Tienes plaza')" = 1 ] && ! echo "$web" | grep -q 'En la pantalla de consulta' \
  && ok "taller, requisitos: «Esto dirá la web» por pantalla, sin repetir, con el ejemplo del propio criterio" || bad "esto dirá la web: $o"
python3 - "$ROOT/plugin/hermes-sdd" "$W" <<'PYT' && ok "«Esto dirá la web» corto: los 12 primeros y «… y N más»" || bad "web corto"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
md = "### REQ-F-001: x\n- **Acceptance criteria:**\n" + "".join(
    f'  - GIVEN a WHEN b THEN the user sees "Texto {chr(65 + i)}"\n    - Se ve: "Texto {chr(65 + i)}" en Inicio\n' for i in range(15))   # letras: textos que solo cambian en un número se juntan en una plantilla
R = Path(sys.argv[2]); viejo = (R / "requirements/REQUIREMENTS.md").read_text()
(R / "requirements/REQUIREMENTS.md").write_text(md)
b = T._bloque_web(R, cambio=False)
(R / "requirements/REQUIREMENTS.md").write_text(viejo)
assert b.splitlines()[-1] == "… y 3 más (en requirements/REQUIREMENTS.md, líneas «Se ve:»)" and b.count("• «Texto") == 12, b
assert "entre llaves" not in b, b
PYT
# el cambio INT-002, pedido por las respuestas de la puerta de requisitos: la petición en castellano (la frase «Para el
# cliente» y la opción elegida), no «Q-requirements-engineer-003: How is the organiser…»; los criterios sin «THEN the
# user sees»; la verificación técnica no sale si cambia la frase; y sin plan aún no promete «replanificar lo nuevo»
cat > .sdd/questions-requirements-engineer.md <<'Q'
## Q-requirements-engineer-003 [ANSWERED] skill=sdd-requirements-engineer context=REQ-F-006
Question: How is the organiser distinguished from other people (no login mentioned)?
Para el cliente: ¿La vista de la organizadora es una página aparte sin contraseña, o debe protegerse?
Options:
  A) Separate page without password (recommended: simplest)
     efecto: req-change
     cliente: Página aparte sin contraseña; no se deja bajar de las personas ya apuntadas
  B) Shared password
     efecto: req-change
Answer: A — elegida por Andres Leon (Cliente) (2026-11-14)
Q
cat > intent/INT-002.md <<'I'
# INT-002

> En la puerta «Requisitos v1.0», Andres Leon (Cliente) eligió respuestas que piden cambiar los requisitos:
>
> Q-requirements-engineer-003: How is the organiser distinguished from other people (no login mentioned)?
> Respuesta elegida: A) Separate page without password (recommended: simplest)
I
python3 - requirements/REQUIREMENTS.md <<'PYT'
import sys; p = sys.argv[1]; t = open(p).read()
t = t.replace("La organizadora ve quién está apuntado.", "La organizadora entra en una página aparte, sin contraseña, y ve quién está apuntado.")
t = t.replace("package.json declara vite", "package.json declara vite y vitest")
t = t.replace("La web se construye con las herramientas ya elegidas.", "La web se construye con las herramientas ya elegidas, más un pequeño servidor.")
t = t.replace('    - Se ve: "Apuntados: {n} de {plazas}", "Lista de espera: {n}" en la vista de la organizadora\n',
  '    - Se ve: "Apuntados: {n} de {plazas}", "Lista de espera: {n}" en la vista de la organizadora\n'
  '  - GIVEN 3 plazas con "Lucía", "Pablo" y "Marta" WHEN la organizadora fija 2 plazas THEN the user sees "No puedes dejar menos plazas (2) que personas apuntadas (3)"\n'
  '    - Se ve: "No puedes dejar menos plazas ({plazas}) que personas apuntadas ({n})" en la vista de la organizadora\n'
  '  - GIVEN la web WHEN alguien abre /organizadora THEN the user sees la vista sin contraseña\n'
  '    - Se ve: "Apuntados: {n} de {plazas}" en /organizadora; no visible en la pantalla de inscripción\n')
open(p, "w").write(t)
PYT
o=$($TX puerta requisitos "$W" --proyecto taller --version 1.1 --cambio INT-002 | jq -r .texto)
echo "$o" | grep -qx '✏️ Cambio que piden las respuestas que eligió Andres Leon (Cliente) en la puerta «Requisitos v1.0» de «taller»:' \
  && echo "$o" | grep -qx '• ¿La vista de la organizadora es una página aparte sin contraseña, o debe protegerse? → A) Página aparte sin contraseña; no se deja bajar de las personas ya apuntadas' \
  && ! echo "$o" | grep -qE 'How is|Q-requirements|Respuesta elegida|recommended' \
  && ok "taller, cambio INT-002: la petición con la frase «Para el cliente» y la opción en castellano, sin la cita en inglés" || bad "petición por respuestas: $o"
echo "$o" | grep -qx '✏️ La organizadora ve apuntados: ahora dice «La organizadora entra en una página aparte, sin contraseña, y ve quién está apuntado.»' \
  && echo "$o" | grep -q '^➕ La organizadora ve apuntados: nuevo criterio «3 plazas con "Lucía", "Pablo" y "Marta"; cuando la organizadora fija 2 plazas → se ve "No puedes' \
  && echo "$o" | grep -q '^✏️ Herramientas del proyecto: ahora dice' && ! echo "$o" | grep -qE 'THEN|GIVEN|the user sees|package.json|Stack|la frase para el cliente' \
  && ok "taller, cambio INT-002: lo que cambia sin «THEN the user sees», sin «Stack» ni la verificación técnica" || bad "qué cambia: $o"
web=$(echo "$o" | sed -n '/^💬/,/^$/p')
[ "$(echo "$web" | grep -c '^•')" = 1 ] && echo "$web" | grep -qx '• «No puedes dejar menos plazas ({plazas}) que personas apuntadas ({n})» (p. ej. «No puedes dejar menos plazas (2) que personas apuntadas (3)»)' \
  && echo "$web" | head -1 | grep -q '^💬 Textos nuevos o cambiados en la web' \
  && ok "taller, cambio INT-002: solo los textos nuevos de la web (no repite los aprobados ni la ruta /organizadora)" || bad "textos del cambio: $o"
echo "$o" | grep -q 'el plan por fases, que aún no está hecho, saldrá de ella' && ! echo "$o" | grep -q 'replanifica' \
  && ok "taller, cambio sin plan todavía: no promete «solo se replanifica lo nuevo: las fases ya aceptadas no se tocan»" || bad "sin plan: $o"
# … y las respuestas que lanzan el cambio llevan su versión para el cliente (por si .sdd/ ya no tuviera la pregunta)
python3 - "$ROOT/plugin/hermes-sdd" "$W" <<'PYT' && ok "respuesta(): lleva «Para el cliente: … → A) …» y la puerta la usa sin la pregunta en .sdd/" || bad "respuesta para el cliente"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
b = (Path(sys.argv[2]) / ".sdd/questions-requirements-engineer.md").read_text()
r = T.respuesta(b, "A")
assert r.splitlines()[1] == "Respuesta elegida: A) Separate page without password (recommended: simplest)", r
assert r.splitlines()[2] == "Para el cliente: ¿La vista de la organizadora es una página aparte sin contraseña, o debe protegerse? → A) Página aparte sin contraseña; no se deja bajar de las personas ya apuntadas", r
pet = "En la puerta «Requisitos v1.0», Ana (Cliente) eligió respuestas que piden cambiar los requisitos: " + " ".join(r.splitlines())
out = T._peticion_por_respuestas(Path("/no/existe"), "taller", pet)
assert out.splitlines()[1] == "• ¿La vista de la organizadora es una página aparte sin contraseña, o debe protegerse? → A) Página aparte sin contraseña; no se deja bajar de las personas ya apuntadas", out
PYT
# «👉 … esto lanzará» con las opciones marcadas (función pura que usan Telegram y el panel), con los efectos que guardó la
# puerta real de requisitos del taller (Q3 y Q4 recomendadas abren un cambio)
python3 - "$ROOT/plugin/hermes-sdd" <<'PYT' && ok "resumen_lanzara: recomendadas por defecto, y se recalcula con las Q marcadas" || bad "resumen_lanzara"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
n, rc = {"efecto": "ninguno", "ficheros": [], "declarado": True}, {"efecto": "req-change", "ficheros": [], "declarado": True}
p = {"preguntas": [{"n": 1, "recomendada": "A", "efectos": {"A": n, "B": rc}}, {"n": 2, "recomendada": "A", "efectos": {"A": n, "B": rc}},
                   {"n": 3, "recomendada": "A", "efectos": {"A": rc, "B": rc}}, {"n": 4, "recomendada": "A", "efectos": {"A": rc, "B": n}}]}
d = T.resumen_lanzara(p, {})
assert d == "👉 Si firmas sin tocar los botones Q, esto lanzará: 📝 abre un cambio de requisitos (antes de seguir te llega su puerta): Q3, Q4 · sin más efecto: Q1, Q2.", d
assert T.resumen_lanzara(p, {"1": "A", "2": "A", "3": "A", "4": "A"}) == d   # marcar lo recomendado no cambia nada
m = T.resumen_lanzara(p, {"4": "B", "1": "B"})
assert m == "👉 Con lo que has marcado en los botones Q, firmar lanzará: 📝 abre un cambio de requisitos (antes de seguir te llega su puerta): Q1, Q3 · sin más efecto: Q2, Q4.", m
p["texto"] = "Requisitos\n\n" + d
assert T.texto_con_lanzara(p, {"4": "B", "1": "B"}) == "Requisitos\n\n" + m
assert T.texto_con_lanzara({**p, "texto": "Requisitos\n\n" + m}, {}) == "Requisitos\n\n" + d   # volver a lo recomendado
assert T.resumen_lanzara({"preguntas": [{"n": 1, "recomendada": "A"}]}, {}) == ""   # puertas antiguas sin efectos: no se toca
assert T.texto_con_lanzara({"texto": "x", "preguntas": [{"n": 1, "recomendada": "A"}]}, {"1": "B"}) == "x"
PYT
# ruta: «fases: compacta: una fase…» (dos puntos seguidos) y «huecos entre especificación y código» (jerga)
cat > "$T/rutas2.json" <<'J'
[{"verbo":"ruta-ligera","etiqueta":"⭐ Ligera","descripcion":"Solo lo esencial.","etapas":[],"hace":"","fijada":true,"fases":"Compacta: una fase y pocas tareas"},
 {"verbo":"ruta-adaptativa","etiqueta":"🧭 Adaptativa","descripcion":"El método elige.","etapas":["gap-detector"],"hace":"x","fases":"Según el tamaño del proyecto"}]
J
o=$($TX puerta ruta "$W" --proyecto taller --opciones-ruta "$T/rutas2.json" | jq -r .texto)
echo "$o" | grep -qx '⭐ Ligera (la fijaste al crear el proyecto): Solo lo esencial. → sin pasos extra; fases: una fase y pocas tareas.' \
  && echo "$o" | grep -q '; fases: según el tamaño del proyecto\.$' \
  && ! grep -qE '"(huecos entre|búsqueda de huecos)|diseño y huecos' "$ROOT/plugin/hermes-sdd/hsdd_proyectos.py" "$ROOT/plugin/hermes-sdd/hsdd_textos.py" \
  && ok "taller, ruta: «fases: una fase y pocas tareas» (no «compacta: …») y sin «huecos»" || bad "ruta fases: $o"
cd "$R"
# «(recomendado)» en masculino también marca la recomendada; sin marca, la primera (como los botones Q): antes la puerta
# no marcaba ninguna ⭐ y acababa en «esto lanzará: .» (taller, entrega)
f="$T/q-masc.md"; cat > "$f" <<'Q'
## Q-x-001 [OPEN] skill=sdd-task-implementer
Question: ¿Reforzar?
Para el cliente: ¿Reforzamos la prueba?
Options:
  A) Reforzar (recomendado)
     efecto: editar-test tests/a.test.js
  B) Dejarlo
     efecto: ninguno
Q
o=$(python3 -c "import sys; sys.path.insert(0, '$ROOT/plugin/hermes-sdd'); import hsdd_textos as T; from pathlib import Path; print(T.preguntas([Path('$f')]))")
echo "$o" | grep -q "⭐ recomendada" && echo "$o" | grep -q "esto lanzará: ✏️ autoriza editar tests que ya existían: tests/a.test.js (Q1)" \
  && ok "«(recomendado)» marca la recomendada y «esto lanzará» no sale vacío" || bad "recomendado: $o"
sed -i.bak 's/ (recomendado)//' "$f"; rm -f "$f.bak"
o=$(python3 -c "import sys; sys.path.insert(0, '$ROOT/plugin/hermes-sdd'); import hsdd_textos as T; from pathlib import Path; print(T.preguntas([Path('$f')]))")
echo "$o" | grep -q "A) .*⭐ recomendada" && ! echo "$o" | grep -q "esto lanzará: \.$" \
  && ok "sin marca, la primera es la recomendada (como los botones Q)" || bad "sin marca: $o"
# «Se ve:» con una aclaración entre paréntesis (que cita otros textos): ni pantalla rota ni «Marta» como texto de la web;
# y un criterio con varios retoques se enseña entero antes y después, no como una lista de palabras (taller, INT-003)
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "«Se ve» sin aclaraciones entre paréntesis; criterio con varios retoques, entero" || bad "paréntesis / varios retoques"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
t = """### REQ-F-004: x
  - GIVEN a WHEN b THEN c
    - Se ve: "Apuntados: 1 de 2" en la vista de la organizadora (no hay texto de plazas libres; "Marta" recibe "Tienes plaza, Marta")
    - Se ve: "No puedes dejar menos plazas ({plazas}) que personas apuntadas ({n})" en la vista de la organizadora
"""
w = T.textos_web(t)
assert [(x["pantalla"], x["texto"]) for x in w] == [("la vista de la organizadora", "Apuntados: 1 de 2"),
    ("la vista de la organizadora", "No puedes dejar menos plazas ({plazas}) que personas apuntadas ({n})")], w
a = "GIVEN 2 plazas WHEN Pablo se da de baja THEN hay 1 persona apuntada y 1 plaza libre"
b = "GIVEN 2 plazas WHEN Pablo se da de baja THEN hay 1 persona apuntada de 2 plazas, y una persona nueva recibe plaza"
assert T._n_cambios(a, b) > 1 and T._n_cambios(a, a.replace("libre", "vacía")) == 1
PY
# Datos del ejemplo no son textos de la web (compra-piso): lo que el GIVEN/WHEN cita y los casos de una plantilla que
# también se enseña se quitan; un texto fijo que además sale en un GIVEN de otro criterio, no
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "«Esto dirá la web» sin datos del ejemplo («Leche», «Añadido por Lucía»)" || bad "datos del ejemplo en la web"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
t = """### REQ-F-001: x
  - GIVEN "Leche" added by Lucía WHEN Pablo opens the list THEN the user sees "Leche" "Añadido por Lucía"
    - Se ve: "Leche", "Añadido por Lucía" en Lista
  - GIVEN a list WHEN Ana adds "Pan" THEN the user sees "Añadido por {nombre}" and "Pendiente"
    - Se ve: "Añadido por {nombre}", "Pendiente" en Lista
  - GIVEN "Pendiente" products WHEN x THEN the user sees "Pendiente"
    - Se ve: "Pendiente" en Lista
"""
assert [x["texto"] for x in T.textos_web(t)] == ["Añadido por {nombre}", "Pendiente"], T.textos_web(t)
PY
# endurecer-test: lo puede elegir Jev (editar-test no); la puerta lo enseña con 🔩 y sin ficheros es un error
f2="$T/q-end.md"; cat > "$f2" <<'Q'
## Q-x-040 [OPEN] skill=sdd-task-implementer
Question: ¿Se refuerza la prueba?
Para el cliente: ¿Hacemos que la prueba compruebe todo lo que pide el criterio?
Options:
  A) Sí (recomendada)
     efecto: endurecer-test tests/e2e/a.spec.js
  B) No
     efecto: ninguno
Answer:
Q
python3 - "$ROOT/plugin/hermes-sdd" "$f2" <<'PY' && ok "endurecer-test: Jev puede elegirlo, se enseña con 🔩 y autoriza solo endurecer" || bad "endurecer-test"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
f = Path(sys.argv[2]); b = T.bloques_preguntas([f])["Q-x-040"]
assert T.errores_pregunta(b) == [], T.errores_pregunta(b)
p = {"tipo": "preguntas", "preguntas": [{"n": 1, "id": "Q-x-040", **T.opciones_json(b)}]}
assert T.validar_respuestas(p, [f], "Q1: A", "respondo", False) == [], T.validar_respuestas(p, [f], "Q1: A", "respondo", False)
assert "🔩 autoriza endurecer tests/e2e/a.spec.js" in T.preguntas([f])
assert "se autoriza ENDURECER" in T.accion_respuesta(b, "A")
PY
# un efecto mal escrito («efecto: --adversarial …») no invalida la decisión (antes la puerta de entrega del taller quedó
# en error al descartar impugnaciones): se aplica como trabajo y nunca autoriza editar tests
f="$T/q-raro.md"; cat > "$f" <<'Q'
## Q-x-003 [OPEN] skill=sdd-acceptance
Question: ¿Verificar de nuevo?
Para el cliente: ¿Lo vuelve a mirar la revisión independiente?
Options:
  A) Verificar de nuevo (recomendada)
     efecto: --adversarial --fase 0 (agentes de verificación)
  B) Descartar
     efecto: ninguno
Q
python3 - "$ROOT/plugin/hermes-sdd" "$f" <<'PY' && ok "efecto mal escrito: no invalida la decisión, se aplica como trabajo y no autoriza tests" || bad "efecto mal escrito"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
f = Path(sys.argv[2]); b = T.bloques_preguntas([f])["Q-x-003"]
p = {"preguntas": [{"n": 1, "id": "Q-x-003", **T.opciones_json(b)}]}
for verbo in ("acepto", "descarto", "rechazo"):
    assert T.validar_respuestas(p, [f], "Q1: A" if verbo == "rechazo" else "", verbo, True) == [], verbo
assert T.accion_respuesta(b, "A") and T.efecto(b, "A")["efecto"] != "editar-test"
PY
# taller2: retirados por el título, casos numéricos juntos en una plantilla y «1. Marta» fuera de la web, lo hecho
# antes del plan por el estado de cada etapa, y al aceptar con una Q cambiada las demás valen con su recomendada
python3 - "$ROOT/plugin/hermes-sdd" "$T" <<'PY' && ok "taller2: retirados, plantillas numéricas, «hecho antes» por estado y recomendadas al aceptar" || bad "arreglos de taller2"
import sys, json; sys.path.insert(0, sys.argv[1]); import hsdd_textos as T
from pathlib import Path
assert T.retirado("(deprecated) Sin red") and T.retirado("[obsoleto] x") and T.retirado("x", "- **Status:** Deprecated")
assert not T.retirado("Sin red", "- **Statement:** a")
md = """### REQ-F-001: x
  - GIVEN "Marta" waits WHEN x THEN the user sees "Apuntados (0 de 2 plazas)"
    - Se ve: "Apuntados (0 de 2 plazas)", "1. Marta" en Organización
  - GIVEN "Sergio" waits WHEN x THEN the user sees "Apuntados (2 de 2 plazas)"
    - Se ve: "Apuntados (2 de 2 plazas)", "Lista de espera" en Organización
"""
w = [(x["texto"], x["ejemplo"]) for x in T.textos_web(md)]
assert w == [("Apuntados ({n} de {n} plazas)", "Apuntados (0 de 2 plazas)"), ("Lista de espera", "")], w
R = Path(sys.argv[2]) / "hecho"; (R / "design").mkdir(parents=True); (R / "spec/use-cases").mkdir(parents=True)
(R / "pipeline-state.json").write_text(json.dumps({"stages": {"specifications-engineer": {"status": "done"}, "tech-designer": {"status": "skipped"}}}))
assert T._hecho_antes(R) == "📐 Antes del plan se hizo: especificaciones. El plan parte de esos documentos.", T._hecho_antes(R)
qs = [{"n": 1, "id": "Q-1", "opciones": ["A", "B"], "recomendada": "A", "efectos": {}}, {"n": 2, "id": "Q-2", "opciones": ["A", "B"], "recomendada": "A", "efectos": {}}]
res, errs, modo = T.plan_respuestas({"tipo": "requisitos", "preguntas": qs}, [], "", "acepto", {"1": "B"})
assert sorted((r["q"]["n"], r["letra"], r["como"]) for r in res) == [(1, "B", "elegida por"), (2, "A", "opción recomendada, aceptada por")], res
res, _, _ = T.plan_respuestas({"tipo": "requisitos", "preguntas": qs}, [], "", "cambios", {"1": "B"})
assert [r["q"]["n"] for r in res] == [1], res
PY
exit $fail
