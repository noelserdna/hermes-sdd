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
  - GIVEN no free unit WHEN "lucia" books THEN the user sees "No quedan unidades libres" and no booking is created
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
# El THEN entero de cada criterio en el guion: el texto en off dice también lo que no es un texto de «Se ve» (que no se
# crea la reserva), porque Jev lo compara con el criterio (gastos-cena2: 14 de 23 vídeos no lo decían)
[ "$(j 'j.criterios[1].then')" = 'the user sees "No quedan unidades libres" and no booking is created' ] \
  && grep -qF '  El criterio pide: the user sees "No quedan unidades libres" and no booking is created' "$r/.sdd/demo/GUION-FASE-1.md" \
  && pass "guion: cada criterio con su THEN entero, para narrar también lo que no es un texto" || bad "then: $(j 'j.criterios[1].then')"
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
# el test no espera a que se lea cada frase: el montaje congela la imagen donde no cabe (material-montana3: las esperas
# de narrar eran más de la mitad de cada suite e2e)
tl=$(node --input-type=module -e '
import { filmTimeline, readingSeconds } from "'"$(dirname "$SDD")"'/lib/demo.mjs";
const r = filmTimeline([{ t: 1, d: 3 }, { t: 2, d: 0.5 }, { t: 6, d: 2 }], 7);
console.log(JSON.stringify({ f: r.pieces.map((p) => p.freeze), o: r.offsets, rd: readingSeconds("x".repeat(40)) }));')
[ "$tl" = '{"f":[0,3.2,0,0.7,0,2.2,0],"o":[1,5.6,10.3],"rd":2.6}' ] \
  && pass "narrate: congela cada frase al salir su rótulo lo que pide su voz, y la acción corta va más lenta" || bad "filmTimeline: $tl"
# la cartela que presenta el criterio se congela en su propio fotograma (hold), no en el último antes de la frase
# siguiente: para entonces el test ya abrió la app (material-montana11: el vídeo de prueba congelaba una página en blanco)
tl=$(node --input-type=module -e '
import { filmTimeline } from "'"$(dirname "$SDD")"'/lib/demo.mjs";
const r = filmTimeline([{ t: 0, d: 10, hold: 0.3 }, { t: 1.3, d: 1 }], 5);
console.log(JSON.stringify({ p: r.pieces.map((p) => [p.from, p.to, p.freeze]), o: r.offsets }));')
[ "$tl" = '{"p":[[0,0.3,10.1],[0.3,1.3,0],[1.3,1.5,1.2],[1.5,null,0]],"o":[0,11.6]}' ] \
  && pass "narrate: la presentación del criterio se congela en su fotograma y la demostración sigue después" || bad "filmTimeline hold: $tl"
# un criterio con parte visible y parte no visible: la cartela y su voz dicen qué no se ve (material-montana11)
pr=$(node --input-type=module -e '
import { presentacion } from "'"$(dirname "$SDD")"'/lib/demo.mjs";
const r = { id: "REQ-F-002", title: "Gestionar socios", plain: null, criteria: ["a", "b"] };
const p = presentacion(r, 2, { titulos: ["Alta", "Restablecer"], pasos: [{ k: "Entonces", texto: "ve \"Hecho\"" }], noVisible: "entra con la nueva: lo comprueba el test de la API" });
console.log(JSON.stringify({ nv: p.no_visible, voz: p.voz }));')
case "$pr" in *'"nv":"entra con la nueva: lo comprueba el test de la API"'*'Esto no se ve en pantalla: entra con la nueva: lo comprueba el test de la API. Ahora, la demostración.'*) pass "presentación: lo que no se ve se escribe y se dice como tal";; *) bad "presentación no visible: $pr";; esac
# montaje de la FASE: un mp4 con los vídeos de cada criterio en el orden del guion (requisito y criterio), para que
# quien revisa vea todos seguidos (material-montana11: la puerta enseñaba 1 vídeo de 7 a 16); y el de la entrega, con
# los montajes de todas las FASEs
if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; then
  m="$tmp/mont"; mkdir -p "$m/evidencias/FASE-1" "$m/evidencias/FASE-2" "$m/.sdd/demo"; (cd "$m" && git init -q)
  hacer() { ffmpeg -loglevel error -f lavfi -i "color=c=$2:s=320x240:d=$3" -f lavfi -i "sine=d=$3" -shortest -c:v libx264 -pix_fmt yuv420p -c:a aac "$m/evidencias/FASE-$1/$4.mp4"
    printf '{"video":"%s.webm","narraciones":[{"t":0,"texto":"x","criterio":"%s"}]}' "$4" "$5" > "$m/evidencias/FASE-$1/$4.narracion.json"; }
  hacer 1 red 1 v-b AC-002-02; hacer 1 blue 2 v-a AC-002-01; hacer 2 green 1 v-c AC-003-01
  printf '{"criterios":[{"id":"AC-002-01","req":"REQ-F-002","ac":1},{"id":"AC-002-02","req":"REQ-F-002","ac":2}]}' > "$m/.sdd/demo/GUION-FASE-1.json"
  printf '{"criterios":[{"id":"AC-003-01","req":"REQ-F-003","ac":1}]}' > "$m/.sdd/demo/GUION-FASE-2.json"
  out=$(cd "$m" && node "$SDD" demo montaje --fase 1 --json); rc=$?
  dur() { ffprobe -v error -show_entries format=duration -of csv=p=0 "$1" | cut -d. -f1; }
  [ $rc = 0 ] && [ "$(j 'j.clips.join()')" = "v-a.mp4,v-b.mp4" ] && [ -s "$m/evidencias/FASE-1/MONTAJE-FASE-1.mp4" ] && [ "$(dur "$m/evidencias/FASE-1/MONTAJE-FASE-1.mp4")" = 3 ] \
    && pass "montaje: la FASE en un mp4, criterio a criterio en el orden del guion" || bad "montaje fase: $rc $out"
  (cd "$m" && node "$SDD" demo montaje --fase 2 >/dev/null)
  out=$(cd "$m" && node "$SDD" demo montaje --entrega --json); rc=$?
  [ $rc = 0 ] && [ -s "$m/evidencias/ENTREGA/MONTAJE-ENTREGA.mp4" ] && [ "$(dur "$m/evidencias/ENTREGA/MONTAJE-ENTREGA.mp4")" = 4 ] \
    && pass "montaje: la entrega con los montajes de todas las FASEs" || bad "montaje entrega: $rc $out"
  # el montaje no es un vídeo de criterio: ni se narra ni entra en otro montaje
  out=$(cd "$m" && node "$SDD" demo montaje --fase 1 --json)
  [ "$(j 'j.clips.join()')" = "v-a.mp4,v-b.mp4" ] && pass "montaje: rehacerlo no se incluye a sí mismo" || bad "montaje repetido: $out"
else pass "montaje: sin ffmpeg con libx264 en esta máquina, no se prueba"; fi
# G-9 (montana12, FASE-1 AC-009-01, tiempos reales; el webm medía 2,92 s): «Lucía pulsa Cancelar» se decía con la
# imagen congelada al FINAL de su tramo, ya con «Reserva cancelada», y el clic duraba 0,1 s: no se veía la acción.
# Mientras suena cada frase se ve el momento en que aparece su rótulo (antes de la acción) y después la acción, a una
# velocidad que se pueda seguir
g9=$(node --input-type=module -e '
import { filmTimeline, readingSeconds } from "'"$(dirname "$SDD")"'/lib/demo.mjs";
import { readFileSync, readdirSync } from "node:fs";
const dir = "'"$(cd "$(dirname "$0")/../../.." && pwd)"'/tests/fixtures/banco/material-montana12/evidencias/FASE-1";
const n = JSON.parse(readFileSync(dir + "/" + readdirSync(dir).find((f) => f.includes("AC-009-01") && f.endsWith(".narracion.json")), "utf8"));
const dur = 2.92;
const items = n.narraciones.map((x) => ({ t: x.t, d: readingSeconds(x.voz || x.texto), ...(x.presentacion ? { hold: 0.3 } : {}) }));
const { pieces, offsets } = filmTimeline(items, dur);
const at = (T) => { let a = 0; for (const p of pieces) { const to = p.to ?? dur, k = p.slow || 1, play = (to - p.from) * k;
  if (T < a + play) return p.from + (T - a) / k; a += play; if (T < a + p.freeze) return to; a += p.freeze; } return dur; };
const mal = [];
items.forEach((x, i) => { if (i === 0) return; const s = at(offsets[i] + x.d / 2); if (s < x.t || s > x.t + 0.4) mal.push(`frase ${i}: se ve ${s.toFixed(2)} s, su rótulo sale en ${x.t}`); });
const filmDe = (a, b) => { let f = 0; for (const p of pieces) { const to = p.to ?? dur, k = p.slow || 1; f += Math.max(0, Math.min(to, b) - Math.max(p.from, a)) * k; } return f; };
const accion = filmDe(items[1].t, items[2].t);
if (accion < 1) mal.push(`la acción entre la frase 1 y la 2 dura ${accion.toFixed(2)} s en el vídeo`);
console.log(mal.join("; ") || "ok");')
[ "$g9" = ok ] && pass "narrate (montana12 G-9): cada frase se oye sobre el momento de su rótulo y la acción se ve después" || bad "narrate G-9: $g9"
# G-8 (montana12, FASE-0 AC-002-01): el webm empezó ya en «Entrar», sin la cartela, y la voz del requisito sonó sobre
# el formulario. La cartela es una imagen que el fixture guarda aparte (cartelas/<vídeo>.png) y la película la pone
# delante con su voz, la haya grabado o no el vídeo; la acción sigue a velocidad que se pueda seguir
if command -v ffmpeg >/dev/null 2>&1 && ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libx264; then
  c="$tmp/g8"; mkdir -p "$c/evidencias/FASE-0/cartelas"; (cd "$c" && git init -q)
  ffmpeg -loglevel error -f lavfi -i color=c=white:s=320x240:d=2.2 -c:v libvpx -b:v 100k "$c/evidencias/FASE-0/v.webm"
  ffmpeg -loglevel error -f lavfi -i color=c=0x0f172a:s=320x240 -frames:v 1 "$c/evidencias/FASE-0/cartelas/v.png"
  printf '{"video":"v.webm","narraciones":[{"t":0.01,"texto":"Requisito REQ-F-001","voz":"Requisito funcional 1: Entrar y salir. Tiene 8 criterios de aceptación.","presentacion":"AC-002-01","imagen":"cartelas/v.png","hasta":0.42},{"t":0.63,"texto":"Lucía entra"},{"t":1.03,"texto":"Lucía pulsa Salir"}]}' > "$c/evidencias/FASE-0/v.narracion.json"
  (cd "$c" && node "$SDD" demo narrate --fase 0 --tts none >/dev/null 2>&1)
  luz() { ffmpeg -v error -ss "$1" -i "$c/evidencias/FASE-0/v.mp4" -frames:v 1 -vf scale=1:1 -f rawvideo -pix_fmt gray - 2>/dev/null | od -An -tu1 | tr -d ' '; }
  l1=$(luz 1); l8=$(luz 6.5)
  [ -n "$l1" ] && [ "$l1" -lt 60 ] && [ -n "$l8" ] && [ "$l8" -gt 200 ] \
    && pass "narrate (montana12 G-8): la cartela sale con su voz aunque el vídeo no la grabara" || bad "narrate G-8: luz en 1 s=$l1 (cartela oscura), al final=$l8"
fi
[ $fail = 0 ] && echo "metodo/tests/demo: all passed"

exit $fail
