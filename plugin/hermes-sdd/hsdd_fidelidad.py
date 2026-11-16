#!/usr/bin/env python3
"""¿Lo que se entrega es lo que se pidió? Comprobaciones deterministas (sin LLM) de la fidelidad entre requisitos,
tests y evidencias, y de que los tests no se cambian para que todo encaje.

    hsdd_fidelidad.py todo <repo> [--json]          las cinco comprobaciones
    hsdd_fidelidad.py congelados|vinculos|capturas|coherencia <repo> [--json]

  congelados   tests, helpers, fixtures y configuraciones de tests que existían al aceptar una FASE (tag
               fase-N-accepted) y se cambiaron después: cada cambio necesita una autorización firmada por el notario
               (registro test-edit de acceptance/decisions.jsonl que nombra ese fichero, de una persona, no Jev);
               además se buscan señales de debilitamiento (aserciones quitadas o relajadas, .skip/.only, testIgnore,
               return temprano, catch vacío, reintentos, plazos…)
  vinculos     cada test que cita un criterio (por su escenario o por «REQ-… ACn») tiene que contener sus textos exactos
               «…»: si le faltan los del THEN, cita el criterio sin comprobarlo
  capturas     cada captura de un criterio enseña lo que su línea «Se ve:» promete: primero lo que el test comprobó en
               pantalla (el JSON del helper junto al PNG), después el OCR (Vision de macOS) como segunda opinión; sin
               «Se ve:», los textos «…» de su THEN; sin nada comprobable, «captura sin comprobar»
  lint_capturas  `sdd lint --captures` (captura tras API, captura de un test que no cita el criterio, ids que no existen)
  coherencia   ejemplos que contradicen lo que dicen de sí mismos («x» (8 caracteres), «jueves 2026-11-12») y
               referencias a escenarios o requisitos que ya no existen

La fuente de verdad de criterios, tests y capturas es `sdd accept --json` del método.
"""
from __future__ import annotations

import datetime as dt
import json
import os
import re
import shutil
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


def aceptacion(repo: Path, fase: str | None = None) -> dict:
    out = subprocess.run(["node", str(SDD), "accept", "--json", *(["--fase", str(fase)] if fase else [])],
                         cwd=repo, capture_output=True, text=True).stdout
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
    """Textos exactos de un criterio: entre «…», “…” o "…" (los criterios en inglés del club usan comillas rectas)."""
    xs = re.findall(r"«([^»]+)»", texto) + re.findall(r"“([^”]+)”", texto) + re.findall(r'"([^"]+)"', texto)
    vistos, out = set(), []
    for x in (x.strip() for x in xs):
        if x and x not in vistos:
            vistos.add(x); out.append(x)
    return out


# Desde dónde un criterio dice lo que se VE (en castellano o en inglés)
VERBOS_VER = (r"\b(ve|ven|ver|vea|muestra|muestran|aparece|aparecen|mensaje|etiqueta|figura|lee|leen|pone|"
              r"sees|see|shows|show|displays|display|message|label|appears|appear|reads|lists|listed|row)\b")


def partes(texto: str) -> tuple[str, str]:
    """(GIVEN+WHEN, THEN) de un criterio (THEN o ENTONCES)."""
    m = re.search(r"\b(?:THEN|ENTONCES)\b", texto)
    return (texto[:m.start()], texto[m.end():]) if m else (texto, "")


def plantilla_partes(t: str) -> list[str]:
    """Las partes fijas de una plantilla («Hola, {usuario}» → ["Hola,"]): lo que no cambia con quién la lee."""
    return [x.strip() for x in re.split(r"\{[^{}]+\}", t) if re.search(r"\w", x)]


def se_ve(c: dict) -> tuple[list[tuple[str, bool]], str | None] | None:
    """El contrato «Se ve» del criterio (líneas «- Se ve: "…" en <pantalla>» / «- No visible: <motivo>» bajo él, que
    el método deja en `sees`): ([(texto, es_plantilla)], motivo de No visible), o None si el criterio no lo tiene."""
    s = c.get("sees")
    if not s:
        return None
    return [(t["text"], bool(t.get("template"))) for t in s.get("texts") or []], s.get("none")


def en_texto(lit: str, texto: str) -> bool:
    """¿Está `lit` en `texto` (OCR o lo comprobado), como palabras enteras? Sin espacios solo si es largo: el OCR junta
    o separa palabras, pero un «No» sin espacios está en cualquier sitio («Nombre», «noviembre»)."""
    a, t = norm(lit), norm(texto)
    if not a:
        return True
    if re.search(r"(?<![a-z0-9])" + re.escape(a) + r"(?![a-z0-9])", t):
        return True
    a2 = a.replace(" ", "")
    return len(a2) >= 8 and a2 in t.replace(" ", "")


# ── 1. tests congelados ─────────────────────────────────────────────────────────────────────────────────────────────
# Al aceptar una FASE (tag fase-N-accepted) queda congelado, por el hash de su contenido en ese tag, todo lo que decide
# si un test pasa: los ficheros de tests/ y test/ (también helpers, fixtures y snapshots; no los documentos .md del plan
# de pruebas), cualquier *.test.* / *.spec.* y las configuraciones con las que se ejecutan (playwright.config.js,
# vite.config.js…: un testIgnore o un `exclude` apaga tests sin tocarlos). club: tests/e2e/helpers/servidor.js cambió
# tras aceptar y nadie lo vio, porque solo se miraban los *.test|spec.*.
TRIVIAL = re.compile(r"^(import\b|export \{|from\s|//|#|/\*|\*|\}?\)?;?$|\}\);?$)")
ES_TEST = re.compile(r"\.(test|spec)\.[cm]?[jt]sx?$|_test\.py$|(^|/)test_[^/]*\.py$")
ES_CONFIG = re.compile(r"(^|/)(playwright|vitest|vite|jest|cypress|karma|ava|wdio|mocha)\.config\.[cm]?[jt]s$|(^|/)\.mocharc(\.\w+)?$"
                       r"|(^|/)vitest\.workspace\.[cm]?[jt]s$|(^|/)(pytest\.ini|conftest\.py|tox\.ini|jest\.config\.json)$")
NO_CONGELA = re.compile(r"\.md$|^test/[^/]+\.(csv|txt|ya?ml|json)$", re.I)   # el plan de pruebas del método no es un test
DEBIL = [  # (patrón en lo añadido, qué indica)
    (re.compile(r"\.(skip|only|fixme)\s*\(|\btest\.fail\s*\(|\bxit\s*\(|\bxdescribe\s*\(|\.todo\s*\(|\bit\.skipIf\b|\.skipIf\s*\("),
     "test saltado, aislado o marcado como fallo esperado"),
    (re.compile(r"\btestIgnore\b|\btestPathIgnorePatterns\b|\bgrepInvert\b|\bgrep\s*:|\bexclude\s*:|forbidOnly\s*:\s*false|passWithNoTests|modulePathIgnorePatterns"),
     "excluye tests de la ejecución"),
    (re.compile(r"\bretries\s*:|\.retry\s*\(|jest\.retryTimes"), "reintentos (ocultan la inestabilidad)"),
    (re.compile(r"\btimeout\s*:\s*\d{5,}|setTimeout\(\s*\d{5,}|\btest\.setTimeout\s*\(|\btest\.slow\s*\(|jest\.setTimeout\s*\(|\btimeout\s*:\s*0\b"),
     "plazo muy alargado"),
    (re.compile(r"page\.route\(|\.setContent\(|route\.fulfill\(|vi\.mock\(|jest\.mock\("), "el test simula la respuesta en vez de usar la app real"),
    (re.compile(r"toBeTruthy\(\)|toBeDefined\(\)|toContain\(|toMatch\(\s*/\.\*|expect\.anything\(\)|expect\.any\("), "aserción laxa"),
    (re.compile(r"\bexpect\.soft\s*\("), "aserción blanda (no para el test)"),
    (re.compile(r"^\s*return\s*;?\s*$|^\s*if\s*\(.*\)\s*\{?\s*return\b"), "return temprano (el test acaba antes de comprobar)"),
    (re.compile(r"\|\|\s*true\b|continue-on-error"), "un fallo se da por bueno (|| true)"),
]
# Sobre todo lo añadido junto (abarca varias líneas): un catch vacío se traga el fallo de la aserción
DEBIL_JUNTO = [
    (re.compile(r"catch\s*(?:\([^)]*\))?\s*\{\s*(?://[^\n]*\s*)*\}|\.catch\(\s*(?:\([^)]*\)|\w+)?\s*=>\s*(?:\{\s*\}|undefined|null|0)\s*\)"),
     "try/catch que se traga el fallo"),
]
ASERCION = re.compile(r"\bexpect(?:\.soft)?\s*\(|\bassert\w*\s*[.(]|\bt\.(?:is|deepEqual|true|false|throws)\s*\(")


def _clase(f: str) -> str:
    """test (fichero de tests: añadir casos está bien), config (cómo se ejecutan) o apoyo (helpers, fixtures…)."""
    return "config" if ES_CONFIG.search(f) else "test" if ES_TEST.search(f) else "apoyo"


def congelables(repo: Path, ref: str) -> list[str]:
    """Lo que queda congelado al aceptar en <ref>: tests/**, test/** (sin los documentos), *.test|spec.* y configs."""
    fs = git(repo, "ls-tree", "-r", "--name-only", ref).splitlines()
    return [f for f in fs if not NO_CONGELA.search(f)
            and (f.startswith(("tests/", "test/")) or ES_TEST.search(f) or ES_CONFIG.search(f))]


def _es_jev(r: dict) -> bool:
    return bool(re.search(r"\bjev\b", f"{r.get('by', '')}", re.I) or re.search(r"agente autom", f"{r.get('role', '')}", re.I))


def autorizaciones(repo: Path) -> list[dict]:
    """Los permisos firmados para editar tests: registros test-edit de acceptance/decisions.jsonl tal como está en HEAD
    (lo escribe solo el notario, firmar.sh; el arnés para una etapa que añada a ese registro algo que no sea una
    medición). Cada uno se contrasta con el acta del notario en $HERMES_SDD_HOME, fuera del alcance de las etapas."""
    out = []
    for l in git(repo, "show", "HEAD:acceptance/decisions.jsonl").splitlines():
        try:
            r = json.loads(l)
        except ValueError:
            continue
        if r.get("type") == "test-edit" and r.get("files") and r.get("head"):
            out.append(r)
    return out


def _acta_confirma(r: dict) -> tuple[bool, str]:
    actas = HOME / "actas"
    if not actas.is_dir():
        return True, " (sin actas del notario en esta máquina: vale el registro)"
    for f in actas.glob(f"*/{r.get('gate', '')}.json"):
        try:
            a = json.loads(f.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        for x in a.get("autorizaciones") or []:
            if x.get("pregunta") == r.get("question") and set(r["files"]) <= set(x.get("ficheros") or []):
                return True, ""
    return False, f"{r.get('question')}: el notario no tiene acta de esa autorización (puerta {r.get('gate') or '?'})"


def _autorizada(repo: Path, sha: str, fichero: str, auts: list[dict] | None = None) -> tuple[bool, str]:
    """¿Una persona autorizó, firmado por el notario, editar <fichero> en el commit <sha>? Vale un registro test-edit que
    nombre ese fichero, anterior al commit (su HEAD es antecesor) y sin una aceptación por medio (un test editado y
    aceptado vuelve a quedar congelado; la aceptación de la misma puerta que lo autorizó no cuenta). Ni el mensaje del
    commit ni las preguntas de .sdd/ autorizan nada: las puede escribir la propia etapa."""
    auts = autorizaciones(repo) if auts is None else auts
    motivo = "ninguna autorización firmada por una persona nombra este fichero"
    for r in auts:
        if fichero not in r["files"]:
            continue
        if _es_jev(r) and not r.get("tighten"):
            motivo = f"{r.get('question')} la registró Jev, no una persona"
            continue
        if subprocess.run(["git", "-C", str(repo), "merge-base", "--is-ancestor", r["head"], sha], capture_output=True).returncode != 0:
            motivo = f"{r.get('question')} se firmó después de este commit"
            continue
        caducada = False
        entre = set(git(repo, "rev-list", f"{r['head']}..{sha}").split())
        for tag in git(repo, "tag", "-l", "fase-*-accepted", "entrega-*").split():
            c = git(repo, "rev-list", "-n1", tag).strip()
            if c in entre and f"Gate-Id: {r.get('gate')}" not in git(repo, "log", "-1", "--format=%B", c):
                caducada = True
                motivo = f"{r.get('question')} caducó al aceptar {tag}"
                break
        if caducada:
            continue
        ok, nota = _acta_confirma(r)
        if not ok:
            motivo = nota
            continue
        solo = " — solo para endurecerlo" if r.get("tighten") else ""
        return True, f"{r.get('question')}: {r.get('by')} ({r.get('role')}), puerta {r.get('gate') or '?'}{nota}{solo}"
    return False, motivo


def _diff_por_fichero(repo: Path, sha: str, ficheros: list[str]) -> dict:
    diff = git(repo, "show", "-U0", "--format=", sha, "--", *ficheros)
    actual, por_fichero = None, {}
    for l in diff.splitlines():
        if l.startswith("diff --git"):
            actual = l.split(" b/")[-1]; por_fichero.setdefault(actual, [[], []])
        elif actual and l.startswith("-") and not l.startswith("---"):
            por_fichero[actual][0].append(l[1:].strip())
        elif actual and l.startswith("+") and not l.startswith("+++"):
            por_fichero[actual][1].append(l[1:].strip())
    return por_fichero


def debilitamiento(quitadas: list[str], puestas: list[str]) -> list[str]:
    """Señales de que un cambio comprueba menos: patrones en lo añadido y aserciones que se van."""
    senales = sorted({d for x in puestas for rx, d in DEBIL if rx.search(x)}
                     | {d for rx, d in DEBIL_JUNTO if rx.search("\n".join(puestas))})
    aq = sum(len(ASERCION.findall(x)) for x in quitadas)
    ap = sum(len(ASERCION.findall(x)) for x in puestas)
    if aq > ap:
        senales.append(f"quita {aq - ap} aserción(es)")
    cita = lambda xs: set(re.findall(r"REQ-[A-Z]+-\d{3}(?: AC\d+)?|AC-\d{3}-\d{2}", " ".join(xs)))
    # una cita sustituida por otra más concreta del mismo requisito («REQ-F-001» → «REQ-F-001 AC5») no se quita
    puestas_c = cita(puestas)
    quitadas_citas = sorted(c for c in cita(quitadas) - puestas_c if not any(x.startswith(c) for x in puestas_c))
    if quitadas_citas:
        senales.append("deja de citar " + ", ".join(quitadas_citas[:6]) + ("…" if len(quitadas_citas) > 6 else ""))
    return senales


def congelados(repo: Path, desde: str | None = None) -> list[dict]:
    """`desde`: solo commits posteriores a esa referencia (en una puerta, lo hecho desde la última aceptación)."""
    out = []
    ya = set(git(repo, "rev-list", desde).split()) if desde else set()
    tags = [t for t in git(repo, "tag", "-l", "fase-*-accepted", "--sort=creatordate").split() if t]
    auts = autorizaciones(repo)
    vistos = set()   # (commit, fichero): un commit que toca un test de la FASE-0 y otro de la FASE-1 informa de los dos
    for tag in tags:
        ficheros = congelables(repo, tag)
        if not ficheros:
            continue
        for linea in git(repo, "log", "--format=%H%x09%s", f"{tag}..HEAD", "--", *ficheros).splitlines():
            sha, asunto = linea.split("\t", 1)
            if sha in ya:
                continue
            if len(git(repo, "rev-list", "--parents", "-n1", sha).split()) > 2:   # merge: los cambios ya están en sus commits
                continue
            for f, (q, p) in _diff_por_fichero(repo, sha, ficheros).items():
                if (sha, f) in vistos:
                    continue
                clase = _clase(f)
                pset = set(p)
                cambiadas = [x for x in q if x and not TRIVIAL.match(x) and x not in pset]
                if clase != "test":   # en helpers, fixtures y configs también cuenta lo añadido: ahí no van tests nuevos
                    qset = set(q)
                    cambiadas += [x for x in p if x and not TRIVIAL.match(x) and x not in qset]
                senales = debilitamiento(q, p)
                if not cambiadas and not senales:
                    continue
                ok, por = _autorizada(repo, sha, f, auts)
                vistos.add((sha, f))
                out.append({"commit": sha[:7], "asunto": asunto, "fichero": f, "clase": clase, "congelado_en": tag,
                            "lineas_cambiadas": len(cambiadas), "debilitamiento": senales,
                            "aserciones_quitadas": [x for x in q if ASERCION.search(x) and x not in pset][:3],
                            "aserciones_puestas": [x for x in p if ASERCION.search(x) and x not in set(q)][:3],
                            "autorizado": ok, "autorizacion": por,
                            # autorizado por una persona: lo que hizo es lo que se pidió; las señales quedan a la vista, sin
                            # grave. Autorizado solo para ENDURECER (lo puede firmar Jev): una señal de que afloja es grave
                            "grave": not ok or (por.endswith("solo para endurecerlo") and bool(senales))})
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
            dado, then = partes(texto)
            lit_then = literales(then)
            # Los datos del criterio: textos «…» y también fechas (2026-11-14): un recorrido largo que cita muchos
            # criterios contiene casi todos los textos, pero no hace el caso del criterio si usa otro día (sala,
            # REQ-F-015 AC1: el viaje de la FASE-3 desbloqueaba el 2026-11-15 y contaba como prueba del 2026-11-14)
            fechas = sorted(set(re.findall(r"\b\d{4}-\d{2}-\d{2}\b", re.sub(r"«[^»]*»", "", texto))))
            lit_todo = literales(texto) + fechas
            sv = se_ve(c)
            if sv:
                # Con «Se ve», los textos tienen tipo: lo que se ve es texto exacto, un {dato} es plantilla (no se exige
                # entero) y lo que el GIVEN/WHEN ya cita es dato del ejemplo, que el test puede cambiar (otro actor)
                datos = set(literales(dado))
                # «Hola, lucia» en el THEN es un caso de la plantilla «Hola, {usuario}»: dato del ejemplo también
                casos = [re.compile("^" + ".+".join(re.escape(norm(p)) for p in re.split(r"\{[^{}]+\}", x)) + "$")
                         for x, plantilla in sv[0] if plantilla]
                lit_then = [x for x, plantilla in sv[0] if not plantilla] + \
                    [x for x in lit_then if x not in datos and not any(c.match(norm(x)) for c in casos)]
                lit_then = list(dict.fromkeys(lit_then))
                lit_todo = lit_then + fechas
            if not lit_todo:
                continue
            cuerpos = [(t, _cuerpo_test(repo, t.get("file", ""), t.get("name", ""))) for t in c.get("tests", [])]
            cuerpos = [(t, norm(b)) for t, b in cuerpos if b]
            # grave solo si NINGÚN test del criterio comprueba el texto del THEN (club: los de integración comprueban el
            # código de error y el e2e del mismo criterio el texto en pantalla; eso está bien)
            sin_nadie = [x for x in lit_then if cuerpos and not any(norm(x) in n for _, n in cuerpos)]
            for t, n in cuerpos:
                falta_then = [x for x in lit_then if norm(x) not in n]
                falta = [x for x in lit_todo if norm(x) not in n and x not in falta_then]
                if falta_then or falta:
                    out.append({"req": r["id"], "ac": c.get("n"), "prioridad": r.get("priority"), "test": t.get("name", "")[:120],
                                "fichero": t.get("file"), "via": t.get("via"), "faltan_then": falta_then, "faltan_datos": falta,
                                "grave": bool(set(falta_then) & set(sin_nadie)) and r.get("priority") == "Must"})
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


def _en_alcance(acc: dict, r: dict) -> bool:
    s = (acc.get("scope") or {}).get("requirements")
    return not s or r.get("id") in s


def _sidecars(repo: Path, dir_: str) -> tuple[dict, dict]:
    """Los JSON que deja el helper de captura junto a cada PNG (`captura(page, info, id, { ve })` →
    AC-001-02.json: {criterio, test, ve[], url, sha256}), por sha256 de la imagen y por ruta sin extensión."""
    por_sha, por_ruta = {}, {}
    base = repo / dir_
    if not base.is_dir():
        return por_sha, por_ruta
    for p in base.rglob("*.json"):
        try:
            j = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, ValueError):
            continue
        if not isinstance(j, dict) or not (j.get("test") or j.get("criterio")):
            continue
        if j.get("sha256"):
            por_sha[j["sha256"]] = j
        por_ruta[str(p.relative_to(repo).with_suffix(""))] = j
    return por_sha, por_ruta


def _imagenes(c: dict) -> list[dict]:
    """Las imágenes que enseñan el criterio según el libro (`shown_by`; un libro antiguo: las capturas por nombre),
    con su sha256 cuando el libro lo sabe."""
    adj = {a["path"]: a for e in c.get("evidence", []) for a in e.get("attachments", []) if a.get("kind") == "image"}
    adj.update({a["path"]: a for t in c.get("tests", []) for a in t.get("attachments", []) if a.get("kind") == "image"})
    if "shown_by" in c:
        return [adj.get(p, {"path": p}) for p in c["shown_by"]]
    return [a for e in c.get("evidence", []) if e.get("kind") == "capture"
            for a in e.get("attachments", []) if a.get("kind") == "image" and a.get("present")]


def capturas(repo: Path, acc: dict) -> list[dict]:
    """¿Cada captura enseña lo que promete su criterio? Primero el contrato: lo que el criterio dice que se ve
    («Se ve:») frente a lo que el test comprobó en pantalla antes de capturar (el JSON del helper); lo que falte, por
    OCR (segunda opinión). Un criterio sin nada comprobable con captura es un hallazgo «captura sin comprobar», no
    un silencio (club: 50 de 122 criterios no daban nada al OCR y se saltaban)."""
    out = []
    por_sha, por_ruta = _sidecars(repo, acc.get("evidence_dir") or "evidencias")
    for r in acc.get("requirements", []):
        if not _en_alcance(acc, r):
            continue
        for c in r.get("criteria", []):
            imgs = _imagenes(c)
            if not imgs:
                continue
            base = {"req": r["id"], "ac": c.get("n"), "prioridad": r.get("priority"), "capturas": [a["path"] for a in imgs]}
            sv = se_ve(c)
            if sv and sv[1]:   # «No visible: …»: el criterio dice que no hay nada que ver
                continue
            if sv and sv[0]:
                pedidos, origen = sv[0], "se_ve"
            else:
                # Sin contrato (criterios anteriores a él): lo que el texto dice que se VE, desde «ve», «mensaje»,
                # «aparece»… («queda guardada para «2ºB»» no promete enseñar «2ºB»; «ve … como «Tuya»» sí)
                pedidos, origen = [(x, False) for x in _visibles(c.get("text") or "")], "criterio"
            if not pedidos:
                out.append({**base, "no_se_ve": [], "sin_comprobar": True, "grave": False,
                            "motivo": "el criterio no dice qué se ve: falta «- Se ve: \"…\" en <pantalla>» o «- No visible: <motivo>»"})
                continue
            comprobado = []   # lo que el test afirmó visible antes de capturar (el JSON del helper)
            for a in imgs:
                sc = por_sha.get(a.get("sha256") or "") or por_ruta.get(str(Path(a["path"]).with_suffix("")))
                if sc:
                    comprobado += [str(v) for v in sc.get("ve") or []]
            no, por_ocr = [], []
            for x, plantilla in pedidos:
                trozos = plantilla_partes(x) if plantilla else [x]
                if all(any(en_texto(t, v) for v in comprobado) for t in trozos):
                    continue
                if imgs and all(any(en_texto(t, ocr(repo / a["path"])) for a in imgs) for t in trozos):
                    por_ocr.append(x)
                    continue
                no.append(x)
            if no:
                out.append({**base, "no_se_ve": no, "origen": origen, "comprobado_por_el_test": sorted(set(comprobado))[:10],
                            "grave": r.get("priority") == "Must"})
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


# ── 5. mutantes ─────────────────────────────────────────────────────────────────────────────────────────────────────
NEGACION = re.compile(r"\b(?:does not|doesn't|do not|don't|no longer|not|never|without|ya no|no|nunca|ni|sin)\b", re.I)


def _visibles(texto: str) -> list[str]:
    """Para criterios SIN el contrato «Se ve» (los anteriores a él): los textos «…» que el criterio dice que se VEN,
    solo los de las frases del THEN con un verbo de ver («ve el mensaje "x" y "pista-2026" sigue sirviendo para
    entrar» promete ver "x", no la contraseña). Con «Se ve:» no se adivina nada: manda lo que dice esa línea."""
    _, then = partes(texto)
    out = []
    for frase in re.split(r"\s+(?:and|y|e)\s+(?=[^\"«“]*(?:[\"«“][^\"»”]*[\"»”][^\"«“]*)*$)", then):
        # «… WHEN "pablo" signs up again THEN the user sees "x"»: "pablo" es quien actúa, no lo que se ve; y «(the same text
        # as for "lucia")» compara, no promete verlo (club, FASE-8: la captura de REQ-F-013 AC6 se daba por mala)
        frase = re.split(r"\b(?:THEN|ENTONCES)\b", frase)[-1] if re.search(r"\b(?:WHEN|GIVEN|CUANDO|DADO)\b", frase) else frase
        frase = re.sub(r"\([^()]*\)", " ", frase)
        # Lo que el criterio promete que NO se ve no se exige («"carmen" does not appear», «ya no sale»; club, entrega 2:
        # REQ-F-018 AC2). Se corta la frase en la negación y vale lo de antes: «ve "x", que no lista "pablo"» promete
        # "x" (antes se descartaba la frase entera, también "x")
        neg = NEGACION.search(re.sub(r"[\"«“][^\"»”]*[\"»”]", lambda m: " " * len(m.group(0)), frase))
        if neg:
            frase = frase[:neg.start()]
        if re.search(VERBOS_VER, frase):
            out += [x for x in literales(frase) if x not in out]
    return out


def _ficheros_test(copia: Path, c: dict) -> tuple[list[str], list[str]]:
    """(e2e, unitarios) que el método enlaza a un criterio, como rutas relativas de la copia."""
    e2e, uni = set(), set()
    for t in c.get("tests", []):
        f = t.get("file") or ""
        p = copia / f if (copia / f).exists() else next((x for x in copia.joinpath("tests").rglob(Path(f).name)), None)
        if not p:
            continue
        rel = str(p.relative_to(copia))
        (e2e if "e2e" in (t.get("report") or "") or "/e2e/" in rel else uni).add(rel)
    return sorted(e2e), sorted(uni)


_COMENTARIO = re.compile(r"^\s*(//|\*|/\*|<!--)")


def _codigo(p: Path) -> list[str]:
    return [l for l in p.read_text(encoding="utf-8", errors="replace").splitlines() if not _COMENTARIO.match(l)]


def _muta(texto: str, lit: str) -> str:
    """Cambia el texto en las líneas de código (no en los comentarios)."""
    return "\n".join(l if _COMENTARIO.match(l) else l.replace(lit, "MUTANTE") for l in texto.split("\n"))


def _comando(cmd: list[str]) -> list[str]:
    """La suite con poca prioridad y pocos workers: los mutantes corren mientras Hermes trabaja (club: con la máquina a
    load 12, Hermes perdió un worker). HSDD_MUT_WORKERS (2 por omisión) y HSDD_MUT_NICE (10; 0 = sin nice)."""
    w = os.environ.get("HSDD_MUT_WORKERS", "2").strip() or "2"
    cmd = list(cmd)
    if cmd[:3] == ["npx", "playwright", "test"] and not any(a.startswith("--workers") for a in cmd):
        cmd.insert(3, f"--workers={w}")
    elif cmd[:3] == ["npx", "vitest", "run"] and not any(a.startswith("--maxWorkers") for a in cmd):
        cmd.insert(3, f"--maxWorkers={w}")
    n = os.environ.get("HSDD_MUT_NICE", "10").strip()
    if n and n != "0" and shutil.which("nice"):
        cmd = ["nice", "-n", n, *cmd]
    return cmd


def _ejecuta(copia: Path, cmd: list[str], minutos: int = 10) -> bool:
    """True si la suite pasa."""
    try:
        return subprocess.run(_comando(cmd), cwd=copia, capture_output=True, text=True, timeout=minutos * 60).returncode == 0
    except subprocess.TimeoutExpired:
        return False


# Caché de mutantes en .sdd/hermes/mutantes-cache.json: el resultado de un mutante depende del texto que se cambia, de
# los ficheros de la app que lo contienen y de los tests que se ejecutan (más los helpers y la configuración de los
# tests): con la clave por hash de todo eso, un mutante ya ejecutado no se repite (re-aceptaciones, el cierre con los
# Must de todas las FASEs) y cualquier cambio en esos ficheros lo invalida. La línea base (¿los tests pasan sin mutar?)
# depende además de toda la app: su clave lleva el hash de src/ entero.
CACHE_MUT = "mutantes-cache.json"
CACHE_MUT_MAX = 4000
_CONFIG_TESTS = ("package.json", "package-lock.json", "playwright.config.js", "playwright.config.ts", "playwright.config.mjs",
                 "vitest.config.js", "vitest.config.ts", "vitest.config.mjs", "vite.config.js", "vite.config.ts", "vite.config.mjs")


def _sha(*partes: bytes) -> str:
    import hashlib
    h = hashlib.sha256()
    for b in partes:
        h.update(hashlib.sha256(b).digest())
    return h.hexdigest()


def _hash_ficheros(base: Path, rels) -> str:
    """Hash de (ruta, contenido) de cada fichero; uno que no existe cuenta como vacío con su ruta."""
    trozos = []
    for r in sorted(set(rels)):
        p = base / r
        trozos += [r.encode(), p.read_bytes() if p.is_file() else b"\0ausente"]
    return _sha(*trozos)


def _soporte_tests(copia: Path) -> list[str]:
    """Lo que no es un test pero cambia lo que un test hace: helpers, fixtures y la configuración de la suite."""
    out = [c for c in _CONFIG_TESTS if (copia / c).is_file()]
    t = copia / "tests"
    if t.is_dir():
        out += [str(p.relative_to(copia)) for p in t.rglob("*") if p.is_file() and "node_modules" not in p.parts
                and not re.search(r"\.(spec|test)\.[a-z]+$", p.name)]
    return out


def _leer_cache(repo: Path) -> dict:
    try:
        c = json.loads((repo / ".sdd" / "hermes" / CACHE_MUT).read_text(encoding="utf-8"))
        return c if isinstance(c, dict) and c.get("v") == 1 and isinstance(c.get("r"), dict) else {"v": 1, "r": {}}
    except (OSError, ValueError):
        return {"v": 1, "r": {}}


def _guardar_cache(repo: Path, c: dict) -> None:
    r = c["r"]
    if len(r) > CACHE_MUT_MAX:   # las más recientes
        c["r"] = dict(sorted(r.items(), key=lambda kv: kv[1].get("t", 0))[-CACHE_MUT_MAX:])
    f = repo / ".sdd" / "hermes" / CACHE_MUT
    try:
        f.parent.mkdir(parents=True, exist_ok=True)
        tmp = f.with_suffix(".tmp")
        tmp.write_text(json.dumps(c, ensure_ascii=False), encoding="utf-8")
        tmp.replace(f)
    except OSError:
        pass


def _junit_pasa(repo: Path, fichero: str) -> bool:
    """¿El JUnit de la última etapa (.sdd/junit/*.xml) tiene casos de ese fichero de test y ninguno falló?"""
    import xml.etree.ElementTree as ET
    nombre, casos, malos = Path(fichero).name, 0, 0
    for x in (repo / ".sdd" / "junit").glob("*.xml"):
        try:
            raiz = ET.parse(x).getroot()
        except (ET.ParseError, OSError):
            continue
        for tc in raiz.iter("testcase"):
            if Path(tc.get("classname") or tc.get("file") or "").name == nombre or (tc.get("file") or "").endswith(fichero):
                casos += 1
                malos += any(h.tag in ("failure", "error") for h in tc)
    return casos > 0 and malos == 0


def mutantes(repo: Path, copia: Path, acc: dict, solo_must: bool = True, stats: dict | None = None) -> list[dict]:
    """Para cada texto que un criterio dice que se ve: se cambia en el código de la app (src/) de la copia y se
    ejecutan los tests que el método enlaza a ese criterio. Si todos siguen pasando, el criterio está «verificado»
    sin que ningún test lo compruebe. Se separa si lo detecta un e2e (lo que se ve en el vídeo) o solo un unitario.
    Lo ya ejecutado con los mismos ficheros sale de la caché (.sdd/hermes/mutantes-cache.json)."""
    import time
    out, cache = [], {}
    fuentes = [p for p in (copia / "src").rglob("*") if p.is_file() and p.suffix in (".js", ".ts", ".jsx", ".tsx", ".html", ".vue", ".svelte", ".mjs")]
    persistente = _leer_cache(repo)
    stats = stats if stats is not None else {}
    stats.update({"de_cache": 0, "ejecutados": 0})
    soporte = _hash_ficheros(copia, _soporte_tests(copia))
    app = _hash_ficheros(copia, [str(p.relative_to(copia)) for p in (copia / "src").rglob("*") if p.is_file()])
    for r in acc.get("requirements", []):
        if (solo_must and r.get("priority") != "Must") or not _en_alcance(acc, r):
            continue
        for c in r.get("criteria", []):
            e2e, uni = _ficheros_test(copia, c)
            sv = se_ve(c)
            # con «Se ve», sus textos exactos (una plantilla cambia con el dato: no se muta); sin él, los adivinados
            vis = ([] if sv[1] else [x for x, plantilla in sv[0] if not plantilla]) if sv else _visibles(c.get("text") or "")
            for lit in vis:
                # solo en código, no en comentarios (sala: «5ºC» solo estaba en un comentario de account-rules.js)
                con = [p for p in fuentes if any(lit in l for l in _codigo(p))]
                # e2e que contienen el texto aunque el método no los enlace a este criterio
                sueltos = sorted(str(x.relative_to(copia)) for x in (copia / "tests").rglob("*.spec.*")
                                 if "node_modules" not in x.parts and str(x.relative_to(copia)) not in e2e
                                 and norm(lit) in norm(x.read_text(encoding="utf-8", errors="replace")))
                base = {"req": r["id"], "ac": c.get("n"), "texto": lit, "e2e": e2e, "unitarios": uni}
                if not con:
                    out.append({**base, "resultado": "no está en el código", "grave": False})
                    continue
                clave = (lit, tuple(e2e), tuple(uni), tuple(sueltos))
                # Línea base: si los tests del criterio ya fallan sin mutar nada, cualquier mutante «muere» y no dice nada
                # (club, FASE-3: dos e2e rotos daban «lo detecta un e2e» a todo y la aceptación tardó 45 min)
                bkey = ("base", tuple(e2e), tuple(uni))
                tests_h = _hash_ficheros(copia, [*e2e, *uni])
                pbkey = "base:" + _sha(app.encode(), soporte.encode(), tests_h.encode())
                if bkey not in cache and pbkey in persistente["r"]:
                    cache[bkey] = tuple(persistente["r"][pbkey]["r"])
                if bkey not in cache:
                    cache[bkey] = ((not e2e or _ejecuta(copia, ["npx", "playwright", "test", *e2e])),
                                   (not uni or _ejecuta(copia, ["npx", "vitest", "run", *uni], 5)))
                    if all(cache[bkey]):   # un fallo (quizá intermitente) no se guarda: se vuelve a probar
                        persistente["r"][pbkey] = {"r": list(cache[bkey]), "t": time.time()}
                base_e2e, base_uni = cache[bkey]
                if not (base_e2e and base_uni):
                    fallan = ([*e2e] if not base_e2e else []) + ([*uni] if not base_uni else [])
                    # Si la etapa los vio pasar (su JUnit), lo que falla es este ordenador, no los tests: aviso leve
                    if fallan and all(_junit_pasa(repo, f) for f in fallan):
                        out.append({**base, "resultado": "sus tests pasaron en la etapa pero fallan en este ordenador: sin comprobar",
                                    "grave": False, "fallan_aqui": fallan})
                    else:
                        out.append({**base, "resultado": "sus tests ya fallan sin mutar nada", "grave": True, "fallan": fallan})
                    continue
                pkey = "mut:" + _sha(lit.encode(), _hash_ficheros(copia, [str(p.relative_to(copia)) for p in con]).encode(),
                                     _hash_ficheros(copia, [*e2e, *uni, *sueltos]).encode(), "|".join(e2e).encode(),
                                     "|".join(uni).encode(), "|".join(sueltos).encode(), soporte.encode())
                if clave not in cache and pkey in persistente["r"]:
                    cache[clave] = tuple(persistente["r"][pkey]["r"])
                    stats["de_cache"] += 1
                if clave not in cache:
                    stats["ejecutados"] += 1
                    originales = {p: p.read_text(encoding="utf-8", errors="replace") for p in con}
                    try:
                        for p, t in originales.items():
                            p.write_text(_muta(t, lit), encoding="utf-8")
                        muere_e2e = bool(e2e) and not _ejecuta(copia, ["npx", "playwright", "test", *e2e])
                        muere_uni = bool(uni) and not _ejecuta(copia, ["npx", "vitest", "run", *uni], 5)
                        muere_suelto = (not muere_e2e) and bool(sueltos) and not _ejecuta(copia, ["npx", "playwright", "test", *sueltos])
                    finally:
                        for p, t in originales.items():
                            p.write_text(t, encoding="utf-8")
                    cache[clave] = (muere_e2e, muere_uni, muere_suelto)
                    persistente["r"][pkey] = {"r": list(cache[clave]), "t": time.time()}
                    _guardar_cache(repo, persistente)   # tras cada mutante: si la etapa se corta, lo hecho no se pierde
                muere_e2e, muere_uni, muere_suelto = cache[clave]
                res = ("lo detecta un e2e" if muere_e2e
                       else "lo detecta un e2e que el método no enlaza a este criterio" if muere_suelto
                       else "solo lo detecta un unitario" if muere_uni
                       else "sin tests que lo comprueben" if not (e2e or uni) else "NINGÚN test lo detecta")
                out.append({**base, "resultado": res, "en": [str(p.relative_to(copia)) for p in con], "e2e_sueltos": sueltos if muere_suelto else [],
                            "grave": not (muere_e2e or muere_uni or muere_suelto),
                            "solo_unitario": muere_uni and not (muere_e2e or muere_suelto)})
    _guardar_cache(repo, persistente)
    return out


def lint_capturas(repo: Path, fase: str | None = None) -> list[dict]:
    """`sdd lint --captures` del método (antes de aceptar): captura tras una comprobación por API sin aserción en
    pantalla, captura tomada por un test que no cita su criterio (club, REQ-F-008 AC4), una imagen para muchos
    criterios, ids citados que no existen. Los errores son graves."""
    r = subprocess.run(["node", str(SDD), "lint", "--captures", "--json", *(["--fase", str(fase)] if fase else [])],
                       cwd=repo, capture_output=True, text=True)
    try:
        hs = json.loads(r.stdout or "{}").get("findings") or []
    except json.JSONDecodeError:
        return []
    return [{"codigo": h.get("code"), "fichero": h.get("file"), "linea": h.get("line"), "req": h.get("req"), "ac": h.get("ac"),
             "mensaje": h.get("message"), "grave": h.get("severity") == "error"} for h in hs]


def _ultima_aceptacion(repo: Path) -> str | None:
    """La aceptación más reciente (fase-N-accepted o entrega-N) alcanzable desde HEAD."""
    r = subprocess.run(["git", "-C", str(repo), "describe", "--tags", "--abbrev=0", "--match", "fase-*-accepted",
                        "--match", "entrega-*"], capture_output=True, text=True)
    return r.stdout.strip() or None


def de_aceptacion(repo: Path, fase: str | None, con_mutantes: bool = True) -> dict:
    """Lo que corre la etapa de aceptación de una FASE (o el cierre, sin FASE): todo, con mutantes en una copia
    temporal (git worktree con los node_modules del repo), y lo deja en .sdd/hermes/fidelidad-<N|global>.json."""
    import shutil, tempfile
    acc = aceptacion(repo, fase)
    res = {"repo": str(repo), "fase": fase, "sha": git(repo, "rev-parse", "--short", "HEAD").strip(),
           "congelados": congelados(repo, _ultima_aceptacion(repo)), "capturas": capturas(repo, acc), "coherencia": coherencia(repo),
           "vinculos": [x for x in vinculos(repo, acc) if x.get("grave")], "lint_capturas": lint_capturas(repo, fase)}
    if con_mutantes and (repo / "src").is_dir():
        copia = Path(tempfile.mkdtemp(prefix="hsdd-mut-")) / "c"
        try:
            subprocess.run(["git", "-C", str(repo), "worktree", "add", "-q", "--detach", str(copia), "HEAD"], check=True,
                           capture_output=True)
            if (repo / "node_modules").is_dir():
                (copia / "node_modules").symlink_to(repo / "node_modules")
            elif (copia / "package.json").exists():
                # Con la caja de GitHub el repo local no tiene node_modules (se instalaron en la caja): sin ellos la línea
                # base de los e2e fallaba y salía «sus tests ya fallan» como grave (taller3). Se instalan en la copia, como
                # en un despliegue; si no se puede, no hay mutantes (se dice), no tests rotos
                inst = ["npm", "ci"] if (copia / "package-lock.json").exists() else ["npm", "install"]
                r = subprocess.run([*inst, "--no-audit", "--no-fund"], cwd=copia, capture_output=True, text=True, timeout=600)
                if r.returncode != 0:
                    raise RuntimeError(f"no se pudieron instalar las dependencias para los mutantes ({' '.join(inst)}): "
                                       + (r.stderr or r.stdout).strip()[-200:])
                if "@playwright/test" in (copia / "package.json").read_text(errors="replace"):
                    subprocess.run(["npx", "playwright", "install", "chromium"], cwd=copia, capture_output=True, timeout=600)
            res["mutantes_cache"] = {}
            res["mutantes"] = mutantes(repo, copia, acc, stats=res["mutantes_cache"])
        except Exception as e:   # sin copia no hay mutantes: se dice, no se inventa
            res["mutantes_error"] = str(e)[:300]
        finally:
            subprocess.run(["pkill", "-f", f"{copia}/node_modules/"], capture_output=True)   # servidores que dejaron los e2e
            subprocess.run(["git", "-C", str(repo), "worktree", "remove", "--force", str(copia)], capture_output=True)
            shutil.rmtree(copia.parent, ignore_errors=True)
    res["graves"] = sum(1 for k in ("congelados", "capturas", "mutantes", "vinculos", "lint_capturas") for x in res.get(k, []) if x.get("grave")) \
        + sum(1 for x in res["coherencia"] if x.get("grave"))
    f = repo / ".sdd" / "hermes" / f"fidelidad-{fase or 'global'}.json"
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    return res


# ── informe ─────────────────────────────────────────────────────────────────────────────────────────────────────────
def todo(repo: Path) -> dict:
    acc = aceptacion(repo)
    return {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(),
            "congelados": congelados(repo), "vinculos": vinculos(repo, acc),
            "capturas": capturas(repo, acc), "coherencia": coherencia(repo), "lint_capturas": lint_capturas(repo)}


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
        bloque("capturas", "Capturas que no enseñan su criterio (o sin nada que comprobar)", lambda x:
               f"{x['req']} AC{x['ac']}: captura sin comprobar ({x['motivo']}) — {', '.join(x['capturas'][:2])}{'…' if len(x['capturas']) > 2 else ''}" if x.get("sin_comprobar") else
               f"{x['req']} AC{x['ac']}: no se ve {', '.join('«'+s+'»' for s in x['no_se_ve'])} en {', '.join(x['capturas'])}")
    if "lint_capturas" in res:
        bloque("lint_capturas", "Capturas antes de aceptar (sdd lint --captures)", lambda x:
               f"{x['fichero']}{':' + str(x['linea']) if x.get('linea') else ''} {x['codigo']}: {x['mensaje']}")
    if "mutantes" in res:
        xs = res["mutantes"]
        L.append(f"\nMutantes (texto que se ve, cambiado en el código): {len(xs)} — "
                 f"{sum(1 for x in xs if x['resultado'] == 'lo detecta un e2e')} los detecta un e2e, "
                 f"{sum(1 for x in xs if x.get('e2e_sueltos'))} un e2e no enlazado, "
                 f"{sum(1 for x in xs if x.get('solo_unitario'))} solo un unitario, "
                 f"{sum(1 for x in xs if x.get('grave') and x['resultado'] != 'sus tests ya fallan sin mutar nada')} ningún test, "
                 f"{sum(1 for x in xs if x['resultado'] == 'sus tests ya fallan sin mutar nada')} con sus tests ya rotos, "
                 f"{sum(1 for x in xs if x['resultado'] == 'no está en el código')} no están en el código")
        for x in xs:
            if x["resultado"] != "lo detecta un e2e":
                L.append(("  ⛔ " if x.get("grave") else "  ⚠️ ") + f"{x['req']} AC{x['ac']} «{x['texto']}»: {x['resultado']}"
                         + (f" (e2e: {', '.join(Path(e).name for e in x['e2e']) or 'ninguno'})" if x['resultado'] != 'no está en el código' else ""))
    if "coherencia" in res:
        bloque("coherencia", "Coherencia de los artefactos", lambda x: f"{x['donde']}: {x['detalle']}")
    return "\n".join(L)


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    cmd, repo = sys.argv[1], Path(sys.argv[2]).resolve()
    if cmd == "todo":
        res = todo(repo)
    elif cmd == "aceptacion":   # aceptacion <repo> [--fase N] [--sin-mutantes]
        fa = sys.argv[sys.argv.index("--fase") + 1] if "--fase" in sys.argv else None
        res = de_aceptacion(repo, fa, "--sin-mutantes" not in sys.argv)
    elif cmd in ("vinculos", "capturas"):
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(), cmd: globals()[cmd](repo, aceptacion(repo))}
    elif cmd == "lint_capturas":
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(), cmd: lint_capturas(repo)}
    elif cmd == "mutantes":   # mutantes <repo> <copia>: la copia es un worktree con node_modules (se modifica y se restaura)
        copia = Path(sys.argv[3]).resolve()
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(),
               "mutantes": mutantes(repo, copia, aceptacion(repo), solo_must="--todos" not in sys.argv)}
    elif cmd in ("congelados", "coherencia"):
        res = {"repo": str(repo), "sha": git(repo, "rev-parse", "--short", "HEAD").strip(), cmd: globals()[cmd](repo)}
    else:
        sys.exit(__doc__)
    print(json.dumps(res, ensure_ascii=False, indent=1) if "--json" in sys.argv else texto(res))
