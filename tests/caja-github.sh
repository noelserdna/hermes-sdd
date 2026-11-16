#!/usr/bin/env bash
# executors/github.sh sin GitHub: un `gh` falso hace de GitHub Actions (clona la rama temporal de un origin local, hace
# lo que diga el escenario y deja el artefacto como el workflow). Se prueba lo que hace el ordenador con lo que vuelve
# de la caja: lo aplica si es legítimo y no aplica nada si trae decisiones, puertas, enlaces o commits ajenos.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
export HERMES_SDD_HOME="$T/home" HERMES_SDD_REINTENTOS_DESCARGA=1; mkdir -p "$HERMES_SDD_HOME"
echo '{"commit": "0123456789abcdef0123456789abcdef01234567"}' > "$HERMES_SDD_HOME/instalacion.json"
git init -q --bare "$T/origin.git"
R="$T/r"; mkdir -p "$R"; cd "$R"; git init -q -b main; git config user.email t@t; git config user.name t
printf '.sdd/\npipeline-state.json\nevidencias/\n' > .gitignore; echo hola > a.txt; git add -A; git commit -qm init
git remote add origin "$T/origin.git"; git push -q origin main
mkdir -p .sdd/hermes; echo '{"ejecutor":"github","github":{"repo":"yo/prueba"}}' > .sdd/hermes/hermes-sdd.json
echo '{"etapa":"x"}' > pipeline-state.json

mkdir -p "$T/bin"
cat > "$T/bin/gh" <<G
#!/usr/bin/env bash
case "\$1 \$2" in
  "workflow view") exit 0 ;;
  "workflow run") printf '%s\n' "\$@" > "$T/lanzado"; echo \$(( \$(cat "$T/n" 2>/dev/null || echo 6) + 1 )) > "$T/n"; echo x >> "$T/lanzamientos"; exit 0 ;;
  "run list") case "\$*" in *join*) cat "$T/n" 2>/dev/null ;; *) cat "$T/n" 2>/dev/null ;; esac ;;
  "run view") case "\$*" in *conclusion*) echo success ;; *) [ -n "\${COLA:-}" ] && [ "\$3" = "\$COLA" ] && echo queued || echo completed ;; esac ;;
  "run cancel") echo cancelada >> "$T/cancelada" ;;
  "run download")
    if [ -n "\${FALLA_DESCARGA:-}" ] && [ ! -f "$T/descarga-fallo" ]; then touch "$T/descarga-fallo"; echo "HTTP 503: Egress is over the account limit" >&2; exit 1; fi
    D=""; while [ \$# -gt 0 ]; do [ "\$1" = -D ] && D=\$2; shift; done
    rama=\$(grep -A1 '^--ref$' "$T/lanzado" | tail -1)
    W="$T/runner"; rm -rf "\$W"; git clone -q -b "\$rama" "$T/origin.git" "\$W"; cd "\$W"
    git config user.email caja@t; git config user.name caja
    BASE=\$(git rev-parse HEAD~1); git reset -q --mixed "\$BASE"
    [ -f .sdd/hermes/caja/prompt.txt ] && cp .sdd/hermes/caja/prompt.txt "$T/prompt-recibido"
    [ -f pipeline-state.json ] && cp pipeline-state.json "$T/contexto-recibido"
    case "\${ESCENARIO:-}" in
      bien) echo trabajo > b.txt; git add b.txt; git commit -qm "feat: b"; echo pendiente >> a.txt
            mkdir -p evidencias/FASE-0 .sdd/hermes; echo png > evidencias/FASE-0/x.png; echo '{"etapa":"y"}' > pipeline-state.json ;;
      decision) mkdir -p .sdd/hermes/decisiones; echo '{"verbo":"acepto"}' > .sdd/hermes/decisiones/g1.json ;;
      enlace) ln -s /etc/passwd .sdd/enlace ;;
      fuera) echo x > .sdd/../notas.txt; mkdir -p wiki; echo x > wiki/w.md ;;
      ajeno) git checkout -q --orphan otra; git rm -rq --cached . ; echo x > z; git add z; git commit -qm otra ;;
    esac
    mkdir -p "\$D"; S="\$D"; echo "\$BASE" > "\$S/base"
    [ "\$(git rev-parse HEAD)" = "\$BASE" ] || git bundle create -q "\$S/commits.bundle" "\$BASE..HEAD" 2>/dev/null || git bundle create -q "\$S/commits.bundle" HEAD
    git diff HEAD --binary > "\$S/pendiente.patch" 2>/dev/null
    L=(); for f in pipeline-state.json .sdd evidencias; do [ -e "\$f" ] && L+=("\$f"); done
    if [ "\${ESCENARIO:-}" = fuera ]; then L+=(wiki); fi
    tar czf "\$S/ignorados.tgz" --exclude=.sdd/hermes/caja "\${L[@]}"
    if [ "\${ESCENARIO:-}" = decision ]; then tar czf "\$S/ignorados.tgz" --exclude=.sdd/hermes/caja "\${L[@]}"; fi
    R=hecho; [ "\${ESCENARIO:-}" = bien401 ] && R="Diseño hecho: E_SESSION_EXPIRED responde 401"
    echo '{"type":"result","subtype":"success","is_error":false,"total_cost_usd":0.5,"num_turns":3,"result":"'"\$R"'"}' > "\$S/claude.json"
    echo 0 > "\$S/rc" ;;
  "api -X") exit 0 ;;
  *) exit 0 ;;
esac
G
chmod +x "$T/bin/gh"; export PATH="$T/bin:$PATH"
corre() { out=$(ESCENARIO=$1 SDD_TOPE_USD=4.5 bash "$ROOT/executors/github.sh" "$R" "implementar-0" "haz la tarea" sonnet 2>/dev/null | tail -1); }

H0=$(git rev-parse HEAD)
corre bien
jq -e '.outcome == "done" and .cost_usd == 0.5 and .turns == 3 and (.caja | test("actions/runs/7"))' <<< "$out" >/dev/null && ok "bien: done con coste y enlace a la ejecución" || bad "bien: $out"
[ "$(git log -1 --format=%s)" = "feat: b" ] && [ "$(git rev-parse HEAD~1)" = "$H0" ] && ok "sus commits entran por fast-forward sobre el commit enviado" || bad "commits: $(git log --oneline | head -3)"
git diff --quiet a.txt; [ $? = 1 ] && ok "lo que dejó sin commit queda pendiente (etapa.sh lo commitea a la vista)" || bad "pendiente"
[ -f evidencias/FASE-0/x.png ] && grep -q '"y"' pipeline-state.json && ok "vuelven las evidencias y el estado del método" || bad "ignorados"
grep -q 'haz la tarea' "$T/prompt-recibido" && grep -q '"x"' "$T/contexto-recibido" && ok "la caja recibió el prompt y el contexto ignorado" || bad "contexto"
grep -qx 'tope_usd=4.5' "$T/lanzado" && grep -qx 'arnes=0123456789abcdef0123456789abcdef01234567' "$T/lanzado" && grep -qx 'modelo=sonnet' "$T/lanzado" \
  && ok "lanza con el tope, el modelo y el commit del arnés" || bad "lanzado: $(cat "$T/lanzado")"
! git -C "$T/origin.git" branch --list 'sdd-caja/*' | grep -q . && ok "la rama temporal se borra al acabar" || bad "rama: $(git -C "$T/origin.git" branch)"
git checkout -q a.txt
# la descarga falla una vez («503 Egress…», taller3) y a la siguiente baja: la etapa sale bien
H1=$(git rev-parse HEAD); rm -f "$T/descarga-fallo"
out=$(FALLA_DESCARGA=1 ESCENARIO=bien bash "$ROOT/executors/github.sh" "$R" "implementar-0" "x" 2>/dev/null | tail -1)
jq -e '.outcome == "done"' <<< "$out" >/dev/null && [ -f "$T/descarga-fallo" ] \
  && ok "una descarga fallida se reintenta y la etapa sale bien" || bad "reintento de descarga: $out"
git checkout -q a.txt
# un «401» en el resumen de una etapa que salió bien no es el token de la caja (material-montana2, M4)
corre bien401
jq -e '.outcome == "done"' <<< "$out" >/dev/null && ok "un 401 citado en un resumen correcto no se toma por token rechazado" || bad "401: $out"
git checkout -q a.txt
# GitHub deja el run en cola sin máquina: pasado el tope se cancela y se relanza (material-montana2, M5/M8)
rm -f "$T/cancelada" "$T/lanzamientos"
out=$(COLA=$(( $(cat "$T/n") + 1 )) HERMES_SDD_COLA_MIN=0 HERMES_SDD_PAUSA=0 HERMES_SDD_PAUSA_ID=0 ESCENARIO=bien bash "$ROOT/executors/github.sh" "$R" "implementar-0" "x" 2>/dev/null | tail -1)
jq -e '.outcome == "done"' <<< "$out" >/dev/null && [ "$(wc -l < "$T/lanzamientos" | tr -d ' ')" = 2 ] && [ -s "$T/cancelada" ] \
  && ok "un run en cola sin máquina se cancela y se relanza" || bad "cola: $out / lanzamientos $(cat "$T/lanzamientos" 2>/dev/null | wc -l)"
git checkout -q a.txt
rm -f "$T/lanzamientos"
out=$(COLA=$(( $(cat "$T/n") + 1 )) HERMES_SDD_COLA_MIN=0 HERMES_SDD_RELANZAR=0 HERMES_SDD_PAUSA=0 ESCENARIO=bien bash "$ROOT/executors/github.sh" "$R" "implementar-0" "x" 2>/dev/null | tail -1)
jq -e '.outcome == "failed" and .cola == true' <<< "$out" >/dev/null && ok "sin relanzamientos que queden, falla diciendo que GitHub no dio máquina" || bad "cola sin relanzar: $out"
git checkout -q a.txt

for esc in decision enlace fuera ajeno; do
  H=$(git rev-parse HEAD); corre "$esc"
  if jq -e '.outcome == "failed"' <<< "$out" >/dev/null && [ "$(git rev-parse HEAD)" = "$H" ] && [ ! -e .sdd/hermes/decisiones/g1.json ] && [ ! -e .sdd/enlace ] && [ ! -e wiki ]; then
    ok "$esc: no se aplica nada ($(jq -r .reason <<< "$out" | cut -c1-70))"
  else bad "$esc: $out $(git log --oneline -1)"; fi
done
echo x >> a.txt; corre bien
jq -e '.outcome == "failed" and (.reason | test("cambios sin commit"))' <<< "$out" >/dev/null && ok "con cambios sin commit no se lanza" || bad "sucio: $out"
git checkout -q a.txt
# lanzar.sh preparar con «ejecutor»: «github» en sdd.json: repo público en GitHub, workflow de la caja y aviso del token
mkdir -p "$T/bin2"
cat > "$T/bin2/gh" <<G
#!/usr/bin/env bash
echo "\$*" >> "$T/gh2.log"
case "\$1 \$2" in
  "api user") echo yo ;;
  "repo create") git init -q --bare "$T/nuevo.git"; git remote add origin "$T/nuevo.git" ;;
  "repo view") echo yo/proyecto-caja ;;
  "secret list") exit 0 ;;
esac
G
cat > "$T/bin2/hermes" <<'H'
#!/usr/bin/env bash
case "$*" in *"boards list"*) echo '[]' ;; esac
H
printf '#!/usr/bin/env bash\nexit 44\n' > "$T/bin2/security"   # sin token en el llavero
chmod +x "$T/bin2/gh" "$T/bin2/hermes" "$T/bin2/security"
echo '{"ejecutor": "github"}' > "$HERMES_SDD_HOME/sdd.json"
P2="$T/Proyecto-Caja"; mkdir -p "$P2"; cd "$P2"; git init -q -b main; git config user.email t@t; git config user.name t
echo x > README.md; git add -A; git commit -qm init
o=$(PATH="$T/bin2:$PATH" bash "$ROOT/lanzar.sh" preparar "$P2" 2>&1)
grep -q 'repo create yo/proyecto-caja --public' "$T/gh2.log" && ok "crea el repo en GitHub, público" || bad "repo: $(cat "$T/gh2.log")"
[ "$(jq -r .ejecutor .sdd/hermes/hermes-sdd.json)" = github ] && git ls-files --error-unmatch .github/workflows/sdd-etapa.yml >/dev/null 2>&1 \
  && ok "el proyecto queda con ejecutor github y el workflow de la caja commiteado" || bad "workflow: $(git ls-files | head)"
[ "$(git -C "$T/nuevo.git" rev-parse main 2>/dev/null)" = "$(git rev-parse HEAD)" ] && ok "y subido a la rama por defecto (el workflow tiene que estar ahí)" || bad "push"
echo "$o" | grep -q 'falta el token de Claude en yo/proyecto-caja' && echo "$o" | grep -q 'pbpaste' && ok "avisa de que falta el token y cómo ponerlo" || bad "aviso: $o"
# con el token en el llavero, el repo nuevo lo recibe solo (sin mostrarlo)
printf '#!/usr/bin/env bash\ncase "$*" in *"-s hermes-sdd-caja -w"*) echo " sk-ant-oat01-falsofalsofalsofalsofalsofalsofalsofalso " ;; *) exit 44 ;; esac\n' > "$T/bin2/security"
cat >> "$T/bin2/gh" <<G
case "\$1 \$2" in "secret set") cat > "$T/secreto-puesto" ;; esac
G
P3="$T/Otro"; mkdir -p "$P3"; cd "$P3"; git init -q -b main; git config user.email t@t; git config user.name t
echo x > README.md; git add -A; git commit -qm init; rm -rf "$T/nuevo.git"
o=$(PATH="$T/bin2:$PATH" bash "$ROOT/lanzar.sh" preparar "$P3" 2>&1)
[ "$(cat "$T/secreto-puesto" 2>/dev/null)" = "sk-ant-oat01-falsofalsofalsofalsofalsofalsofalsofalso" ] && echo "$o" | grep -q 'desde el llavero' && ! echo "$o" | grep -q 'sk-ant' \
  && ok "con el token en el llavero, el repo nuevo lo recibe solo y sin mostrarlo" || bad "llavero: $o / $(cat "$T/secreto-puesto" 2>&1)"
# lo del llavero no tiene forma de token (taller2: otra cosa del portapapeles): no se pone, se avisa
printf '#!/usr/bin/env bash\ncase "$*" in *"-s hermes-sdd-caja -w"*) echo "https://otra-cosa-del-portapapeles" ;; *) exit 44 ;; esac\n' > "$T/bin2/security"
rm -f "$T/secreto-puesto"; P4="$T/Tercero"; mkdir -p "$P4"; cd "$P4"; git init -q -b main; git config user.email t@t; git config user.name t
echo x > README.md; git add -A; git commit -qm init; rm -rf "$T/nuevo.git"
o=$(PATH="$T/bin2:$PATH" bash "$ROOT/lanzar.sh" preparar "$P4" 2>&1)
[ ! -f "$T/secreto-puesto" ] && echo "$o" | grep -q 'no tiene forma de token' && ! echo "$o" | grep -q 'otra-cosa' \
  && ok "lo del llavero sin forma de token no se pone en el repo (y no se muestra)" || bad "token malo: $o"
rm -f "$HERMES_SDD_HOME/sdd.json"; cd "$R"
exit $fail
