#!/usr/bin/env bash
# sdd demo: el guion de la demo sale de los casos de uso, los workflows y los criterios (cada criterio con su frase,
# hecha de su línea «Se ve:»), y la narración pone la voz en sus tiempos y deja un mp4 (lib/demo.mjs).
set -uo pipefail
SDD="$(cd "$(dirname "$0")/../.." && pwd)/scripts/sdd.mjs"
fail=0; pass() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
r="$tmp/app"; mkdir -p "$r/requirements" "$r/plan/fases" "$r/spec/use-cases" "$r/spec/workflows" "$r/spec/tests"; (cd "$r" && git init -q -b main)
cat > "$r/requirements/REQUIREMENTS.md" <<'MD'
### REQ-F-002: Reservar material para unas fechas
- **Statement:** THE system SHALL book
- **Priority:** Must have
- **Acceptance criteria:**
  - GIVEN "Casco" is free WHEN "lucia" books it THEN the user sees "Reserva creada: Casco del 2026-12-11 al 2026-12-13"
    - Se ve: "Reserva creada: {material} del {desde} al {hasta}" en Mis reservas
  - GIVEN no free unit WHEN "lucia" books THEN the user sees "No quedan unidades libres"
    - Se ve: "No quedan unidades libres" en Material
  - GIVEN a booking WHEN it is stored THEN the store keeps it
    - No visible: lo comprueba el almacén
MD
printf '# FASE 1: Reservar\n\n> **Requisitos:** REQ-F-002\n> **Escenarios:** AC-002-01, AC-002-02\n> **Workflows:** WF-001\n\n## Objetivo\nx\n' > "$r/plan/fases/FASE-1-RESERVAR.md"
cat > "$r/spec/tests/BDD-UC-002.md" <<'MD'
### Scenario: AC-002-01 reserva libre [REQ-F-002 AC1]
### Scenario: AC-002-02 sin unidades [REQ-F-002 AC2]
MD
cat > "$r/spec/use-cases/UC-002-reservar.md" <<'MD'
# UC-002 — Reservar material para unas fechas

## Main flow
1. Socio: elige material y fechas.
2. System: crea la reserva y muestra "Reserva creada: …" en Mis reservas.

## Extensions
- 2a. No quedan unidades libres → se rechaza. (AC-002-02)

## Exceptions & errors
MD
cat > "$r/spec/workflows/WF-001-ciclo.md" <<'MD'
# WF-001 — Ciclo de una reserva

## Steps

| # | Name | Type | Input → Output | On failure |
|---|---|---|---|---|
| 1 | Reservar | UC-002 | socio → Reservada | — |

## Navigation

| # | Screen | Actor | How to get there | What the user does |
|---|---|---|---|---|
| 1 | Material | socio | menú «Material» | elige el casco y las fechas |
MD
out=$(cd "$r" && node "$SDD" demo script --fase 1 --json); rc=$?
j() { printf '%s' "$out" | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);process.stdout.write(String(eval(process.argv[1])))})' "$1"; }
[ $rc = 0 ] && [ "$(j 'j.criterios.map(c=>c.id).join()')" = "AC-002-01,AC-002-02,REQ-F-002-AC3" ] && pass "guion: un criterio por línea «Se ve:»/«No visible:», con el id de su escenario" || bad "criterios: $out"
[ "$(j 'j.criterios[0].frase')" = "Reservar material para unas fechas. En Mis reservas se ve «Reserva creada: {material} del {desde} al {hasta}»." ] \
  && pass "guion: la frase de cada criterio dice lo que su captura comprueba (sus textos «Se ve:»)" || bad "frase: $(j 'j.criterios[0].frase')"
[ "$(j 'j.casos_de_uso[0].id + "|" + j.casos_de_uso[0].flujo.length + "|" + j.casos_de_uso[0].extensiones[0].criterios.join() + "|" + j.casos_de_uso[0].criterios.join()')" = "UC-002|2|AC-002-02|AC-002-01,AC-002-02" ] \
  && pass "guion: el caso de uso con su flujo principal, sus extensiones con su AC y sus criterios" || bad "uc: $out"
[ "$(j 'j.workflows[0].id + "|" + j.workflows[0].pasos[0].uc + "|" + j.workflows[0].navegacion[0].celdas[0]')" = "WF-001|UC-002|Material" ] \
  && pass "guion: el workflow de la FASE con sus pasos y su navegación" || bad "wf: $out"
grep -q '^## UC-002 — Reservar material para unas fechas' "$r/.sdd/demo/GUION-FASE-1.md" && grep -q 'Navegación:' "$r/.sdd/demo/GUION-FASE-1.md" \
  && pass "guion: .sdd/demo/GUION-FASE-1.md legible" || bad "md"
mkdir -p "$r/evidencias/FASE-1"
if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -loglevel error -f lavfi -i color=c=navy:s=320x240:d=3 -c:v libvpx -b:v 100k "$r/evidencias/FASE-1/WF-001-x.webm" 2>/dev/null \
   && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; then
  printf '{"video":"WF-001-x.webm","narraciones":[{"t":0.5,"texto":"Lucía reserva el casco"}]}' > "$r/evidencias/FASE-1/WF-001-x.narracion.json"
  out=$(cd "$r" && node "$SDD" demo narrate --fase 1 --tts none --json); rc=$?
  [ $rc = 0 ] && [ -s "$r/evidencias/FASE-1/WF-001-x.mp4" ] && [ "$(j 'j[0].mp4 + "|" + j[0].voice')" = "WF-001-x.mp4|null" ] \
    && pass "narrate: mp4 de cada vídeo narrado (sin TTS: sin voz, y lo dice)" || bad "narrate: $rc $out"
else pass "narrate: sin ffmpeg completo (libvpx/libx264) en esta máquina, no se prueba el mp4"; fi
[ $fail = 0 ] && echo "metodo/tests/demo: all passed"
exit $fail
