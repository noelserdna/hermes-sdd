#!/usr/bin/env bash
# MATRIZ DEFECTO × CONTROL SIN MODELO: qué controles deterministas del arnés cazan cada defecto sembrado del banco
# (tests/fixtures/banco/parches/sembrados, M2a) y qué dicen sobre la copia limpia (falsos positivos).
#
#   evals/medir/sembrados.sh [--json] [--solo <id>[,<id>…]] [--node-modules <proyecto>=<dir>]… [--salida <dir>]
#
# Para la copia limpia de cada proyecto y para cada parche: copia temporal del proyecto del banco, git con el banco
# como commit aceptado (tag de la última FASE, la base de --floor), el parche como commit siguiente, y cada control:
#   tests          `npx vitest run` del proyecto (solo si se da --node-modules para ese proyecto: el banco no trae
#                  dependencias); detecta si hay más tests en rojo o saltados que en la copia limpia
#   quotes captures floor stale arch
#                  `sdd lint --<control> --json`; detecta si sale distinto de 0 o hay hallazgos que la copia limpia no tiene
#   accept         `sdd accept --out -` (veredictos con el JUnit de .sdd/junit, tocado tras el commit como hace
#                  executors/replay.sh: la frescura es por mtime); detecta si algún requisito
#                  cambia de veredicto respecto a la copia limpia
#   registros      registros_ajenos de etapa.sh con el commit aceptado como «antes»; detecta si imprime algo
#   mutantes       no se ejecutan: hsdd_fidelidad.mutantes cambia textos de src/ y corre los tests (e2e incluidos)
#                  ligados al criterio; sin navegador ni dependencias no hay con qué. Sale como null, nunca como 0.
# Sin --json, una tabla Markdown; con --json, {controles, limpia: {...}, defectos: [...]}. --salida <dir> escribe
# matriz.json y matriz.md ahí. Solo lee el banco.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
JSON=false; SOLO=""; SALIDA=""; NM=()
while [ $# -gt 0 ]; do
  case "$1" in
    --json) JSON=true; shift ;;
    --solo) SOLO=${2:-}; shift 2 ;;
    --salida) SALIDA=${2:-}; shift 2 ;;
    --node-modules) NM+=("${2:-}"); shift 2 ;;
    -h|--help) sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "sembrados.sh: argumento desconocido $1" >&2; exit 2 ;;
  esac
done
command -v jq >/dev/null || { echo "sembrados.sh necesita jq" >&2; exit 2; }
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
# registros_ajenos tal cual está en etapa.sh (la función, sin el resto del script)
sed -n '/^registros_ajenos() {/,/^}/p' "$ROOT/etapa.sh" > "$T/registros.sh"
[ -s "$T/registros.sh" ] || { echo "sembrados.sh: no encuentro registros_ajenos en etapa.sh" >&2; exit 2; }
python3 - "$ROOT" "$T" "$JSON" "$SOLO" "$SALIDA" "${NM[@]+"${NM[@]}"}" <<'PY'
import json, re, shutil, subprocess, sys
from pathlib import Path
ROOT, T = Path(sys.argv[1]), Path(sys.argv[2])
JSON, SOLO, SALIDA = sys.argv[3] == "true", [s for s in sys.argv[4].split(",") if s], sys.argv[5]
NM = dict(a.split("=", 1) for a in sys.argv[6:] if "=" in a)
BANCO = ROOT / "tests/fixtures/banco"; S = BANCO / "parches/sembrados"; SDD = ROOT / "metodo/scripts/sdd.mjs"
IND = json.loads((S / "indice.json").read_text())["defectos"]
if SOLO: IND = [d for d in IND if d["id"] in SOLO]
LINTS = ["quotes", "captures", "floor", "stale", "arch"]
CONTROLES = ["tests"] + LINTS + ["accept", "registros", "mutantes"]
ENV = {"GIT_AUTHOR_NAME": "t", "GIT_AUTHOR_EMAIL": "t@t", "GIT_COMMITTER_NAME": "t", "GIT_COMMITTER_EMAIL": "t@t",
       "GIT_CONFIG_GLOBAL": "/dev/null", "PATH": __import__("os").environ["PATH"], "HOME": str(T)}

def run(cwd, *a, **k):
    return subprocess.run(a, cwd=cwd, capture_output=True, text=True, env=ENV, **k)

def copia(proy, parche=None):
    c = T / f"{proy}-{parche or 'limpia'}"
    shutil.rmtree(c, ignore_errors=True); shutil.copytree(BANCO / proy, c, symlinks=True)
    n = len(list((c / "plan/fases").glob("FASE-*.md"))) - 1
    run(c, "git", "init", "-q", "-b", "main"); run(c, "git", "add", "-A"); run(c, "git", "commit", "-qm", "banco")
    run(c, "git", "tag", f"fase-{n}-accepted")
    if parche:
        r = run(c, "git", "apply", str(S / parche))
        if r.returncode: raise SystemExit(f"{parche} no aplica: {r.stderr}")
        run(c, "git", "add", "-A"); run(c, "git", "commit", "-qm", f"sembrado {parche}")
    # la frescura de la evidencia es por mtime frente al último commit: como executors/replay.sh, se toca después
    for sub in (".sdd/junit", "evidencias"):
        for f in (c / sub).rglob("*"):
            if f.is_file(): f.touch()
    if proy in NM: (c / "node_modules").symlink_to(Path(NM[proy]).resolve())
    return c

def hallazgos(salida):
    """Los hallazgos de un lint como conjunto de cadenas comparables (sin rutas temporales ni números de línea)."""
    try: j = json.loads(salida)
    except Exception: return {l for l in salida.splitlines() if l.strip()}
    items = j.get("findings", j.get("errors", [])) if isinstance(j, dict) else j
    out = set()
    for f in items if isinstance(items, list) else []:
        if isinstance(f, dict):
            f = {k: v for k, v in f.items() if k not in ("line", "at", "base", "sha")}
        out.add(re.sub(r"/[^ \"]*/(tmp|T)/[^ \"]*", "<tmp>", json.dumps(f, sort_keys=True, ensure_ascii=False)))
    return out

def vitest(c):
    for extra in ([], ["--minWorkers=1", "--maxWorkers=2"]):
        out = T / "vt.json"; out.unlink(missing_ok=True)
        run(c, "npx", "vitest", "run", "--reporter=json", f"--outputFile={out}", *extra)
        if out.exists():
            j = json.loads(out.read_text())
            if j.get("numTotalTests"): return {"fallan": j["numFailedTests"], "saltados": j["numPendingTests"], "pasan": j["numPassedTests"]}
    return None

def medir(c, proy):
    m = {}
    m["tests"] = vitest(c) if proy in NM else None
    for l in LINTS:
        r = run(c, "node", str(SDD), "lint", f"--{l}", "--json")
        m[l] = {"salida": r.returncode, "hallazgos": sorted(hallazgos(r.stdout))}
    r = run(c, "node", str(SDD), "accept", "--out", "-")
    try: m["accept"] = {q["id"]: q.get("verdict") for q in json.loads(r.stdout)["requirements"]}
    except Exception: m["accept"] = {"_error": (r.stdout + r.stderr)[-300:]}
    base = run(c, "git", "rev-list", "-n1", "--tags").stdout.strip()
    r = subprocess.run(["bash", "-c", f'source "{T}/registros.sh"; registros_ajenos {base}'], cwd=c, capture_output=True, text=True)
    m["registros"] = r.stdout.strip() if r.returncode == 0 else ""
    m["mutantes"] = None
    return m

def compara(m, l):
    """Por control: True (lo detecta), False (no) o None (no medido). Más la razón."""
    d = {}
    if m["tests"] is None or l["tests"] is None: d["tests"] = (None, "sin dependencias del proyecto")
    else:
        rojo = m["tests"]["fallan"] - l["tests"]["fallan"]; salt = m["tests"]["saltados"] - l["tests"]["saltados"]
        d["tests"] = (rojo > 0 or salt > 0, f"{m['tests']['fallan']} rojos, {m['tests']['saltados']} saltados")
    for k in LINTS:
        nuevos = sorted(set(m[k]["hallazgos"]) - set(l[k]["hallazgos"]))
        d[k] = (m[k]["salida"] != 0 or bool(nuevos), f"salida {m[k]['salida']}, {len(nuevos)} hallazgos nuevos" + (f": {nuevos[0][:160]}" if nuevos else ""))
    cambios = {r: (l["accept"].get(r), v) for r, v in m["accept"].items() if l["accept"].get(r) != v}
    d["accept"] = (bool(cambios), ", ".join(f"{r} {a}→{b}" for r, (a, b) in cambios.items()) or "mismos veredictos")
    d["registros"] = (bool(m["registros"]), m["registros"] or "nada")
    d["mutantes"] = (None, "no ejecutados: necesitan los tests e2e del criterio")
    return {k: {"detecta": v[0], "detalle": v[1]} for k, v in d.items()}

limpias = {}
for proy in sorted({d["proyecto"] for d in IND}):
    limpias[proy] = medir(copia(proy), proy)
fp = {proy: {k: (l[k]["salida"], len(l[k]["hallazgos"])) for k in LINTS} for proy, l in limpias.items()}
filas = []
for d in IND:
    m = medir(copia(d["proyecto"], d["parche"]), d["proyecto"])
    filas.append({"id": d["id"], "tipo": d["tipo"], "proyecto": d["proyecto"], "controles": compara(m, limpias[d["proyecto"]])})
    print(f"medido {d['id']}", file=sys.stderr, flush=True)

doc = {"controles": CONTROLES, "commit_arnes": run(ROOT, "git", "rev-parse", "--short", "HEAD").stdout.strip(),
       "limpia": {p: {"lints": {k: {"salida": l[k]["salida"], "hallazgos": len(l[k]["hallazgos"])} for k in LINTS},
                      "tests": l["tests"], "registros": l["registros"] or "nada",
                      "accept": {v: sum(1 for x in l["accept"].values() if x == v) for v in set(l["accept"].values())}}
                  for p, l in limpias.items()},
       "defectos": filas}
sig = {True: "✔", False: "·", None: "—"}
md = ["| Defecto | " + " | ".join(CONTROLES) + " | ¿alguno? |", "|---|" + "---|" * (len(CONTROLES) + 1)]
for f in filas:
    c = f["controles"]; alguno = any(c[k]["detecta"] for k in CONTROLES)
    md.append(f"| {f['id']} | " + " | ".join(sig[c[k]["detecta"]] for k in CONTROLES) + f" | {'sí' if alguno else '**no**'} |")
tot = ["| recall |"]
for k in CONTROLES:
    med = [f["controles"][k]["detecta"] for f in filas if f["controles"][k]["detecta"] is not None]
    tot.append(f" {sum(med)}/{len(med)} |" if med else " — |")
md.append("".join(tot) + f" {sum(any(f['controles'][k]['detecta'] for k in CONTROLES) for f in filas)}/{len(filas)} |")
md.append("")
md.append("✔ lo detecta · · no lo detecta · — no medido. Copia limpia (falsos positivos: salida ≠ 0 de un lint en la copia limpia):")
for p, l in doc["limpia"].items():
    md.append(f"- {p}: " + ", ".join(f"{k} salida {v['salida']} ({v['hallazgos']} hallazgos)" for k, v in l["lints"].items())
              + f"; tests {l['tests'] or 'no medidos'}; registros {l['registros']}; veredictos {l['accept']}")
texto = "\n".join(md)
if SALIDA:
    Path(SALIDA).mkdir(parents=True, exist_ok=True)
    (Path(SALIDA) / "matriz.json").write_text(json.dumps(doc, ensure_ascii=False, indent=1) + "\n")
    (Path(SALIDA) / "matriz.md").write_text(texto + "\n")
print(json.dumps(doc, ensure_ascii=False, indent=1) if JSON else texto)
PY
