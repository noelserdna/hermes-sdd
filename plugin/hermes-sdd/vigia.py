"""hermes-sdd · el vigía: lo que el bucle hace cada tanto además de las puertas. Avisar de etapas paradas, reintentar
las que perdió el kanban, etapas sin latido, la cuota de Claude, el mensaje vivo por proyecto, los resúmenes
programados y el mantenimiento diario.

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga y lo de otras
partes (el kanban, Telegram, los textos de operación) se llama por ``P``.
"""
from __future__ import annotations

import asyncio
import json
import os
import re
import time
from datetime import datetime
from pathlib import Path

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, PR, log = P.N, P.PR, P.log
HOME = N.HOME
PATH_CMDS = P.PATH_CMDS
_leer, _escribir, _ahora = N.leer, N.escribir, N.ahora

__all__ = ["_avisar_fallos", "PERDIDO", "REINTENTOS_MAX", "_candado_vivo", "_reintentar_perdidos", "_reintento_reservar",
           "_vigia_etapas", "_vigia", "_mantenimiento_diario"]


# ── etapas paradas y perdidas ───────────────────────────────────────────────────────────────────────────────────
async def _avisar_fallos(bot) -> None:
    avisados = set(_leer(HOME / "avisos.json", []) or [])
    proc = await asyncio.create_subprocess_exec("hermes", "kanban", "boards", "list", "--json",
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                env={**os.environ, "PATH": PATH_CMDS})
    out, _ = await asyncio.wait_for(proc.communicate(), 60)
    nuevos = []
    # Un aviso, no dos: el proyecto con encargado (y su vigía) recibe el diagnóstico de él, en su tema
    con_encargado = {r for pf, r in (_leer(HOME / "encargados.json", {}) or {}).items()
                     if (Path.home() / ".hermes" / "profiles" / pf / "scripts" / "vigia.sh").exists()}
    for b in json.loads(out or b"[]"):
        wd = b.get("default_workdir") or ""
        if not wd or not (Path(wd) / ".sdd" / "hermes").is_dir() or wd in con_encargado:
            continue
        proc = await asyncio.create_subprocess_exec("hermes", "kanban", "--board", b["slug"], "list", "--json",
                                                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                    env={**os.environ, "PATH": PATH_CMDS})
        out, _ = await asyncio.wait_for(proc.communicate(), 60)
        try:
            tareas = json.loads(out or b"[]")
        except Exception:
            continue
        for t in tareas if isinstance(tareas, list) else tareas.get("tasks", []):
            if t.get("assignee") == "sdd-estacion" and t.get("status") in ("blocked", "triage") \
                    and "esperando tus respuestas" not in (t.get("last_failure_error") or ""):
                clave = f"{b['slug']}/{t['id']}/{t.get('status')}"
                if clave not in avisados:
                    nuevos.append(clave)
                    for chat in P._chats():
                        # la lista del kanban no trae latest_summary (solo `show`): el motivo está en el último error o el resultado
                        motivo = P._corta_linea(t.get("last_failure_error") or t.get("latest_summary") or t.get("result") or "")
                        await bot.send_message(chat_id=int(chat), text=(
                            f"⚠️ «{b['slug']}» se ha parado en «{t.get('title')}».\n"
                            + (f"Motivo: {motivo}\n" if motivo else "")
                            + "No sigue solo: hay que revisarlo y relanzar ese paso.\n"
                            f"(Detalle técnico: hermes kanban --board {b['slug']} show {t['id']})"))
    if nuevos:   # con cerrojo y sobre lo que haya ahora en disco: lo leído al empezar puede tener minutos
        N.actualizar(HOME / "avisos.json", lambda a: sorted(set(a or []) | set(nuevos)), [])


# Etapas cuyo worker perdió el kanban (no fallaron ellas): se reintentan solas, como mucho REINTENTOS_MAX veces por
# etapa, FASE y HEAD del repo (si el HEAD no cambia, el mismo fallo no se repite sin fin). Con el candado del repo vivo
# no: la etapa sigue en marcha. lanzar.sh reintentar ya no duplica si hay otra en cola y pasa las hijas a la nueva.
PERDIDO = re.compile(r"managed worker lost|execution unknown|owner silent", re.I)
REINTENTOS_MAX = 2


def _candado_vivo(repo: str) -> bool:
    return N.candado_vivo(repo)   # la misma regla que lib/candado.sh (pid + hora de arranque + edad máxima)


async def _reintentar_perdidos(bot=None) -> list:
    hechos = []
    for b, repo in (await P._proyectos()).items():
        if (HOME / "pausa" / b).exists() or (HOME / "pausa" / "_todo").exists() or _candado_vivo(repo):
            continue
        for t in await P._tarjetas(b):
            if t.get("assignee") != "sdd-estacion" or t.get("status") != "blocked" \
                    or not PERDIDO.search(t.get("last_failure_error") or ""):
                continue
            etapa, fase = PR._etapa_de(t)
            if not etapa:
                continue
            try:
                head = (await P._cli("git", "-C", repo, "rev-parse", "HEAD")).strip()
            except Exception:
                head = ""
            clave = f"{b}|{etapa}|{fase or ''}|{head}"
            vez = _reintento_reservar(clave)
            if not vez:
                continue
            try:
                out = await P._cli("bash", str(P._root() / "lanzar.sh"), "reintentar", repo, etapa, *([fase] if fase else []),
                                 "--de", t["id"], timeout=120)
            except Exception as e:
                log.warning("hermes-sdd: no se pudo reintentar %s/%s: %s", b, t["id"], e)
                _reintento_reservar(clave, -1)   # no llegó a lanzarse: no gasta uno de los REINTENTOS_MAX
                continue
            nueva = out.strip().splitlines()[-1] if out.strip() else "?"
            hechos.append({"tablero": b, "tarjeta": t["id"], "nueva": nueva, "etapa": etapa, "fase": fase, "vez": vez})
            log.info("hermes-sdd: %s: %s se perdió (%s); reintento %d en %s", b, t["id"],
                     P._corta_linea(t.get("last_failure_error") or "", 80), vez, nueva)
            if bot is not None:
                for chat in P._chats():
                    try:
                        await bot.send_message(chat_id=int(chat), disable_notification=True, text=(
                            f"🔁 «{b}»: el kanban perdió el paso «{t.get('title')}» (no falló él); lo repito solo "
                            f"({vez} de {REINTENTOS_MAX})."))
                    except Exception as e:
                        log.debug("hermes-sdd: aviso de reintento: %s", e)
    return hechos


def _reintento_reservar(clave: str, delta: int = 1) -> int:
    """Cuenta un reintento de `clave` (o lo devuelve, con delta -1) bajo el cerrojo y da la vez que es. 0 si ya se
    gastaron los REINTENTOS_MAX. Comprobar y contar es un solo paso: antes el registro se leía al empezar la vuelta y
    se escribía entero al final, y el bucle sin Telegram (su hilo) y el del gateway podían relanzar la misma etapa."""
    hecho = []

    def fn(r):
        r = r or {}
        n = r.get(clave, 0)
        if delta > 0 and n >= REINTENTOS_MAX:
            return None
        r[clave] = max(n + delta, 0)
        hecho.append(r[clave])
        return r

    N.actualizar(HOME / "reintentos.json", fn, {})
    return hecho[0] if hecho else 0


# ── cada minuto: etapas sin latido, cuota, mensaje vivo y resúmenes ─────────────────────────────────────────────
async def _vigia_etapas(bot) -> None:
    """Etapas en marcha sin latido en su repo (hsdd_proyectos.sin_latido): las deja en alertas.json para el panel y
    avisa por Telegram una vez por tarjeta (si sigue igual no se repite; si se recupera y vuelve a callar, sí)."""
    alertas = {}
    for b, repo in (await P._proyectos()).items():
        if (HOME / "pausa" / b).exists() or (HOME / "pausa" / "_todo").exists():
            continue
        lineas = PR.sin_latido(repo, await P._tarjetas(b))
        if lineas:
            alertas[b] = lineas
    _escribir(HOME / "alertas.json", {"ts": _ahora(), "proyectos": alertas})
    avisadas = set(_leer(HOME / "alertas_avisadas.json", []) or [])
    actuales = {f"{b}|{l}" for b, ls in alertas.items() for l in ls}
    if bot is not None:
        for clave in sorted(actuales - avisadas):
            b, linea = clave.split("|", 1)
            partes = [x.strip() for x in linea.split("|")]
            for chat in P._chats():
                try:
                    await bot.send_message(chat_id=int(chat), text=(
                        f"🫥 «{b}»: la etapa «{partes[1] if len(partes) > 1 else ''}» lleva más de "
                        f"{PR.SIN_LATIDO_MIN} min sin dar señales de vida.\n"
                        "Puede estar colgada o esperando algo. Mírala con /estado " + b))
                except Exception as e:
                    log.warning("hermes-sdd: aviso de etapa sin latido: %s", e)
        avisadas = actuales   # se olvida lo que ya se recuperó
    else:
        avisadas &= actuales   # sin Telegram no se avisa: se avisará cuando enganche
    _escribir(HOME / "alertas_avisadas.json", sorted(avisadas))


async def _vigia(bot) -> None:
    """Cada minuto: cuota que ya se reinició, mensaje vivo por proyecto y resúmenes programados."""
    cuota = _leer(HOME / "cuota.json")
    if bot is not None and cuota and cuota.get("motivo") == "sesion" and not cuota.get("avisado"):   # un aviso, no uno por reintento
        for chat in P._chats():
            try:
                await bot.send_message(chat_id=int(chat), text=(
                    "⛔ Claude no tiene sesión: las etapas están aparcadas y se reintentan cada 15 min.\n"
                    "Entra con /login en Claude Code (en esta máquina) y siguen solas."))
            except Exception as e:
                log.warning("hermes-sdd: aviso de sesión: %s", e)
        cuota["avisado"] = True
        _escribir(HOME / "cuota.json", cuota)
    if cuota and time.time() >= cuota.get("reset_at", 0):
        (HOME / "cuota.json").unlink(missing_ok=True)
        proys = await P._proyectos()
        libres = [b for b in proys if not (HOME / "pausa" / b).exists() and not (HOME / "pausa" / "_todo").exists()]
        n = await P._reanudar_aparcadas(libres)
        log.info("hermes-sdd: cuota reiniciada; %d etapa(s) reanudadas", n)
    cfg = P._config()
    try:
        await _vigia_etapas(bot)
    except Exception:
        log.exception("hermes-sdd: vigía de etapas (sigue)")
    if bot is not None and cfg.get("mensaje_vivo"):
        vivos = _leer(HOME / "vivos.json", {}) or {}
        for b, repo in (await P._proyectos()).items():
            texto = "🛰 " + await P._resumen_proyecto(b, repo)
            v = vivos.get(b)
            if v and v.get("texto") == texto:
                continue
            for chat in P._chats():
                try:
                    if v and str(v.get("chat")) == str(chat):
                        await bot.edit_message_text(chat_id=int(chat), message_id=v["msg"], text=texto)
                    else:
                        m = await bot.send_message(chat_id=int(chat), text=texto, disable_notification=True)
                        v = {"chat": m.chat_id, "msg": m.message_id}
                except Exception as e:
                    log.debug("hermes-sdd: mensaje vivo de %s: %s", b, e)
            if v:
                vivos[b] = {**v, "texto": texto}
        _escribir(HOME / "vivos.json", vivos)
    await _mantenimiento_diario()
    hoy = datetime.now().strftime("%Y-%m-%d")
    enviados = _leer(HOME / "resumenes.json", {}) or {}
    for hora in (cfg.get("resumenes", []) if bot is not None else []):
        clave = f"{hoy} {hora}"
        if datetime.now().strftime("%H:%M") >= hora and clave not in enviados:
            texto = await P._resumen_periodico()
            for chat in P._chats():
                await bot.send_message(chat_id=int(chat), text=texto[:4000])
            enviados[clave] = _ahora()
            _escribir(HOME / "resumenes.json", dict(list(enviados.items())[-20:]))


# ── mantenimiento diario ────────────────────────────────────────────────────────────────────────────────────────
async def _mantenimiento_diario() -> None:
    hora = P._config().get("mantenimiento")
    hoy = datetime.now().strftime("%Y-%m-%d")
    hecho = _leer(HOME / "mantenimiento.json", {}) or {}
    if not hora or datetime.now().strftime("%H:%M") < hora or hecho.get("dia") == hoy or P._RT.mant_vivo:
        return
    inicio = _ahora()
    _escribir(HOME / "mantenimiento.json", {"dia": hoy, "inicio": inicio})

    async def _tarea():
        P._RT.mant_vivo = True
        try:
            res = await P._mantenimiento(await P._proyectos())
            _escribir(HOME / "mantenimiento.json", {"dia": hoy, "inicio": inicio, "fin": _ahora(), "resultado": res})
        except Exception:
            log.exception("hermes-sdd: mantenimiento diario")
        finally:
            P._RT.mant_vivo = False
    asyncio.get_running_loop().create_task(_tarea())   # puede tardar (tests de cada proyecto): no bloquea el bucle
