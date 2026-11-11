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
import re
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path

log = logging.getLogger("hermes_plugins.hermes_sdd")   # este prefijo llega a gateway.log


def _path_cmds() -> str:
    """PATH fijo para los scripts, más los directorios donde están hermes, node y claude (nvm, ~/.npm-global… en
    Linux/WSL no están en el fijo)."""
    dirs = [f"{Path.home()}/.local/bin", "/opt/homebrew/bin", "/usr/local/bin", "/usr/bin", "/bin"]
    for cmd in ("hermes", "node", "claude", "jq"):
        p = shutil.which(cmd)
        if p and str(Path(p).parent) not in dirs:
            dirs.insert(0, str(Path(p).parent))
    return ":".join(dirs)


PATH_CMDS = _path_cmds()
_RT: dict = {"app": None, "pendientes": {}}   # pendientes: id del mensaje ForceReply → (puerta, verbo, persona)


# ── núcleo común a los canales (validación, decisión, deshacer y cerrojo entre procesos) ─────────────────────────
def _cargar_nucleo():
    import importlib.util, sys
    if "hsdd_nucleo" not in sys.modules:
        spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).with_name("hsdd_nucleo.py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); sys.modules["hsdd_nucleo"] = mod
    return sys.modules["hsdd_nucleo"]


N = _cargar_nucleo()


def _cargar_proyectos():
    import importlib.util, sys
    if "hsdd_proyectos" not in sys.modules:
        spec = importlib.util.spec_from_file_location("hsdd_proyectos", Path(__file__).with_name("hsdd_proyectos.py"))
        mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod); sys.modules["hsdd_proyectos"] = mod
    return sys.modules["hsdd_proyectos"]


PR = _cargar_proyectos()
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


def _plural(n: int, uno: str, varios: str) -> str:
    return f"{n} {uno if n == 1 else varios}"


def _corta_linea(t: str, n: int = 220) -> str:
    t = " ".join(str(t).split())
    return t if len(t) <= n else t[: n - 1].rstrip() + "…"


def _resultado_claro(resumen: str) -> str:
    """El resumen del notario («FASE-0 aceptada por Ana (Cliente) — tag fase-0-accepted») dicho para una persona: qué
    quedó registrado, dónde (el tag, aparte) y qué pasa ahora."""
    principal, _, tag = resumen.partition(" — tag ")
    principal = principal.replace(" (acepto)", "").replace(" (completo)", ", haciéndolo todo")
    principal = re.sub(r"Jev \([^()]*\) \(Agente automático \(modo (\w+)\)\)", r"Jev, en modo \1", principal)
    principal = principal.replace("Jev, en modo auto", "Jev, en modo automático")
    negativo = bool(re.search(r"rechaz|pide cambios|ignor", principal, re.I))
    lineas = [f"{'↩️' if negativo else '✅'} {principal}."]
    if tag:
        lineas.append(f"🏷 Queda guardado en el historial como «{tag.strip()}».")
    if re.search(r"^Entrega \d+ aceptada", principal):
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
    return (_cabecera(puerta) + "\n" + puerta.get("texto", "") + (f"\n\n{jev}" if jev else "") + extra,
            _teclado(puerta, paso))


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
    return f"Hecho. Tienes {N.duracion(N.deshacer_s())} para deshacerlo si te has equivocado."


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
        m = await bot.send_message(chat_id=q.message.chat_id,
                                   text=f"{opcion['etiqueta']}: responde a este mensaje explicando qué quieres, con tus palabras.",
                                   reply_markup=ForceReply(selective=True, input_field_placeholder="Qué falta o qué cambiar…"))
        _pendientes_guardar(m.message_id, (gid, verbo, persona))
        return
    aviso = await _decidir(bot, gid, verbo, "", q.from_user, persona,
                           {"msg": str(q.message.message_id), "cb": q.id})
    await q.answer(aviso)


# Las respuestas de texto pendientes (❌ Rechazar → «responde a este mensaje») viven en disco: un reinicio del
# gateway entre el botón y la respuesta no debe tragarse la decisión.
def _pendientes() -> dict:
    return N.leer(HOME / "pendientes.json", {}) or {}


# El disco es la única fuente: borrar una entrada (o que la puerta ya no esté abierta) anula la espera.
def _pendientes_guardar(msg_id, valor) -> None:
    d = _pendientes()
    d[str(msg_id)] = list(valor)
    N.escribir(HOME / "pendientes.json", d)


def _pendientes_hay(msg_id) -> bool:
    return str(msg_id) in _pendientes()


def _pendientes_sacar(msg_id) -> tuple:
    d = _pendientes()
    valor = d.pop(str(msg_id), None)
    N.escribir(HOME / "pendientes.json", d)
    return tuple(valor)


async def _on_respuesta(update, context) -> None:
    m = update.message
    gid, verbo, persona = _pendientes_sacar(m.reply_to_message.message_id)
    if _persona_de(m.from_user.id)[0] != persona:
        await m.reply_text("Solo puede responder quien pulsó el botón.")
        return
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
            p["estado"] = "firmada"; p["resultado"] = out.decode("utf-8", errors="replace").strip().splitlines()[-1] if out else "firmada"
            texto = f"{_cabecera(p)}\n{_resultado_claro(p['resultado'])}"
        else:
            p["estado"] = "error"; p["error"] = err.decode("utf-8", errors="replace").strip()[-500:]
            texto = (f"{_cabecera(p)}\n⚠️ Tu decisión no se ha podido registrar, así que no se ha aplicado.\n"
                     f"Motivo: {p['error'].replace('NOTARIO: rechazado — ', '')}\n"
                     "Normalmente es porque el proyecto cambió después de abrir esta puerta: espera a la siguiente.")
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
                        # la lista del kanban no trae latest_summary (solo `show`): el motivo está en el último error o el resultado
                        motivo = _corta_linea(t.get("last_failure_error") or t.get("latest_summary") or t.get("result") or "")
                        await bot.send_message(chat_id=int(chat), text=(
                            f"⚠️ «{b['slug']}» se ha parado en «{t.get('title')}».\n"
                            + (f"Motivo: {motivo}\n" if motivo else "")
                            + "No sigue solo: hay que revisarlo y relanzar ese paso.\n"
                            f"(Detalle técnico: hermes kanban --board {b['slug']} show {t['id']})"))
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
        raise RuntimeError(err.decode("utf-8", errors="replace")[-300:])
    return json.loads(out)["id"]


async def _consultar_jev(puerta: dict) -> dict:
    """Pregunta a Jev por esta puerta con sdd-jev.mjs (el mismo cliente que usa el método). Nunca lanza: un fallo
    vuelve como {"error"} y la puerta queda para una persona."""
    import tempfile
    sdd_jev = _root() / "metodo" / "scripts" / "sdd-jev.mjs"
    try:
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "q.json").write_text(json.dumps({"questions": N.pregunta_jev(puerta)}))
            (Path(d) / "i.jsonl").write_text(json.dumps({"id": puerta["id"], "state": N.estado_jev(puerta)}) + "\n")
            proc = await asyncio.create_subprocess_exec(
                "node", str(sdd_jev), "judge", "--questions", str(Path(d) / "q.json"), "--items", str(Path(d) / "i.jsonl"),
                stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE, env={**os.environ, "PATH": PATH_CMDS})
            out, err = await asyncio.wait_for(proc.communicate(), 180)
        if proc.returncode == 3:
            return {"error": "Jev apagado: " + (err.decode("utf-8", errors="replace").strip() or "falta TYPESAFE_API_KEY")}
        res = json.loads(out or b"{}")
        if not res.get("items"):
            return {"error": ((res.get("errors") or [{}])[0].get("error") or err.decode("utf-8", errors="replace").strip() or "sin respuesta")[:300]}
        a = res["items"][0]["answers"]["decision"]
        return {"choice": a.get("choice"), "p": float((a.get("p") or {}).get(a.get("choice"), 0)),
                "confidence": a.get("confidence"), "modelo": res.get("model") or "jev"}
    except Exception as e:
        return {"error": str(e)[:300]}


async def _jev_en_puerta(idx: Path, p: dict) -> dict:
    """Si el proyecto tiene a Jev activo y aún no ha juzgado esta puerta, lo juzga (y decide si el modo lo deja)."""
    if p.get("estado") != "abierta" or "jev" in p or N.modo_jev(p.get("tablero", "")) == "humano":
        return p
    juicio = await _consultar_jev(p)
    try:
        p = N.aplicar_jev(p["id"], juicio)
    except N.Rechazo:
        return _leer(idx) or p
    j = p.get("jev", {})
    log.info("hermes-sdd: Jev en %s → %s (p %s, decide %s: %s)", p["id"], j.get("choice") or j.get("error"),
             j.get("p"), j.get("decide"), j.get("motivo"))
    return p


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
        p = await _jev_en_puerta(idx, p)
        # Se publica también la que Jev acaba de decidir: así la ves, con su botón de deshacer, antes de que se firme
        if (p.get("estado") == "abierta" and not p.get("telegram")) or (p.get("estado") == "decidida" and "telegram" not in p):
            await asyncio.wait_for(_publicar(bot, p), 60)
            with N.cerrojo():
                actual = _leer(idx) or p
                actual.update(telegram=p["telegram"], publicada=p["publicada"], tg_vista=p["tg_vista"])
                _escribir(idx, actual)
        elif (p.get("estado") == "decidida" and time.time() >= p.get("firmar_en", 0)
              and (p.get("decision") or {}).get("actor", {}).get("canal") != "local"):   # el local lo firma decidir.sh
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
    # errors="replace": una salida con bytes que no son UTF-8 (un mensaje de otra herramienta, una tilde cortada) no
    # debe convertir en fallo lo que salió bien (/encargado, 11/11/2026: el tema quedó creado pero «no enlazado»)
    if proc.returncode != 0:
        detalle = (err or out).decode("utf-8", errors="replace").strip()
        log.warning("hermes-sdd: %s salió con %s: %s", " ".join(args[:3]), proc.returncode, detalle[-800:])
        raise RuntimeError(detalle[-300:])
    if err:
        log.info("hermes-sdd: %s avisó por stderr: %s", " ".join(args[:3]), err.decode("utf-8", errors="replace").strip()[-400:])
    return out.decode("utf-8", errors="replace")


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


async def _resumen_proyecto(board: str, repo: str) -> str:
    e = PR.estado(repo, board, await _tarjetas(board))   # la misma foto que `hsdd_proyectos.py estado` y el encargado
    lineas = [f"📁 {board}" + (" ⏸ en pausa" if e["pausado"] else "")]
    if e["puertas"]:
        lineas.append(f"  🚪 Esperando tu decisión: {', '.join(p['titulo'] or '' for p in e['puertas'])}")
    if e["trabajando"]:
        lineas.append(f"  ▶ Trabajando en: {e['trabajando']}")
    if e["paradas"]:
        lineas.append(f"  ⚠️ Parado en: {', '.join(t['titulo'] or '' for t in e['paradas'])}")
    if e["aparcadas"]:
        lineas.append(f"  ⏳ {_plural(e['aparcadas'], 'paso espera', 'pasos esperan')} a que se renueve la cuota de Claude")
    if not (e["puertas"] or e["trabajando"] or e["paradas"] or e["aparcadas"]):
        lineas.append("  ✅ Entregado" if e["entregado"] else "  💤 Sin nada en marcha")
    lineas.append(f"  {_plural(e['pasos_hechos'], 'paso hecho', 'pasos hechos')} · {e['coste_usd']} $ gastados")
    return "\n".join(lineas)


async def _estado_texto(filtro: str = "") -> str:
    proys = await _proyectos()
    if filtro:
        proys = {b: r for b, r in proys.items() if b == filtro}
    if not proys:
        return f"No conozco ningún proyecto llamado «{filtro}»." if filtro else "Todavía no hay proyectos. Crea uno con /nuevo."
    partes = [await _resumen_proyecto(b, r) for b, r in sorted(proys.items())]
    lat = _leer(HOME / "latido.json", {}) or {}
    cuota = _leer(HOME / "cuota.json")
    pie = "💓 Todo conectado" if lat.get("ts") else "⚠️ El gateway no da señales: no se registrarán decisiones hasta que vuelva"
    if cuota:
        pie += f"\n⛔ Se ha agotado la cuota de Claude: se sigue a las {datetime.fromtimestamp(cuota['reset_at']).strftime('%H:%M')}"
    return "\n\n".join(partes) + "\n\n" + pie


def _autorizado_en_sesion():
    """Persona que escribe el comando (Telegram), o None."""
    try:
        from gateway.session_context import get_session_env
        uid = get_session_env("HERMES_SESSION_USER_ID") or ""
    except Exception:
        uid = ""
    return (_persona_de(uid)[0], uid) if uid else (None, "")


async def _tema_encargado(nombre: str, repo: str, uid: str, bienvenida: str = "") -> str:
    """Tema «🧭 nombre» en el chat privado con el bot, enlazado con el encargado del proyecto (profile_routes por chat y
    tema; encargado.sh tema). El gateway carga la ruta al arrancar: se reinicia solo, desde fuera de su proceso."""
    bot = _RT["app"].bot
    try:
        tema = await bot.create_forum_topic(chat_id=int(uid), name=f"🧭 {nombre}")
    except Exception as e:
        return (f"No pude crear el tema: {e}. Activa los temas del bot en @BotFather (Mini App → My bots → el bot → "
                "Bot Settings → Threads Settings → Threaded Mode) y pídelo con /encargado " + nombre)
    hilo = tema.message_thread_id
    try:
        await _cli("bash", str(_root() / "encargado.sh"), "tema", repo, str(uid), str(hilo))
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
    partes = ["🗞 Así van tus proyectos", await _estado_texto()]
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
        partes.append(f"Esta semana aceptaste {_plural(len(dwell), 'fase', 'fases')}; normalmente mirando la demo {med} s antes de decidir.{aviso}")
    return "\n\n".join(partes)

# ── registro ────────────────────────────────────────────────────────────────────────────────────────────────────
def register(ctx):
    def _wire(application, adapter):
        from telegram.ext import CallbackQueryHandler, MessageHandler, filters

        class _EsRespuestaDePuerta(filters.MessageFilter):
            def filter(self, message):
                r = message.reply_to_message
                return bool(r and _pendientes_hay(r.message_id))

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
            return "No tienes nada pendiente de decidir."
        for p in abiertas:   # el bucle las vuelve a publicar con sus botones
            p.pop("telegram", None)
            _escribir(HOME / "puertas" / f"{p['id']}.json", p)
        return f"Tienes {_plural(len(abiertas), 'decisión pendiente', 'decisiones pendientes')}: te las reenvío con sus botones."

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

    async def _cmd_encargado(raw_args: str = "") -> str:
        """/encargado <proyecto>: crea (si falta) el encargado del proyecto y un tema «🧭 proyecto» en este chat que
        habla con él (profile_routes por chat y tema). Requiere el modo de temas del bot (BotFather → Threaded Mode)."""
        persona, uid = _autorizado_en_sesion()
        if not persona:
            return "Solo una persona autorizada puede crear el encargado de un proyecto."
        proys = await _proyectos()
        nombre = raw_args.strip()
        encs = _leer(HOME / "encargados.json", {}) or {}
        if not nombre or nombre not in proys:
            lista = ", ".join(f"{b}{' 🧭' if any(r == repo for r in encs.values()) else ''}" for b, repo in sorted(proys.items()))
            return (("" if not nombre else f"No conozco el proyecto «{nombre}».\n") +
                    f"Uso: /encargado <proyecto>. Proyectos: {lista or 'ninguno'} (🧭 = ya tiene encargado).")
        repo = proys[nombre]
        try:
            if not any(r == repo for r in encs.values()):
                await _cli("bash", str(_root() / "encargado.sh"), "crear", repo, timeout=300)
            rutas = json.loads(await _cli("hermes", "config", "get", "gateway.profile_routes", "--json") or "[]")
        except Exception as e:
            return f"No se pudo preparar el encargado de {nombre}: {e}"
        if any(r.get("name") == f"encargado-{nombre}" for r in rutas if isinstance(r, dict)):
            return f"El encargado de {nombre} ya tiene su tema «🧭 {nombre}» en este chat: escríbele allí."
        return await _tema_encargado(nombre, repo, uid)

    async def _cmd_preparar(raw_args: str = "") -> str:
        """/preparar <nombre> [stack] <qué quieres construir> — crea el proyecto SIN lanzarlo, con su encargado y su
        tema: allí le das documentos o requisitos casi listos, te pregunta lo que falte y lo lanza cuando digas."""
        persona, uid = _autorizado_en_sesion()
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
        tema = await _tema_encargado(r["tablero"], r["repo"], uid, bienvenida=(
            f"🧭 Soy el encargado de «{r['tablero']}». El proyecto aún no ha arrancado: pásame lo que tengas "
            "(documentos, requisitos casi listos, capturas, enlaces) y te preguntaré lo que falte, con opciones y la "
            "que recomiendo primero. Cuando lo tengamos, dime «lanza» y arranca con todo eso."))
        return (f"🧭 Proyecto {r['tablero']} preparado (sin lanzar)\n📁 {r['repo']}\n🧱 {r['stack']}\n{tema}")

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

    async def _cmd_jev(raw_args: str = "") -> str:
        """/jev → modos actuales · /jev <modo> → modo por defecto · /jev <proyecto> <modo> → modo de un proyecto."""
        partes = raw_args.split()
        if partes:
            persona, _ = _autorizado_en_sesion()
            if not persona:
                return "Solo una persona autorizada puede cambiar el modo de Jev."
            try:
                if len(partes) == 1:
                    N.poner_modo(partes[0])
                else:
                    if partes[0] not in await _proyectos():
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
        persona, _ = _autorizado_en_sesion()
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
        return (f"🚀 Proyecto {r['tablero']} en marcha\n📁 {r['repo']}\n🧱 {r['stack']} · 🤖 Jev {r['jev']}\n"
                "Te llegará la puerta de Requisitos cuando el ejecutor los tenga.")

    ctx.register_telegram_handler(_wire)
    # args_hint siempre entre [ ]: Hermes deja fuera del menú de Telegram las órdenes cuya ayuda empieza por «<»
    # (argumento obligatorio). Sin argumentos, cada orden explica cómo se usa.
    ctx.register_command("nuevo", _cmd_nuevo, description="Crea y lanza un proyecto",
                         args_hint="[nombre] [stack] [qué quieres construir]")
    ctx.register_command("jev", _cmd_jev, description="Modo de Jev en las puertas",
                         args_hint="[proyecto] [modo]")
    ctx.register_command("cambio", _cmd_cambio, description="Pide un cambio a un proyecto", args_hint="[proyecto] [petición]")
    ctx.register_command("estado", _cmd_estado, description="Estado de los proyectos", args_hint="[proyecto]")
    ctx.register_command("pausar", _cmd_pausar, description="Pausa un proyecto (ahora = detener)", args_hint="[proyecto|todo] [ahora]")
    ctx.register_command("reanudar", _cmd_reanudar, description="Reanuda un proyecto en pausa", args_hint="[proyecto|todo]")
    ctx.register_command("anular", _cmd_anular, description="Anula la aceptación de una FASE", args_hint="[proyecto] [fase] [motivo]")
    ctx.register_command("mantenimiento", _cmd_mantenimiento, description="Revisa los proyectos entregados", args_hint="[proyecto]")
    ctx.register_command("puertas", _cmd_puertas, description="Decisiones pendientes, con sus botones")
    ctx.register_command("preparar", _cmd_preparar, description="Prepara un proyecto con su encargado",
                         args_hint="[nombre] [stack] [qué quieres construir]")
    ctx.register_command("encargado", _cmd_encargado, description="Habla con el encargado de un proyecto",
                         args_hint="[proyecto]")

    # El encargado de cada proyecto (perfil sdd-p-<proyecto>, encargado.sh): al abrir una sesión encuentra en su prompt
    # la foto de su proyecto y lo que pasó desde su última sesión (Hermes congela la sección por sesión)
    def _foto_encargado(info) -> str:
        perfil = str((info or {}).get("profile_name") or "")
        if not perfil.startswith("sdd-p-"):
            return ""
        try:
            return PR.foto_encargado(perfil)
        except Exception as e:   # nunca romper el prompt del perfil por un fallo de la foto
            log.warning("hermes-sdd: foto del encargado %s: %s", perfil, e)
            return ""
    if hasattr(ctx, "register_system_prompt_section"):
        ctx.register_system_prompt_section("hermes-sdd.encargado", _foto_encargado, max_chars=4000)
