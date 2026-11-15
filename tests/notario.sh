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
# La clave del notario de las pruebas (no la de verdad de ~/.ssh): los tags y las actas salen firmados con ella
ssh-keygen -q -t ed25519 -N "" -C notario-prueba -f "$T/notario"
echo "{\"clave_notario\": \"$T/notario\"}" > "$HERMES_SDD_HOME/sdd.json"
cat > "$HERMES_SDD_HOME/aprobadores.json" <<J
{"andres": {"nombre": "Andrés León", "rol": "Cliente", "canales": {"telegram": "111", "local": "tester"}}}
J
ahora() { date -u +%Y-%m-%dT%H:%M:%SZ; }
puerta() {  # puerta <id> <tipo> [fase]   (como puerta.sh: puerta nueva = original del índice nuevo, sin el de otra vez)
  mkdir -p .sdd/hermes/puertas; rm -f "$HERMES_SDD_HOME/puertas/$1.json"
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
# la copia de la puerta en el proyecto (de la que lee el notario) retocada después de mostrarla: no se firma
puerta f3 fase 1; decidir f3 acepto telegram 111; gemelo f3
t=$(mktemp); jq '.tests_editados = 0 | .sha = "0000000"' .sdd/hermes/puertas/f3.json > "$t" && mv "$t" .sdd/hermes/puertas/f3.json
out=$(bash "$ROOT/firmar.sh" "$R" f3 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "no es la que se mostró (cambió: sha,tests_editados)" && ok "no firma si la copia de la puerta del proyecto no es la del índice" || bad "copia retocada: $out"
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
[ "$(grep -c '^> \*\*Ejemplos revisados por:\*\* Andrés León (Cliente)' requirements/REQUIREMENTS.md)" = 1 ] \
  && ok "al aprobar una persona, los ejemplos quedan revisados a su nombre (una sola línea)" || bad "ejemplos revisados: $(grep -n 'Ejemplos' requirements/REQUIREMENTS.md)"
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
# 6a. «🔍 Lo he revisado y acepto» con la puerta de calidad sin cumplir: la inspección no se queda commiteada (antes HEAD
# avanzaba con ella y todo reintento chocaba con «HEAD no es el commit mostrado»)
REQ1=REQ-C-002   # se verifica por inspección solo en esta prueba (y se deja como estaba después)
cp requirements/REQUIREMENTS.md "$T/req.md"
perl -0pi -e 's/(### REQ-C-002.*?- \*\*Verification:\*\*) test[^\n]*/$1 inspection/s' requirements/REQUIREMENTS.md
git commit -qam "test: REQ-C-002 por inspección"
puerta g6r fase 0; t=$(mktemp)
jq --arg r "$REQ1" '.opciones = [{verbo:"revisado", etiqueta:"🔍 Lo he revisado y acepto"}, {verbo:"rechazo", etiqueta:"❌", texto:true}]
  | .revisar = [{id:$r, titulo:"x", como:"inspection"}]' .sdd/hermes/puertas/g6r.json > "$t" && mv "$t" .sdd/hermes/puertas/g6r.json
h0=$(git rev-parse HEAD); d0=$(cat acceptance/decisions.jsonl 2>/dev/null | wc -l)
decidir g6r revisado telegram 111; firmar g6r
[ $rc -ne 0 ] && echo "$out" | grep -q "solo se admite rechazo" && [ "$(git rev-parse HEAD)" = "$h0" ] \
  && [ -z "$(git status --porcelain --untracked-files=no)" ] && [ "$(cat acceptance/decisions.jsonl 2>/dev/null | wc -l)" = "$d0" ] \
  && ok "revisado con la puerta de calidad sin cumplir: no commitea la inspección (HEAD no se mueve, nada a medias)" || bad "revisado: $out $(git log --oneline -2)"
cp "$T/req.md" requirements/REQUIREMENTS.md; git commit -qam "test: REQ-C-002 como estaba"
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
o=$(bash "$ROOT/verificar.sh" "$R" 2>&1); rcv=$?
[ $rcv -eq 0 ] && echo "$o" | grep -q '^OK         tag fase-0-accepted$' && echo "$o" | grep -q '^OK         acta g6b$' \
  && ok "el tag y el acta salen firmados con la clave del notario (verificar.sh)" || bad "firma: $rcv $o"
cp "$HERMES_SDD_HOME/actas/local/g6b.json" "$T/acta.bak"; jq '.resultado = "otra cosa"' "$T/acta.bak" > "$HERMES_SDD_HOME/actas/local/g6b.json"
o=$(bash "$ROOT/verificar.sh" "$R" 2>&1); rcv=$?
[ $rcv -eq 1 ] && echo "$o" | grep -q '^FIRMA MALA acta g6b' && ok "un acta retocada después de firmarla se detecta" || bad "acta retocada: $rcv $o"
cp "$T/acta.bak" "$HERMES_SDD_HOME/actas/local/g6b.json"
ssh-keygen -q -t ed25519 -N "" -C otra -f "$T/otra"
o=$(bash "$ROOT/verificar.sh" "$R" --clave "$T/otra.pub" 2>&1); rcv=$?
[ $rcv -eq 1 ] && echo "$o" | grep -q '^FIRMA MALA tag fase-0-accepted' && ok "con otra clave, la firma no vale (no la puso este notario)" || bad "otra clave: $rcv $o"
grep -q "Respuesta elegida: A) Una persona lo ajusta" .sdd/hermes/respuestas-por-aplicar-g6b.txt 2>/dev/null \
  && ok "aceptar una FASE con una respuesta que pide un ajuste: queda apartada para aplicarla" || bad "respuestas por aplicar: $(cat .sdd/hermes/respuestas-por-aplicar-g6b.txt 2>&1)"
n=$(grep -c '^| REPO-' "$P"); firmar g6b
[ $rc -eq 0 ] && [ "$(grep -c '^| REPO-' "$P")" = "$n" ] && ok "repetir la firma no duplica exenciones" || bad "duplica: $out"
# 7. verbo inválido y texto obligatorio
puerta g7 fase 0; decidir g7 rechazo telegram 111; firmar g7
[ $rc -ne 0 ] && echo "$out" | grep -q "necesita un texto" && ok "rechazo exige motivo" || bad "texto: $out"
# 7b. un motivo de rechazo largo (club FASE-7: 755 caracteres) se firma entero; al diario va recortado
puerta g7b fase 0; largo=$(printf 'La captura no enseña lo que dice el criterio. %.0s' $(seq 1 18)); decidir g7b rechazo telegram 111 "$largo"; firmar g7b
[ $rc -eq 0 ] && [ "${#largo}" -gt 600 ] && tail -1 status/journal.jsonl | jq -e '(.text | length) < 600' >/dev/null \
  && ok "rechazo con un motivo de más de 600 caracteres: se firma y el diario lo recorta" || bad "largo: $out"
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
# 8h. mantenimiento: «🛠 Lanzar cambio» → etapa de mantenimiento y después el cierre (no pasa por requisitos ni plan)
: > "$T/klog"; puerta g8h mantenimiento; mkdir -p .sdd/hermes/mantenimiento; echo "sube vite" > .sdd/hermes/mantenimiento/peticion-g8h.txt
PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" g8h cambio >/dev/null 2>&1
grep -q "create Mantenimiento " "$T/klog" && grep "create Cierre: puerta global y entrega (mantenimiento)" "$T/klog" | grep -q -- "--parent t_9" \
  && ! grep -q "Cambio INT-" "$T/klog" && grep -q "sube vite" .sdd/hermes/mantenimiento/en-curso.txt \
  && ok "mantenimiento: etapa propia y cierre, sin cambio de requisitos" || bad "mantenimiento: $(cat "$T/klog")"
# … un cambio de requisitos aprobado durante un mantenimiento vuelve al mantenimiento (no a Ruta)
: > "$T/klog"; puerta g8i requisitos; PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" g8i aprobado >/dev/null 2>&1
grep -q "create Mantenimiento " "$T/klog" && ! grep -q "create Ruta" "$T/klog" && ok "requisitos aprobados en un mantenimiento: sigue el mantenimiento" || bad "req en mantenimiento: $(cat "$T/klog")"
rm -f .sdd/hermes/mantenimiento/en-curso.txt
# 8j. plan conforme sin FASEs por aceptar (un cambio que no necesitó FASE nueva): al cierre, no a la FASE-0
: > "$T/klog"; puerta g8j plan; PATH="$T/bin:$PATH" bash "$ROOT/lanzar.sh" siguiente "$R" g8j conforme >/dev/null 2>&1
grep -q "create Cierre" "$T/klog" && ! grep -q "Implementar FASE-0" "$T/klog" && ok "plan conforme sin FASEs pendientes: al cierre" || bad "plan sin fases: $(cat "$T/klog")"
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
# 12. las respuestas se leen frente a lo que enseñó la puerta: «De Q2 a Q3 lo recomendado» no es «Q2 = A» (antes la
# regex lo leía así y convertía la conformidad en una petición de cambios) y una letra que no existe rechaza la decisión
puerta g12 plan; con_preguntas g12; decidir g12 conforme telegram 111 "De Q2 a Q3 lo recomendado"; firmar g12
[ $rc -eq 0 ] && echo "$out" | grep -q "Plan conforme" && ok "«De Q2 a Q3 lo recomendado» no se lee como una respuesta" || bad "De Q2 a Q3: $out"
puerta g12b plan; con_preguntas g12b; decidir g12b conforme telegram 111 "Q1: D, Q2: B"; firmar g12b
[ $rc -ne 0 ] && echo "$out" | grep -q "Q1: «D» no es una de sus opciones (A o B)" && ok "«Q1: D» con opciones A y B: rechazada con su motivo (antes se ignoraba)" || bad "Q1: D: $out"
puerta g12c plan; con_preguntas g12c; decidir g12c conforme telegram 111 "Q7: A"; firmar g12c
[ $rc -ne 0 ] && echo "$out" | grep -q "Q7 no existe" && ok "una pregunta que la puerta no tenía: rechazada" || bad "Q7: $out"
# 13. efecto: editar-test → el notario registra la autorización (test-edit, con sus ficheros) y es lo único que
# hsdd_fidelidad acepta; solo esos ficheros, y nunca si decide Jev
mkdir -p tests; printf "it('a', () => { expect(1).toBe(1) })\n" > tests/a.test.js; printf "it('b', () => { expect(1).toBe(1) })\n" > tests/b.test.js
git add tests; git commit -qm "test: a y b"; git tag fase-9-accepted
cat > .sdd/questions-x.md <<'Q'
## Q-x-030 [OPEN] skill=sdd-task-implementer
Question: El literal de a.test.js cambió con REQ-F-001
Para el cliente: ¿Actualizamos la prueba al texto nuevo que aprobaste?
Options:
  A) Sí, cambiar solo el literal (recommended)
     efecto: editar-test tests/a.test.js
  B) No
     efecto: ninguno
Answer:
Q
# 12c. rechazar una FASE sin tocar la pregunta NO autoriza editar el test de la opción recomendada (antes sí: un
#      rechazo dejaba registrado un test-edit que la persona no había elegido)
cp .sdd/questions-x.md "$T/questions-x.md"
puerta g12c fase 9; decidir g12c rechazo telegram 111 "no me convence"; firmar g12c
[ $rc -eq 0 ] && ! jq -se '[.[] | select(.type == "test-edit" and .gate == "g12c")] | length > 0' acceptance/decisions.jsonl >/dev/null 2>&1 \
  && ok "un rechazo sin elegir la opción no autoriza editar tests" || bad "rechazo autorizó: $out $(grep g12c acceptance/decisions.jsonl | head -2)"
cp "$T/questions-x.md" .sdd/questions-x.md   # el rechazo la contestó con la recomendada (sin autorizar): vuelve abierta
puerta g13 preguntas 9; decidir g13 respondo telegram 111; firmar g13
[ $rc -eq 0 ] && jq -se '[.[] | select(.type == "test-edit")] | length == 1 and .[0].files == ["tests/a.test.js"] and .[0].question == "Q-x-030" and .[0].gate == "g13" and .[0].by == "Andrés León"' acceptance/decisions.jsonl >/dev/null \
  && jq -e '.autorizaciones == [{pregunta:"Q-x-030", ficheros:["tests/a.test.js"]}]' "$HERMES_SDD_HOME/actas/local/g13.json" >/dev/null \
  && git log -1 --format=%B | grep -q "Gate-Id: g13" && git log -1 --format=%B > "$T/msg13" && node "$ROOT/metodo/scripts/sdd.mjs" verify --message "$T/msg13" >/dev/null 2>&1 && grep -q "Tests ya existentes que la persona autoriza editar.*tests/a.test.js" .sdd/hermes/respuestas-g13.json \
  && ok "editar-test elegido por una persona: registro test-edit, acta del notario y commit" || bad "test-edit: $out $(tail -1 acceptance/decisions.jsonl)"
printf "it('a', () => { expect(2).toBe(2) })\n" > tests/a.test.js; printf "it('b', () => { expect(2).toBe(2) })\n" > tests/b.test.js; git commit -qam "test: literales"
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_fidelidad.py" congelados "$R" --json)
echo "$o" | jq -e '[.congelados[] | select(.asunto == "test: literales")] | (map(select(.fichero == "tests/a.test.js"))[0].autorizado) and (map(select(.fichero == "tests/b.test.js"))[0].autorizado | not)' >/dev/null \
  && ok "hsdd_fidelidad: la respuesta firmada autoriza tests/a.test.js y no tests/b.test.js del mismo commit" || bad "fidelidad tras firmar: $o"
cat > .sdd/questions-x.md <<'Q'
## Q-x-031 [OPEN] skill=sdd-task-implementer
Question: ¿Se edita b.test.js?
Para el cliente: ¿Cambiamos esa prueba?
Options:
  A) Sí (recommended)
     efecto: editar-test tests/b.test.js
  B) No
     efecto: ninguno
Answer:
Q
puerta g13j preguntas 9; decidir g13j respondo telegram 111
gemelo g13j; t=$(mktemp); jq '.decision.actor = {persona:"jev", canal:"jev", id:"x"}' "$HERMES_SDD_HOME/puertas/g13j.json" > "$t" && mv "$t" "$HERMES_SDD_HOME/puertas/g13j.json"
jq '.actor = {persona:"jev", canal:"jev", id:"x"}' .sdd/hermes/decisiones/g13j.json > "$t" && mv "$t" .sdd/hermes/decisiones/g13j.json
out=$(bash "$ROOT/firmar.sh" "$R" g13j 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "lo autoriza una persona, no Jev" && grep -q '^## Q-x-031 \[OPEN\]' .sdd/questions-x.md \
  && ok "Jev no puede elegir una opción que autoriza editar tests (art. 12): rechazada sin contestar nada" || bad "jev editar-test: $out"
rm -f .sdd/questions-x.md
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
# ── corrijo, idempotencia por puerta, tarjeta archivada y recuperar una firma cortada ─────────────────────────────
mkdir -p "$T/bin2"; : > "$T/klog2"
cat > "$T/bin2/hermes" <<H
#!/usr/bin/env bash
echo "\$*" >> "$T/klog2"
case "\$*" in
  *"boards list"*) echo '[{"slug":"repo"}]' ;;
  *" create "*) echo '{"id":"t_9"}' ;;
  *" complete t_arch"*) echo "task t_arch is archived" >&2; exit 1 ;;
  *" complete t_lento"*) sleep 30 ;;
esac
H
chmod +x "$T/bin2/hermes"
tablero() { t=$(mktemp); jq --arg k "$2" '.tablero = "repo" | .tarjeta = $k | .titulo = "Aceptar FASE-0"' ".sdd/hermes/puertas/$1.json" > "$t" && mv "$t" ".sdd/hermes/puertas/$1.json"; }
# 12. «✏️ Corregir el requisito»: antes moría (commit_si_hay se usaba antes de definirse); ahora lanza el cambio
puerta g12 fase 0; tablero g12 t_12; t=$(mktemp)
jq '.opciones = [{verbo:"corrijo", etiqueta:"✏️ Corregir el requisito", texto:true}, {verbo:"rechazo", etiqueta:"❌", texto:true}]' .sdd/hermes/puertas/g12.json > "$t" && mv "$t" .sdd/hermes/puertas/g12.json
: > "$T/klog2"; decidir g12 corrijo telegram 111 "el criterio debe decir 3 tareas, no 2"; gemelo g12
out=$(PATH="$T/bin2:$PATH" bash "$ROOT/firmar.sh" "$R" g12 2>&1); rc=$?
[ $rc -eq 0 ] && echo "$out" | grep -q "pide corregir el requisito" && grep -q "Cambio INT-" "$T/klog2" \
  && grep -rq "3 tareas, no 2" intent/ && ok "corrijo: se firma y lanza un cambio de requisitos con lo pedido" || bad "corrijo: $out $(cat "$T/klog2")"
# 13. idempotencia por id de puerta: con la tarjeta vacía («/»), un registro anterior impedía registrar el rechazo
puerta g13r fase 0; decidir g13r rechazo telegram 111 "falta el filtro por fecha"; firmar g13r
[ $rc -eq 0 ] && grep 'gate:g13r"' acceptance/decisions.jsonl 2>/dev/null | grep -q '"result":"rejected"' \
  && ok "el rechazo se registra aunque ya hubiera otros registros (clave: el id de la puerta)" || bad "idempotencia: $out $(tail -2 acceptance/decisions.jsonl)"
n=$(grep -c 'gate:g13r"' acceptance/decisions.jsonl); firmar g13r
[ "$(grep -c 'gate:g13r"' acceptance/decisions.jsonl)" = "$n" ] && ok "repetir esa firma no lo duplica" || bad "duplica g13r"
# 14. tarjeta de la puerta ya archivada: lo firmado vale, no queda en «error» con el tag puesto
puerta g14 plan; tablero g14 t_arch; decidir g14 conforme telegram 111; gemelo g14
out=$(PATH="$T/bin2:$PATH" bash "$ROOT/firmar.sh" "$R" g14 2>&1); rc=$?
[ $rc -eq 0 ] && [ "$(jq -r .estado "$HERMES_SDD_HOME/puertas/g14.json")" = firmada ] && jq -e '.aviso_tablero' "$HERMES_SDD_HOME/actas/repo/g14.json" >/dev/null \
  && ok "tarjeta archivada: la firma termina (queda un aviso en el acta)" || bad "archivada: $out"
# 15. recuperar: firma cortada a mitad (el notario muere cerrando la tarjeta) → se reanuda sin repetir nada
puerta g15 plan; tablero g15 t_lento; decidir g15 conforme telegram 111; gemelo g15
PATH="$T/bin2:$PATH" bash "$ROOT/firmar.sh" "$R" g15 >/dev/null 2>&1 &
FP=$!
for _ in $(seq 1 100); do jq -e '.pasos | index("historial") or index("encadenado") or index("commit")' "$HERMES_SDD_HOME/actas/repo/g15.json" >/dev/null 2>&1 && pgrep -f "complete t_lento" >/dev/null && break; sleep 0.2; done
pkill -9 -f "complete t_lento"; kill -9 "$FP" 2>/dev/null; wait "$FP" 2>/dev/null
t=$(mktemp); jq '.estado = "error" | .error = "el notario no termino en 10 min"' "$HERMES_SDD_HOME/puertas/g15.json" > "$t" && mv "$t" "$HERMES_SDD_HOME/puertas/g15.json"
n1=$(git rev-list --count HEAD); pasos=$(jq -c .pasos "$HERMES_SDD_HOME/actas/repo/g15.json")
t=$(mktemp); jq '.tarjeta = "t_ok"' .sdd/hermes/puertas/g15.json > "$t" && mv "$t" .sdd/hermes/puertas/g15.json   # la tarjeta ya se puede cerrar
out=$(PATH="$T/bin2:$PATH" bash "$ROOT/puerta.sh" recuperar g15 2>&1); rc=$?
[ $rc -eq 0 ] && echo "$out" | grep -q "Firma reanudada: Plan conforme" && [ "$(jq -r .estado "$HERMES_SDD_HOME/puertas/g15.json")" = firmada ] \
  && [ "$(git rev-list --count HEAD)" = "$n1" ] && [ ! -d .sdd/hermes/lock ] \
  && ok "recuperar una firma cortada a mitad ($pasos): se reanuda, sin repetir el commit, y la puerta queda firmada" || bad "recuperar: $out $pasos"
# 16. recuperar una que no llegó a validarse: lo dejado a medias en acceptance/ se deshace y la puerta vuelve a abrirse
puerta g16 fase 0; decidir g16 acepto telegram 111; gemelo g16
echo '{"type":"a medias"}' >> acceptance/decisions.jsonl
t=$(mktemp); jq '.estado = "error" | .error = "cortado"' "$HERMES_SDD_HOME/puertas/g16.json" > "$t" && mv "$t" "$HERMES_SDD_HOME/puertas/g16.json"
out=$(bash "$ROOT/puerta.sh" recuperar g16 2>&1); rc=$?
[ $rc -eq 0 ] && [ -z "$(git status --porcelain --untracked-files=no)" ] && [ ! -f .sdd/hermes/decisiones/g16.json ] \
  && jq -e '.estado == "abierta" and (has("decision") | not)' "$HERMES_SDD_HOME/puertas/g16.json" >/dev/null \
  && ok "recuperar sin validar: restaura acceptance/ y reabre la puerta para decidir otra vez" || bad "recuperar sin validar: $out $(git status --short)"
out=$(bash "$ROOT/puerta.sh" recuperar g16 2>&1) && bad "recupera una puerta abierta" || ok "solo se recupera una puerta en error"
# 17. transiciones: decidir.sh pasa por el núcleo (una puerta firmada no se vuelve a decidir; el verbo tiene que existir)
mkdir -p "$HERMES_SDD_HOME"; jq '.andres.canales.local = env.USER' "$HERMES_SDD_HOME/aprobadores.json" > "$T/ap" && cp "$T/ap" "$HERMES_SDD_HOME/aprobadores.json"
out=$(bash "$ROOT/decidir.sh" g14 conforme 2>&1) && bad "decide una puerta ya firmada" || { echo "$out" | grep -q "ya está resuelta" && ok "decidir.sh: una puerta firmada no se vuelve a decidir" || bad "firmada: $out"; }
out=$(bash "$ROOT/decidir.sh" g16 inventado 2>&1) && bad "verbo inventado" || { echo "$out" | grep -q "Opción no válida" && ok "decidir.sh: un verbo que la puerta no ofrece, no" || bad "verbo: $out"; }
out=$(HERMES_SDD_HOME="$HERMES_SDD_HOME" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py" transicion g14 abierta 2>&1) && bad "firmada → abierta" \
  || { echo "$out" | grep -q "no puede pasar a «abierta»" && ok "tabla de transiciones: firmada no vuelve a abierta" || bad "transición: $out"; }
[ "$(jq 'has("estado")' .sdd/hermes/puertas/g14.json)" = false ] || bad "la copia del repo lleva estado"
# 17. aprobar los requisitos con una recomendada que pide cambiarlos (efecto: req-change) LANZA el cambio, como promete
#     la puerta («esto lanzará: 📝 abre un cambio de requisitos»); antes se apuntaba y se seguía con la ruta (taller)
cat > .sdd/questions-requirements-engineer.md <<'Q'
## Q-requirements-engineer-001 [OPEN] skill=sdd-requirements-engineer
Question: Shared state between visitors?
Para el cliente: ¿Un único taller compartido por todas las personas?
Options:
  A) Shared workshop, needs a small server (recommended)
     efecto: req-change
  B) Each browser keeps its own data
     efecto: ninguno
Answer:
Q
sed -i.bak -E 's/^> \*\*Version:\*\*.*/> **Version:** 1.7/' requirements/REQUIREMENTS.md && rm -f requirements/REQUIREMENTS.md.bak
git commit -qam "docs(requirements): v1.7" >/dev/null
puerta g17 requisitos; tablero g17 t_17; : > "$T/klog2"; decidir g17 acepto telegram 111; gemelo g17
out=$(PATH="$T/bin2:$PATH" bash "$ROOT/firmar.sh" "$R" g17 2>&1); rc=$?
[ $rc -eq 0 ] && grep -q "Cambio INT-" "$T/klog2" && grep -rq "Shared workshop" intent/ \
  && ok "aprobar requisitos con una respuesta req-change lanza el cambio de requisitos" || bad "requisitos + req-change: $out $(cat "$T/klog2")"
# 18. decidir.sh --en: el canal local con ventana para deshacer (la firma el gateway al vencer, como Telegram) y
#     decidir.sh <puerta> deshacer mientras no esté firmada; sin --en, firma en el acto y no se deshace
puerta g18 plan; f="$HERMES_SDD_HOME/puertas/g18.json"
jq --arg r "$R" '.id = "g18" | .repo = $r | .estado = "abierta" | .titulo = "Plan" | .opciones = [{verbo:"conforme", etiqueta:"✅"}]' \
  .sdd/hermes/puertas/g18.json > "$f"; head0=$(git rev-parse HEAD)
out=$(bash "$ROOT/decidir.sh" --en dos g18 conforme 2>&1) && bad "--en sin segundos válidos" \
  || { echo "$out" | grep -q "segundos entre" && [ "$(jq -r .estado "$f")" = abierta ] && ok "decidir.sh --en: segundos o «config»; si no, no decide" || bad "--en inválido: $out"; }
out=$(bash "$ROOT/decidir.sh" --en 60 g18 conforme 2>&1); rc=$?
[ $rc -eq 0 ] && jq -e --argjson t "$(date +%s)" '.estado == "decidida" and .firma_gateway == true and .firmar_en > $t + 50 and .decision.actor.canal == "local"' "$f" >/dev/null \
  && [ -f .sdd/hermes/decisiones/g18.json ] && [ "$(git rev-parse HEAD)" = "$head0" ] && echo "$out" | grep -q "g18 deshacer" \
  && ok "decidir.sh --en 60: queda decidida con su hora de firma, para el gateway, sin firmar aún" || bad "--en: $rc $out $(cat "$f")"
out=$(bash "$ROOT/decidir.sh" g18 deshacer 2>&1); rc=$?
[ $rc -eq 0 ] && jq -e '.estado == "abierta" and ((has("decision") or has("firmar_en") or has("firma_gateway")) | not)' "$f" >/dev/null \
  && [ ! -f .sdd/hermes/decisiones/g18.json ] && ok "decidir.sh <puerta> deshacer: vuelve a abierta (decidida → abierta) y borra la decisión" || bad "deshacer: $out $(cat "$f")"
out=$(bash "$ROOT/decidir.sh" g18 deshacer 2>&1) && bad "deshace una puerta abierta" || { echo "$out" | grep -q "Ya no se puede deshacer" && ok "no deshace lo que no está decidido" || bad "deshacer abierta: $out"; }
HERMES_SDD_DESHACER_S=45 bash "$ROOT/decidir.sh" --en config g18 conforme >/dev/null 2>&1
jq -e --argjson t "$(date +%s)" '.firmar_en > $t + 30 and .firmar_en < $t + 60' "$f" >/dev/null && ok "--en config: la ventana de nuevo.sh config --deshacer" || bad "--en config: $(jq .firmar_en "$f")"
out=$(bash "$ROOT/decidir.sh" g14 deshacer 2>&1) && bad "deshace una firmada" || ok "una puerta firmada no se deshace"
# 19. entrega de una sola FASE rechazada: la implementación recibe lo pedido (feedback/implementar-0.txt), como el
#     rechazo de una FASE; antes solo se apuntaba para el cierre, que no reprograma nada (taller)
puerta g19 entrega; t=$(mktemp); jq '.unica = true' .sdd/hermes/puertas/g19.json > "$t" && mv "$t" .sdd/hermes/puertas/g19.json
rm -f .sdd/hermes/feedback/implementar-0.txt; decidir g19 rechazo telegram 111 "faltan comprobar los duplicados"; firmar g19
[ $rc -eq 0 ] && grep -q "faltan comprobar los duplicados" .sdd/hermes/feedback/implementar-0.txt 2>/dev/null \
  && ok "rechazar la entrega de una FASE única deja lo pedido para rehacer la FASE-0" || bad "entrega única: $out"
# 20. lo firmado, estructurado («firma» en el acta y en el índice): los canales ya no adivinan con regex si fue un «no»
#     ni cuál es el tag; «verbo» es el botón que se pulsó y «firmado_como», lo que se firmó
A="$HERMES_SDD_HOME/actas/local"
jq -e '.firma | .tipo == "entrega" and .resultado == "rechazo" and .negativo == true and .tag == "" and (.resumen | startswith("Entrega rechazada"))' "$A/g19.json" >/dev/null \
  && jq -e '.firma.negativo == true and .firma.resumen == .resultado' "$HERMES_SDD_HOME/puertas/g19.json" >/dev/null \
  && ok "firma estructurada de un rechazo: negativo, sin tag, en el acta y en el índice" || bad "firma rechazo: $(jq -c .firma "$A/g19.json" 2>&1)"
jq -e '.firma | .verbo == "eximo" and .firmado_como == "acepto" and .resultado == "acepto" and .negativo == false and .tag == "fase-0-accepted"' "$A/g6b.json" >/dev/null \
  && ok "firma estructurada de una exención: el botón (eximo), lo firmado (acepto) y su tag" || bad "firma eximo: $(jq -c .firma "$A/g6b.json" 2>&1)"
jq -e '.firma | .tipo == "plan" and .resultado == "conforme" and .negativo == false' "$A/g11.json" >/dev/null \
  && jq -e '.firma | .verbo == "acepto" and .firmado_como == "cambios" and .resultado == "cambios" and .negativo == true' "$A/g10.json" >/dev/null \
  && ok "firma estructurada: aprobar con una respuesta distinta queda como «cambios» (negativo)" || bad "firma g10/g11: $(jq -c .firma "$A/g10.json" "$A/g11.json" 2>&1)"
# 21. las respuestas como campo de la decisión ({"1": "B"}, lo que pone el núcleo): el notario las usa sin texto
decidir_r() {  # decidir_r <id> <verbo> <respuestas-json> [texto]: una decisión con el campo «respuestas»
  decidir "$1" "$2" telegram 111 "${4:-}"; t=$(mktemp)
  jq --argjson r "$3" '.respuestas = $r' ".sdd/hermes/decisiones/$1.json" > "$t" && mv "$t" ".sdd/hermes/decisiones/$1.json"; }
puerta g21 plan; con_preguntas g21; decidir_r g21 conforme '{"1":"B"}'; firmar g21
[ $rc -eq 0 ] && echo "$out" | grep -q "pide cambios en plan" && grep -q "Q-r-001 = B" .sdd/hermes/feedback/plan.txt \
  && ok "respuestas como campo (sin «Q1: B» en el texto): la opción no recomendada pide cambios" || bad "campo respuestas: $out"
puerta g21b plan; con_preguntas g21b; decidir_r g21b conforme '{"1":"D"}'; firmar g21b
[ $rc -ne 0 ] && echo "$out" | grep -q "Q1: «D» no es una de sus opciones (A o B)" && ok "campo respuestas con una letra que no existe: rechazada" || bad "campo D: $out"
puerta g21c plan; con_preguntas g21c; decidir_r g21c conforme '{"1":"B"}' "Q1: A"; firmar g21c
[ $rc -ne 0 ] && echo "$out" | grep -q "Q1 tiene dos respuestas distintas" && ok "campo y texto que se contradicen: rechazada" || bad "campo contra texto: $out"
puerta g21d plan; con_preguntas g21d; decidir_r g21d conforme '{"1":"A"}'; gemelo g21d
t=$(mktemp); jq '.respuestas = {"1":"B"}' .sdd/hermes/decisiones/g21d.json > "$t" && mv "$t" .sdd/hermes/decisiones/g21d.json
out=$(bash "$ROOT/firmar.sh" "$R" g21d 2>&1); rc=$?
[ $rc -ne 0 ] && echo "$out" | grep -q "no coincide con la que registró un canal" \
  && ok "unas respuestas retocadas en la copia del repo (no las que registró el canal): no se firma" || bad "respuestas retocadas: $out"
exit $fail
