#!/usr/bin/env bash
# Canal LOCAL (plan B y pruebas): registra la decisión de una persona sentada en esta máquina y llama al notario.
#
#   decidir.sh <puerta> <verbo> [texto]      p. ej.  decidir.sh t_6c9eaff4 acepto
#   decidir.sh --en <segundos|config> <puerta> <verbo> [texto]
#   decidir.sh <puerta> deshacer
#
# Sin --en el notario firma en el acto (no hay ventana para deshacer). Con --en la decisión queda «decidida» con su
# hora de firma (los segundos dados, o «config»: la ventana de `nuevo.sh config --deshacer`) y la firma el gateway al
# vencer, como las de Telegram; mientras tanto `decidir.sh <puerta> deshacer` la devuelve a «abierta» (solo quien
# decidió). Si el gateway no está en marcha, no se firma hasta que arranque.
#
# La identidad es la del usuario del sistema ($USER), que debe figurar en aprobadores.json como canal "local".
# Queda registrado que la decisión no llegó por Telegram. La decisión pasa por el núcleo, como la de cualquier canal
# (hsdd_nucleo.py decidir: puerta abierta, un verbo que la puerta ofrece, su motivo si lo pide, con el cerrojo del
# índice), y el estado de la puerta solo cambia por sus transiciones (hsdd_nucleo.py transicion).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
EN=""
if [ "${1:-}" = --en ]; then EN=${2:-}; shift 2 || { echo "uso: decidir.sh --en <segundos|config> <puerta> <verbo> [texto]" >&2; exit 2; }; fi
[ $# -ge 2 ] || { echo "uso: decidir.sh [--en <segundos|config>] <puerta> <verbo> [texto] | decidir.sh <puerta> deshacer" >&2; exit 2; }
GATE=$1; VERBO=$2; TEXTO=${3:-}
NUCLEO=(env HERMES_SDD_HOME="$HOME_SDD" python3 "$ROOT/plugin/hermes-sdd/hsdd_nucleo.py")
IDX="$HOME_SDD/puertas/$GATE.json"
[ -f "$IDX" ] || { echo "No conozco la puerta $GATE" >&2; exit 2; }
REPO=$(jq -r .repo "$IDX")
if [ "$VERBO" = ver ]; then   # ▶ Ver demo, como en Telegram: dice dónde está y deja constancia de que se vio
  F=$(jq -r '.fase // empty' "$IDX"); D="$REPO/evidencias/FASE-${F:-0}"
  env HERMES_SDD_HOME="$HOME_SDD" python3 -c 'import sys, time; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N; N.marcar(sys.argv[2], ver_at=time.time())' \
    "$ROOT/plugin/hermes-sdd" "$GATE" >/dev/null || exit 2
  echo "Demo: $D ($(ls "$D"/*.png 2>/dev/null | wc -l | tr -d ' ') capturas; vídeo: $(ls "$D"/*.mp4 "$D"/*.webm 2>/dev/null | head -1 || echo ninguno))"
  exit 0
fi
if [ "$VERBO" = deshacer ] && [ -z "$EN" ]; then   # por la tabla de transiciones: decidida → abierta
  "${NUCLEO[@]}" deshacer "$GATE" local "$USER" || exit 2
  echo "Deshecha: la puerta $GATE vuelve a estar abierta"; exit 0
fi
"${NUCLEO[@]}" decidir "$GATE" "$VERBO" "$TEXTO" local "$USER" "$(jq -nc --arg h "$(hostname -s)" '{host:$h}')" ${EN:+"$EN"} >/dev/null || exit 2
if [ -n "$EN" ]; then   # la firma el gateway al vencer la ventana
  cuando=$(jq -r '.firmar_en | floor | todate' "$IDX" 2>/dev/null || echo "?")
  echo "Decidida: se firma a las $cuando (UTC) si no la deshaces con: bash $ROOT/decidir.sh $GATE deshacer"
  lat=$(jq -r '.ts // empty' "$HOME_SDD/latido.json" 2>/dev/null || true)
  if [ -z "$lat" ] || [ $(( $(date +%s) - $(jq -rn --arg t "$lat" '$t | sub("\\.[0-9]+";"") | fromdateiso8601' 2>/dev/null || echo 0) )) -gt 120 ]; then
    echo "AVISO: no hay latido reciente del gateway: no se firmará hasta que arranque (hermes gateway restart)" >&2
  fi
  exit 0
fi
# El notario firma ahora (el gateway no firma el canal local). Si una etapa u otra firma tiene el repo (sale 75), espera.
avisado=false; rc=0
for _ in $(seq 1 720); do
  rc=0; OUT=$(bash "$ROOT/firmar.sh" "$REPO" "$GATE") || rc=$?
  [ "$rc" = 75 ] || break
  $avisado || { echo "El repo está ocupado (una etapa o una firma en marcha): espero para firmar…" >&2; avisado=true; }
  sleep "${HERMES_SDD_ESPERA_FIRMA_S:-5}"
done
if [ "$rc" = 0 ]; then
  printf '%s\n' "$OUT"
  # Lo firmado lo deja el notario estructurado en el índice («firma»: resultado, negativo, tag, resumen); la última línea
  # de su salida solo cuenta si falta (un notario anterior a ese campo)
  RES=$(jq -r '.firma.resumen // empty' "$IDX" 2>/dev/null || true)
  "${NUCLEO[@]}" transicion "$GATE" firmada resultado="${RES:-$(printf '%s\n' "$OUT" | tail -1)}"
else
  "${NUCLEO[@]}" transicion "$GATE" error error="el notario rechazó la decisión local" || true
  exit "$rc"
fi
