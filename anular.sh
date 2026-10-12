#!/usr/bin/env bash
# ANULA una aceptación de FASE ya firmada, sin reescribir nada: añade un registro "rejected" y un tag de revocación.
# Lo usa el canal (/anular) en nombre de una persona autorizada, o una persona a mano con el canal local.
#
#   anular.sh <repo> <fase> <persona> <canal> <id-en-canal> <motivo>
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"; SDD="$ROOT/metodo/scripts/sdd.mjs"
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
REPO=$(cd "$1" && pwd); FASE=$2; PERSONA=$3; CANAL=$4; ID=$5; MOTIVO=$6
cd "$REPO"
jq -e --arg p "$PERSONA" --arg c "$CANAL" --arg i "$ID" '.[$p] and ((.[$p].canales[$c] // "")|tostring) == $i' \
  "$HOME_SDD/aprobadores.json" >/dev/null || { echo "ANULAR: $CANAL:$ID no es una identidad autorizada" >&2; exit 1; }
git rev-parse -q --verify "refs/tags/fase-$FASE-accepted" >/dev/null || { echo "ANULAR: la FASE-$FASE no está aceptada" >&2; exit 1; }
[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "ANULAR: el árbol tiene cambios sin commit" >&2; exit 1; }
NOMBRE=$(jq -r --arg p "$PERSONA" '.[$p].nombre // $p' "$HOME_SDD/aprobadores.json")
ROL=$(jq -r --arg p "$PERSONA" '.[$p].rol' "$HOME_SDD/aprobadores.json")
TS=$(date +%Y%m%d%H%M%S)
node "$SDD" accept record fase-acceptance --fase "$FASE" --result rejected \
  --channel "$CANAL:$ID anulación de fase-$FASE-accepted" --by "$NOMBRE" --role "$ROL" >/dev/null
node "$SDD" journal add --stage acceptance --kind decision --text "$NOMBRE anuló la aceptación de la FASE-$FASE: $MOTIVO" \
  --by "$NOMBRE ($ROL)" --refs "fase-$FASE-revoked-$TS" >/dev/null
git add acceptance/ status/ && git commit -qm "docs(acceptance): revoke FASE-$FASE acceptance" --trailer "Gate-Id: anular-$FASE-$TS"
git tag -a "fase-$FASE-revoked-$TS" -m "FASE-$FASE acceptance revoked

Revoked-by: $NOMBRE
Approver-role: $ROL
Channel: $CANAL:$ID
Reason: $MOTIVO
Revokes: fase-$FASE-accepted ($(git rev-parse --short "fase-$FASE-accepted^{commit}"))"
echo "FASE-$FASE: aceptación anulada por $NOMBRE (tag fase-$FASE-revoked-$TS). El tag original se conserva."
