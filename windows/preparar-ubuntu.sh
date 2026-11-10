#!/usr/bin/env bash
# Prepara Ubuntu (dentro de WSL2, o cualquier Ubuntu/Debian) para hermes-sdd y lo instala.
# Lo llama windows/instalar.ps1, pero también se puede ejecutar a mano dentro de Ubuntu:
#
#   bash windows/preparar-ubuntu.sh            (desde un clon)
#   curl -fsSL https://raw.githubusercontent.com/noelserdna/hermes-sdd/main/windows/preparar-ubuntu.sh -o p.sh && bash p.sh
#
# Se puede repetir: lo que ya está instalado se salta.
#   1. paquetes del sistema (git jq rsync python3 perl openssl)    4. Hermes Agent y Claude Code si faltan
#   2. Node 22 si no hay un Node ≥ 20                              5. clon en ~/hermes-sdd (si no se ejecuta desde uno)
#   3. systemd en WSL (lo usa el gateway como servicio)           6. instalar.sh, si Hermes ya tiene un modelo configurado
# HSDD_SIN_AGENTES=1 salta el paso 4 (pruebas).
set -euo pipefail
REPO_URL=https://github.com/noelserdna/hermes-sdd
paso() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
aviso(){ printf '  ! %s\n' "$*"; }
root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -E "$@"; fi; }   # sudo solo si hace falta
ES_WSL=""; { [ -n "${WSL_DISTRO_NAME:-}" ] || [ -e /proc/sys/fs/binfmt_misc/WSLInterop ]; } && ES_WSL=1

command -v apt-get >/dev/null || { echo "Este script es para Ubuntu/Debian (apt). En macOS: bash instalar.sh" >&2; exit 1; }
export PATH="$HOME/.local/bin:$PATH"

paso "1/6 Paquetes del sistema"
root apt-get update -qq
root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git jq rsync python3 perl openssl curl ca-certificates >/dev/null
ok "git jq rsync python3 perl openssl curl"

paso "2/6 Node.js"
mayor=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$mayor" -ge 20 ]; then ok "Node $(node -v) ya instalado"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | root bash - >/dev/null
  root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  ok "Node $(node -v)"
fi

paso "3/6 systemd en WSL"
if [ -z "$ES_WSL" ]; then ok "no es WSL: nada que hacer"
elif grep -qs '^systemd *= *true' /etc/wsl.conf; then ok "ya activo"
else
  printf '[boot]\nsystemd=true\n' | root tee -a /etc/wsl.conf >/dev/null
  aviso "activado: se aplica al reiniciar Ubuntu (instalar.ps1 lo hace; a mano: wsl --shutdown en PowerShell)"
fi

paso "4/6 Hermes Agent y Claude Code"
if [ -n "${HSDD_SIN_AGENTES:-}" ]; then aviso "saltado (HSDD_SIN_AGENTES)"
else
  if command -v hermes >/dev/null; then ok "Hermes ya instalado"
  else curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash; export PATH="$HOME/.local/bin:$PATH"; ok "Hermes instalado"; fi
  if command -v claude >/dev/null; then ok "Claude Code ya instalado"
  else curl -fsSL https://claude.ai/install.sh | bash; ok "Claude Code instalado"; fi
fi

paso "5/6 hermes-sdd"
git config --global core.autocrlf input
AQUI=""; f="${BASH_SOURCE[0]:-}"   # si el script no está dentro de un clon, se clona en ~/hermes-sdd
[ -n "$f" ] && [ -f "$f" ] && AQUI="$(cd "$(dirname "$f")/.." && pwd)"
if [ -n "$AQUI" ] && [ -f "$AQUI/instalar.sh" ] && [ "${AQUI#/mnt/}" = "$AQUI" ]; then DIR=$AQUI; ok "uso el clon $DIR"
else
  DIR="$HOME/hermes-sdd"
  if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q --ff-only && ok "actualizado $DIR"
  else git clone -q "$REPO_URL" "$DIR" && ok "clonado en $DIR"; fi
fi

paso "6/6 Instalar el arnés"
modelo=$(hermes config get model.default 2>/dev/null | tail -1 || true)
if ! command -v hermes >/dev/null || [ -z "$modelo" ]; then
  aviso "Hermes aún no tiene un modelo configurado. Termina así:"
  cat <<EOF

    1. Configura Hermes (modelo y clave del proveedor, Telegram en el gateway) siguiendo su guía.
    2. hermes config set kanban.auto_decompose false
    3. claude            # inicia sesión una vez
    4. cd $DIR && bash instalar.sh && hermes gateway restart
EOF
  exit 0
fi
cd "$DIR" && bash instalar.sh
echo; ok "Listo. Prueba: cd $DIR && bash tests/todo.sh"
