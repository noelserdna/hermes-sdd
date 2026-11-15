"""hermes-sdd · operación: los textos y acciones que comparten las órdenes y el vigía. Estado de cada proyecto, quién
escribe la orden, el tema del encargado, la revisión de mantenimiento, el resumen periódico y reenviar las puertas
abiertas.

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga y lo de otras
partes se llama por ``P``.
"""
from __future__ import annotations

import json
import os
import time
from datetime import datetime
from pathlib import Path

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, PR, log = P.N, P.PR, P.log
HOME = N.HOME
PATH_CMDS = P.PATH_CMDS
_leer = N.leer

__all__ = ["_resumen_proyecto", "_estado_texto", "_autorizado_en_sesion", "_tema_encargado", "_mantenimiento",
           "_resumen_periodico", "_republicar_abiertas"]


# ── proyectos y estado ──────────────────────────────────────────────────────────────────────────────────────────
async def _resumen_proyecto(board: str, repo: str) -> str:
    e = PR.estado(repo, board, await P._tarjetas(board))   # la misma foto que `hsdd_proyectos.py estado` y el encargado
    lineas = [f"📁 {board}" + (" ⏸ en pausa" if e["pausado"] else "")]
    if e["puertas"]:
        lineas.append(f"  🚪 Esperando tu decisión: {', '.join(p['titulo'] or '' for p in e['puertas'])}")
    if e["trabajando"]:
        lineas.append(f"  ▶ Trabajando en: {e['trabajando']}")
    if e["paradas"]:
        lineas.append(f"  ⚠️ Parado en: {', '.join(t['titulo'] or '' for t in e['paradas'])}")
    if e["aparcadas"]:
        lineas.append(f"  ⏳ {P._plural(e['aparcadas'], 'paso espera', 'pasos esperan')} a que se renueve la cuota de Claude")
    if not (e["puertas"] or e["trabajando"] or e["paradas"] or e["aparcadas"]):
        lineas.append("  ✅ Entregado" if e["entregado"] else "  💤 Sin nada en marcha")
    lineas.append(f"  {P._plural(e['pasos_hechos'], 'paso hecho', 'pasos hechos')} · {e['coste_usd']} $ gastados")
    if e.get("resultado"):
        lineas.append(f"  📊 {e['resultado']}")
    return "\n".join(lineas)


async def _estado_texto(filtro: str = "") -> str:
    proys = await P._proyectos()
    if filtro:
        proys = {b: r for b, r in proys.items() if b == filtro}
    if not proys:
        return f"No conozco ningún proyecto llamado «{filtro}»." if filtro else "Todavía no hay proyectos. Crea uno con /nuevo."
    partes = [await _resumen_proyecto(b, r) for b, r in sorted(proys.items())]
    lat = _leer(HOME / "latido.json", {}) or {}
    cuota = _leer(HOME / "cuota.json")
    pie = "💓 Todo conectado" if lat.get("ts") else "⚠️ El gateway no da señales: no se registrarán decisiones hasta que vuelva"
    if cuota:
        hora = datetime.fromtimestamp(cuota['reset_at']).strftime('%H:%M')
        pie += (f"\n⛔ Claude no tiene sesión (entra con /login en Claude Code): se reintenta a las {hora}"
                if cuota.get("motivo") == "sesion" else f"\n⛔ Se ha agotado la cuota de Claude: se sigue a las {hora}")
    return "\n\n".join(partes) + "\n\n" + pie


# ── órdenes: quién escribe y el tema del encargado ──────────────────────────────────────────────────────────────
def _autorizado_en_sesion():
    """Persona que escribe el comando (Telegram), o None."""
    try:
        from gateway.session_context import get_session_env
        uid = get_session_env("HERMES_SESSION_USER_ID") or ""
    except Exception:
        uid = ""
    return (P._persona_de(uid)[0], uid) if uid else (None, "")


async def _tema_encargado(nombre: str, repo: str, uid: str, bienvenida: str = "") -> str:
    """Tema «🧭 nombre» en el chat privado con el bot, enlazado con el encargado del proyecto (profile_routes por chat y
    tema; encargado.sh tema). El gateway carga la ruta al arrancar: se reinicia solo, desde fuera de su proceso."""
    bot = P._RT.app.bot
    try:
        tema = await bot.create_forum_topic(chat_id=int(uid), name=f"🧭 {nombre}")
    except Exception as e:
        return (f"No pude crear el tema: {e}. Activa los temas del bot en @BotFather (Mini App → My bots → el bot → "
                "Bot Settings → Threads Settings → Threaded Mode) y pídelo con /encargado " + nombre)
    hilo = tema.message_thread_id
    try:
        await P._cli("bash", str(P._root() / "encargado.sh"), "tema", repo, str(uid), str(hilo))
    except Exception as e:
        return f"Creé el tema pero no pude enlazarlo con el encargado: {e}"
    await bot.send_message(chat_id=int(uid), message_thread_id=hilo, text=bienvenida or (
        f"🧭 Aquí hablas con el encargado de «{nombre}»: sabe en qué punto está el proyecto, consulta requisitos, "
        "plan y código, discute arquitectura, diseño y UX contigo y recuerda en su wiki. No decide puertas: esas "
        "siguen llegando al chat principal.") + "\n(Estará listo en un minuto: se reinicia el gateway para enlazar el tema.)")
    import subprocess as _sp
    _sp.Popen(["bash", "-c", "sleep 8; hermes gateway restart >/dev/null 2>&1"], start_new_session=True,
              env={**os.environ, "PATH": PATH_CMDS}, stdout=_sp.DEVNULL, stderr=_sp.DEVNULL)
    return f"Tema «🧭 {nombre}» creado: en un minuto, lo que escribas allí lo lee su encargado."


# ── mantenimiento, resumen periódico y puertas abiertas ─────────────────────────────────────────────────────────
async def _mantenimiento(proyectos: dict) -> list[str]:
    """Revisión por umbrales (vigilar.sh) de los proyectos ya entregados. Si algo cruza un umbral se abre una puerta
    de mantenimiento, que el bucle publica como cualquier otra; aquí no se decide nada."""
    res = []
    for b, repo in sorted(proyectos.items()):
        if (HOME / "pausa" / b).exists() or (HOME / "pausa" / "_todo").exists():
            res.append(f"{b}: en pausa"); continue
        if not (Path(repo) / ".git").exists():
            continue
        tags = await P._cli("git", "-C", repo, "tag", "-l", "entrega-*")
        if not tags.strip():
            res.append(f"{b}: aún sin entrega"); continue
        try:
            out = await P._cli("bash", str(P._root() / "vigilar.sh"), repo, timeout=1200)
            ultima = out.strip().splitlines()[-1] if out.strip() else ""
            res.append(f"{b}: " + ("🛠 puerta de mantenimiento abierta" if ultima.startswith("g") else ultima))
        except Exception as e:
            res.append(f"{b}: la revisión falló ({e})")
    log.info("hermes-sdd: mantenimiento: %s", "; ".join(res))
    return res


async def _resumen_periodico() -> str:
    """Resumen sin LLM: estado de cada proyecto, decisiones de las últimas 12 h y la métrica de aprobación por inercia."""
    partes = ["🗞 Así van tus proyectos", await _estado_texto()]
    desde = time.time() - 12 * 3600
    decisiones = []
    for b, repo in (await P._proyectos()).items():
        j = Path(repo) / "status" / "journal.jsonl"
        for linea in (j.read_text().splitlines() if j.exists() else []):
            try:
                e = json.loads(linea)
                if e.get("kind") in ("decision", "feedback") and \
                   datetime.fromisoformat(e["at"].replace("Z", "+00:00")).timestamp() >= desde:
                    decisiones.append(f"  · {b}: {e.get('text', '')[:120]}")
            except Exception:
                pass
    if decisiones:
        partes.append("Decisiones de las últimas 12 horas:\n" + "\n".join(decisiones[-10:]))
    # Aprobación por inercia: aceptaciones muy rápidas tras ver la demo, en los últimos 7 días
    semana = time.time() - 7 * 86400
    firmadas = [p for p in (_leer(f) for f in (HOME / "puertas").glob("*.json"))
                if p and p.get("estado") == "firmada" and p.get("tipo") in ("fase", "entrega")
                and (p.get("firmar_en") or 0) >= semana and (p.get("decision") or {}).get("verbo") in ("acepto", "revisado")]
    dwell = sorted((p["decision"].get("dwell_s") or 0) for p in firmadas if p.get("decision"))
    if dwell:
        med = dwell[len(dwell) // 2]
        aviso = "\n⚠️ Estás aceptando muy deprisa: mira las demos con más calma." if len(dwell) >= 3 and med < 20 else ""
        partes.append(f"Esta semana aceptaste {P._plural(len(dwell), 'fase', 'fases')}; normalmente mirando la demo {med} s antes de decidir.{aviso}")
    return "\n\n".join(partes)

def _republicar_abiertas() -> str:
    """/puertas: las abiertas pierden su mensaje de Telegram y el bucle las vuelve a publicar con sus botones."""
    # Cada una se reescribe bajo el cerrojo y solo si SIGUE abierta: antes se leían todas, se quitaba «telegram» y
    # se reescribían enteras sin cerrojo, y una decisión que entraba entre medias se pisaba (el índice volvía a
    # «abierta» con la decisión ya escrita en el repo).
    def sin_telegram(p):
        if not p or p.get("estado") != "abierta":
            return None
        p.pop("telegram", None)   # el bucle la vuelve a publicar con sus botones
        return p
    todas = [(f, N.actualizar(f, sin_telegram)) for f in sorted((HOME / "puertas").glob("*.json"))]
    abiertas = [p for _, p in todas if p and p.get("estado") == "abierta"]
    # una puerta con el JSON roto no se puede enseñar, pero tampoco se calla: la persona sabe que hay algo
    rotas = [f.stem for f, p in todas if p is None]
    nota = (f"\n⚠️ {P._plural(len(rotas), 'puerta no se puede leer', 'puertas no se pueden leer')} "
            f"({', '.join(rotas)}): mira gateway.log.") if rotas else ""
    if not abiertas:
        return "No tienes nada pendiente de decidir." + nota
    return f"Tienes {P._plural(len(abiertas), 'decisión pendiente', 'decisiones pendientes')}: te las reenvío con sus botones." + nota
