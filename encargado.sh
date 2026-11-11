#!/usr/bin/env bash
# El ENCARGADO de un proyecto (docs/encargado.md), fase 1: lee y conversa, y recuerda en su wiki.
#
#   encargado.sh crear <repo>        crea o pone al día el perfil sdd-p-<proyecto> y el wiki del proyecto (idempotente:
#                                    no borra el perfil si ya existe; conserva sus sesiones y su memoria)
#   encargado.sh perfil <repo>       imprime el nombre del perfil del proyecto
#   encargado.sh borrar <repo>       borra el perfil (el wiki se queda en el repo)
#   encargado.sh lanzar <repo>       lanza un proyecto preparado (lanzar.sh preparar) con la entrada que recogió
#   encargado.sh tema <repo> <chat> <hilo>   enlaza un tema de Telegram con el encargado (lo usa /encargado)
#   encargado.sh reintentar <repo> <tarjeta> [--seco]   repite UNA vez una etapa que falló (sus hijas pasan a la nueva)
#   encargado.sh limpiar <repo> [--seco]     archiva tarjetas obsoletas
#   encargado.sh apartar <repo> [--seco]     restos sin commit de una etapa cortada → stash con nombre (nunca se borran)
#   encargado.sh relanzar <repo> <N> [--seco]   rehace la FASE N (el guardia pide antes la aprobación de la persona)
#   encargado.sh leccion <repo> <etapa> "<regla>" <evidencia>...   propone una lección para otros proyectos
#
# Hablar con él: en el panel de Hermes, /chat?profile=sdd-p-<proyecto>, o `hermes -p sdd-p-<proyecto> chat`.
#
# El perfil: SOUL con su carta, directorio de trabajo en el repo, modelo capaz (Sonnet por defecto; `encargado_modelo`
# en sdd.json), skill llm-wiki con el wiki en <repo>/wiki, y un guardia fail-closed (encargado/guardia.py): solo lee y
# solo escribe en su wiki. El wiki es un repositorio git propio, ignorado por el del proyecto: sus commits no mueven
# el HEAD que muestran las puertas.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HH="$HOME/.hermes"; HOME_SDD="${HERMES_SDD_HOME:-$HH/hermes-sdd}"
CMD=${1:-}; [ -n "${2:-}" ] || { sed -n '2,20p' "$0" >&2; exit 2; }
REPO=$(cd "$2" && pwd)
BOARD=$(basename "$REPO" | tr '[:upper:]' '[:lower:]' | sed -E 's/[^a-z0-9]+/-/g; s/^-+|-+$//g')
P="sdd-p-$BOARD"
ARNES="$HOME_SDD/actual"; [ -d "$ARNES" ] || ARNES=$ROOT   # instalado o, en pruebas, el propio repo

registrar() {  # encargados.json: perfil → repo (lo lee el plugin para darle al encargado la foto de su proyecto)
  python3 - "$HOME_SDD/encargados.json" "$P" "$1" <<'PY'
import json, sys
f, p, repo = sys.argv[1:]
try:
    d = json.load(open(f))
except (OSError, ValueError):
    d = {}
if repo:
    d[p] = repo
else:
    d.pop(p, None)
json.dump(d, open(f, "w"), ensure_ascii=False, indent=1)
PY
}

etapa_o_puerta() {  # ¿hay una etapa viva en el repo o una puerta del proyecto abierta o decidida?
  local pid; pid=$(cat "$REPO/.sdd/hermes/lock/pid" 2>/dev/null || true)
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && return 0
  for f in "$HOME_SDD"/puertas/*.json; do
    [ -f "$f" ] || continue
    jq -e --arg b "$BOARD" '.tablero == $b and (.estado == "abierta" or .estado == "decidida")' "$f" >/dev/null 2>&1 && return 0
  done
  return 1
}

wiki() {  # esqueleto del wiki (si no existe) como repositorio git propio, ignorado por el del proyecto
  local W="$REPO/wiki" hoy; hoy=$(date +%Y-%m-%d)
  mkdir -p "$W/raw/documentos" "$W/raw/capturas" "$W/entities" "$W/concepts" "$W/comparisons" "$W/queries"
  [ -f "$W/SCHEMA.md" ] || sed "s|{{PROYECTO}}|$BOARD|g" "$ROOT/encargado/wiki/SCHEMA.md" > "$W/SCHEMA.md"
  [ -f "$W/index.md" ] || printf '# Wiki Index — %s\n\n> Memoria del encargado. Ver SCHEMA.md.\n\n## Entities\n\n## Concepts\n\n## Comparisons\n\n## Queries\n' "$BOARD" > "$W/index.md"
  [ -f "$W/log.md" ] || printf '# Wiki Log — %s\n\n> Actions: ingest, update, query, lint, create, archive, delete\n\n## [%s] create | Wiki initialized\n' "$BOARD" "$hoy" > "$W/log.md"
  for d in raw/documentos raw/capturas entities concepts comparisons queries; do [ -n "$(ls -A "$W/$d")" ] || touch "$W/$d/.gitkeep"; done
  if ! grep -qxF "wiki/" "$REPO/.gitignore" 2>/dev/null; then
    echo "wiki/" >> "$REPO/.gitignore"
    # El commit mueve el HEAD: con una etapa en marcha o una puerta pendiente, se deja sin commit (lo recoge el
    # siguiente commit de una etapa); si no, se commitea solo
    if ! etapa_o_puerta && [ -z "$(git -C "$REPO" status --porcelain -- . ':!.gitignore' 2>/dev/null)" ]; then
      git -C "$REPO" add .gitignore && git -C "$REPO" commit -qm "chore: wiki/ del encargado fuera del repo del proyecto" --no-verify || true
    fi
  fi
  if [ ! -d "$W/.git" ]; then
    git -C "$W" init -q && git -C "$W" add -A && git -C "$W" -c user.name="Encargado $BOARD" -c user.email="encargado@hermes-sdd" commit -qm "Wiki del proyecto $BOARD"
  fi
}

vigilante() {  # el cron del vigía en el perfil del encargado: cada 5 min un script sin LLM (hsdd_proyectos.py vigia);
  # solo si su salida cambia se despierta el modelo, que diagnostica, actúa según su carta y avisa en su tema
  local PD="$HH/profiles/$P" id destino
  mkdir -p "$PD/scripts"
  cat > "$PD/scripts/vigia.sh" <<V
#!/usr/bin/env bash
# Vigía de $BOARD (lo crea encargado.sh): una línea por asunto que mirar; vacío si todo va bien. Sin horas: el cron en
# modo monitor solo despierta al encargado cuando esta salida cambia.
export PATH="$(dirname "$(command -v hermes)"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
export HERMES_SDD_HOME="$HOME_SDD"
exec python3 "$ARNES/plugin/hermes-sdd/hsdd_proyectos.py" vigia "$REPO"
V
  chmod +x "$PD/scripts/vigia.sh"
  destino=$(hermes config get gateway.profile_routes --json 2>/dev/null | jq -r --arg n "encargado-$BOARD" \
    '[.[]? | select(.name == $n)][0] | if . then "telegram:\(.chat_id):\(.thread_id)" else empty end' 2>/dev/null)
  destino=${destino:-telegram}
  local PROMPT="Eres el encargado de $BOARD y te despierta el vigía: cambió la lista de asuntos que mirar (va arriba, MONITOR CHANGE). Para cada asunto NUEVO, diagnostica (hsdd_proyectos.py estado, .sdd/hermes/etapas.jsonl, el motivo, git log) y actúa según tu carta, sección «Supervisar». En esta ronda no hay nadie para aprobar: no relances; si hace falta, recomiéndalo. Después escribe a la persona un mensaje breve en castellano: qué pasó, qué hiciste o qué recomiendas, y qué necesitas que decida. Si lo único que cambió es que algo se resolvió, una línea. Si no hay nada que contar, responde exactamente [SILENT]."
  id=$(jq -r '(if type == "array" then . else (.jobs // []) end)[] | select(.name == "vigia") | .id' "$PD/cron/jobs.json" 2>/dev/null | head -1)
  if [ -n "$id" ]; then
    hermes -p "$P" cron edit "$id" --schedule "every 5m" --prompt "$PROMPT" --monitor-script vigia.sh --workdir "$REPO" --deliver "$destino" >/dev/null
  else
    hermes -p "$P" cron create "every 5m" "$PROMPT" --name vigia --monitor-script vigia.sh --workdir "$REPO" \
      --deliver "$destino" --catch-up off >/dev/null
  fi
  echo "  Vigía: cada 5 min (sin LLM salvo si algo cambia), avisa en $destino"
}

modelo() {
  HERMES_SDD_HOME="$HOME_SDD" python3 "$ARNES/plugin/hermes-sdd/hsdd_proyectos.py" modelo-encargado 2>/dev/null || echo "anthropic/claude-sonnet-5.5"
}

case "$CMD" in
  perfil) echo "$P" ;;

  crear)
    [ -d "$REPO/.git" ] || { echo "ERROR: $REPO no es un repositorio git" >&2; exit 1; }
    [ -z "$(git -C "$REPO" ls-files wiki | head -1)" ] ||
      { echo "ERROR: $REPO ya tiene una carpeta wiki/ propia en git; el wiki del encargado no puede usarla" >&2; exit 1; }
    wiki
    if ! hermes profile list 2>/dev/null | grep -qw "$P"; then
      hermes profile create "$P" --no-alias --no-skills \
        --description "Encargado del proyecto $BOARD (hermes-sdd): lee, conversa y recuerda en su wiki. No decide ni firma." >/dev/null
    fi
    PD="$HH/profiles/$P"
    sed -e "s|{{PROYECTO}}|$BOARD|g" -e "s|{{REPO}}|$REPO|g" -e "s|{{ARNES}}|$ARNES|g" "$ROOT/encargado/SOUL.md" > "$PD/SOUL.md"
    for k in provider base_url api_mode; do
      v=$(hermes config get "model.$k" 2>/dev/null | tail -1); [ -n "$v" ] && hermes -p "$P" config set "model.$k" "$v" >/dev/null
    done
    hermes -p "$P" config set model.default "$(modelo)" >/dev/null
    { grep '^OPENROUTER_API_KEY=' "$HH/.env" || true; echo "WIKI_PATH=$REPO/wiki"; } > "$PD/.env"; chmod 600 "$PD/.env"
    # Herramientas: lee (terminal y ficheros, vigilados por el guardia), pregunta (clarify), recuerda (skills, memoria,
    # sesiones) y mira capturas (vision). Nada de web, navegador, código suelto, delegación, cron ni kanban (fase 1).
    hermes -p "$P" tools disable web browser image_gen tts computer_use cronjob delegation code_execution \
      connections kanban >/dev/null 2>&1 || true
    hermes -p "$P" tools enable terminal file clarify skills memory session_search vision >/dev/null 2>&1 || true
    for kv in "terminal.cwd $REPO" "agent.clarify_timeout 0" "curator.enabled false" "skills.write_approval true"; do
      hermes -p "$P" config set $kv >/dev/null
    done
    hermes -p "$P" config set skills.external_dirs "[\"$ARNES/encargado/skills\"]" >/dev/null
    hermes -p "$P" config set approvals.deny \
      '["*accept record*","*update-ref*","*route --write*","*git push*","*firmar.sh*","*decidir.sh*","*jev.sh*","*nuevo.sh*","*lanzar.sh*","*etapa.sh*","*hsdd_nucleo.py*","*jev.json*","*sdd.json*","*aprobadores.json*","*hermes kanban*","*sqlite3*"]' >/dev/null
    GUARDIA="python3 -I $ARNES/encargado/guardia.py $REPO $ARNES"
    hermes -p "$P" config set hooks.pre_tool_call \
      "[{\"matcher\":\"terminal|write_file|patch|execute_code\",\"command\":\"$GUARDIA\",\"timeout\":10,\"fail_closed\":true}]" >/dev/null
    # El hook solo corre si está aprobado (si no, Hermes lo salta): se aprueba aquí, para este perfil y esta orden
    jq -n --arg c "$GUARDIA" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{approvals: [{event: "pre_tool_call", command: $c, approved_at: $t}]}' > "$PD/shell-hooks-allowlist.json"
    registrar "$REPO"
    echo "Encargado de $BOARD listo: perfil $P, modelo $(modelo), wiki en $REPO/wiki"
    vigilante
    echo "  Hablar con él: panel de Hermes → /chat?profile=$P   ·   hermes -p $P chat" ;;

  lanzar)   # el proyecto preparado (lanzar.sh preparar) arranca con la entrada que recogió el encargado. Es la única
            # acción que el guardia le permite, y solo mientras exista .sdd/hermes/preparando.
    cd "$REPO"
    [ -f .sdd/hermes/preparando ] || { echo "ERROR: $BOARD no está en preparación (ya se lanzó)" >&2; exit 1; }
    [ -s intent/INT-001.md ] || { echo "ERROR: falta intent/INT-001.md (la petición)" >&2; exit 1; }
    # Requisitos de partida (casi listos, de la persona): la etapa de requisitos los depura en vez de escribirlos, y
    # la puerta enseña qué cambió respecto a esta copia
    if [ -s requirements/REQUIREMENTS.md ]; then cp requirements/REQUIREMENTS.md .sdd/hermes/requisitos-de-partida.md; fi
    git add -- intent $( [ -d requirements ] && echo requirements ) 2>/dev/null || true
    git diff --cached --quiet || git commit -qm "docs(intent): entrada preparada con el encargado" --no-verify
    [ -z "$(git status --porcelain)" ] || { echo "ERROR: quedan cambios sin commit fuera de intent/ y requirements/:" >&2; git status --short >&2; exit 1; }
    rm -f .sdd/hermes/preparando
    bash "$ROOT/lanzar.sh" iniciar "$REPO" ;;

  # ── Acciones de supervisión (fase 3). Las únicas que el guardia le deja al encargado; cada una comprueba sus
  #    condiciones, admite --seco (dice qué haría sin hacerlo) y queda en .sdd/hermes/encargado-acciones.jsonl ────────
  reintentar|limpiar|apartar|relanzar)
    SECO=false; ARGS=()
    for a in "${@:3}"; do [ "$a" = --seco ] && SECO=true || ARGS+=("$a"); done
    cd "$REPO"
    K=(hermes kanban --board "$BOARD")
    anotar() { mkdir -p .sdd/hermes; jq -nc --arg a "$CMD" --arg d "$1" --arg t "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
      '{ts:$t, accion:$a, detalle:$d, por:"encargado"}' >> .sdd/hermes/encargado-acciones.jsonl; echo "$1"; }
    viva() { local pid; pid=$(cat .sdd/hermes/lock/pid 2>/dev/null || true); [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; }
    # (con set -e: las comprobaciones van en if, no en «a && b», para que un falso no corte el script)
    hecho() { if $SECO; then echo "(en seco) $1"; exit 0; fi; }
    case "$CMD" in
      reintentar)   # reintentar <tarjeta>: una etapa que falló se repite UNA vez (por tarjeta); sus hijas pasan a la nueva
        T=${ARGS[0]:?falta la tarjeta}
        J=$("${K[@]}" show "$T" --json 2>/dev/null) || { echo "ERROR: no encuentro la tarjeta $T" >&2; exit 1; }
        [ "$(jq -r '.task.status' <<< "$J")" = blocked ] || { echo "ERROR: $T no está parada ($(jq -r '.task.status' <<< "$J"))" >&2; exit 1; }
        CUERPO=$(jq -r '.task.body // ""' <<< "$J")
        read -r ETAPA FASE < <(sed -nE 's/.*etapa\.sh [^ ]+ ([^ ]+)( ([^ ]+))?.*/\1 \3/p' <<< "$CUERPO" | head -1)
        [ -n "${ETAPA:-}" ] || { echo "ERROR: $T no es una tarjeta de etapa" >&2; exit 1; }
        grep -q "\"accion\":\"reintentar\".*\"detalle\":\"[^\"]*$T" .sdd/hermes/encargado-acciones.jsonl 2>/dev/null &&
          { echo "ERROR: ya reintenté $T una vez; ahora decide la persona (relanzar o cambiar algo)" >&2; exit 1; }
        if viva; then echo "ERROR: hay una etapa en marcha en $BOARD; espera a que acabe" >&2; exit 1; fi
        if etapa_o_puerta; then echo "ERROR: hay una puerta pendiente en $BOARD: un commit ahora le impediría firmarse" >&2; exit 1; fi
        hecho "reintentaría $ETAPA${FASE:+ FASE-$FASE} ($T) con una tarjeta nueva, pasándole sus hijas"
        NUEVA=$(bash "$ROOT/lanzar.sh" reintentar "$REPO" "$ETAPA" ${FASE:-} | tail -1)
        for h in $(jq -r '.children[]?' <<< "$J"); do
          "${K[@]}" link "$NUEVA" "$h" >/dev/null 2>&1 && "${K[@]}" unlink "$T" "$h" >/dev/null 2>&1 || true
        done
        "${K[@]}" comment "$T" "El encargado la reintenta en $NUEVA (una vez)." >/dev/null 2>&1 || true
        anotar "reintenta $ETAPA${FASE:+ FASE-$FASE}: $T → $NUEVA" ;;
      limpiar)      # archiva tarjetas obsoletas (una etapa que se repitió y ya se resolvió)
        hecho "archivaría las tarjetas obsoletas de $BOARD"
        R=$(bash "$ROOT/lanzar.sh" limpiar "$REPO"); anotar "limpia: ${R:-nada que archivar}" ;;
      apartar)      # restos sin commit de una etapa cortada: a un stash con nombre, nunca se borran
        if viva; then echo "ERROR: hay una etapa en marcha: esos cambios son suyos" >&2; exit 1; fi
        [ -n "$(git status --porcelain)" ] || { echo "No hay restos sin commit"; exit 0; }
        hecho "apartaría a un stash: $(git status --porcelain | wc -l | tr -d ' ') fichero(s)"
        git stash push -u -q -m "encargado: restos sin commit ($(date +%Y-%m-%d\ %H:%M))"
        anotar "aparta restos sin commit a $(git stash list | head -1 | cut -d: -f1) (recuperables con git stash pop)" ;;
      relanzar)     # relanzar <N>: rehacer una FASE ya hecha. El guardia pide antes la aprobación de la persona.
        N=${ARGS[0]:?falta la FASE}
        if viva; then echo "ERROR: hay una etapa en marcha en $BOARD" >&2; exit 1; fi
        hecho "relanzaría la FASE-$N (huecos si quedan → implementar → aceptar)"
        R=$(bash "$ROOT/lanzar.sh" rehacer "$REPO" "$N"); anotar "relanza FASE-$N: $R" ;;
    esac ;;

  leccion)   # encargado.sh leccion <repo> <etapa> "<regla general>" <evidencia>...: propone una lección entre proyectos
             # (fase 5). La comprueba hsdd_lecciones.py (evidencia que exista, sin datos del proyecto); la confirma una
             # persona por Telegram y solo entonces llega a las etapas de otros proyectos.
    [ $# -ge 5 ] || { echo "Uso: encargado.sh leccion <repo> <etapa> \"<regla general>\" <puerta g…|tarjeta t_…|commit>..." >&2; exit 2; }
    HERMES_SDD_HOME="$HOME_SDD" python3 "$ARNES/plugin/hermes-sdd/hsdd_lecciones.py" proponer "$REPO" "$3" "$4" "${@:5}" --por "encargado de $BOARD" ;;

  tema)   # encargado.sh tema <repo> <chat_id> <thread_id>: ese tema de Telegram habla con el encargado del proyecto.
          # Ruta por chat Y tema (si fuera solo por chat, todo el privado iría al encargado y se perderían los avisos);
          # el tema queda también en dm_topics para que Hermes lo conozca. El gateway la carga al reiniciar.
    CHAT=${3:?falta el chat_id}; HILO=${4:?falta el thread_id}
    RUTAS=$(hermes config get gateway.profile_routes --json 2>/dev/null || echo '[]')
    TEMAS=$(hermes config get platforms.telegram.extra.dm_topics --json 2>/dev/null || echo '[]')
    jq -e . <<< "$RUTAS" >/dev/null 2>&1 || RUTAS='[]'; jq -e . <<< "$TEMAS" >/dev/null 2>&1 || TEMAS='[]'
    RUTAS=$(jq -c --arg n "encargado-$BOARD" --arg c "$CHAT" --argjson t "$HILO" --arg p "$P" \
      '[.[] | select(.name != $n)] + [{name: $n, platform: "telegram", chat_id: $c, thread_id: ($t | tostring), profile: $p}]' <<< "$RUTAS")
    TEMAS=$(jq -c --arg c "$CHAT" --argjson t "$HILO" --arg nombre "🧭 $BOARD" '
      (if any(.[]; (.chat_id | tostring) == $c) then . else . + [{chat_id: ($c | tonumber), topics: []}] end)
      | map(if (.chat_id | tostring) == $c
            then .topics = ([.topics[]? | select(.name != $nombre and (.thread_id // 0) != $t)] + [{name: $nombre, thread_id: $t}])
            else . end)' <<< "$TEMAS")
    hermes config set gateway.profile_routes "$RUTAS" >/dev/null
    hermes config set platforms.telegram.extra.dm_topics "$TEMAS" >/dev/null
    echo "Tema «🧭 $BOARD» ($CHAT/$HILO) → $P (se activa al reiniciar el gateway)"
    vigilante ;;   # el vigía avisa en el tema

  borrar)
    hermes profile delete -y "$P" >/dev/null 2>&1 || true
    RUTAS=$(hermes config get gateway.profile_routes --json 2>/dev/null || echo '[]')
    if jq -e --arg n "encargado-$BOARD" 'any(.[]; .name == $n)' <<< "$RUTAS" >/dev/null 2>&1; then
      hermes config set gateway.profile_routes "$(jq -c --arg n "encargado-$BOARD" '[.[] | select(.name != $n)]' <<< "$RUTAS")" >/dev/null
      echo "(quitada la ruta de su tema de Telegram: reinicia el gateway)"
    fi
    registrar ""
    echo "Perfil $P borrado (el wiki sigue en $REPO/wiki)" ;;

  *) sed -n '2,20p' "$0" >&2; exit 2 ;;
esac
