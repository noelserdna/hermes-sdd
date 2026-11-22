#!/usr/bin/env python3
"""El expediente de cada criterio de una FASE: lo que hace falta para darlo por DEMOSTRADO, no solo por «test en verde».

Un criterio visible (REQ-F con «Se ve») queda demostrado cuando tiene todo esto en evidencias/FASE-<N>/:
  - prueba      su test pasa (el registro de aceptación, .sdd/acceptance.json)
  - captura     su ficha <id>.json, la que deja `captura(page, testInfo, id, { ve })`, con los textos que se ven
  - vídeo       un <video>.narracion.json que lo narra (`narrar(…, { criterio })`)
  - voz         el <video>.mp4 montado con su voz, posterior al vídeo y con pista de audio
  - revisión    Jev leyó su narración y no la da por contradictoria ni incompleta (.sdd/hermes/jev-narracion-<N>.json)
  - visible     cada cláusula de su THEN se ve o se declara «No visible» (sdd lint --needs: then-not-seen)

Lo usan la etapa de aceptación (si falta algo, vuelve a implementar con la lista: el sistema se evalúa contra el
objetivo y no se da por terminado — idea de Andrés tras material-montana11) y la puerta (una fila por criterio).

    hsdd_expediente.py <repo> <fase> [--json]
"""
from __future__ import annotations

import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import hsdd_textos as T  # noqa: E402

SDD = Path(__file__).resolve().parents[2] / "metodo" / "scripts" / "sdd.mjs"
PIEZAS = ("prueba", "captura", "vídeo", "voz", "revisión", "visible")


def _json(p: Path):
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _tiene_audio(mp4: Path) -> bool | None:
    """True/False si ffprobe lo sabe; None sin ffprobe (no se puede comprobar: no cuenta como falta)."""
    if not shutil.which("ffprobe"):
        return None
    r = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type",
                        "-of", "csv=p=0", str(mp4)], capture_output=True, text=True)
    return "audio" in r.stdout


def _sin_ver(repo: Path) -> dict:
    """{(req, ac): [cláusulas]} de `sdd lint --needs` (then-not-seen)."""
    r = subprocess.run(["node", str(SDD), "lint", "--needs", "--json"], cwd=repo, capture_output=True, text=True)
    try:
        ws = json.loads(r.stdout).get("warnings") or []
    except ValueError:
        return {}
    out = {}
    for w in ws:
        m = re.match(r"(REQ-[A-Z]+-[0-9A-Za-z]+) AC(\d+): (.*?) is in the THEN", w.get("msg") or "") if w.get("code") == "then-not-seen" else None
        if m:
            out[(m.group(1), int(m.group(2)))] = re.findall(r"«([^»]+)»", m.group(3))
    return out


def alcance_fase(repo: Path, fase: str) -> tuple[set | None, set]:
    """(requisitos, escenarios) de la cabecera de plan/fases/FASE-<N>-*.md («Requisitos:» y «Escenarios:»), como
    faseScope de metodo/scripts/lib/acceptance.mjs; (None, ∅) si no hay plan."""
    d = Path(repo) / "plan" / "fases"
    f = next((x for x in sorted(d.glob("*.md")) if re.match(rf"^FASE-0*{re.escape(str(fase))}(?:[-_.].*)?\.md$", x.name, re.I)), None) if d.is_dir() else None
    if not f:
        return None, set()
    cab = []
    for i, l in enumerate(f.read_text(encoding="utf-8", errors="replace").splitlines()[:40]):
        if i and l.startswith("## "):
            break
        cab.append(l)
    req = next((l for l in cab if re.search(r"\b(Requisitos|Requirements)\b[*\s]*:", l, re.I)), "")
    esc = next((l for l in cab if re.search(r"\b(Escenarios|Scenarios)\b[*\s]*:", l, re.I)), "")
    reqs = set(re.findall(r"REQ-[A-Z]+-[0-9A-Za-z]+", req))
    return (reqs or None), set(re.findall(r"AC-\d{3}-\d{2}", esc))


def expediente(repo: Path, fase: str, medios: bool = True) -> dict:
    """{fase, criterios: [{criterio, req, ac, ids, piezas: {pieza: True|False|None}, faltan: [texto], estado}], resumen}.
    medios=False no mira los mp4 (el banco de pruebas no guarda vídeos)."""
    repo = Path(repo)
    acc = _json(repo / ".sdd" / "acceptance.json") or {}
    d = repo / "evidencias" / f"FASE-{fase}"
    escenarios = T._escenarios_bdd(repo)
    ids_de: dict[tuple, list] = {}
    for sid, (req, ac) in escenarios.items():
        ids_de.setdefault((req, ac), []).append(sid)
    # lo que dejaron los tests de la FASE: fichas de captura y narraciones, por id de criterio
    fichas, narrados = {}, {}
    for f in sorted(d.glob("*.json")) if d.is_dir() else []:
        j = _json(f)
        if not isinstance(j, dict):
            continue
        if f.name.endswith(".narracion.json"):
            for x in j.get("narraciones") or []:
                if x.get("criterio"):
                    narrados.setdefault(str(x["criterio"]), f)
        elif j.get("criterio") and j.get("imagen"):
            fichas[str(j["criterio"])] = f
    jev = _json(repo / ".sdd" / "hermes" / f"jev-narracion-{fase}.json")
    revisados = {x["criterio"] for x in T.narraciones_fase(repo, fase)} if jev and not jev.get("error") else set()
    # contradicen e incompletos: [{criterio, puntos}] (o el id a secas en los antiguos)
    malos = {x.get("criterio") if isinstance(x, dict) else x for k in ("incompletos", "contradicen") for x in (jev or {}).get(k) or []}
    sin_ver = _sin_ver(repo)
    reqs_fase, esc_fase = alcance_fase(repo, fase)
    out = []
    for r in acc.get("requirements") or []:
        if r.get("type") != "F" or (reqs_fase is not None and r["id"] not in reqs_fase):
            continue
        for c in r.get("criteria") or []:
            sv = c.get("sees") or {}
            if not sv.get("texts"):
                continue   # sin nada que se vea no hay vídeo que pedir (No visible: lo dice su línea)
            n = c.get("n")
            # con «Escenarios» en la cabecera del plan, solo los criterios que esta FASE demuestra (un requisito puede
            # repartirse entre FASEs)
            if esc_fase and not set(c.get("scenarios") or ids_de.get((r["id"], n), [])) & esc_fase:
                continue
            clave = f"{r['id']}-AC{n}"
            ids = [*(c.get("scenarios") or ids_de.get((r["id"], n), [])), clave]
            p, faltan = {}, []
            p["prueba"] = c.get("state") == "pass"
            if not p["prueba"]:
                faltan.append(f"su test no pasa ({c.get('state')})")
            ficha = next((fichas[i] for i in ids if i in fichas), None)
            p["captura"] = ficha is not None
            if not ficha:
                faltan.append(f"no hay captura suya en evidencias/FASE-{fase} (captura(page, testInfo, '{ids[0]}', {{ ve }}))")
            nar = next((narrados[i] for i in ids if i in narrados), None)
            p["vídeo"] = nar is not None
            if not nar:
                faltan.append(f"ningún vídeo de la FASE lo narra (narrar(…, {{ criterio: '{ids[0]}' }}))")
            p["voz"] = None
            if nar and medios:
                j = _json(nar) or {}
                webm = d / (j.get("video") or nar.name.replace(".narracion.json", ".webm"))
                mp4 = webm.with_suffix(".mp4")
                if not mp4.is_file():
                    p["voz"] = False; faltan.append(f"su vídeo no tiene mp4 con voz ({mp4.name})")
                elif webm.is_file() and mp4.stat().st_mtime < webm.stat().st_mtime:
                    p["voz"] = False; faltan.append(f"el mp4 es anterior a su vídeo: la voz es de una grabación vieja ({mp4.name})")
                else:
                    a = _tiene_audio(mp4)
                    p["voz"] = a
                    if a is False:
                        faltan.append(f"el mp4 no tiene pista de audio ({mp4.name})")
            if jev is None or jev.get("error"):
                p["revisión"] = None
            else:
                p["revisión"] = clave in revisados and clave not in malos
                if clave not in revisados:
                    faltan.append("Jev no revisó su narración")
                elif clave in malos:
                    faltan.append("Jev da su narración por incompleta o contradictoria con el criterio")
            nv = sin_ver.get((r["id"], n))
            p["visible"] = not nv
            if nv:
                faltan.append("su THEN promete lo que no se ve ni se declara no visible: " + ", ".join(f"«{x}»" for x in nv))
            out.append({"criterio": clave, "req": r["id"], "ac": n, "ids": ids, "piezas": p, "faltan": faltan,
                        "estado": "demostrado" if not faltan else "incompleto"})
    dem = sum(1 for x in out if x["estado"] == "demostrado")
    return {"fase": str(fase), "criterios": out, "resumen": {"criterios": len(out), "demostrados": dem, "incompletos": len(out) - dem}}


def guardar(repo: Path, fase: str, medios: bool = True) -> dict:
    e = expediente(repo, fase, medios)
    f = Path(repo) / ".sdd" / "hermes" / f"expediente-{fase}.json"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(e, ensure_ascii=False, indent=1), encoding="utf-8")
    return e


# Lo que el implementador puede completar: la prueba, la captura, el vídeo, su voz y lo que Jev echa en falta en la
# narración. Lo de «visible» es de los requisitos (una línea «Se ve» o «No visible»): va a la puerta, no al bucle.
_DEL_IMPLEMENTADOR = ("prueba", "captura", "vídeo", "voz", "revisión")


def arreglables(e: dict) -> list[dict]:
    return [x for x in (e or {}).get("criterios", []) if any(x["piezas"].get(k) is False for k in _DEL_IMPLEMENTADOR)]


def para_agente(e: dict) -> str:
    """La lista de lo que falta y el implementador puede completar, para la pasada de autoevaluación."""
    return "\n".join(f"- {x['criterio']} ({x['ids'][0]}): " + "; ".join(f for f in x["faltan"] if "THEN" not in f)
                     for x in arreglables(e))[:6000]


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print(__doc__.strip().splitlines()[-1].strip(), file=sys.stderr)
        return 2
    e = guardar(Path(argv[0]), argv[1])
    if "--json" in argv:
        print(json.dumps(e, ensure_ascii=False, indent=1))
    elif "--faltan" in argv:
        print(para_agente(e))
    else:
        r = e["resumen"]
        print(f"FASE-{e['fase']}: {r['demostrados']} de {r['criterios']} criterios demostrados")
        for x in e["criterios"]:
            if x["faltan"]:
                print(f"  {x['criterio']}: " + "; ".join(x["faltan"]))
    return 0 if not e["resumen"]["incompletos"] else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
