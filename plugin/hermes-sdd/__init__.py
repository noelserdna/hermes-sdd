"""hermes-sdd — canal Telegram de las puertas del método.

El canal no decide ni firma: (1) publica cada puerta abierta con botones, (2) convierte un toque de una persona
autorizada en una decisión normalizada (fichero en el repo), (3) deja una ventana para deshacer y (4) lanza el
notario (``firmar.sh``), que valida y firma. La identidad sale del update de Telegram (``from.id``), no de un texto.

Estado en disco, compartido con el resto del arnés (``$HERMES_SDD_HOME``, por defecto ``~/.hermes/hermes-sdd``):
  puertas/<id>.json     índice de puertas (lo escribe puerta.sh; aquí se añade ``telegram`` y ``estado``)
  aprobadores.json      personas autorizadas y su id por canal
  instalacion.json      {"root": "<ruta del arnés instalado>"}
  avisos.json           fallos de etapa ya avisados (para avisar una sola vez)
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("hermes_plugins.hermes_sdd")   # este prefijo llega a gateway.log

PATH_CMDS = f"{Path.home()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
_RT: dict = {"app": None, "pendientes": {}}   # pendientes: id del mensaje ForceReply → (puerta, verbo, persona)


# ── núcleo común a los canales (validación, decisión, deshacer y cerrojo entre procesos) ─────────────────────────
def _cargar_nucleo():
    import importlib.util, sys
    if "hsdd_nucleo" not in sys.modules:
        spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).with_name("hsdd_nucleo.py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); sys.modules["hsdd_nucleo"] = mod
    return sys.modules["hsdd_nucleo"]


N = _cargar_nucleo()
HOME = N.HOME
_leer, _escribir, _ahora, _respuestas = N.leer, N.escribir, N.ahora, N.respuestas


def _persona_de(user_id):
    return N.persona_de("telegram", user_id)


def _chats() -> list[str]:
    home = os.environ.get("TELEGRAM_HOME_CHANNEL", "").strip()
    if home:
        return [home]
    return [str(p["canales"]["telegram"]) for p in (_leer(HOME / "aprobadores.json", {}) or {}).values()
            if p.get("canales", {}).get("telegram")]


def _config() -> dict:
    """Presupuesto de atención (atencion.json): horas de silencio y resúmenes."""
    defecto = {"silencio": [22, 8], "resumenes": ["08:30", "19:00"], "mensaje_vivo": True, "mantenimiento": "07:00"}
    return {**defecto, **(_leer(HOME / "atencion.json", {}) or {})}


def _en_silencio() -> bool:
    ini, fin = _config()["silencio"]
    h = datetime.now().hour
    return (h >= ini or h < fin) if ini > fin else (ini <= h < fin)


def _root() -> Path:
    return Path((_leer(HOME / "instalacion.json", {}) or {}).get("root", ""))


# ── mensajes ────────────────────────────────────────────────────────────────────────────────────────────────────
def _teclado(puerta: dict, paso: int = 1):
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    ops = puerta.get("opciones", [])
    escalonada = N.escalonada(puerta)
    if escalonada:
        ops = [o for o in ops if o.get("paso", 1) == paso]
    filas = []
    # Formulario de preguntas abiertas: una fila por pregunta, la opción marcada con ✓ (en el paso de decidir)
    if puerta.get("preguntas") and (not escalonada or paso == 2):
        marcadas = _respuestas(puerta)
        for q in puerta["preguntas"]:
            n = str(q["n"])
            filas.append([B(f"{'✓ ' if marcadas.get(n) == l else ''}Q{n}·{l}", callback_data=f"g:q{n}{l}:{puerta['id']}")
                          for l in q.get("opciones", [])])
    botones = [B(o["etiqueta"], callback_data=f"g:{o['verbo']}:{puerta['id']}") for o in ops]
    filas += [botones[i:i + 2] for i in range(0, len(botones), 2)]
    return M(filas)


def _cabecera(puerta: dict) -> str:
    return f"🚪 {puerta.get('titulo', 'Puerta')} · {puerta.get('tablero', '')}\n"


def _render(puerta: dict):
    """Texto y botones que corresponden al estado de la puerta, venga el cambio del canal que venga."""
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    if puerta.get("estado") == "decidida":
        dec = puerta.get("decision") or {}
        verbo, texto = dec.get("verbo", ""), dec.get("texto", "")
        etiqueta = next((o["etiqueta"] for o in puerta.get("opciones", []) if o["verbo"] == verbo), verbo)
        canal = dec.get("actor", {}).get("canal", "")
        desde = f" (desde {canal})" if canal and canal != "telegram" else ""
        hora = datetime.fromtimestamp(puerta.get("firmar_en", time.time())).strftime("%H:%M")
        return (f"{_cabecera(puerta)}\n{etiqueta} — {dec.get('actor', {}).get('persona', '')}{desde}"
                f"{(': ' + texto) if texto else ''}\n🕒 Se firma a las {hora}",
                M([[B("↩ Deshacer", callback_data=f"g:deshacer:{puerta['id']}")]]))
    paso = N.paso_actual(puerta)
    extra = "\n\n👀 Demo vista. Decide:" if (N.escalonada(puerta) and paso == 2) else ""
    return _cabecera(puerta) + "\n" + puerta.get("texto", "") + extra, _teclado(puerta, paso)


async def _publicar(bot, puerta: dict) -> None:
    texto, teclado = _render(puerta)
    enviados = []
    for chat in _chats():
        m = await bot.send_message(chat_id=int(chat), text=texto[:4000], reply_markup=teclado,
                                   disable_notification=_en_silencio())
        enviados.append({"chat": m.chat_id, "msg": m.message_id})
    puerta["telegram"] = enviados
    puerta["publicada"] = _ahora()
    puerta["tg_vista"] = N.clave_vista(puerta)


async def _editar(bot, puerta: dict, texto: str, teclado=None) -> None:
    for t in puerta.get("telegram", []):
        try:
            await bot.edit_message_text(chat_id=t["chat"], message_id=t["msg"], text=texto[:4000], reply_markup=teclado)
        except Exception as e:  # mensaje igual o borrado: no es grave
            log.debug("hermes-sdd: no se pudo editar %s: %s", t, e)


async def _sincronizar(bot, puerta: dict) -> None:
    """Pone el mensaje de Telegram al día con la puerta (decidida o deshecha aquí o en otro canal)."""
    if not puerta.get("telegram") or puerta.get("estado") not in ("abierta", "decidida"):
        return
    clave = N.clave_vista(puerta)
    if puerta.get("tg_vista") == clave:
        return
    texto, teclado = _render(puerta)
    await _editar(bot, puerta, texto, teclado)
    try:
        N.marcar(puerta["id"], tg_vista=clave)
    except N.Rechazo:
        pass


# ── decisiones ──────────────────────────────────────────────────────────────────────────────────────────────────
async def _decidir(bot, gid: str, verbo: str, texto: str, user, persona: str, prueba: dict) -> str:
    try:
        puerta = N.decidir(gid, verbo, texto, persona, "telegram", str(user.id),
                           {"user": user.username or "", **prueba})
    except N.Rechazo as e:
        return str(e)
    await _sincronizar(bot, puerta)
    return "Decisión registrada; tienes unos minutos para deshacerla"


async def _on_boton(update, context) -> None:
    _asegurar_bucle()
    q = update.callback_query
    _, verbo, gid = (q.data.split(":", 2) + ["", ""])[:3]
    persona, _p = _persona_de(q.from_user.id)
    if not persona:
        await q.answer("No estás autorizado para decidir esta puerta", show_alert=True)
        return
    try:
        puerta = _leer(N.indice(gid))
    except ValueError:
        puerta = None
    if not puerta:
        await q.answer("No conozco esta puerta", show_alert=True)
        return
    bot = context.bot
    if verbo == "deshacer":
        try:
            puerta = N.deshacer(gid, persona)
        except N.Rechazo as e:
            await q.answer(str(e), show_alert=True)
            return
        await q.answer("Deshecho")
        await _sincronizar(bot, puerta)
        return
    if puerta.get("estado") != "abierta":
        await q.answer("Esta puerta ya está resuelta", show_alert=True)
        return
    if verbo.startswith("q") and len(verbo) >= 3:   # marcar una opción del formulario: g:q<n><letra>:<puerta>
        n, letra = verbo[1:-1], verbo[-1]
        try:
            puerta = N.marcar(gid, respuesta=(n, letra))
        except N.Rechazo as e:
            await q.answer(str(e), show_alert=True)
            return
        await q.answer(f"Q{n}: {letra}")
        await _sincronizar(bot, puerta)
        return
    if verbo == "ver":
        await q.answer("Enviando la demo…")
        await _enviar_demo(bot, q.message.chat_id, puerta)
        await _sincronizar(bot, N.marcar(gid, ver_at=puerta.get("ver_at") or time.time()))
        return
    opcion = next((o for o in puerta.get("opciones", []) if o["verbo"] == verbo), None)
    if not opcion:
        await q.answer("Opción no válida", show_alert=True)
        return
    if opcion.get("texto"):
        from telegram import ForceReply
        await q.answer()
        m = await bot.send_message(chat_id=q.message.chat_id,
                                   text=f"{opcion['etiqueta']} — escribe el motivo respondiendo a este mensaje:",
                                   reply_markup=ForceReply(selective=True, input_field_placeholder="Qué falta o qué cambiar…"))
        _RT["pendientes"][m.message_id] = (gid, verbo, persona)
        return
    aviso = await _decidir(bot, gid, verbo, "", q.from_user, persona,
                           {"msg": str(q.message.message_id), "cb": q.id})
    await q.answer(aviso)


async def _on_respuesta(update, context) -> None:
    m = update.message
    gid, verbo, persona = _RT["pendientes"].pop(m.reply_to_message.message_id)
    if _persona_de(m.from_user.id)[0] != persona:
        await m.reply_text("Solo puede responder quien pulsó el botón")
        return
    aviso = await _decidir(context.bot, gid, verbo, m.text.strip(), m.from_user, persona, {"msg": str(m.message_id)})
    await m.reply_text(aviso)


async def _enviar_demo(bot, chat_id: int, puerta: dict) -> None:
    from telegram import InputMediaPhoto
    carpeta = Path(puerta["repo"]) / "evidencias" / f"FASE-{puerta.get('fase', '')}"
    if not carpeta.is_dir():
        await bot.send_message(chat_id=chat_id, text="Esta FASE no tiene capturas ni vídeo en evidencias/.")
        return
    videos = sorted([*carpeta.glob("*.mp4"), *carpeta.glob("*.webm"), *carpeta.glob("*.mov")])
    if videos and videos[0].stat().st_size < 49_000_000:
        with videos[0].open("rb") as f:   # Telegram reproduce mp4; el resto llega como documento
            if videos[0].suffix == ".mp4":
                await bot.send_video(chat_id=chat_id, video=f, caption=f"Demo FASE-{puerta.get('fase')}")
            else:
                await bot.send_document(chat_id=chat_id, document=f, caption=f"Demo FASE-{puerta.get('fase')} ({videos[0].name})")
    fotos = sorted(carpeta.glob("*.png"))[:10]
    if len(fotos) >= 2:
        abiertos = [p.open("rb") for p in fotos]
        try:
            await bot.send_media_group(chat_id=chat_id, media=[InputMediaPhoto(f, caption=p.stem) for f, p in zip(abiertos, fotos)])
        finally:
            for f in abiertos:
                f.close()
    elif fotos:
        with fotos[0].open("rb") as f:
            await bot.send_photo(chat_id=chat_id, photo=f, caption=fotos[0].stem)


# ── bucle: publicar, firmar al acabar la ventana, avisar de fallos ─────────────────────────────────────────────────
async def _firmar(bot, puerta: dict) -> None:
    gid = puerta["id"]
    proc = await asyncio.create_subprocess_exec(
        "bash", str(_root() / "firmar.sh"), puerta["repo"], gid,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "PATH": PATH_CMDS, "HERMES_SDD_HOME": str(HOME)})
    try:
        out, err = await asyncio.wait_for(proc.communicate(), 600)
    except asyncio.TimeoutError:
        proc.kill(); out, err = b"", b"el notario no termino en 10 min"
    idx = HOME / "puertas" / f"{gid}.json"
    with N.cerrojo():
        p = _leer(idx) or puerta
        if proc.returncode == 0:
            p["estado"] = "firmada"; p["resultado"] = out.decode().strip().splitlines()[-1] if out else "firmada"
            texto = f"{_cabecera(p)}\n✅ {p['resultado']}"
        else:
            p["estado"] = "error"; p["error"] = err.decode().strip()[-500:]
            texto = f"{_cabecera(p)}\n⚠️ El notario no firmó: {p['error']}"
        _escribir(idx, p)
    await _editar(bot, p, texto, None)


async def _avisar_fallos(bot) -> None:
    avisados = set(_leer(HOME / "avisos.json", []) or [])
    proc = await asyncio.create_subprocess_exec("hermes", "kanban", "boards", "list", "--json",
                                                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                env={**os.environ, "PATH": PATH_CMDS})
    out, _ = await asyncio.wait_for(proc.communicate(), 60)
    nuevos = []
    for b in json.loads(out or b"[]"):
        wd = b.get("default_workdir") or ""
        if not wd or not (Path(wd) / ".sdd" / "hermes").is_dir():
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
            if t.get("assignee") == "sdd-estacion" and t.get("status") in ("blocked", "triage"):
                clave = f"{b['slug']}/{t['id']}/{t.get('status')}"
                if clave not in avisados:
                    nuevos.append(clave)
                    for chat in _chats():
                        await bot.send_message(chat_id=int(chat),
                                               text=f"⚠️ {b['slug']}: la etapa «{t.get('title')}» se ha parado ({t.get('status')}).\n"
                                                    f"Detalle: hermes kanban --board {b['slug']} show {t['id']}")
    if nuevos:
        _escribir(HOME / "avisos.json", sorted(avisados | set(nuevos)))


async def _crear_tarjeta(puerta: dict) -> str:
    """La tarjeta de la puerta: bloqueada y sin assignee (ningún agente la toma). La crea el gateway porque los
    procesos de un worker del kanban no pueden modificar el tablero."""
    cuerpo = (f"GATE: {puerta['tipo']}\n" + (f"FASE: {puerta['fase']}\n" if puerta.get("fase") else "")
              + f"HEAD: {puerta.get('sha', '')}\nPUERTA: {puerta['id']}\n"
              "Decide una persona autorizada desde su canal; firma el notario. Ningún agente toma esta tarjeta.")
    proc = await asyncio.create_subprocess_exec(
        "hermes", "kanban", "--board", puerta["tablero"], "create", f"PUERTA {puerta.get('titulo', '')}",
        "--initial-status", "blocked", "--body", cuerpo, "--json",
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env={**os.environ, "PATH": PATH_CMDS})
    out, err = await asyncio.wait_for(proc.communicate(), 60)
    if proc.returncode != 0:
        raise RuntimeError(err.decode()[-300:])
    return json.loads(out)["id"]


async def _vuelta(ciclo: int) -> None:
    bot = _RT["app"].bot   # la app puede reconstruirse tras un fallo de conexión: siempre la actual
    for idx in sorted((HOME / "puertas").glob("*.json")):
        p = _leer(idx)
        if not p:
            continue
        if p.get("estado") == "abierta" and not p.get("tarjeta") and p.get("tablero"):
            tarjeta = await _crear_tarjeta(p)
            with N.cerrojo():
                actual = _leer(idx) or p
                actual["tarjeta"] = tarjeta
                _escribir(idx, actual)
                local = Path(actual["repo"]) / ".sdd" / "hermes" / "puertas" / f"{actual['id']}.json"
                loc = _leer(local)
                if loc is not None:
                    loc["tarjeta"] = tarjeta
                    _escribir(local, loc)
            p = actual
        if p.get("estado") == "abierta" and not p.get("telegram"):
            await asyncio.wait_for(_publicar(bot, p), 60)
            with N.cerrojo():
                actual = _leer(idx) or p
                actual.update(telegram=p["telegram"], publicada=p["publicada"], tg_vista=p["tg_vista"])
                _escribir(idx, actual)
        elif p.get("estado") == "decidida" and time.time() >= p.get("firmar_en", 0):
            log.info("hermes-sdd: firmando la puerta %s", p["id"])
            await _firmar(bot, p)
        else:   # decidida o deshecha desde otro canal (dashboard): el mensaje de Telegram se pone al día
            await asyncio.wait_for(_sincronizar(bot, p), 60)
    if ciclo % 12 == 0:
        await asyncio.wait_for(_avisar_fallos(bot), 180)
        await asyncio.wait_for(_vigia(bot), 180)


async def _bucle() -> None:
    ciclo = 0
    log.info("hermes-sdd: bucle en marcha")
    while True:
        await asyncio.sleep(5)
        try:
            await _vuelta(ciclo)
        except asyncio.CancelledError:
            log.warning("hermes-sdd: bucle cancelado")
            raise
        except Exception:
            log.exception("hermes-sdd: error en una vuelta del bucle (sigue)")
        ciclo += 1
        try:   # latido: lo leen /estado y doctor para saber que el canal está vivo
            _escribir(HOME / "latido.json", {"ts": _ahora(), "ciclo": ciclo, "pid": os.getpid()})
        except Exception:
            pass


def _asegurar_bucle() -> None:
    """Si el bucle murió (cancelado o por una excepción no prevista), lo vuelve a lanzar."""
    t = _RT.get("bucle")
    if t is None or t.done():
        if t is not None:
            log.warning("hermes-sdd: el bucle estaba parado; se relanza")
        _RT["bucle"] = asyncio.get_running_loop().create_task(_bucle())



# ── operación: proyectos, estado, pausa, cuota, mensaje vivo y resúmenes ─────────────────────────────────────────────
async def _cli(*args: str, timeout: int = 60) -> str:
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                                                env={**os.environ, "PATH": PATH_CMDS, "HERMES_SDD_HOME": str(HOME)})
    out, err = await asyncio.wait_for(proc.communicate(), timeout)
    if proc.returncode != 0:
        raise RuntimeError((err or out).decode().strip()[-300:])
    return out.decode()


async def _proyectos() -> dict:
    """Tableros del arnés → carpeta del repo (los que tienen .sdd/hermes)."""
    res = {}
    for b in json.loads(await _cli("hermes", "kanban", "boards", "list", "--json") or "[]"):
        wd = b.get("default_workdir") or ""
        if wd and (Path(wd) / ".sdd" / "hermes").is_dir():
            res[b["slug"]] = wd
    return res


async def _tarjetas(board: str) -> list:
    try:
        datos = json.loads(await _cli("hermes", "kanban", "--board", board, "list", "--json") or "[]")
    except Exception:
        return []
    return datos if isinstance(datos, list) else datos.get("tasks", [])


def _coste(repo: str, desde: float = 0) -> float:
    total = 0.0
    for f in (Path(repo) / ".sdd" / "hermes" / "runs").glob("*.json"):
        if f.stat().st_mtime >= desde:
            total += float((_leer(f, {}) or {}).get("total_cost_usd") or 0)
    return round(total, 2)


async def _resumen_proyecto(board: str, repo: str) -> str:
    ts = await _tarjetas(board)
    activa = next((t for t in ts if t.get("status") == "running"), None)
    paradas = [t for t in ts if t.get("assignee") == "sdd-estacion" and t.get("status") in ("blocked", "triage")]
    aparcadas = [t for t in ts if t.get("status") == "scheduled"]
    puertas = [p for p in (_leer(f) for f in (HOME / "puertas").glob("*.json"))
               if p and p.get("tablero") == board and p.get("estado") in ("abierta", "decidida")]
    pausado = (HOME / "pausa" / board).exists() or (HOME / "pausa" / "_todo").exists()
    hecho = sum(1 for t in ts if t.get("status") == "done")
    lineas = [f"📁 {board}" + (" ⏸ en pausa" if pausado else ""),
              f"  ▶ {activa['title']}" if activa else "  ▶ nada en marcha",
              f"  🚪 puertas: {', '.join(p.get('titulo', '') for p in puertas) or 'ninguna'}"]
    if paradas:
        lineas.append(f"  ⚠️ paradas: {', '.join(t['title'] for t in paradas)}")
    if aparcadas:
        lineas.append(f"  ⏳ aparcadas: {len(aparcadas)}")
    lineas.append(f"  ✓ {hecho} tarjetas hechas · {_coste(repo)} $ de ejecutor")
    return "\n".join(lineas)


async def _estado_texto(filtro: str = "") -> str:
    proys = await _proyectos()
    if filtro:
        proys = {b: r for b, r in proys.items() if b == filtro}
    if not proys:
        return "No hay proyectos del arnés" + (f" llamados {filtro}" if filtro else "") + "."
    partes = [await _resumen_proyecto(b, r) for b, r in sorted(proys.items())]
    lat = _leer(HOME / "latido.json", {}) or {}
    cuota = _leer(HOME / "cuota.json")
    pie = f"💓 canal vivo (último latido {lat.get('ts', '?')})"
    if cuota:
        pie += f"\n⛔ cuota de Claude agotada hasta las {datetime.fromtimestamp(cuota['reset_at']).strftime('%H:%M')}"
    return "\n\n".join(partes) + "\n\n" + pie


def _autorizado_en_sesion():
    """Persona que escribe el comando (Telegram), o None."""
    try:
        from gateway.session_context import get_session_env
        uid = get_session_env("HERMES_SESSION_USER_ID") or ""
    except Exception:
        uid = ""
    return (_persona_de(uid)[0], uid) if uid else (None, "")


async def _reanudar_aparcadas(boards) -> int:
    n = 0
    for b in boards:
        for t in await _tarjetas(b):
            if t.get("status") == "scheduled" and t.get("assignee") == "sdd-estacion":
                try:
                    await _cli("hermes", "kanban", "--board", b, "unblock", t["id"]); n += 1
                except Exception as e:
                    log.warning("hermes-sdd: no se pudo reanudar %s/%s: %s", b, t["id"], e)
    return n


async def _vigia(bot) -> None:
    """Cada minuto: cuota que ya se reinició, mensaje vivo por proyecto y resúmenes programados."""
    cuota = _leer(HOME / "cuota.json")
    if cuota and time.time() >= cuota.get("reset_at", 0):
        (HOME / "cuota.json").unlink(missing_ok=True)
        proys = await _proyectos()
        libres = [b for b in proys if not (HOME / "pausa" / b).exists() and not (HOME / "pausa" / "_todo").exists()]
        n = await _reanudar_aparcadas(libres)
        log.info("hermes-sdd: cuota reiniciada; %d etapa(s) reanudadas", n)
    cfg = _config()
    if cfg.get("mensaje_vivo"):
        vivos = _leer(HOME / "vivos.json", {}) or {}
        for b, repo in (await _proyectos()).items():
            texto = "🛰 " + await _resumen_proyecto(b, repo)
            v = vivos.get(b)
            if v and v.get("texto") == texto:
                continue
            for chat in _chats():
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
    for hora in cfg.get("resumenes", []):
        clave = f"{hoy} {hora}"
        if datetime.now().strftime("%H:%M") >= hora and clave not in enviados:
            texto = await _resumen_periodico()
            for chat in _chats():
                await bot.send_message(chat_id=int(chat), text=texto[:4000])
            enviados[clave] = _ahora()
            _escribir(HOME / "resumenes.json", dict(list(enviados.items())[-20:]))


async def _mantenimiento(proyectos: dict) -> list[str]:
    """Revisión por umbrales (vigilar.sh) de los proyectos ya entregados. Si algo cruza un umbral se abre una puerta
    de mantenimiento, que el bucle publica como cualquier otra; aquí no se decide nada."""
    res = []
    for b, repo in sorted(proyectos.items()):
        if (HOME / "pausa" / b).exists() or (HOME / "pausa" / "_todo").exists():
            res.append(f"{b}: en pausa"); continue
        if not (Path(repo) / ".git").exists():
            continue
        tags = await _cli("git", "-C", repo, "tag", "-l", "entrega-*")
        if not tags.strip():
            res.append(f"{b}: aún sin entrega"); continue
        try:
            out = await _cli("bash", str(_root() / "vigilar.sh"), repo, timeout=1200)
            ultima = out.strip().splitlines()[-1] if out.strip() else ""
            res.append(f"{b}: " + ("🛠 puerta de mantenimiento abierta" if ultima.startswith("g") else ultima))
        except Exception as e:
            res.append(f"{b}: la revisión falló ({e})")
    log.info("hermes-sdd: mantenimiento: %s", "; ".join(res))
    return res


async def _mantenimiento_diario() -> None:
    hora = _config().get("mantenimiento")
    hoy = datetime.now().strftime("%Y-%m-%d")
    hecho = _leer(HOME / "mantenimiento.json", {}) or {}
    if not hora or datetime.now().strftime("%H:%M") < hora or hecho.get("dia") == hoy or _RT.get("mant_vivo"):
        return
    inicio = _ahora()
    _escribir(HOME / "mantenimiento.json", {"dia": hoy, "inicio": inicio})

    async def _tarea():
        _RT["mant_vivo"] = True
        try:
            res = await _mantenimiento(await _proyectos())
            _escribir(HOME / "mantenimiento.json", {"dia": hoy, "inicio": inicio, "fin": _ahora(), "resultado": res})
        except Exception:
            log.exception("hermes-sdd: mantenimiento diario")
        finally:
            _RT["mant_vivo"] = False
    asyncio.get_running_loop().create_task(_tarea())   # puede tardar (tests de cada proyecto): no bloquea el bucle


async def _resumen_periodico() -> str:
    """Resumen sin LLM: estado de cada proyecto, decisiones de las últimas 12 h y la métrica de aprobación por inercia."""
    partes = ["🗞 Resumen hermes-sdd", await _estado_texto()]
    desde = time.time() - 12 * 3600
    decisiones = []
    for b, repo in (await _proyectos()).items():
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
        partes.append("Últimas 12 h:\n" + "\n".join(decisiones[-10:]))
    # Aprobación por inercia: aceptaciones muy rápidas tras ver la demo, en los últimos 7 días
    semana = time.time() - 7 * 86400
    firmadas = [p for p in (_leer(f) for f in (HOME / "puertas").glob("*.json"))
                if p and p.get("estado") == "firmada" and p.get("tipo") in ("fase", "entrega")
                and (p.get("firmar_en") or 0) >= semana and (p.get("decision") or {}).get("verbo") == "acepto"]
    dwell = sorted((p["decision"].get("dwell_s") or 0) for p in firmadas if p.get("decision"))
    if dwell:
        med = dwell[len(dwell) // 2]
        aviso = " ⚠️ posible aprobación por inercia: mira las demos con más calma" if len(dwell) >= 3 and med < 20 else ""
        partes.append(f"Aceptaciones de la semana: {len(dwell)}, mediana {med} s viendo la demo.{aviso}")
    return "\n\n".join(partes)

# ── registro ────────────────────────────────────────────────────────────────────────────────────────────────────
def register(ctx):
    def _wire(application, adapter):
        from telegram.ext import CallbackQueryHandler, MessageHandler, filters

        class _EsRespuestaDePuerta(filters.MessageFilter):
            def filter(self, message):
                r = message.reply_to_message
                return bool(r and r.message_id in _RT["pendientes"])

        _RT["app"] = application
        application.add_handler(CallbackQueryHandler(_on_boton, pattern=r"^g:"))
        application.add_handler(MessageHandler(filters.TEXT & _EsRespuestaDePuerta(), _on_respuesta))
        (HOME / "puertas").mkdir(parents=True, exist_ok=True)

        _asegurar_bucle()   # una sola tarea viva aunque el adaptador reconstruya la app

    def _cmd_puertas(raw_args: str = "") -> str:
        try:
            _asegurar_bucle()
        except RuntimeError:
            pass
        abiertas = [p for p in (_leer(f) for f in sorted((HOME / "puertas").glob("*.json"))) if p and p.get("estado") == "abierta"]
        if not abiertas:
            return "No hay puertas abiertas."
        for p in abiertas:   # el bucle las vuelve a publicar con sus botones
            p.pop("telegram", None)
            _escribir(HOME / "puertas" / f"{p['id']}.json", p)
        return f"{len(abiertas)} puerta(s) abierta(s); te las reenvío con sus botones."

    async def _cmd_estado(raw_args: str = "") -> str:
        return await _estado_texto(raw_args.strip())

    async def _cmd_pausar(raw_args: str = "") -> str:
        persona, _ = _autorizado_en_sesion()
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
            for b, repo in (await _proyectos()).items():
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
        persona, _ = _autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede reanudar."
        objetivo = raw_args.strip() or "todo"
        f = HOME / "pausa" / ("_todo" if objetivo == "todo" else objetivo)
        f.unlink(missing_ok=True)
        boards = list((await _proyectos()).keys()) if objetivo == "todo" else [objetivo]
        n = await _reanudar_aparcadas(boards)
        return f"▶ {objetivo} reanudado; {n} etapa(s) vuelven a la cola."

    async def _cmd_anular(raw_args: str = "") -> str:
        persona, uid = _autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede anular una aceptación."
        partes = raw_args.split(maxsplit=2)
        if len(partes) < 3 or not partes[1].isdigit():
            return "Uso: /anular <proyecto> <número de FASE> <motivo>"
        repo = (await _proyectos()).get(partes[0])
        if not repo:
            return f"No conozco el proyecto {partes[0]}."
        try:
            return await _cli("bash", str(_root() / "anular.sh"), repo, partes[1], persona, "telegram", uid, partes[2])
        except Exception as e:
            return f"No se anuló: {e}"

    async def _cmd_cambio(raw_args: str = "") -> str:
        persona, _ = _autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede pedir cambios."
        partes = raw_args.split(maxsplit=1)
        if len(partes) < 2:
            return "Uso: /cambio <proyecto> <qué quieres, en tus palabras>"
        repo = (await _proyectos()).get(partes[0])
        if not repo:
            return f"No conozco el proyecto {partes[0]}."
        try:
            return await _cli("bash", str(_root() / "lanzar.sh"), "cambio", repo, partes[1])
        except Exception as e:
            return f"No se lanzó el cambio: {e}"

    async def _cmd_mantenimiento(raw_args: str = "") -> str:
        persona, _ = _autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede lanzar la revisión."
        proys = await _proyectos()
        if raw_args.strip():
            proys = {b: r for b, r in proys.items() if b == raw_args.strip()}
            if not proys:
                return f"No conozco el proyecto {raw_args.strip()}."
        return "🔎 Revisión de mantenimiento:\n" + "\n".join(await _mantenimiento(proys))

    ctx.register_telegram_handler(_wire)
    ctx.register_command("cambio", _cmd_cambio, description="Pide un cambio o una funcionalidad a un proyecto SDD", args_hint="<proyecto> <petición>")
    ctx.register_command("estado", _cmd_estado, description="Estado de los proyectos SDD", args_hint="[proyecto]")
    ctx.register_command("pausar", _cmd_pausar, description="Pausa proyectos SDD (ahora = detener)", args_hint="[proyecto|todo] [ahora]")
    ctx.register_command("reanudar", _cmd_reanudar, description="Reanuda proyectos SDD en pausa", args_hint="[proyecto|todo]")
    ctx.register_command("anular", _cmd_anular, description="Anula la aceptación de una FASE", args_hint="<proyecto> <fase> <motivo>")
    ctx.register_command("mantenimiento", _cmd_mantenimiento, description="Revisa ahora los proyectos SDD entregados (umbrales)", args_hint="[proyecto]")
    ctx.register_command("puertas", _cmd_puertas, description="Puertas SDD abiertas, con sus botones")
