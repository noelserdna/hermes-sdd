#!/usr/bin/env bash
# Encargado, fase 2 (preparar la entrada): lanzar.sh preparar deja el repo y el tablero sin tarjetas; el encargado
# recoge la entrada y encargado.sh lanzar la commitea y arranca; la etapa de requisitos depura los de partida.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
export HERMES_SDD_HOME="$T/home"; mkdir -p "$HERMES_SDD_HOME"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
mkdir -p "$T/bin"; echo 0 > "$T/n"
cat > "$T/bin/hermes" <<H
#!/usr/bin/env bash
case "\$*" in
  "kanban boards list --json") echo '[{"slug":"demo"}]' ;;
  "kanban --board "*" create "*)
    n=\$(( \$(cat "$T/n") + 1 )); echo \$n > "$T/n"
    t=\$(printf '%s\n' "\$@" | sed -n '5p'); echo "t\$n|\$t" >> "$T/cartas"; echo "{\"id\":\"t\$n\"}" ;;
  *) echo "hermes falso: \$*" >&2; exit 1 ;;
esac
H
chmod +x "$T/bin/hermes"; export PATH="$T/bin:$PATH"

R="$T/demo"; mkdir -p "$R/intent"; cd "$R"
git init -q -b main && git config user.email t@t && git config user.name t && git config commit.gpgsign false
printf '# INT-001\n\nPetición literal:\n\n> Una web para prestar libros del club de lectura\n' > intent/INT-001.md
printf 'wiki/\n' > .gitignore; cp "$ROOT/templates/AGENTS.md" AGENTS.md 2>/dev/null || echo "# demo" > AGENTS.md
git add -A && git commit -qm init

# 1. preparar: repo y tablero, ninguna tarjeta
o=$(bash "$ROOT/lanzar.sh" preparar "$R" 2>&1)
[ -f .sdd/hermes/preparando ] && [ ! -s "$T/cartas" ] && ok "lanzar.sh preparar: deja el proyecto en preparación sin crear tarjetas" || bad "preparar: $o $(cat "$T/cartas" 2>/dev/null)"

# 2. lo que haría el encargado: intake y requisitos casi listos de la persona
mkdir -p intent/INT-001 requirements
printf '## Q-intake-001 [ANSWERED] skill=encargado\nQuestion: ¿Quién presta?\nOptions:\n  A) El bibliotecario (recommended)\nAnswer: A — elegida por Ana (2026-11-11)\n' > intent/INT-001/intake.md
printf '# Requisitos\n\n- Un socio puede tener 3 libros\n- Los préstamos duran 14 días\n- El bibliotecario da de alta socios\n' > requirements/REQUIREMENTS.md
o=$(bash "$ROOT/encargado.sh" lanzar "$R" 2>&1)
git log -1 --format=%s | grep -q "entrada preparada con el encargado" && [ -z "$(git status --porcelain)" ] \
  && ok "encargado.sh lanzar: commitea intent/ y requirements/ (el wiki queda fuera)" || bad "commit: $(git log -1 --format=%s) $(git status --short)"
[ ! -f .sdd/hermes/preparando ] && cmp -s requirements/REQUIREMENTS.md .sdd/hermes/requisitos-de-partida.md && grep -q "|Requisitos$" "$T/cartas" \
  && ok "…guarda los requisitos de partida, sale de preparación y crea la tarjeta de Requisitos" || bad "lanzar: $o $(cat "$T/cartas" 2>/dev/null)"
o=$(bash "$ROOT/encargado.sh" lanzar "$R" 2>&1) && bad "lanza dos veces" || { echo "$o" | grep -q "no está en preparación" && ok "lanzar otra vez: no (ya se lanzó)" || bad "segunda vez: $o"; }

# 3. la etapa de requisitos DEPURA los de partida (prompt) y lee el intake
mkdir -p .sdd/hermes && echo '{"ejecutor":"claude","ejecutores":{"requisitos":"../tests/ejecutor-falso"}}' > .sdd/hermes/hermes-sdd.json
FALSO_PROMPT="$T/prompt" HERMES_SDD_SIN_KANBAN=1 bash "$ROOT/etapa.sh" "$R" requisitos >/dev/null 2>&1
grep -q "DEPÚRALOS, no los reescribas" "$T/prompt" 2>/dev/null && grep -q "intent/INT-001/intake.md" "$T/prompt" && [ -f .sdd/hermes/requisitos-depurados ] \
  && ok "requisitos de partida: la etapa los depura (no los reescribe) y lee el intake" || bad "prompt: $(head -c 300 "$T/prompt" 2>/dev/null)"

# 4. la puerta dice de dónde se partía
o=$(python3 "$ROOT/plugin/hermes-sdd/hsdd_textos.py" puerta requisitos "$R" --partida .sdd/hermes/requisitos-de-partida.md 2>/dev/null | jq -r .texto)
echo "$o" | grep -q "Partías de tus requisitos (3)" && ok "puerta de requisitos: «Partías de tus requisitos (3)» y dónde ver qué cambió" || bad "puerta: $o"
exit $fail
