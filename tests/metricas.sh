#!/usr/bin/env bash
# Métricas de resultado (hsdd_metricas.py): entregas y rechazos, reejecuciones, coste por requisito, minutos de la
# persona en las puertas, persona/Jev, demos vistas y desplegable. Datos sintéticos con la forma del taller: todas las
# etapas «done» y aun así la entrega rechazada 2 veces y el cierre con 17 llamadas al ejecutor.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME/puertas"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
M="$ROOT/plugin/hermes-sdd/hsdd_metricas.py"
R="$T/taller"; mkdir -p "$R/.sdd/hermes" "$R/requirements"; git -C "$R" init -q -b main
git -C "$R" -c user.email=t@t -c user.name=t commit -q --allow-empty -m "feat: algo"; git -C "$R" tag entrega-1

o=$(python3 "$M" "$R"); [ "$o" = "sin datos todavía" ] && ok "sin etapas ni puertas: sin datos" || bad "vacío: $o"

cat > "$R/requirements/REQUIREMENTS.md" <<'EOF'
### REQ-F-001: Uno
### REQ-F-002: Dos
### REQ-F-003: Tres [deprecated]
### REQ-NF-001: Cuatro
- **Status**: Deprecated
### REQ-C-001: Cinco
EOF
e() { echo "{\"etapa\":\"$1\",\"fase\":$2,\"resultado\":\"$3\",\"ejecuciones\":$4,\"coste_usd\":$5}"; }
{ e requisitos null done '["a"]' 0.5; e ruta null done '[]' 0; e ruta null done '[]' 0
  e implementar 0 done '["i1"]' 2; e cierre 0 done '["c1","c2","c3","c4","c5","c6","c7"]' 4
  e implementar 0 done '["i2"]' 1; e cierre 0 busy '["c8"]' 0; e cierre 0 done '["c9","c10","c11","c12","c13","c14","c15","c16","c17","c18"]' 3.5
  echo 'no es json'; } > "$R/.sdd/hermes/etapas.jsonl"
p() { echo "{\"tipo\":\"$1\",\"fase\":\"$2\",\"verbo\":\"$3\",\"canal\":\"$4\",\"segundos_hasta_decidir\":$5,\"segundos_mirando\":$6,\"jev_vetado\":${7:-false}}"; }
{ p requisitos "" acepto local 60 null; p ruta "" ruta-ligera jev 5 null; p plan "" conforme telegram 300 null true
  p entrega "" rechazo local 1200 null; p entrega "" rechazo telegram 600 90; p entrega "" descarto local 30 null
  p entrega "" observaciones telegram 900 120; } > "$R/.sdd/hermes/puertas.jsonl"

J=$(python3 "$M" "$R" --json)
q() { jq -r "$1" <<< "$J"; }
[ "$(q '.entregas.n,.entregas.aceptadas,.entregas.rechazos,.entregas.tags' | tr '\n' ' ')" = "1 1 2 1 " ] \
  && ok "la entrega: un ciclo aceptado (con observaciones) tras 2 rechazos; el tag cuenta" || bad "entregas: $(q .entregas)"
[ "$(q .impugnaciones_descartadas)" = 1 ] && ok "descartar una impugnación no es un rechazo (va aparte)" || bad "descartes"
[ "$(q '.reejecuciones.repeticiones')" = 3 ] && ok "reejecuciones: ruta, implementar 0 y cierre 0 repetidas (busy no cuenta)" || bad "repeticiones: $(q .reejecuciones)"
[ "$(q '.reejecuciones.por_etapa.cierre.ejecuciones')" = 17 ] && [ "$(q '.reejecuciones.fallidas')" = 0 ] \
  && ok "todo «done» (0 fallidas) y el cierre llamó 17 veces al ejecutor" || bad "ejecuciones: $(q .reejecuciones)"
[ "$(q ".coste_usd == 11")" = true ] && [ "$(q .requisitos)" = 3 ] && [ "$(q .coste_por_requisito_usd)" = 3.67 ] \
  && ok "coste 11 \$ entre 3 requisitos activos (sin los obsoletos)" || bad "coste: $(q .coste_usd) $(q .requisitos) $(q .coste_por_requisito_usd)"
[ "$(q '.persona_en_puertas.decisiones,.persona_en_puertas.min_hasta_decidir,.persona_en_puertas.mediana_min_hasta_decidir' | tr '\n' ' ')" = "6 51.5 7.5 " ] \
  && ok "minutos de la persona en las puertas: suma y mediana (sin las de Jev)" || bad "persona: $(q .persona_en_puertas)"
[ "$(q '.persona_en_puertas.min_mirando')" = 3.5 ] && ok "minutos mirando la demo, aparte" || bad "mirando"
[ "$(q '.puertas_por_canal.persona,.puertas_por_canal.jev,.puertas_por_canal.jev_deshecho' | tr '\n' ' ')" = "6 1 1 " ] \
  && ok "puertas por canal: persona / Jev (y las de Jev deshechas)" || bad "canal: $(q .puertas_por_canal)"
[ "$(q '.demos.vistas,.demos.decisiones' | tr '\n' ' ')" = "2 3 " ] && ok "demos vistas: 2 de 3 decisiones de entrega" || bad "demos: $(q .demos)"
[ "$(q .desplegable)" = null ] && ok "sin desplegable.json: sin comprobar" || bad "desplegable"
o=$(python3 "$M" "$R")
grep -q "entregas 1, 2 rechazo(s)" <<< "$o" && grep -q "cierre: 17 llamadas" <<< "$o" && grep -q "desplegable sin comprobar" <<< "$o" \
  && ok "resumen corto: $o" || bad "resumen: $o"

echo '{"ok": false, "fallos": ["solo escucha en localhost"]}' > "$R/.sdd/hermes/desplegable.json"
{ p fase 2 rechazo local 10 null; p fase 2 rechazo local 10 null; p fase 2 rechazo local 10 null; p fase 2 acepto local 10 null
  p fase 3 rechazo local 10 null; } >> "$R/.sdd/hermes/puertas.jsonl"
J=$(python3 "$M" "$R" --json)
[ "$(q '.fases.n,.fases.aceptadas,.fases.rechazos,.fases.max_rechazos' | tr '\n' ' ')" = "2 1 4 3 " ] \
  && ok "fases: la 2 aceptada tras 3 rechazos; la 3, en curso con uno" || bad "fases: $(q .fases)"
grep -q "NO desplegable" <<< "$(python3 "$M" "$R")" && ok "desplegable.json con ok=false: NO desplegable" || bad "no desplegable"

# se enseña donde ya se enseñan los números: la foto del proyecto (estado → /estado y el encargado)
o=$(python3 -c "
import importlib.util,sys
s=importlib.util.spec_from_file_location('p','$ROOT/plugin/hermes-sdd/hsdd_proyectos.py'); m=importlib.util.module_from_spec(s); s.loader.exec_module(m)
print(m.estado('$R','taller',[])['resultado'])")
grep -q "entregas 1, 2 rechazo(s)" <<< "$o" && ok "estado() lleva el resumen (lo leen /estado, el panel y el encargado)" || bad "estado: $o"
exit $fail
