#!/usr/bin/env bash
# Ejecutor falso para las pruebas del arnés: hace en el repo lo que diga $FALSO_MODO y devuelve el contrato de
# executors/claude.sh. Se elige con .ejecutores[<etapa>] = "../tests/ejecutor-falso".
set -uo pipefail
cd "$1"; D=acceptance/decisions.jsonl; mkdir -p acceptance
med='{"type":"measurement","at":"2026-10-13T06:07:33Z","by":"command","role":"automated","req":"REQ-F-001","ac":1,"observed":0,"op":"eq","threshold":0,"command":"npm audit","extract":"x=(\\d+)"}'
[ -n "${FALSO_PROMPT:-}" ] && printf '%s' "$3" > "$FALSO_PROMPT"   # lo que se le pidió (para comprobar instrucciones)
case "${FALSO_MODO:-}" in
  medicion) echo "$med" >> "$D" ;;                                   # la CLI la escribió; el ejecutor no pudo commitear
  humano)   echo '{"type":"demo","by":"Ana","role":"Cliente","req":"REQ-F-001","ac":1,"pass":true}' >> "$D"
            git add "$D" && git commit -qm "docs(acceptance): demo" ;; # una decisión humana fabricada, y commiteada
  huecos)   # completa los [PLAN GAP] (como harían plan-architect y task-generator con las respuestas aprobadas)
            for f in task/TASK-FASE-*.md; do sed -i.bak -E 's/^- \[ \] (TASK-[A-Za-z0-9-]+) \[PLAN GAP\] (.*)$/- [ ] \1 \2 | `tests\/e2e\/journey.spec.ts`/' "$f" && rm -f "$f.bak"; done
            git add task && { git diff --cached --quiet || git commit -qm "docs(tasks): gaps"; } ;;
  borra)    sed 's/"observed":0/"observed":1/' "$D" > "$D.tmp" && mv "$D.tmp" "$D" ;;  # reescribe un registro anterior
esac
jq -nc --arg r "${FALSO_RESUMEN:-}" '{outcome:"done", reason:"ok", run:"falso", cost_usd:0, resumen:$r}'  # FALSO_RESUMEN: lo que «dice» el ejecutor
