#!/usr/bin/env bash
# Ejecutor CAJA (local): la etapa corre en un contenedor Linux de ESTE ordenador que se crea para ella y se borra al
# acabar (Apple container; o Docker/OrbStack). Lo mismo que la caja de GitHub sin la cola ni la máquina nueva de cada
# etapa (en montana3-5, 50-76 min por prueba solo en arrancar máquinas): el agente solo ve una COPIA del proyecto, ni
# ~/.hermes, ni el notario, ni su clave; y Chromium arranca (en macOS, el sandbox de Claude Code no lo deja).
# Mismo contrato que executors/claude.sh.
#
#   executors/caja.sh <repo> <nombre> <prompt> [modelo]
#
# 1. Copia el proyecto en HEAD (git clone) con lo ignorado que la etapa necesita (.sdd/ sin decisiones, puertas,
#    candado ni ejecuciones; pipeline-state.json; evidencias/ sin la copia cruda de Playwright), el prompt y la
#    identidad de git.
# 2. Lanza el contenedor (templates/caja/etapa.sh dentro): la copia en /proyecto, el arnés en /arnes (solo lectura),
#    la caché de npm y navegadores en /cache y /salida para su trabajo. El token de Claude va por un fichero de
#    entorno que solo lee el contenedor; nunca por la línea de órdenes.
# 3. Valida y aplica lo que devuelve con las MISMAS reglas que la caja de GitHub (lib/caja-aplicar.sh).
#
# Configuración (.sdd/hermes/hermes-sdd.json → "caja"): {"runtime": "container"|"docker", "memoria": "4G", "cpus": 4}.
# Por defecto, Apple container si está; si no, docker. Imagen: hermes-sdd-caja:<versión de templates/caja>, que se
# construye sola la primera vez. Token: $CLAUDE_CODE_OAUTH_TOKEN o lo guardado con caja-token.sh (lib/token-caja.sh).
# Última línea de stdout: JSON {outcome: done|failed|scheduled, reason, run, session_id, cost_usd, turns, minutes, resumen}
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REPO=$(cd "$1" && pwd); NOMBRE=$2; PROMPT=$3; MODELO=${4:-}
RUN="$(date +%Y%m%d-%H%M%S)-$(printf '%s' "$NOMBRE" | tr -c 'A-Za-z0-9-' '-')"
DIR="$REPO/.sdd/hermes"; mkdir -p "$DIR/runs"
OUT="$DIR/runs/$RUN.json"; ERR="$DIR/runs/$RUN.err"
TMP=$(mktemp -d); S="$TMP/salida"; mkdir -p "$S"; NOMBRE_C="sdd-$RUN"; RT=""
INICIO=$(date +%s); MIN=0
cd "$REPO"

salir() {  # salir <outcome> <reason> [extra-json]
  local x=${3:-}; [ -n "$x" ] || x='{}'
  jq -nc --arg o "$1" --arg r "$2" --arg run "$RUN" --argjson x "$x" '{outcome:$o, reason:$r, run:$run} + $x'
  exit 0
}
limpiar() {
  [ -n "$RT" ] && "$RT" stop "$NOMBRE_C" >/dev/null 2>&1
  [ -n "$RT" ] && "$RT" rm -f "$NOMBRE_C" >/dev/null 2>&1
  git update-ref -d "refs/sdd-caja/$RUN" 2>/dev/null
  rm -rf "$TMP"
}
trap limpiar EXIT
trap 'limpiar; trap - EXIT; exit 143' TERM INT HUP

# ── 0. Con qué y dónde ────────────────────────────────────────────────────────────────────────────────────────────
cfg() { jq -r --arg k "$1" '.caja[$k] // empty' "$DIR/hermes-sdd.json" 2>/dev/null; }
RT=$(cfg runtime)
if [ -z "$RT" ]; then command -v container >/dev/null && RT=container || RT=docker; fi
command -v "$RT" >/dev/null || salir failed "no está «${RT}» para la caja local (Apple container o Docker)"
if [ "$RT" = container ]; then
  container system status >/dev/null 2>&1 || container system start >/dev/null 2>>"$ERR" ||
    salir failed "Apple container no está en marcha: «container system start»"
fi
[ -z "$(git status --porcelain --untracked-files=no)" ] || salir failed "el proyecto tiene cambios sin commit: la caja empieza desde un commit"
. "$ROOT/lib/token-caja.sh"
TOKEN=$(token_caja)
[ -n "$TOKEN" ] || salir failed "no hay token de Claude para la caja: $(token_caja_ayuda)"
VER=$(cat "$ROOT/templates/caja/Containerfile" | shasum | cut -c1-12)
IMG="hermes-sdd-caja:$VER"; BARGS=()
# Docker en Linux (WSL incluido): los montajes conservan el uid del anfitrión; el agente de la caja debe ser el mismo
# usuario o no puede leer ni escribir el proyecto (PcWindows, 20/11/2026). Apple container y Docker en macOS traducen.
if [ "$RT" = docker ] && [ "$(uname -s)" = Linux ]; then IMG="$IMG-u$(id -u)"; BARGS=(--build-arg "CAJA_UID=$(id -u)"); fi
if ! "$RT" image inspect "$IMG" >/dev/null 2>&1; then
  "$RT" build -t "$IMG" ${BARGS[@]+"${BARGS[@]}"} -f "$ROOT/templates/caja/Containerfile" "$ROOT/templates/caja" >>"$ERR" 2>&1 ||
    salir failed "no se pudo construir la imagen de la caja ($IMG): $(tail -c 300 "$ERR" | tr '\n' ' ')"
  # el constructor de Apple container es otra máquina de 2 GB: con 8 GB en el Mac no puede quedarse encendido
  [ "$RT" = container ] && container builder stop >/dev/null 2>&1
fi
CACHE="${HERMES_SDD_CAJA_CACHE:-$HOME/.cache/hermes-sdd-caja}"; mkdir -p "$CACHE"

# ── 1. La copia del proyecto ──────────────────────────────────────────────────────────────────────────────────────
HEAD0=$(git rev-parse HEAD)
P="$TMP/proyecto"
git clone -q --no-hardlinks "$REPO" "$P" 2>>"$ERR" || salir failed "no se pudo copiar el proyecto para la caja"
git -C "$P" checkout -q "$HEAD0" 2>>"$ERR" && git -C "$P" remote remove origin
# lo ignorado que la etapa necesita, sin lo que es del orquestador (decisiones, puertas, candado, ejecuciones, entregas)
if [ -d .sdd ]; then
  tar cf - --exclude=.sdd/hermes/decisiones --exclude=.sdd/hermes/puertas --exclude=.sdd/hermes/lock \
    --exclude=.sdd/hermes/runs --exclude=.sdd/hermes/caja --exclude=.sdd/entregas .sdd | tar xf - -C "$P"
fi
[ -f pipeline-state.json ] && cp pipeline-state.json "$P/"
[ -d evidencias ] && tar cf - --exclude='*/.playwright/*' evidencias | tar xf - -C "$P"
mkdir -p "$P/.sdd/hermes/caja"
printf '%s' "$PROMPT" > "$P/.sdd/hermes/caja/prompt.txt"
jq -n --arg n "$(git config user.name || echo hermes-sdd)" --arg e "$(git config user.email || echo hermes-sdd@localhost)" '{nombre:$n, email:$e}' > "$P/.sdd/hermes/caja/identidad.json"
ENVF="$TMP/entorno"; ( umask 077; { echo "CLAUDE_CODE_OAUTH_TOKEN=$TOKEN"; echo "MODELO=$MODELO"
  echo "TOPE_USD=${SDD_TOPE_USD:-}"; echo "TOPE_MIN=${SDD_TOPE_MIN:-60}"; echo "SDD_PASO=${SDD_PASO:-}"; echo "SDD_RUN=$RUN"; } > "$ENVF" )
unset TOKEN

# ── 2. Lanzar y esperar ───────────────────────────────────────────────────────────────────────────────────────────
# Memoria y CPU: el Mac del orquestador tiene 8 GB y va con swap; con 4 GB Apple container no llegó a arrancar la
# máquina (10 min en «Starting container»); 3 GB arrancan en 1,5 s
MEM=${HERMES_SDD_CAJA_MEMORIA:-$(cfg memoria)}; CPUS=${HERMES_SDD_CAJA_CPUS:-$(cfg cpus)}
"$RT" run --rm --name "$NOMBRE_C" -m "${MEM:-3G}" --cpus "${CPUS:-3}" \
  -v "$P:/proyecto" --mount "type=bind,source=$ROOT,target=/arnes,readonly" -v "$CACHE:/cache" -v "$S:/salida" --env-file "$ENVF" \
  "$IMG" bash /arnes/templates/caja/etapa.sh >>"$ERR" 2>&1 &
PID_C=$!
# Si la máquina no arranca (falta de memoria: se queda en «Starting container» sin fin), no se espera a ciegas: la
# caja escribe /salida/base nada más empezar
for _ in $(seq 1 "${HERMES_SDD_CAJA_ARRANQUE:-180}"); do [ -s "$S/base" ] && break; kill -0 "$PID_C" 2>/dev/null || break; sleep 1; done
if [ ! -s "$S/base" ] && kill -0 "$PID_C" 2>/dev/null; then
  "$RT" stop "$NOMBRE_C" >/dev/null 2>&1; kill "$PID_C" 2>/dev/null
  salir failed "la caja no arrancó en ${HERMES_SDD_CAJA_ARRANQUE:-180} s (¿memoria? baja caja.memoria o cierra otras máquinas virtuales)"
fi
wait "$PID_C" || echo "el contenedor terminó con error" >> "$ERR"
rm -f "$ENVF"
MIN=$(( ($(date +%s) - INICIO) / 60 ))
cp "$S/claude.json" "$OUT" 2>/dev/null; cat "$S/claude.err" >> "$ERR" 2>/dev/null
# la transcripción de la sesión (qué leyó y qué hizo): para medir, nunca para decidir; comprimida, junto al run
[ -s "$S/transcripcion.jsonl" ] && gzip -c "$S/transcripcion.jsonl" > "$DIR/runs/$RUN.transcripcion.jsonl.gz" 2>/dev/null
[ -s "$S/base" ] || salir failed "la caja terminó sin dejar su trabajo: $(tail -c 300 "$ERR" | tr '\n' ' ')" "{\"minutes\":$MIN}"

# ── 3. Validar y aplicar (lib/caja-aplicar.sh: las mismas reglas que la caja de GitHub) ──────────────────────────────
. "$ROOT/lib/caja-aplicar.sh"
caja_aplicar

# ── 4. Resultado (como executors/claude.sh) ───────────────────────────────────────────────────────────────────────
CAJA_ENLACE="caja local ($RT)"; CAJA_TOKEN_AYUDA="vuelve a ponerlo con «claude setup-token» y caja-token.sh"
caja_resultado
