#!/usr/bin/env bash
# CONTADORES SIN MODELO: lo que ya dicen los proyectos hechos con el arnés sobre si lo verificado, lo revisado y lo
# firmado se sostienen. Solo lee (bash + jq + git): no ejecuta nada del proyecto ni escribe en él.
#
#   evals/medir/contadores.sh [--json] [--indice <dir>] [<carpeta>…]
#
# <carpeta>: un proyecto o una carpeta de proyectos (los que tienen .sdd/). Sin ninguna: ~/proyectos-sdd y el banco
# (tests/fixtures/banco). --indice: el índice local de puertas (por defecto $HERMES_SDD_HOME/puertas, si existe): de él
# salen las firmas por canal y las FASEs firmadas sin ver la demo de TODAS las puertas de la máquina, también las de
# proyectos que ya no están. Sin --json, una tabla; con --json, {proyectos: […], indice: {…}, totales: {…}}.
#
# Por proyecto:
#   criterios            total y Must (.sdd/acceptance.json; es el estado en disco: .sdd no se versiona)
#   veredictos           requisitos VERIFIED / FAILING / MISSING / WAIVED, y los Must
#   blocker              hallazgos BLOCKER de feedback/IMPL-FEEDBACK-FASE-*.md en el commit de cada tag entrega-*:
#                        «abiertos» (Status OPEN) y «sin_estado» (el hallazgo no lleva Status: nadie lo cerró)
#   impugnaciones        por estado final (open, stale, resolved, dismissed); «stale» = cerrada sin comprobación
#   fases                puertas de FASE firmadas (acceptance/decisions.jsonl) y cuántas con «demo: no vista»
#   firmas               decisiones por canal (.sdd/hermes/puertas.jsonl)
#   tags                 tags del notario (fase-N-accepted, entrega-N, requirements-v*) y cuántos sin firma
#   etapas               por resultado; «failed» que eran esperas a la persona; minutos de las interrumpidas;
#                        líneas con «tarjeta» nulo
# Un contador que no se puede calcular (sin git, sin el fichero) es null, nunca 0.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JSON=false; INDICE="${HERMES_SDD_HOME:-$HOME/.hermes/hermes-sdd}/puertas"; DIRS=()
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON=true; shift ;;
    --indice) INDICE=${2:-}; shift 2 ;;
    -h|--help) sed -n '2,24p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) DIRS+=("$1"); shift ;;
  esac
done
[ ${#DIRS[@]} -gt 0 ] || DIRS=("$HOME/proyectos-sdd" "$ROOT/tests/fixtures/banco")
command -v jq >/dev/null || { echo "contadores.sh necesita jq" >&2; exit 2; }

proyectos() {  # los proyectos de una carpeta: ella misma si tiene .sdd/, o sus subcarpetas que lo tengan
  local d=${1%/}
  if [ -d "$d/.sdd" ]; then echo "$d"; return; fi
  local s; for s in "$d"/*/; do [ -d "${s}.sdd" ] && echo "${s%/}"; done
}

# BLOCKER de un IMPL-FEEDBACK (por stdin) → «abiertos sin_estado». Un hallazgo empieza en un título o en una viñeta
# «- **IF-…**»; su severidad está en la línea «Severity» o en la propia línea del hallazgo; su estado, en «Status».
# Los formatos vistos en 17 proyectos: tabla (| **Severity** | BLOCKER |), lista (- **Severity:** …  /  - Severity: …,
# con el estado en su línea o en la misma: «· Status: OPEN»), título (## IF-0-004 — CODE-REVIEW BLOCKER, con o sin
# «[OPEN]») y viñeta de una línea (- **IF-0-004** BLOCKER CODE-REVIEW…)
blocker_md() {
  awk '
    function sev_de(l) { return match(l, /BLOCKER|WARNING|INFO/) ? substr(l, RSTART, RLENGTH) : "" }
    function fin() { if (sev == "BLOCKER") { if (st == "") s++; else if (st == "OPEN") a++ } sev = ""; st = "" }
    function st_de(l) {   # «Status: OPEN» o «| **Status** | OPEN |», al principio o dentro de la línea
      if (!match(l, /Status[*: |]+[A-Za-z_-]+/)) return ""
      l = substr(l, RSTART, RLENGTH); sub(/^Status[*: |]+/, "", l); return toupper(l)
    }
    /^#+ / || /^- \*\*IF-/ {
      fin()
      if ($0 ~ /IF-/) { sev = sev_de($0); if (match($0, /\[[A-Z_-]+\]/)) st = substr($0, RSTART + 1, RLENGTH - 2) }   # «## IF-7-001 [OPEN] — …»
      next
    }
    /Severity/ && sev == "" { sev = sev_de($0) }
    st == "" { st = st_de($0) }
    END { fin(); printf "%d %d\n", a, s }'
}
blocker_json() {  # blocker_json <repo>: [{tag, abiertos, sin_estado}] por cada entrega-*; null sin git
  local r=$1 t f a s n out='[]'
  git -C "$r" rev-parse --git-dir >/dev/null 2>&1 && [ "$(git -C "$r" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$r" && pwd -P)" ] || { echo null; return; }
  for t in $(git -C "$r" tag -l 'entrega-*' | sort -V); do
    a=0; s=0
    for f in $(git -C "$r" ls-tree -r --name-only "$t" -- feedback 2>/dev/null | grep -E '^feedback/IMPL-FEEDBACK-FASE-[^/]*\.md$'); do
      n=$(git -C "$r" show "$t:$f" 2>/dev/null | blocker_md); a=$((a + ${n% *})); s=$((s + ${n#* }))
    done
    out=$(jq -c --arg t "$t" --argjson a "$a" --argjson s "$s" '. + [{tag:$t, abiertos:$a, sin_estado:$s}]' <<< "$out")
  done
  echo "$out"
}
blocker_disco() {  # lo mismo, en los ficheros que hay hoy (para los proyectos sin git, como los del banco)
  local r=$1 f a=0 s=0 n hay=false
  for f in "$r"/feedback/IMPL-FEEDBACK-FASE-*.md; do
    [ -f "$f" ] || continue; hay=true
    n=$(blocker_md < "$f"); a=$((a + ${n% *})); s=$((s + ${n#* }))
  done
  $hay && jq -nc --argjson a "$a" --argjson s "$s" '{abiertos:$a, sin_estado:$s}' || echo null
}
tags_json() {  # tags del notario y cuántos no llevan firma (ligeros, o anotados sin bloque de firma)
  local r=$1 t n=0 sin=0 lista='[]'
  git -C "$r" rev-parse --git-dir >/dev/null 2>&1 && [ "$(git -C "$r" rev-parse --show-toplevel 2>/dev/null)" = "$(cd "$r" && pwd -P)" ] || { echo null; return; }
  for t in $(git -C "$r" tag -l | grep -E '^(fase-[0-9]+-accepted|entrega-[0-9]+|requirements-v[0-9.]+)$'); do
    n=$((n + 1))
    if [ "$(git -C "$r" cat-file -t "$t" 2>/dev/null)" != tag ] || ! git -C "$r" cat-file -p "$t" 2>/dev/null | grep -qE -- '-----BEGIN (SSH|PGP) SIGNATURE-----'; then
      sin=$((sin + 1)); lista=$(jq -c --arg t "$t" '. + [$t]' <<< "$lista")
    fi
  done
  jq -nc --argjson n "$n" --argjson s "$sin" --argjson l "$lista" '{notario:$n, sin_firma:$s, cuales:$l}'
}
jsonl() { [ -s "$1" ] && jq -c . "$1" 2>/dev/null | jq -sc . || echo null; }   # un .jsonl como lista (null si no está)

proyecto_json() {
  local r=$1 acc='null'
  [ -s "$r/.sdd/acceptance.json" ] && acc=$(jq -c '{requirements: [.requirements[]? | {priority, verdict, criteria_total, n: (.criteria | length), challenges: [.challenges[]? | {state}]}]}' "$r/.sdd/acceptance.json" 2>/dev/null || echo null)
  jq -nc --arg nombre "$(basename "$r")" --argjson acc "${acc:-null}" \
    --argjson dec "$(jsonl "$r/acceptance/decisions.jsonl")" --argjson pu "$(jsonl "$r/.sdd/hermes/puertas.jsonl")" \
    --argjson et "$(jsonl "$r/.sdd/hermes/etapas.jsonl")" \
    --argjson bl "$(blocker_json "$r")" --argjson bd "$(blocker_disco "$r")" --argjson tg "$(tags_json "$r")" '
    def cuenta(f): group_by(f) | map({key: (.[0] | f | tostring), value: length}) | from_entries;
    ($acc.requirements // null | if . == null then null else map(select(.verdict != "DEPRECATED")) end) as $rq
    | {proyecto: $nombre,
       criterios: (if $rq == null then null else
         {total: ($rq | map(.criteria_total // .n // 0) | add // 0), must: ($rq | map(select(.priority == "Must") | (.criteria_total // .n // 0)) | add // 0)} end),
       veredictos: (if $rq == null then null else
         (["VERIFIED", "FAILING", "MISSING", "WAIVED"] | map({key: ., value: (. as $v | $rq | map(select(.verdict == $v)) | length)}) | from_entries)
         + {requisitos: ($rq | length),
            must: (["VERIFIED", "FAILING", "MISSING", "WAIVED"] | map({key: ., value: (. as $v | $rq | map(select(.priority == "Must" and .verdict == $v)) | length)}) | from_entries)} end),
       blocker: {entregas: $bl, en_disco: $bd},
       impugnaciones: (if $rq == null then null else ([$rq[].challenges[]?.state] as $s
         | {total: ($s | length), open: 0, stale: 0, resolved: 0, dismissed: 0} + ($s | map({state: (. // "sin-estado")}) | cuenta(.state))) end),
       fases: (if $dec == null then null else ([$dec[] | select(.type == "fase-acceptance")] as $f
         | {firmadas: ($f | length),
            demo_no_vista: ($f | map(select((.channel // "") | test("demo: ?no vista"))) | length),
            demo_sin_dato: ($f | map(select((.channel // "") | test("demo:") | not)) | length)}) end),
       firmas: (if $pu == null then null else {total: ($pu | length), por_canal: ($pu | cuenta(.canal // "sin-canal"))} end),
       tags: $tg,
       etapas: (if $et == null then null else
         {lineas: ($et | length), por_resultado: ($et | cuenta(.resultado // "sin-resultado")),
          failed: ($et | map(select(.resultado == "failed")) | length),
          failed_espera_persona: ($et | map(select(.resultado == "failed" and ((.motivo // "") | test("^esperando tus respuestas")))) | length),
          minutos_interrumpidas: ($et | map(select(.resultado == "interrumpida") | .minutos // 0) | add // 0),
          tarjeta_nula: ($et | map(select(.tarjeta == null)) | length)} end)}'
}

indice_json() {  # el índice local de puertas: firmadas por canal y FASEs firmadas con «demo: no vista»
  [ -n "$INDICE" ] && ls "$INDICE"/*.json >/dev/null 2>&1 || { echo null; return; }
  cat "$INDICE"/*.json 2>/dev/null | jq -c '{tipo, estado, canal: (.decision.actor.canal // null), demo: (.decision.prueba.demo // null)}' 2>/dev/null | jq -sc '
    map(select(.estado == "firmada")) as $f
    | {firmadas: ($f | length),
       por_canal: ($f | group_by(.canal // "sin-canal") | map({key: (.[0].canal // "sin-canal"), value: length}) | from_entries),
       fases_firmadas: ($f | map(select(.tipo == "fase")) | length),
       fases_demo_no_vista: ($f | map(select(.tipo == "fase" and .demo == "no vista")) | length)}'
}

TODOS='[]'
for d in "${DIRS[@]}"; do
  [ -d "$d" ] || { echo "no existe: $d" >&2; continue; }
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    TODOS=$(jq -c --argjson x "$(proyecto_json "$p")" '. + [$x]' <<< "$TODOS")
  done < <(proyectos "$d")
done
SALIDA=$(jq -nc --argjson p "$TODOS" --argjson i "$(indice_json)" '
  def s(f): [$p[] | f | numbers] | add // 0;
  {proyectos: $p, indice: $i,
   totales: {proyectos: ($p | length),
     blocker_en_entrega: s(.blocker.entregas // [] | map(.abiertos + .sin_estado) | add),
     impugnaciones: s(.impugnaciones.total), impugnaciones_stale: s(.impugnaciones.stale),
     fases_firmadas: s(.fases.firmadas), fases_demo_no_vista: s(.fases.demo_no_vista),
     firmas: s(.firmas.total), firmas_local: s(.firmas.por_canal.local),
     tags_notario: s(.tags.notario), tags_sin_firma: s(.tags.sin_firma),
     etapas: s(.etapas.lineas), etapas_failed: s(.etapas.failed), failed_espera_persona: s(.etapas.failed_espera_persona),
     minutos_interrumpidas: s(.etapas.minutos_interrumpidas), tarjeta_nula: s(.etapas.tarjeta_nula)}}')
if $JSON; then echo "$SALIDA" | jq .; exit 0; fi
{
  printf 'proyecto\tcrit\tMust\tVER\tFAIL\tMISS\tWAIV\tBLOCKER\timpug\tstale\tFASE\tno-vista\tfirmas\tlocal\ttags\tsin-firma\tetapas\tfailed\tespera\tmin-int\ttarj-null\n'
  echo "$SALIDA" | jq -r '
    def n: if . == null then "-" else tostring end;
    (.proyectos[] | [.proyecto, (.criterios.total | n), (.criterios.must | n), (.veredictos.VERIFIED | n), (.veredictos.FAILING | n),
      (.veredictos.MISSING | n), (.veredictos.WAIVED | n),
      (if .blocker.entregas == null then (if .blocker.en_disco == null then "-" else "(\(.blocker.en_disco.abiertos + .blocker.en_disco.sin_estado))" end)
       elif (.blocker.entregas | length) == 0 then "sin-entrega" else (.blocker.entregas | map("\(.abiertos + .sin_estado)") | join("+")) end),
      (.impugnaciones.total | n), (.impugnaciones.stale | n), (.fases.firmadas | n), (.fases.demo_no_vista | n),
      (.firmas.total | n), (.firmas.por_canal.local // (if .firmas == null then null else 0 end) | n), (.tags.notario | n), (.tags.sin_firma | n),
      (.etapas.lineas | n), (.etapas.failed | n), (.etapas.failed_espera_persona | n), (.etapas.minutos_interrumpidas | n), (.etapas.tarjeta_nula | n)]),
    (.totales | ["TOTAL (\(.proyectos))", ".", ".", ".", ".", ".", ".", (.blocker_en_entrega | n), (.impugnaciones | n), (.impugnaciones_stale | n),
      (.fases_firmadas | n), (.fases_demo_no_vista | n), (.firmas | n), (.firmas_local | n), (.tags_notario | n), (.tags_sin_firma | n),
      (.etapas | n), (.etapas_failed | n), (.failed_espera_persona | n), (.minutos_interrumpidas | n), (.tarjeta_nula | n)])
    | @tsv'
} | awk -F'\t' '   # alineada sin «column» (no está en todas las máquinas)
  { for (i = 1; i <= NF; i++) { c[NR, i] = $i; if (length($i) > w[i]) w[i] = length($i) } if (NF > nf) nf = NF }
  END { for (r = 1; r <= NR; r++) { l = ""; for (i = 1; i <= nf; i++) l = l sprintf("%-" w[i] "s  ", c[r, i]); sub(/ +$/, "", l); print l } }'
echo
echo "BLOCKER: abiertos o sin estado en el commit de cada entrega (una cifra por entrega); entre paréntesis, en disco (sin git)."
echo "$SALIDA" | jq -r 'if .indice == null then "Índice de puertas: no hay." else
  "Índice de puertas: \(.indice.firmadas) firmadas (\(.indice.por_canal | to_entries | map("\(.key) \(.value)") | join(", "))); FASEs firmadas \(.indice.fases_firmadas), con «demo: no vista» \(.indice.fases_demo_no_vista)." end'
