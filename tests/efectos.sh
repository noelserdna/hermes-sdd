#!/usr/bin/env bash
# Efectos de una decisión de puerta: lo que se contesta, lo que se autoriza y lo que se enseña salen de una sola
# función (hsdd_textos.efectos_respuestas) y cumplen sus invariantes para todas las combinaciones.
#   1. Reproducción con el estado REAL de material-montana5 (FASE-2 rechazada con las recomendadas, 18-nov-2026: las
#      preguntas quedaron contestadas, el texto decía «firmado en decisions.jsonl» y autorizaciones salió vacío; la
#      FASE estuvo parada 89 min y hubo que registrar el permiso a mano — M5-12).
#   2. Propiedades sobre el producto verbo × efecto × marcada/sin marcar × persona/Jev.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TX="$ROOT/plugin/hermes-sdd/hsdd_textos.py"
fail=0; ok() { echo "ok   $1"; }; bad() { echo "FAIL $1"; fail=1; }
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# ── 1. montana5: rechazar la FASE-2 sin tocar los botones Q ─────────────────────────────────────────────────────────
r="$tmp/m5"; mkdir -p "$r"; cp -R "$ROOT/tests/fixtures/montana5-rechazo-fase2/.sdd" "$r/"
P="$ROOT/tests/fixtures/montana5-rechazo-fase2/puerta.json"
out=$(python3 "$TX" respuestas aplicar --puerta "$P" --verbo rechazo --persona 1 --quien "Ana (Cliente)" --hoy 2026-11-18 \
  --texto "Corregid CH-009 a CH-012. Preguntas: las recomendadas (Q1 A, Q2 A, Q3 A)." "$r"/.sdd/questions-*.json 2>&1)
aut=$(printf '%s' "$out" | tail -1 | jq -r '[.autorizaciones[] | .pregunta + ":" + (.endurecer|tostring)] | sort | join(",")' 2>/dev/null)
[ "$aut" = "Q-acceptance-001:true,Q-task-implementer-002:true" ] \
  && ok "montana5 M5-12: rechazar con las recomendadas autoriza ENDURECER los tests que la puerta anunciaba" \
  || bad "montana5 M5-12: autorizaciones «${aut}» (${out})"
# I2/I3: lo que queda contestado tiene su efecto; ningún texto promete un permiso que no está
python3 - "$r" "$out" <<'PY' && ok "montana5: cada pregunta contestada con permiso de test lo tiene registrado; ninguna promesa sin permiso" || bad "montana5: contestada sin efecto"
import json, sys, pathlib
repo, out = pathlib.Path(sys.argv[1]), json.loads(sys.argv[2].strip().splitlines()[-1])
aut = {a["pregunta"] for a in out["autorizaciones"]}
for f in repo.glob(".sdd/questions-*.json"):
    for q in json.loads(f.read_text())["preguntas"]:
        if q.get("estado") != "ANSWERED" or not q.get("respuesta"):
            continue
        letra = (q.get("respuesta") or {}).get("letra")
        op = next((o for o in q["opciones"] if o["letra"] == letra), {})
        if op.get("efecto") in ("editar-test", "endurecer-test") and q["id"] not in aut and q["id"] in ("Q-acceptance-001", "Q-task-implementer-002"):
            sys.exit(f"{q['id']} ANSWERED con {op['efecto']} y sin autorización")
for t in out["por_aplicar"]:
    qid = t.split(":")[0]
    if "firmado en acceptance/decisions.jsonl" in t and qid not in aut:
        sys.exit(f"{qid}: promete firma sin autorización")
PY

# ── 2. propiedades: verbo × efecto de la recomendada × marcada o no × persona o Jev ─────────────────────────────────
# Para cada combinación, en un repo nuevo con una pregunta del formato JSON:
#   I2  una pregunta queda ANSWERED solo si su efecto se cumple: con permiso de test ⇒ hay autorización registrada
#   I3  ningún texto (por_aplicar, feedback de rechazo) promete «firmado» sin autorización, ni da por elegida una abierta
#   I7  Jev nunca autoriza editar (solo endurecer): validar lo rechaza antes de contestar nada
#   R   la regla: endurecer se concede con cualquier verbo que conteste; editar, al aceptar o marcándolo
python3 - "$TX" "$tmp" <<'PY' && ok "propiedades I2, I3 e I7 en todas las combinaciones (verbo × efecto × marcada × quién)" || bad "propiedades"
import importlib.util, json, sys, pathlib, itertools, shutil
tx, base = sys.argv[1], pathlib.Path(sys.argv[2])
spec = importlib.util.spec_from_file_location("T", tx); T = importlib.util.module_from_spec(spec); spec.loader.exec_module(T)
VERBOS = {"fase": ["acepto", "observaciones", "rechazo", "descarto", "eximo", "revisado"],
          "entrega": ["acepto", "observaciones", "rechazo"], "plan": ["conforme", "cambios"],
          "requisitos": ["acepto", "cambios"], "preguntas": ["respondo"]}
EFECTOS = ["ninguno", "accion", "req-change", "editar-test", "endurecer-test"]
fallos, n = [], 0
for (tipo, verbos), ef, marcada, persona in itertools.product(VERBOS.items(), EFECTOS, (False, True), (True, False)):
    for verbo in verbos:
        n += 1
        repo = base / f"p{n}"; (repo / ".sdd").mkdir(parents=True)
        fich = ["tests/a.test.js"] if ef in T.PERMISO_TEST else []
        q = {"id": "Q-x-001", "skill": "sdd-x", "contexto": "c", "tema": "t", "estado": "OPEN", "pregunta": "¿Algo?",
             "para_cliente": "¿Algo?", "bloquea": "nada", "respuesta": None,
             "opciones": [{"letra": "A", "texto": "Uno", "recomendada": True, "efecto": ef, "cliente": "Uno", "ficheros": fich},
                          {"letra": "B", "texto": "Dos", "efecto": "ninguno", "cliente": "Dos", "ficheros": []}]}
        js = repo / ".sdd/questions-x.json"
        js.write_text(json.dumps({"version": 1, "rol": "x", "preguntas": [q]}, ensure_ascii=False))
        (repo / ".sdd/questions-x.md").write_text("# Questions\n\n## Q-x-001 [OPEN]\n")
        puerta = {"tipo": tipo, "preguntas": [{"n": 1, "id": "Q-x-001", "opciones": ["A", "B"], "recomendada": "A",
                                                "efectos": {"A": {"efecto": ef, "ficheros": fich}, "B": {"efecto": "ninguno", "ficheros": []}}}]}
        marcadas = {"1": "A"} if marcada else {}
        caso = f"{tipo}:{verbo} ef={ef} marcada={marcada} persona={persona}"
        errs = T.validar_respuestas(puerta, [js], "", verbo, persona, marcadas)
        res, _, _ = T.plan_respuestas(puerta, [js], "", verbo, marcadas)
        if not persona and ef == "editar-test" and res:
            if not errs: fallos.append(f"I7 {caso}: Jev autoriza editar")
            continue
        if errs:
            fallos.append(f"{caso}: errores inesperados {errs}"); continue
        out = T.aplicar_respuestas(puerta, [js], "", verbo, "Ana", "2026-11-18", marcadas)
        estado = json.loads(js.read_text())["preguntas"][0]["estado"]
        aut = [a["pregunta"] for a in out["autorizaciones"]]
        if estado == "ANSWERED" and ef in T.PERMISO_TEST and "Q-x-001" not in aut:
            fallos.append(f"I2 {caso}: contestada sin autorización")
        if "Q-x-001" in aut and estado != "ANSWERED":
            fallos.append(f"I2 {caso}: autorizada sin contestar")
        if any("firmado en acceptance/decisions.jsonl" in t for t in out["por_aplicar"]) and not aut:
            fallos.append(f"I3 {caso}: promete firma sin autorización")
        if res and ef == "endurecer-test" and "Q-x-001" not in aut:
            fallos.append(f"R {caso}: contestar con endurecer no lo autoriza")
        if verbo == "rechazo":
            ls = T.lineas_respuestas(puerta, [js], "", marcadas)
            if estado != "ANSWERED" and any("elegida" in l for l in ls):
                fallos.append(f"I3 {caso}: el feedback da por elegida una abierta")
print(f"{n} combinaciones")
if fallos:
    print("\n".join(fallos[:20])); sys.exit(1)
PY

[ $fail = 0 ] && echo "tests/efectos.sh: all passed"
exit $fail
