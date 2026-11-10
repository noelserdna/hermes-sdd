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
ETAPAS_MODELO = [("requisitos", "Requisitos"), ("ruta", "Ruta"), ("plan", "Plan"), ("tareas", "Tareas"),
                 ("huecos", "Completar huecos del plan"), ("implementar", "Implementar"), ("aceptar", "Aceptar"),
                 ("cierre", "Cierre y entrega"), ("cambio", "Cambio de requisitos"), ("adoptar", "Adoptar un repo")]
_PIENSAN = ("requisitos", "plan", "cambio", "adoptar")   # juicio del contrato: donde más rinde un modelo grande
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


GITIGNORE = "node_modules/\ndist/\n.astro/\n__pycache__/\n.venv/\n.DS_Store\n"
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
            "etapas_modelo": ETAPAS_MODELO, "modelos_disponibles": modelos_disponibles()}


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


def guardar_config(carpeta: str | None = None, stack_defecto: str | None = None, stacks: list | None = None,
                   deshacer_s=None, perfil_modelos: str | None = None, modelos: dict | None = None,
                   deshacer_jev_s=None) -> dict:
    """Cambia lo que venga (lo demás se queda como está). Valida antes de escribir nada."""
    actual = N.leer(N.HOME / "sdd.json", {}) or {}
    nuevo = dict(actual)
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
                   jev: str | None = None, lanzar: bool = True) -> dict:
    """Crea la carpeta, el primer commit y lanza el proyecto. Devuelve {tablero, repo, stack, salida}.
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
    base = Path((carpeta or "").strip() or cfg["carpeta"]).expanduser()
    if not base.is_absolute():
        raise Rechazo("La carpeta debe ser una ruta completa (/Users/…, ~/…)")
    repo = base / tablero
    if repo.exists() and any(repo.iterdir()):
        raise Rechazo(f"Ya existe {repo} y no está vacía. Si es un proyecto sin el método, adóptalo: "
                      f"lanzar.sh adoptar {repo}")
    env = entorno()
    if lanzar and tablero in _tableros(env):
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
    salida = ""
    if lanzar:
        r = subprocess.run(["bash", str(_raiz_arnes() / "lanzar.sh"), "iniciar", str(repo)],
                           capture_output=True, text=True, timeout=300, env=env)
        if r.returncode != 0:
            raise Rechazo(f"El proyecto quedó creado en {repo}, pero no se pudo lanzar: "
                          f"{(r.stderr or r.stdout).strip()[-300:]}. Reinténtalo con: lanzar.sh iniciar {repo}")
        salida = r.stdout.strip()
    return {"tablero": tablero, "repo": str(repo), "stack": st["id"], "jev": N.modo_jev(tablero), "salida": salida}


if __name__ == "__main__":   # CLI de nuevo.sh
    import argparse
    ap = argparse.ArgumentParser(prog="nuevo.sh", description="Crea y lanza un proyecto SDD nuevo")
    sub = ap.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("nuevo"); n.add_argument("nombre"); n.add_argument("que")
    n.add_argument("--stack"); n.add_argument("--carpeta"); n.add_argument("--jev"); n.add_argument("--sin-lanzar", action="store_true")
    c = sub.add_parser("config"); c.add_argument("--carpeta"); c.add_argument("--stack-defecto")
    c.add_argument("--deshacer", metavar="SEGUNDOS")
    c.add_argument("--deshacer-jev", metavar="SEGUNDOS")
    sub.add_parser("stacks")
    mo = sub.add_parser("modelo"); mo.add_argument("etapa"); mo.add_argument("ejecutor", nargs="?", default="claude")
    mp = sub.add_parser("modelos"); mp.add_argument("--perfil")
    a = ap.parse_args()
    try:
        if a.cmd == "nuevo":
            r = nuevo_proyecto(a.nombre, a.que, a.stack, a.carpeta, a.jev, lanzar=not a.sin_lanzar)
            print(f"Proyecto {r['tablero']} en {r['repo']} (stack {r['stack']}, Jev {r['jev']})")
            if r["salida"]:
                print(r["salida"])
        elif a.cmd == "config":
            if any(v is not None for v in (a.carpeta, a.stack_defecto, a.deshacer, a.deshacer_jev)):
                guardar_config(carpeta=a.carpeta, stack_defecto=a.stack_defecto, deshacer_s=a.deshacer, deshacer_jev_s=a.deshacer_jev)
            c = config()
            print(f"Carpeta por defecto: {c['carpeta']} ({c['carpeta_resuelta']})\nStack por defecto: {c['stack_defecto']}\n"
                  f"Ventana para deshacer: {c['deshacer_s']} s ({N.duracion(c['deshacer_s'])}); "
                  f"las de Jev: {c['deshacer_jev_s']} s ({N.duracion(c['deshacer_jev_s'])})")
        elif a.cmd == "modelo":   # lo usa etapa.sh cuando el proyecto no fija el modelo de una etapa
            print(modelo_para(a.etapa, a.ejecutor))
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
