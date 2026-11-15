#!/usr/bin/env bash
# Comprueba las firmas del notario de un proyecto: cada tag de aceptación (requirements-v*, fase-N-accepted,
# entrega-N) y cada acta del tablero, contra la clave pública del notario. Sin LLM; lo puede correr cualquiera que
# tenga el repo, las actas y la clave pública.
#
#   verificar.sh <repo> [--clave <ruta .pub>]     una línea por tag y por acta: OK | SIN FIRMA | FIRMA MALA; sale 1 si
#                                                 alguna firma no es del notario
set -uo pipefail
REPO=$(cd "$1" && pwd); shift
HOME_SDD="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}"
PUB=$(jq -r '.clave_notario // empty' "$HOME_SDD/sdd.json" 2>/dev/null); PUB=${PUB:-$HOME/.ssh/hermes-notario}; PUB="${PUB/#\~/$HOME}.pub"
while [ $# -gt 0 ]; do case "$1" in --clave) PUB=$2; shift 2 ;; *) echo "verificar: no entiendo «$1»" >&2; exit 2 ;; esac; done
[ -f "$PUB" ] || { echo "no encuentro la clave pública del notario ($PUB)" >&2; exit 2; }
F=$(mktemp); trap 'rm -f "$F"' EXIT
echo "hermes-sdd-notario namespaces=\"git,hermes-sdd-acta\" $(cut -d' ' -f1,2 "$PUB")" > "$F"
malas=0
for t in $(git -C "$REPO" tag -l 'requirements-v*' 'fase-*-accepted' 'entrega-*'); do
  if ! git -C "$REPO" cat-file tag "$t" 2>/dev/null | grep -q -- '-----BEGIN SSH SIGNATURE-----'; then
    echo "SIN FIRMA  tag $t"
  elif git -C "$REPO" -c gpg.ssh.allowedSignersFile="$F" tag -v "$t" >/dev/null 2>&1; then
    echo "OK         tag $t"
  else
    echo "FIRMA MALA tag $t"; malas=1
  fi
done
# Las actas de las puertas de este repo (el índice dice su tablero; sin tablero, «local»)
for g in "$HOME_SDD"/puertas/*.json; do
  [ -f "$g" ] || continue
  a=$(jq -r --arg r "$REPO" 'select(.repo == $r) | "\(if (.tablero // "") == "" then "local" else .tablero end)/\(.id // "")"' "$g" 2>/dev/null)
  [ -n "$a" ] || continue
  [ "${a##*/}" != "" ] || a="${a}$(basename "$g" .json)"
  a="$HOME_SDD/actas/$a.json"
  [ -f "$a" ] || continue
  if [ ! -f "$a.sig" ]; then echo "SIN FIRMA  acta $(basename "$a" .json)"
  elif ssh-keygen -Y verify -f "$F" -I hermes-sdd-notario -n hermes-sdd-acta -s "$a.sig" < "$a" >/dev/null 2>&1; then
    echo "OK         acta $(basename "$a" .json)"
  else
    echo "FIRMA MALA acta $(basename "$a" .json) (el acta cambió después de firmarla)"; malas=1
  fi
done
exit $malas
