#!/usr/bin/env bash
# Table of the one text comparator (scripts/lib/match.mjs): every case comes from a real failure of a test project,
# and half of them must NOT match (a tolerant comparator that hides a wrong text is worse than a strict one).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
node --input-type=module - "$ROOT" <<'JS'
const { says, saysAll } = await import(process.argv[2] + "/scripts/lib/match.mjs");
const { templateParts } = await import(process.argv[2] + "/scripts/sdd-jev.mjs");
let fail = 0;
const t = (name, got, want) => { if (got === want) console.log("ok   " + name); else { console.log(`FAIL ${name} (got ${got}, want ${want})`); fail = 1; } };
// montana4, montana10 (E-9): «día(s)» is singular or plural, as the screen shows it
t("día(s) says «1 día de retraso»", says("Multa por 1 día de retraso", "día(s) de retraso"), true);
t("día(s) says «3 días de retraso»", says("Multa por 3 días de retraso", "día(s) de retraso"), true);
t("día(s) does not say «semanas de retraso»", says("Multa por 3 semanas de retraso", "día(s) de retraso"), false);
// montana11 (F-3): the plural after a slot, in the test's code, written as the screen shows it
const parts = templateParts("{tipo}: {n} unidades");
t("«{tipo}: {n} unidades» in code that checks «Crampones: 2 unidades»", saysAll("await expect(p).toContainText('Crampones: 2 unidades')", parts), true);
t("… and in code that checks «Piolet: 1 unidad»", saysAll("toContainText('Piolet: 1 unidad')", parts), true);
t("… and in code that composes it: `${n} unidades`", saysAll("const f = `${tipo}: ${n} unidades`", parts), true);
t("… but not in code that says «piezas»", saysAll("toContainText('Crampones: 2 piezas')", parts), false);
t("unidad(es) is not «unidade»", says("2 unidade libres", "unidad(es) libres"), false);
// exact text stays exact
t("exact text", says("se ve No hay unidades libres esas fechas", "No hay unidades libres esas fechas"), true);
t("a wrong letter does not match", says("No hay unidades libre esas fechas", "No hay unidades libres esas fechas"), false);
t("case matters", says("no hay unidades", "No hay unidades"), false);
t("an empty part says nothing wrong", says("x", ""), true);
process.exit(fail);
JS
