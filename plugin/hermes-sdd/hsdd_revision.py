"""Revisión mecánica de la documentación antes de cada puerta (encargado, fase 4). Sin LLM, sin bloquear la puerta.

Cada comprobación sale de un fallo real:
- requisitos: «demo»/«inspection» con un criterio que un test puede leer (vasos REQ-NF-001, REQ-C-003); un Must sin
  necesidad del cliente detrás («Stack del proyecto» en vasos y propinas); un requisito sin criterios.
- ruta: el motivo para saltarse etapas contradice el stack («sin pantallas» en una web, vasos).
- plan: criterios que citan una pantalla de una FASE posterior (biblioteca); FASEs o tareas desproporcionadas para el
  número de requisitos funcionales (coches: 3 FASEs y 24 tareas para 199 líneas).
- fase / entrega: muchos más tests que código (coches, 5×); la captura de un criterio es la de otro requisito (vasos:
  REQ-F-001 AC1 mostraba la de REQ-F-003).

Un aviso **grave** es uno que hace imposible o engañosa la puerta: Jev no puede aprobarla solo (hsdd_nucleo.puede_jev).

  python3 hsdd_revision.py revisar <repo> <tipo> [--fase N] [--ia]   → {"avisos":[{grave, codigo, texto}], "graves": n}
  --ia: además, el revisor independiente con IA (lo pide puerta.sh si «revision_ia» de sdd.json incluye ese tipo)
"""
from __future__ import annotations

import json
import math
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
import hsdd_plan  # noqa: E402
import hsdd_fidelidad  # noqa: E402

SDD = Path(__file__).resolve().parents[2] / "metodo" / "scripts" / "sdd.mjs"
WEB = re.compile(r"\b(web|vite|astro|react|vue|svelte|next|html|frontend|pwa)\b", re.I)
SIN_UI = re.compile(r"sin pantallas|no tiene (?:interfaz|pantallas)|sin interfaz|no ui\b|without (?:a )?ui|no screens|headless", re.I)


def _aviso(codigo: str, texto: str, grave: bool = False) -> dict:
    return {"grave": grave, "codigo": codigo, "texto": texto}


def _leer(p: Path) -> str:
    try:
        return p.read_text(errors="replace")
    except OSError:
        return ""


def _requisitos(repo: Path) -> list:
    """[{id, tipo, titulo, verificacion, prioridad, necesidades, criterios}] de REQUIREMENTS.md."""
    texto = _leer(repo / "requirements" / "REQUIREMENTS.md")
    out = []
    for m in re.finditer(r"^### (REQ-([A-Z]+)-\d+):?\s*(.*?)\n(.*?)(?=^### |^## |\Z)", texto, re.M | re.S):
        cuerpo = m.group(4)
        campo = lambda k: (re.search(rf"^\s*-\s*\*\*{k}:\*\*\s*(.*)$", cuerpo, re.M | re.I) or [None, ""])[1].strip()
        if re.search(r"^\s*-\s*\*\*Status:\*\*\s*Deprecated", cuerpo, re.M | re.I):
            continue
        out.append({"id": m.group(1), "tipo": m.group(2), "titulo": m.group(3).strip(),
                    "verificacion": (re.findall(r"[a-z]+", campo("Verification").lower()) or [""])[0],
                    "verificacion_texto": campo("Verification"), "prioridad": campo("Priority"),
                    "necesidades": re.findall(r"N-\d+", campo("Needs")),
                    "criterios": [l.strip()[2:] for l in cuerpo.splitlines() if re.match(r"\s+- (GIVEN|WHEN|IF|WHILE)\b", l)]})
    return out


def _sdd_json(repo: Path, *args) -> dict:
    try:
        r = subprocess.run(["node", str(SDD), *args, "--json"], cwd=repo, capture_output=True, text=True, timeout=180)
        return json.loads(r.stdout or "{}")
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return {}


# ── por tipo de puerta ──────────────────────────────────────────────────────────────────────────────────────────
def requisitos(repo: Path) -> list:
    av = []
    for r in _requisitos(repo):
        if not r["criterios"] and r["tipo"] != "C":   # las restricciones llevan su comprobación en Verification
            av.append(_aviso("sin-criterios", f"{r['id']} «{r['titulo']}» no tiene criterios de aceptación: no se podrá comprobar", True))
            continue
        if r["verificacion"] in ("inspection", "demo"):
            medible = r["tipo"] == "C" or any(re.search(r"\d|\"[^\"]+\"|«[^»]+»", c) for c in r["criterios"] + [r["verificacion_texto"]])
            if medible:
                av.append(_aviso("verificable-con-test", f"{r['id']} «{r['titulo']}» se verifica por {r['verificacion']}, pero algún "
                                 "criterio lo podría leer un test; así te tocará comprobarlo a mano en la puerta"))
        if r["prioridad"].lower().startswith("must") and r["tipo"] != "C" and not r["necesidades"]:
            av.append(_aviso("sin-necesidad", f"{r['id']} «{r['titulo']}» es Must y no sale de ninguna necesidad tuya (Needs vacío)"))
    # Ejemplos que se contradicen a sí mismos (sala: «haya-27» (8 caracteres) llegó aprobado hasta la implementación)
    for h in hsdd_fidelidad.coherencia(repo):
        if h["tipo"] == "ejemplo":
            av.append(_aviso("ejemplo-incoherente", f"Un ejemplo no cuadra: {h['detalle']}", True))
    return av


def ruta(repo: Path) -> list:
    agentes = _leer(repo / "AGENTS.md")
    stack = " ".join(re.findall(r"^\s*-\s*(?:stack|server|test):.*$", agentes, re.M | re.I))
    motivos = _leer(repo / ".sdd" / "hermes" / "ruta.json")
    if WEB.search(stack) and SIN_UI.search(motivos):
        return [_aviso("ruta-contradice-stack", "La ruta se salta etapas porque el proyecto «no tendría pantallas», pero el stack es web")]
    return []


def plan(repo: Path) -> list:
    av = [_aviso("criterio-de-otra-fase", f"{h['requisito']} {h['criterio']} (FASE-{h['fase']}) cita «{h['cita']}», que llega en la "
                 f"FASE-{h['fase_vista']}: esa FASE no podrá aceptarse tal cual (pide un cambio con ✏️ para moverlo o adelantar esa pantalla)", True) for h in hsdd_plan.dependencias(repo)]
    n_f = sum(1 for r in _requisitos(repo) if r["tipo"] == "F")
    fases = list((repo / "plan" / "fases").glob("FASE-*.md"))
    tareas = sum(len(re.findall(r"^- \[[ x]\] TASK-", _leer(t), re.M)) for t in (repo / "task").glob("TASK-FASE-*.md"))
    if n_f and len(fases) > max(2, math.ceil(n_f / 2)):
        av.append(_aviso("fases-de-mas", f"{len(fases)} FASEs para {n_f} requisitos funcionales: más fases son más puertas y más espera"))
    if n_f and tareas > max(8, 4 * n_f):
        av.append(_aviso("tareas-de-mas", f"{tareas} tareas para {n_f} requisitos funcionales: parece más trabajo del necesario"))
    # Referencias a escenarios o requisitos que ya no existen (sala: un cambio quitó AC-004-03 y el plan lo seguía citando)
    for h in hsdd_fidelidad.coherencia(repo):
        if h["tipo"] == "referencia" and h["donde"].startswith(("plan/", "task/")):
            av.append(_aviso("referencia-caducada", f"{h['donde']} {h['detalle']}"))
    return av


def _capturas_ajenas(repo: Path, fase: str | None) -> list:
    """Criterios cuya única captura con nombre de criterio es la de otro (vasos)."""
    ledger = _sdd_json(repo, "accept", *(["--fase", fase] if fase else []))
    alcance = set((ledger.get("scope") or {}).get("requirements") or [])
    av = []
    for r in ledger.get("requirements") or []:
        if alcance and r.get("id") not in alcance:
            continue
        for c in r.get("criteria") or []:
            n = c.get("n") or c.get("index")
            nombres = [Path(a.get("path", "")).name for e in c.get("evidence") or [] for a in e.get("attachments") or []
                       if a.get("kind") == "image"]
            con_criterio = [x for x in nombres if re.search(r"REQ-[A-Z]+-\d+-AC\d+", x)]
            propio = f"{r['id']}-AC{n}"
            if con_criterio and not any(propio in x for x in con_criterio):
                otro = re.search(r"REQ-[A-Z]+-\d+-AC\d+", con_criterio[0]).group(0)
                av.append(_aviso("captura-de-otro", f"{r['id']} AC{n}: su captura es la de {otro}; la demo no enseña este criterio"))
    return av


def fase(repo: Path, n: str | None) -> list:
    av = []
    impl = [x for x in hsdd_plan_etapas(repo) if x.get("etapa") == "implementar" and str(x.get("fase")) == str(n) and x.get("tests_codigo")]
    if impl:
        tc = impl[-1]["tests_codigo"]
        if tc.get("codigo", 0) > 0 and tc.get("tests", 0) > 3 * tc["codigo"]:
            av.append(_aviso("tests-de-mas", f"La FASE-{n} añadió {tc['tests']} líneas de tests para {tc['codigo']} de código "
                             f"({round(tc['tests'] / tc['codigo'], 1)}×): revisa si los tests prueban lo que piden los criterios"))
    return av + _capturas_ajenas(repo, n) + _fidelidad(repo, n)


def _fidelidad(repo: Path, n: str | None) -> list:
    """Lo que dejó la etapa de aceptación en .sdd/hermes/fidelidad-<N>.json (hsdd_fidelidad): tests congelados cambiados
    sin autorizar o debilitados, capturas que no enseñan su criterio y textos que ningún test comprueba."""
    f = repo / ".sdd" / "hermes" / f"fidelidad-{n or 'global'}.json"
    try:
        r = json.loads(f.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return []
    av = []
    for x in r.get("congelados", []):
        if x.get("grave"):
            que = "sin que una persona lo autorizara" if not x.get("autorizado") else "debilitándolo"
            av.append(_aviso("test-congelado", f"Se cambió un test ya aceptado ({x['fichero']}, {x['commit']}) {que}"
                             + (f": {', '.join(x['debilitamiento'])}" if x.get("debilitamiento") else ""), True))
    for x in r.get("capturas", []):
        if x.get("grave"):
            av.append(_aviso("captura-no-ensena", f"La captura de {x['req']} AC{x['ac']} no enseña {', '.join('«' + s + '»' for s in x['no_se_ve'])}", True))
    for x in r.get("mutantes", []):
        if x.get("grave") and x.get("fallan"):
            av.append(_aviso("tests-rotos", f"{x['req']} AC{x['ac']}: sus tests ya fallan ({', '.join(Path(e).name for e in x['fallan'])})", True))
        elif x.get("grave"):
            av.append(_aviso("sin-comprobar", f"{x['req']} AC{x['ac']}: si «{x['texto']}» cambia en el código, ningún test lo nota", True))
        elif x.get("e2e_sueltos"):
            av.append(_aviso("e2e-sin-enlazar", f"{x['req']} AC{x['ac']}: lo comprueba un e2e que no lo cita ({', '.join(Path(e).name for e in x['e2e_sueltos'])})"))
    return av


def hsdd_plan_etapas(repo: Path) -> list:
    out = []
    for l in _leer(repo / ".sdd" / "hermes" / "etapas.jsonl").splitlines():
        try:
            out.append(json.loads(l))
        except ValueError:
            pass
    return out


QUE_MIRAR = {
    "requisitos": "requirements/REQUIREMENTS.md (y CUSTOMER-NEEDS.md, intent/)",
    "ruta": ".sdd/hermes/ruta.json frente a AGENTS.md y requirements/",
    "plan": "plan/ (PLAN.md y plan/fases/) frente a requirements/",
    "fase": "lo que entrega la FASE-{f}: plan/fases/FASE-{f}-*.md, su código y sus tests, y acceptance/",
    "entrega": "el proyecto entero frente a requirements/ y acceptance/",
}


def revisor_ia(repo: Path, tipo: str, fase_n: str | None = None) -> list:
    """Revisor independiente (opt-in: «revision_ia» en sdd.json): una sesión de Claude aparte, en el sandbox de solo
    lectura, SIN el wiki del encargado (no es juez y parte de la entrada que preparó). Hasta 5 avisos."""
    raiz = Path(__file__).resolve().parents[2]
    que = QUE_MIRAR.get(tipo, "").format(f=fase_n)
    prompt = (f"Eres un revisor independiente. Revisa SOLO LEYENDO {que} antes de que una persona apruebe la puerta "
              f"«{tipo}». No leas wiki/ ni .sdd/hermes/ y no modifiques nada. Busca lo que haría fallar o engañar a esa "
              "puerta: contradicciones, promesas sin criterio que las compruebe, ambigüedades que dos personas leerían "
              "distinto, algo pedido que falta, desproporción. Nada de estilo ni reescrituras. Responde SOLO con hasta 5 "
              "líneas, cada una «GRAVE: …» (hace imposible o engañosa la puerta) o «AVISO: …», en castellano llano y "
              "citando el id (REQ-…, FASE-…); si no hay nada, responde «NADA».")
    try:
        r = subprocess.run(["bash", str(raiz / "executors" / "claude.sh"), str(repo), f"revision-{tipo}", prompt, "sonnet"],
                           capture_output=True, text=True, timeout=900, env={**__import__("os").environ, "SDD_SANDBOX": "1"})
        fin = json.loads((r.stdout.strip().splitlines() or ["{}"])[-1])
        res = json.loads(_leer(Path(repo) / ".sdd" / "hermes" / "runs" / f"{fin.get('run')}.json") or "{}").get("result") or ""
    except (OSError, ValueError, subprocess.TimeoutExpired):
        return []
    av = []
    for l in res.splitlines():
        m = re.match(r"\s*[-*]?\s*(GRAVE|AVISO)\s*:\s*(.+)", l)
        if m:
            av.append(_aviso("revisor", "Revisor: " + m.group(2).strip()[:300], m.group(1) == "GRAVE"))
    return av[:5]


def revisar(repo, tipo: str, fase_n: str | None = None, ia: bool = False) -> dict:
    repo = Path(repo)
    av = {"requisitos": lambda: requisitos(repo), "ruta": lambda: ruta(repo), "plan": lambda: plan(repo),
          "fase": lambda: fase(repo, fase_n), "entrega": lambda: requisitos(repo) + _capturas_ajenas(repo, None) + _fidelidad(repo, None)
          }.get(tipo, lambda: [])()
    if ia:
        av += revisor_ia(repo, tipo, fase_n)
    return {"avisos": av, "graves": sum(1 for a in av if a["grave"])}


def linea(rev: dict, max_lineas: int = 6) -> str:
    """Bloque para el texto de la puerta: «🧭 Encargado: N avisos» y los primeros."""
    av = rev.get("avisos") or []
    if not av:
        return ""
    cab = f"🧭 Encargado: {len(av)} aviso{'s' if len(av) != 1 else ''}" + (f" ({rev['graves']} grave{'s' if rev['graves'] != 1 else ''}: Jev no puede aprobar esta puerta solo)" if rev.get("graves") else "")
    filas = [f"{'‼️' if a['grave'] else '•'} {a['texto']}" for a in sorted(av, key=lambda a: not a["grave"])[:max_lineas]]
    if len(av) > max_lineas:
        filas.append(f"… y {len(av) - max_lineas} más")
    return cab + "\n" + "\n".join(filas)


if __name__ == "__main__":
    if len(sys.argv) < 4 or sys.argv[1] != "revisar":
        print(__doc__, file=sys.stderr)
        sys.exit(2)
    f = sys.argv[sys.argv.index("--fase") + 1] if "--fase" in sys.argv else None
    rev = revisar(sys.argv[2], sys.argv[3], f, ia="--ia" in sys.argv)
    print(json.dumps({**rev, "linea": linea(rev)}, ensure_ascii=False))
