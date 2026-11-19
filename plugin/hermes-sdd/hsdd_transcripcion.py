"""Qué hizo una sesión de etapa, leído de su transcripción (executors/caja.sh la guarda en
.sdd/hermes/runs/<run>.transcripcion.jsonl.gz): turnos, herramientas, qué ficheros leyó y cuánto, por carpeta, y cuántas
veces buscó. Sirve para MEDIR (¿cuánto lee una etapa de los documentos del método? ¿cuánto tarda en encontrar algo?),
nunca para decidir.

  python3 hsdd_transcripcion.py resumen <transcripcion.jsonl[.gz]> [--json]
  python3 hsdd_transcripcion.py proyecto <repo> [--json]        todas las sesiones del proyecto, por etapa
"""
import gzip, json, re, sys
from collections import Counter, defaultdict
from pathlib import Path

CARPETAS = ("requirements", "spec", "design", "ux", "plan", "task", "test", "audits", "acceptance", "evidencias",
            "intent", "wiki", ".sdd", "src", "tests")
BUSCA = re.compile(r"(^|[;&|]\s*)(grep|rg|find|ls|tree)\b")
LEE = re.compile(r"(^|[;&|]\s*)(cat|sed|head|tail|less|awk)\b[^|;&]*?\s([\w./-]+\.\w+)")


def _abrir(f: Path):
    return gzip.open(f, "rt", encoding="utf-8", errors="replace") if str(f).endswith(".gz") else open(f, encoding="utf-8", errors="replace")


def _carpeta(ruta: str) -> str:
    r = re.sub(r"^(/proyecto/|\./)", "", ruta or "")
    primera = r.split("/", 1)[0]
    return primera if primera in CARPETAS else ("raíz" if "/" not in r else "otros")


def resumen(f: Path) -> dict:
    herramientas, busquedas, leidos = Counter(), 0, defaultdict(lambda: {"veces": 0, "caracteres": 0})
    pendientes, turnos, resultado, uso = {}, 0, {}, Counter()
    with _abrir(f) as t:
        for linea in t:
            try:
                m = json.loads(linea)
            except ValueError:
                continue
            if m.get("type") == "assistant":
                turnos += 1
                for k, v in ((m.get("message") or {}).get("usage") or {}).items():
                    if isinstance(v, (int, float)):
                        uso[k] += v
                for c in (m.get("message") or {}).get("content") or []:
                    if c.get("type") != "tool_use":
                        continue
                    n, i = c.get("name", "?"), c.get("input") or {}
                    herramientas[n] += 1
                    if n == "Read":
                        pendientes[c.get("id")] = i.get("file_path", "")
                    elif n in ("Grep", "Glob"):
                        busquedas += 1
                    elif n == "Bash":
                        cmd = str(i.get("command", ""))
                        if BUSCA.search(cmd):
                            busquedas += 1
                        for mm in LEE.finditer(cmd):
                            pendientes.setdefault(c.get("id"), mm.group(3))
            elif m.get("type") == "user":
                for c in (m.get("message") or {}).get("content") or []:
                    if isinstance(c, dict) and c.get("type") == "tool_result" and c.get("tool_use_id") in pendientes:
                        ruta = pendientes.pop(c["tool_use_id"])
                        cont = c.get("content")
                        largo = len(cont) if isinstance(cont, str) else sum(len(x.get("text", "")) for x in cont or [] if isinstance(x, dict))
                        leidos[ruta]["veces"] += 1
                        leidos[ruta]["caracteres"] += largo
            elif m.get("type") == "result":
                resultado = {k: m.get(k) for k in ("num_turns", "total_cost_usd", "duration_ms", "is_error")}
    por_carpeta = defaultdict(lambda: {"ficheros": 0, "lecturas": 0, "caracteres": 0})
    for ruta, d in leidos.items():
        c = por_carpeta[_carpeta(ruta)]
        c["ficheros"] += 1; c["lecturas"] += d["veces"]; c["caracteres"] += d["caracteres"]
    return {"transcripcion": f.name, "mensajes": turnos, "herramientas": dict(herramientas.most_common()),
            "busquedas": busquedas, "lecturas": sum(d["veces"] for d in leidos.values()),
            "por_carpeta": dict(sorted(por_carpeta.items(), key=lambda kv: -kv[1]["caracteres"])),
            "mas_leidos": sorted(({"ruta": re.sub(r"^/proyecto/", "", r), **d} for r, d in leidos.items()),
                                 key=lambda x: -x["caracteres"])[:10],
            "tokens": {k: int(v) for k, v in uso.items() if "tokens" in k}, "resultado": resultado}


def proyecto(repo: Path) -> list:
    out = []
    for f in sorted((repo / ".sdd" / "hermes" / "runs").glob("*.transcripcion.jsonl*")):
        r = resumen(f)
        r["etapa"] = re.sub(r"^\d{8}-\d{6}-", "", f.name.split(".transcripcion")[0])
        out.append(r)
    return out


def _texto(r: dict) -> str:
    l = [f"{r.get('etapa', r['transcripcion'])}: {r['mensajes']} mensajes del modelo, {r['lecturas']} lecturas, {r['busquedas']} búsquedas"]
    for c, d in r["por_carpeta"].items():
        l.append(f"   {c:<12} {d['ficheros']:>3} ficheros {d['lecturas']:>4} lecturas {d['caracteres'] // 1000:>6} k caracteres")
    return "\n".join(l)


if __name__ == "__main__":
    a = sys.argv[1:]
    if len(a) >= 2 and a[0] in ("resumen", "proyecto"):
        res = resumen(Path(a[1])) if a[0] == "resumen" else proyecto(Path(a[1]))
        if "--json" in a:
            print(json.dumps(res, ensure_ascii=False, indent=1))
        else:
            print("\n".join(_texto(r) for r in (res if isinstance(res, list) else [res])))
        sys.exit(0)
    print(__doc__, file=sys.stderr); sys.exit(2)
