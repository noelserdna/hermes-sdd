"""hermes-sdd · canal Telegram: a quién se escribe, el render de cada puerta (texto y botones), el envío y la edición
de sus mensajes y los handlers de los botones y de las respuestas de texto; también las lecciones entre proyectos, que
una persona decide con botones.

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga y lo de otras
partes se llama por ``P``. ``python-telegram-bot`` se importa dentro de cada función: el plugin se carga también donde
no está (CLI, panel, pruebas con el Python del sistema).
"""
from __future__ import annotations

import os
import re
import time
from datetime import datetime
from pathlib import Path

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, PL, TX, log = P.N, P.PL, P.TX, P.log
HOME = N.HOME
_leer, _ahora, _respuestas = N.leer, N.ahora, N.respuestas

__all__ = ["_persona_de", "_chats", "_config", "_en_silencio", "_teclado", "_plural", "_corta_linea", "_resultado_claro",
           "_cabecera", "_render", "_texto_abierta", "_sobrante", "_cabe", "_publicar", "_editar", "_sincronizar",
           "_decidir", "_on_boton", "_pendientes", "_pendientes_guardar", "_pendientes_hay", "_pendientes_sacar",
           "_on_respuesta", "_enviar_demo", "_texto_leccion", "_avisar_lecciones", "_on_leccion", "_enganchar"]


# ── destinos y presupuesto de atención ──────────────────────────────────────────────────────────────────────────
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


def _plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def _corta_linea(t: str, n: int = 220) -> str:
    t = " ".join(str(t).split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def _resultado_claro(resumen: str, firma: dict | None = None) -> str:
    """El resumen del notario («FASE-0 aceptada por Ana (Cliente) — tag fase-0-accepted») dicho para una persona: qué
    quedó registrado, dónde (el tag, aparte) y qué pasa ahora. Con `firma` (lo que firmar.sh deja estructurado en el
    acta y en el índice: {resultado, verbo, negativo, tag, resumen…}) el tag y si fue un «no» salen de ahí; sin ella
    (puertas firmadas antes de ese campo), se deducen del texto como siempre."""
    firma = firma if isinstance(firma, dict) and "negativo" in firma else None
    if firma:
        tag = firma.get("tag") or ""
        principal = resumen.replace(f" — tag {tag}", "", 1) if tag else resumen
    else:
        principal, _, tag = resumen.partition(" — tag ")
    principal = principal.replace(" (acepto)", "").replace(" (completo)", ", haciéndolo todo")
    principal = re.sub(r"Jev \([^()]*\) \(Agente automático \(modo (\w+)\)\)", r"Jev, en modo \1", principal)
    principal = principal.replace("Jev, en modo auto", "Jev, en modo automático")
    if firma:
        negativo = bool(firma.get("negativo"))
    else:   # compatibilidad: puertas firmadas sin «firma» (el texto de la persona podía engañar a esta expresión)
        negativo = bool(re.search(r"rechaz|pide cambios|ignor", principal, re.I))
    lineas = [f"{'↩️' if negativo else '✅'} {principal}."]
    if tag:
        lineas.append(f"🏷 Queda guardado en el historial como «{tag.strip()}».")
    entregada = (firma.get("tipo") == "entrega" and not negativo and firma.get("resultado") in ("acepto", "observaciones")
                 ) if firma else bool(re.search(r"^Entrega \d+ aceptada", principal))
    if entregada:
        lineas.append("🎉 Proyecto entregado.")
    elif negativo:
        lineas.append("Se rehace con lo que has pedido y te volverá a llegar para decidir.")
    else:
        lineas.append("Sigue solo con el siguiente paso.")
    return "\n".join(lineas)


def _cabecera(puerta: dict) -> str:
    return f"🚪 {puerta.get('titulo', 'Puerta')} · {puerta.get('tablero', '')}\n"


def _render(puerta: dict):
    """Texto y botones que corresponden al estado de la puerta, venga el cambio del canal que venga."""
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    if puerta.get("estado") == "firmada" and puerta.get("resultado"):   # firmada por otro canal (p. ej. el ordenador)
        return (f"{_cabecera(puerta)}\n{_resultado_claro(puerta['resultado'], puerta.get('firma'))}", None)
    if puerta.get("estado") == "superada":   # otra puerta la sustituye (un cambio, una reapertura): sin botones
        por = puerta.get("superada_por") or ""
        motivo = por.split(":", 1)[1].strip() if por.startswith("reapertura:") else "la sustituye una puerta más reciente"
        return (f"{_cabecera(puerta)}\n⏭ Esta puerta ya no vale: {motivo}. Decide en la nueva.", None)
    if puerta.get("estado") == "decidida":
        dec = puerta.get("decision") or {}
        verbo, texto = dec.get("verbo", ""), dec.get("texto", "")
        etiqueta = next((o["etiqueta"] for o in puerta.get("opciones", []) if o["verbo"] == verbo), verbo)
        canal = dec.get("actor", {}).get("canal", "")
        hora = datetime.fromtimestamp(puerta.get("firmar_en", time.time())).strftime("%H:%M:%S")
        deshacer = M([[B("↩ Deshacer", callback_data=f"g:deshacer:{puerta['id']}")]])
        quedan = max(0, int(puerta.get("firmar_en", time.time()) - time.time()))
        plazo = f"🕒 Tienes hasta las {hora} ({N.duracion(quedan)}) para pulsar ↩ Deshacer; después queda registrado."
        if canal == N.JEV:   # decidió Jev: se dice claro y cualquier persona autorizada puede deshacerlo
            pr = dec.get("prueba", {})
            seguro = f"{round(float(pr.get('p') or 0) * 100)} %"
            return (f"{_cabecera(puerta)}\n{puerta.get('texto', '')}\n\n🤖 Jev lo ha decidido por ti: {etiqueta} "
                    f"(seguridad {seguro}).\n{plazo}\nSi no estás de acuerdo, deshazlo y la decisión vuelve a ti.", deshacer)
        desde = {"dashboard": " desde el panel", "local": " desde el ordenador"}.get(canal, "")
        quien = dec.get("actor", {}).get("persona", "")
        quien = ((_leer(HOME / "aprobadores.json", {}) or {}).get(quien) or {}).get("nombre") or quien
        return (f"{_cabecera(puerta)}\n{etiqueta} — lo ha decidido {quien}{desde}"
                f"{('. Motivo: ' + texto) if texto else '.'}\n{plazo}", deshacer)
    paso = N.paso_actual(puerta)
    extra = "\n\n👀 Ya has visto la demo. Decide:" if (N.escalonada(puerta) and paso == 2) else ""
    jev = N.describir_jev(puerta)
    # «👉 … esto lanzará» con lo que la persona va marcando en los botones Q (no solo con las recomendadas)
    return (_cabe(_texto_abierta(puerta, jev, extra)), _teclado(puerta, paso))


def _texto_abierta(puerta: dict, jev: str = "", extra: str = "") -> str:
    """El texto entero de una puerta abierta (sin recortar)."""
    # «👉 … esto lanzará» con lo que la persona va marcando en los botones Q (no solo con las recomendadas)
    texto = TX.texto_con_lanzara(puerta, _respuestas(puerta))
    return _cabecera(puerta) + "\n" + texto + (f"\n\n{jev}" if jev else "") + extra


def _sobrante(texto: str, n: int = 4000) -> str:
    """Lo que _cabe quita del medio de un texto demasiado largo ("" si cabe): se manda antes, en su propio mensaje, para
    que nada se pierda en Telegram (taller: «💬 Esto dirá la web» de la puerta de requisitos no cabía)."""
    if len(texto) <= n:
        return ""
    corto = _cabe(texto, n)
    corte = "\n\n✂️ (recortado: el texto entero está en el panel)"
    k = corto.find(corte)
    if k < 0:
        return ""
    cola = corto[k + len(corte):]
    fin = len(texto) - len(cola) if cola else len(texto)
    return texto[k:fin].strip()


def _cabe(texto: str, n: int = 4000) -> str:
    """Un mensaje de Telegram admite 4000 caracteres: si no cabe, se recorta lo de en medio y se conservan las preguntas
    y la línea «esto lanzará» del final, que son lo que deciden los botones Q (taller: la puerta de requisitos tenía
    4300 y se perdían Q4 y «esto lanzará»)."""
    if len(texto) <= n:
        return texto
    i = texto.find("\n\n❓ ")
    corte = "\n\n✂️ (recortado: el texto entero está en el panel)"
    if i < 0 or len(texto) - i > n - 600:
        return texto[: n - len(corte)].rstrip() + corte
    cola = texto[i:]
    cabeza = texto[: n - len(cola) - len(corte)]
    cabeza = cabeza[: cabeza.rfind("\n")] if "\n" in cabeza else cabeza
    return cabeza.rstrip() + corte + cola


async def _publicar(bot, puerta: dict) -> None:
    texto, teclado = _render(puerta)
    sobra = ""
    if puerta.get("estado") == "abierta":
        sobra = _sobrante(_texto_abierta(puerta, N.describir_jev(puerta)))
    enviados = []
    for chat in _chats():
        # Primero lo que no cabe en el mensaje de la puerta (sin botones), en trozos de 4000; luego la puerta
        for i in range(0, len(sobra), 3900):
            await bot.send_message(chat_id=int(chat), text=("📄 Detalle de la puerta (sigue abajo):\n" if i == 0 else "")
                                   + sobra[i:i + 3900], disable_notification=True)
        m = await bot.send_message(chat_id=int(chat), text=texto[:4000], reply_markup=teclado,
                                   disable_notification=_en_silencio())
        enviados.append({"chat": m.chat_id, "msg": m.message_id})
    puerta["telegram"] = enviados
    puerta["publicada"] = _ahora()
    puerta["tg_vista"] = N.clave_vista(puerta)


async def _editar(bot, puerta: dict, texto: str, teclado=None) -> None:
    if bot is None:
        return
    for t in puerta.get("telegram", []):
        try:
            await bot.edit_message_text(chat_id=t["chat"], message_id=t["msg"], text=texto[:4000], reply_markup=teclado)
        except Exception as e:  # mensaje igual o borrado: no es grave
            log.debug("hermes-sdd: no se pudo editar %s: %s", t, e)


async def _sincronizar(bot, puerta: dict) -> None:
    """Pone el mensaje de Telegram al día con la puerta (decidida o deshecha aquí o en otro canal)."""
    if not puerta.get("telegram") or puerta.get("estado") not in ("abierta", "decidida", "superada", "firmada"):
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
    return f"Hecho. Tienes {N.duracion(N.deshacer_s())} para deshacerlo si te has equivocado."


async def _on_boton(update, context) -> None:
    P._asegurar_bucle()
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
        await q.answer("Deshecho: la decisión vuelve a estar pendiente")
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
        await q.answer("Te envío la demo…")
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
        if verbo == "corrijo":
            pide, hueco = ("✏️ Corregir el requisito: responde a este mensaje con cómo tiene que quedar el criterio. Se lanza "
                           "un cambio de requisitos (te llegará su puerta) y la fase se rehace con el criterio bueno."), "El criterio tiene que decir…"
        elif verbo == "descarto":
            pide, hueco = ("🗑 Descartar: responde a este mensaje con el número de la impugnación que no es un fallo "
                           "(p. ej. CH-005) y por qué. Queda registrado a tu nombre y la puerta vuelve sin ella."), "CH-… porque…"
        elif verbo == "eximo":
            pide, hueco = ("🟡 Aceptar sin lo que falta: responde a este mensaje con por qué puede esperar. Lo que falta "
                           "queda apuntado como pendiente, con su número de seguimiento, a tu nombre."), "Por qué puede esperar…"
        else:
            pide, hueco = f"{opcion['etiqueta']}: responde a este mensaje explicando qué quieres, con tus palabras.", "Qué falta o qué cambiar…"
        m = await bot.send_message(chat_id=q.message.chat_id, text=pide,
                                   reply_markup=ForceReply(selective=True, input_field_placeholder=hueco))
        _pendientes_guardar(m.message_id, (gid, verbo, persona))
        return
    aviso = await _decidir(bot, gid, verbo, "", q.from_user, persona,
                           {"msg": str(q.message.message_id), "cb": q.id})
    await q.answer(aviso)


# Las respuestas de texto pendientes (❌ Rechazar → «responde a este mensaje») viven en disco: un reinicio del
# gateway entre el botón y la respuesta no debe tragarse la decisión.
def _pendientes() -> dict:
    return N.leer(HOME / "pendientes.json", {}) or {}


# El disco es la única fuente: borrar una entrada (o que la puerta ya no esté abierta) anula la espera. Se cambia con
# N.actualizar (cerrojo): dos «responde a este mensaje» casi a la vez se pisaban y uno de los dos se perdía.
def _pendientes_guardar(msg_id, valor) -> None:
    N.actualizar(HOME / "pendientes.json", lambda d: {**(d or {}), str(msg_id): list(valor)}, {})


def _pendientes_hay(msg_id) -> bool:
    return str(msg_id) in _pendientes()


def _pendientes_sacar(msg_id, persona) -> tuple | None:
    """Consume la espera de `msg_id` solo si responde `persona` (quien pulsó el botón). Antes se consumía y luego se
    miraba quién respondía: si contestaba otra persona del grupo, la espera se borraba y el motivo del autorizado ya
    no llegaba a ninguna parte. None: no es suya o ya la consumió otra respuesta (dos a la vez: solo una decide)."""
    sacado = []

    def fn(d):
        valor = (d or {}).get(str(msg_id))
        if not valor or valor[2] != persona:
            return None   # no se toca el disco
        sacado.append(tuple(valor))
        return {k: v for k, v in d.items() if k != str(msg_id)}

    N.actualizar(HOME / "pendientes.json", fn, {})
    return sacado[0] if sacado else None


async def _on_respuesta(update, context) -> None:
    m = update.message
    quien = _persona_de(m.from_user.id)[0]
    sacado = _pendientes_sacar(m.reply_to_message.message_id, quien) if quien else None
    if sacado is None:
        if _pendientes_hay(m.reply_to_message.message_id):   # sigue esperando a quien pulsó: no se pierde
            await m.reply_text("Solo puede responder quien pulsó el botón.")
        return
    gid, verbo, persona = sacado
    aviso = await _decidir(context.bot, gid, verbo, m.text.strip(), m.from_user, persona, {"msg": str(m.message_id)})
    await m.reply_text(aviso)


async def _enviar_demo(bot, chat_id: int, puerta: dict) -> None:
    from telegram import InputMediaPhoto
    carpeta = Path(puerta["repo"]) / "evidencias" / f"FASE-{puerta.get('fase', '')}"
    if not carpeta.is_dir():
        await bot.send_message(chat_id=chat_id, text="Esta fase no trae demo (ni vídeo ni capturas). Decide con el resumen de la puerta.")
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


# ── lecciones entre proyectos (encargado, fase 5): las decide una persona con botones ──────────────────────────
def _texto_leccion(l: dict) -> tuple:
    from telegram import InlineKeyboardButton as B, InlineKeyboardMarkup as M
    ev = "\n".join(f"• {e['proyecto']}: {e['tipo']} {e['ref']} — {e['resumen']}" for e in l["evidencias"])
    if l["estado"] == "propuesta":
        texto = (f"📚 Lección propuesta {l['id']} (para la etapa {l['etapa']}), del {l['por']}:\n«{l['regla']}»\n\n"
                 f"Evidencia:\n{ev}\n\nSi la confirmas, llegará a esa etapa en los próximos proyectos.")
        botones = [B("✅ Confirmar", callback_data=f"lc:confirmar:{l['id']}"), B("🗑 Descartar", callback_data=f"lc:descartar:{l['id']}")]
    else:
        usos = sorted({u["proyecto"] for u in l.get("usos", [])})
        texto = (f"📚 La lección {l['id']} ya se ha usado en {len(usos)} proyectos ({', '.join(usos)}):\n«{l['regla']}»\n\n"
                 "¿Sigue sirviendo? Mírala con lo que ha pasado en esos proyectos.")
        botones = [B("♻️ Mantener", callback_data=f"lc:mantener:{l['id']}"), B("⌛ Caducar", callback_data=f"lc:caducar:{l['id']}")]
    return texto, M([botones])


async def _avisar_lecciones(bot) -> None:
    for l in PL.pendientes():
        clave = f"{l['estado']}:{len(l.get('usos', []))}"
        if l.get("avisada") == clave:
            continue
        texto, teclado = _texto_leccion(l)
        for chat in _chats():
            try:
                await bot.send_message(chat_id=int(chat), text=texto[:4000], reply_markup=teclado)
            except Exception as e:
                log.warning("hermes-sdd: aviso de la lección %s: %s", l["id"], e)
        PL.marcar_avisada(l["id"], clave)


async def _on_leccion(update, context) -> None:
    q = update.callback_query
    _, accion, lid = (q.data.split(":", 2) + ["", ""])[:3]
    persona, _p = _persona_de(q.from_user.id)
    if not persona:
        await q.answer("No estás autorizado", show_alert=True)
        return
    try:
        l = PL.decidir(lid, accion, persona)
    except Exception as e:
        await q.answer(str(e)[:190], show_alert=True)
        return
    hecho = {"confirmada": "✅ Confirmada: llegará a esa etapa en los próximos proyectos.",
             "descartada": "🗑 Descartada.", "caducada": "⌛ Caducada: ya no se usa."}.get(l["estado"], "♻️ Se mantiene.")
    await q.answer(hecho[:190])
    try:
        await q.edit_message_text(f"📚 {l['id']} · {l['etapa']}: «{l['regla']}»\n{hecho} ({persona})")
    except Exception:
        pass


# ── enganche con el adaptador de Telegram de Hermes ─────────────────────────────────────────────────────────────────
def _enganchar(application, adapter) -> None:
    """Lo llama Hermes al conectar Telegram (``register_telegram_handler``): los handlers de las puertas y de las
    lecciones, y el bucle pasa al loop del gateway."""
    from telegram.ext import CallbackQueryHandler, MessageHandler, filters

    class _EsRespuestaDePuerta(filters.MessageFilter):
        def filter(self, message):
            r = message.reply_to_message
            return bool(r and _pendientes_hay(r.message_id))

    P._RT.app = application
    application.add_handler(CallbackQueryHandler(_on_boton, pattern=r"^g:"))
    application.add_handler(CallbackQueryHandler(_on_leccion, pattern=r"^lc:"))
    application.add_handler(MessageHandler(filters.TEXT & _EsRespuestaDePuerta(), _on_respuesta))
    (HOME / "puertas").mkdir(parents=True, exist_ok=True)

    P._asegurar_bucle()   # reutiliza el bucle si ya corre aquí; si iba sin Telegram en su hilo, pasa a este loop
