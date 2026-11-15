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
    "task-implementer": "programación", "acceptance": "comprobación final con demo", "gap-detector": "repaso de que el código hace todo lo especificado",
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


_NOMBRE_CAMPO = {"verification": "cómo se comprueba", "priority": "la prioridad", "para el cliente": "la frase para el cliente",
                 "needs": "las necesidades de las que sale", "status": "el estado", "rationale": "el porqué"}


def _campos(texto: str) -> dict:
    """{REQ-id: {campo: valor}} de un REQUIREMENTS.md: las líneas «- **Campo:** valor» bajo cada ### REQ-…"""
    res, actual = {}, None
    for l in texto.splitlines():
        m = re.match(r"^###\s+(REQ-[A-Z]+-[0-9A-Za-z]+)", l)
        if m:
            actual = res.setdefault(m.group(1), {})
        elif l.startswith("#"):
            actual = None
        elif actual is not None and (c := re.match(r"^\s*[-*]\s+\*\*([^*:]+):\*\*\s*(.*)$", l)):
            actual[c.group(1).strip()] = c.group(2).strip()
    return res


def _aprobado(repo: Path) -> str | None:
    """REQUIREMENTS.md de la última versión aprobada (tag requirements-v*), o None si no hay ninguna."""
    import subprocess
    try:
        tags = subprocess.run(["git", "-C", str(repo), "tag", "-l", "requirements-v*", "--sort=-v:refname"],
                              capture_output=True, text=True, timeout=10).stdout.split()
        if not tags:
            return None
        return subprocess.run(["git", "-C", str(repo), "show", f"{tags[0]}:requirements/REQUIREMENTS.md"],
                              capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return None


def _criterio_llano(c: str) -> str:
    """Un criterio GIVEN/WHEN/THEN dicho en castellano: «situación; cuando …→ se ve …» (taller, INT-002: la puerta
    enseñaba «THEN the user sees» a la clienta)."""
    c = re.sub(r"^\s*GIVEN\s+", "", c)
    c = re.sub(r"\s+WHEN\s+", "; cuando ", c)
    c = re.sub(r"\s+THEN\s+the user sees\s+", " → se ve ", c)
    c = re.sub(r"\s+THEN\s+", " → ", c)
    return re.sub(r"\s+AND\s+", " y ", c)


# ── «Esto dirá la web»: los textos exactos de las líneas «Se ve:» de los criterios REQ-F ────────────────────────────
_SE_VE = re.compile(r"^\s+[-*]\s+Se ve\s*:\s*(.*)$")
_COMILLAS = re.compile(r'"([^"]+)"')


def _ejemplo(plantilla: str, criterio: str) -> str:
    """Un texto citado en el propio criterio que encaja con la plantilla («Tienes plaza en el taller, {nombre}» →
    «Tienes plaza en el taller, Lucía»), o ""."""
    if "{" not in plantilla:
        return ""
    trozos = re.split(r"\{[^{}]*\}", plantilla)
    patron = "(.+?)".join(re.escape(t) for t in trozos)
    return next((q for q in _COMILLAS.findall(criterio) if re.fullmatch(patron, q)), "")


def _sin_parentesis(linea: str) -> str:
    """La línea «Se ve:» sin sus aclaraciones entre paréntesis fuera de comillas: lo que va dentro explica, no se ve
    (taller: «… en la vista de la organizadora (la pantalla no muestra…; "Marta" se apunta…)» daba una pantalla rota y
    «Marta» como texto de la web). Los paréntesis dentro de un texto citado («… ({plazas})») se conservan."""
    out, dentro, nivel = [], False, 0
    for c in linea:
        if c == '"' and nivel == 0:
            dentro = not dentro
        elif not dentro and c == "(":
            nivel += 1
            continue
        elif not dentro and c == ")" and nivel:
            nivel -= 1
            continue
        if nivel == 0:
            out.append(c)
    return re.sub(r"\s+", " ", "".join(out)).strip()


def textos_web(texto: str) -> list[dict]:
    """[{pantalla, texto, ejemplo}] de las líneas «Se ve:» de los criterios REQ-F, en orden y sin repetir
    (`- Se ve: "a", "b" en <pantalla>; "c" en <otra>`)."""
    out, vistos, tipo, criterio = [], set(), None, ""
    for l in texto.replace("“", '"').replace("”", '"').splitlines():
        m = re.match(r"^###\s+REQ-([A-Z]+)-", l)
        if m:
            tipo, criterio = m.group(1), ""
            continue
        if l.startswith("#"):
            tipo = None
        if tipo != "F":
            continue
        if re.match(r"^\s+[-*]\s+GIVEN\b", l):
            criterio = l
            continue
        s = _SE_VE.match(l)
        if not s:
            continue
        for trozo in _sin_parentesis(s.group(1)).split(";"):
            citas = _COMILLAS.findall(trozo)
            if not citas:
                continue
            donde = re.match(r"\s*,?\s*(?:en|in|on)\s+(.*\S)", trozo[trozo.rfind('"') + 1:])
            pantalla = donde.group(1).rstrip(".") if donde else ""
            for t in citas:
                if (pantalla.lower(), t) not in vistos:
                    vistos.add((pantalla.lower(), t))
                    out.append({"pantalla": pantalla, "texto": t, "ejemplo": _ejemplo(t, criterio)})
    # una pantalla dicha como ruta («/organizadora») que solo repite textos ya vistos en una pantalla con nombre sobra
    con_nombre = {x["texto"] for x in out if not x["pantalla"].startswith("/")}
    return [x for x in out if not (x["pantalla"].startswith("/") and x["texto"] in con_nombre)]


def _bloque_web(repo: Path, cambio: bool, maximo: int = 12) -> str:
    """«💬 Esto dirá la web», agrupado por pantalla; en un cambio, solo los textos nuevos o cambiados."""
    textos = textos_web(_leer(repo / "requirements" / "REQUIREMENTS.md"))
    if cambio:
        antes = _aprobado(repo)
        if antes is None:
            return ""
        viejos = {(x["pantalla"].lower(), x["texto"]) for x in textos_web(antes)}
        textos = [x for x in textos if (x["pantalla"].lower(), x["texto"]) not in viejos]
    # el mismo texto en otra pantalla no se repite: se dice «también en …» junto a la primera
    unicos: dict = {}
    for x in textos:
        if x["texto"] in unicos:
            if x["pantalla"] and x["pantalla"] not in unicos[x["texto"]]["tambien"]:
                unicos[x["texto"]]["tambien"].append(x["pantalla"])
        else:
            unicos[x["texto"]] = {**x, "tambien": []}
    textos = list(unicos.values())
    if not textos:
        return ""
    grupos: dict = {}
    for x in textos[:maximo]:
        grupos.setdefault(x["pantalla"], []).append(x)
    llaves = "; lo que va entre llaves cambia en cada caso" if any("{" in x["texto"] for x in textos[:maximo]) else ""
    lineas = ["💬 " + ("Textos nuevos o cambiados en la web" if cambio else "Esto dirá la web")
              + f" (lo que leerá la gente, tal cual{llaves}):"]
    for pantalla, xs in grupos.items():
        lineas.append(f"En {pantalla}:" if pantalla else "En pantalla:")
        lineas += [f"• «{x['texto']}»" + (f" (p. ej. «{x['ejemplo']}»)" if x["ejemplo"] else "")
                   + (f"; también en {' y en '.join(x['tambien'])}" if x["tambien"] else "") for x in xs]
    if len(textos) > maximo:
        lineas.append(f"… y {len(textos) - maximo} más (en requirements/REQUIREMENTS.md, líneas «Se ve:»)")
    return "\n".join(lineas)


def _ajustes(repo: Path) -> list[str]:
    """Qué criterios cambian respecto a la última versión aprobada (tag requirements-v*), para la puerta de un cambio."""
    antes = _aprobado(repo)
    if antes is None:
        return []
    ahora = _leer(repo / "requirements" / "REQUIREMENTS.md")
    viejo, nuevo = _criterios(antes), _criterios(ahora)
    # «Stack del proyecto» (título habitual de la condición de herramientas) dicho sin jerga
    nombres = {r["id"]: re.sub(r"^Stack\b", "Herramientas", r["titulo"]) or _texto_req(r) for r in requisitos(repo)}
    out = []
    # Otras líneas del requisito que cambian (cómo se verifica, prioridad, la frase para el cliente…): sala, INT-005,
    # solo cambiaba la verificación de REQ-C-001 y la puerta decía «el detalle está en changes/»
    cv, cn = _campos(antes), _campos(ahora)
    for rid, campos in cn.items():
        # El enunciado es interno, pero si cambia y la frase para el cliente no, la persona no vería el cambio de lo que
        # se exige (club, INT-004: REQ-F-012 pasó a «4 plazas fijas» y la puerta solo enseñaba los ejemplos)
        a, b = (cv.get(rid) or {}), campos
        if a.get("Statement") and b.get("Statement") and a["Statement"] != b["Statement"] \
                and a.get("Para el cliente") == b.get("Para el cliente"):
            out.append(f"✏️ {nombres.get(rid, rid)}: cambia lo que exige el requisito; ahora dice «{_corta(b['Statement'], 240)}»")
        cliente_cambia = a.get("Para el cliente") != b.get("Para el cliente")
        for k, v in campos.items():
            # solo lo que la persona lee: el resto (Statement en inglés, Source, Dependencies…) es interno del método
            if k.lower() not in ("para el cliente", "verification", "priority"):
                continue
            if rid in cv and k in cv[rid] and cv[rid][k] != v:
                if k.lower() == "para el cliente":   # la frase nueva, entera (taller, INT-002: «…no se d…»)
                    out.append(f"✏️ {nombres.get(rid, rid)}: ahora dice «{_corta(v, 320)}»")
                    continue
                # cómo se comprueba es técnico («package.json declara vite…»): solo si es lo único que cambia
                if k.lower() == "verification" and cliente_cambia:
                    continue
                k = _NOMBRE_CAMPO.get(k.lower(), k)
                v = _corta(re.sub(r"^(test|demo|inspection|analysis)\s+—\s+", "", v), 180)
                out.append(f"✏️ {nombres.get(rid, rid)}: {k} pasa a «{v}»")
    for rid, crits in nuevo.items():
        previos = viejo.get(rid)
        if previos is None or previos == crits:
            continue
        quitados = [c for c in previos if c not in crits]
        puestos = [c for c in crits if c not in previos]
        # un criterio que cambia unas palabras no es «se quita» + «nuevo» casi iguales (club, INT-004): se empareja con
        # el más parecido y se dice qué palabras cambian
        for c in list(quitados):
            par = max(puestos, key=lambda x: _parecido(c, x), default=None)
            if par is not None and _parecido(c, par) >= 0.6:
                # Un solo retoque se dice por palabras («x» pasa a «y»); varios, con la frase entera antes y después
                # (taller, INT-003: «se añade «de 2 plazas,»; «1» pasa a «una persona nueva…»; se quita «libre»» no se entendía)
                if _n_cambios(c, par) == 1:
                    out.append(f"✏️ {nombres.get(rid, rid)}: en el criterio «{_corta(_criterio_llano(c), 120)}» {_cambio_palabras(c, par)}")
                else:
                    out.append(f"✏️ {nombres.get(rid, rid)}: un criterio cambia. Antes: «{_corta(_criterio_llano(c), 200)}» "
                               f"→ ahora: «{_corta(_criterio_llano(par), 200)}»")
                quitados.remove(c); puestos.remove(par)
        out += [f"➖ {nombres.get(rid, rid)}: se quita el criterio «{_corta(_criterio_llano(c), 180)}»" for c in quitados]
        out += [f"➕ {nombres.get(rid, rid)}: nuevo criterio «{_corta(_criterio_llano(c), 180)}»" for c in puestos]
    return out[:8] + ([f"… y {len(out) - 8} cambios más (el detalle está en requirements/REQUIREMENTS.md)"] if len(out) > 8 else [])


def _parecido(a: str, b: str) -> float:
    import difflib
    return difflib.SequenceMatcher(None, a.split(), b.split()).ratio()


def _n_cambios(a: str, b: str) -> int:
    import difflib
    return sum(1 for op, *_ in difflib.SequenceMatcher(None, a.split(), b.split()).get_opcodes() if op != "equal")


def _cambio_palabras(a: str, b: str) -> str:
    """««x» pasa a «y»; se añade «z»» con las palabras que cambian de a a b (hasta 3 cambios)."""
    import difflib
    wa, wb = a.split(), b.split()
    cambios = []
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, wa, wb).get_opcodes():
        x, y = " ".join(wa[i1:i2]), " ".join(wb[j1:j2])
        if op == "replace":
            cambios.append(f"«{_corta(x, 80)}» pasa a «{_corta(y, 80)}»")
        elif op == "delete":
            cambios.append(f"se quita «{_corta(x, 80)}»")
        elif op == "insert":
            cambios.append(f"se añade «{_corta(y, 80)}»")
    return "; ".join(cambios[:3]) + (f" (y {len(cambios) - 3} cambios más)" if len(cambios) > 3 else "")


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
        pet = cambio["peticion"]
        # De dónde viene: el mantenimiento, unas respuestas elegidas en otra puerta o la persona (/cambio)
        por_respuestas = _peticion_por_respuestas(repo, proyecto, pet)
        if por_respuestas:
            partes.append(por_respuestas)
        else:
            origen = "Cambio que pide el mantenimiento de" if pet.startswith("Mantenimiento detectado") else "Cambio que pediste para"
            partes.append(f"✏️ {origen} «{proyecto}»:\n«{_corta(pet, 400)}»")
        nuevos = [r for r in reqs if r["id"] in cambio.get("anadidos", [])]
        quitados = cambio.get("quitados", [])
        if nuevos or quitados:
            # también lo que cambia en los que ya estaban (club, INT-002: la regla de los choques clase/torneo era una
            # modificación de dos requisitos y la puerta solo enseñaba los nuevos)
            aj = _ajustes(repo)
            partes.append("Qué cambia" + v + ":\n" + "\n".join(
                [f"➕ {_texto_req(r)}" for r in nuevos] + [f"➖ Se quita: {q}" for q in quitados] + aj))
        else:
            aj = _ajustes(repo)
            partes.append(f"Qué cambia{v}: los mismos requisitos, con ajustes" +
                          (":\n" + "\n".join(aj) if aj else " (el detalle está en changes/)."))
        web = _bloque_web(repo, cambio=True)
        if web:
            partes.append(web)
        if (repo / ".sdd" / "hermes" / "mantenimiento" / "en-curso.txt").exists():
            partes.append("Si lo apruebas, el mantenimiento sigue con esta versión (no se replanifica nada).")
        elif not list((repo / "plan" / "fases").glob("FASE-*.md")):
            # sin plan todavía no hay fases que replanificar ni aceptadas (taller, INT-002: lo prometía antes del plan)
            partes.append("Si lo apruebas, el proyecto sigue con esta versión: el plan por fases, que aún no está hecho, "
                          "saldrá de ella.")
        elif nuevos or quitados:
            partes.append("Si lo apruebas, solo se replanifica lo nuevo: las fases ya aceptadas no se tocan.")
        else:
            partes.append("Si lo apruebas, se ajusta lo afectado: una fase aún sin aceptar se rehace con los criterios "
                          "nuevos; si ya estaba aceptada, se revisa el plan. Las fases aceptadas no se tocan.")
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
    web = _bloque_web(repo, cambio=False)
    if web:
        partes.append(web)
    return {"titulo": titulo, "texto": "\n\n".join(partes) + _cierre_requisitos(extras)}


def _peticion_por_respuestas(repo: Path, proyecto: str, pet: str) -> str:
    """La petición de un cambio que lanzaron unas respuestas (firmar.sh: «En la puerta «X», Ana eligió respuestas que
    piden cambiar los requisitos: Q-…: Question… Respuesta elegida: A) …»), dicha con la frase «Para el cliente» de
    cada pregunta y su opción en castellano (taller, INT-002: la puerta citaba «How is the organiser…» en inglés).
    "" si la petición no viene de unas respuestas."""
    m = re.match(r"\s*En la puerta «(.*?)», (.*?) eligió respuestas que piden cambiar los requisitos:\s*(.*)$", pet, re.S)
    if not m:
        return ""
    puerta, quien, resto = m.groups()
    bloques = bloques_preguntas(list(repo.glob(".sdd/questions-*.md")))
    lineas = []
    for qid, pregunta, letra, opcion in re.findall(
            r"(Q-[\w-]+-\d{3}):\s*(.*?)\s*Respuesta elegida:\s*([A-Z])\)\s*(.*?)(?=\s*(?:Q-[\w-]+-\d{3}:|Para el cliente:|$))",
            resto, re.S):
        b = bloques.get(qid, "")
        cli = para_cliente(b) if b else ""
        op = (efecto(b, letra).get("cliente") or "") if b else ""
        if not cli:   # sin la pregunta en .sdd/, la versión para el cliente que dejó el notario en la petición, si la hay
            d = re.search(re.escape(qid) + r".*?Para el cliente:\s*(.*?)\s*→\s*[A-Z]\)\s*(.*?)(?=\s*(?:Q-[\w-]+-\d{3}:|$))", resto, re.S)
            cli, op = (d.group(1), d.group(2)) if d else (pregunta, op)
        op = op or re.sub(r"\s*\((?:recommended|recomendad[ao])\b[^)]*\)", "", opcion)
        lineas.append(f"• {_corta(cli, 220)} → {letra}) {_corta(op, 200)}")
    if not lineas:
        return ""
    return (f"✏️ Cambio que piden las respuestas que eligió {quien} en la puerta «{puerta}» de «{proyecto}»:\n"
            + "\n".join(lineas))


def _cierre_requisitos(extras: list) -> str:
    quitar = " Si algo de lo añadido te sobra, dilo ahí y se quita." if extras else ""
    return ("\n\n👉 Si es esto, pulsa ✅ Apruebo. Si falta o sobra algo, pulsa ✏️ y explícalo con tus palabras." + quitar
            + "\nAl aprobar, esta versión queda guardada como punto de partida, y confirmas que los ejemplos de cada criterio "
              "(nombres, fechas, horas, textos) son correctos: quedan firmados a tu nombre.")


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
            marca = (" (recomendada: es un cambio sobre lo ya entregado; las especificaciones y diseños ya existen)" if o.get("tras_entrega")
                     else " (la fijaste al crear el proyecto)" if o.get("fijada") else (" (recomendada)" if o.get("recomendada") else ""))
            # «Compacta: una fase y pocas tareas» → «fases: una fase y pocas tareas» (no «fases: compacta: …»)
            f = re.sub(r"^[^:]{1,20}:\s*", "", o.get("fases") or "")
            fases = f"; fases: {f[0].lower() + f[1:]}" if f else ""
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


def _nucleo():
    """hsdd_nucleo, cargado una vez (este módulo se usa también suelto, como CLI del notario y de puerta.sh)."""
    if "hsdd_nucleo" not in sys.modules:
        import importlib.util
        spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).with_name("hsdd_nucleo.py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); sys.modules["hsdd_nucleo"] = mod
    return sys.modules["hsdd_nucleo"]


def _unica_plan(repo: Path, fases: int) -> bool:
    """Plan de una sola FASE que no es «fina»: no tendrá puerta de FASE, se acepta con la entrega. La misma regla que
    usan lanzar.sh y etapa.sh (hsdd_nucleo.unica): lo que se le dice a la persona es lo que luego pasa."""
    return fases == 1 and _nucleo().unica(repo)


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


def _lineas_veredictos(repo: Path, filas: list[dict], rev: dict | None = None) -> list[str]:
    plano = {r["id"]: _texto_req(r) for r in requisitos(repo)}
    tuyos = {r["id"] for r in (rev or {}).get("revisar") or []}
    out = []
    for f in filas:
        # «MISSING (no visual evidence)»: el veredicto es la primera palabra; el motivo, entre paréntesis, se traduce
        clave, _, motivo = f["veredicto"].partition(" ")
        ico, txt = VEREDICTOS.get(clave, ("•", clave.lower()))
        motivo = motivo.strip(" ()").lower()
        impugnado = re.search(r"challenged\s+((?:ch-\d+[,\s]*)+)", motivo)
        if impugnado:
            # «VERIFIED · challenged CH-047»: pasa sus tests, pero la revisión independiente duda de lo que enseñan (club)
            ids = ", ".join(x.upper() for x in re.findall(r"ch-\d+", impugnado.group(1)))
            ico, txt = "⚠️", f"pasa sus pruebas, pero la revisión independiente duda de que lo comprueben ({ids})"
        elif motivo:
            txt = MOTIVOS.get(motivo, txt)
        if f["id"] in tuyos and clave in ("MISSING", "PARTIAL"):
            # es justo lo que la persona revisa en 🔍: no es un «⚠️ sin comprobar» (club, entrega: «Tono cercano»)
            ico, txt = "🔍", "lo compruebas tú (abajo, en 🔍)"
        crit = ""
        m = re.match(r"(\d+)\s*/\s*(\d+)", f["criterios"])
        if m:
            crit = f" ({m.group(1)} de {m.group(2)} {'criterio' if m.group(2) == '1' else 'criterios'})"
        out.append(f"{ico} {f['titulo'] or plano.get(f['id'], f['id'])}: {txt}{crit}")
    return out


def _agrupa(lineas: list[str], max_ok: int = 3) -> list[str]:
    """Las excepciones (❌ ⚠️ 🟡 🔍) primero y una por línea; los ✅, si son más de <max_ok>, en una sola línea (club,
    entrega: 29 líneas ✅ iguales tapaban la única que había que mirar)."""
    ok = [l for l in lineas if l.startswith("✅")]
    resto = [l for l in lineas if not l.startswith("✅")]
    if len(ok) <= max_ok:
        return resto + ok
    nombres = [re.sub(r"^✅ (.*?): funciona y está comprobado.*$", r"\1", l) for l in ok]
    return resto + [f"✅ {len(ok)} requisitos funcionan y están comprobados: " + _corta("; ".join(nombres), 300)]


def _bloque_tests(repo: Path, fase: str | None, editados: int) -> str:
    """Tests que ya existían y cambiaron desde la última aceptación, con lo que dice hsdd_fidelidad (si los autorizó una
    persona con su firma y qué aserciones se quitan o se ponen, ≤ 3 líneas por test). Sin ese informe, el recuento."""
    try:
        cong = json.loads(_leer(repo / ".sdd" / "hermes" / f"fidelidad-{fase if fase not in (None, '') else 'global'}.json") or "{}").get("congelados")
    except ValueError:
        cong = None
    if cong is None:
        if not editados:
            return "🛡 No se ha tocado ningún test que ya existía."
        return (f"⚠️ {'Se ha cambiado 1 test que ya existía' if editados == 1 else f'Se han cambiado {editados} tests que ya existían'}: "
                "conviene saber por qué antes de aceptar.")
    if not cong:
        return "🛡 No se ha tocado ningún test que ya existía (ni sus ayudas ni su configuración)."
    por_f: dict = {}
    for x in cong:
        d = por_f.setdefault(x["fichero"], {"autorizado": True, "por": set(), "q": [], "p": [], "senales": set()})
        d["autorizado"] &= bool(x.get("autorizado"))
        d["por"].add(x.get("autorizacion", "").split(":")[0] if x.get("autorizado") else "")
        d["q"] += x.get("aserciones_quitadas") or []; d["p"] += x.get("aserciones_puestas") or []
        d["senales"] |= set(x.get("debilitamiento") or [])
    sin = [f for f, d in por_f.items() if not d["autorizado"]]
    n = len(por_f)
    cab = (f"⛔ {'Se ha cambiado 1 test que ya existía' if n == 1 else f'Se han cambiado {n} tests que ya existían'} y "
           f"{'no lo autorizó' if len(sin) == n else f'{len(sin)} no los autorizó'} nadie con su firma: no debería aceptarse sin saber por qué."
           if sin else
           f"✏️ {'Se ha cambiado 1 test que ya existía' if n == 1 else f'Se han cambiado {n} tests que ya existían'}, con la autorización que firmaste:")
    filas = []
    for f, d in list(por_f.items())[:6]:
        quien = ", ".join(sorted(x for x in d["por"] if x))
        filas.append(f"• {f}: " + (f"autorizado ({quien})" if d["autorizado"] else "SIN autorización firmada")
                     + (f" — {', '.join(sorted(d['senales']))}" if d["senales"] else ""))
        if d["q"]:
            filas.append(f"   quita: {_corta(' · '.join(d['q'][:2]), 160)}")
        if d["p"]:
            filas.append(f"   pone: {_corta(' · '.join(d['p'][:2]), 160)}")
    if len(por_f) > 6:
        filas.append(f"… y {len(por_f) - 6} más")
    return cab + "\n" + "\n".join(filas)


def _cabeza_ok(filas: list[dict], de_fase: bool) -> str:
    """Puerta de calidad cumplida (rc 0): todo lo imprescindible está comprobado. Si queda algo no imprescindible sin
    comprobar se dice, para no anunciar «todo en orden» con requisitos en ⚠️ (coches, entrega 1)."""
    ok, total = sum(1 for f in filas if f["veredicto"] == "VERIFIED"), len(filas)
    duda = sum(1 for f in filas if f["veredicto"].startswith("VERIFIED") and "CHALLENGED" in f["veredicto"])
    donde = " de esta fase" if de_fase else ""
    if duda and ok + duda == total:
        return (f"✅ Lo imprescindible{donde} está comprobado. "
                f"{'De 1 requisito que no es imprescindible' if duda == 1 else f'De {duda} requisitos que no son imprescindibles'} "
                f"la revisión independiente duda de que sus pruebas lo comprueben (⚠️ en la lista): míralo en la demo.")
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


CATEGORIAS = {"WEAKENED-ASSERT": "el test comprueba menos de lo que pide el criterio",
              "MOCK-ONLY": "solo pasa contra una simulación, no contra lo de verdad",
              "UNWIRED": "está hecho, pero ninguna pantalla lo usa",
              "BYPASS-PATH": "hay otro camino que se salta la regla",
              "CROSSING": "falla al repetirlo o con dos personas a la vez",
              "NOT-IMPLEMENTED": "no está hecho",
              "SPEC-QUESTION": "es una duda sobre el propio criterio: decides tú",
              "WRONG-CAPTURE": "la captura no enseña lo que dice el criterio"}


CORREGIR = ("✏️ Si una duda es del propio criterio (está mal escrito o contradice otro), pulsa ✏️ Corregir el requisito "
            "y di cómo tiene que quedar: se lanza un cambio de requisitos y la fase se rehace con el criterio bueno.")


def _bloque_impugnaciones(repo: Path, imp: list | None) -> list[str]:
    """Lo que encontró la revisión independiente y sigue abierto (gate 4). Las dudas del propio criterio (SPEC-QUESTION)
    son de la persona: cada una con su requisito y su frase. Lo técnico (tests flojos, capturas, algo sin hacer) ya
    pasó por los arreglos automáticos y no se cerró: va en una línea por tipo con sus números, para rechazar o
    descartar sin leer una lista de rutas (taller: 10 impugnaciones con su cita hacían una puerta de 1.600 palabras)."""
    if not imp:
        return []
    nombres = {r["id"]: r["titulo"] or _texto_req(r) for r in requisitos(repo)}
    tuyas = [c for c in imp if c.get("category") == "SPEC-QUESTION"]
    tecnicas = [c for c in imp if c.get("category") != "SPEC-QUESTION"]
    partes = []
    if tuyas:
        partes.append("🤔 La revisión independiente tiene dudas sobre lo que pide el propio requisito; esto es tuyo:\n" + "\n".join(
            f"• {c['id']} · {nombres.get(c.get('req'), c.get('req'))}: «{_corta(c.get('quote') or '', 140)}»" for c in tuyas))
    if tecnicas:
        grupos: dict[str, list[str]] = {}
        for c in tecnicas:
            grupos.setdefault(CATEGORIAS.get(c.get("category"), c.get("category", "")), []).append(c["id"])
        partes.append("🔧 Siguen abiertas tras los arreglos automáticos (técnicas: " + "; ".join(
            f"{que}: {', '.join(ids)}" for que, ids in grupos.items()) + "). ❌ Rechazar lo vuelve a intentar.")
    return partes + ([CORREGIR] if tuyas else [])


def puerta_fase(repo: Path, proyecto: str, fase: str, gate_md: str, rc: int, tests_editados: int,
                video: bool, capturas: int, rev: dict | None = None, imp: list | None = None) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = _cabeza_ok(filas, True)
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    elif rc == 4:
        cabeza = "⛔ Los requisitos pasan sus tests, pero la revisión independiente ha encontrado algo que no prueban."
    elif rev and rev.get("solo"):
        cabeza = "🔍 Solo falta tu revisión: lo que queda por comprobar no lo puede comprobar un test."
    else:   # puerta.sh ofrece ❌ Rechazar y 🟡 Aceptar sin lo que falta: el texto no puede decir «solo rechazar»
        cabeza = ("⛔ No pasa la comprobación: hay requisitos que fallan o sin comprobar. No se puede aceptar tal cual: "
                  "recházala para que se corrija o, si lo que falta puede esperar, acéptala sin ello.")
    partes = [f"🧪 La FASE-{fase} de «{proyecto}» está lista para revisar.", cabeza]
    if filas:
        partes.append("\n".join(_agrupa(_lineas_veredictos(repo, filas, rev))))
    partes += _bloque_impugnaciones(repo, imp)
    partes += _bloque_revisar(rev)
    partes.append(_bloque_tests(repo, fase, tests_editados))
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
    if rc == 4:   # impugnaciones abiertas: se arreglan (rechazar) o una persona descarta las que no son un fallo
        descartar = "🗑 Descartar las que no sean un fallo (escribe su número, p. ej. CH-005, y por qué; la puerta vuelve sin ellas)"
        return f"👉 {antes}❌ Rechazar para que se arregle, o {descartar}."
    # Bloqueada: rechazar (se corrige) o, si lo que falta puede esperar, eximirlo con un motivo (queda como pendiente)
    eximir = ("🟡 Aceptar sin lo que falta si puede esperar (di por qué; queda apuntado como pendiente con su número "
              "de seguimiento)")
    if demo:
        return f"👉 {antes}❌ Rechazar y di qué hay que corregir, o {eximir}."
    return f"👉 Pulsa ❌ Rechazar y di qué hay que corregir, o {eximir}."


def puerta_entrega(repo: Path, proyecto: str, gate_md: str, rc: int, fases_aceptadas: list[str], unica: bool = False,
                   video: bool = False, capturas: int = 0, tests_editados: int = 0, rev: dict | None = None,
                   imp: list | None = None) -> dict:
    filas = _filas_gate(gate_md)
    ok = sum(1 for f in filas if f["veredicto"] == "VERIFIED")
    if rc == 0:
        cabeza = _cabeza_ok(filas, False)
    elif rc == 3:
        cabeza = "⚠️ Cumple, pero con exenciones: algo se aceptó sin comprobar."
    elif rev and rev.get("solo"):
        cabeza = "🔍 Solo falta tu revisión: lo que queda por comprobar no lo puede comprobar un test."
    elif rc == 4:
        cabeza = "⛔ Los requisitos pasan sus tests, pero la revisión independiente ha encontrado algo que no prueban."
    else:
        cabeza = ("⛔ No pasa la comprobación final. No se puede aceptar tal cual: recházala para que se corrija o, si lo "
                  "que falta puede esperar, acéptala sin ello.")
    partes = [f"🎁 «{proyecto}» está terminado y listo para entregar.", cabeza]
    if filas:
        partes.append("\n".join(_agrupa(_lineas_veredictos(repo, filas, rev))))
    partes += _bloque_impugnaciones(repo, imp)
    partes += _bloque_revisar(rev)
    if unica:   # plan compacto: una sola fase, sin puerta propia; se acepta aquí con su demo
        partes.append("🧩 Se hizo en una sola fase: al aceptar la entrega aceptas también esa fase.")
        partes.append(_bloque_tests(repo, None, tests_editados))
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


def puerta_preguntas(proyecto: str, fase: str) -> dict:
    """La implementación de una FASE (o un mantenimiento, sin FASE) se paró en preguntas abiertas: la persona las
    contesta aquí (las preguntas, con sus botones Q, las añade el final de la puerta como en cualquier otra)."""
    que = f"La FASE-{fase}" if fase else "El mantenimiento"
    partes = [f"⏸ {que} de «{proyecto}» se ha parado: para seguir necesita que decidas esto.",
              f"Al responder, {que[0].lower() + que[1:]} sigue con tus respuestas. Si alguna pide cambiar los requisitos, "
              "antes te llega su puerta de requisitos con lo que cambia.",
              "👉 Elige en los botones Q (la recomendada ya está marcada) y pulsa ✅ Responder."]
    return {"titulo": f"Preguntas de la FASE-{fase}" if fase else "Preguntas del mantenimiento", "texto": "\n\n".join(partes)}


# Las skills escriben las opciones de varias formas; todas valen:
#   «  A) texto (recommended)»   «  A★) texto»   «Options: [A] texto (recomendada)  [B] texto»
_OP_LINEA = re.compile(r"^\s+([A-Z])\s*([★⭐\ufe0f]*)\s*\)\s*(.*)$", re.M)
_OP_CORCHETE = re.compile(r"\[([A-Z])\]\s*(.*?)(?=\s+\[[A-Z]\]|$)")
_RECOMENDADA = re.compile(r"\((?:recommended|recomendad[ao])\b", re.I)   # marca la recomendada (también «(recomendada, …)»)
# Al quitar la marca para enseñar el texto, se conserva lo demás del paréntesis («(recomendada; requiere sdd-req-change)»
# → «(requiere sdd-req-change)»: si se borraba entero, se perdía que esa opción pide un cambio de requisitos)
_RECOMENDADA_SOLA = re.compile(r"\s*\((?:recommended|recomendad[ao])(?:[,;]\s*(?:implementada|implemented))?\)", re.I)
_RECOMENDADA_DENTRO = re.compile(r"\((?:recommended|recomendad[ao])[,;]\s*", re.I)


def opciones(bloque: str) -> list[tuple[str, str, bool]]:
    """[(letra, texto, recomendada)] de una pregunta ## Q-… del método."""
    ops = [(l, txt, bool(est) or bool(_RECOMENDADA.search(txt))) for l, est, txt in _OP_LINEA.findall(bloque)]
    if not ops:
        m = re.search(r"^Options:\s*(.*)$", bloque, re.M)
        if m:
            ops = [(l, txt, bool(_RECOMENDADA.search(txt))) for l, txt in _OP_CORCHETE.findall(m.group(1).strip())]
    return [(l, _RECOMENDADA_DENTRO.sub("(", _RECOMENDADA_SOLA.sub("", txt)).strip(), rec) for l, txt, rec in ops]


def opciones_json(bloque: str) -> dict:
    """{opciones: [letras], recomendada: letra, efectos: {letra: {efecto, ficheros, declarado}}, cliente} para los
    botones Q (sin marca, la primera) y para el notario: lo que hará cada opción, tal como lo vio la persona."""
    ops = opciones(bloque)
    rec = next((l for l, _, r in ops if r), ops[0][0] if ops else "")
    return {"opciones": [l for l, _, _ in ops], "recomendada": rec,
            "efectos": {l: {k: v for k, v in efecto(bloque, l).items() if k in ("efecto", "ficheros", "declarado")} for l, _, _ in ops},
            "cliente": para_cliente(bloque)}


# ── efecto declarado de cada opción (formato de pregunta de references/async-questions.md) ──────────────────────────
# Debajo de cada opción, una línea «efecto: ninguno | accion | req-change | editar-test <ficheros>» dice qué pasa al
# elegirla: nada, trabajo para la etapa que aplica las respuestas, un cambio de requisitos con su propia puerta, o
# permiso (firmado por el notario) para editar exactamente esos tests que ya existían. Sin efecto declarado (preguntas
# antiguas) se adivina con las reglas de siempre (pide_cambio, _SIN_ACCION) y nunca autoriza editar un test.
EFECTOS = {"ninguno": "ninguno", "none": "ninguno", "nada": "ninguno", "accion": "accion", "acción": "accion",
           "action": "accion", "req-change": "req-change", "editar-test": "editar-test", "edit-test": "editar-test"}
_EFECTO = re.compile(r"^\s+(?:efecto|effect)\s*:\s*(\S+)\s*(.*?)\s*$", re.I)
_CLIENTE_Q = re.compile(r"^(?:Para el cliente|For the customer)\s*:\s*(.*\S)\s*$", re.M | re.I)
_CLIENTE_OP = re.compile(r"^\s+(?:cliente|para el cliente|customer)\s*:\s*(.*\S)\s*$", re.I)
_OP_UNA = re.compile(r"^\s+([A-Z])\s*[★⭐️]*\s*\)\s*(.*)$")


def para_cliente(bloque: str) -> str:
    m = _CLIENTE_Q.search(bloque)
    return m.group(1).strip() if m else ""


def efectos(bloque: str) -> dict:
    """{letra: {efecto|None|"?", ficheros, cliente, crudo}} de las líneas «efecto:» y «cliente:» bajo cada opción."""
    out, actual = {}, None
    for l in bloque.splitlines():
        m = _OP_UNA.match(l)
        if m:
            actual = m.group(1)
            out[actual] = {"efecto": None, "ficheros": [], "cliente": "", "crudo": ""}
            continue
        if actual is None:
            continue
        if l.strip() and not l[:1].isspace():   # «Blocks:», «Answer:»… cierran la lista de opciones
            actual = None
            continue
        e = _EFECTO.match(l)
        if e:
            crudo = e.group(1).strip("`:,").lower()
            out[actual].update(crudo=crudo, efecto=EFECTOS.get(crudo, "?"),
                               ficheros=[f.strip("`'\"") for f in re.split(r"[,;\s]+", e.group(2)) if f.strip("`'\"")])
            continue
        c = _CLIENTE_OP.match(l)
        if c:
            out[actual]["cliente"] = c.group(1).strip()
    return out


def efecto(bloque: str, letra: str) -> dict:
    """{efecto, ficheros, declarado, cliente} de la opción <letra>. Sin «efecto:» se adivina (preguntas antiguas)."""
    d = efectos(bloque).get(letra.upper())
    if d and d["efecto"]:
        return {"efecto": d["efecto"], "ficheros": d["ficheros"], "declarado": True, "cliente": d["cliente"]}
    txt = next((t for l, t, _ in opciones(bloque) if l == letra.upper()), "")
    adivinado = "req-change" if pide_cambio(txt) else "ninguno" if _SIN_ACCION.search(txt) else "accion"
    return {"efecto": adivinado if txt else "?", "ficheros": [], "declarado": False, "cliente": (d or {}).get("cliente", "")}


def errores_pregunta(bloque: str) -> list[str]:
    """Lo que le falta a una pregunta del formato nuevo (alguna opción declara efecto). Las antiguas no se juzgan."""
    ef = efectos(bloque)
    if not any(d["efecto"] for d in ef.values()):
        return []
    errs = [] if para_cliente(bloque) else ["le falta «Para el cliente:»"]
    for l, d in ef.items():
        if not d["efecto"]:
            errs.append(f"la opción {l} no dice su efecto")
        elif d["efecto"] == "?":
            errs.append(f"la opción {l} tiene un efecto desconocido («{d['crudo']}»: vale ninguno, accion, req-change o editar-test)")
        elif d["efecto"] == "editar-test" and not d["ficheros"]:
            errs.append(f"la opción {l} autoriza editar tests sin decir cuáles")
    return errs


# Una opción que pide cambiar los requisitos: la marca explícita del método «(req-change)» o, en preguntas escritas
# sin ella, un verbo de cambio junto a REQ/requisito/criterio («Añadir cuatro REQ con sdd-req-change», «enmendar el
# criterio…»). Elegirla y aprobar la puerta lanza un cambio (/cambio): nada cambia sin su propia puerta de requisitos.
# «(req-change)» sola, o al principio de un paréntesis más largo: «(req-change; contradice AC1…)»
_MARCA_CAMBIO = re.compile(r"\s*\(req-change\)|(?<=\()req-change[;,:]\s*", re.I)
_PIDE_CAMBIO = re.compile(
    r"sdd-req-change|\b(?:enmendar|añadir|agregar|modificar|cambiar|quitar|eliminar|deprecar|incorporar|amend|add|modify"
    r"|change|remove|deprecate)\b[^.;]{0,50}?\b(?:REQ|requisitos?|criterios?|requirements?|criteri(?:on|a))\b", re.I)
_NEGACION = re.compile(r"\b(?:no|sin|nada|ning[uú]n|nothing|without|not)\b", re.I)


def pide_cambio(texto: str) -> bool:
    # La marca explícita o nombrar sdd-req-change decide, aunque la opción empiece por «No» (club, FASE-4: «No: las
    # plazas son siempre 4 y se enmienda el enunciado de REQ-F-012 vía sdd-req-change» no lanzaba el cambio)
    if _MARCA_CAMBIO.search(texto) or re.search(r"sdd-req-change|\breq-change\b", texto, re.I):
        return True
    return bool(_PIDE_CAMBIO.search(texto)) and not _NEGACION.search(texto)


# Una opción que no pide hacer nada («Dejarlo como está», «Mantener…», «No…»)
_SIN_ACCION = re.compile(r"^\s*(?:dejar|mantener|no\b|nada|sin cambios|aceptar(?:lo)? (?:tal|como)|ratific|confirmar (?:tal|como|lo hecho)|validar lo hecho|keep|leave|do nothing|ratify)", re.I)


def respuesta(bloque: str, letra: str) -> str:
    """«Q-…: pregunta\nRespuesta elegida: L) texto» (sin la marca del método), o "" si la letra no es una opción."""
    txt = next((t for l, t, _ in opciones(bloque) if l == letra.upper()), "")
    if not txt:
        return ""
    q = re.search(r"^Question:\s*(.*)$", bloque, re.M)
    qid = bloque.split()[1] if len(bloque.split()) > 1 else "?"
    cli, op = para_cliente(bloque), efecto(bloque, letra).get("cliente") or _MARCA_CAMBIO.sub("", txt).strip()
    # con la versión para el cliente al final: la puerta del cambio que lancen estas respuestas la enseña en castellano
    return (f"{qid}: {q.group(1).strip() if q else ''}\nRespuesta elegida: {letra.upper()}) "
            f"{_MARCA_CAMBIO.sub('', txt).strip()}" + (f"\nPara el cliente: {cli} → {letra.upper()}) {op}".rstrip() if cli else ""))


def peticion_cambio(bloque: str, letra: str) -> str:
    """Si la opción <letra> de la pregunta pide cambiar los requisitos, la petición para /cambio (si no, "")."""
    return respuesta(bloque, letra) if efecto(bloque, letra)["efecto"] == "req-change" else ""


def accion_respuesta(bloque: str, letra: str) -> str:
    """Si la opción elegida pide trabajo que no es cambiar requisitos (ajustar un test, editar el plan…), la respuesta
    para la etapa que la aplica (si no, ""). Con editar-test, dice qué tests autorizó la persona, y solo esos."""
    e = efecto(bloque, letra)
    if e["efecto"] not in ("accion", "editar-test", "?"):   # «?»: un efecto mal escrito, se aplica como trabajo
        return ""
    r = respuesta(bloque, letra)
    if r and e["efecto"] == "editar-test":
        r += ("\nTests ya existentes que la persona autoriza editar (solo estos; firmado en acceptance/decisions.jsonl): "
              + ", ".join(e["ficheros"]))
    return r


# ── respuestas de la persona: «Q1: A, Q2: B» (lo añade el canal) frente a lo que la puerta enseñó ─────────────────
# Solo «Qn: L» o «Qn=L» con la letra en mayúscula cuentan («De Q1 a Q3 lo recomendado» no es una respuesta). Una letra
# que no es opción de esa pregunta, una pregunta que no existe o dos letras para la misma rechazan la decisión.
_PAR_Q = re.compile(r"(?<![A-Za-z0-9-])[Qq](\d{1,3})\s*[:=·]\s*([A-Z])(?![\wÀ-ÿ])")


def _letras(xs: list) -> str:
    xs = list(xs)
    return (", ".join(xs[:-1]) + " o " + xs[-1]) if len(xs) > 1 else (xs[0] if xs else "ninguna")


def bloques_preguntas(ficheros: list) -> dict:
    """{Q-id: bloque} de todas las preguntas (abiertas o no) de .sdd/questions-*.md."""
    out = {}
    for f in sorted(str(x) for x in ficheros):
        for b in re.findall(r"^## Q-.*?(?=^## |\Z)", _leer(Path(f)), flags=re.M | re.S):
            out.setdefault(b.split()[1], b)
    return out


def preguntas_de(puerta: dict, ficheros: list) -> list[dict]:
    """[{n, id, opciones, recomendada, efectos, bloque}]: las que enseñó la puerta (su número es el del botón Q) o, si la
    puerta no las guardó, las abiertas de los ficheros en orden."""
    bloques = bloques_preguntas(ficheros)
    qs = []
    if puerta.get("preguntas"):
        for q in puerta["preguntas"]:
            b = bloques.get(q.get("id"), "")
            vista = {k: v for k, v in q.items() if k in ("opciones", "recomendada", "efectos") and v}
            qs.append({**(opciones_json(b) if b else {}), **vista, "n": int(q["n"]), "id": q.get("id"), "bloque": b})
    else:
        n = 0
        for qid, b in bloques.items():
            if re.match(r"^## Q-\S+\s+\[OPEN\]", b):
                n += 1
                qs.append({**opciones_json(b), "n": n, "id": qid, "bloque": b})
    return qs


def _pares_marcados(marcadas) -> list[tuple[str, str]]:
    """[(n, letra)] del campo «respuestas» de la decisión ({"1": "B"}): lo que la persona marcó en los botones Q, sin
    pasar por el texto libre. Una clave que no es un número sale como «Q0» (una pregunta que no existe) y una letra que
    no es opción, tal cual: las dos rechazan la decisión en vez de ignorarse."""
    out = []
    for k, v in sorted((marcadas or {}).items(), key=lambda kv: (len(str(kv[0])), str(kv[0]))):
        if v in (None, ""):
            continue
        out.append((str(k) if str(k).isdigit() else "0", str(v)))
    return out


def elegidas(texto: str, qs: list[dict], marcadas: dict | None = None) -> tuple[dict, list[str]]:
    """({n: letra}, errores) de lo que marcó la persona frente a las preguntas de la puerta: el campo «respuestas» de la
    decisión ({"1": "A"}) y, por las decisiones anteriores a ese campo o lo escrito a mano, «Q1: A, Q2: B» en el texto.
    Las dos fuentes se validan igual: una letra que no es opción, una pregunta que no existe o dos letras distintas para
    la misma pregunta (aunque vengan una de cada sitio) rechazan la decisión."""
    por_n = {int(q["n"]): q for q in qs}
    out, errs = {}, []
    for n, l in _pares_marcados(marcadas) + _PAR_Q.findall(texto or ""):
        n = int(n)
        q = por_n.get(n)
        if q is None:
            errs.append(f"Q{n} no existe (la puerta tenía {_plural(len(por_n), 'pregunta', 'preguntas')})")
        elif l not in (q.get("opciones") or []):
            errs.append(f"Q{n}: «{l}» no es una de sus opciones ({_letras(q.get('opciones') or [])})")
        elif n in out and out[n] != l:
            errs.append(f"Q{n} tiene dos respuestas distintas ({out[n]} y {l})")
        else:
            out[n] = l
    return out, errs


def plan_respuestas(puerta: dict, ficheros: list, texto: str, verbo: str,
                    marcadas: dict | None = None) -> tuple[list[dict], list[str], str]:
    """(respuestas [{q, letra, como, efecto}], errores, modo). Con respuestas marcadas (el campo de la decisión o «Qn: L»
    en el texto), esas; si no, aceptar, dar conformidad o responder contestan todas con la recomendada (como enseña la
    puerta: «si te vale, no toques nada»)."""
    qs = preguntas_de(puerta, ficheros)
    el, errs = elegidas(texto, qs, marcadas)
    if el:
        modo = "elegidas"
        res = [{"q": q, "letra": el[q["n"]], "como": "elegida por"} for q in qs if q["n"] in el]
    elif verbo in ("acepto", "observaciones", "conforme", "respondo") or (
            verbo == "rechazo" and puerta.get("tipo") in ("fase", "entrega")):
        # (en una FASE o entrega bloqueada rechazar es la única salida: sus preguntas se contestan al rechazar, con la
        # recomendada si no se marcó otra; pero esa recomendada no autoriza editar tests: ver aplicar_respuestas)
        modo = "recomendada"
        res = [{"q": q, "letra": q.get("recomendada") or "", "como": "opción recomendada, aceptada por"} for q in qs]
        res = [r for r in res if r["letra"]]
    else:
        modo, res = "", []
    for r in res:
        b = r["q"].get("bloque") or ""
        vista = (r["q"].get("efectos") or {}).get(r["letra"])
        # sin el bloque (la pregunta ya no está en .sdd/) no hay nada que escribir ni que lanzar: vale lo que vio la puerta
        r["efecto"] = efecto(b, r["letra"]) if b else {"efecto": "ninguno", "ficheros": [], **(vista or {})}
    return res, errs, modo


def validar_respuestas(puerta: dict, ficheros: list, texto: str, verbo: str, persona: bool,
                       marcadas: dict | None = None) -> list[str]:
    """Lo que hace inválida una decisión antes de firmar nada: letras que no existen y permisos que no caben."""
    res, errs, _ = plan_respuestas(puerta, ficheros, texto, verbo, marcadas)
    for r in res:
        e, qn = r["efecto"], f"Q{r['q']['n']} ({r['q'].get('id')})"
        if e.get("efecto") == "editar-test":
            if not persona:
                errs.append(f"{qn}: editar un test que ya existía lo autoriza una persona, no Jev (art. 12)")
            elif not e.get("ficheros"):
                errs.append(f"{qn}: la opción {r['letra']} autoriza editar tests sin decir cuáles")
        # Un efecto desconocido («efecto: --adversarial …», texto libre) ya sale en la puerta como «⚠️ Pregunta mal
        # escrita» y se trata como trabajo (accion): nunca autoriza editar un test, que exige «editar-test <ficheros>».
        # Antes rechazaba la decisión entera, aunque fuera descartar impugnaciones (taller, entrega: la puerta en error)
    return errs


def aplicar_respuestas(puerta: dict, ficheros: list, texto: str, verbo: str, quien: str, hoy: str,
                       marcadas: dict | None = None) -> dict:
    """Escribe «Answer: L — …» en cada pregunta contestada y devuelve {peticiones, por_aplicar, autorizaciones}."""
    res, errs, _ = plan_respuestas(puerta, ficheros, texto, verbo, marcadas)
    if errs:
        raise ValueError("; ".join(errs))
    out = {"peticiones": [], "por_aplicar": [], "autorizaciones": []}
    por_id = {r["q"]["id"]: r for r in res}
    for f in sorted(str(x) for x in ficheros):
        t = _leer(Path(f))
        if not t:
            continue
        def contestar(m):
            b = m.group(0)
            r = por_id.get(b.split()[1])
            if not r:
                return b
            letra = r["letra"]
            pet, acc = peticion_cambio(b, letra), accion_respuesta(b, letra)
            if pet:
                out["peticiones"].append(pet)
            if acc:
                out["por_aplicar"].append(acc)
            e = efecto(b, letra)
            # Editar un test ya aceptado: o la persona eligió esa opción (Qn: L), o la aceptó por defecto al ACEPTAR viendo
            # «esto lanzará: ✏️ autoriza editar…». Un rechazo o una petición de cambios sin tocar la pregunta no autoriza
            # nada (notario 13: rechazar una FASE autorizaba la recomendada de una pregunta que seguía abierta).
            explicita = r["como"] == "elegida por"
            if e["efecto"] == "editar-test" and e["ficheros"] and (explicita or verbo in ("acepto", "observaciones", "respondo", "conforme")):
                q = re.search(r"^Question:\s*(.*)$", b, re.M)
                op = next((x for l, x, _ in opciones(b) if l == letra), "")
                out["autorizaciones"].append({"pregunta": b.split()[1], "letra": letra, "ficheros": e["ficheros"],
                                              "motivo": _corta(f"{q.group(1) if q else ''} → {letra}) {op}", 560)})
            b = b.replace("[OPEN]", "[ANSWERED]", 1)
            linea = f"Answer: {letra} — {r['como']} {quien} ({hoy})"
            if re.search(r"^Answer:[ \t]*$", b, re.M):   # [ \t]: no comerse los saltos de línea que separan preguntas
                return re.sub(r"^Answer:[ \t]*$", linea, b, count=1, flags=re.M)
            cuerpo = b.rstrip("\n")                       # sin línea Answer: se añade, conservando la separación
            return cuerpo + "\n" + linea + b[len(cuerpo):] if b[len(cuerpo):] else cuerpo + "\n" + linea + "\n"
        nuevo = re.sub(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", contestar, t, flags=re.M | re.S)
        if nuevo != t:
            Path(f).write_text(nuevo, encoding="utf-8")
    return out


def lineas_respuestas(puerta: dict, ficheros: list, texto: str, marcadas: dict | None = None) -> list[str]:
    """«Qn (Q-id): pregunta → elegida L: texto» de lo que la persona eligió (para el feedback de un rechazo)."""
    res, _, _ = plan_respuestas(puerta, ficheros, texto, "rechazo", marcadas)
    out = []
    for r in res:
        b = r["q"].get("bloque") or ""
        q = re.search(r"^Question:\s*(.*)$", b, re.M)
        op = next((x for l, x, _ in opciones(b) if l == r["letra"]), "?")
        out.append(f"Q{r['q']['n']} ({r['q'].get('id', '?')}): {q.group(1) if q else ''} → elegida {r['letra']}: {op}")
    return out


def _efecto_txt(e: dict) -> str:
    if e.get("efecto") == "editar-test":
        return "✏️ autoriza editar " + (", ".join(e.get("ficheros") or []) or "tests sin decir cuáles")
    return {"accion": "🛠 lanza trabajo", "req-change": "📝 abre un cambio de requisitos", "?": "❔ efecto desconocido"}.get(e.get("efecto"), "")


LANZARA_DEFECTO = "👉 Si firmas sin tocar los botones Q, esto lanzará: "
LANZARA_MARCADO = "👉 Con lo que has marcado en los botones Q, firmar lanzará: "


def _lanzara(elegidas: list[tuple[int, dict]], marcado: bool = False) -> str:
    """La línea «👉 … esto lanzará: …» de [(n, efecto de la opción elegida)]."""
    lanza = {"accion": [], "req-change": [], "ninguno": [], "?": []}
    tests_aut = []
    for n, e in elegidas:
        ef = e.get("efecto") or "ninguno"
        if ef == "editar-test":
            tests_aut += [f"{x} (Q{n})" for x in e.get("ficheros") or []] or [f"tests sin decir cuáles (Q{n})"]
        else:
            lanza.setdefault(ef, []).append(f"Q{n}")
    partes = [f"🛠 lanza trabajo: {', '.join(lanza['accion'])}" if lanza["accion"] else "",
              (f"📝 abre un cambio de requisitos (antes de seguir te llega su puerta): {', '.join(lanza['req-change'])}"
               if lanza["req-change"] else ""),
              f"✏️ autoriza editar tests que ya existían: {', '.join(tests_aut)}" if tests_aut else "",
              f"❔ efecto desconocido: {', '.join(lanza['?'])}" if lanza["?"] else "",
              f"sin más efecto: {', '.join(lanza['ninguno'])}" if lanza["ninguno"] else ""]
    return (LANZARA_MARCADO if marcado else LANZARA_DEFECTO) + " · ".join(x for x in partes if x) + "."


def resumen_lanzara(puerta: dict, elecciones: dict) -> str:
    """Qué lanzará firmar la puerta con las opciones marcadas en los botones Q ({n: letra}; la que falte, la
    recomendada), con los efectos que la puerta guardó de cada opción. "" si la puerta no tiene preguntas con efectos.
    Función pura: la usan Telegram y el panel para reescribir esa línea al pulsar un botón Q."""
    qs = [q for q in puerta.get("preguntas") or [] if q.get("efectos")]
    if not qs:
        return ""
    elecciones = {str(k): v for k, v in (elecciones or {}).items() if v}
    elegidas, marcado = [], False
    for q in sorted(qs, key=lambda q: int(q["n"])):
        rec = q.get("recomendada") or ""
        letra = elecciones.get(str(q["n"])) or rec
        marcado = marcado or letra != rec
        e = (q.get("efectos") or {}).get(letra)
        if e:
            elegidas.append((int(q["n"]), e))
    return _lanzara(elegidas, marcado) if elegidas else ""


def texto_con_lanzara(puerta: dict, elecciones: dict) -> str:
    """El texto de la puerta con la línea «esto lanzará» recalculada para las opciones marcadas."""
    texto = puerta.get("texto") or ""
    nueva = resumen_lanzara(puerta, elecciones)
    if not nueva:
        return texto
    return re.sub(r"^(?:" + re.escape(LANZARA_DEFECTO) + "|" + re.escape(LANZARA_MARCADO) + r").*$",
                  lambda _: nueva, texto, count=1, flags=re.M)


def preguntas(ficheros: list[Path]) -> str:
    """Las preguntas abiertas, numeradas como los botones Q1, Q2…, con la recomendada marcada. Cada una con su frase
    «Para el cliente» delante y lo técnico plegado en una línea; cada opción dice qué lanza (su efecto); al final, qué
    lanzará firmar sin tocar nada (club: un plan firmó 21 recomendadas de golpe sin ver que tres lanzaban trabajo)."""
    bloques, recomendadas = [], []
    for f in sorted(ficheros):
        for b in re.findall(r"^## Q-[^\n]*\[OPEN\].*?(?=^## |\Z)", _leer(f), flags=re.M | re.S):
            n = len(bloques) + 1   # mismo número que el botón Q (puerta.sh cuenta todas las abiertas)
            q = re.search(r"^Question:\s*(.*)$", b, re.M)
            tecnica = q.group(1).strip() if q else b.split("\n", 1)[0].lstrip("# ").strip()
            cli = para_cliente(b)
            lineas = [f"{n}. {cli}", f"   🔧 Detalle técnico: {_corta(tecnica, 160)}"] if cli else [f"{n}. {tecnica}"]
            ops = opciones(b)
            # Sin marca de recomendada, la primera: lo mismo que los botones Q y el notario (opciones_json)
            if ops and not any(r for _, _, r in ops):
                ops = [(l, t, i == 0) for i, (l, t, _) in enumerate(ops)]
            for letra, txt, rec in ops:
                e = efecto(b, letra)
                marca = _efecto_txt(e)
                lineas.append(f"   {letra}) {e.get('cliente') or _MARCA_CAMBIO.sub('', txt).strip()}{'  ⭐ recomendada' if rec else ''}"
                              + (f"  ({marca})" if marca else ""))
                if rec:
                    recomendadas.append((n, e))
            errs = errores_pregunta(b)
            if errs:
                lineas.append("   ⚠️ Pregunta mal escrita: " + "; ".join(errs))
            bloques.append("\n".join(lineas))
    if not bloques:
        return ""
    resumen = _lanzara(recomendadas)
    return ("\n\n❓ Antes, " + ("una pregunta" if len(bloques) == 1 else f"{len(bloques)} preguntas")
            + " (la recomendada ya está marcada en los botones Q):\n\n" + "\n\n".join(bloques) + "\n\n" + resumen)


def normalizar_preguntas(repo: Path) -> int:
    """Las preguntas que una etapa escribió sin la cabecera del método («Q-x-001 [OPEN]» en vez de «## Q-x-001 [OPEN]») o
    con un número repetido: se les pone la cabecera y se renumeran, para que las vean las puertas y el notario (club:
    14 preguntas del implementador sin «## » se acumularon desde la FASE-0 sin llegar a nadie). Devuelve cuántos ficheros tocó."""
    n = 0
    cab = re.compile(r"^(?:## )?(Q-[A-Za-z][\w-]*-)(\d{3})(\s+\[(?:OPEN|ANSWERED)\])", re.M)
    for f in sorted((repo / ".sdd").glob("questions-*.md")):
        t = _leer(f)
        maximo: dict = {}
        for m in cab.finditer(t):
            maximo[m.group(1)] = max(maximo.get(m.group(1), 0), int(m.group(2)))
        vistos = set()
        def poner(m):
            pre, num = m.group(1), m.group(2)
            if pre + num in vistos:
                maximo[pre] += 1
                num = f"{maximo[pre]:03d}"
            vistos.add(pre + num)
            return f"## {pre}{num}{m.group(3)}"
        nuevo = cab.sub(poner, t)
        if nuevo != t:
            f.write_text(nuevo, encoding="utf-8"); n += 1
    return n


def _cli_respuestas(argv: list) -> int:
    """respuestas <validar|distintas|aplicar|lineas> --puerta P --texto T [--respuestas JSON] --verbo V [--persona 0|1]
    [--quien Q --hoy D --salida F] <ficheros questions-*.md…>  (lo usa el notario: el parseo de respuestas vive aquí y no
    en firmar.sh). --respuestas: el campo «respuestas» de la decisión ({"1": "B"}, lo que la persona marcó)."""
    import argparse
    ap = argparse.ArgumentParser(prog="hsdd_textos.py respuestas")
    ap.add_argument("accion", choices=["validar", "distintas", "aplicar", "lineas"])
    ap.add_argument("--puerta", required=True); ap.add_argument("--texto", default=""); ap.add_argument("--verbo", default="")
    ap.add_argument("--respuestas", default="", help="JSON {n: letra} con lo que marcó la persona")
    ap.add_argument("--persona", type=int, default=1); ap.add_argument("--quien", default=""); ap.add_argument("--hoy", default="")
    ap.add_argument("--salida", default="", help="aplicar: JSON {peticiones, por_aplicar, autorizaciones}")
    ap.add_argument("ficheros", nargs="*")
    a = ap.parse_intermixed_args(argv)
    puerta = json.loads(_leer(Path(a.puerta)) or "{}")
    fs = [f for f in a.ficheros if not f.endswith("*.md") and Path(f).exists()]
    try:
        marcadas = json.loads(a.respuestas) if a.respuestas else {}
    except ValueError:
        marcadas = None
    if not isinstance(marcadas, dict):   # un campo que no es {n: letra}: no se adivina, se rechaza la decisión
        print("el campo «respuestas» de la decisión no es {pregunta: letra}", file=sys.stderr)
        return 1
    if a.accion == "validar":
        errs = validar_respuestas(puerta, fs, a.texto, a.verbo, bool(a.persona), marcadas)
        for e in errs:
            print(e, file=sys.stderr)
        return 1 if errs else 0
    if a.accion == "distintas":   # respuestas distintas de la recomendada: «Q-id = L; …»
        res, _, modo = plan_respuestas(puerta, fs, a.texto, a.verbo, marcadas)
        print("; ".join(f"{r['q']['id']} = {r['letra']}" for r in res if modo == "elegidas" and r["letra"] != r["q"].get("recomendada")))
        return 0
    if a.accion == "lineas":
        print("\n".join(lineas_respuestas(puerta, fs, a.texto, marcadas)))
        return 0
    try:
        out = aplicar_respuestas(puerta, fs, a.texto, a.verbo, a.quien, a.hoy, marcadas)
    except ValueError as e:
        print(e, file=sys.stderr)
        return 1
    if a.salida:
        Path(a.salida).parent.mkdir(parents=True, exist_ok=True)
        Path(a.salida).write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(out, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    if sys.argv[1:2] == ["normalizar-preguntas"]:   # normalizar-preguntas <repo>
        print(normalizar_preguntas(Path(sys.argv[2]))); sys.exit(0)
    if sys.argv[1:2] == ["respuestas"]:
        sys.exit(_cli_respuestas(sys.argv[2:]))
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
    ap.add_argument("--impugnaciones", default="", help="fichero JSON con las impugnaciones abiertas (gate 4)")
    if sys.argv[1:2] == ["revisar"]:   # revisar <repo>  (gate --json por stdin) → {"revisar": [...], "solo": bool}
        print(json.dumps(revisar(Path(sys.argv[2]), json.loads(sys.stdin.read() or "{}")), ensure_ascii=False)); sys.exit(0)
    a = ap.parse_args()
    rev = json.loads(_leer(Path(a.revisar)) or "null") if a.revisar else None
    imp = json.loads(_leer(Path(a.impugnaciones)) or "[]") if a.impugnaciones else None
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
        r = puerta_fase(repo, proyecto, a.fase, md, a.rc, a.tests_editados, bool(a.video), a.capturas, rev, imp)
    elif a.tipo == "entrega":
        r = puerta_entrega(repo, proyecto, md, a.rc, a.fases_aceptadas.split(), bool(a.unica), bool(a.video), a.capturas,
                           a.tests_editados, rev, imp)
    elif a.tipo == "preguntas":
        r = puerta_preguntas(proyecto, a.fase)
    elif a.tipo == "mantenimiento":
        r = puerta_mantenimiento(proyecto, json.loads(_leer(Path(a.hallazgos)) or "[]"))
    else:
        sys.exit(f"tipo de puerta desconocido: {a.tipo}")
    r["texto"] += preguntas(list(repo.glob(".sdd/questions-*.md")))
    print(json.dumps(r, ensure_ascii=False))
