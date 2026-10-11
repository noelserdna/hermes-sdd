#!/usr/bin/env bash
# Canal LOCAL (plan B y pruebas): registra la decisión de una persona sentada en esta máquina y llama al notario.
#
#   decidir.sh <puerta> <verbo> [texto]      p. ej.  decidir.sh t_6c9eaff4 acepto
#
# La identidad es la del usuario del sistema ($USER), que debe figurar en aprobadores.json como canal "local".
# Queda registrado que la decisión no llegó por Telegram.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
GATE=$1; VERBO=$2; TEXTO=${3:-}
IDX="$HOME_SDD/puertas/$GATE.json"
[ -f "$IDX" ] || { echo "No conozco la puerta $GATE" >&2; exit 2; }
REPO=$(jq -r .repo "$IDX")
PERSONA=$(jq -r --arg u "$USER" 'to_entries[] | select(.value.canales.local == $u) | .key' "$HOME_SDD/aprobadores.json" | head -1)
[ -n "$PERSONA" ] || { echo "$USER no está en aprobadores.json con canal local" >&2; exit 2; }
mkdir -p "$REPO/.sdd/hermes/decisiones"
jq -n --arg v "$VERBO" --arg x "$TEXTO" --arg p "$PERSONA" --arg u "$USER" --arg h "$(hostname -s)" \
  --arg a "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  '{verbo:$v, texto:$x, actor:{persona:$p, canal:"local", id:$u}, prueba:{host:$h}, at:$a}' \
  > "$REPO/.sdd/hermes/decisiones/$GATE.json"
bash "$ROOT/firmar.sh" "$REPO" "$GATE"
