"""Métricas de resultado de un proyecto, sin LLM: qué costó entregar, no solo cómo fue el proceso.

«0 de 12 etapas fallidas» no dice nada del resultado: en el taller todas las etapas acabaron «done» y aun así la
entrega se rechazó 2 veces y el cierre llamó 17 veces al ejecutor. Esto cuenta lo que una persona querría saber:

- entregas: cada puerta de entrega (`entrega`) o de FASE (`fase`) es un ciclo que acaba al aceptarse (acepto,
  observaciones, eximo); dentro de un ciclo se cuentan los rechazos. Las impugnaciones descartadas aparte.
- reejecuciones: la misma etapa+FASE que vuelve a aparecer en etapas.jsonl («busy» no cuenta: no llegó a
  ejecutarse), y las llamadas al ejecutor por etapa (`ejecuciones` de cada línea: el cierre del taller, 17). Las
  llamadas no se restan «de más»: aceptar hace 5 por diseño (aceptación, ronda adversarial…).
- coste: la suma de `coste_usd` de etapas.jsonl, total y dividido entre los requisitos activos de
  requirements/REQUIREMENTS.md (una media: el coste no se puede atribuir a un requisito concreto).
- atención de la persona en las puertas: `segundos_hasta_decidir` (desde que se abre hasta que decide: incluye la
  espera, es una cota superior) y `segundos_mirando` (lo que estuvo con la demo abierta, solo si la abrió).
- puertas por canal: decididas por una persona o por Jev (y cuántas de Jev deshizo una persona).
- demos vistas: decisiones de FASE/entrega tomadas de una persona con la demo abierta (`segundos_mirando`).
- desplegable: lo que dejó el cierre en .sdd/hermes/desplegable.json (sí, no, o sin comprobar).

  python3 hsdd_metricas.py <repo> [--json]
"""
from __future__ import annotations

import json
import re
import statistics
import subprocess
import sys
from pathlib import Path

ACEPTA = ("acepto", "observaciones", "eximo")
RECHAZA = ("rechazo", "corrijo")
JEV = "jev"


def _jsonl(f: Path) -> list:
    try:
        lineas = f.read_text(encoding="utf-8").splitlines()
    except OSError:
        return []
    out = []
    for l in lineas:
        try:
            out.append(json.loads(l))
        except ValueError:
            pass
    return out


def _tags(repo: Path) -> list:
    try:
        return subprocess.run(["git", "-C", str(repo), "tag", "-l"], capture_output=True, text=True, timeout=30).stdout.split()
    except Exception:
        return []


def requisitos_activos(repo: Path) -> int:
    """REQ-… con su encabezado en requirements/REQUIREMENTS.md, sin los obsoletos."""
    f = repo / "requirements" / "REQUIREMENTS.md"
    try:
        texto = f.read_text(encoding="utf-8")
    except OSError:
        return 0
    ids, actual = {}, None
    for l in texto.splitlines():
        m = re.match(r"^#+\s*(~~)?\s*(REQ-[A-Z]+-\d+)(.*)", l)
        if m:
            actual = m.group(2)
            ids[actual] = not (m.group(1) or re.search(r"\[deprecated\]|\(deprecated\)|\[obsoleto\]", m.group(3), re.I))
        elif actual and re.match(r"^\s*[-*]?\s*\**status\**\s*:", l, re.I) and re.search(r"deprecated|obsoleto", l, re.I):
            ids[actual] = False
    return sum(1 for v in ids.values() if v)


def _mediana(xs: list) -> float | None:
    return statistics.median(xs) if xs else None


def calcular(repo) -> dict:
    r = Path(repo)
    h = r / ".sdd" / "hermes"
    etapas, puertas = _jsonl(h / "etapas.jsonl"), _jsonl(h / "puertas.jsonl")

    # ── entregas: ciclos por puerta de FASE o de entrega, cerrados al aceptarse ──
    ciclos, abiertos, descartes = [], {}, 0
    for p in puertas:
        if p.get("tipo") not in ("fase", "entrega"):
            continue
        clave = (p["tipo"], str(p.get("fase") or ""))
        c = abiertos.setdefault(clave, {"tipo": p["tipo"], "fase": clave[1] or None, "rechazos": 0, "aceptada": False})
        v = p.get("verbo")
        if v in RECHAZA:
            c["rechazos"] += 1
        elif v == "descarto":
            descartes += 1
        elif v in ACEPTA:
            c["aceptada"] = True
            ciclos.append(abiertos.pop(clave))
    ciclos += [c for c in abiertos.values() if c["rechazos"]]   # en curso, con algún rechazo ya
    def _resumen_ciclos(cs):
        return {"n": len(cs), "aceptadas": sum(1 for c in cs if c["aceptada"]),
                "rechazos": sum(c["rechazos"] for c in cs), "max_rechazos": max((c["rechazos"] for c in cs), default=0),
                "detalle": cs}
    entregas = _resumen_ciclos([c for c in ciclos if c["tipo"] == "entrega"])
    fases = _resumen_ciclos([c for c in ciclos if c["tipo"] == "fase"])
    tags = _tags(r)
    entregas["tags"] = sum(1 for t in tags if t.startswith("entrega-"))

    # ── reejecuciones: misma etapa+FASE repetida y llamadas de más al ejecutor ──
    grupos: dict = {}
    for e in etapas:
        if e.get("resultado") == "busy":
            continue
        g = grupos.setdefault((e.get("etapa"), e.get("fase")), {"veces": 0, "ejecuciones": 0})
        g["veces"] += 1
        g["ejecuciones"] += len(e.get("ejecuciones") or [])
    por_etapa: dict = {}
    for (et, _f), g in grupos.items():
        x = por_etapa.setdefault(et, {"veces": 0, "ejecuciones": 0})
        x["veces"] += g["veces"]; x["ejecuciones"] += g["ejecuciones"]
    reej = {"repeticiones": sum(g["veces"] - 1 for g in grupos.values()),
            "ejecuciones": sum(g["ejecuciones"] for g in grupos.values()),
            "fallidas": sum(1 for e in etapas if e.get("resultado") == "failed"),
            "etapas": len(etapas), "por_etapa": por_etapa}

    # ── coste ──
    coste = round(sum(float(e.get("coste_usd") or 0) for e in etapas), 2)
    nreq = requisitos_activos(r)

    # ── puertas: persona/Jev, tiempo de la persona, demos ──
    de_persona = [p for p in puertas if p.get("canal") != JEV]
    seg = [p["segundos_hasta_decidir"] for p in de_persona if isinstance(p.get("segundos_hasta_decidir"), (int, float))]
    mir = [p["segundos_mirando"] for p in de_persona if isinstance(p.get("segundos_mirando"), (int, float))]
    con_demo = [p for p in de_persona if p.get("tipo") in ("fase", "entrega") and p.get("verbo") not in ("descarto",)]
    desp = None
    try:
        d = json.loads((h / "desplegable.json").read_text())
        desp = d.get("ok") if isinstance(d, dict) else None
        fallos = (d.get("fallos") or []) if isinstance(d, dict) else []
    except (OSError, ValueError):
        fallos = []
    return {
        "repo": str(r), "proyecto": r.name,
        "entregas": entregas, "fases": fases, "impugnaciones_descartadas": descartes,
        "reejecuciones": reej,
        "coste_usd": coste, "requisitos": nreq, "coste_por_requisito_usd": round(coste / nreq, 2) if nreq else None,
        "persona_en_puertas": {"decisiones": len(de_persona),
                               "min_hasta_decidir": round(sum(seg) / 60, 1), "mediana_min_hasta_decidir": round(_mediana(seg) / 60, 1) if seg else None,
                               "min_mirando": round(sum(mir) / 60, 1), "mediana_min_mirando": round(_mediana(mir) / 60, 1) if mir else None},
        "puertas_por_canal": {"persona": len(de_persona), "jev": sum(1 for p in puertas if p.get("canal") == JEV),
                              "jev_deshecho": sum(1 for p in puertas if p.get("jev_vetado"))},
        "demos": {"vistas": sum(1 for p in con_demo if isinstance(p.get("segundos_mirando"), (int, float))),
                  "decisiones": len(con_demo)},
        "desplegable": desp, "desplegable_fallos": fallos,
    }


def resumen(m: dict) -> str:
    """Una línea corta para /estado, el encargado y `hsdd_proyectos.py estado`. Vacía si no hay nada que contar."""
    if not (m["reejecuciones"]["etapas"] or m["persona_en_puertas"]["decisiones"]):
        return ""
    partes = []
    en, fa = m["entregas"], m["fases"]
    if en["n"] or en["tags"]:
        partes.append(f"entregas {max(en['aceptadas'], en['tags'])}, {en['rechazos']} rechazo(s)")
    if fa["n"]:
        partes.append(f"fases {fa['aceptadas']}, {fa['rechazos']} rechazo(s) (máx {fa['max_rechazos']} en una)")
    re_ = m["reejecuciones"]
    peor = max(re_["por_etapa"].items(), key=lambda kv: kv[1]["ejecuciones"], default=None)
    t = f"{re_['repeticiones']} reejecución(es) de etapa"
    if peor and peor[1]["ejecuciones"] > 1:
        t += f" ({peor[0]}: {peor[1]['ejecuciones']} llamadas al ejecutor)"
    partes.append(t)
    c = f"{m['coste_usd']} $"
    if m["coste_por_requisito_usd"] is not None:
        c += f" ({m['coste_por_requisito_usd']} $/requisito)"
    partes.append(c)
    pp = m["persona_en_puertas"]
    if pp["decisiones"]:
        partes.append(f"persona {pp['min_hasta_decidir']} min en {pp['decisiones']} puerta(s) (mediana {pp['mediana_min_hasta_decidir']})"
                      + (f", Jev {m['puertas_por_canal']['jev']}" if m["puertas_por_canal"]["jev"] else ""))
    if m["demos"]["decisiones"]:
        partes.append(f"demos vistas {m['demos']['vistas']}/{m['demos']['decisiones']}")
    partes.append({True: "desplegable", False: "NO desplegable", None: "desplegable sin comprobar"}[m["desplegable"]])
    return " · ".join(partes)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(args) != 1:
        print("uso: hsdd_metricas.py <repo> [--json]", file=sys.stderr)
        sys.exit(2)
    m = calcular(args[0])
    print(json.dumps(m, ensure_ascii=False, indent=1) if "--json" in sys.argv else (resumen(m) or "sin datos todavía"))
