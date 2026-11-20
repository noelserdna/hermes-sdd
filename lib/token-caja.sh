# El token de Claude Code de la caja (local y de GitHub): dónde se guarda y de dónde se lee, en un solo sitio.
#   macOS: el llavero (servicio «hermes-sdd-caja»), como siempre.
#   Linux (y WSL): un fichero 600 del arnés, $HERMES_SDD_HOME/caja-token; no hay llavero común a todas las distros y
#   el gateway corre como servicio, sin sesión gráfica (PcWindows/WSL2, 20/11/2026: la caja no encontraba el token).
# $CLAUDE_CODE_OAUTH_TOKEN, si está, manda sobre lo guardado. El valor no se imprime nunca salvo a quien lo pide.
# Se carga con «. lib/token-caja.sh»; no necesita $ROOT.
TOKEN_CAJA_FORMA='^sk-ant-oat[0-9]+-[A-Za-z0-9_-]{40,}$'

token_caja_llavero() { [ "$(uname -s)" = Darwin ] && command -v security >/dev/null; }
token_caja_fichero() { echo "${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/caja-token"; }

token_caja() {  # imprime el token (o nada)
  if [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]; then printf '%s\n' "$CLAUDE_CODE_OAUTH_TOKEN"; return; fi
  if token_caja_llavero; then security find-generic-password -s hermes-sdd-caja -w 2>/dev/null | tr -d '[:space:]'; echo
  else cat "$(token_caja_fichero)" 2>/dev/null | tr -d '[:space:]'; echo; fi | grep . || true
}

token_caja_guardar() {  # token_caja_guardar <token>: lo guarda donde toca; 1 si no tiene forma de token
  printf '%s' "$1" | grep -qE "$TOKEN_CAJA_FORMA" || return 1
  if token_caja_llavero; then
    security add-generic-password -U -s hermes-sdd-caja -a claude -w "$1" >/dev/null 2>&1 || return 2
  else
    local f; f=$(token_caja_fichero); mkdir -p "$(dirname "$f")"
    ( umask 077; printf '%s\n' "$1" > "$f.n" ) && chmod 600 "$f.n" && mv "$f.n" "$f" || return 2
  fi
  [ "$(token_caja)" = "$1" ] || [ -n "${CLAUDE_CODE_OAUTH_TOKEN:-}" ]
}

token_caja_donde() { token_caja_llavero && echo "el llavero de macOS (hermes-sdd-caja)" || echo "$(token_caja_fichero) (600)"; }

token_caja_ayuda() {  # cómo guardarlo, en este sistema
  if token_caja_llavero; then
    echo "Ejecuta «claude setup-token», copia SOLO la cadena sk-ant-oat01-… y lanza caja-token.sh (lo toma del portapapeles)."
  else
    echo "Ejecuta «claude setup-token» y guarda la cadena sk-ant-oat01-… con: bash caja-token.sh (te la pide; no se ve al pegarla)."
  fi
}
