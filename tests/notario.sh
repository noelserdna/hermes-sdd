#!/usr/bin/env bash
# El notario (firmar.sh) sobre un repo de prueba, sin LLM ni kanban.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }

R="$T/repo"; cp -R "$ROOT/metodo/examples/todo-app" "$R"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json; printf "pipeline-state.json\n.sdd/\n" >> .gitignore
sed -i '' -E 's/^> \*\*Status:\*\*.*/> **Status:** Review/' requirements/REQUIREMENTS.md
git add -A && git commit -qm "chore: toy project"
cat > "$HERMES_SDD_HOME/aprobadores.json" <<J
{"andres": {"nombre": "Andrés León", "rol": "Cliente", "canales": {"telegram": "111", "local": "tester"}}}
J
ahora() { date -u +%Y-%m-%dT%H:%M:%SZ; }
puerta() {  # puerta <id> <tipo> [fase]
  mkdir -p .sdd/hermes/puertas
  jq -n --arg t "$2" --arg f "${3:-}" --arg s "$(git rev-parse HEAD)" --arg c "2000-01-01T00:00:00Z" \
    '{tipo:$t, fase:$f, tablero:"", tarjeta:"", sha:$s, creada:$c}' > ".sdd/hermes/puertas/$1.json"; }
decidir() {  # decidir <id> <verbo> <canal> <idcanal> [texto]
  mkdir -p .sdd/hermes/decisiones
  jq -n --arg v "$2" --arg c "$3" --arg i "$4" --arg x "${5:-}" --arg a "$(ahora)" \
    '{verbo:$v, texto:$x, actor:{persona:"andres", canal:$c, id:$i}, prueba:{msg:"42"}, at:$a}' > ".sdd/hermes/decisiones/$1.json"; }
firmar() { out=$(bash "$ROOT/firmar.sh" "$R" "$1" 2>&1); rc=$?; }

# 1. identidad no autorizada
puerta g1 requisitos; decidir g1 acepto telegram 999; firmar g1
[ $rc -ne 0 ] && echo "$out" | grep -q "no es una identidad autorizada" && ok "rechaza una identidad no autorizada" || bad "identidad: $out"
# 2. commit distinto del mostrado
rm -f "$HERMES_SDD_HOME/actas/local/g2.json"; puerta g2 requisitos
git commit -q --allow-empty -m "chore: otro commit"; decidir g2 acepto telegram 111; firmar g2
[ $rc -ne 0 ] && echo "$out" | grep -q "no es el commit mostrado" && ok "rechaza si HEAD no es el commit mostrado" || bad "sha: $out"
# 3. aprobar requisitos
puerta g3 requisitos; decidir g3 acepto telegram 111; firmar g3
[ $rc -eq 0 ] && ok "aprueba requisitos ($out)" || bad "aprobar: $out"
git tag -l 'requirements-v*' | grep -q . && ok "crea el tag requirements-v*" || bad "sin tag"
git tag -n20 -l 'requirements-v*' | grep -q "Approved-by: Andrés León" && ok "tag con Approved-by" || bad "tag sin Approved-by"
git tag -n20 -l 'requirements-v*' | grep -q "Channel: telegram:111 msg:42" && ok "tag con el canal y la prueba" || bad "tag sin canal"
grep -q '^> \*\*Status:\*\* Approved' requirements/REQUIREMENTS.md && ok "REQUIREMENTS.md en Approved" || bad "Status no cambia"
grep -q "^> \*\*Approved by:\*\* Andrés León (Cliente)" requirements/REQUIREMENTS.md && ok "Approved by sustituye al anterior" || bad "Approved by no se sustituye"
git log -1 --format=%B | grep -q "Gate-Id: g3" && ok "commit con trailer Gate-Id" || bad "commit sin Gate-Id"
# 4. idempotencia: repetir no duplica
n1=$(git rev-list --count HEAD); firmar g3; n2=$(git rev-list --count HEAD)
[ $rc -eq 0 ] && [ "$n1" = "$n2" ] && ok "repetir la firma no crea nada nuevo" || bad "no idempotente (${n1}→${n2}, $out)"
# 5. retomar a mitad: simular corte tras 'registrado'
puerta g5 plan; decidir g5 conforme local tester; mkdir -p "$HERMES_SDD_HOME/actas/local"
jq -n '{puerta:"g5", pasos:["validado","registrado"], rol:"Cliente", nombre:"Andrés León", head:"x"}' > "$HERMES_SDD_HOME/actas/local/g5.json"
nj=$(wc -l < status/journal.jsonl 2>/dev/null || echo 0); firmar g5; nj2=$(wc -l < status/journal.jsonl 2>/dev/null || echo 0)
[ $rc -eq 0 ] && [ "$nj" = "$nj2" ] && ok "retoma tras un corte sin repetir el registro" || bad "retomar: $out (${nj}→${nj2})"
# 6. aceptar una FASE sin puerta de calidad cumplida → solo rechazo
puerta g6 fase 0; decidir g6 acepto telegram 111; firmar g6
[ $rc -ne 0 ] && echo "$out" | grep -q "solo se admite rechazo" && ok "no acepta FASE con gate≠0/3" || bad "gate: $out"
# 7. verbo inválido y texto obligatorio
puerta g7 fase 0; decidir g7 rechazo telegram 111; firmar g7
[ $rc -ne 0 ] && echo "$out" | grep -q "necesita un texto" && ok "rechazo exige motivo" || bad "texto: $out"
# 8. preguntas: la elegida se escribe aunque falte la línea Answer: y sin pegar una pregunta con la siguiente
cat > .sdd/questions-x.md <<'Q'
# Questions

## Q-x-001 [OPEN] skill=x
Question: ¿uno?
  A) a (recommended)
  B) b
Answer:

## Q-x-002 [OPEN] skill=x
Question: ¿dos?
  A) a (recommended)
  B) b
Blocks: nada
Q
puerta g8 plan; decidir g8 conforme telegram 111 "Q1: A, Q2: B"; firmar g8
grep -q "^Answer: A — elegida" .sdd/questions-x.md && grep -q "^Answer: B — elegida" .sdd/questions-x.md \
  && [ "$(grep -c '^## Q-x-00[12] \[ANSWERED\]' .sdd/questions-x.md)" = 2 ] \
  && ok "escribe la respuesta elegida aunque falte la línea Answer:" || bad "preguntas: $(cat .sdd/questions-x.md | tr '\n' '|')"
# 9. el motivo de "cambios" en el plan queda en el diario
puerta g9 plan; decidir g9 cambios telegram 111 "FASE-2 antes que FASE-1"; firmar g9
grep -q "FASE-2 antes que FASE-1" status/journal.jsonl && ok "el motivo de cambios queda en el diario" || bad "diario: $out"
exit $fail
