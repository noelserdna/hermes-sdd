#!/usr/bin/env bash
# Ejecutor REPLAY: reproduce una ejecución grabada (grabar.sh) sin LLM y sin coste. Mismo contrato que claude.sh.
#
#   executors/replay.sh <repo> <nombre> <prompt> [modelo]
#
# La grabación la indica .sdd/hermes/hermes-sdd.json → "grabacion". Para la etapa <nombre> aplica con cherry-pick los
# commits que produjeron TODAS las ejecuciones grabadas con ese nombre que aún no se han aplicado (así, si la persona
# acepta a la primera lo que en la grabación costó dos intentos, recibe el resultado final). Los commits del notario
# no se reproducen: esos los produce la decisión de quien practica. Copia además lo que no estaba en git
# (evidencias, respuestas de la ruta, preguntas abiertas) y deja la etapa en `done` en el estado del método.
#
# Última línea de stdout: JSON {outcome: done|failed, reason, run, session_id:"replay", cost_usd:0, minutes:0}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2
cd "$REPO"
salir() { jq -nc --arg o "$1" --arg r "$2" --arg n "$NOMBRE" '{outcome:$o, reason:$r, run:("replay-"+$n), session_id:"replay", cost_usd:0, minutes:0}'; exit 0; }

G=$(jq -r '.grabacion // empty' .sdd/hermes/hermes-sdd.json 2>/dev/null)
[ -n "$G" ] && [ -f "$G/ejecuciones.json" ] || salir failed "no hay grabación configurada en .sdd/hermes/hermes-sdd.json"
ESTADO=.sdd/hermes/replay.json; [ -f "$ESTADO" ] || echo '{"aplicadas":[]}' > "$ESTADO"
git fetch -q --no-tags "$G/repo.bundle" '+refs/heads/*:refs/grabacion/*' 2>/dev/null || true
# Los registros append-only (diario, decisiones) se fusionan sin conflictos aunque el notario haya escrito antes
grep -qxF '*.jsonl merge=union' .git/info/attributes 2>/dev/null || echo '*.jsonl merge=union' >> .git/info/attributes

case "$NOMBRE" in
  ruta-factores)
    cp "$G/extras/route-answers.json" .sdd/route-answers.json 2>/dev/null || salir failed "la grabación no trae respuestas de la ruta"
    salir done "ok" ;;
esac

# Ejecuciones grabadas con este nombre, aún no aplicadas
IDX=$(jq -r --arg n "$NOMBRE" --slurpfile e "$ESTADO" \
  'to_entries | map(select(.value.nombre == $n) | .key) - $e[0].aplicadas | .[]' "$G/ejecuciones.json")
for i in $IDX; do
  for c in $(jq -r --argjson i "$i" '.[$i].commits[]' "$G/ejecuciones.json"); do
    if ! git -c user.name="$(git log -1 --format=%an "$c")" -c user.email="$(git log -1 --format=%ae "$c")" \
         cherry-pick -X theirs --allow-empty --keep-redundant-commits "$c" >/dev/null 2>&1; then
      git cherry-pick --abort >/dev/null 2>&1
      salir failed "no se pudo reproducir el commit $(git log -1 --format='%h %s' "$c")"
    fi
  done
  t=$(mktemp); jq --argjson i "$i" '.aplicadas += [$i]' "$ESTADO" > "$t" && mv "$t" "$ESTADO"
done

# Lo que no está en git
FASE=$(echo "$NOMBRE" | sed -nE 's/.*-([0-9]+)$/\1/p')
if [ -n "$FASE" ] && [ -d "$G/extras/evidencias/FASE-$FASE" ]; then mkdir -p evidencias; cp -R "$G/extras/evidencias/FASE-$FASE" evidencias/; fi
case "$NOMBRE" in
  plan*) Q=questions-plan-architect.md ;;  tareas*) Q=questions-task-generator.md ;;
  implementar*|cierre*) Q=questions-task-implementer.md ;;  *) Q="" ;;
esac
[ -n "$Q" ] && [ -f "$G/extras/preguntas/$Q" ] && [ ! -f ".sdd/$Q" ] && cp "$G/extras/preguntas/$Q" ".sdd/$Q"

# Etapa del método en done (lo que haría la skill real)
case "$NOMBRE" in
  plan*) CLAVE=plan-architect ;; tareas*) CLAVE=task-generator ;; implementar*|cierre*) CLAVE=task-implementer ;;
  aceptar*) CLAVE=acceptance ;; requisitos*) CLAVE=requirements-engineer ;; *) CLAVE="" ;;
esac
[ -n "$CLAVE" ] && bash "$ROOT/metodo/scripts/sdd-state.sh" set "$CLAVE" done >/dev/null 2>&1

# Aceptación: la evidencia de tests debe ser del commit de quien practica, así que los tests se ejecutan de verdad
if [ "${NOMBRE%%-*}" = aceptar ] || [ "${NOMBRE%%-*}" = cierre ]; then
  if [ ! -d node_modules ] && [ -f package.json ]; then   # npm ci respeta el lockfile y no lo modifica
    if [ -f package-lock.json ]; then npm ci --silent --no-audit --no-fund >/dev/null 2>&1; else npm install --silent --no-audit --no-fund >/dev/null 2>&1; fi
  fi
  REP=$(node -e 'import(process.argv[1]).then(m=>console.log(m.stackProfile(process.argv[2]).test_report||""))' \
        "$ROOT/metodo/scripts/lib/git-log.mjs" "$REPO")
  [ -n "$REP" ] && bash -c "$REP" >/dev/null 2>&1
  node "$ROOT/metodo/scripts/sdd.mjs" accept --junit-sha HEAD ${FASE:+--fase $FASE} --report acceptance/ACCEPTANCE-REPORT.md >/dev/null 2>&1
  git add acceptance/ 2>/dev/null
  git diff --cached --quiet || git commit -qm "docs(acceptance): acceptance report at $(git rev-parse --short HEAD) (replay)"
fi
salir done "ok"
