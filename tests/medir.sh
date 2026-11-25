#!/usr/bin/env bash
# evals/medir/contadores.sh: los contadores sin modelo de la línea base, sobre un proyecto mínimo hecho aquí (con sus
# tags, en un directorio temporal) y sobre material-montana12 del banco. Solo lee: el proyecto queda como estaba.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
C="$ROOT/evals/medir/contadores.sh"
[ -f "$C" ] || { bad "no existe evals/medir/contadores.sh"; exit 1; }
R="$T/proyectos/mini"; mkdir -p "$R/.sdd/hermes" "$R/acceptance" "$R/feedback" "$T/indice"; cd "$R"
git init -q -b main; git config user.email t@t; git config user.name t; git config commit.gpgsign false; git config tag.gpgsign false
printf '.sdd/\n' > .gitignore
cat > .sdd/acceptance.json <<'J'
{"requirements": [
  {"id": "REQ-F-001", "priority": "Must", "verdict": "VERIFIED", "criteria_total": 2, "criteria": [{"n": 1}, {"n": 2}],
   "challenges": [{"id": "CH-001", "state": "stale"}, {"id": "CH-002", "state": "dismissed"}, {"id": "CH-003", "state": "stale"}]},
  {"id": "REQ-F-002", "priority": "Must", "verdict": "FAILING", "criteria_total": 1, "criteria": [{"n": 1}], "challenges": [{"id": "CH-004", "state": "open"}]},
  {"id": "REQ-F-003", "priority": "Should", "verdict": "MISSING", "criteria_total": 3, "criteria": [{"n": 1}, {"n": 2}, {"n": 3}], "challenges": []},
  {"id": "REQ-F-004", "priority": "Must", "verdict": "DEPRECATED", "criteria_total": 5, "criteria": [], "challenges": []}]}
J
# los cuatro formatos de hallazgo que hay en los proyectos reales (tabla, lista, título y viñeta de una línea)
cat > feedback/IMPL-FEEDBACK-FASE-0.md <<'M'
# Implementation Feedback — FASE-0

> Status: PENDING

### IF-0-001: tabla, abierto

| Field              | Value |
|--------------------|-------|
| **Severity**       | BLOCKER |
| **Status**         | OPEN |

> N/A — BLOCKER para el cierre (una frase que nombra la palabra no es otro hallazgo)

### IF-0-002: tabla, resuelto

| **Severity**       | BLOCKER |
| **Status**         | RESOLVED |

### IF-0-003: tabla, aviso abierto

| **Severity**       | WARNING |
| **Status**         | OPEN |

## IF-0-004 — lista
- **Severity:** BLOCKER
- **Status:** OPEN — lo decide la persona

## IF-0-005 — lista sin negrita
- Severity: BLOCKER · Category: CODE-REVIEW · Task: n/a
- Status: OPEN (la persona decide en la puerta)

## IF-0-006 — CODE-REVIEW BLOCKER · Task: n/a
sin estado: nadie lo cerró

## Revisión independiente
- **IF-0-007** BLOCKER CODE-REVIEW, Task: n/a — `server.js:20`: de una línea, sin estado
- **IF-0-008** WARNING CODE-REVIEW, Task: n/a — endurecimiento
M
# los tags de este proyecto de mentira (ninguno es una aprobación de nadie: el repo es temporal y se borra)
etiqueta() { git tag "$@"; }
git add -A; git commit -qm "feat: algo"; etiqueta entrega-1
# después de la entrega se cierra todo: el contador mira el commit del tag, no el disco
sed -i.bak -e 's/| OPEN |/| RESOLVED |/' -e 's/Status:\(\**\) OPEN/Status:\1 RESOLVED/' feedback/IMPL-FEEDBACK-FASE-0.md && rm -f feedback/IMPL-FEEDBACK-FASE-0.md.bak
git commit -qam "docs: hallazgos cerrados"
etiqueta -a entrega-2 -m "Entrega 2
-----BEGIN SSH SIGNATURE-----
(un bloque de firma: el contador mira si lo lleva, no lo verifica; eso es de verificar.sh)
-----END SSH SIGNATURE-----"
etiqueta -a fase-0-accepted -m "FASE-0, anotado y sin firma"; etiqueta requirements-v1.0; etiqueta fase-0-foundation
cat > acceptance/decisions.jsonl <<'J'
{"type":"fase-acceptance","fase":0,"result":"accepted","channel":"local:ana host:h demo:no vista mini/t_1 gate:g1"}
{"type":"fase-acceptance","fase":1,"result":"accepted","channel":"telegram:1 demo:vista 40s mini/t_2 gate:g2"}
{"type":"fase-acceptance","fase":2,"result":"accepted","channel":"local:ana"}
{"type":"test-edit","by":"Ana"}
J
cat > .sdd/hermes/puertas.jsonl <<'J'
{"puerta":"g1","tipo":"fase","verbo":"acepto","canal":"local"}
{"puerta":"g2","tipo":"fase","verbo":"acepto","canal":"telegram"}
{"puerta":"g3","tipo":"fase","verbo":"acepto","canal":"local"}
J
cat > .sdd/hermes/etapas.jsonl <<'J'
{"etapa":"implementar","resultado":"done","minutos":10,"tarjeta":null}
{"etapa":"implementar","resultado":"failed","motivo":"esperando tus respuestas: puerta «Dudas antes del plan»","minutos":0,"tarjeta":null}
{"etapa":"aceptar","resultado":"failed","motivo":"quedan tareas de la FASE-2 sin hacer","minutos":3,"tarjeta":"t_abc"}
{"etapa":"aceptar","resultado":"interrumpida","motivo":"señal TERM","minutos":7,"tarjeta":null}
{"etapa":"aceptar","resultado":"interrumpida","motivo":"señal TERM","minutos":5,"tarjeta":null}
J
echo '{"id":"g1","tipo":"fase","estado":"firmada","decision":{"actor":{"canal":"local"},"prueba":{"demo":"no vista"}}}' > "$T/indice/g1.json"
echo '{"id":"g2","tipo":"fase","estado":"firmada","decision":{"actor":{"canal":"telegram"},"prueba":{"demo":"vista"}}}' > "$T/indice/g2.json"
echo '{"id":"g3","tipo":"entrega","estado":"firmada","decision":{"actor":{"canal":"local"},"prueba":{"demo":"no vista"}}}' > "$T/indice/g3.json"
echo '{"id":"g4","tipo":"fase","estado":"abierta"}' > "$T/indice/g4.json"
huella() { (cd "$R" && git status --porcelain | wc -l | tr -d ' '; git for-each-ref | cksum; find . -type f ! -path './.git/*' | sort | xargs cat | cksum); }
antes=$(huella)

J=$(bash "$C" --json --indice "$T/indice" "$T/proyectos" 2>&1); P=$(jq -c '.proyectos[0]' <<< "$J" 2>/dev/null)
ver() { jq -e "$2" <<< "$P" >/dev/null 2>&1 && ok "$1" || bad "$1: $(jq -c "$3" <<< "$P" 2>/dev/null || echo "$J" | head -3)"; }
ver "criterios totales y Must, sin los requisitos retirados" '.proyecto == "mini" and .criterios == {total: 6, must: 3}' .criterios
ver "veredictos al entregar, y los de los Must" '.veredictos.VERIFIED == 1 and .veredictos.FAILING == 1 and .veredictos.MISSING == 1 and .veredictos.WAIVED == 0 and .veredictos.must == {VERIFIED: 1, FAILING: 1, MISSING: 0, WAIVED: 0}' .veredictos
ver "BLOCKER abiertos en el commit de cada entrega, en los cuatro formatos" '.blocker.entregas == [{tag: "entrega-1", abiertos: 3, sin_estado: 2}, {tag: "entrega-2", abiertos: 0, sin_estado: 2}]' .blocker
ver "BLOCKER en disco (para los proyectos sin git)" '.blocker.en_disco == {abiertos: 0, sin_estado: 2}' .blocker
ver "impugnaciones por estado final; stale = cerradas sin comprobación" '.impugnaciones == {total: 4, open: 1, stale: 2, resolved: 0, dismissed: 1}' .impugnaciones
ver "FASEs firmadas, con «demo: no vista» y sin el dato" '.fases == {firmadas: 3, demo_no_vista: 1, demo_sin_dato: 1}' .fases
ver "firmas por canal" '.firmas == {total: 3, por_canal: {local: 2, telegram: 1}}' .firmas
ver "tags del notario sin firma (ligeros o anotados sin firma); los demás tags no cuentan" '.tags.notario == 4 and .tags.sin_firma == 3 and (.tags.cuales | sort) == ["entrega-1", "fase-0-accepted", "requirements-v1.0"]' .tags
ver "etapas por resultado, esperas a la persona, minutos interrumpidos y tarjeta nula" '.etapas.por_resultado == {done: 1, failed: 2, interrumpida: 2} and .etapas.failed_espera_persona == 1 and .etapas.minutos_interrumpidas == 12 and .etapas.tarjeta_nula == 4 and .etapas.lineas == 5' .etapas
jq -e '.indice == {firmadas: 3, por_canal: {local: 2, telegram: 1}, fases_firmadas: 2, fases_demo_no_vista: 1}' <<< "$J" >/dev/null 2>&1 \
  && ok "índice de puertas: firmadas por canal y FASEs sin ver la demo" || bad "índice: $(jq -c .indice <<< "$J" 2>/dev/null)"
[ "$antes" = "$(huella)" ] && ok "solo lee: el proyecto queda como estaba" || bad "el proyecto cambió"
# la tabla: una fila por proyecto y la de totales
t=$(bash "$C" --indice "$T/indice" "$T/proyectos" 2>&1)
echo "$t" | grep -qE '^mini +6 +3 +1 +1 +1 +0 +5\+2 +4 +2 +3 +1 +3 +2 +4 +3 +5 +2 +1 +12 +4$' && echo "$t" | grep -q '^TOTAL (1)' \
  && ok "tabla: una fila por proyecto y los totales" || bad "tabla: $t"
# sin fichero no hay cero: null (un proyecto sin acceptance.json ni git propio)
mkdir -p "$T/vacio/p/.sdd"; V=$(bash "$C" --json --indice "$T/nada" "$T/vacio" 2>&1)
jq -e '.proyectos[0] | .criterios == null and .impugnaciones == null and .tags == null and .blocker == {entregas: null, en_disco: null} and .etapas == null' <<< "$V" >/dev/null 2>&1 \
  && jq -e '.indice == null' <<< "$V" >/dev/null && ok "lo que no se puede calcular es null, no 0" || bad "vacío: $V"
# el banco (datos reales): los valores del análisis 11 que están en él
M=$(bash "$C" --json --indice "$T/nada" "$ROOT/tests/fixtures/banco" 2>&1 | jq -c '.proyectos[] | select(.proyecto == "material-montana12")' 2>/dev/null)
jq -e '.impugnaciones.total == 12 and .impugnaciones.stale == 9 and .impugnaciones.dismissed == 3' <<< "$M" >/dev/null 2>&1 \
  && ok "montana12 (banco): 9 de 12 impugnaciones cerradas por stale" || bad "montana12 impugnaciones: $(jq -c .impugnaciones <<< "$M" 2>/dev/null)"
jq -e '.fases == {firmadas: 7, demo_no_vista: 7, demo_sin_dato: 0} and .etapas.lineas == 33 and .etapas.tarjeta_nula == 33 and .tags == null' <<< "$M" >/dev/null 2>&1 \
  && ok "montana12 (banco): 7 de 7 FASEs con «demo: no vista» y 33 de 33 etapas sin tarjeta" || bad "montana12: $(jq -c '{fases, etapas, tags}' <<< "$M" 2>/dev/null)"
exit $fail
