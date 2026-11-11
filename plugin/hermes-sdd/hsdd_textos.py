"""Textos de las puertas para personas: claros, en castellano llano y sin jerga del método.

puerta.sh los pide aquí (`hsdd_textos.py puerta <tipo> <repo> …` → JSON {titulo, texto}); Telegram, el panel y Hermes
Desktop enseñan ese mismo texto. La regla: primero lo que la persona tiene que saber para decidir, con sus palabras;
lo técnico (ids, tags, comandos) solo cuando ayuda a encontrar algo, y nunca como lo principal.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# ── vocabulario: del método al castellano ────────────────────────────────────────────────────────────────────────
ETAPAS = {
    "requirements-engineer": "requisitos", "specifications-engineer": "especificación detallada",
    "spec-auditor": "revisión de la especificación", "test-planner": "plan de pruebas aparte",
    "security-auditor": "revisión de seguridad", "ux-designer": "diseño visual y de uso",
    "tech-designer": "diseño técnico", "plan-architect": "plan por fases", "task-generator": "tareas",
    "task-implementer": "programación", "acceptance": "comprobación final con demo", "gap-detector": "búsqueda de huecos",
}
DUDAS = {
    "external_customer": "si la web es para un cliente que tiene que revisarla y darla por buena",
    "sensitive_data": "si va a manejar datos personales o delicados",
    "multi_actor": "si la usarán distintos tipos de persona (clientes, empleados, administradores…)",
    "integrations": "si tiene que conectarse con otros servicios (pagos, correo, otras webs…)",
    "ui_flows": "si tiene pantallas con varios pasos o formularios largos",
    "long_lived": "si se va a mantener y ampliar durante mucho tiempo",
    "complex_state": "si guarda cosas que cambian de estado (pedidos, reservas, cuentas…)",
}
VEREDICTOS = {
    "VERIFIED": ("✅", "funciona y está comprobado"), "FAILING": ("❌", "no funciona"),
    "MISSING": ("⚠️", "sin comprobar todavía"), "WAIVED": ("🟡", "aceptado sin comprobar (exención)"),
    "STALE": ("⚠️", "comprobado con una versión anterior"), "PARTIAL": ("⚠️", "comprobado solo en parte"),
}


def _leer(p: Path) -> str:
    try:
        return p.read_text(errors="replace")
    except OSError:
        return ""


def _corta(t: str, n: int = 280) -> str:
    t = " ".join(t.split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def _plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


# ── lectura de los documentos del método ─────────────────────────────────────────────────────────────────────────
CAMPO = re.compile(r"^\s*[-*]?\s*\*\*([^*]+?)\s*:?\s*\*\*\s*:?\s*(.*)$")


def requisitos(repo: Path) -> list[dict]:
    """[{id, titulo, cliente, prioridad, necesidades, tipo}] de requirements/REQUIREMENTS.md (bloques ### REQ-…)."""
    res, actual = [], None
    for linea in _leer(repo / "requirements" / "REQUIREMENTS.md").splitlines():
        m = re.match(r"^###\s+(REQ-([A-Z]+)-[0-9A-Za-z]+)\s*:?\s*(.*)$", linea)
        if m:
            actual = {"id": m.group(1), "tipo": m.group(2), "titulo": m.group(3).strip(), "cliente": "", "prioridad": "",
                      "necesidades": None, "obsoleto": False}
            res.append(actual)
            continue
        if linea.startswith("#"):
            actual = None
        if not actual:
            continue
        c = CAMPO.match(linea)
        if not c:
            continue
        k, v = c.group(1).strip().lower(), c.group(2).strip()
        if k in ("para el cliente", "for the customer"):
            actual["cliente"] = v
        elif k in ("priority", "prioridad"):
            actual["prioridad"] = v
        elif k in ("needs", "necesidades"):
            actual["necesidades"] = re.findall(r"\bN-\d+\b", v)
        elif k in ("status", "estado") and re.search(r"deprecat|obsolet", v, re.I):
            actual["obsoleto"] = True
    return [r for r in res if not r["obsoleto"]]


def peticion(repo: Path) -> str:
    """Lo que pidió la persona, con sus palabras: la primera petición literal de intent/ o, si no hay, sus citas."""
    for f in sorted((repo / "intent").glob("INT-*.md")):
        citado = [l[1:].strip() for l in _leer(f).splitlines() if l.startswith(">")]
        if any(citado):
            return " ".join(l for l in citado if l)
    citas = re.findall(r'\*\*Quote:\*\*\s*"?(.*?)"?\s*$', _leer(repo / "requirements" / "CUSTOMER-NEEDS.md"), re.M)
    return " · ".join(citas)


def _texto_req(r: dict) -> str:
    return r["cliente"] or r["titulo"] or r["id"]


def _es_extra(r: dict) -> bool:
    """¿Lo añadió el método? Lo que no es imprescindible (Should/Could) o no sale de ninguna necesidad del cliente."""
    p = r["prioridad"].lower()
    return (not r["necesidades"]) or p.startswith(("should", "could", "nice", "debería", "deseable", "opcional"))


# ── puertas ──────────────────────────────────────────────────────────────────────────────────────────────────────
def puerta_requisitos(repo: Path, proyecto: str, version: str = "", cambio: dict | None = None, adopcion: bool = False) -> dict:
    reqs = requisitos(repo)
    condiciones = [r for r in reqs if r["tipo"] == "C"]
    resto = [r for r in reqs if r["tipo"] != "C"]
    pedidos = [r for r in resto if not _es_extra(r)]
    extras = [r for r in resto if _es_extra(r)]
    v = f" (versión {version})" if version else ""
    partes = []
    if adopcion:
        titulo = "Requisitos deducidos del código"
        partes.append(f"🔍 He leído el código de «{proyecto}» y esto es lo que hace hoy{v}. "
                      "Corrige lo que no sea como lo quieres: lo que apruebes será el punto de partida.")
    elif cambio:
        titulo = f"Requisitos (cambio {cambio['id']})"
        partes.append(f"✏️ Cambio que pediste para «{proyecto}»:\n«{_corta(cambio['peticion'], 400)}»")
        nuevos = [r for r in reqs if r["id"] in cambio.get("anadidos", [])]
        quitados = cambio.get("quitados", [])
        if nuevos or quitados:
            partes.append("Qué cambia" + v + ":\n" + "\n".join(
                [f"➕ {_texto_req(r)}" for r in nuevos] + [f"➖ Se quita: {q}" for q in quitados]))
        else:
            partes.append(f"Qué cambia{v}: los mismos requisitos, con criterios ajustados (el detalle está en changes/).")
        partes.append("Si lo apruebas, solo se replanifica lo nuevo: las fases ya aceptadas no se tocan.")
        return {"titulo": titulo, "texto": "\n\n".join(partes) + _cierre_requisitos(extras)}
    else:
        titulo = "Requisitos"
        pet = peticion(repo)
        partes.append(f"📝 Esto es lo que vamos a construir para «{proyecto}»{v}.")
        if pet:
            partes.append(f"🗣 Lo que pediste:\n«{_corta(pet, 500)}»")
    if pedidos:
        partes.append(("📌 Lo que hace hoy" if adopcion else "✅ Sale de lo que pediste") + f" ({len(pedidos)}):\n"
                      + "\n".join(f"• {_texto_req(r)}" for r in pedidos))
    if extras:
        partes.append(f"➕ Lo añade el método, no lo pediste ({len(extras)}):\n"
                      + "\n".join(f"• {_texto_req(r)}" for r in extras))
    if condiciones:
        partes.append(f"🔧 Condiciones del proyecto ({len(condiciones)}):\n"
                      + "\n".join(f"• {_texto_req(r)}" for r in condiciones))
    return {"titulo": titulo, "texto": "\n\n".join(partes) + _cierre_requisitos(extras)}


def _cierre_requisitos(extras: list) -> str:
    quitar = " Si algo de lo añadido te sobra, dilo ahí y se quita." if extras else ""
    return ("\n\n👉 Si es esto, pulsa ✅ Apruebo. Si falta o sobra algo, pulsa ✏️ y explícalo con tus palabras." + quitar
            + "\nAl aprobar, esta versión queda guardada como punto de partida.")


def puerta_ruta(repo: Path, proyecto: str) -> dict:
    ruta = json.loads(_leer(repo / ".sdd" / "hermes" / "ruta.json") or "{}")
    etapas = ruta.get("stages") or {}
    se_hace = [ETAPAS.get(k, k) for k, e in etapas.items() if e.get("run")]
    se_salta = [ETAPAS.get(k, k) for k, e in etapas.items() if not e.get("run")]
    dudas = [k for k, f in (ruta.get("factors") or {}).items() if f.get("value") == "doubt"]
    soportadas = {"requirements-engineer", "plan-architect", "task-generator", "task-implementer", "acceptance"}
    sin_soporte = [ETAPAS.get(k, k) for k, e in etapas.items() if e.get("run") and k not in soportadas]
    partes = [f"🧭 Cómo propongo hacer «{proyecto}»:", "Pasos: " + " → ".join(se_hace) + "."]
    if se_salta:
        partes.append("Me salto (para un proyecto así no hacen falta): " + ", ".join(se_salta) + ".")
    if dudas:
        partes.append("❓ No tengo claro " + "; ni ".join(DUDAS.get(d, d) for d in dudas)
                      + ". Por prudencia lo cuento como que sí.")
    if sin_soporte:
        partes.append("⚠️ Esto aún no lo hago aquí: " + ", ".join(sin_soporte)
                      + ". El plan saldrá directamente de los requisitos que aprobaste.")
    partes.append("👉 ✅ Aprobar ruta para seguir así · ❌ Rechazar si algo no te cuadra (y cuéntame qué).")
    return {"titulo": "Ruta del proyecto", "texto": "\n\n".join(partes)}


def puerta_plan(repo: Path, proyecto: str) -> dict:
    lineas = []
    for f in sorted((repo / "plan" / "fases").glob("FASE-*.md"), key=lambda p: int(re.findall(r"\d+", p.name)[0])):
        n = re.findall(r"\d+", f.name)[0]
        cab = next((l.lstrip("# ").strip() for l in _leer(f).splitlines() if l.startswith("# ")), f.stem)
        cab = re.sub(r"^FASE[\s-]*\d+\s*[:·—-]\s*", "", cab)
        tareas = len(re.findall(r"^- \[[ x!]\] TASK-", _leer(repo / "task" / f"TASK-FASE-{n}.md"), re.M))
        lineas.append(f"• FASE-{int(n)}: {cab}" + (f" ({_plural(tareas, 'tarea', 'tareas')})" if tareas else ""))
    total = len(lineas)
    partes = [f"🗺 Plan de «{proyecto}»: {_plural(total, 'fase', 'fases')}, en este orden:", "\n".join(lineas) or "(sin fases)",
              "Cada fase se programa, se prueba y te llega con una demo para que la aceptes antes de pasar a la siguiente.",
              "👉 Si el orden te parece bien, pulsa ✅ Conforme. Nada se programa hasta entonces."]
    return {"titulo": "Plan por fases", "texto": "\n\n".join(partes)}


def _filas_gate(md: str) -> list[dict]:
    filas = []
    for l in md.splitlines():
        c = [x.strip() for x in l.strip().strip("|").split("|")]
        if len(c) < 5 or not c[0].startswith("REQ-"):
            continue
        rid, _, tit = c[0].partition(" ")
        filas.append({"id": rid, "titulo": tit, "prioridad": c[1], "veredicto": c[3].upper(), "criterios": c[4]})
    return filas


def _lineas_veredictos(repo: Path, filas: list[dict]) -> list[str]:
    plano = {r["id"]: _texto_req(r) for r in requisitos(repo)}
    out = []
    for f in filas:
        ico, txt = VEREDICTOS.get(f["veredicto"], ("•", f["veredicto"].lower()))
        crit = ""
        m = re.match(r"(\d+)\s*/\s*(\d+)", f["criterios"])
        if m:
            crit = f" ({m.group(1)} de {m.group(2)} {'criterio' if m.group(2) == '1' else 'criterios'})"
        out.append(f"{ico} {f['titulo'] or plano.get(f['id'], f['id'])}: {txt}{crit}")
    return out


def puerta_fase(repo: Path, proyecto: str, fase: str, gate_md: str, rc: int, tests_editados: int,
                video: bool, capturas: int) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = ("✅ Todo en orden: el requisito de esta fase funciona y está comprobado." if len(filas) == 1 else
                  f"✅ Todo en orden: {ok} de {len(filas)} requisitos de esta fase funcionan y están comprobados.")
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    else:
        cabeza = ("⛔ No pasa la comprobación: hay requisitos que fallan o sin comprobar. "
                  "Solo puedes rechazarla para que se corrija.")
    partes = [f"🧪 La FASE-{fase} de «{proyecto}» está lista para revisar.", cabeza]
    if filas:
        partes.append("\n".join(_lineas_veredictos(repo, filas)))
    partes.append("🛡 No se ha tocado ningún test que ya existía." if not tests_editados else
                  f"⚠️ {'Se ha cambiado 1 test que ya existía' if tests_editados == 1 else f'Se han cambiado {tests_editados} tests que ya existían'}: "
                  "conviene saber por qué antes de aceptar.")
    demo = [x for x in ((f"vídeo" if video else ""), (_plural(capturas, "captura", "capturas") if capturas else "")) if x]
    partes.append(f"🎬 Demo: {' y '.join(demo)}." if demo else "🎬 Esta fase no trae demo (ni vídeo ni capturas).")
    partes.append("👉 Pulsa ▶ Ver demo; después podrás aceptarla, aceptarla con observaciones o rechazarla.")
    return {"titulo": f"Aceptar FASE-{fase}", "texto": "\n\n".join(partes)}


def puerta_entrega(repo: Path, proyecto: str, gate_md: str, rc: int, fases_aceptadas: list[str]) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = "✅ Todo en orden: el requisito está comprobado." if ok == 1 else f"✅ Todo en orden: los {ok} requisitos están comprobados."
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    else:
        cabeza = "⛔ No pasa la comprobación final: solo puedes rechazarla para que se corrija."
    partes = [f"🎁 «{proyecto}» está terminado y listo para entregar.", cabeza]
    if filas:
        partes.append("\n".join(_lineas_veredictos(repo, filas)))
    if fases_aceptadas:
        partes.append(f"Fases aceptadas: {len(fases_aceptadas)}.")
    partes.append("👉 Si lo das por bueno, pulsa ✅ Acepto la entrega.")
    return {"titulo": "Entrega final", "texto": "\n\n".join(partes)}


def puerta_mantenimiento(proyecto: str, hallazgos: list) -> dict:
    lineas = []
    for h in hallazgos:
        lineas.append(f"• {h.get('titulo', '')}" + (f"\n   {_corta(h['detalle'], 300)}" if h.get("detalle") else ""))
    partes = [f"🔧 La revisión periódica de «{proyecto}» ha encontrado:", "\n".join(lineas),
              "👉 🛠 Lanzar cambio para arreglarlo (pasará por tus puertas como cualquier cambio) · "
              "🔕 Ignorar, explicando por qué (no se volverá a preguntar mientras no cambie)."]
    return {"titulo": "Mantenimiento", "texto": "\n\n".join(partes)}


def preguntas(ficheros: list[Path]) -> str:
    """Las preguntas abiertas, numeradas como los botones Q1, Q2…, con la recomendada marcada."""
    bloques = []
    for f in sorted(ficheros):
        for b in re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", _leer(f), flags=re.M | re.S):
            q = re.search(r"^Question:\s*(.*)$", b, re.M)
            ops = re.findall(r"^\s+([A-Z])\)\s*(.*)$", b, re.M)
            if not q:
                continue
            n = len(bloques) + 1
            lineas = [f"{n}. {q.group(1).strip()}"]
            for letra, txt in ops:
                rec = "(recommended)" in txt
                txt = txt.replace("(recommended)", "").strip()
                lineas.append(f"   {letra}) {txt}{'  ⭐ recomendada' if rec else ''}")
            bloques.append("\n".join(lineas))
    if not bloques:
        return ""
    return ("\n\n❓ Antes, " + ("una pregunta" if len(bloques) == 1 else f"{len(bloques)} preguntas")
            + " (la recomendada ya está marcada en los botones Q; si te vale, no toques nada):\n\n" + "\n\n".join(bloques))


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["puerta"]); ap.add_argument("tipo"); ap.add_argument("repo")
    ap.add_argument("--proyecto", default=""); ap.add_argument("--fase", default="")
    ap.add_argument("--gate-md", default=""); ap.add_argument("--rc", type=int, default=0)
    ap.add_argument("--tests-editados", type=int, default=0); ap.add_argument("--video", type=int, default=0)
    ap.add_argument("--capturas", type=int, default=0); ap.add_argument("--version", default="")
    ap.add_argument("--cambio", default=""); ap.add_argument("--anadidos", default=""); ap.add_argument("--quitados", default="")
    ap.add_argument("--adopcion", type=int, default=0); ap.add_argument("--fases-aceptadas", default="")
    ap.add_argument("--hallazgos", default="")
    a = ap.parse_args()
    repo = Path(a.repo)
    proyecto = a.proyecto or repo.name
    md = _leer(Path(a.gate_md)) if a.gate_md else ""
    if a.tipo == "requisitos":
        cambio = None
        if a.cambio:
            pet = " ".join(l[1:].strip() for l in _leer(repo / "intent" / f"{a.cambio}.md").splitlines() if l.startswith(">"))
            cambio = {"id": a.cambio, "peticion": pet, "anadidos": a.anadidos.split(), "quitados": [q for q in a.quitados.split("|") if q]}
        r = puerta_requisitos(repo, proyecto, a.version, cambio, bool(a.adopcion))
    elif a.tipo == "ruta":
        r = puerta_ruta(repo, proyecto)
    elif a.tipo == "plan":
        r = puerta_plan(repo, proyecto)
    elif a.tipo == "fase":
        r = puerta_fase(repo, proyecto, a.fase, md, a.rc, a.tests_editados, bool(a.video), a.capturas)
    elif a.tipo == "entrega":
        r = puerta_entrega(repo, proyecto, md, a.rc, a.fases_aceptadas.split())
    elif a.tipo == "mantenimiento":
        r = puerta_mantenimiento(proyecto, json.loads(_leer(Path(a.hallazgos)) or "[]"))
    else:
        sys.exit(f"tipo de puerta desconocido: {a.tipo}")
    r["texto"] += preguntas(list(repo.glob(".sdd/questions-*.md")))
    print(json.dumps(r, ensure_ascii=False))
