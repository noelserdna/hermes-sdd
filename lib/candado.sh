# Candado del repo (se carga con «source»): nunca dos etapas, ni una etapa y una firma, a la vez en el mismo proyecto.
#
#   <repo>/.sdd/hermes/lock/   pid (dueño) · arranque (hora de arranque del dueño, `ps -o lstart`) · quien (etapa |
#                              firma | ejecutor) · run (lo que hace) · desde (epoch)
#
# Lo toma etapa.sh para TODA la etapa (antes se tomaba por cada ejecución de Claude y, entre una y otra, otra etapa
# podía colarse) y firmar.sh mientras firma. Los ejecutores (executors/claude.sh, hermes.sh) lo reutilizan si su dueño
# es la etapa que los lanzó (SDD_CANDADO_PID); a mano, lo toman ellos. vigilar.sh y el encargado lo respetan.
# Robar un candado huérfano (su dueño murió) se hace con un segundo mkdir como exclusión: antes, «rm -rf; mkdir» dejaba
# que dos procesos lo robaran a la vez.
#
#   candado_tomar <repo> <quien> <run>   0: tomado (o reutilizado) · 1: ocupado (deja el dueño en CANDADO_OTRO)
#   candado_soltar                       lo suelta solo si es nuestro (no si se reutilizó el de la etapa)
#   candado_vivo <repo>                  0 si alguien vivo lo tiene (deja su «quien» en CANDADO_QUIEN)
#
# «Vivo» no es solo `kill -0 pid`: tras reiniciar la máquina el pid del dueño puede tenerlo otro proceso, y el candado
# quedaba vivo para siempre (la etapa salía «busy» y el notario con 75 sin fin). Por eso se guarda también la hora de
# arranque del dueño y un pid vivo con otra hora de arranque es otro proceso: el candado es huérfano. Un candado de un
# arnés anterior (sin «arranque») se juzga solo por el pid. Y uno con más de HERMES_SDD_CANDADO_MAX_S segundos
# (24 h por defecto; 0 = sin tope) se da por abandonado, con un aviso: ninguna etapa ni firma dura tanto.
# hsdd_nucleo.candado_vivo() aplica la misma regla en Python (plugin y encargado).

CANDADO_DIR=""; CANDADO_PROPIO=false; CANDADO_OTRO=""; CANDADO_QUIEN=""

# Hora de arranque de un pid, igual en macOS y Linux (procps): en UTC y en C para que no dependa del entorno de quien
# la escribe ni de quien la compara. Vacía si el proceso no existe o `ps` no la da (entonces manda solo el pid).
_candado_arranque() { [ -n "$1" ] && TZ=UTC LC_ALL=C ps -o lstart= -p "$1" 2>/dev/null | tr -s ' ' | sed 's/^ //; s/ $//'; }

# _candado_pid_vivo <pid> [<dir del candado>]: el pid vive y, si el candado guardó su arranque, es el mismo proceso
_candado_pid_vivo() {
  [ -n "$1" ] && kill -0 "$1" 2>/dev/null || return 1
  local guardado ahora
  guardado=""
  if [ -n "${2:-}" ] && [ -s "$2/arranque" ]; then guardado=$(tr -s ' \n' ' ' < "$2/arranque" | sed 's/^ //; s/ $//'); fi
  [ -n "$guardado" ] || return 0
  ahora=$(_candado_arranque "$1" || true)   # || true: con set -e y pipefail, un ps que falla no corta a quien llama
  [ -z "$ahora" ] || [ "$ahora" = "$guardado" ]
}

# mtime en epoch: «stat -f %m» es BSD (macOS); en GNU «-f» es otra cosa (estado del sistema de ficheros) y su salida
# rompía la resta. Se elige por la variante de stat, no probando una y otra.
_candado_mtime() {
  if stat -c %Y / >/dev/null 2>&1; then stat -c %Y "$1" 2>/dev/null || echo 0; else stat -f %m "$1" 2>/dev/null || echo 0; fi
}
_candado_edad() {  # segundos desde que se creó el directorio $1
  local m; m=$(_candado_mtime "$1"); case "$m" in ''|*[!0-9]*) m=0 ;; esac
  echo $(( $(date +%s) - m ))
}

candado_vivo() {
  local l="$1/.sdd/hermes/lock" pid desde max
  [ -d "$l" ] || return 1
  pid=$(cat "$l/pid" 2>/dev/null || true)
  CANDADO_QUIEN=$(cat "$l/quien" 2>/dev/null || echo etapa)
  if [ -z "$pid" ]; then [ "$(_candado_edad "$l")" -lt 60 ]; return; fi   # recién creado: aún escribe su pid
  _candado_pid_vivo "$pid" "$l" || return 1
  max=${HERMES_SDD_CANDADO_MAX_S:-86400}
  desde=$(cat "$l/desde" 2>/dev/null || true); case "$desde" in ''|*[!0-9]*) desde=$(_candado_mtime "$l") ;; esac
  if [ "$max" -gt 0 ] 2>/dev/null && [ $(( $(date +%s) - desde )) -gt "$max" ]; then
    echo "AVISO: el candado de $1 ($CANDADO_QUIEN $(cat "$l/run" 2>/dev/null), pid $pid) tiene más de ${max} s: se da por abandonado" >&2
    return 1
  fi
  return 0
}

candado_tomar() {
  local repo=$1 quien=$2 run=${3:-} l="$1/.sdd/hermes/lock" pid
  mkdir -p "$repo/.sdd/hermes"
  CANDADO_DIR=$l; CANDADO_PROPIO=false; CANDADO_OTRO=""
  # Lo tiene la etapa que nos lanzó: se usa el suyo
  pid=$(cat "$l/pid" 2>/dev/null || true)
  if [ -n "${SDD_CANDADO_PID:-}" ] && [ "$pid" = "$SDD_CANDADO_PID" ] && _candado_pid_vivo "$pid" "$l"; then
    [ -n "$run" ] && echo "$run" > "$l/run"
    return 0
  fi
  if ! mkdir "$l" 2>/dev/null; then
    if candado_vivo "$repo"; then
      CANDADO_OTRO="$(cat "$l/quien" 2>/dev/null || echo etapa) $(cat "$l/run" 2>/dev/null), pid $(cat "$l/pid" 2>/dev/null)"
      return 1
    fi
    # Huérfano: lo roba quien consiga crear «lock.robo» (uno solo); el resto, ocupado
    [ -d "$l.robo" ] && [ "$(_candado_edad "$l.robo")" -gt 60 ] && rmdir "$l.robo" 2>/dev/null
    mkdir "$l.robo" 2>/dev/null || { CANDADO_OTRO="otro proceso está recuperando el candado"; return 1; }
    if candado_vivo "$repo"; then rmdir "$l.robo"; CANDADO_OTRO="$(cat "$l/run" 2>/dev/null)"; return 1; fi
    rm -rf "$l"
    if ! mkdir "$l" 2>/dev/null; then rmdir "$l.robo"; CANDADO_OTRO="otro proceso lo tomó"; return 1; fi
    rmdir "$l.robo"
  fi
  # el arranque antes que el pid: quien vea el pid ya puede comparar la hora de arranque
  _candado_arranque $$ > "$l/arranque" || true; echo $$ > "$l/pid"; echo "$quien" > "$l/quien"; echo "$run" > "$l/run"; date +%s > "$l/desde"
  CANDADO_PROPIO=true
  return 0
}

candado_soltar() {
  [ "$CANDADO_PROPIO" = true ] && [ -n "$CANDADO_DIR" ] || return 0
  [ "$(cat "$CANDADO_DIR/pid" 2>/dev/null)" = "$$" ] && rm -rf "$CANDADO_DIR"
  CANDADO_PROPIO=false
  return 0
}
