# Lo común a las cajas (executors/github.sh y executors/caja.sh): validar y aplicar lo que devuelve la caja, y dar el
# resultado con el contrato de executors/claude.sh. Se carga con «.» desde el ejecutor, que define antes: REPO, RUN,
# HEAD0, S (la salida de la caja: base, rc, claude.json, commits.bundle, pendiente.patch, ignorados.tgz), OUT, ERR,
# MIN y salir(). Opcionales: CAJA_ENLACE (dónde ver la ejecución), CAJA_ESTADO, CAJA_TOKEN_AYUDA.

caja_aplicar() {  # nada se aplica si algo no cumple las reglas
[ "$(cat "$S/base" 2>/dev/null)" = "$HEAD0" ] || salir failed "la caja trabajó sobre otro commit que el enviado"
[ "$(git rev-parse HEAD)" = "$HEAD0" ] && [ -z "$(git status --porcelain --untracked-files=no)" ] ||
  salir failed "el proyecto cambió mientras trabajaba la caja: no se aplica nada"
if [ -s "$S/ignorados.tgz" ]; then
  MAL=$(tar tzvf "$S/ignorados.tgz" | awk '{print substr($1,1,1)}' | grep -v '^[-d]' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió enlaces o ficheros especiales: no se aplica nada"
  MAL=$(tar tzf "$S/ignorados.tgz" | grep -vE '^(pipeline-state\.json|\.sdd(/.*)?|evidencias(/.*)?)$' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió un fichero fuera de lo permitido ($MAL): no se aplica nada"
  MAL=$(tar tzf "$S/ignorados.tgz" | grep -E '(^|/)\.\.(/|$)|^\.sdd/hermes/(decisiones|puertas|lock|caja)(/|$)|^\.sdd/entregas(/|$)' | head -1)
  [ -z "$MAL" ] || salir failed "la caja devolvió decisiones, puertas o rutas no permitidas ($MAL): no se aplica nada"
fi
if [ -s "$S/commits.bundle" ]; then
  git bundle verify -q "$S/commits.bundle" >/dev/null 2>&1 || salir failed "el paquete de commits de la caja no es válido"
  git fetch -q "$S/commits.bundle" "HEAD:refs/sdd-caja/$RUN" 2>> "$ERR" || salir failed "no se pudieron traer los commits de la caja"
  NUEVO=$(git rev-parse "refs/sdd-caja/$RUN")
  git merge-base --is-ancestor "$HEAD0" "$NUEVO" || salir failed "los commits de la caja no descienden del commit enviado"
  git merge -q --ff-only "$NUEVO" 2>> "$ERR" || salir failed "no se pudo avanzar la rama con los commits de la caja"
fi
if [ -s "$S/pendiente.patch" ]; then
  git apply "$S/pendiente.patch" 2>> "$ERR" || salir failed "no se pudieron aplicar los cambios sin commit de la caja"
fi
[ -s "$S/ignorados.tgz" ] && tar xzf "$S/ignorados.tgz" -C "$REPO"

}

caja_resultado() {
CUOTA='usage limit|rate limit|limit reached|weekly limit|daily limit|session limit'
if ! jq -e . "$OUT" >/dev/null 2>&1; then
  grep -qiE "$CUOTA" "$ERR" 2>/dev/null && salir scheduled "cuota de Claude agotada" "{\"minutes\":$MIN}"
  salir failed "la caja no devolvió el resultado de Claude (${CAJA_ESTADO:-}, rc=$(cat "$S/rc" 2>/dev/null)): $(tail -c 300 "$ERR" | tr '\n' ' ')${CAJA_ENLACE:+ — $CAJA_ENLACE}" "{\"minutes\":$MIN}"
fi
EXTRA=$(jq -c --argjson m "$MIN" --arg u "${CAJA_ENLACE:-local}" '{session_id, cost_usd: .total_cost_usd, turns: .num_turns, minutes: $m,
  resumen: ((.result // "") | .[0:800]), caja: $u}' "$OUT")
if jq -e '(.subtype // "") | test("budget")' "$OUT" >/dev/null 2>&1; then
  salir failed "la ejecución llegó a su tope de gasto (${SDD_TOPE_USD:-?} \$): para seguir, sube topes.etapa_usd o topes.proyecto_usd" "$(jq -c '. + {tope:"gasto"}' <<< "$EXTRA")"
fi
TEXTO=$(jq -r '.result // ""' "$OUT")
# Token de la caja inválido o caducado: no se arregla reintentando (en local se aparca hasta /login; aquí lo arregla
# quien pone el secreto)
# Solo cuando la ejecución falló: un resumen correcto puede citar un «401» de la propia app (material-montana2:
# «E_SESSION_EXPIRED responde 401» hizo fallar dos veces un diseño técnico bien hecho)
if { [ "$(jq -r .is_error "$OUT")" = true ] || [ "$(cat "$S/rc" 2>/dev/null || echo 0)" != 0 ]; } &&
   echo "$TEXTO" | grep -qiE 'failed to authenticate|oauth (access )?token (is )?(invalid|expired)|invalid api key|(api error|status|http)[: ]+401'; then
  salir failed "Claude no acepta el token de la caja: ${CAJA_TOKEN_AYUDA:-vuelve a ponerlo con «claude setup-token»}" "$EXTRA"
fi
if [ "$(jq -r .is_error "$OUT")" = true ] || [ "$(cat "$S/rc" 2>/dev/null || echo 0)" != 0 ]; then
  echo "$TEXTO" | grep -qiE "$CUOTA" && salir scheduled "cuota de Claude agotada" "$EXTRA"
  [ "$(cat "$S/rc" 2>/dev/null)" = 124 ] && salir failed "la ejecución superó su tope de tiempo (${SDD_TOPE_MIN:-60} min)" "$(jq -c '. + {tope:"tiempo"}' <<< "$EXTRA")"
  salir failed "la etapa terminó con error: $(echo "$TEXTO" | tail -c 300 | tr '\n' ' ')" "$EXTRA"
fi
salir done "ok" "$EXTRA"
}
