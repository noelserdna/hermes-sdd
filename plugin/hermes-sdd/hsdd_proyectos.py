"""Proyectos nuevos y configuración del arnés (carpeta por defecto y stacks), comunes a todos los canales.

Un proyecto nuevo es siempre lo mismo, venga de la pestaña SDD, de /nuevo en Telegram o de nuevo.sh: una carpeta con
git, `AGENTS.md` con el Stack Profile del stack elegido y la petición literal en `intent/INT-001.md`; después
`lanzar.sh iniciar`, que crea el tablero del kanban y la primera tarjeta (requisitos). Crear un proyecto no decide
nada: lo primero que llega es la puerta de requisitos.

Configuración en $HERMES_SDD_HOME/sdd.json (nunca en un repo): {"carpeta", "stack_defecto", "stacks": [...]}.
"""
from __future__ import annotations

import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import date
from pathlib import Path

if "hsdd_nucleo" not in sys.modules:
    _spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).with_name("hsdd_nucleo.py"))
    _mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod); sys.modules["hsdd_nucleo"] = _mod
N = sys.modules["hsdd_nucleo"]
Rechazo = N.Rechazo

CARPETA_DEFECTO = "~/proyectos-sdd"
CAMPOS_STACK = ("id", "nombre", "descripcion", "stack", "test", "test_file", "code_paths", "test_paths", "server", "port")
STACKS_DEFECTO = [
    {"id": "web-vite", "nombre": "Web con Vite (JavaScript)",
     "descripcion": "Web estática o de una página en JavaScript, servida con Vite y probada con Vitest.",
     "stack": "JavaScript (ES modules) + Vite + Vitest", "test": "npm test", "test_file": "npx vitest run {file}",
     "code_paths": "src/", "test_paths": "tests/", "server": "npx vite --host 127.0.0.1 --port 5173", "port": "5173"},
    {"id": "web-astro", "nombre": "Web con Astro",
     "descripcion": "Web de contenido (páginas, guías, turismo…) con Astro y TypeScript; pruebas con Vitest.",
     "stack": "Astro + TypeScript + Vitest", "test": "npm test", "test_file": "npx vitest run {file}",
     "code_paths": "src/", "test_paths": "tests/", "server": "npx astro dev --host 127.0.0.1 --port 4321", "port": "4321"},
    {"id": "node-ts", "nombre": "CLI o servicio Node + TypeScript",
     "descripcion": "Herramienta de terminal o API en Node.js con TypeScript; pruebas con Vitest.",
     "stack": "Node.js + TypeScript + Vitest", "test": "npm test", "test_file": "npx vitest run {file}",
     "code_paths": "src/", "test_paths": "tests/", "server": "", "port": ""},
    {"id": "python", "nombre": "Python",
     "descripcion": "Script, CLI o servicio en Python 3; pruebas con pytest.",
     "stack": "Python 3 + pytest", "test": "python3 -m pytest -q", "test_file": "python3 -m pytest -q {file}",
     "code_paths": "src/", "test_paths": "tests/", "server": "", "port": ""},
]
# ── modelos por etapa ─────────────────────────────────────────────────────────────────────────────────────────────
# Se guardan como alias (fable, opus, sonnet, haiku: siempre el último de cada familia) o como nombre completo. Para el
# ejecutor de Hermes (la ruta) un alias se traduce al id de OpenRouter más reciente que Hermes conoce.
ETAPAS_MODELO = [("requisitos", "Requisitos"), ("ruta", "Ruta"),
                 ("especificar", "Especificaciones"), ("auditar", "Auditoría de especificaciones"),
                 ("pruebas", "Plan de pruebas"), ("seguridad", "Revisión de seguridad"), ("tecnico", "Diseño técnico"),
                 ("ux", "Diseño visual y de uso"), ("plan", "Plan"), ("tareas", "Tareas"),
                 ("huecos", "Completar huecos del plan"), ("implementar", "Implementar"), ("aceptar", "Aceptar"),
                 ("brechas", "Huecos entre especificación y código"),
                 ("cierre", "Cierre y entrega"), ("cambio", "Cambio de requisitos"), ("adoptar", "Adoptar un repo")]
# juicio del contrato: donde más rinde un modelo grande
_PIENSAN = ("requisitos", "especificar", "auditar", "seguridad", "tecnico", "plan", "cambio", "adoptar")
PERFILES = {
    "calidad": {e: ("sonnet" if e == "ruta" else "opus") for e, _ in ETAPAS_MODELO},
    "equilibrado": {e: ("opus" if e in _PIENSAN else "sonnet") for e, _ in ETAPAS_MODELO},
    "rapido": {e: "sonnet" for e, _ in ETAPAS_MODELO},
}
NOMBRE_PERFIL = {"calidad": "Calidad: Opus en todo", "equilibrado": "Equilibrado: Opus planifica, Sonnet programa",
                 "rapido": "Rápido: Sonnet en todo"}
PERFIL_DEFECTO = "equilibrado"
ALIAS = {"fable": "Fable (el más reciente de Claude)", "opus": "Opus", "sonnet": "Sonnet", "haiku": "Haiku (no para juicios)"}
OPENROUTER_DEFECTO = {"fable": "anthropic/claude-fable-5.2", "opus": "anthropic/claude-opus-5.5",
                      "sonnet": "anthropic/claude-sonnet-5.5", "haiku": "anthropic/claude-haiku-5.5"}


def _version(mid: str) -> tuple:
    return tuple(int(x) for x in re.findall(r"\d+", mid.rsplit("-", 1)[-1]))


def modelos_openrouter() -> dict:
    """{familia: [ids de OpenRouter, del más nuevo al más viejo]} según la caché de modelos de Hermes."""
    try:
        texto = (Path.home() / ".hermes" / "models_dev_cache.json").read_text(errors="replace")
    except OSError:
        texto = ""
    fam: dict = {}
    for mid in sorted(set(re.findall(r'"(anthropic/claude-(fable|opus|sonnet|haiku)-[0-9][0-9.]*)"', texto))):
        fam.setdefault(mid[1], []).append(mid[0])
    return {f: sorted(ids, key=_version, reverse=True) for f, ids in fam.items()}


def modelos_disponibles() -> list:
    """Opciones para elegir: los alias de Claude Code y, por familia, los dos ids más recientes que conoce Hermes."""
    ops = [{"id": a, "nombre": n, "tipo": "alias"} for a, n in ALIAS.items()]
    for f, ids in modelos_openrouter().items():
        ops += [{"id": i, "nombre": i.split("/", 1)[1], "tipo": "completo"} for i in ids[:2]]
    return ops


def modelos_efectivos(cfg: dict | None = None) -> dict:
    """{etapa: modelo} del perfil elegido, con los cambios de etapa por encima."""
    cfg = cfg if cfg is not None else (N.leer(N.HOME / "sdd.json", {}) or {})
    perfil = cfg.get("perfil_modelos") if cfg.get("perfil_modelos") in PERFILES else PERFIL_DEFECTO
    return {**PERFILES[perfil], **{e: m for e, m in (cfg.get("modelos") or {}).items() if m}}


def modelo_para(etapa: str, ejecutor: str = "claude") -> str:
    """Modelo global de una etapa, en el formato de su ejecutor ("" = el de por defecto del ejecutor)."""
    m = modelos_efectivos().get(etapa, "")
    if ejecutor == "hermes":
        if m in ALIAS:
            ids = modelos_openrouter().get(m)
            return ids[0] if ids else OPENROUTER_DEFECTO[m]
        return m if "/" in m else ""
    if ejecutor == "claude":
        return m.split("/", 1)[1].replace(".", "-") if m.startswith("anthropic/") else m
    return ""


# ── rutas ───────────────────────────────────────────────────────────────────────────────────────────────────────────
# Una ruta es qué etapas opcionales del método se hacen. «auto» = las que proponga `sdd route` para ESTE proyecto
# (la ruta adaptativa). En la puerta de ruta se ofrecen todas como botones; la recomendada es la fijada al crear el
# proyecto o, si no, la de por defecto. Elige quien decida la puerta (una persona o Jev).
OPCIONALES_RUTA = [("specifications-engineer", "especificaciones"), ("spec-auditor", "auditoría de especificaciones"),
                   ("test-planner", "plan de pruebas"), ("security-auditor", "revisión de seguridad"),
                   ("tech-designer", "diseño técnico"), ("ux-designer", "diseño visual y de uso"),
                   ("gap-detector", "huecos entre especificación y código")]
# Granularidad del plan: cuántas fases y lo gruesas que son las tareas. «auto»: compacta si el proyecto es pequeño.
GRANULARIDADES = [("auto", "Según el tamaño del proyecto"), ("compacta", "Compacta: una fase y pocas tareas"),
                  ("normal", "Normal: una fase por recorrido"), ("fina", "Fina: fases y tareas pequeñas")]
RUTAS_DEFECTO = [
    {"id": "adaptativa", "nombre": "Adaptativa", "etapas": "auto", "granularidad": "auto",
     "descripcion": "El método elige las etapas según cómo es el proyecto (tamaño, datos sensibles, pantallas, integraciones…)."},
    {"id": "ligera", "nombre": "Ligera", "etapas": [], "granularidad": "compacta",
     "descripcion": "Solo lo esencial: requisitos, plan, programación y aceptación. Para prototipos y proyectos pequeños."},
    {"id": "con-diseno", "nombre": "Con diseño", "etapas": ["tech-designer", "ux-designer"], "granularidad": "normal",
     "descripcion": "Lo esencial más el diseño visual y de uso y el diseño técnico. Para apps con pantallas cuidadas."},
    {"id": "completa", "nombre": "Completa", "etapas": [k for k, _ in OPCIONALES_RUTA], "granularidad": "fina",
     "descripcion": "Todas las etapas del método: especificaciones, auditoría, plan de pruebas, seguridad, diseño y huecos. "
                    "Más lenta y más cara; para proyectos serios o de un cliente externo."},
]
RUTA_DEFECTO = "adaptativa"
GRAN_EN = {"auto": "compact when the project is small, normal otherwise", "compacta": "compact (one FASE, few coarse tasks)",
           "normal": "normal (one FASE per user journey)", "fina": "fine (small FASEs and tasks)"}


def _ruta_valida(r: dict) -> dict:
    if not isinstance(r, dict):
        raise Rechazo("Cada ruta es un objeto con sus campos")
    rid = str(r.get("id") or "").strip()
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", rid):
        raise Rechazo(f"Id de ruta no válido: «{rid}» (minúsculas, números y guiones)")
    nombre = " ".join(str(r.get("nombre") or "").split())
    if not nombre:
        raise Rechazo(f"La ruta {rid} necesita un nombre")
    etapas = r.get("etapas")
    if etapas != "auto":
        validas = [k for k, _ in OPCIONALES_RUTA]
        if not isinstance(etapas, list) or any(e not in validas for e in etapas):
            raise Rechazo(f"Las etapas de la ruta {rid} son «auto» o una lista de: {', '.join(validas)}")
        etapas = [k for k in validas if k in etapas]
    gran = r.get("granularidad") or "auto"
    if gran not in dict(GRANULARIDADES):
        raise Rechazo(f"La granularidad de la ruta {rid} es una de: {', '.join(dict(GRANULARIDADES))}")
    return {"id": rid, "nombre": nombre[:40], "descripcion": " ".join(str(r.get("descripcion") or "").split())[:300],
            "etapas": etapas, "granularidad": gran}


def rutas(cfg: dict | None = None) -> list:
    cfg = cfg if cfg is not None else (N.leer(N.HOME / "sdd.json", {}) or {})
    return cfg.get("rutas") or RUTAS_DEFECTO


def ruta_de(tablero: str, cfg: dict | None = None) -> str:
    """La ruta recomendada para un proyecto: la que se fijó al crearlo o, si no, la de por defecto."""
    cfg = cfg if cfg is not None else (N.leer(N.HOME / "sdd.json", {}) or {})
    ids = [r["id"] for r in rutas(cfg)]
    for rid in ((cfg.get("rutas_proyecto") or {}).get(tablero), cfg.get("ruta_defecto"), RUTA_DEFECTO):
        if rid in ids:
            return rid
    return ids[0]


def opciones_ruta(tablero: str, propuesta: dict | None = None) -> list:
    """Los botones de la puerta de ruta: una opción por ruta (la recomendada primero), cada una con las etapas que
    hará (para «auto», las de la propuesta del método) y un criterio para Jev."""
    cfg = N.leer(N.HOME / "sdd.json", {}) or {}
    rec = ruta_de(tablero, cfg)
    fijada = (cfg.get("rutas_proyecto") or {}).get(tablero) == rec
    nombres = dict(OPCIONALES_RUTA)
    auto = [k for k, e in ((propuesta or {}).get("stages") or {}).items() if e.get("run") and k in nombres]
    ops = []
    for r in sorted(rutas(cfg), key=lambda r: r["id"] != rec):
        etapas = auto if r["etapas"] == "auto" else list(r["etapas"])
        hace = ", ".join(nombres[k] for k in etapas) or "ninguna etapa extra"
        gran = r.get("granularidad") or "auto"
        criterio = (f"Use the route «{r['nombre']}» ({r['descripcion']}). Extra stages it runs besides the core "
                    f"(requirements, plan, tasks, implementation, acceptance): {', '.join(etapas) or 'none'}. "
                    f"Plan granularity: {GRAN_EN[gran]}.")
        if r["id"] == rec:
            criterio += (" The customer fixed this route when creating the project: choose it unless the requirements "
                         "clearly need more rigor." if fijada else " This is the recommended route.")
        ops.append({"verbo": f"ruta-{r['id']}", "etiqueta": ("⭐ " if r["id"] == rec else "🧭 ") + r["nombre"],
                    "nombre": r["nombre"], "descripcion": r["descripcion"], "etapas": etapas, "auto": r["etapas"] == "auto",
                    "hace": hace, "granularidad": gran, "fases": dict(GRANULARIDADES)[gran], "recomendada": r["id"] == rec, "fijada": fijada and r["id"] == rec, "criterio": criterio})
    return ops


GITIGNORE = "node_modules/\ndist/\n.astro/\n__pycache__/\n.venv/\n.DS_Store\nwiki/\n"   # wiki/: el del encargado (repo propio)
RESERVADOS = {"default", "todo", "local"}


# ── configuración ─────────────────────────────────────────────────────────────────────────────────────────────────
def config() -> dict:
    cfg = N.leer(N.HOME / "sdd.json", {}) or {}
    stacks = cfg.get("stacks") or STACKS_DEFECTO
    defecto = cfg.get("stack_defecto") if any(s["id"] == cfg.get("stack_defecto") for s in stacks) else stacks[0]["id"]
    carpeta = cfg.get("carpeta") or CARPETA_DEFECTO
    return {"carpeta": carpeta, "carpeta_resuelta": str(Path(carpeta).expanduser()), "carpeta_por_defecto": CARPETA_DEFECTO,
            "stack_defecto": defecto, "stacks": stacks, "deshacer_s": N.deshacer_s(),
            "deshacer_rango": [N.DESHACER_MIN_S, N.DESHACER_MAX_S], "deshacer_por_defecto": N.DESHACER_DEFECTO_S,
            "deshacer_jev_s": N.deshacer_jev_s(), "deshacer_jev_por_defecto": N.DESHACER_JEV_DEFECTO_S,
            "perfil_modelos": cfg.get("perfil_modelos") if cfg.get("perfil_modelos") in PERFILES else PERFIL_DEFECTO,
            "modelos_cambiados": {e: m for e, m in (cfg.get("modelos") or {}).items() if m},
            "modelos": modelos_efectivos(cfg), "perfiles": PERFILES, "nombres_perfil": NOMBRE_PERFIL,
            "etapas_modelo": ETAPAS_MODELO, "modelos_disponibles": modelos_disponibles(),
            "rutas": rutas(cfg), "ruta_defecto": ruta_de("", {**cfg, "rutas_proyecto": {}}),
            "rutas_proyecto": cfg.get("rutas_proyecto") or {}, "etapas_ruta": OPCIONALES_RUTA, "granularidades": GRANULARIDADES,
            "rutas_por_defecto": RUTAS_DEFECTO}


def _stack_valido(s: dict) -> dict:
    if not isinstance(s, dict):
        raise Rechazo("Cada stack es un objeto con sus campos")
    s = {k: str(s.get(k) or "").strip() for k in CAMPOS_STACK}
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,30}", s["id"]):
        raise Rechazo(f"Id de stack no válido: «{s['id']}» (minúsculas, números y guiones)")
    for k, nombre in (("nombre", "un nombre"), ("stack", "la descripción del stack"), ("test", "el comando de los tests")):
        if not s[k]:
            raise Rechazo(f"El stack {s['id']} necesita {nombre}")
    if s["test_file"] and "{file}" not in s["test_file"]:
        raise Rechazo(f"En el stack {s['id']}, el comando para un fichero de test debe llevar {{file}}")
    if s["port"] and not s["port"].isdigit():
        raise Rechazo(f"En el stack {s['id']}, el puerto debe ser un número")
    if any("\n" in v for v in s.values()):
        raise Rechazo(f"En el stack {s['id']}, cada campo va en una sola línea")
    return s


REVISION_IA_TIPOS = ("requisitos", "ruta", "plan", "fase", "entrega")


def guardar_config(carpeta: str | None = None, stack_defecto: str | None = None, stacks: list | None = None,
                   deshacer_s=None, perfil_modelos: str | None = None, modelos: dict | None = None,
                   deshacer_jev_s=None, rutas_cfg: list | None = None, ruta_defecto: str | None = None,
                   revision_ia: list | None = None) -> dict:
    """Cambia lo que venga (lo demás se queda como está). Valida antes de escribir nada."""
    actual = N.leer(N.HOME / "sdd.json", {}) or {}
    nuevo = dict(actual)
    if revision_ia is not None:   # puertas con revisor independiente con IA (encargado, fase 4; cuesta en cada puerta)
        malos = [t for t in revision_ia if t not in REVISION_IA_TIPOS]
        if malos:
            raise Rechazo(f"Tipos de puerta desconocidos para la revisión con IA: {', '.join(malos)} "
                          f"(valen: {', '.join(REVISION_IA_TIPOS)})")
        nuevo["revision_ia"] = list(dict.fromkeys(revision_ia))
    if carpeta is not None:
        carpeta = carpeta.strip()
        if carpeta and not Path(carpeta).expanduser().is_absolute():
            raise Rechazo("La carpeta debe ser una ruta completa (/Users/…, ~/…)")
        nuevo["carpeta"] = carpeta or CARPETA_DEFECTO
    if stacks is not None:
        if not isinstance(stacks, list) or not stacks:
            raise Rechazo("Tiene que quedar al menos un stack")
        validos = [_stack_valido(s) for s in stacks]
        ids = [s["id"] for s in validos]
        if len(set(ids)) != len(ids):
            raise Rechazo("Hay dos stacks con el mismo id")
        nuevo["stacks"] = validos
    if stack_defecto is not None:
        if not any(s["id"] == stack_defecto for s in (nuevo.get("stacks") or STACKS_DEFECTO)):
            raise Rechazo(f"No hay ningún stack {stack_defecto}")
        nuevo["stack_defecto"] = stack_defecto
    for clave, valor, quien in (("deshacer_s", deshacer_s, "tus decisiones"), ("deshacer_jev_s", deshacer_jev_s, "las de Jev")):
        if valor is None:
            continue
        try:
            s = int(str(valor).strip())
        except ValueError:
            raise Rechazo(f"La ventana para deshacer {quien} es un número de segundos")
        if not N.DESHACER_MIN_S <= s <= N.DESHACER_MAX_S:
            raise Rechazo(f"La ventana para deshacer {quien} va de {N.DESHACER_MIN_S} s a {N.DESHACER_MAX_S} s (un día)")
        nuevo[clave] = s
    if perfil_modelos is not None:
        if perfil_modelos not in PERFILES:
            raise Rechazo(f"Perfil de modelos desconocido: {perfil_modelos}. Perfiles: {', '.join(PERFILES)}")
        nuevo["perfil_modelos"] = perfil_modelos
        if modelos is None:
            nuevo["modelos"] = {}   # elegir un perfil deja todas las etapas como dice el perfil
    if modelos is not None:
        etapas = {e for e, _ in ETAPAS_MODELO}
        if not isinstance(modelos, dict) or any(e not in etapas for e in modelos):
            raise Rechazo(f"Etapas: {', '.join(sorted(etapas))}")
        for e, m in modelos.items():
            if m and not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9._/:-]{1,80}", str(m)):
                raise Rechazo(f"Nombre de modelo no válido para {e}: «{m}»")
        nuevo["modelos"] = {e: str(m) for e, m in modelos.items() if m}
    if rutas_cfg is not None:
        if not isinstance(rutas_cfg, list) or not rutas_cfg:
            raise Rechazo("Tiene que quedar al menos una ruta")
        validas = [_ruta_valida(r) for r in rutas_cfg]
        ids = [r["id"] for r in validas]
        if len(set(ids)) != len(ids):
            raise Rechazo("Hay dos rutas con el mismo id")
        nuevo["rutas"] = validas
        if nuevo.get("ruta_defecto") not in ids:
            nuevo.pop("ruta_defecto", None)
    if ruta_defecto is not None:
        if ruta_defecto not in [r["id"] for r in rutas(nuevo)]:
            raise Rechazo(f"No hay ninguna ruta {ruta_defecto}")
        nuevo["ruta_defecto"] = ruta_defecto
    (N.HOME).mkdir(parents=True, exist_ok=True)
    N.escribir(N.HOME / "sdd.json", nuevo)
    return config()


# ── proyecto nuevo ────────────────────────────────────────────────────────────────────────────────────────────────
def slug(nombre: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", _sin_tildes(nombre).lower()).strip("-")
    return s


def _sin_tildes(t: str) -> str:
    import unicodedata
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")


def agents_md(nombre: str, s: dict, que: str) -> str:
    resumen = " ".join(que.split())
    resumen = resumen if len(resumen) <= 300 else resumen[:297] + "…"
    perfil = [f"- stack: {s['stack']}", f"- test: {s['test']}"]
    perfil += [f"- test_file: {s['test_file']}"] if s.get("test_file") else []
    perfil += [f"- code_paths: {s.get('code_paths') or 'src/'}", f"- test_paths: {s.get('test_paths') or 'tests/'}",
               "- task_state: trailers", "- test_slots: 1"]
    perfil += [f"- server: {s['server']}"] if s.get("server") else []
    perfil += [f"- port: {s['port']}"] if s.get("port") else []
    return (f"# Instrucciones para agentes\n\n{nombre}: {resumen}\n"
            f"Stack elegido al crear el proyecto: {s['nombre']} ({s['stack']}). No lo cambies sin un requisito que lo pida.\n\n"
            "## SDD Stack Profile\n" + "\n".join(perfil) + "\n\n"
            "## Convenciones\n- Código y textos de la interfaz en español (o el idioma del proyecto).\n"
            "- Cualquier cambio de comportamiento lleva su test.\n")


def intent_md(que: str) -> str:
    citado = "\n".join("> " + l if l.strip() else ">" for l in que.strip().splitlines())
    return f"# INT-001\n\nPetición literal ({date.today().isoformat()}), al crear el proyecto:\n\n{citado}\n"


def _raiz_arnes() -> Path:
    raiz = (N.leer(N.HOME / "instalacion.json", {}) or {}).get("root")
    return Path(raiz) if raiz else Path(__file__).resolve().parent.parent.parent


def entorno() -> dict:
    """PATH con hermes, node, git y jq aunque el proceso (panel, gateway) arranque con un PATH mínimo."""
    dirs = [f"{Path.home()}/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
    for cmd in ("hermes", "node", "git", "jq"):
        p = shutil.which(cmd)
        if p and str(Path(p).parent) not in dirs:
            dirs.insert(0, str(Path(p).parent))
    return {**os.environ, "PATH": ":".join(dirs), "HERMES_SDD_HOME": str(N.HOME)}


def _tableros(env: dict) -> list:
    try:
        r = subprocess.run(["hermes", "kanban", "boards", "list", "--json"], capture_output=True, text=True, timeout=60, env=env)
        return [b.get("slug") for b in json.loads(r.stdout or "[]")]
    except Exception:
        return []


def nuevo_proyecto(nombre: str, que: str, stack: str | None = None, carpeta: str | None = None,
                   jev: str | None = None, lanzar: bool = True, ruta: str | None = None, preparar: bool = False) -> dict:
    """Crea la carpeta, el primer commit y lanza el proyecto. Devuelve {tablero, repo, stack, salida}.
    `preparar`: no lo lanza; deja el repo y el tablero listos y crea su encargado, que recoge la entrada (preguntas,
    documentos, requisitos casi listos) y lo lanza cuando la persona lo diga (docs/encargado.md, fase 2).
    Lanza Rechazo (con un mensaje para la persona) si algo no procede; no deja nada a medias si falla antes de git."""
    cfg = config()
    nombre, que = (nombre or "").strip(), (que or "").strip()
    tablero = slug(nombre)
    if not 2 <= len(tablero) <= 40:
        raise Rechazo("El nombre debe tener entre 2 y 40 letras o números")
    if tablero in RESERVADOS:
        raise Rechazo(f"«{tablero}» es un nombre reservado; elige otro")
    if len(que) < 20:
        raise Rechazo("Cuenta un poco más qué quieres construir (al menos una frase)")
    st = next((s for s in cfg["stacks"] if s["id"] == (stack or cfg["stack_defecto"])), None)
    if not st:
        raise Rechazo(f"No hay ningún stack {stack}")
    if jev and jev not in N.MODOS:
        raise Rechazo(f"Modo de Jev desconocido: {jev}")
    if ruta and ruta not in [r["id"] for r in cfg["rutas"]]:
        raise Rechazo(f"No hay ninguna ruta {ruta}")
    base = Path((carpeta or "").strip() or cfg["carpeta"]).expanduser()
    if not base.is_absolute():
        raise Rechazo("La carpeta debe ser una ruta completa (/Users/…, ~/…)")
    repo = base / tablero
    if repo.exists() and any(repo.iterdir()):
        raise Rechazo(f"Ya existe {repo} y no está vacía. Si es un proyecto sin el método, adóptalo: "
                      f"lanzar.sh adoptar {repo}")
    env = entorno()
    if (lanzar or preparar) and tablero in _tableros(env):
        raise Rechazo(f"Ya hay un tablero {tablero} en el kanban; elige otro nombre")
    if not shutil.which("git", path=env["PATH"]):
        raise Rechazo("No encuentro git")

    def git(*a):
        r = subprocess.run(["git", "-C", str(repo), *a], capture_output=True, text=True, env=env)
        if r.returncode != 0:
            raise Rechazo(f"git {a[0]} falló: {(r.stderr or r.stdout).strip()[-300:]}")
        return r.stdout

    repo.mkdir(parents=True, exist_ok=True)
    git("init", "-q", "-b", "main")
    (repo / "AGENTS.md").write_text(agents_md(nombre, st, que))
    (repo / "intent").mkdir(exist_ok=True)
    (repo / "intent" / "INT-001.md").write_text(intent_md(que))
    (repo / ".gitignore").write_text(GITIGNORE)
    git("add", "-A")
    git("commit", "-q", "-m", f"chore: proyecto {tablero} (stack {st['id']}) con la petición inicial")
    if jev:
        N.poner_modo(jev, tablero)
    if ruta:   # la ruta fijada al crear el proyecto: será la recomendada en su puerta de ruta
        sdd = N.leer(N.HOME / "sdd.json", {}) or {}
        sdd["rutas_proyecto"] = {**(sdd.get("rutas_proyecto") or {}), tablero: ruta}
        N.escribir(N.HOME / "sdd.json", sdd)
    salida = ""
    if preparar:
        for orden in (["lanzar.sh", "preparar"], ["encargado.sh", "crear"]):
            r = subprocess.run(["bash", str(_raiz_arnes() / orden[0]), orden[1], str(repo)],
                               capture_output=True, text=True, timeout=300, env=env)
            if r.returncode != 0:
                raise Rechazo(f"El proyecto quedó creado en {repo}, pero falló {orden[0]} {orden[1]}: "
                              f"{(r.stderr or r.stdout).strip()[-300:]}")
            salida += r.stdout.strip() + "\n"
        return {"tablero": tablero, "repo": str(repo), "stack": st["id"], "jev": N.modo_jev(tablero),
                "ruta": ruta_de(tablero), "salida": salida.strip(), "preparando": True, "encargado": f"sdd-p-{tablero}"}
    if lanzar:
        r = subprocess.run(["bash", str(_raiz_arnes() / "lanzar.sh"), "iniciar", str(repo)],
                           capture_output=True, text=True, timeout=300, env=env)
        if r.returncode != 0:
            raise Rechazo(f"El proyecto quedó creado en {repo}, pero no se pudo lanzar: "
                          f"{(r.stderr or r.stdout).strip()[-300:]}. Reinténtalo con: lanzar.sh iniciar {repo}")
        salida = r.stdout.strip()
    return {"tablero": tablero, "repo": str(repo), "stack": st["id"], "jev": N.modo_jev(tablero),
            "ruta": ruta_de(tablero), "salida": salida}



# ── estado de un proyecto (lo leen /estado, el panel y el encargado) ────────────────────────────────────────────────
def _jsonl_cola(f: Path, n: int) -> list:
    try:
        lineas = f.read_text().splitlines()[-n:]
    except OSError:
        return []
    out = []
    for l in lineas:
        try:
            out.append(json.loads(l))
        except ValueError:
            pass
    return out


def estado(repo: str, tablero: str | None = None, tarjetas: list | None = None) -> dict:
    """Foto del proyecto sin LLM: qué hace, dónde está parado, qué espera de una persona, fases, coste y lo último que
    pasó (etapas.jsonl, puertas.jsonl). `tarjetas`: las del kanban si ya se tienen (si no, se piden)."""
    r = Path(repo)
    tablero = tablero or slug(r.name)
    if tarjetas is None:
        try:
            out = subprocess.run(["hermes", "kanban", "--board", tablero, "list", "--json"], capture_output=True,
                                 text=True, timeout=60).stdout
            datos = json.loads(out or "[]")
            tarjetas = datos if isinstance(datos, list) else datos.get("tasks", [])
        except Exception:
            tarjetas = []
    ts = tarjetas
    activa = next((t for t in ts if t.get("status") == "running"), None)
    # una tarjeta parada deja de contar si después se creó otra con el mismo nombre (el paso se relanzó)
    paradas = [t for t in ts if t.get("assignee") == "sdd-estacion" and t.get("status") in ("blocked", "triage")
               and not any(o.get("title") == t.get("title") and (o.get("created_at") or 0) > (t.get("created_at") or 0) for o in ts)]
    puertas = [p for p in (N.leer(f) for f in (N.HOME / "puertas").glob("*.json"))
               if p and p.get("tablero") == tablero and p.get("estado") in ("abierta", "decidida")]
    candado = None
    lock = r / ".sdd" / "hermes" / "lock"
    if lock.is_dir():
        pid = (lock / "pid").read_text().strip() if (lock / "pid").exists() else ""
        vivo = False
        if pid.isdigit():
            try:
                os.kill(int(pid), 0); vivo = True
            except OSError:
                pass
        candado = {"run": (lock / "run").read_text().strip() if (lock / "run").exists() else None, "vivo": vivo}
    def git(*a):
        return subprocess.run(["git", "-C", str(r), *a], capture_output=True, text=True).stdout.strip()
    tags = git("tag", "-l").split()
    fases = []
    for f in sorted((r / "plan" / "fases").glob("FASE-*.md")):
        m = re.match(r"FASE-0*(\d+)", f.name)
        if m:
            fases.append({"n": int(m.group(1)), "aceptada": f"fase-{m.group(1)}-accepted" in tags})
    coste = 0.0
    for f in (r / ".sdd" / "hermes" / "runs").glob("*.json"):
        coste += float((N.leer(f, {}) or {}).get("total_cost_usd") or 0)
    req = sorted((t for t in tags if t.startswith("requirements-v")), key=lambda t: [int(x) for x in re.findall(r"\d+", t)])
    return {
        "proyecto": tablero, "repo": str(r),
        "pausado": (N.HOME / "pausa" / tablero).exists() or (N.HOME / "pausa" / "_todo").exists(),
        "preparando": (r / ".sdd" / "hermes" / "preparando").exists(),
        "trabajando": activa.get("title") if activa else None,
        "candado": candado,
        "paradas": [{"tarjeta": t["id"], "titulo": t.get("title"), "motivo": t.get("last_failure_error") or t.get("result")} for t in paradas],
        "aparcadas": sum(1 for t in ts if t.get("status") == "scheduled"),
        "puertas": [{"id": p.get("id"), "titulo": p.get("titulo"), "tipo": p.get("tipo"), "estado": p.get("estado"),
                     "bloqueada": bool(p.get("bloqueo")), "preguntas": len(p.get("preguntas") or [])} for p in puertas],
        "pasos_hechos": sum(1 for t in ts if t.get("status") == "done"),
        "entregado": any(t.startswith("entrega-") for t in tags),
        "requisitos": req[-1] if req else None,
        "fases": fases,
        "coste_usd": round(coste, 2),
        "ultimas_etapas": _jsonl_cola(r / ".sdd" / "hermes" / "etapas.jsonl", 5),
        "ultimas_puertas": _jsonl_cola(r / ".sdd" / "hermes" / "puertas.jsonl", 5),
    }




# ── vigía del encargado (fase 3): qué hay que mirar, sin LLM ──────────────────────────────────────────────────────────
ESPERA_PUERTA_H = (4, 24)       # una puerta abierta más de esto se menciona (en tramos: la salida no cambia cada tick)
FIRMA_RETRASO_S = 600           # decidida y sin firmar 10 min después de su hora
LENTA_MIN, LENTA_X = 30, 2      # en marcha más de 30 min y más del doble de su mediana


def _etapa_de(t: dict) -> tuple:
    """(etapa, fase) de una tarjeta de etapa («Ejecuta: bash …/etapa.sh <repo> <etapa> [fase]»)."""
    m = re.search(r"etapa\.sh\s+\S+\s+(\S+)(?:\s+(\S+))?", t.get("body") or "")
    return (m.group(1), m.group(2)) if m else ("", None)


def vigia(repo: str, tablero: str | None = None, tarjetas: list | None = None, ahora: float | None = None) -> list:
    """Lo que el encargado debería mirar ahora, una línea estable por asunto (sin horas: el cron en modo monitor solo
    despierta al modelo si la salida cambia). Vacía si todo va bien. Cada línea: «TIPO | asunto | detalle»."""
    import statistics, time as _t
    ahora = ahora or _t.time()
    e = estado(repo, tablero, tarjetas)
    tab = e["proyecto"]
    out = []
    for t in e["paradas"]:
        motivo = re.sub(r"\s+", " ", (t.get("motivo") or "").strip())[:160]
        out.append(f"PARADA | {t['titulo']} ({t['tarjeta']}) | {motivo or 'sin motivo'}")
    for p in (N.leer(f) for f in sorted((N.HOME / "puertas").glob("*.json"))):
        if not p or p.get("tablero") != tab:
            continue
        if p.get("estado") == "error":
            out.append(f"PUERTA CON ERROR | {p.get('titulo')} ({p.get('id')}) | {(p.get('error') or '')[:160]}")
        elif p.get("estado") == "decidida" and ahora > (p.get("firmar_en") or ahora) + FIRMA_RETRASO_S:
            out.append(f"DECIDIDA SIN FIRMAR | {p.get('titulo')} ({p.get('id')}) | el notario no la ha firmado")
        elif p.get("estado") == "abierta":
            desde = _ts(p.get("publicada") or p.get("creada"))
            h = (ahora - desde) / 3600 if desde else 0
            tramo = next((x for x in reversed(ESPERA_PUERTA_H) if h >= x), None)
            if tramo:
                out.append(f"PUERTA ESPERANDO | {p.get('titulo')} ({p.get('id')}) | más de {tramo} h sin decidir")
    hechas = {}
    for x in _jsonl_cola(Path(repo) / ".sdd" / "hermes" / "etapas.jsonl", 500):
        if x.get("resultado") == "done" and x.get("minutos") is not None:
            hechas.setdefault(x.get("etapa"), []).append(x["minutos"])
    for t in (tarjetas if tarjetas is not None else []):
        if t.get("status") != "running" or not t.get("started_at"):
            continue
        etapa, _ = _etapa_de(t)
        mins = (ahora - t["started_at"]) / 60
        med = statistics.median(hechas[etapa]) if len(hechas.get(etapa, [])) >= 2 else None
        if mins > LENTA_MIN and med and mins > LENTA_X * max(med, 1):
            out.append(f"LENTA | {t.get('title')} ({t['id']}) | más del doble de lo normal ({round(med)} min)")
    c = e.get("candado")
    if c and not c.get("vivo") and not any(t.get("status") == "running" for t in (tarjetas or [])):
        out.append(f"CANDADO HUÉRFANO | {c.get('run')} | la ejecución murió sin liberar el candado")
    sucio = subprocess.run(["git", "-C", repo, "status", "--porcelain"], capture_output=True, text=True).stdout.strip()
    if sucio and not (c and c.get("vivo")) and not any(t.get("status") == "running" for t in (tarjetas or [])):
        n = len(sucio.splitlines())
        out.append(f"RESTOS SIN COMMIT | {n} fichero(s) | sin ninguna etapa en marcha")
    return out

# ── el encargado del proyecto (docs/encargado.md) ──────────────────────────────────────────────────────────────────
def modelo_encargado(cfg: dict | None = None) -> str:
    """Modelo del encargado en formato de Hermes (OpenRouter): `encargado_modelo` de sdd.json (alias o id), Sonnet por
    defecto: conversa de arquitectura y producto, no es un trabajo para Haiku."""
    cfg = cfg if cfg is not None else (N.leer(N.HOME / "sdd.json", {}) or {})
    m = cfg.get("encargado_modelo") or "sonnet"
    if m in OPENROUTER_DEFECTO:
        return (modelos_openrouter().get(m) or [OPENROUTER_DEFECTO[m]])[0]
    return m


def _ts(t) -> float:
    """Segundos de una marca ISO en UTC (las de etapas.jsonl y puertas.jsonl); 0 si no se entiende."""
    from datetime import datetime, timezone
    try:
        return datetime.strptime(str(t)[:19], "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc).timestamp()
    except ValueError:
        return 0.0


def foto_encargado(perfil: str, marcar: bool = True) -> str:
    """Lo que el encargado de `perfil` encuentra en su prompt al abrir sesión: la foto del proyecto y lo que pasó desde
    su última sesión (etapas y puertas). Vacío si el perfil no es de un encargado. `marcar`: esta sesión pasa a ser la
    última vista."""
    repo = (N.leer(N.HOME / "encargados.json", {}) or {}).get(perfil)
    if not repo or not Path(repo).is_dir():
        return ""
    import time as _t
    visto_f = N.HOME / "encargados" / f"{perfil}.visto"
    try:
        desde = float(visto_f.read_text().strip())
    except (OSError, ValueError):
        desde = 0.0
    e = estado(repo)
    fs = " ".join(f"FASE-{f['n']}{' ✓' if f['aceptada'] else ''}" for f in e["fases"]) or "sin plan todavía"
    l = [f"# Tu proyecto: {e['proyecto']} ({e['repo']})", "",
         f"- Ahora: {e['trabajando'] or ('ENTREGADO' if e['entregado'] else 'EN PREPARACIÓN: todavía no ha arrancado; recoge la entrada (ver «Preparar la entrada») y lánzalo cuando la persona lo diga' if e.get('preparando') else 'nada en marcha')}"
         + (" · EN PAUSA" if e["pausado"] else ""),
         f"- Requisitos: {e['requisitos'] or 'sin aprobar'} · Fases: {fs} · Coste: {e['coste_usd']} $"]
    for p in e["puertas"]:
        extra = (", bloqueada: solo rechazar" if p["bloqueada"] else "") + (f", {p['preguntas']} pregunta(s)" if p["preguntas"] else "")
        l.append(f"- Puerta esperando a la persona: «{p['titulo']}» ({p['estado']}{extra})")
    for t in e["paradas"]:
        l.append(f"- Parado en «{t['titulo']}»: {(t['motivo'] or '')[:200]}")
    r = Path(repo) / ".sdd" / "hermes"
    nuevas = [x for x in _jsonl_cola(r / "etapas.jsonl", 200) if _ts(x.get("ts")) > desde]
    puertas = [x for x in _jsonl_cola(r / "puertas.jsonl", 200) if _ts(x.get("ts")) > desde]
    if desde:
        from datetime import datetime
        l += ["", f"## Desde tu última sesión ({datetime.fromtimestamp(desde).strftime('%d/%m %H:%M')})"]
        if not (nuevas or puertas):
            l.append("- Nada nuevo.")
    elif nuevas or puertas:
        l += ["", "## Lo último (primera sesión)"]
        nuevas, puertas = nuevas[-8:], puertas[-6:]
    for x in nuevas[-12:]:
        fase = f" FASE-{x['fase']}" if x.get("fase") else ""
        l.append(f"- Etapa {x.get('etapa')}{fase}: {x.get('resultado')}"
                 + (f" — {(x.get('motivo') or '')[:160]}" if x.get("resultado") != "done" else "")
                 + f" ({x.get('minutos', '?')} min, {round(x.get('coste_usd') or 0, 2)} $)")
    for x in puertas[-8:]:
        fase = f" FASE-{x['fase']}" if x.get("fase") else ""
        l.append(f"- Puerta {x.get('tipo')}{fase}: {x.get('verbo')} por {x.get('persona')} ({x.get('canal')})"
                 + (f" — «{x['texto'][:160]}»" if x.get("texto") else ""))
    l += ["", "Tu wiki: wiki/ (lee SCHEMA.md, index.md y el final de log.md antes de escribir)."]
    if marcar:
        visto_f.parent.mkdir(parents=True, exist_ok=True)
        visto_f.write_text(str(_t.time()))
    return "\n".join(l)[:3900]


if __name__ == "__main__":   # CLI de nuevo.sh
    import argparse
    ap = argparse.ArgumentParser(prog="nuevo.sh", description="Crea y lanza un proyecto SDD nuevo")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("nuevo"); n.add_argument("nombre"); n.add_argument("que")
    n.add_argument("--stack"); n.add_argument("--carpeta"); n.add_argument("--jev"); n.add_argument("--ruta"); n.add_argument("--sin-lanzar", action="store_true")
    n.add_argument("--preparar", action="store_true", help="no lanzar: el encargado recoge la entrada y lo lanza")
    c = sub.add_parser("config"); c.add_argument("--carpeta"); c.add_argument("--stack-defecto")
    c.add_argument("--deshacer", metavar="SEGUNDOS")
    c.add_argument("--deshacer-jev", metavar="SEGUNDOS")
    c.add_argument("--revision-ia", metavar="TIPOS", help="puertas con revisor independiente con IA: requisitos,plan,… o «ninguna»")
    sub.add_parser("stacks")
    mo = sub.add_parser("modelo"); mo.add_argument("etapa"); mo.add_argument("ejecutor", nargs="?", default="claude")
    mp = sub.add_parser("modelos"); mp.add_argument("--perfil")
    ru = sub.add_parser("rutas"); ru.add_argument("--defecto")
    op = sub.add_parser("opciones-ruta"); op.add_argument("tablero"); op.add_argument("propuesta", nargs="?")
    es = sub.add_parser("estado"); es.add_argument("repo"); es.add_argument("--json", action="store_true")
    vg = sub.add_parser("vigia"); vg.add_argument("repo")
    sub.add_parser("modelo-encargado")
    fo = sub.add_parser("foto-encargado"); fo.add_argument("perfil"); fo.add_argument("--sin-marcar", action="store_true")
    a = ap.parse_args()
    try:
        if a.cmd == "nuevo":
            r = nuevo_proyecto(a.nombre, a.que, a.stack, a.carpeta, a.jev, lanzar=not (a.sin_lanzar or a.preparar),
                               ruta=a.ruta, preparar=a.preparar)
            print(f"Proyecto {r['tablero']} en {r['repo']} (stack {r['stack']}, Jev {r['jev']}, ruta {r['ruta']})")
            if r["salida"]:
                print(r["salida"])
        elif a.cmd == "config":
            ria = None if a.revision_ia is None else [t for t in a.revision_ia.replace(" ", "").split(",") if t and t != "ninguna"]
            if any(v is not None for v in (a.carpeta, a.stack_defecto, a.deshacer, a.deshacer_jev, ria)):
                guardar_config(carpeta=a.carpeta, stack_defecto=a.stack_defecto, deshacer_s=a.deshacer,
                               deshacer_jev_s=a.deshacer_jev, revision_ia=ria)
            c = config()
            print(f"Carpeta por defecto: {c['carpeta']} ({c['carpeta_resuelta']})\nStack por defecto: {c['stack_defecto']}\n"
                  f"Ventana para deshacer: {c['deshacer_s']} s ({N.duracion(c['deshacer_s'])}); "
                  f"las de Jev: {c['deshacer_jev_s']} s ({N.duracion(c['deshacer_jev_s'])})\n"
                  f"Revisor independiente con IA en las puertas de: {', '.join((N.leer(N.HOME / 'sdd.json', {}) or {}).get('revision_ia') or []) or 'ninguna'}")
        elif a.cmd == "vigia":   # el monitor del cron del encargado: salida estable, vacía si todo va bien
            r = Path(a.repo).resolve()
            try:
                out_k = subprocess.run(["hermes", "kanban", "--board", slug(r.name), "list", "--json"], capture_output=True,
                                       text=True, timeout=60).stdout
                d = json.loads(out_k or "[]"); ts = d if isinstance(d, list) else d.get("tasks", [])
            except Exception:
                ts = []
            for linea in vigia(str(r), None, ts):
                print(linea)
        elif a.cmd == "modelo-encargado":
            print(modelo_encargado())
        elif a.cmd == "foto-encargado":
            print(foto_encargado(a.perfil, marcar=not a.sin_marcar))
        elif a.cmd == "estado":
            e = estado(a.repo)
            if a.json:
                print(json.dumps(e, ensure_ascii=False, indent=1))
            else:
                fs = " ".join(f"{f['n']}{'✓' if f['aceptada'] else '·'}" for f in e["fases"])
                print(f"{e['proyecto']}: {e['trabajando'] or 'sin nada en marcha'} · fases {fs or '-'} · "
                      f"{len(e['puertas'])} puerta(s) · {e['coste_usd']} $" + (" · ENTREGADO" if e["entregado"] else ""))
        elif a.cmd == "modelo":   # lo usa etapa.sh cuando el proyecto no fija el modelo de una etapa
            print(modelo_para(a.etapa, a.ejecutor))
        elif a.cmd == "rutas":
            if a.defecto:
                guardar_config(ruta_defecto=a.defecto)
            c = config(); nombres = dict(OPCIONALES_RUTA)
            for r in c["rutas"]:
                et = "las que proponga el método" if r["etapas"] == "auto" else (", ".join(nombres[k] for k in r["etapas"]) or "solo lo esencial")
                print(f"{'*' if r['id'] == c['ruta_defecto'] else ' '} {r['id']:12} {r['nombre']}: {et}")
        elif a.cmd == "opciones-ruta":   # lo usa puerta.sh: los botones de la puerta de ruta
            prop = N.leer(Path(a.propuesta), {}) if a.propuesta else {}
            print(json.dumps(opciones_ruta(a.tablero, prop), ensure_ascii=False))
        elif a.cmd == "modelos":
            if a.perfil:
                guardar_config(perfil_modelos=a.perfil)
            c = config()
            print(f"Perfil: {c['perfil_modelos']} ({NOMBRE_PERFIL[c['perfil_modelos']]})")
            for e, nombre in ETAPAS_MODELO:
                print(f"  {nombre:28} {c['modelos'][e]}{'  (cambiado)' if e in c['modelos_cambiados'] else ''}")
        else:
            c = config()
            for s in c["stacks"]:
                print(f"{'*' if s['id'] == c['stack_defecto'] else ' '} {s['id']:12} {s['nombre']} — {s['stack']}")
    except Rechazo as e:
        print(e, file=sys.stderr)
        sys.exit(2)
