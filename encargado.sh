#!/usr/bin/env bash
# El ENCARGADO de un proyecto (docs/encargado.md), fase 1: lee y conversa, y recuerda en su wiki.
#
#   encargado.sh crear <repo>        crea o pone al día el perfil sdd-p-<proyecto> y el wiki del proyecto (idempotente:
#                                    no borra el perfil si ya existe; conserva sus sesiones y su memoria)
#   encargado.sh perfil <repo>       imprime el nombre del perfil del proyecto
#   encargado.sh borrar <repo>       borra el perfil (el wiki se queda en el repo)
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
CMD=${1:-}; [ -n "${2:-}" ] || { sed -n '2,12p' "$0" >&2; exit 2; }
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
    echo "  Hablar con él: panel de Hermes → /chat?profile=$P   ·   hermes -p $P chat" ;;

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
    echo "Tema «🧭 $BOARD» ($CHAT/$HILO) → $P (se activa al reiniciar el gateway)" ;;

  borrar)
    hermes profile delete -y "$P" >/dev/null 2>&1 || true
    RUTAS=$(hermes config get gateway.profile_routes --json 2>/dev/null || echo '[]')
    if jq -e --arg n "encargado-$BOARD" 'any(.[]; .name == $n)' <<< "$RUTAS" >/dev/null 2>&1; then
      hermes config set gateway.profile_routes "$(jq -c --arg n "encargado-$BOARD" '[.[] | select(.name != $n)]' <<< "$RUTAS")" >/dev/null
      echo "(quitada la ruta de su tema de Telegram: reinicia el gateway)"
    fi
    registrar ""
    echo "Perfil $P borrado (el wiki sigue en $REPO/wiki)" ;;

  *) sed -n '2,12p' "$0" >&2; exit 2 ;;
esac
