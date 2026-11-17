"""Comprobaciones mecánicas del plan (sin LLM).

dependencias: criterios de un requisito planificado en la FASE N que citan una pantalla o vista que entrega una
FASE posterior (biblioteca, 11/11/2026: «Mis préstamos» en criterios de la FASE-1 cuando esa vista llega en la
FASE-3; la FASE quedaba bloqueada en su puerta sin poder cumplirse).

Una cita («…» o "…") de un criterio cuenta como pantalla de otra FASE cuando aparece en el título de un requisito
o de una FASE posterior y en ningún título de esa FASE o de las anteriores.

forma: lo que la granularidad pide al plan y a las tareas (antes, frases del prompt que el agente olvidaba; taller:
7 ficheros y 675 líneas para una FASE compacta; montana: tareas de «verificar criterios»). Una línea por fallo.

Uso: python3 hsdd_plan.py dependencias <repo> [--texto]
     python3 hsdd_plan.py forma <repo> plan|tareas <compacta|normal|fina>
"""
import json
import re
import sys
from pathlib import Path

REQ = re.compile(r"REQ-[A-Z]+-\d+")


def _requisitos(repo: Path) -> dict:
    f = repo / "requirements" / "REQUIREMENTS.md"
    if not f.exists():
        return {}
    out = {}
    for m in re.finditer(r"^### (REQ-[A-Z]+-\d+):?\s*(.*?)\n(.*?)(?=^### |^## |\Z)", f.read_text(), re.M | re.S):
        crit = [l.strip()[2:] for l in m.group(3).splitlines() if re.match(r"\s+- (GIVEN|WHEN|IF|WHILE)\b", l)]
        out[m.group(1)] = {"titulo": m.group(2).strip(), "criterios": crit}
    return out


def _fases(repo: Path) -> dict:
    """{n: {"titulo", "requisitos"}} desde la cabecera de plan/fases/FASE-N-*.md."""
    out = {}
    for f in sorted((repo / "plan" / "fases").glob("FASE-*.md")):
        m = re.match(r"FASE-0*(\d+)", f.name)
        if not m:
            continue
        cab = f.read_text().split("\n## ", 1)[0]
        titulo = next((l.lstrip("# ").strip() for l in cab.splitlines() if l.startswith("# ")), f.stem)
        linea = next((l for l in cab.splitlines() if re.search(r"\b(Requisitos|Requirements)\b[*\s]*:", l, re.I)), "")
        out[int(m.group(1))] = {"titulo": titulo, "requisitos": REQ.findall(linea), "texto": f.read_text()}
    return out


def _citas(texto: str) -> list:
    citas = re.findall(r"«([^»]{3,60})»", texto) + re.findall(r'"([^"]{3,60})"', texto)
    return [c.strip() for c in citas if re.search(r"[A-Za-zÁÉÍÓÚÑáéíóúñ]{3}", c)]


def dependencias(repo) -> list:
    repo = Path(repo)
    reqs, fases = _requisitos(repo), _fases(repo)
    if not reqs or not fases:
        return []
    primera = {}
    for n in sorted(fases):
        for r in fases[n]["requisitos"]:
            primera.setdefault(r, n)
    # títulos que entrega cada FASE: el suyo y los de sus requisitos
    titulos = {n: [fases[n]["titulo"]] + [reqs[r]["titulo"] for r in fases[n]["requisitos"] if r in reqs] for n in fases}
    hallazgos = []
    for r, n in sorted(primera.items(), key=lambda x: (x[1], x[0])):
        if r not in reqs:
            continue
        # lo que entregan esa FASE y las anteriores: títulos y también su texto (club, 13/11/2026: el plan adelantó una
        # vista mínima de «Mis reservas» a la FASE-0 en el cuerpo, y solo mirar títulos daba un aviso grave falso)
        antes = " | ".join([t for m in fases if m <= n for t in titulos[m]] + [fases[m]["texto"] for m in fases if m <= n]).lower()
        for i, c in enumerate(reqs[r]["criterios"], 1):
            for cita in _citas(c):
                k = cita.lower()
                if k in antes:
                    continue
                despues = next((m for m in sorted(fases) if m > n and any(k in t.lower() for t in titulos[m])), None)
                if despues is not None:
                    hallazgos.append({"fase": n, "requisito": r, "criterio": f"AC{i}", "cita": cita, "fase_vista": despues})
    return hallazgos


def texto(h: list) -> str:
    return "\n".join(f"- {x['requisito']} {x['criterio']} (FASE-{x['fase']}) cita «{x['cita']}», que llega en la "
                     f"FASE-{x['fase_vista']}" for x in h)


TAREA = re.compile(r"^\s*- \[[ xX]\] (TASK-[A-Za-z0-9-]+)(.*)$", re.M)
VERIFICAR = re.compile(r"\b(verif\w*|comprob\w*|check)\b.{0,40}\b(criteri\w*|constraint\w*|restricci\w*|acceptance)\b", re.I)
RECORRIDO = re.compile(r"e2e|end to end|journey|recorrido|playwright|\.spec\.", re.I)
TOPES = {"compacta": (3, 6), "normal": (2, 10)}   # normal: «unas 4 a 8», con margen; fina: sin tope


def forma(repo, que: str, gran: str) -> list:
    """Fallos de forma del plan o de las tareas según la granularidad: lista de frases (vacía si está bien)."""
    r, out = Path(repo), []
    fases = sorted((r / "plan" / "fases").glob("FASE-*.md"))
    if que == "plan":
        if any("HARDENING" in f.name.upper() for f in fases) and gran in ("compacta", "normal"):
            out.append("hay una FASE de endurecimiento (HARDENING): sus criterios medidos van en la FASE que entrega el recorrido que miden")
        if gran == "compacta":
            if [f.name.split("-")[1] for f in fases] != ["0"]:
                out.append(f"un plan compacto tiene exactamente una FASE, la FASE-0 (hay {len(fases)}: {', '.join(f.name for f in fases)})")
            if "Plan-Size:** compact" not in ((r / "plan" / "PLAN.md").read_text(encoding="utf-8") if (r / "plan" / "PLAN.md").exists() else ""):
                out.append("plan/PLAN.md no dice '> **Plan-Size:** compact'")
            sobran = [x for x in ("plan/ARCHITECTURE.md", "plan/RESEARCH.md", "plan/CLARIFY-LOG.md", "plan/fases/README.md", "plan/fase-plans")
                      if (r / x).exists()]
            if sobran:
                out.append(f"un plan compacto no lleva {', '.join(sobran)}")
    else:
        tf = sorted((r / "task").glob("TASK-FASE-*.md"))
        if gran == "compacta" and (r / "task" / "TASK-ORDER.md").exists():
            out.append("unas tareas compactas no llevan task/TASK-ORDER.md")
        lo, hi = TOPES.get(gran, (0, 10 ** 6))
        for f in tf:
            ts = TAREA.findall(f.read_text(encoding="utf-8", errors="replace"))
            if ts and not lo <= len(ts) <= hi:
                out.append(f"{f.name} tiene {len(ts)} tareas; con granularidad {gran} van de {lo} a {hi} (porciones que se ven funcionando, no una por función)")
            for tid, resto in ts:
                # la tarea de recorrido (journey) de la FASE sí va: el método la pide en la fase de verificación, con su
                # e2e (la eval tareas-mini lo destapó: «Verify all FASE-1 … end to end | tests/e2e/…» no es de sobra)
                if VERIFICAR.search(resto) and not RECORRIDO.search(resto):
                    out.append(f"{f.name}: {tid} es una tarea de verificar criterios o restricciones; eso lo hace la puerta de aceptación, no una tarea")
    return out


if __name__ == "__main__":
    if len(sys.argv) >= 5 and sys.argv[1] == "forma":
        print("\n".join(forma(sys.argv[2], sys.argv[3], sys.argv[4])))
        sys.exit(0)
    if len(sys.argv) < 3 or sys.argv[1] != "dependencias":
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    h = dependencias(sys.argv[2])
    print(texto(h) if "--texto" in sys.argv else json.dumps(h, ensure_ascii=False))
