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

log = logging.getLogger("hermes_sdd")

HOME = Path(os.environ.get("HERMES_SDD_HOME", Path.home() / ".hermes" / "hermes-sdd"))
DESHACER_S = int(os.environ.get("HERMES_SDD_DESHACER_S", "180"))
PATH_CMDS = f"{Path.home()}/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"
_RT: dict = {"app": None, "pendientes": {}}   # pendientes: id del mensaje ForceReply → (puerta, verbo, persona)
_lock = asyncio.Lock()


# ── ficheros ────────────────────────────────────────────────────────────────────────────────────────────────────
def _leer(p: Path, defecto=None):
    try:
        return json.loads(p.read_text())
    except Exception:
        return defecto


def _escribir(p: Path, datos) -> None:
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=2))
    tmp.replace(p)


def _ahora() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _persona_de(user_id: int):
    for clave, p in (_leer(HOME / "aprobadores.json", {}) or {}).items():
        if str(p.get("canales", {}).get("telegram", "")) == str(user_id):
            return clave, p
    return None, None


def _chats() -> list[str]:
    home = os.environ.get("TELEGRAM_HOME_CHANNEL", "").strip()
    if home:
        return [home]
    return [str(p["canales"]["telegram"]) for p in (_leer(HOME / "aprobadores.json", {}) or {}).values()
            if p.get("canales", {}).get("telegram")]


def _root() -> Path:
    return Path((_leer(HOME / "instalacion.json", {}) or {}).get("root", ""))


# ── mensajes ────────────────────────────────────────────────────────────────────────────────────────────────────
def _teclado(puerta: dict, paso: int = 1):
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    ops = puerta.get("opciones", [])
    if any(o.get("paso") for o in ops):
        ops = [o for o in ops if o.get("paso", 1) == paso]
    botones = [B(o["etiqueta"], callback_data=f"g:{o['verbo']}:{puerta['id']}") for o in ops]
    filas = [botones[i:i + 2] for i in range(0, len(botones), 2)]
    return M(filas)


def _cabecera(puerta: dict) -> str:
    return f"🚪 {puerta.get('titulo', 'Puerta')} · {puerta.get('tablero', '')}\n"


async def _publicar(bot, puerta: dict) -> None:
    texto = _cabecera(puerta) + "\n" + puerta.get("texto", "")
    enviados = []
    for chat in _chats():
        m = await bot.send_message(chat_id=int(chat), text=texto[:4000], reply_markup=_teclado(puerta, 1))
        enviados.append({"chat": m.chat_id, "msg": m.message_id})
    puerta["telegram"] = enviados
    puerta["publicada"] = _ahora()


async def _editar(bot, puerta: dict, texto: str, teclado=None) -> None:
    for t in puerta.get("telegram", []):
        try:
            await bot.edit_message_text(chat_id=t["chat"], message_id=t["msg"], text=texto[:4000], reply_markup=teclado)
        except Exception as e:  # mensaje igual o borrado: no es grave
            log.debug("hermes-sdd: no se pudo editar %s: %s", t, e)


# ── decisiones ──────────────────────────────────────────────────────────────────────────────────────────────────
async def _decidir(bot, gid: str, verbo: str, texto: str, user, persona: str, prueba: dict) -> str:
    async with _lock:
        idx = HOME / "puertas" / f"{gid}.json"
        puerta = _leer(idx)
        if not puerta or puerta.get("estado") != "abierta":
            return "Esta puerta ya está resuelta"
        decision = {"verbo": verbo, "texto": texto or "",
                    "actor": {"persona": persona, "canal": "telegram", "id": str(user.id)},
                    "prueba": {"user": user.username or "", **prueba}, "at": _ahora()}
        dirdec = Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones"
        dirdec.mkdir(parents=True, exist_ok=True)
        _escribir(dirdec / f"{gid}.json", decision)
        if puerta.get("ver_at"):
            decision["dwell_s"] = int(time.time() - puerta["ver_at"])
        puerta.update(estado="decidida", decision=decision, firmar_en=time.time() + DESHACER_S)
        _escribir(idx, puerta)
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    hora = datetime.fromtimestamp(puerta["firmar_en"]).strftime("%H:%M")
    etiqueta = next((o["etiqueta"] for o in puerta.get("opciones", []) if o["verbo"] == verbo), verbo)
    await _editar(bot, puerta, f"{_cabecera(puerta)}\n{etiqueta} — {persona}{(': ' + texto) if texto else ''}\n"
                                f"🕒 Se firma a las {hora}",
                  M([[B("↩ Deshacer", callback_data=f"g:deshacer:{gid}")]]))
    return "Decisión registrada; tienes unos minutos para deshacerla"


async def _on_boton(update, context) -> None:
    q = update.callback_query
    _, verbo, gid = (q.data.split(":", 2) + ["", ""])[:3]
    persona, _p = _persona_de(q.from_user.id)
    if not persona:
        await q.answer("No estás autorizado para decidir esta puerta", show_alert=True)
        return
    idx = HOME / "puertas" / f"{gid}.json"
    puerta = _leer(idx)
    if not puerta:
        await q.answer("No conozco esta puerta", show_alert=True)
        return
    bot = context.bot
    if verbo == "deshacer":
        async with _lock:
            puerta = _leer(idx)
            dec = puerta.get("decision") or {}
            if puerta.get("estado") != "decidida" or dec.get("actor", {}).get("persona") != persona:
                await q.answer("Ya no se puede deshacer", show_alert=True)
                return
            (Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones" / f"{gid}.json").unlink(missing_ok=True)
            puerta.update(estado="abierta")
            puerta.pop("decision", None); puerta.pop("firmar_en", None)
            _escribir(idx, puerta)
        await q.answer("Deshecho")
        paso = 2 if puerta.get("ver_at") else 1
        await _editar(bot, puerta, _cabecera(puerta) + "\n" + puerta.get("texto", ""), _teclado(puerta, paso))
        return
    if puerta.get("estado") != "abierta":
        await q.answer("Esta puerta ya está resuelta", show_alert=True)
        return
    if verbo == "ver":
        await q.answer("Enviando la demo…")
        await _enviar_demo(bot, q.message.chat_id, puerta)
        async with _lock:
            puerta = _leer(idx); puerta["ver_at"] = time.time(); _escribir(idx, puerta)
        await _editar(bot, puerta, _cabecera(puerta) + "\n" + puerta.get("texto", "") + "\n\n👀 Demo vista. Decide:",
                      _teclado(puerta, 2))
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
    videos = sorted(carpeta.glob("*.mp4"))
    if videos and videos[0].stat().st_size < 49_000_000:
        with videos[0].open("rb") as f:
            await bot.send_video(chat_id=chat_id, video=f, caption=f"Demo FASE-{puerta.get('fase')}")
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
    out, err = await proc.communicate()
    idx = HOME / "puertas" / f"{gid}.json"
    async with _lock:
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
    out, _ = await proc.communicate()
    nuevos = []
    for b in json.loads(out or b"[]"):
        wd = b.get("default_workdir") or ""
        if not wd or not (Path(wd) / ".sdd" / "hermes").is_dir():
            continue
        proc = await asyncio.create_subprocess_exec("hermes", "kanban", "--board", b["slug"], "list", "--json",
                                                    stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                    env={**os.environ, "PATH": PATH_CMDS})
        out, _ = await proc.communicate()
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


async def _bucle() -> None:
    ciclo = 0
    while True:
        await asyncio.sleep(5)
        try:
            bot = _RT["app"].bot   # la app puede reconstruirse tras un fallo de conexión: siempre la actual
            for idx in sorted((HOME / "puertas").glob("*.json")):
                p = _leer(idx)
                if not p:
                    continue
                if p.get("estado") == "abierta" and not p.get("telegram"):
                    await _publicar(bot, p)
                    async with _lock:
                        actual = _leer(idx) or p
                        actual.update(telegram=p["telegram"], publicada=p["publicada"])
                        _escribir(idx, actual)
                elif p.get("estado") == "decidida" and time.time() >= p.get("firmar_en", 0):
                    await _firmar(bot, p)
            if ciclo % 12 == 0:
                await _avisar_fallos(bot)
        except Exception:
            log.exception("hermes-sdd: error en el bucle")
        ciclo += 1


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

        if not _RT.get("bucle"):   # una sola tarea aunque el adaptador reconstruya la app
            _RT["bucle"] = asyncio.get_running_loop().create_task(_bucle())

    def _cmd_puertas(raw_args: str = "") -> str:
        abiertas = [p for p in (_leer(f) for f in sorted((HOME / "puertas").glob("*.json"))) if p and p.get("estado") == "abierta"]
        if not abiertas:
            return "No hay puertas abiertas."
        for p in abiertas:   # el bucle las vuelve a publicar con sus botones
            p.pop("telegram", None)
            _escribir(HOME / "puertas" / f"{p['id']}.json", p)
        return f"{len(abiertas)} puerta(s) abierta(s); te las reenvío con sus botones."

    ctx.register_telegram_handler(_wire)
    ctx.register_command("puertas", _cmd_puertas, description="Puertas SDD abiertas, con sus botones")
