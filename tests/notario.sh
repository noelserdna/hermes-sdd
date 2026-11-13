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
sed -i.bak -E 's/^> \*\*Status:\*\*.*/> **Status:** Review/' requirements/REQUIREMENTS.md && rm -f requirements/REQUIREMENTS.md.bak
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
gemelo() {  # lo que haría un canal: la misma decisión en el índice de puertas de Hermes (el notario los compara)
  local f="$HERMES_SDD_HOME/puertas/$1.json"; mkdir -p "$HERMES_SDD_HOME/puertas"
  [ -f "$f" ] || cp ".sdd/hermes/puertas/$1.json" "$f"
  jq --slurpfile d ".sdd/hermes/decisiones/$1.json" --arg r "$R" '.repo = $r | .estado = "decidida" | .decision = $d[0]' "$f" > "$f.t" && mv "$f.t" "$f"; }
firmar() { gemelo "$1"; out=$(bash "$ROOT/firmar.sh" "$R" "$1" 2>&1); rc=$?; }

# 0. decisiones fabricadas en el repo (una etapa puede escribir ahí, no en ~/.hermes): el notario no las firma
puerta f1 requisitos; decidir f1 acepto telegram 111; out=$(bash "$ROOT/firmar.sh" "$R" f1 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "no está en el índice de puertas" && ok "no firma una decisión sin su gemelo en el índice de Hermes" || bad "fabricada: $out"
puerta f2 requisitos; decidir f2 cambios telegram 111 "otra"; gemelo f2; decidir f2 acepto telegram 111
out=$(bash "$ROOT/firmar.sh" "$R" f2 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "no coincide con la que registró un canal" && ok "no firma si la decisión del repo no es la que registró el canal" || bad "cambiada: $out"
rm -f .sdd/hermes/decisiones/f1.json .sdd/hermes/decisiones/f2.json
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
e=$(grep '"puerta":"g3"' .sdd/hermes/puertas.jsonl 2>/dev/null | tail -1)
echo "$e" | jq -e '.tipo == "requisitos" and .verbo == "acepto" and .persona == "andres" and .canal == "telegram" and (.segundos_hasta_decidir > 0)' >/dev/null \
  && ok "puertas.jsonl: la puerta firmada queda registrada (quién, canal y cuánto tardó)" || bad "puertas.jsonl: $e"
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
# 6b. «🟡 Aceptar sin lo que falta»: exime los Must sin cumplir con el motivo de la persona y una referencia de
# seguimiento (<PROYECTO>-N) en acceptance/PENDIENTES.md; la puerta de calidad sale entonces con 3 y se acepta
exime() { t=$(mktemp); jq '.opciones = [{verbo:"eximo", etiqueta:"🟡 Aceptar sin lo que falta", texto:true}, {verbo:"rechazo", etiqueta:"❌", texto:true}]' \
  ".sdd/hermes/puertas/$1.json" > "$t" && mv "$t" ".sdd/hermes/puertas/$1.json"; }
puerta g6j fase 0; exime g6j; decidir g6j eximo telegram 111 "lo pruebo yo"
gemelo g6j; t=$(mktemp); jq '.decision.actor = {persona:"jev", canal:"jev", id:"x"}' "$HERMES_SDD_HOME/puertas/g6j.json" > "$t" && mv "$t" "$HERMES_SDD_HOME/puertas/g6j.json"
jq '.actor = {persona:"jev", canal:"jev", id:"x"}' .sdd/hermes/decisiones/g6j.json > "$t" && mv "$t" .sdd/hermes/decisiones/g6j.json
out=$(bash "$ROOT/firmar.sh" "$R" g6j 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "la firma una persona, no Jev" && ok "una exención no la firma Jev" || bad "jev exime: $out"
puerta g6s fase 0; decidir g6s eximo telegram 111 "x"; firmar g6s
[ $rc -ne 0 ] && echo "$out" | grep -q "no ofrecía 🟡" && ok "eximir solo si la puerta lo ofrecía" || bad "sin opción: $out"
puerta g6v fase 0; exime g6v; decidir g6v eximo telegram 111 "sin vídeo"; firmar g6v
[ $rc -ne 0 ] && echo "$out" | grep -q "missing video" && [ -z "$(git status --porcelain --untracked-files=no)" ] && [ ! -f acceptance/PENDIENTES.md ] \
  && ! grep -q '"followUp"' acceptance/decisions.jsonl 2>/dev/null \
  && ok "si aun eximiendo falta algo (el vídeo de la demo), no deja nada registrado y solo cabe rechazar" || bad "sin vídeo: $out $(git status --short)"
mkdir -p evidencias/FASE-0; head -c 2000 /dev/urandom > evidencias/FASE-0/FASE-0-demo.mp4
cat > .sdd/questions-x.md <<'Q'
## Q-x-020 [OPEN] skill=sdd-task-implementer
Question: El test antiguo no lleva los literales
Options:
  A) Una persona lo ajusta o lo retira por duplicado (recommended)
  B) Dejarlo como está
Answer:
Q
puerta g6b fase 0; exime g6b; decidir g6b eximo telegram 111 "el login lo pruebo yo en la reunión"; firmar g6b
P=acceptance/PENDIENTES.md
[ $rc -eq 0 ] && echo "$out" | grep -q "FASE-0 aceptada" && echo "$out" | grep -q "con exenciones (REPO-1" \
  && grep -q '^| REPO-1 | REQ-' "$P" && grep -q "el login lo pruebo yo en la reunión" "$P" && grep -q "| g6b | abierto |" "$P" \
  && grep -q '"followUp":"REPO-1"' acceptance/decisions.jsonl && git tag -l | grep -q '^fase-0-accepted$' \
  && ok "eximir: waiver con su seguimiento, PENDIENTES.md y la FASE aceptada" || bad "eximir: $out $(cat "$P" 2>/dev/null | tail -3)"
grep -q "Respuesta elegida: A) Una persona lo ajusta" .sdd/hermes/respuestas-por-aplicar-g6b.txt 2>/dev/null \
  && ok "aceptar una FASE con una respuesta que pide un ajuste: queda apartada para aplicarla" || bad "respuestas por aplicar: $(cat .sdd/hermes/respuestas-por-aplicar-g6b.txt 2>&1)"
n=$(grep -c '^| REPO-' "$P"); firmar g6b
[ $rc -eq 0 ] && [ "$(grep -c '^| REPO-' "$P")" = "$n" ] && ok "repetir la firma no duplica exenciones" || bad "duplica: $out"
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
# 8b. hay skills que marcan la recomendada con una estrella («B★)») en vez de «(recommended)»
cat > .sdd/questions-x.md <<'Q'
## Q-x-003 [OPEN] skill=x
Question: ¿tres?
  A) a
  B★) b
Answer:

## Q-x-004 [OPEN]
Question: ¿cuatro?
Options: [A] a  [B] b (recomendada)
Answer:
Q
puerta g8b plan
decidir g8b conforme telegram 111; firmar g8b
[ "$(grep -c "^Answer: B — opción recomendada" .sdd/questions-x.md)" = 2 ] && ok "«B★)» y «[B] … (recomendada)»: al firmar se contesta la recomendada (B)" || bad "firmada: $(tr '\n' '|' < .sdd/questions-x.md)"
# 8c. una respuesta que pide cambiar los requisitos: al dar conformidad se lanza un cambio (/cambio) en vez del tramo
# siguiente; con kanban falso para ver qué tarjetas se crean
mkdir -p "$T/bin"; : > "$T/klog"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
echo "\$*" >> "$T/klog"
case "\$*" in *"boards list"*) echo '[{"slug":"repo"}]' ;; *" create "*) echo '{"id":"t_9"}' ;; esac
H
chmod +x "$T/bin/hermes"
cat > .sdd/questions-x.md <<'Q'
## Q-x-005 [OPEN] skill=x
Question: Cuatro reglas del cliente no están en REQUIREMENTS.md
Options:
  A) Añadir cuatro REQ con `sdd-req-change` (recommended)
  B) Quitarlas de `spec/`
Answer:
Q
puerta g8c plan; t=$(mktemp); jq '.tablero = "repo" | .tarjeta = "t_1" | .titulo = "Plan por fases"' .sdd/hermes/puertas/g8c.json > "$t" && mv "$t" .sdd/hermes/puertas/g8c.json
decidir g8c conforme telegram 111; PATH="$T/bin:$PATH" firmar g8c
I=$(ls intent/INT-*.md 2>/dev/null | tail -1)
[ $rc -eq 0 ] && [ -n "$I" ] && grep -q "Añadir cuatro REQ" "$I" && grep -q "Q-x-005" "$I" && grep -q "Cambio INT-" "$T/klog" \
  && ! grep -q "Implementar FASE" "$T/klog" && echo "$out" | grep -q "lanza un cambio de requisitos" \
  && ok "respuesta «Añadir REQ con sdd-req-change»: lanza un cambio de requisitos y no el tramo siguiente" || bad "cambio por respuesta: $out $(cat "$T/klog")"
# … y una respuesta que no pide cambio sigue con el tramo de siempre
cat > .sdd/questions-x.md <<'Q'
## Q-x-006 [OPEN] skill=x
Question: ¿Cómo se resuelve?
Options: [A] enmendar el criterio (recomendada)  [B] dejarlo
Answer:
Q
: > "$T/klog"; n0=$(ls intent | wc -l)
puerta g8d plan; t=$(mktemp); jq '.tablero = "repo" | .tarjeta = "t_2"' .sdd/hermes/puertas/g8d.json > "$t" && mv "$t" .sdd/hermes/puertas/g8d.json
decidir g8d conforme telegram 111 "Q1: B"; PATH="$T/bin:$PATH" firmar g8d
[ $rc -eq 0 ] && [ "$(ls intent | wc -l)" = "$n0" ] && ! grep -q "Cambio INT-" "$T/klog" \
  && ok "eligiendo «dejarlo» no se lanza ningún cambio" || bad "sin cambio: $out $(cat "$T/klog")"
# 8e. puerta «Preguntas de la FASE-N» (la implementación se paró en preguntas [OPEN]): responder con la recomendada
# rehace la FASE con tarjetas nuevas; si la respuesta pide cambiar requisitos, se lanza el cambio
cat > .sdd/questions-x.md <<'Q'
## Q-x-007 [OPEN] skill=sdd-task-implementer
Question: ¿Qué contraseña usa la demo?
Options:
  A) La de siempre (recommended)
  B) Otra
Answer:
Q
: > "$T/klog"; puerta g8e preguntas 5; t=$(mktemp); jq '.tablero = "repo" | .tarjeta = "t_5" | .titulo = "Preguntas de la FASE-5"' .sdd/hermes/puertas/g8e.json > "$t" && mv "$t" .sdd/hermes/puertas/g8e.json
decidir g8e respondo telegram 111; PATH="$T/bin:$PATH" firmar g8e
[ $rc -eq 0 ] && grep -q "^Answer: A — opción recomendada" .sdd/questions-x.md && grep -q "create Implementar FASE-5 (respuestas)" "$T/klog" \
  && ok "preguntas de una FASE: responder contesta y rehace la FASE" || bad "preguntas: $out $(cat "$T/klog")"
cat > .sdd/questions-x.md <<'Q'
## Q-x-008 [OPEN] skill=sdd-task-implementer
Question: «haya-27» no tiene 8 caracteres
Options:
  A) Enmendar el literal a «haya-027» (req-change) (recommended)
  B) Dejarlo
Answer:
Q
: > "$T/klog"; puerta g8f preguntas 5; t=$(mktemp); jq '.tablero = "repo" | .tarjeta = "t_6" | .titulo = "Preguntas de la FASE-5"' .sdd/hermes/puertas/g8f.json > "$t" && mv "$t" .sdd/hermes/puertas/g8f.json
decidir g8f respondo telegram 111; PATH="$T/bin:$PATH" firmar g8f
I=$(ls -t intent/INT-*.md | head -1)
[ $rc -eq 0 ] && grep -q "haya-027" "$I" && grep -q "Cambio INT-" "$T/klog" && ! grep -q "Implementar FASE-5" "$T/klog" \
  && ok "preguntas de una FASE: una respuesta (req-change) lanza el cambio, no la FASE" || bad "preguntas req-change: $out $(cat "$T/klog")"
# 8g. lanzar.sh respuestas: primero la tarjeta que aplica las respuestas; el tramo siguiente cuelga de ella
: > "$T/klog"; puerta g8g fase 0; t=$(mktemp); jq '.titulo = "Aceptar FASE-0"' .sdd/hermes/puertas/g8g.json > "$t" && mv "$t" .sdd/hermes/puertas/g8g.json
PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" respuestas "$R" g8g acepto >/dev/null 2>&1
head -1 "$T/klog" | grep -q "create Aplicar respuestas (Aceptar FASE-0)" && [ "$(sed -n 2p "$T/klog" | grep -c -- '--parent t_9')" = 1 ] \
  && ok "respuestas: se aplican antes y el tramo siguiente las espera" || bad "lanzar respuestas: $(cat "$T/klog")"
# 9. el motivo de "cambios" en el plan queda en el diario
puerta g9 plan; decidir g9 cambios telegram 111 "FASE-2 antes que FASE-1"; firmar g9
grep -q "FASE-2 antes que FASE-1" status/journal.jsonl && ok "el motivo de cambios queda en el diario" || bad "diario: $out"
# 10. aprobar requisitos eligiendo una opción distinta de la recomendada no firma: pide cambios con esas respuestas
con_preguntas() {  # con_preguntas <id>: la puerta mostró Q1 (recomendada A) y Q2 (recomendada B)
  t=$(mktemp); jq '.preguntas = [{n:1, id:"Q-r-001", opciones:["A","B"], recomendada:"A"},
                                 {n:2, id:"Q-r-002", opciones:["A","B"], recomendada:"B"}]' \
    ".sdd/hermes/puertas/$1.json" > "$t" && mv "$t" ".sdd/hermes/puertas/$1.json"; }
tags0=$(git tag -l | wc -l)
puerta g10 requisitos; con_preguntas g10; decidir g10 acepto telegram 111 "Q1: B, Q2: B"; firmar g10
[ $rc -eq 0 ] && echo "$out" | grep -q "pide cambios en requisitos" && [ "$(git tag -l | wc -l)" = "$tags0" ] \
  && grep -q "Q-r-001 = B" .sdd/hermes/feedback/requisitos.txt && ! grep -q "Q-r-002" .sdd/hermes/feedback/requisitos.txt \
  && ok "respuesta no recomendada en requisitos: pide cambios, sin tag" || bad "no recomendada: $out"
# 11. dar conformidad al plan con las recomendadas sigue siendo conformidad
puerta g11 plan; con_preguntas g11; decidir g11 conforme telegram 111 "Q1: A, Q2: B"; firmar g11
[ $rc -eq 0 ] && echo "$out" | grep -q "Plan conforme" && ok "con las recomendadas, el plan queda conforme" || bad "recomendadas: $out"
# ── fusión de la rama de la FASE en la rama por defecto al aceptarla (el notario; nunca push) ──────────────────────
F="$T/fusion"; mkdir -p "$F"; cd "$F"; git init -q -b main; g() { git -c user.email=t@t -c user.name=t "$@"; }
g commit -q --allow-empty -m base; git switch -q -c fase-0-base; echo a > a.txt; git add a.txt; g commit -qm "feat: a"
eval "$(sed -n '/^rama_defecto() {/,/^}/p' "$ROOT/firmar.sh")"; FUSION=""
eval "$(sed -n '/^fusionar() {/,/^}/p' "$ROOT/firmar.sh" | sed 's/git merge --no-ff/git -c user.email=t@t -c user.name=t merge --no-ff/')"
FASE=0; GATE=gx; TIPO=fase; fusionar "FASE-0 accepted"
[ "$(git rev-parse --abbrev-ref HEAD)" = main ] && [ -f a.txt ] && git log -1 --format=%s | grep -q "^Merge fase-0-base" && git log -1 --format=%B | grep -q "Gate-Id: gx" \
  && ok "al aceptar la FASE su rama entra en main con un commit de merge y HEAD queda en main ($FUSION)" || bad "fusión: $FUSION $(git log --oneline -3)"
n=$(git rev-list --count HEAD); fusionar "otra vez"; [ "$(git rev-list --count HEAD)" = "$n" ] && ok "fusionar otra vez no crea nada" || bad "fusión repetida"
git switch -q -c fase-1-x; echo b > a.txt; g commit -qam "feat: b"; git switch -q main; echo c > a.txt; g commit -qam "fix: c"; git switch -q fase-1-x
FUSION=""; FASE=1; fusionar "FASE-1 accepted"
[ "$(git rev-parse --abbrev-ref HEAD)" = fase-1-x ] && echo "$FUSION" | grep -q "conflictos" && [ -z "$(git status --porcelain)" ] \
  && ok "con conflictos no fusiona: queda en la rama, el árbol limpio y lo avisa" || bad "conflicto: $FUSION $(git status --short)"
cd "$R"
exit $fail
