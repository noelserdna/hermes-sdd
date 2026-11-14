#!/usr/bin/env bash
# Fidelidad (hsdd_fidelidad.py): tests congelados que se cambian sin que una persona lo autorice, señales de
# debilitamiento, ejemplos que se contradicen y el OCR de una captura. Casos sacados de sala (12-13/11/2026).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
F="$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
R="$T/r"; mkdir -p "$R/tests" "$R/requirements" "$R/.sdd"; cd "$R"
git init -q -b main; git config user.email t@t; git config user.name t; git config commit.gpgsign false

cat > tests/reglas.test.js <<'J'
it('REQ-F-003 AC1 dos reservas por semana', () => {
  expect(limite(2)).toBe(true)
  expect(limite(1)).toBe(false)
})
J
git add -A; git commit -qm "test: reglas"; git tag fase-0-accepted

# 1. en una FASE posterior, sin pregunta que lo autorice: se quita la cita del criterio y una aserción, y se salta
cat > tests/reglas.test.js <<'J'
it.skip('dos reservas por semana', () => {
  expect(limite(2)).toBe(true)
})
J
git commit -qam "test(reglas): ajuste"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '.congelados[0] | .autorizado == false and .grave and (.debilitamiento | any(test("deja de citar REQ-F-003 AC1"))) and (.debilitamiento | any(test("saltado"))) and (.debilitamiento | any(test("quita 1 aserción")))' >/dev/null \
  && ok "test congelado cambiado sin autorizar: deja de citar el criterio, quita una aserción y se salta" || bad "congelados: $o"

# 2. autorizado por una persona → autorizado; por Jev → no
printf '## Q-task-implementer-001 [ANSWERED]\nQuestion: ¿Se ajusta?\nAnswer: A — elegida por Ana (Cliente) (2026-11-13)\n\n## Q-task-implementer-002 [ANSWERED]\nQuestion: ¿Y este?\nAnswer: A — elegida por Jev (jev-1.14.0) (Agente automático (modo auto)) (2026-11-13)\n' > .sdd/questions-task-implementer.md
git tag fase-1-accepted
printf "it('REQ-F-003 AC1 x', () => { expect(limite(2)).toBe(true) })\n" > tests/reglas.test.js
git commit -qam "test(reglas): localizador exacto" -m "Autoriza: Q-task-implementer-001 (REQ-F-003)"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto | test("localizador"))][0] | .autorizado and (.autorizacion | test("Ana"))' >/dev/null \
  && ok "con una pregunta contestada por una persona, el cambio está autorizado (REQ-F-003 no se confunde con una pregunta)" || bad "autorizado: $o"
git tag fase-2-accepted
printf "it('REQ-F-003 AC1 y', () => { expect(limite(3)).toBe(true) })\n" > tests/reglas.test.js
git commit -qam "test(reglas): otro" -m "Autoriza: Q-task-implementer-002"
o=$(python3 "$F" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto | test("otro"))][0] | .autorizado == false and (.autorizacion | test("Jev"))' >/dev/null \
  && ok "Jev no puede autorizar editar un test (art. 12)" || bad "jev: $o"

# 3. coherencia: un ejemplo que dice tener 8 caracteres y tiene 7, y un día de la semana que no es
printf '### REQ-NF-003: Contraseñas\n- GIVEN la contraseña «haya-27» (8 caracteres) THEN entra\n- GIVEN el jueves 2026-11-13 THEN nada\n' > requirements/REQUIREMENTS.md
o=$(python3 "$F" coherencia "$R" --json)
echo "$o" | jq -e '[.coherencia[].detalle] | (any(test("«haya-27» dice tener 8 caracteres y tiene 7"))) and (any(test("2026-11-13 no es jueves")))' >/dev/null \
  && ok "coherencia: «haya-27» (8 caracteres) y «jueves 2026-11-13» no cuadran" || bad "coherencia: $o"

# 4. normalización para el OCR: «2ºB» y lo que lee el OCR («2°B»), guiones y tildes
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "normalización: «2ºB» = «2°B», «18:00–19:00» = «18:00-19:00», tildes" || bad "normalización"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
assert F.norm("Vivienda 2ºB") == F.norm("Vivienda 2°B")
assert F.norm("18:00–19:00") == F.norm("18:00-19:00")
assert F.norm("Día Cancelada") == "dia cancelada"
PY

# 4b. mutantes: el texto se cambia en el código, nunca en los comentarios (sala: «5ºC» solo estaba en un comentario)
python3 - "$ROOT/plugin/hermes-sdd" <<'PY' && ok "mutantes: cambian el texto en el código y no en los comentarios" || bad "mutar"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
src = "// «5ºC» y «5ºc» son distintas\nconst t = 'Ocupada';\n  * Ocupada en el comentario\n"
m = F._muta(src, "Ocupada")
assert "const t = 'MUTANTE'" in m and "* Ocupada en el comentario" in m, m
assert F._visibles("GIVEN «4ºA» WHEN «2ºB» abre esa semana THEN el usuario ve la celda con la etiqueta «Ocupada»") == ["Ocupada"]
v = F._visibles('GIVEN "Iniciación" has 3 socios WHEN the socio "pablo" signs up THEN the user sees "Te has apuntado a Iniciación" (the same text as for "lucia"), and WHEN "pablo" signs up again THEN the user sees the message "Ya te habías apuntado a esta clase"')
assert v == ["Te has apuntado a Iniciación", "Ya te habías apuntado a esta clase"], v
assert F._visibles('GIVEN "carmen" has noviembre 2026 unpaid WHEN the administrador downloads that CSV THEN "carmen" does not appear') == []
assert F._visibles('GIVEN pablo WHEN abre Socios THEN ve el mensaje «No tienes permiso para hacer esto»') == ["No tienes permiso para hacer esto"]
PY

# 5. OCR de verdad (solo en macOS): una imagen con texto
if command -v swiftc >/dev/null && command -v sips >/dev/null; then
  cat > "$T/img.swift" <<'S'
import AppKit
let img = NSImage(size: NSSize(width: 420, height: 90)); img.lockFocus()
NSColor.white.setFill(); NSRect(x: 0, y: 0, width: 420, height: 90).fill()
("Vivienda 2ºB · Ocupada" as NSString).draw(at: NSPoint(x: 10, y: 30), withAttributes: [.font: NSFont.systemFont(ofSize: 28)])
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!; try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
S
  swift "$T/img.swift" "$T/c.png" 2>/dev/null
  python3 - "$ROOT/plugin/hermes-sdd" "$T/c.png" <<'PY' && ok "OCR: lee «Vivienda 2ºB» y «Ocupada» en una captura" || bad "ocr"
import sys; sys.path.insert(0, sys.argv[1]); import hsdd_fidelidad as F
from pathlib import Path
t = F.norm(F.ocr(Path(sys.argv[2])))
assert F.norm("Vivienda 2ºB") in t and "ocupada" in t, t
PY
fi
exit $fail
