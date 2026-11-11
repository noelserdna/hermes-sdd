"""Lecciones entre proyectos (encargado, fase 5). Pocas, con evidencia, confirmadas por una persona y con caducidad.

- Las PROPONE el encargado de un proyecto (encargado.sh leccion): una regla general para una etapa, con al menos una
  evidencia de su proyecto que el arnés comprueba (una puerta, una etapa que falló, un commit). Se rechaza si lleva
  datos del proyecto (su nombre, ids de requisitos, textos citados) o no es una regla corta.
- Las CONFIRMA o DESCARTA una persona (botones en Telegram). Sin confirmar no se usan.
- Se USAN en las etapas de los proyectos siguientes (etapa.sh las añade a su prompt; como mucho 5 por etapa) y cada uso
  queda anotado. Tras usarse en 3 proyectos distintos pasan a «revisar»: la persona decide si se mantienen o caducan
  (no hay manera honrada de medir sola si una lección cambió el resultado).

Se guardan en $HERMES_SDD_HOME/lecciones/ (repositorio git propio): lecciones.json (la fuente) y LECCIONES.md (la
vista legible, regenerada).

  python3 hsdd_lecciones.py proponer <repo> <etapa> "<regla>" <evidencia>... [--por quien]
  python3 hsdd_lecciones.py decidir <id> confirmar|descartar|mantener|caducar <persona>
  python3 hsdd_lecciones.py para-etapa <etapa> [--repo R --registrar]      → texto para el prompt de la etapa
  python3 hsdd_lecciones.py listar [estado]
"""
from __future__ import annotations

import importlib.util
import json
import re
import subprocess
import sys
import time
from pathlib import Path

if "hsdd_nucleo" not in sys.modules:
    _spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).with_name("hsdd_nucleo.py"))
    _mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod); sys.modules["hsdd_nucleo"] = _mod
N = sys.modules["hsdd_nucleo"]

ETAPAS = ("requisitos", "ruta", "especificar", "auditar", "pruebas", "seguridad", "tecnico", "ux", "plan", "tareas",
          "huecos", "implementar", "aceptar", "cierre", "cambio", "brechas", "adoptar")
MAX_POR_ETAPA = 5
USOS_PARA_REVISAR = 3


class Rechazo(Exception):
    """La lección no procede; el mensaje se enseña tal cual."""


def _dir() -> Path:
    d = N.HOME / "lecciones"
    d.mkdir(parents=True, exist_ok=True)
    if not (d / ".git").exists():
        subprocess.run(["git", "init", "-q", "-b", "main"], cwd=d, capture_output=True)
    return d


def _todas() -> list:
    return N.leer(_dir() / "lecciones.json", []) or []


def _guardar(ls: list, mensaje: str) -> None:
    d = _dir()
    N.escribir(d / "lecciones.json", ls)
    (d / "LECCIONES.md").write_text(_vista(ls))
    subprocess.run(["git", "add", "-A"], cwd=d, capture_output=True)
    subprocess.run(["git", "-c", "user.name=hermes-sdd", "-c", "user.email=lecciones@hermes-sdd", "commit", "-qm", mensaje],
                   cwd=d, capture_output=True)


def _vista(ls: list) -> str:
    out = ["# Lecciones entre proyectos", "",
           "> Generado por hermes-sdd (hsdd_lecciones.py): no editar a mano. Solo las **confirmadas** llegan a las etapas.", ""]
    for estado in ("confirmada", "revisar", "propuesta", "caducada", "descartada"):
        grupo = [l for l in ls if l["estado"] == estado]
        if grupo:
            out += [f"## {estado.capitalize()}s ({len(grupo)})", ""]
            for l in grupo:
                ev = "; ".join(f"{e['proyecto']}: {e['tipo']} {e['ref']}" for e in l["evidencias"])
                usos = len({u["proyecto"] for u in l.get("usos", [])})
                out.append(f"- **{l['id']}** · {l['etapa']} · {l['regla']}  \n  Evidencia: {ev} · propuesta por {l['por']} "
                           f"el {l['propuesta'][:10]}" + (f" · {l['estado']} por {l.get('decidida_por')}" if l.get("decidida_por") else "")
                           + (f" · usada en {usos} proyecto(s)" if usos else ""))
            out.append("")
    return "\n".join(out)


def _evidencia(repo: Path, ref: str) -> dict | None:
    """{proyecto, tipo, ref, resumen} si la referencia existe en ese proyecto; None si no."""
    tablero = re.sub(r"[^a-z0-9]+", "-", repo.name.lower()).strip("-")
    h = repo / ".sdd" / "hermes"
    if re.fullmatch(r"g[0-9a-f]{10,}", ref):
        p = N.leer(N.HOME / "puertas" / f"{ref}.json") or N.leer(h / "puertas" / f"{ref}.json")
        if p and (p.get("tablero") in (tablero, "", None)) and Path(p.get("repo", repo)).resolve() == repo.resolve():
            d = p.get("decision") or {}
            return {"proyecto": tablero, "tipo": "puerta", "ref": ref,
                    "resumen": f"{p.get('titulo')}: {p.get('estado')}" + (f" ({d.get('verbo')})" if d.get("verbo") else "")}
        return None
    if re.fullmatch(r"t_[0-9a-f]+", ref):
        for l in (h / "etapas.jsonl").read_text().splitlines() if (h / "etapas.jsonl").exists() else []:
            try:
                x = json.loads(l)
            except ValueError:
                continue
            if x.get("tarjeta") == ref:
                return {"proyecto": tablero, "tipo": "etapa", "ref": ref,
                        "resumen": f"{x.get('etapa')}{' FASE-' + str(x['fase']) if x.get('fase') else ''}: {x.get('resultado')} — {(x.get('motivo') or '')[:120]}"}
        return None
    if re.fullmatch(r"[0-9a-f]{7,40}", ref):
        r = subprocess.run(["git", "-C", str(repo), "log", "-1", "--format=%h %s", ref], capture_output=True, text=True)
        if r.returncode == 0 and r.stdout.strip():
            return {"proyecto": tablero, "tipo": "commit", "ref": ref, "resumen": r.stdout.strip()[:140]}
    return None


def _general(regla: str, repo: Path) -> str | None:
    """Motivo por el que la regla NO es general (lleva datos del proyecto o del cliente), o None."""
    if not 20 <= len(regla) <= 300:
        return "una lección es una regla de una o dos frases (20 a 300 caracteres)"
    if repo.name.lower() in regla.lower():
        return "no puede llevar el nombre del proyecto: tiene que servir para otros"
    if re.search(r"\b(REQ-[A-Z]+|N|INT|DEC|CHG|AC)-\d+", regla):
        return "no puede citar ids de este proyecto (REQ-…, INT-…): describe el caso en general"
    if re.search(r"«[^»]{12,}»|\"[^\"]{12,}\"", regla):
        return "no puede citar textos del proyecto o del cliente entre comillas"
    return None


def proponer(repo, etapa: str, regla: str, refs: list, por: str = "encargado") -> dict:
    repo = Path(repo).resolve()
    regla = " ".join(regla.split())
    if etapa not in ETAPAS:
        raise Rechazo(f"etapa desconocida: {etapa} (valen: {', '.join(ETAPAS)})")
    motivo = _general(regla, repo)
    if motivo:
        raise Rechazo(motivo)
    evs = [e for e in (_evidencia(repo, r) for r in refs) if e]
    if not evs:
        raise Rechazo("hace falta al menos una evidencia de este proyecto que exista: una puerta (g…), una tarjeta de "
                      "etapa de etapas.jsonl (t_…) o un commit")
    ls = _todas()
    if any(l["regla"].lower() == regla.lower() and l["estado"] in ("propuesta", "confirmada", "revisar") for l in ls):
        raise Rechazo("ya hay una lección con esa misma regla")
    n = max([int(l["id"][2:]) for l in ls] or [0]) + 1
    l = {"id": f"L-{n:03d}", "etapa": etapa, "regla": regla, "evidencias": evs, "por": por, "estado": "propuesta",
         "propuesta": N.ahora(), "usos": []}
    _guardar(ls + [l], f"{l['id']} propuesta ({etapa})")
    return l


def decidir(lid: str, accion: str, persona: str) -> dict:
    estados = {"confirmar": ("propuesta", "confirmada"), "descartar": ("propuesta", "descartada"),
               "mantener": ("revisar", "confirmada"), "caducar": ("revisar", "caducada")}
    if accion not in estados:
        raise Rechazo(f"acción desconocida: {accion}")
    ls = _todas()
    l = next((x for x in ls if x["id"] == lid), None)
    if not l:
        raise Rechazo(f"no conozco la lección {lid}")
    desde, hacia = estados[accion]
    if l["estado"] != desde:
        raise Rechazo(f"{lid} está {l['estado']}, no {desde}")
    l.update(estado=hacia, decidida_por=persona, decidida=N.ahora())
    if accion == "mantener":
        l["mantenida_con_usos"] = len({u["proyecto"] for u in l.get("usos", [])})
    _guardar(ls, f"{lid} {hacia} por {persona}")
    return l


def para_etapa(etapa: str, repo: str | None = None, registrar: bool = False) -> str:
    """Las lecciones confirmadas de esa etapa, como texto para su prompt (vacío si no hay). Con `registrar`, anota el
    uso en ese proyecto y pasa a «revisar» la que llega a 3 proyectos desde la última vez que se mantuvo."""
    ls = _todas()
    elegidas = [l for l in ls if l["estado"] == "confirmada" and l["etapa"] == etapa][:MAX_POR_ETAPA]
    if not elegidas:
        return ""
    if registrar and repo:
        tablero = re.sub(r"[^a-z0-9]+", "-", Path(repo).name.lower()).strip("-")
        cambio = False
        for l in elegidas:
            if any(e["proyecto"] == tablero for e in l["evidencias"]):
                continue   # el proyecto del que salió no cuenta como uso
            if not any(u["proyecto"] == tablero for u in l["usos"]):
                l["usos"].append({"proyecto": tablero, "etapa": etapa, "fecha": N.ahora()})
                cambio = True
            if len({u["proyecto"] for u in l["usos"]}) - l.get("mantenida_con_usos", 0) >= USOS_PARA_REVISAR:
                l["estado"] = "revisar"
                cambio = True
        if cambio:
            _guardar(ls, f"usos en {tablero} ({etapa})")
    return ("Lecciones confirmadas de proyectos anteriores (aplícalas si vienen al caso; no son requisitos): "
            + " ".join(f"[{l['id']}] {l['regla']}" for l in elegidas))


def pendientes() -> list:
    """Las que esperan a una persona: propuestas y en revisión."""
    return [l for l in _todas() if l["estado"] in ("propuesta", "revisar")]


def marcar_avisada(lid: str, clave: str) -> None:
    ls = _todas()
    for l in ls:
        if l["id"] == lid:
            l["avisada"] = clave
    N.escribir(_dir() / "lecciones.json", ls)


if __name__ == "__main__":
    a = sys.argv[1:]
    try:
        if a[:1] == ["proponer"] and len(a) >= 5:
            por = a[a.index("--por") + 1] if "--por" in a else "encargado"
            refs = [x for i, x in enumerate(a[4:], 4) if x != "--por" and a[i - 1] != "--por"]
            l = proponer(a[1], a[2], a[3], refs, por)
            print(f"{l['id']} propuesta: espera a que una persona la confirme. Evidencia: "
                  + "; ".join(f"{e['tipo']} {e['ref']} ({e['resumen']})" for e in l["evidencias"]))
        elif a[:1] == ["decidir"] and len(a) == 4:
            l = decidir(a[1], a[2], a[3]); print(f"{l['id']}: {l['estado']}")
        elif a[:1] == ["para-etapa"] and len(a) >= 2:
            repo = a[a.index("--repo") + 1] if "--repo" in a else None
            print(para_etapa(a[1], repo, "--registrar" in a))
        elif a[:1] == ["listar"]:
            for l in _todas():
                if len(a) < 2 or l["estado"] == a[1]:
                    print(f"{l['id']} [{l['estado']}] {l['etapa']}: {l['regla']}")
        else:
            print(__doc__, file=sys.stderr); sys.exit(2)
    except Rechazo as e:
        print(f"No se registra la lección: {e}", file=sys.stderr); sys.exit(1)
