#!/usr/bin/env python3
"""¿Lo que se entrega es lo que se pidió? Comprobaciones deterministas (sin LLM) de la fidelidad entre requisitos,
tests y evidencias, y de que los tests no se cambian para que todo encaje.

    hsdd_fidelidad.py todo <repo> [--json]          las cinco comprobaciones
    hsdd_fidelidad.py congelados|vinculos|capturas|coherencia <repo> [--json]

  congelados   tests que existían al aceptar una FASE (tag fase-N-accepted) y se cambiaron después: cada cambio que
               quita o altera líneas necesita una pregunta respondida por una persona (no Jev) citada en el commit;
               además se buscan señales de debilitamiento (aserciones quitadas o relajadas, .skip, reintentos…)
  vinculos     cada test que cita un criterio (por su escenario o por «REQ-… ACn») tiene que contener sus textos exactos
               «…»: si le faltan los del THEN, cita el criterio sin comprobarlo
  capturas     el OCR (Vision de macOS) de cada captura de un criterio tiene que enseñar los textos «…» de su THEN
  coherencia   ejemplos que contradicen lo que dicen de sí mismos («x» (8 caracteres), «jueves 2026-11-12») y
               referencias a escenarios o requisitos que ya no existen

La fuente de verdad de criterios, tests y capturas es `sdd accept --json` del método.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

AQUI = Path(__file__).resolve().parent
SDD = AQUI.parent.parent / "metodo" / "scripts" / "sdd.mjs"
OCR_SWIFT = AQUI / "ocr.swift"
HOME = Path(os.environ.get("HERMES_SDD_HOME", Path.home() / ".hermes" / "hermes-sdd"))


def git(repo: Path, *a: str) -> str:
    return subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True).stdout


def aceptacion(repo: Path) -> dict:
    out = subprocess.run(["node", str(SDD), "accept", "--json"], cwd=repo, capture_output=True, text=True).stdout
    try:
        return json.loads(out or "{}")
    except json.JSONDecodeError:
        return {}


def norm(t: str) -> str:
    """Para comparar textos de criterios con código u OCR: sin tildes ni mayúsculas, guiones y comillas unificados."""
    t = t.replace("°", "º").replace("ª", "º")   # el OCR lee «2ºB» como «2°B»; antes de NFKD, que convierte «º» en «o»
    t = unicodedata.normalize("NFKD", t)
    t = "".join(c for c in t if not unicodedata.combining(c))
    t = t.replace("º", "o").replace("–", "-").replace("—", "-").replace("’", "'").replace("“", '"').replace("”", '"')
    return re.sub(r"\s+", " ", t).strip().lower()


def literales(texto: str) -> list[str]:
    return [x.strip() for x in re.findall(r"«([^»]+)»", texto) if x.strip()]


def partes(texto: str) -> tuple[str, str]:
    """(GIVEN+WHEN, THEN) de un criterio."""
    m = re.search(r"\bTHEN\b", texto)
    return (texto[:m.start()], texto[m.end():]) if m else (texto, "")


# ── 1. tests congelados ─────────────────────────────────────────────────────────────────────────────────────────────
TRIVIAL = re.compile(r"^(import\b|export \{|from\s|//|#|/\*|\*|\}?\)?;?$|\}\);?$)")
DEBIL = [  # (patrón en líneas añadidas, qué indica)
    (re.compile(r"\.(skip|only|fixme)\s*\(|\btest\.fail\s*\(|\bxit\s*\(|\bxdescribe\s*\("), "test saltado, aislado o marcado como fallo esperado"),
    (re.compile(r"\bretries\s*:"), "reintentos (ocultan la inestabilidad)"),
    (re.compile(r"\btimeout\s*:\s*\d{5,}|setTimeout\(\s*\d{5,}"), "plazo muy alargado"),
    (re.compile(r"page\.route\(|\.setContent\(|route\.fulfill\("), "el e2e simula la respuesta en vez de usar la app real"),
    (re.compile(r"toBeTruthy\(\)|toBeDefined\(\)|toContain\(|toMatch\(\s*/\.\*"), "aserción laxa"),
]


def _autorizada(repo: Path, mensaje: str) -> tuple[bool, str]:
    """¿El commit cita una pregunta contestada por una persona? (Jev no puede autorizar editar tests: art. 12)"""
    ids = re.findall(r"(?<![A-Za-z0-9-])Q-[a-z][A-Za-z0-9-]*-\d{3}\b", mensaje)   # Q-task-implementer-007, no REQ-F-003
    if not ids:
        return False, "el commit no cita ninguna pregunta que lo autorice"
    for qid in ids:
        for f in (repo / ".sdd").glob("questions-*.md"):
            m = re.search(rf"^## {re.escape(qid)}\b.*?^Answer:[ \t]*([^\n]*)", f.read_text(encoding="utf-8", errors="replace"), re.M | re.S)
            if m:
                quien = m.group(1)
                if re.search(r"\bjev\b", quien, re.I):
                    return False, f"{qid} la contestó Jev, no una persona"
                if "elegida por" in quien or "aceptada por" in quien:
                    return True, f"{qid}: {quien.strip()}"
    return False, f"{', '.join(ids)} sin respuesta de una persona"


def congelados(repo: Path) -> list[dict]:
    out = []
    tags = [t for t in git(repo, "tag", "-l", "fase-*-accepted", "--sort=creatordate").split() if t]
    vistos = set()
    for tag in tags:
        ficheros = [f for f in git(repo, "ls-tree", "-r", "--name-only", tag, "--", "tests", "test").split()
                    if re.search(r"\.(test|spec)\.[cm]?[jt]sx?$|_test\.py$|test_.*\.py$", f)]
        if not ficheros:
            continue
        for linea in git(repo, "log", "--format=%H%x09%s", f"{tag}..HEAD", "--", *ficheros).splitlines():
            sha, asunto = linea.split("\t", 1)
            if sha.startswith("Merge") or (sha in vistos):
                continue
            if len(git(repo, "rev-list", "--parents", "-n1", sha).split()) > 2:   # merge: los cambios ya están en sus commits
                continue
            diff = git(repo, "show", "-U0", "--format=", sha, "--", *ficheros)
            quitadas, puestas, actual, por_fichero = [], [], None, {}
            for l in diff.splitlines():
                if l.startswith("diff --git"):
                    actual = l.split(" b/")[-1]; por_fichero.setdefault(actual, [[], []])
                elif actual and l.startswith("-") and not l.startswith("---"):
                    por_fichero[actual][0].append(l[1:].strip())
                elif actual and l.startswith("+") and not l.startswith("+++"):
                    por_fichero[actual][1].append(l[1:].strip())
            for f, (q, p) in por_fichero.items():
                cambiadas = [x for x in q if x and not TRIVIAL.match(x) and x not in set(p)]
                senales = sorted({d for x in p for rx, d in DEBIL if rx.search(x)})
                asercion_q = sum(1 for x in q if "expect(" in x or "assert" in x)
                asercion_p = sum(1 for x in p if "expect(" in x or "assert" in x)
                if asercion_q > asercion_p:
                    senales.append(f"quita {asercion_q - asercion_p} aserción(es)")
                cita = lambda xs: set(re.findall(r"REQ-[A-Z]+-\d{3}(?: AC\d+)?|AC-\d{3}-\d{2}", " ".join(xs)))
                quitadas_citas = sorted(cita(q) - cita(p))
                if quitadas_citas:
                    senales.append("deja de citar " + ", ".join(quitadas_citas[:6]) + ("…" if len(quitadas_citas) > 6 else ""))
                if not cambiadas and not senales:
                    continue
                ok, por = _autorizada(repo, git(repo, "log", "-1", "--format=%B", sha))
                vistos.add(sha)
                out.append({"commit": sha[:7], "asunto": asunto, "fichero": f, "congelado_en": tag,
                            "lineas_cambiadas": len(cambiadas), "debilitamiento": senales,
                            "autorizado": ok, "autorizacion": por,
                            "grave": (not ok) or bool(senales)})
    return out


# ── 2. vínculos test ↔ criterio ─────────────────────────────────────────────────────────────────────────────────────
def _cuerpo_test(repo: Path, fichero: str, nombre: str) -> str:
    cands = [p for p in repo.rglob(Path(fichero).name) if "node_modules" not in p.parts]
    titulo = nombre.split(" > ")[-1].strip()
    for p in cands:
        lineas = p.read_text(encoding="utf-8", errors="replace").splitlines()
        for i, l in enumerate(lineas):
            if titulo[:60] and titulo[:60] in l:
                fin = next((j for j in range(i + 1, len(lineas)) if re.match(r"^\s*(test|it)(\.\w+)?\(", lineas[j])
                            and len(lineas[j]) - len(lineas[j].lstrip()) <= len(l) - len(l.lstrip())), len(lineas))
                return "\n".join(lineas[i:fin])
    return ""


def vinculos(repo: Path, acc: dict) -> list[dict]:
    out = []
    for r in acc.get("requirements", []):
        for c in r.get("criteria", []):
            texto = (c.get("text") or "")
            _, then = partes(texto)
            lit_then = literales(then)
            # Los datos del criterio: textos «…» y también fechas (2026-11-14): un recorrido largo que cita muchos
            # criterios contiene casi todos los textos, pero no hace el caso del criterio si usa otro día (sala,
            # REQ-F-015 AC1: el viaje de la FASE-3 desbloqueaba el 2026-11-15 y contaba como prueba del 2026-11-14)
            fechas = sorted(set(re.findall(r"\b\d{4}-\d{2}-\d{2}\b", re.sub(r"«[^»]*»", "", texto))))
            lit_todo = literales(texto) + fechas
            if not lit_todo:
                continue
            for t in c.get("tests", []):
                cuerpo = _cuerpo_test(repo, t.get("file", ""), t.get("name", ""))
                if not cuerpo:
                    continue
                n = norm(cuerpo)
                falta_then = [x for x in lit_then if norm(x) not in n]
                falta = [x for x in lit_todo if norm(x) not in n and x not in falta_then]
                if falta_then or falta:
                    out.append({"req": r["id"], "ac": c.get("n"), "prioridad": r.get("priority"), "test": t.get("name", "")[:120],
                                "fichero": t.get("file"), "via": t.get("via"), "faltan_then": falta_then, "faltan_datos": falta,
                                "grave": bool(falta_then) and r.get("priority") == "Must"})
    return out


# ── 3. capturas (OCR) ───────────────────────────────────────────────────────────────────────────────────────────────
def _ocr_bin() -> Path | None:
    b = HOME / "bin" / "hsdd-ocr"
    if b.exists() and b.stat().st_mtime >= OCR_SWIFT.stat().st_mtime:
        return b
    b.parent.mkdir(parents=True, exist_ok=True)
    r = subprocess.run(["swiftc", "-O", "-o", str(b), str(OCR_SWIFT)], capture_output=True, text=True)
    return b if r.returncode == 0 else None


_CACHE_OCR: dict[str, str] = {}


def ocr(img: Path) -> str:
    k = str(img)
    if k not in _CACHE_OCR:
        b = _ocr_bin()
        _CACHE_OCR[k] = subprocess.run([str(b), k], capture_output=True, text=True).stdout if b else ""
    return _CACHE_OCR[k]


def capturas(repo: Path, acc: dict) -> list[dict]:
    out = []
    for r in acc.get("requirements", []):
        for c in r.get("criteria", []):
            _, then = partes((c.get("text") or ""))
            # Solo lo que el criterio dice que se VE: los textos «…» desde «ve», «mensaje», «etiqueta», «aparece»…
            # («la reserva queda guardada para «2ºB»» no promete enseñar «2ºB»; «ve … como «Tuya»» sí promete «Tuya»)
            m = re.search(r"\b(ve|ven|ver|vea|muestra|muestran|aparece|aparecen|mensaje|etiqueta|figura|lee|leen|pone)\b", then)
            if not m:
                continue
            lit = literales(then[m.start():])
            imgs = [a["path"] for e in c.get("evidence", []) if e.get("kind") == "capture"
                    for a in e.get("attachments", []) if a.get("kind") == "image" and a.get("present")]
            if not lit or not imgs:
                continue
            visto = {x: False for x in lit}
            for i in imgs:
                t = norm(ocr(repo / i)).replace(" ", "")
                for x in lit:
                    visto[x] = visto[x] or norm(x).replace(" ", "") in t
            no = [x for x, v in visto.items() if not v]
            if no:
                out.append({"req": r["id"], "ac": c.get("n"), "prioridad": r.get("priority"), "capturas": imgs,
                            "no_se_ve": no, "grave": r.get("priority") == "Must"})
    return out


# ── 4. coherencia ───────────────────────────────────────────────────────────────────────────────────────────────────
DIAS = {"lunes": 0, "lun": 0, "martes": 1, "mar": 1, "miércoles": 2, "miercoles": 2, "mié": 2, "mie": 2, "jueves": 3,
        "jue": 3, "viernes": 4, "vie": 4, "sábado": 5, "sabado": 5, "sáb": 5, "sab": 5, "domingo": 6, "dom": 6}


def coherencia(repo: Path) -> list[dict]:
    out = []
    req = (repo / "requirements" / "REQUIREMENTS.md")
    texto = req.read_text(encoding="utf-8", errors="replace") if req.exists() else ""
    for m in re.finditer(r"«([^»]+)»\s*\((\d+) caracteres\)", texto):
        if len(m.group(1)) != int(m.group(2)):
            out.append({"tipo": "ejemplo", "donde": "requirements/REQUIREMENTS.md",
                        "detalle": f"«{m.group(1)}» dice tener {m.group(2)} caracteres y tiene {len(m.group(1))}", "grave": True})
    for m in re.finditer(r"\b(" + "|".join(sorted(DIAS, key=len, reverse=True)) + r")\.?\s+(\d{4}-\d{2}-\d{2})\b", texto, re.I):
        try:
            d = dt.date.fromisoformat(m.group(2))
        except ValueError:
            continue
        if d.weekday() != DIAS[m.group(1).lower()]:
            out.append({"tipo": "ejemplo", "donde": "requirements/REQUIREMENTS.md",
                        "detalle": f"«{m.group(0)}»: el {m.group(2)} no es {m.group(1)}", "grave": True})
    # referencias que ya no existen
    escenarios = set(re.findall(r"\bAC-\d{3}-\d{2}\b", "\n".join(p.read_text(errors="replace") for p in (repo / "spec").rglob("BDD-*.md"))))
    reqs = set(re.findall(r"^### (REQ-[A-Z]+-\d+)", texto, re.M))
    if escenarios or reqs:
        for d in ("plan", "task", "tests"):
            for p in (repo / d).rglob("*"):
                if not p.is_file() or "node_modules" in p.parts or p.suffix not in (".md", ".js", ".ts", ".mjs", ".py"):
                    continue
                t = p.read_text(errors="replace")
                malos = sorted({a for a in re.findall(r"\bAC-\d{3}-\d{2}\b", t) if escenarios and a not in escenarios}
                               | {q for q in re.findall(r"\bREQ-[A-Z]+-\d{3}\b", t) if reqs and q not in reqs})
                if malos:
                    out.append({"tipo": "referencia", "donde": str(p.relative_to(repo)),
                                "detalle": "cita lo que ya no existe: " + ", ".join(malos[:8]), "grave": d == "tests"})
    return out


# ── informe ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def todo(repo: Path) -> dict:
    acc = aceptacion(repo)
    return {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(),
            "congelados": congelados(repo), "vinculos": vinculos(repo, acc),
            "capturas": capturas(repo, acc), "coherencia": coherencia(repo)}


def texto(res: dict) -> str:
    L = [f"Fidelidad de {Path(res['repo']).name} en {res['sha']}"]
    def bloque(clave, titulo, linea):
        xs = res.get(clave) or []
        g = sum(1 for x in xs if x.get("grave"))
        L.append(f"\n{titulo}: {len(xs)} hallazgo(s), {g} grave(s)")
        for x in xs[:40]:
            L.append(("  ⛔ " if x.get("grave") else "  ⚠️ ") + linea(x))
    if "congelados" in res:
        bloque("congelados", "Tests congelados cambiados después", lambda x:
               f"{x['commit']} {x['fichero']} (congelado en {x['congelado_en']}, {x['lineas_cambiadas']} líneas): "
               f"{'autorizado' if x['autorizado'] else 'SIN autorizar'} — {x['autorizacion']}"
               + (f"; {', '.join(x['debilitamiento'])}" if x['debilitamiento'] else ""))
    if "vinculos" in res:
        bloque("vinculos", "Tests que citan un criterio sin sus textos", lambda x:
               f"{x['req']} AC{x['ac']} ← {x['fichero']} «{x['test'][:70]}»: "
               + (f"no comprueba {', '.join('«'+s+'»' for s in x['faltan_then'])} (THEN)" if x['faltan_then'] else "")
               + (f"{'; ' if x['faltan_then'] else ''}sin los datos {', '.join('«'+s+'»' for s in x['faltan_datos'][:4])}" if x['faltan_datos'] else ""))
    if "capturas" in res:
        bloque("capturas", "Capturas que no enseñan su criterio", lambda x:
               f"{x['req']} AC{x['ac']}: no se ve {', '.join('«'+s+'»' for s in x['no_se_ve'])} en {', '.join(x['capturas'])}")
    if "coherencia" in res:
        bloque("coherencia", "Coherencia de los artefactos", lambda x: f"{x['donde']}: {x['detalle']}")
    return "\n".join(L)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, repo = sys.argv[1], Path(sys.argv[2]).resolve()
    if cmd == "todo":
        res = todo(repo)
    elif cmd in ("vinculos", "capturas"):
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(), cmd: globals()[cmd](repo, aceptacion(repo))}
    elif cmd in ("congelados", "coherencia"):
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(), cmd: globals()[cmd](repo)}
    else:
        sys.exit(__doc__)
    print(json.dumps(res, ensure_ascii=False, indent=1) if "--json" in sys.argv else texto(res))
