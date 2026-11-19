"""La WIKI DEL PROYECTO, generada de sus artefactos sin modelo y siempre al día (etapa.sh la reconstruye antes de cada
etapa): una página por identificador (REQ-F-004, UC-003, SCR-002, INV-RES-001, ADR-002, FASE-1, TASK-F1-003…) con su
definición tal cual, quién la cita (con fichero y línea), dónde aparece en el código y los tests, su veredicto y sus
capturas, y un índice. El agente la consulta en vez de abrir documentos enteros: .sdd/wiki/<ID>.md e índice
.sdd/wiki/index.md. Formato de la skill llm-wiki (frontmatter, [[enlaces]], index.md, log.md): la memoria del
encargado (wiki/, contexto del cliente y decisiones) enlaza aquí en vez de copiar.

En noviembre de 2026 un proyecto de ruta completa tenía ~100 documentos y >6.000 menciones de identificadores sin índice
ni forma de preguntar «todo lo de REQ-F-004»; el MCP del plugin sdd-pipeline 5.3.0 no indexa este formato (0 artefactos).

  python3 hsdd_wiki.py construir <repo>          (re)genera <repo>/.sdd/wiki/ (borra la anterior)
  python3 hsdd_wiki.py ver <repo> <ID>           la página de un identificador
  python3 hsdd_wiki.py buscar <repo> <texto>     identificadores cuyo título contiene el texto
"""
import json, re, shutil, sys
from collections import defaultdict
from datetime import date
from pathlib import Path

DOCS = ("intent", "requirements", "spec", "design", "ux", "plan", "task", "test", "audits", "changes")
CODIGO = ("src", "tests", "server", "app", "lib")
PREFIJOS = ("REQ", "N", "UC", "WF", "SCR", "INV", "API", "ENT", "ADR", "DEC", "RN", "BDD", "SEC", "VO", "FASE", "TASK",
            "AC", "NFR", "PERF", "E2E", "INT", "DS", "CMP")
ID = re.compile(r"\b(?:" + "|".join(PREFIJOS) + r")(?:-[A-Z][A-Z0-9]{0,5})?-\d+(?:-\d+)?\b")
CABECERA = re.compile(r"^(#{1,5})\s+(.*)$")
TIPO = {"REQ": "requisito", "N": "necesidad", "UC": "caso de uso", "WF": "workflow", "SCR": "pantalla",
        "INV": "invariante", "API": "API", "ENT": "entidad", "ADR": "decisión de arquitectura", "DEC": "decisión",
        "RN": "regla de negocio", "BDD": "escenario", "SEC": "seguridad", "VO": "objeto de valor", "FASE": "fase",
        "TASK": "tarea", "AC": "criterio (escenario de prueba)", "NFR": "no funcional", "PERF": "rendimiento",
        "E2E": "prueba e2e", "INT": "petición de cambio", "DS": "sistema de diseño", "CMP": "componente"}
MAX_DEF = 6000   # caracteres de la definición en la página (el resto, en el documento: se dice dónde)


def _pref(i: str) -> str:
    return i.split("-", 1)[0]


def _leer(f: Path) -> str:
    try:
        return f.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return ""


def _secciones(texto: str):
    """[(línea_inicio, nivel, título, cuerpo)] de un Markdown, por cabeceras."""
    out, actual, lineas = [], None, texto.splitlines()
    for n, l in enumerate(lineas, 1):
        m = CABECERA.match(l)
        if m:
            if actual:
                out.append(actual)
            actual = [n, len(m.group(1)), m.group(2).strip(), []]
        elif actual:
            actual[3].append(l)
    if actual:
        out.append(actual)
    return [(a, b, c, "\n".join(d).strip()) for a, b, c, d in out]


def construir(repo: Path) -> dict:
    repo = Path(repo)
    defs, citas, codigo = {}, defaultdict(list), defaultdict(set)
    docs = [f for d in DOCS for f in sorted((repo / d).rglob("*.md")) if ".sdd" not in f.parts]
    for f in docs:
        rel = str(f.relative_to(repo))
        texto = _leer(f)
        # un fichero que lleva el identificador en el nombre lo define entero (spec/use-cases/UC-003-reservar.md)
        m = ID.match(f.stem.upper().replace("_", "-"))
        if m and m.group(0) not in defs:
            defs[m.group(0)] = {"titulo": (_secciones(texto) or [(1, 1, f.stem, "")])[0][2], "donde": f"{rel}:1", "texto": texto}
        for linea, nivel, titulo, cuerpo in _secciones(texto):
            m = ID.search(titulo)
            if m and m.start() < 6 and m.group(0) not in defs:   # «### REQ-F-004: …», «## UC-003 Reservar»
                defs[m.group(0)] = {"titulo": titulo, "donde": f"{rel}:{linea}", "texto": cuerpo}
        # otras formas de definir: la primera celda de una fila de tabla (con la cabecera de la tabla), una línea
        # «Scenario: AC-001-01 — …» (con su bloque) o un elemento de lista que empieza por el id (tareas: «- [ ] TASK-…»)
        lineas = texto.splitlines()
        cabecera_tabla = ""
        for n, l in enumerate(lineas, 1):
            st = l.strip()
            if st.startswith("|") and n < len(lineas) and re.match(r"^\|[\s:|-]+\|$", lineas[n].strip() if n < len(lineas) else ""):
                cabecera_tabla = st
            m = re.match(r"^\|\s*\**(" + ID.pattern + r")\b", st)
            if m and m.group(1) not in defs:
                defs[m.group(1)] = {"titulo": _celdas(st)[1] if len(_celdas(st)) > 1 else m.group(1), "donde": f"{rel}:{n}",
                                    "texto": (cabecera_tabla + "\n" + "|" + "---|" * max(1, cabecera_tabla.count("|") - 1) + "\n" if cabecera_tabla else "") + st}
                continue
            m = re.match(r"^\s*(?:Scenario(?: Outline)?|Escenario):\s*(" + ID.pattern + r")\b(.*)$", st)
            if m and m.group(1) not in defs:
                bloque = [l]
                for x in lineas[n:]:
                    if re.match(r"^\s*(?:Scenario|Escenario|Feature|#)", x):
                        break
                    bloque.append(x)
                defs[m.group(1)] = {"titulo": m.group(2).strip(" —-:"), "donde": f"{rel}:{n}", "texto": "\n".join(bloque).strip()}
                continue
            m = re.match(r"^\s*[-*]\s+(?:\[[ xX!]\]\s+)?\**(" + ID.pattern + r")\b\**\s*[:—-]?\s*(.*)$", l)
            if m and m.group(1) not in defs:
                bloque = [l]
                for x in lineas[n:]:
                    if not x.strip() or re.match(r"^\s*[-*]\s+(?:\[[ xX!]\]\s+)?\**(?:" + "|".join(PREFIJOS) + r")-", x) or CABECERA.match(x):
                        break
                    bloque.append(x)
                defs[m.group(1)] = {"titulo": m.group(2).strip()[:120], "donde": f"{rel}:{n}", "texto": "\n".join(bloque).strip()}
        seccion = ""
        for n, l in enumerate(texto.splitlines(), 1):
            c = CABECERA.match(l)
            if c:
                seccion = c.group(2).strip()
            for i in set(ID.findall(l)):
                citas[i].append({"donde": f"{rel}:{n}", "seccion": seccion, "doc": rel})
    for d in CODIGO:
        for f in (repo / d).rglob("*") if (repo / d).is_dir() else []:
            if f.is_file() and f.suffix in (".js", ".ts", ".mjs", ".jsx", ".tsx", ".py", ".rb", ".vue", ".svelte", ".html", ".css"):
                rel = str(f.relative_to(repo))
                if "node_modules" in rel:
                    continue
                for n, l in enumerate(_leer(f).splitlines(), 1):
                    for i in set(ID.findall(l)):
                        codigo[i].add(rel)
                    for r, a in re.findall(r"\b(REQ-[A-Z]+-\d+)\s+AC(\d+)\b", l):
                        codigo[f"{r} AC{a}"].add(rel)
    veredictos = {}
    try:
        for r in json.loads(_leer(repo / ".sdd" / "acceptance.json") or "{}").get("requirements", []):
            veredictos[r.get("id")] = r
    except ValueError:
        pass
    capturas = defaultdict(list)
    for f in sorted((repo / "evidencias").glob("FASE-*/*.png")) if (repo / "evidencias").is_dir() else []:
        m = ID.match(f.stem)
        if m:
            capturas[m.group(0)].append(str(f.relative_to(repo)))

    W = repo / ".sdd" / "wiki"
    if W.exists():
        shutil.rmtree(W)
    W.mkdir(parents=True)
    hoy = date.today().isoformat()
    ids = sorted(set(defs) | {i for i in citas if len(citas[i]) > 1}, key=lambda i: (PREFIJOS.index(_pref(i)) if _pref(i) in PREFIJOS else 99, i))
    for i in ids:
        d = defs.get(i)
        por_doc = defaultdict(list)
        for c in citas.get(i, []):
            if d and c["donde"] == d["donde"]:
                continue
            por_doc[c["doc"]].append(c)
        # identificadores que aparecen en la definición: los enlaces de salida
        salida = sorted(set(ID.findall(d["texto"])) - {i}) if d else []
        partes = ["---", f"title: {i}" + (f" — {_limpia(d['titulo'], i)}" if d else ""), f"created: {hoy}", f"updated: {hoy}",
                  f"type: {TIPO.get(_pref(i), 'artefacto')}", f"sources: [{d['donde'] if d else 'sin definición'}]", "---", "",
                  f"# {i}" + (f": {_limpia(d['titulo'], i)}" if d else ""), ""]
        if d:
            t = d["texto"]
            partes += [f"Definido en `{d['donde']}`.", "", t[:MAX_DEF] + (f"\n\n… (sigue en `{d['donde']}`)" if len(t) > MAX_DEF else ""), ""]
        else:
            partes += ["Sin definición propia en los documentos: solo se cita.", ""]
        # lo relacionado, agrupado por tipo: lo que cita esta definición y las definiciones que la citan
        rel = defaultdict(set)
        for j in salida:
            rel[_pref(j)].add(j)
        for cs in por_doc.values():
            for c in cs:
                for j in ID.findall(c["seccion"]) or [k for k, dd in defs.items() if dd["donde"] == f"{c['doc']}:1"]:
                    if j != i:
                        rel[_pref(j)].add(j)
        if rel:
            partes += ["## Relacionados", ""]
            for pref in sorted(rel, key=lambda x: PREFIJOS.index(x) if x in PREFIJOS else 99):
                partes.append(f"- **{TIPO.get(pref, pref)}**: " + " · ".join(f"[[{j}]]" for j in sorted(rel[pref])[:40]))
            partes.append("")
        if por_doc:
            partes += ["## Lo citan", ""]
            for doc, cs in sorted(por_doc.items()):
                otros = sorted({j for c in cs for j in ID.findall(c["seccion"])} - {i})
                partes.append(f"- `{doc}` (líneas {', '.join(c['donde'].rsplit(':', 1)[1] for c in cs[:8])}{'…' if len(cs) > 8 else ''})"
                              + (f" — en {', '.join(f'[[{j}]]' for j in otros[:6])}" if otros else ""))
            partes.append("")
        en_codigo = sorted(codigo.get(i, set()) | {f for k, v in codigo.items() if k.startswith(i + " AC") for f in v})
        if en_codigo:
            partes += ["## En el código y los tests", ""] + [f"- `{f}`" for f in en_codigo[:40]] + [""]
        v = veredictos.get(i)
        if v:
            cr = v.get("criteria")
            if isinstance(cr, list):
                cr = f"{sum(1 for c in cr if isinstance(c, dict) and c.get('state') == 'pass')} de {len(cr)} pasan"
            partes += ["## Veredicto", "", f"{v.get('verdict')} (prioridad {v.get('priority', '?')}; criterios: {cr})", ""]
        if capturas.get(i):
            partes += ["## Capturas", ""] + [f"- `{c}`" for c in capturas[i]] + [""]
        (W / f"{i}.md").write_text("\n".join(partes), encoding="utf-8")
    grupos = defaultdict(list)
    for i in ids:
        grupos[_pref(i)].append(i)
    indice = ["---", "title: Índice de artefactos", f"updated: {hoy}", "type: summary", "---", "",
              "# Índice de artefactos del proyecto", "",
              "Una página por identificador: su definición, quién lo cita, dónde está en el código y los tests y su "
              "veredicto. Generado de los documentos del método antes de cada etapa (no se edita a mano).", ""]
    for p in PREFIJOS:
        if grupos.get(p):
            indice += [f"## {TIPO.get(p, p)} ({len(grupos[p])})", ""]
            indice += [f"- [[{i}]]" + (f" — {_limpia(defs[i]['titulo'], i)}" if i in defs else "") for i in grupos[p]] + [""]
    sup = re.search(r"^##\s+Supuestos\s*$(.*?)(?=^##\s|\Z)", _leer(repo / "requirements" / "REQUIREMENTS.md"), re.M | re.S)
    if sup:
        indice += ["## Supuestos (requirements/REQUIREMENTS.md)", "", sup.group(1).strip(), ""]
    (W / "index.md").write_text("\n".join(indice), encoding="utf-8")
    n_proc = proceso(repo, W, hoy)
    (W / "log.md").write_text(f"# Log\n\n- {hoy}: generada de {len(docs)} documentos: {len(ids)} páginas de artefactos y "
                              f"{n_proc} del proceso\n", encoding="utf-8")
    return {"paginas": len(ids), "documentos": len(docs), "con_definicion": sum(1 for i in ids if i in defs), "proceso": n_proc}


def _jsonl(f: Path) -> list:
    out = []
    for l in _leer(f).splitlines():
        try:
            out.append(json.loads(l))
        except ValueError:
            pass
    return out


def _hora(ts: str) -> str:
    return (ts or "")[:16].replace("T", " ")


def _anadir(f: Path, partes: list) -> None:
    if f.exists():
        f.write_text(_leer(f).rstrip() + "\n\n" + "\n".join(partes) + "\n", encoding="utf-8")


def proceso(repo: Path, W: Path, hoy: str) -> int:
    """Lo que PASA en el proyecto, en la misma wiki: la cronología (etapas y puertas, quién decidió cada una), una página
    por puerta, por pregunta y por impugnación, y la historia de cada FASE y de cada requisito. De las fuentes que ya
    escribe el arnés (etapas.jsonl, puertas.jsonl, las puertas, questions-*.json, decisions.jsonl, challenges.jsonl,
    changes/aplazados.md): nada se copia a mano, todo se enlaza."""
    h = repo / ".sdd" / "hermes"
    etapas, decididas = _jsonl(h / "etapas.jsonl"), _jsonl(h / "puertas.jsonl")
    puertas = {}
    for f in sorted((h / "puertas").glob("g*.json")) if (h / "puertas").is_dir() else []:
        try:
            puertas[f.stem] = json.loads(_leer(f))
        except ValueError:
            pass
    decision = {d.get("puerta"): d for d in decididas}
    decs = _jsonl(repo / "acceptance" / "decisions.jsonl")
    descartes = {d.get("challenge"): d for d in decs if d.get("type") == "challenge-dismissal"}
    retos = [c for c in _jsonl(repo / "acceptance" / "challenges.jsonl") if c.get("id") and c.get("type") in (None, "challenge")]
    resueltas = {c.get("challenge"): c for c in _jsonl(repo / "acceptance" / "challenges.jsonl") if c.get("type") == "resolution"}
    preguntas = []
    for f in sorted((repo / ".sdd").glob("questions-*.json")):
        try:
            preguntas += [q for q in json.loads(_leer(f)).get("preguntas") or [] if q.get("id")]
        except ValueError:
            pass
    n = 0
    quien = lambda d: ("una regla de Jev" if d.get("persona") == "jev" and "regla" in (d.get("resultado") or "")
                       else "Jev" if d.get("persona") == "jev" else "la persona" + (f" ({d['canal']})" if d.get("canal") else ""))
    # cronología
    filas = []
    for e in etapas:
        filas.append((e.get("ts", ""), f"etapa **{e.get('etapa')}**" + (f" FASE-{e['fase']}" if e.get("fase") and str(e.get("fase")).isdigit() else ""),
                      f"{e.get('resultado')} · {e.get('minutos', '?')} min · {round(e.get('coste_usd') or 0, 2)} $"
                      + (f" · {_corta(e.get('resumen') or e.get('motivo') or '', 160)}" if (e.get('resumen') or e.get('motivo')) else "")
                      + (f" → [[{e['puerta']}]]" if e.get("puerta") else "")))
    for d in decididas:
        filas.append((d.get("ts", ""), f"puerta [[{d.get('puerta')}]] ({d.get('tipo')}{' FASE-' + str(d['fase']) if d.get('fase') else ''})",
                      f"**{d.get('verbo')}** por {quien(d)}" + (f" en {d['segundos_hasta_decidir']} s" if d.get("segundos_hasta_decidir") is not None else "")
                      + (f" · «{_corta(d['texto'], 160)}»" if d.get("texto") else "")))
    filas.sort()
    total = sum(e.get("coste_usd") or 0 for e in etapas)
    cuerpo = ["---", "title: Cronología del proyecto", f"updated: {hoy}", "type: summary", "---", "", "# Cronología del proyecto", "",
              f"{len(etapas)} etapas ({round(total, 2)} $), {len(decididas)} puertas decididas: "
              + ", ".join(f"{v} por {k}" for k, v in sorted(_cuenta(quien(d) for d in decididas).items())) + ".", "",
              "| Cuándo (UTC) | Qué | Resultado |", "|---|---|---|"]
    cuerpo += [f"| {_hora(t)} | {q} | {r.replace('|', '/')} |" for t, q, r in filas]
    (W / "proceso.md").write_text("\n".join(cuerpo) + "\n", encoding="utf-8"); n += 1
    # una página por puerta
    for gid, p in puertas.items():
        d = decision.get(gid) or {}
        partes = ["---", f"title: Puerta {gid} — {p.get('titulo', '')}", f"updated: {hoy}", "type: puerta", "---", "",
                  f"# Puerta {p.get('titulo', gid)}", "", f"Tipo {p.get('tipo')}" + (f", [[FASE-{p['fase']}]]" if p.get("fase") else "")
                  + f"; abierta {_hora(p.get('creada', ''))}" + (" · **bloqueada**" if p.get("bloqueo") else ""), ""]
        if d:
            partes += [f"**Decidida:** {d.get('verbo')} por {quien(d)} ({_hora(d.get('ts', ''))})" + (f": «{d['texto']}»" if d.get("texto") else ""),
                       "", f"Resultado: {d.get('resultado', '')}", ""]
        else:
            partes += ["**Sin decidir todavía.**", ""]
        qs = p.get("preguntas") or []
        if qs:
            partes += ["## Preguntas", ""] + [f"- [[{q.get('id')}]] (recomendada {q.get('recomendada')})" for q in qs] + [""]
        partes += ["## Lo que vio la persona", "", _corta(p.get("texto") or "", 4000), ""]
        (W / f"{gid}.md").write_text("\n".join(partes), encoding="utf-8"); n += 1
    # una página por pregunta
    for q in preguntas:
        r = q.get("respuesta") or {}
        ops = q.get("opciones") or []
        partes = ["---", f"title: {q['id']}", f"updated: {hoy}", "type: pregunta", f"tags: [{q.get('tema', '')}]", "---", "",
                  f"# {q['id']} ({q.get('estado')})", "", f"**Para el cliente:** {q.get('para_cliente', '')}", "",
                  f"**Detalle técnico:** {q.get('pregunta', '')}", "", f"**Contexto:** {q.get('contexto', '')}", "", "## Opciones", ""]
        partes += [f"- **{o.get('letra')}**{' ⭐' if o.get('recomendada') else ''} {o.get('cliente') or o.get('texto', '')} (efecto: {o.get('efecto')})" for o in ops]
        partes += ["", f"**Respuesta:** {r.get('letra')} — {r.get('como', '')} {r.get('quien', '')} ({r.get('fecha', '')})" if r else "**Sin responder.**", ""]
        (W / f"{q['id']}.md").write_text("\n".join(partes), encoding="utf-8"); n += 1
    # una página por impugnación
    for c in retos:
        destino = (f"descartada por {descartes[c['id']].get('by')}: «{descartes[c['id']].get('reason', '')}»" if c["id"] in descartes
                   else "resuelta" + (f": {resueltas[c['id']].get('reason', '')}" if resueltas[c['id']].get("reason") else "") if c["id"] in resueltas
                   else "sin descartar (atendida o abierta: mira la puerta de su FASE)")
        partes = ["---", f"title: {c['id']}", f"updated: {hoy}", "type: impugnación", f"tags: [{c.get('category', '')}]", "---", "",
                  f"# {c['id']} sobre [[{c.get('req')}]] AC{c.get('ac')} ({c.get('category')})", "",
                  f"**Por qué:** {c.get('why', '')}", "", f"**Cita:** «{c.get('quote', '')}»", "",
                  "**Evidencia:** " + ", ".join(f"`{e.get('path')}:{e.get('line')}`" for e in c.get("evidence") or [] if isinstance(e, dict)), "",
                  f"**Destino:** {destino}", ""]
        (W / f"{c['id']}.md").write_text("\n".join(partes), encoding="utf-8"); n += 1
    # historia de cada FASE y de cada requisito
    for fn in sorted({str(e.get("fase")) for e in etapas if str(e.get("fase") or "").isdigit()}):
        hist = [f"- {_hora(e.get('ts', ''))} etapa {e.get('etapa')}: {e.get('resultado')}, {e.get('minutos')} min, {round(e.get('coste_usd') or 0, 2)} $"
                for e in etapas if str(e.get("fase")) == fn]
        hist += [f"- {_hora(d.get('ts', ''))} puerta [[{d.get('puerta')}]]: **{d.get('verbo')}** por {quien(d)}" + (f": «{_corta(d['texto'], 200)}»" if d.get("texto") else "")
                 for d in decididas if str(d.get("fase")) == fn]
        _anadir(W / f"FASE-{fn}.md", ["## Historia de la FASE", ""] + sorted(hist))
    for req in {c.get("req") for c in retos} | {r for q in preguntas for r in ID.findall(f"{q.get('contexto', '')} {q.get('pregunta', '')}") if r.startswith("REQ-")}:
        hist = [f"- impugnación [[{c['id']}]] AC{c.get('ac')} ({c.get('category')})" for c in retos if c.get("req") == req]
        hist += [f"- pregunta [[{q['id']}]] ({q.get('estado')})" for q in preguntas if req in f"{q.get('contexto', '')} {q.get('pregunta', '')}"]
        _anadir(W / f"{req}.md", ["## Historia", ""] + hist)
    ind = W / "index.md"
    _anadir(ind, ["## Proceso", "", "- [[proceso]] — cronología: etapas, puertas y quién decidió cada una",
                  f"- Puertas ({len(puertas)}): " + " · ".join(f"[[{g}]]" for g in sorted(puertas)),
                  f"- Preguntas ({len(preguntas)}): " + " · ".join(f"[[{q['id']}]]" for q in preguntas),
                  f"- Impugnaciones ({len(retos)}): " + " · ".join(f"[[{c['id']}]]" for c in retos)])
    return n


def _cuenta(it) -> dict:
    out = {}
    for x in it:
        out[x] = out.get(x, 0) + 1
    return out


def _corta(t: str, n: int) -> str:
    t = " ".join(str(t).split())
    return t if len(t) <= n else t[:n - 1] + "…"


def _celdas(fila: str) -> list:
    return [c.strip(" *") for c in fila.strip().strip("|").split("|")]


def _limpia(titulo: str, i: str) -> str:
    return re.sub(r"^\W*" + re.escape(i) + r"\W*", "", titulo).strip() or titulo


def ver(repo: Path, i: str) -> str:
    f = Path(repo) / ".sdd" / "wiki" / f"{i}.md"
    return _leer(f) if f.exists() else ""


def buscar(repo: Path, texto: str) -> list:
    out = []
    for l in _leer(Path(repo) / ".sdd" / "wiki" / "index.md").splitlines():
        if l.startswith("- [[") and texto.lower() in l.lower():
            out.append(l[2:])
    return out


if __name__ == "__main__":
    a = sys.argv[1:]
    if a[:1] == ["construir"] and len(a) == 2:
        print(json.dumps(construir(Path(a[1])), ensure_ascii=False)); sys.exit(0)
    if a[:1] == ["ver"] and len(a) == 3:
        t = ver(Path(a[1]), a[2]); print(t or f"{a[2]}: no hay página (¿id mal escrito? mira .sdd/wiki/index.md)"); sys.exit(0 if t else 1)
    if a[:1] == ["buscar"] and len(a) == 3:
        print("\n".join(buscar(Path(a[1]), a[2]))); sys.exit(0)
    print(__doc__, file=sys.stderr); sys.exit(2)
