#!/usr/bin/env bash
# Prepara Ubuntu (dentro de WSL2, o cualquier Ubuntu/Debian) para hermes-sdd y lo instala.
# Lo llama windows/instalar.ps1, pero también se puede ejecutar a mano dentro de Ubuntu:
#
#   bash windows/preparar-ubuntu.sh            (desde un clon)
#   curl -fsSL https://raw.githubusercontent.com/noelserdna/hermes-sdd/main/windows/preparar-ubuntu.sh -o p.sh && bash p.sh
#
# Se puede repetir: lo que ya está instalado se salta.
#   1. paquetes del sistema (git jq rsync python3 perl openssl)    5. Hermes Agent y Claude Code si faltan
#   2. Node 22 si no hay un Node ≥ 20                              6. identidad de git (avisa si falta)
#   3. Docker, para la caja local donde trabaja el agente          7. clon en ~/hermes-sdd (si no se ejecuta desde uno)
#   4. WSL: systemd y sin el PATH de Windows                       8. instalar.sh, si Hermes ya tiene un modelo configurado
# HSDD_SIN_AGENTES=1 salta el paso 5 (pruebas). Probado en PcWindows (Windows 10 22H2, Ubuntu 26.04), 20/11/2026.
set -euo pipefail
REPO_URL=https://github.com/noelserdna/hermes-sdd
paso() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
ok()   { printf '  ✓ %s\n' "$*"; }
aviso(){ printf '  ! %s\n' "$*"; }
root() { if [ "$(id -u)" = 0 ]; then "$@"; else sudo -E "$@"; fi; }   # sudo solo si hace falta
ES_WSL=""; { [ -n "${WSL_DISTRO_NAME:-}" ] || [ -e /proc/sys/fs/binfmt_misc/WSLInterop ]; } && ES_WSL=1

command -v apt-get >/dev/null || { echo "Este script es para Ubuntu/Debian (apt). En macOS: bash instalar.sh" >&2; exit 1; }
export PATH="$HOME/.local/bin:$PATH"

paso "1/8 Paquetes del sistema"
root apt-get update -qq
root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git jq rsync python3 perl openssl curl ca-certificates >/dev/null
ok "git jq rsync python3 perl openssl curl"

paso "2/8 Node.js"
mayor=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$mayor" -ge 20 ]; then ok "Node $(node -v) ya instalado"
else
  curl -fsSL https://deb.nodesource.com/setup_22.x | root bash - >/dev/null
  root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nodejs >/dev/null
  ok "Node $(node -v)"
fi

paso "3/8 Docker (la caja local)"
# La caja: cada etapa trabaja en un contenedor que se borra al acabar (executors/caja.sh); en macOS es Apple container
if command -v docker >/dev/null; then ok "Docker ya instalado"
else root env DEBIAN_FRONTEND=noninteractive apt-get install -y -qq docker.io >/dev/null && ok "Docker instalado"; fi
if [ "$(id -u)" != 0 ] && ! id -nG | tr ' ' '\n' | grep -qx docker; then
  root usermod -aG docker "$(id -un)" && aviso "añadido al grupo docker: vale desde la próxima sesión (y tras reiniciar el gateway)"
fi
if [ "$(ps -o comm= -p 1 2>/dev/null)" = systemd ]; then root systemctl enable --now docker >/dev/null 2>&1 || true; fi

paso "4/8 WSL: systemd y sin el PATH de Windows"
REINICIAR=""
if [ -z "$ES_WSL" ]; then ok "no es WSL: nada que hacer"
else
  if grep -qs '^systemd *= *true' /etc/wsl.conf; then ok "systemd ya activo"
  else printf '[boot]\nsystemd=true\n' | root tee -a /etc/wsl.conf >/dev/null; REINICIAR=1; ok "systemd activado (el gateway corre como servicio)"; fi
  # Sin esto, el PATH de Ubuntu arrastra el de Windows (/mnt/c/…: su node, npm, docker…) y puede colarse un binario
  # de Windows donde el arnés espera el de Linux (PcWindows: 61 rutas)
  if grep -qs '^appendWindowsPath *= *false' /etc/wsl.conf; then ok "PATH de Windows ya fuera"
  else printf '[interop]\nappendWindowsPath=false\n' | root tee -a /etc/wsl.conf >/dev/null; REINICIAR=1; ok "PATH de Windows fuera de Ubuntu"; fi
  if [ -n "$REINICIAR" ]; then aviso "se aplica al reiniciar Ubuntu (instalar.ps1 lo hace; a mano: wsl --terminate Ubuntu en PowerShell)"; fi
fi

paso "5/8 Hermes Agent y Claude Code"
if [ -n "${HSDD_SIN_AGENTES:-}" ]; then aviso "saltado (HSDD_SIN_AGENTES)"
else
  if command -v hermes >/dev/null; then ok "Hermes ya instalado"
  else   # --non-interactive: sin el asistente de configuración (pide modelo y claves; se configura después)
    curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash -s -- --non-interactive; export PATH="$HOME/.local/bin:$PATH"; ok "Hermes instalado"; fi
  if command -v claude >/dev/null; then ok "Claude Code ya instalado"
  else curl -fsSL https://claude.ai/install.sh | bash; ok "Claude Code instalado"; fi
fi

paso "6/8 Identidad de git"
git config --global core.autocrlf input
FALTA_GIT=""
if git var GIT_COMMITTER_IDENT >/dev/null 2>&1 && [ -n "$(git config --global user.email || true)" ]; then
  ok "$(git config --global user.name) <$(git config --global user.email)>"
else
  FALTA_GIT=1; aviso "git no sabe quién eres: los proyectos nuevos no podrían hacer su primer commit. Ponlo una vez con:"
  echo '      git config --global user.name "Tu nombre"; git config --global user.email "tu@correo"'
fi

paso "7/8 hermes-sdd"
AQUI=""; f="${BASH_SOURCE[0]:-}"   # si el script no está dentro de un clon, se clona en ~/hermes-sdd
[ -n "$f" ] && [ -f "$f" ] && AQUI="$(cd "$(dirname "$f")/.." && pwd)"
if [ -n "$AQUI" ] && [ -f "$AQUI/instalar.sh" ] && [ "${AQUI#/mnt/}" = "$AQUI" ]; then DIR=$AQUI; ok "uso el clon $DIR"
else
  DIR="$HOME/hermes-sdd"
  if [ -d "$DIR/.git" ]; then git -C "$DIR" pull -q --ff-only && ok "actualizado $DIR"
  else git clone -q "$REPO_URL" "$DIR" && ok "clonado en $DIR"; fi
fi

paso "8/8 Instalar el arnés"
modelo=$(hermes config get model.default 2>/dev/null | tail -1 || true)
if ! command -v hermes >/dev/null || [ -z "$modelo" ]; then
  aviso "Hermes aún no tiene un modelo configurado. Termina así:"
  cat <<EOF

    1. Configura Hermes (modelo y clave del proveedor, Telegram en el gateway) siguiendo su guía.
    2. hermes config set kanban.auto_decompose false
    3. claude            # inicia sesión una vez
    4. claude setup-token && bash $DIR/caja-token.sh     # el token de la caja (pégalo cuando lo pida)
    5. cd $DIR && bash instalar.sh && hermes gateway restart
EOF
  if [ -n "$FALTA_GIT" ]; then echo "    y la identidad de git (paso 6)"; fi
  exit 0
fi
cd "$DIR" && bash instalar.sh
echo; ok "Listo. Prueba: cd $DIR && bash tests/todo.sh"
if [ -n "$FALTA_GIT" ]; then aviso "falta la identidad de git (paso 6)"; fi
if [ ! -s "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/caja-token" ]; then
  aviso "falta el token de la caja: claude setup-token y luego bash $DIR/caja-token.sh"
fi
