"""hermes-sdd · las órdenes del gateway (/nuevo, /estado, /puertas, /cambio, /jev…). Cada una recibe el texto tras la
orden y devuelve la respuesta; las que cambian algo exigen una persona autorizada (la del mensaje de Telegram).

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga y lo de otras
partes se llama por ``P``. ``register(ctx)`` las registra con la tabla ``ORDENES`` del final.
"""
from __future__ import annotations

import asyncio
import json
import os
from pathlib import Path

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, PR, PL, log = P.N, P.PR, P.PL, P.log
HOME = N.HOME
_leer, _ahora = N.leer, N.ahora

__all__ = ["_cmd_puertas", "_cmd_estado", "_cmd_pausar", "_cmd_reanudar", "_cmd_anular", "_cmd_encargado",
           "_cmd_preparar", "_cmd_lecciones", "_cmd_cambio", "_cmd_mantenimiento", "_cmd_jev", "_cmd_nuevo", "ORDENES"]


def _cmd_puertas(raw_args: str = "") -> str:
    try:
        P._asegurar_bucle()
    except RuntimeError:
        pass
    return P._republicar_abiertas()


async def _cmd_estado(raw_args: str = "") -> str:
    return await P._estado_texto(raw_args.strip())


async def _cmd_pausar(raw_args: str = "") -> str:
    persona, _ = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede pausar."
    args = raw_args.split()
    ahora = "ahora" in args
    objetivo = next((a for a in args if a != "ahora"), "todo")
    (HOME / "pausa").mkdir(parents=True, exist_ok=True)
    (HOME / "pausa" / ("_todo" if objetivo == "todo" else objetivo)).write_text(f"{persona} {_ahora()}\n")
    msg = f"⏸ {'Todo' if objetivo == 'todo' else objetivo} en pausa: no arranca ninguna etapa nueva."
    if ahora:   # botón de pánico: detener la etapa en curso (el supervisor mata a Claude y libera el candado)
        import signal
        parados = 0
        for b, repo in (await P._proyectos()).items():
            if objetivo not in ("todo", b):
                continue
            pid = (Path(repo) / ".sdd" / "hermes" / "lock" / "pid")
            if pid.exists():
                try:
                    os.kill(int(pid.read_text().strip()), signal.SIGTERM); parados += 1
                except Exception:
                    pass
        msg += f" Etapas detenidas ahora: {parados}."
    return msg + " /reanudar para seguir."


async def _cmd_reanudar(raw_args: str = "") -> str:
    persona, _ = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede reanudar."
    objetivo = raw_args.strip() or "todo"
    f = HOME / "pausa" / ("_todo" if objetivo == "todo" else objetivo)
    f.unlink(missing_ok=True)
    boards = list((await P._proyectos()).keys()) if objetivo == "todo" else [objetivo]
    n = await P._reanudar_aparcadas(boards)
    return f"▶ {objetivo} reanudado; {n} etapa(s) vuelven a la cola."


async def _cmd_anular(raw_args: str = "") -> str:
    persona, uid = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede anular una aceptación."
    partes = raw_args.split(maxsplit=2)
    if len(partes) < 3 or not partes[1].isdigit():
        return "Uso: /anular <proyecto> <número de FASE> <motivo>"
    repo = (await P._proyectos()).get(partes[0])
    if not repo:
        return f"No conozco el proyecto {partes[0]}."
    try:
        return await P._cli("bash", str(P._root() / "anular.sh"), repo, partes[1], persona, "telegram", uid, partes[2])
    except Exception as e:
        return f"No se anuló: {e}"


async def _cmd_encargado(raw_args: str = "") -> str:
    """/encargado <proyecto>: crea (si falta) el encargado del proyecto y un tema «🧭 proyecto» en este chat que
    habla con él (profile_routes por chat y tema). Requiere el modo de temas del bot (BotFather → Threaded Mode)."""
    persona, uid = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede crear el encargado de un proyecto."
    proys = await P._proyectos()
    nombre = raw_args.strip()
    encs = _leer(HOME / "encargados.json", {}) or {}
    if not nombre or nombre not in proys:
        lista = ", ".join(f"{b}{' 🧭' if any(r == repo for r in encs.values()) else ''}" for b, repo in sorted(proys.items()))
        return (("" if not nombre else f"No conozco el proyecto «{nombre}».\n") +
                f"Uso: /encargado <proyecto>. Proyectos: {lista or 'ninguno'} (🧭 = ya tiene encargado).")
    repo = proys[nombre]
    try:
        if not any(r == repo for r in encs.values()):
            await P._cli("bash", str(P._root() / "encargado.sh"), "crear", repo, timeout=300)
        rutas = json.loads(await P._cli("hermes", "config", "get", "gateway.profile_routes", "--json") or "[]")
    except Exception as e:
        return f"No se pudo preparar el encargado de {nombre}: {e}"
    if any(r.get("name") == f"encargado-{nombre}" for r in rutas if isinstance(r, dict)):
        return f"El encargado de {nombre} ya tiene su tema «🧭 {nombre}» en este chat: escríbele allí."
    return await P._tema_encargado(nombre, repo, uid)


async def _cmd_preparar(raw_args: str = "") -> str:
    """/preparar <nombre> [stack] <qué quieres construir> — crea el proyecto SIN lanzarlo, con su encargado y su
    tema: allí le das documentos o requisitos casi listos, te pregunta lo que falte y lo lanza cuando digas."""
    persona, uid = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede crear proyectos."
    cfg = PR.config()
    ids = [s["id"] for s in cfg["stacks"]]
    partes = raw_args.split(maxsplit=1)
    if len(partes) < 2:
        return ("Uso: /preparar <nombre> [stack] <qué quieres construir>\n"
                "Crea el proyecto sin lanzarlo y te abre un tema con su encargado: allí le pasas lo que tengas "
                "(documentos, requisitos casi listos, capturas), te pregunta lo que falte y lo lanza cuando le digas «lanza».\n"
                f"Stacks: {', '.join(ids)} (por defecto {cfg['stack_defecto']}).")
    nombre, resto = partes
    stack = None
    primera = resto.split(maxsplit=1)
    if len(primera) == 2 and primera[0] in ids:
        stack, resto = primera
    try:
        r = await asyncio.to_thread(PR.nuevo_proyecto, nombre, resto, stack, None, None, False, None, True)
    except N.Rechazo as e:
        return f"No se creó el proyecto: {e}"
    log.info("hermes-sdd: %s prepara el proyecto %s en %s", persona, r["tablero"], r["repo"])
    tema = await P._tema_encargado(r["tablero"], r["repo"], uid, bienvenida=(
        f"🧭 Soy el encargado de «{r['tablero']}». El proyecto aún no ha arrancado: pásame lo que tengas "
        "(documentos, requisitos casi listos, capturas, enlaces) y te preguntaré lo que falte, con opciones y la "
        "que recomiendo primero. Cuando lo tengamos, dime «lanza» y arranca con todo eso."))
    return (f"🧭 Proyecto {r['tablero']} preparado (sin lanzar)\n📁 {r['repo']}\n🧱 {r['stack']}\n{tema}")


async def _cmd_lecciones(raw_args: str = "") -> str:
    """/lecciones: las lecciones entre proyectos, por estado (las pendientes te llegan con sus botones)."""
    ls = PL._todas()
    if not ls:
        return "Todavía no hay lecciones. Las propone el encargado de un proyecto cuando algo falló y te llegan aquí para confirmarlas."
    for l in ls:   # reenviar con botones las que esperan a una persona
        if l["estado"] in ("propuesta", "revisar"):
            PL.marcar_avisada(l["id"], "")
    orden = ("confirmada", "revisar", "propuesta", "caducada", "descartada")
    filas = [f"{ {'confirmada': '✅', 'revisar': '♻️', 'propuesta': '📝', 'caducada': '⌛', 'descartada': '🗑'}[l['estado']] } "
             f"{l['id']} · {l['etapa']}: {l['regla']}" for e in orden for l in ls if l["estado"] == e]
    return "📚 Lecciones entre proyectos:\n" + "\n".join(filas[:30])


async def _cmd_cambio(raw_args: str = "") -> str:
    persona, _ = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede pedir cambios."
    partes = raw_args.split(maxsplit=1)
    if len(partes) < 2:
        return "Uso: /cambio <proyecto> <qué quieres, en tus palabras>"
    repo = (await P._proyectos()).get(partes[0])
    if not repo:
        return f"No conozco el proyecto {partes[0]}."
    try:
        return await P._cli("bash", str(P._root() / "lanzar.sh"), "cambio", repo, partes[1])
    except Exception as e:
        return f"No se lanzó el cambio: {e}"


async def _cmd_mantenimiento(raw_args: str = "") -> str:
    persona, _ = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede lanzar la revisión."
    proys = await P._proyectos()
    if raw_args.strip():
        proys = {b: r for b, r in proys.items() if b == raw_args.strip()}
        if not proys:
            return f"No conozco el proyecto {raw_args.strip()}."
    return "🔎 Revisión de mantenimiento:\n" + "\n".join(await P._mantenimiento(proys))


async def _cmd_jev(raw_args: str = "") -> str:
    """/jev → modos actuales · /jev <modo> → modo por defecto · /jev <proyecto> <modo> → modo de un proyecto."""
    partes = raw_args.split()
    if partes:
        persona, _ = P._autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede cambiar el modo de Jev."
        try:
            if len(partes) == 1:
                N.poner_modo(partes[0])
            else:
                if partes[0] not in await P._proyectos():
                    return f"No conozco el proyecto {partes[0]}."
                N.poner_modo(partes[1], partes[0])
        except N.Rechazo as e:
            return str(e)
        log.info("hermes-sdd: %s cambia el modo de Jev: %s", persona, raw_args)
    cfg = N.config_jev()
    lineas = [f"🤖 Jev en las puertas (umbral {cfg['umbral']}; en piloto decide: {', '.join(cfg['piloto'])})",
              f"  por defecto: {cfg['defecto']}"]
    lineas += [f"  {b}: {m}" for b, m in sorted((cfg.get("proyectos") or {}).items())]
    lineas.append("Modos: humano · consejo (recomienda) · piloto (decide ruta y plan) · auto (decide todo). "
                  "Uso: /jev <proyecto> <modo>")
    return "\n".join(lineas)


async def _cmd_nuevo(raw_args: str = "") -> str:
    """/nuevo <nombre> [stack] <qué quieres construir> — crea y lanza un proyecto (carpeta y stack por defecto)."""
    persona, _ = P._autorizado_en_sesion()
    if not persona:
        return "Solo una persona autorizada puede crear proyectos."
    cfg = PR.config()
    ids = [s["id"] for s in cfg["stacks"]]
    partes = raw_args.split(maxsplit=1)
    if len(partes) < 2:
        return ("Uso: /nuevo <nombre> [stack] <qué quieres construir>\n"
                f"Stacks: {', '.join(ids)} (por defecto {cfg['stack_defecto']}). Se crea en {cfg['carpeta']}/<nombre>.\n"
                "Ejemplo: /nuevo bogota web-astro Una web para turistas con los barrios de Bogotá y qué ver en cada uno")
    nombre, resto = partes
    stack = None
    primera = resto.split(maxsplit=1)
    if len(primera) == 2 and primera[0] in ids:
        stack, resto = primera
    try:
        r = await asyncio.to_thread(PR.nuevo_proyecto, nombre, resto, stack)
    except N.Rechazo as e:
        return f"No se creó el proyecto: {e}"
    log.info("hermes-sdd: %s crea el proyecto %s en %s", persona, r["tablero"], r["repo"])
    # Cada proyecto con su encargado y su tema «🧭 nombre» desde el principio (antes había que pedirlo con /encargado
    # y el proyecto podía arrancar sin nadie que lo supervisara: club, 13/11/2026)
    enc = ""
    try:
        await P._cli("bash", str(P._root() / "encargado.sh"), "crear", r["repo"], timeout=300)
        _, uid = P._autorizado_en_sesion()
        enc = "\n" + (await P._tema_encargado(r["tablero"], r["repo"], uid) or f"🧭 Su encargado te espera en el tema «🧭 {r['tablero']}».")
    except Exception as e:
        enc = f"\n⚠️ No se pudo crear su encargado ({e}); pídelo con /encargado {r['tablero']}"
    return (f"🚀 Proyecto {r['tablero']} en marcha\n📁 {r['repo']}\n🧱 {r['stack']} · 🤖 Jev {r['jev']}\n"
            "Te llegará la puerta de Requisitos cuando el ejecutor los tenga." + enc)


# (orden, función, descripción, args_hint). args_hint siempre entre [ ]: Hermes deja fuera del menú de Telegram las
# órdenes cuya ayuda empieza por «<» (argumento obligatorio). Sin argumentos, cada orden explica cómo se usa.
ORDENES = (
    ("nuevo", _cmd_nuevo, "Crea y lanza un proyecto", "[nombre] [stack] [qué quieres construir]"),
    ("jev", _cmd_jev, "Modo de Jev en las puertas", "[proyecto] [modo]"),
    ("cambio", _cmd_cambio, "Pide un cambio a un proyecto", "[proyecto] [petición]"),
    ("estado", _cmd_estado, "Estado de los proyectos", "[proyecto]"),
    ("pausar", _cmd_pausar, "Pausa un proyecto (ahora = detener)", "[proyecto|todo] [ahora]"),
    ("reanudar", _cmd_reanudar, "Reanuda un proyecto en pausa", "[proyecto|todo]"),
    ("anular", _cmd_anular, "Anula la aceptación de una FASE", "[proyecto] [fase] [motivo]"),
    ("mantenimiento", _cmd_mantenimiento, "Revisa los proyectos entregados", "[proyecto]"),
    ("puertas", _cmd_puertas, "Decisiones pendientes, con sus botones", None),
    ("preparar", _cmd_preparar, "Prepara un proyecto con su encargado", "[nombre] [stack] [qué quieres construir]"),
    ("lecciones", _cmd_lecciones, "Lecciones entre proyectos", None),
    ("encargado", _cmd_encargado, "Habla con el encargado de un proyecto", "[proyecto]"),
)
