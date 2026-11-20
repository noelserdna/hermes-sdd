#!/usr/bin/env bash
# El token de Claude de la caja fuera de macOS (PcWindows/WSL2, 20/11/2026: la primera etapa falló con «no hay token de
# Claude para la caja» porque caja-token.sh y caja.sh solo sabían del llavero de macOS). En Linux se guarda en un
# fichero 600 del arnés y la caja lo lee de ahí; el valor no se muestra nunca. Con un `uname` falso que dice Linux.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin" "$T/home"
printf '#!/usr/bin/env bash\n[ "$1" = -s ] && echo Linux || /usr/bin/uname "$@"\n' > "$T/bin/uname"; chmod +x "$T/bin/uname"
export HERMES_SDD_HOME="$T/home" PATH="$T/bin:$PATH"
unset CLAUDE_CODE_OAUTH_TOKEN
BUENO="sk-ant-oat01-$(printf 'a%.0s' $(seq 1 60))"
F="$T/home/caja-token"

# ── guardar: por la entrada estándar (en Linux no hay pbpaste) ──────────────────────────────────────────────────────
o=$(printf '%s\n' "$BUENO" | bash "$ROOT/caja-token.sh" 2>&1); rc=$?
[ $rc = 0 ] && [ "$(cat "$F" 2>/dev/null)" = "$BUENO" ] && ok "Linux: caja-token.sh guarda el token que recibe por la entrada" || bad "guardar: rc=$rc $o"
[ "$(stat -c %a "$F" 2>/dev/null || stat -f %Lp "$F" 2>/dev/null)" = 600 ] && ok "el fichero del token es 600" || bad "permisos: $(ls -l "$F")"
echo "$o" | grep -q "$BUENO" && bad "el token aparece en la salida" || ok "el token no se muestra"
o=$(printf 'no-es-un-token\n' | bash "$ROOT/caja-token.sh" 2>&1); rc=$?
[ $rc != 0 ] && [ "$(cat "$F")" = "$BUENO" ] && ok "lo que no tiene forma de token no se guarda (ni pisa el bueno)" || bad "malo: rc=$rc $(cat "$F")"

# ── leer: la caja lo encuentra sin variable de entorno ───────────────────────────────────────────────────────────────
. "$ROOT/lib/token-caja.sh"
[ "$(token_caja)" = "$BUENO" ] && ok "token_caja lo lee del fichero en Linux" || bad "leer: $(token_caja | wc -c)"
[ "$(CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-env token_caja)" = sk-ant-oat01-env ] && ok "la variable de entorno manda sobre lo guardado" || bad "env"
rm -f "$F"
[ -z "$(token_caja)" ] && ok "sin nada guardado, vacío" || bad "vacío"
token_caja_ayuda | grep -q "claude setup-token" && token_caja_ayuda | grep -q "caja-token.sh" && ! token_caja_ayuda | grep -q pbpaste \
  && ok "la ayuda en Linux dice cómo guardarlo, sin pbpaste" || bad "ayuda: $(token_caja_ayuda)"
exit $fail
