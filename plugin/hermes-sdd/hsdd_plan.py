"""Comprobaciones mecánicas del plan (sin LLM).

dependencias: criterios de un requisito planificado en la FASE N que citan una pantalla o vista que entrega una
FASE posterior (biblioteca, 11/11/2026: «Mis préstamos» en criterios de la FASE-1 cuando esa vista llega en la
FASE-3; la FASE quedaba bloqueada en su puerta sin poder cumplirse).

Una cita («…» o "…") de un criterio cuenta como pantalla de otra FASE cuando aparece en el título de un requisito
o de una FASE posterior y en ningún título de esa FASE o de las anteriores.

Uso: python3 hsdd_plan.py dependencias <repo> [--texto]
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
        out[int(m.group(1))] = {"titulo": titulo, "requisitos": REQ.findall(linea)}
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
        antes = " | ".join(t for m in fases if m <= n for t in titulos[m]).lower()
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


if __name__ == "__main__":
    if len(sys.argv) < 3 or sys.argv[1] != "dependencias":
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    h = dependencias(sys.argv[2])
    print(texto(h) if "--texto" in sys.argv else json.dumps(h, ensure_ascii=False))
