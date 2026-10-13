#!/usr/bin/env bash
# PRACTICAR: monta un proyecto a partir de una ejecución grabada y lo lanza con el ejecutor replay (0 $, sin LLM).
# Las puertas, el notario, el kanban y Telegram son reales; lo que hace "el agente" es lo que hizo en la grabación.
#
#   practicar.sh <grabación> <carpeta-nueva> [--sin-kanban]
#
# --sin-kanban solo prepara el repo (para pruebas automáticas que llaman a etapa.sh y decidir.sh a mano).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
G=$(cd "$1" && pwd); DEST=$2; SIN_KANBAN=${3:-}
[ -e "$DEST" ] && { echo "ERROR: $DEST ya existe" >&2; exit 1; }
git clone -q "$G/repo.bundle" "$DEST"
cd "$DEST"
git checkout -q -B main "$(cat "$G/base.txt")"
git branch -q -D master 2>/dev/null || true
T=$(git tag -l); [ -z "$T" ] || git tag -d $T >/dev/null   # las decisiones de la grabación no son las de quien practica
git remote remove origin
mkdir -p .sdd/hermes
jq -n --arg g "$G" '{ejecutor:"replay", grabacion:$g, canales:["telegram"], modelos:{}}' > .sdd/hermes/hermes-sdd.json
cp "$ROOT/metodo/templates/pipeline-state.template.json" pipeline-state.json
if [ "$SIN_KANBAN" = --sin-kanban ]; then
  bash "$ROOT/metodo/scripts/install-git-hooks.sh" -C "$DEST" --quiet
  # la CLI del método que se copia al repo puede ser más nueva que la de la grabación: commit visible
  git add .claude/sdd 2>/dev/null && { git diff --cached --quiet || git commit -qm "chore(sdd): vendor the method CLI of this harness"; }
  echo "Repo listo en $DEST"; exit 0
fi
bash "$ROOT/lanzar.sh" iniciar "$DEST"
