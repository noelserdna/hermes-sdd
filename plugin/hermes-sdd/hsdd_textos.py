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
# Los motivos con los que el método deja un requisito sin comprobar, dichos para el cliente
MOTIVOS = {
    "no visual evidence": "falta la captura que lo enseña",
    "bound test skipped": "sin comprobar: su prueba se saltó",
    "test does not show the literal": "sin comprobar: la prueba no enseña el texto exacto",
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
                      "necesidades": None, "obsoleto": False, "verificacion": ""}
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
        elif k in ("verification", "verificación", "verificacion"):
            actual["verificacion"] = v.split("—")[0].split(" - ")[0].strip().lower()
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


def _criterios(texto: str) -> dict:
    """{REQ-id: [criterios]} de un REQUIREMENTS.md: las líneas «- GIVEN …» bajo cada ### REQ-…"""
    res, actual = {}, None
    for l in texto.splitlines():
        m = re.match(r"^###\s+(REQ-[A-Z]+-[0-9A-Za-z]+)", l)
        if m:
            actual = res.setdefault(m.group(1), [])
        elif l.startswith("#"):
            actual = None
        elif actual is not None and re.match(r"^\s+[-*]\s+GIVEN\b", l):
            actual.append(re.sub(r"^\s+[-*]\s+", "", l).strip())
    return res


def _ajustes(repo: Path) -> list[str]:
    """Qué criterios cambian respecto a la última versión aprobada (tag requirements-v*), para la puerta de un cambio."""
    import subprocess
    try:
        tags = subprocess.run(["git", "-C", str(repo), "tag", "-l", "requirements-v*", "--sort=-v:refname"],
                              capture_output=True, text=True, timeout=10).stdout.split()
        if not tags:
            return []
        antes = subprocess.run(["git", "-C", str(repo), "show", f"{tags[0]}:requirements/REQUIREMENTS.md"],
                               capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return []
    viejo, nuevo = _criterios(antes), _criterios(_leer(repo / "requirements" / "REQUIREMENTS.md"))
    nombres = {r["id"]: r["titulo"] or _texto_req(r) for r in requisitos(repo)}
    out = []
    for rid, crits in nuevo.items():
        previos = viejo.get(rid)
        if previos is None or previos == crits:
            continue
        for c in previos:
            if c not in crits:
                out.append(f"➖ {nombres.get(rid, rid)}: se quita el criterio «{_corta(c, 180)}»")
        for c in crits:
            if c not in previos:
                out.append(f"➕ {nombres.get(rid, rid)}: nuevo criterio «{_corta(c, 180)}»")
    return out[:8]


# ── puertas ──────────────────────────────────────────────────────────────────────────────────────────────────────
def _partida(texto: str) -> int:
    """Cuántos requisitos traía el documento de partida (cabeceras REQ-…, si no, puntos de lista o apartados)."""
    n = len(re.findall(r"^#+\s*REQ-[A-Z]+-\d+", texto, re.M))
    return n or len(re.findall(r"^\s*(?:[-*]|\d+[.)])\s+\S", texto, re.M)) or len(re.findall(r"^#{2,4}\s+\S", texto, re.M))


def puerta_requisitos(repo: Path, proyecto: str, version: str = "", cambio: dict | None = None, adopcion: bool = False,
                      partida: str = "") -> dict:
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
            aj = _ajustes(repo)
            partes.append(f"Qué cambia{v}: los mismos requisitos, con criterios ajustados" +
                          (":\n" + "\n".join(aj) if aj else " (el detalle está en changes/)."))
        partes.append("Si lo apruebas, solo se replanifica lo nuevo: las fases ya aceptadas no se tocan.")
        return {"titulo": titulo, "texto": "\n\n".join(partes) + _cierre_requisitos(extras)}
    else:
        titulo = "Requisitos"
        pet = peticion(repo)
        partes.append(f"📝 Esto es lo que vamos a construir para «{proyecto}»{v}.")
        if pet:
            partes.append(f"🗣 Lo que pediste:\n«{_corta(pet, 500)}»")
        if partida:   # requisitos casi listos que trajo la persona (preparados con el encargado): depurados, no reescritos
            n = _partida(partida)
            partes.append(f"📄 Partías de tus requisitos{f' ({n})' if n else ''}: los he depurado sin cambiar lo que pedían "
                          f"(formato del método, criterios comprobables, lo dudoso como pregunta). Quedan {len(reqs)}. "
                          "Qué cambió en cada uno: sección «Depuración» al final de requirements/REQUIREMENTS.md.")
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


def puerta_ruta(repo: Path, proyecto: str, opciones: list | None = None) -> dict:
    """La ruta: qué propone el método para este proyecto y qué rutas configuradas se pueden elegir (un botón cada una)."""
    ruta = json.loads(_leer(repo / ".sdd" / "hermes" / "ruta.json") or "{}")
    etapas = ruta.get("stages") or {}
    se_hace = [ETAPAS.get(k, k) for k, e in etapas.items() if e.get("run")]
    dudas = [k for k, f in (ruta.get("factors") or {}).items() if f.get("value") == "doubt"]
    partes = [f"🧭 Cómo hacer «{proyecto}»: elige una ruta.",
              "Siempre se hacen los requisitos, el plan por fases, la programación y la comprobación final con demo. "
              "Lo que cambia entre rutas son los pasos extra (especificaciones, diseño, auditorías…)."]
    if se_hace and not opciones:
        partes.append("Para este proyecto el método propone: " + " → ".join(se_hace) + ".")
    if dudas:
        partes.append("❓ Para la ruta adaptativa no tengo claro " + "; ni ".join(DUDAS.get(d, d) for d in dudas)
                      + ". Por prudencia lo cuento como que sí.")
    if opciones:
        lineas = []
        for o in opciones:
            extra = "pasos extra: " + o["hace"] if o.get("etapas") else "sin pasos extra"
            marca = " (la fijaste al crear el proyecto)" if o.get("fijada") else (" (recomendada)" if o.get("recomendada") else "")
            fases = f"; fases: {o['fases'][0].lower() + o['fases'][1:]}" if o.get("fases") else ""
            lineas.append(f"{o['etiqueta']}{marca}: {o['descripcion']} → {extra}{fases}.")
        partes.append("\n".join(lineas))
        partes.append("👉 Pulsa la ruta que quieras · ❌ Rechazar si ninguna te vale (y cuéntame por qué).")
    else:
        partes.append("👉 ✅ Aprobar ruta para seguir así · ❌ Rechazar si algo no te cuadra (y cuéntame qué).")
    return {"titulo": "Ruta del proyecto", "texto": "\n\n".join(partes)}


def _hecho_antes(repo: Path) -> str:
    """Los pasos extra de la ruta que ya dejaron documentos (el plan sale de ellos), dichos en castellano."""
    hechos = [(repo / "spec" / "use-cases", "especificaciones"), (repo / "audits" / "AUDIT-BASELINE.md", "auditoría de especificaciones"),
              (repo / "test" / "TEST-PLAN.md", "plan de pruebas"), (repo / "audits" / "SECURITY-AUDIT-BASELINE.md", "revisión de seguridad"),
              (repo / "design", "diseño técnico"), (repo / "ux", "diseño visual y de uso")]
    nombres = [n for p, n in hechos if p.exists()]
    return ("📐 Antes del plan se hizo: " + ", ".join(nombres) + ". El plan parte de esos documentos.") if nombres else ""


def _unica_plan(repo: Path, fases: int) -> bool:
    """Plan de una sola FASE que no es «fina»: no tendrá puerta de FASE, se acepta con la entrega (lanzar.sh unica)."""
    g = _leer(repo / ".sdd" / "hermes" / "granularidad-plan").strip()
    return fases == 1 and bool(g) and g != "fina"


def puerta_plan(repo: Path, proyecto: str) -> dict:
    lineas = []
    for f in sorted((repo / "plan" / "fases").glob("FASE-*.md"), key=lambda p: int(re.findall(r"\d+", p.name)[0])):
        n = re.findall(r"\d+", f.name)[0]
        cab = next((l.lstrip("# ").strip() for l in _leer(f).splitlines() if l.startswith("# ")), f.stem)
        cab = re.sub(r"^FASE[\s-]*\d+\s*[:·—-]\s*", "", cab)
        tareas = len(re.findall(r"^- \[[ x!]\] TASK-", _leer(repo / "task" / f"TASK-FASE-{n}.md"), re.M))
        lineas.append(f"• FASE-{int(n)}: {cab}" + (f" ({_plural(tareas, 'tarea', 'tareas')})" if tareas else ""))
    total = len(lineas)
    partes = [(f"🗺 Plan de «{proyecto}»: una sola fase." if total == 1 else f"🗺 Plan de «{proyecto}»: {_plural(total, 'fase', 'fases')}, en este orden:"), "\n".join(lineas) or "(sin fases)",
              *([_hecho_antes(repo)] if _hecho_antes(repo) else []),
              *(["Se programa y se prueba de una vez, y te llega con su demo en la entrega final: ahí la aceptas (no hay una "
                 "puerta aparte para la fase).",
                 "👉 Si te parece bien, pulsa ✅ Conforme. Nada se programa hasta entonces."] if _unica_plan(repo, total) else
                ["Cada fase se programa, se prueba y te llega con una demo para que la aceptes antes de pasar a la siguiente.",
                 "👉 Si el orden te parece bien, pulsa ✅ Conforme. Nada se programa hasta entonces."])]
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
        # «MISSING (no visual evidence)»: el veredicto es la primera palabra; el motivo, entre paréntesis, se traduce
        clave, _, motivo = f["veredicto"].partition(" ")
        ico, txt = VEREDICTOS.get(clave, ("•", clave.lower()))
        motivo = motivo.strip(" ()").lower()
        if motivo:
            txt = MOTIVOS.get(motivo, txt)
        crit = ""
        m = re.match(r"(\d+)\s*/\s*(\d+)", f["criterios"])
        if m:
            crit = f" ({m.group(1)} de {m.group(2)} {'criterio' if m.group(2) == '1' else 'criterios'})"
        out.append(f"{ico} {f['titulo'] or plano.get(f['id'], f['id'])}: {txt}{crit}")
    return out


def _cabeza_ok(filas: list[dict], de_fase: bool) -> str:
    """Puerta de calidad cumplida (rc 0): todo lo imprescindible está comprobado. Si queda algo no imprescindible sin
    comprobar se dice, para no anunciar «todo en orden» con requisitos en ⚠️ (coches, entrega 1)."""
    ok, total = sum(1 for f in filas if f["veredicto"] == "VERIFIED"), len(filas)
    donde = " de esta fase" if de_fase else ""
    if ok == total:
        if total == 1:
            return f"✅ Todo en orden: el requisito{donde} funciona y está comprobado."
        return f"✅ Todo en orden: los {total} requisitos{donde} funcionan y están comprobados."
    pend = total - ok
    return (f"✅ Lo imprescindible{donde} está comprobado ({ok} de {total} requisitos). "
            f"{'Queda 1 requisito' if pend == 1 else f'Quedan {pend} requisitos'} sin comprobar que no "
            f"{'es imprescindible' if pend == 1 else 'son imprescindibles'} (⚠️ en la lista).")


def revisar(repo: Path, gate: dict) -> dict:
    """Lo que solo una persona puede comprobar: requisitos sin verificar cuya verificación es una inspección o una demo.
    → {"revisar": [{id, titulo, cliente, como}], "solo": bool}. «solo»: es lo único que impide pasar la comprobación (todo
    Must sin verificar es de inspección y no hay otras alertas); entonces la puerta ofrece 🔍 Lo he revisado y acepto
    (vasos, 11/11/2026: «Interfaz en español» por inspección y la entrega solo dejaba rechazar)."""
    plano = {r["id"]: r for r in requisitos(repo)}
    pend = [r for r in gate.get("requirements", []) if r.get("verdict") not in ("VERIFIED", "WAIVED", "DEPRECATED")]
    como = lambda r: next((c for c in ("inspection", "demo") if plano.get(r["id"], {}).get("verificacion", "").startswith(c)), "")
    rev = [r for r in pend if como(r)]
    s = gate.get("summary", {})
    alertas = sum(int(s.get(k) or 0) for k in ("unshown", "literal_gaps", "weakened", "must_challenged", "stale_evidence",
                                                "stale_decisions", "challenges_open"))
    musts = [r["id"] for r in pend if r.get("priority") == "Must"]
    ids = {r["id"] for r in rev}
    solo = bool(rev) and not alertas and all(m in ids for m in musts) and not any(r.get("verdict") == "FAILING" for r in pend)
    return {"revisar": [{"id": r["id"], "titulo": plano[r["id"]]["titulo"], "cliente": plano[r["id"]]["cliente"], "como": como(r)}
                        for r in rev],
            "solo": solo}


def _bloque_revisar(rev: dict | None) -> list[str]:
    if not rev or not rev.get("revisar"):
        return []
    lineas = [f"• {r['titulo'] or r['id']}" + (f": {r['cliente']}" if r.get("cliente") else "") for r in rev["revisar"]]
    return ["🔍 Esto no lo puede comprobar un test, lo compruebas tú:\n" + "\n".join(lineas)]


def puerta_fase(repo: Path, proyecto: str, fase: str, gate_md: str, rc: int, tests_editados: int,
                video: bool, capturas: int, rev: dict | None = None) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = _cabeza_ok(filas, True)
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    elif rev and rev.get("solo"):
        cabeza = "🔍 Solo falta tu revisión: lo que queda por comprobar no lo puede comprobar un test."
    else:
        cabeza = ("⛔ No pasa la comprobación: hay requisitos que fallan o sin comprobar. "
                  "Solo puedes rechazarla para que se corrija.")
    partes = [f"🧪 La FASE-{fase} de «{proyecto}» está lista para revisar.", cabeza]
    if filas:
        partes.append("\n".join(_lineas_veredictos(repo, filas)))
    partes += _bloque_revisar(rev)
    partes.append("🛡 No se ha tocado ningún test que ya existía." if not tests_editados else
                  f"⚠️ {'Se ha cambiado 1 test que ya existía' if tests_editados == 1 else f'Se han cambiado {tests_editados} tests que ya existían'}: "
                  "conviene saber por qué antes de aceptar.")
    demo = [x for x in ((f"vídeo" if video else ""), (_plural(capturas, "captura", "capturas") if capturas else "")) if x]
    partes.append(f"🎬 Demo: {' y '.join(demo)}." if demo else "🎬 Esta fase no trae demo (ni vídeo ni capturas).")
    partes.append(_que_pulsar(rc, rev, "aceptarla", "aceptarla con observaciones", "rechazarla", demo=True))
    return {"titulo": f"Aceptar FASE-{fase}", "texto": "\n\n".join(partes)}


def _que_pulsar(rc: int, rev: dict | None, aceptar: str, obs: str, rechazar: str, demo: bool) -> str:
    """La última línea: qué botones hay de verdad (nunca ofrecer aceptar en una puerta que solo deja rechazar).
    aceptar/obs/rechazar en infinitivo («aceptarla», «aceptar la entrega»…)."""
    antes = "Pulsa ▶ Ver demo; después " if demo else ""
    hay_rev = bool(rev and rev.get("revisar"))
    revisado = "si has comprobado lo de 🔍, pulsa 🔍 Lo he revisado y acepto (queda registrado a tu nombre)"
    if rc in (0, 3):
        extra = f" Si has comprobado lo de 🔍, mejor 🔍 Lo he revisado y acepto (queda registrado a tu nombre)." if hay_rev else ""
        return f"👉 {antes or 'Puedes '}{'podrás ' if demo else ''}{aceptar}, {obs} o {rechazar}.{extra}"
    if hay_rev and rev.get("solo"):
        return f"👉 {antes}{revisado if demo else revisado[0].upper() + revisado[1:]}; si algo no está bien, ❌ Rechazar y di qué."
    # Bloqueada: rechazar (se corrige) o, si lo que falta puede esperar, eximirlo con un motivo (queda como pendiente)
    eximir = ("🟡 Aceptar sin lo que falta si puede esperar (di por qué; queda apuntado como pendiente con su número "
              "de seguimiento)")
    if demo:
        return f"👉 {antes}❌ Rechazar y di qué hay que corregir, o {eximir}."
    return f"👉 Pulsa ❌ Rechazar y di qué hay que corregir, o {eximir}."


def puerta_entrega(repo: Path, proyecto: str, gate_md: str, rc: int, fases_aceptadas: list[str], unica: bool = False,
                   video: bool = False, capturas: int = 0, tests_editados: int = 0, rev: dict | None = None) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = _cabeza_ok(filas, False)
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    elif rev and rev.get("solo"):
        cabeza = "🔍 Solo falta tu revisión: lo que queda por comprobar no lo puede comprobar un test."
    else:
        cabeza = "⛔ No pasa la comprobación final: solo puedes rechazarla para que se corrija."
    partes = [f"🎁 «{proyecto}» está terminado y listo para entregar.", cabeza]
    if filas:
        partes.append("\n".join(_lineas_veredictos(repo, filas)))
    partes += _bloque_revisar(rev)
    if unica:   # plan compacto: una sola fase, sin puerta propia; se acepta aquí con su demo
        partes.append("🧩 Se hizo en una sola fase: al aceptar la entrega aceptas también esa fase.")
        partes.append("🛡 No se ha tocado ningún test que ya existía." if not tests_editados else
                      f"⚠️ {'Se ha cambiado 1 test que ya existía' if tests_editados == 1 else f'Se han cambiado {tests_editados} tests que ya existían'}: "
                      "conviene saber por qué antes de aceptar.")
        demo = [x for x in (("vídeo" if video else ""), (_plural(capturas, "captura", "capturas") if capturas else "")) if x]
        partes.append(f"🎬 Demo: {' y '.join(demo)}." if demo else "🎬 No hay demo (ni vídeo ni capturas).")
        partes.append(_que_pulsar(rc, rev, "aceptar la entrega", "aceptarla con observaciones", "rechazarla", demo=True))
    else:
        if fases_aceptadas:
            partes.append(f"Fases aceptadas: {len(fases_aceptadas)}.")
        partes.append(_que_pulsar(rc, rev, "aceptar la entrega (✅)", "aceptarla con observaciones", "rechazarla", demo=False))
    return {"titulo": "Entrega final", "texto": "\n\n".join(partes)}


def puerta_mantenimiento(proyecto: str, hallazgos: list) -> dict:
    lineas = []
    for h in hallazgos:
        lineas.append(f"• {h.get('titulo', '')}" + (f"\n   {_corta(h['detalle'], 300)}" if h.get("detalle") else ""))
    partes = [f"🔧 La revisión periódica de «{proyecto}» ha encontrado:", "\n".join(lineas),
              "👉 🛠 Lanzar cambio para arreglarlo (pasará por tus puertas como cualquier cambio) · "
              "🔕 Ignorar, explicando por qué (no se volverá a preguntar mientras no cambie)."]
    return {"titulo": "Mantenimiento", "texto": "\n\n".join(partes)}


# Las skills escriben las opciones de varias formas; todas valen:
#   «  A) texto (recommended)»   «  A★) texto»   «Options: [A] texto (recomendada)  [B] texto»
_OP_LINEA = re.compile(r"^\s+([A-Z])\s*([★⭐\ufe0f]*)\s*\)\s*(.*)$", re.M)
_OP_CORCHETE = re.compile(r"\[([A-Z])\]\s*(.*?)(?=\s+\[[A-Z]\]|$)")
_RECOMENDADA = re.compile(r"\s*\((?:recommended|recomendada)\)", re.I)


def opciones(bloque: str) -> list[tuple[str, str, bool]]:
    """[(letra, texto, recomendada)] de una pregunta ## Q-… del método."""
    ops = [(l, txt, bool(est) or bool(_RECOMENDADA.search(txt))) for l, est, txt in _OP_LINEA.findall(bloque)]
    if not ops:
        m = re.search(r"^Options:\s*(.*)$", bloque, re.M)
        if m:
            ops = [(l, txt, bool(_RECOMENDADA.search(txt))) for l, txt in _OP_CORCHETE.findall(m.group(1).strip())]
    return [(l, _RECOMENDADA.sub("", txt).strip(), rec) for l, txt, rec in ops]


def opciones_json(bloque: str) -> dict:
    """{opciones: [letras], recomendada: letra} para los botones Q (sin marca, la primera)."""
    ops = opciones(bloque)
    rec = next((l for l, _, r in ops if r), ops[0][0] if ops else "")
    return {"opciones": [l for l, _, _ in ops], "recomendada": rec}


# Una opción que pide cambiar los requisitos: la marca explícita del método «(req-change)» o, en preguntas escritas
# sin ella, un verbo de cambio junto a REQ/requisito/criterio («Añadir cuatro REQ con sdd-req-change», «enmendar el
# criterio…»). Elegirla y aprobar la puerta lanza un cambio (/cambio): nada cambia sin su propia puerta de requisitos.
_MARCA_CAMBIO = re.compile(r"\s*\(req-change\)", re.I)
_PIDE_CAMBIO = re.compile(
    r"sdd-req-change|\b(?:enmendar|añadir|agregar|modificar|cambiar|quitar|eliminar|deprecar|incorporar|amend|add|modify"
    r"|change|remove|deprecate)\b[^.;]{0,50}?\b(?:REQ|requisitos?|criterios?|requirements?|criteri(?:on|a))\b", re.I)
_NEGACION = re.compile(r"\b(?:no|sin|nada|ning[uú]n|nothing|without|not)\b", re.I)


def pide_cambio(texto: str) -> bool:
    if _MARCA_CAMBIO.search(texto):
        return True
    return bool(_PIDE_CAMBIO.search(texto)) and not _NEGACION.search(texto)


def peticion_cambio(bloque: str, letra: str) -> str:
    """Si la opción <letra> de la pregunta pide cambiar los requisitos, la petición para /cambio (si no, "")."""
    txt = next((t for l, t, _ in opciones(bloque) if l == letra.upper()), "")
    if not txt or not pide_cambio(txt):
        return ""
    q = re.search(r"^Question:\s*(.*)$", bloque, re.M)
    qid = bloque.split()[1] if len(bloque.split()) > 1 else "?"
    return (f"{qid}: {q.group(1).strip() if q else ''}\nRespuesta elegida: {letra.upper()}) "
            f"{_MARCA_CAMBIO.sub('', txt).strip()}")


def preguntas(ficheros: list[Path]) -> str:
    """Las preguntas abiertas, numeradas como los botones Q1, Q2…, con la recomendada marcada."""
    bloques = []
    for f in sorted(ficheros):
        for b in re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", _leer(f), flags=re.M | re.S):
            q = re.search(r"^Question:\s*(.*)$", b, re.M)
            if not q:
                continue
            n = len(bloques) + 1
            lineas = [f"{n}. {q.group(1).strip()}"]
            for letra, txt, rec in opciones(b):
                aviso = "  (📝 abre un cambio de requisitos)" if pide_cambio(txt) else ""
                lineas.append(f"   {letra}) {_MARCA_CAMBIO.sub('', txt).strip()}{'  ⭐ recomendada' if rec else ''}{aviso}")
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
    ap.add_argument("--partida", default="", help="requisitos de partida (fichero), si la persona los trajo casi listos")
    ap.add_argument("--adopcion", type=int, default=0); ap.add_argument("--fases-aceptadas", default="")
    ap.add_argument("--hallazgos", default=""); ap.add_argument("--opciones-ruta", default="")
    ap.add_argument("--unica", type=int, default=0); ap.add_argument("--revisar", default="")
    if sys.argv[1:2] == ["revisar"]:   # revisar <repo>  (gate --json por stdin) → {"revisar": [...], "solo": bool}
        print(json.dumps(revisar(Path(sys.argv[2]), json.loads(sys.stdin.read() or "{}")), ensure_ascii=False)); sys.exit(0)
    a = ap.parse_args()
    rev = json.loads(_leer(Path(a.revisar)) or "null") if a.revisar else None
    repo = Path(a.repo)
    proyecto = a.proyecto or repo.name
    md = _leer(Path(a.gate_md)) if a.gate_md else ""
    if a.tipo == "requisitos":
        cambio = None
        if a.cambio:
            pet = " ".join(l[1:].strip() for l in _leer(repo / "intent" / f"{a.cambio}.md").splitlines() if l.startswith(">"))
            cambio = {"id": a.cambio, "peticion": pet, "anadidos": a.anadidos.split(), "quitados": [q for q in a.quitados.split("|") if q]}
        r = puerta_requisitos(repo, proyecto, a.version, cambio, bool(a.adopcion), _leer(Path(a.partida)) if a.partida else "")
    elif a.tipo == "ruta":
        r = puerta_ruta(repo, proyecto, json.loads(_leer(Path(a.opciones_ruta)) or "[]") if a.opciones_ruta else None)
    elif a.tipo == "plan":
        r = puerta_plan(repo, proyecto)
    elif a.tipo == "fase":
        r = puerta_fase(repo, proyecto, a.fase, md, a.rc, a.tests_editados, bool(a.video), a.capturas, rev)
    elif a.tipo == "entrega":
        r = puerta_entrega(repo, proyecto, md, a.rc, a.fases_aceptadas.split(), bool(a.unica), bool(a.video), a.capturas,
                           a.tests_editados, rev)
    elif a.tipo == "mantenimiento":
        r = puerta_mantenimiento(proyecto, json.loads(_leer(Path(a.hallazgos)) or "[]"))
    else:
        sys.exit(f"tipo de puerta desconocido: {a.tipo}")
    r["texto"] += preguntas(list(repo.glob(".sdd/questions-*.md")))
    print(json.dumps(r, ensure_ascii=False))
