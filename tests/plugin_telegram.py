"""Plugin de Telegram con bot y updates falsos (sin red). Ejecutar con el Python de Hermes (trae python-telegram-bot).
   tests/plugin_telegram.sh lo lanza."""
import asyncio, importlib.util, json, os, subprocess, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace as NS

ROOT = Path(__file__).resolve().parent.parent
T = Path(tempfile.mkdtemp()); HOME = T / "home"; (HOME / "puertas").mkdir(parents=True)
os.environ.update(HERMES_SDD_HOME=str(HOME), HERMES_SDD_DESHACER_S="1", TELEGRAM_HOME_CHANNEL="111")
spec = importlib.util.spec_from_file_location("hsdd", ROOT / "plugin/hermes-sdd/__init__.py"); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)

fallos = 0
def ok(c, t):
    global fallos
    print(("ok   " if c else "FAIL ") + t); fallos += (not c)

class Bot:
    def __init__(s): s.enviados, s.editados, s.n = [], [], 100
    async def send_message(s, chat_id, text, reply_markup=None, **k):
        s.n += 1; s.enviados.append((text, reply_markup)); return NS(chat_id=chat_id, message_id=s.n)
    async def edit_message_text(s, chat_id, message_id, text, reply_markup=None): s.editados.append((text, reply_markup))
    async def send_video(s, **k): s.enviados.append(("video", None))
    async def send_media_group(s, **k): s.enviados.append(("fotos", None))
    async def send_photo(s, **k): s.enviados.append(("foto", None))

class Query:
    def __init__(s, data, uid): s.data, s.from_user, s.id = data, NS(id=uid, username="u"), "cb1"; s.message = NS(chat_id=111, message_id=7); s.respuestas = []
    async def answer(s, text=None, show_alert=False): s.respuestas.append(text)

# repo de prueba con una puerta de FASE
R = T / "repo"; (R / ".sdd/hermes/puertas").mkdir(parents=True); (R / "evidencias/FASE-0").mkdir(parents=True)
(R / "evidencias/FASE-0/a.png").write_bytes(b"x"); (R / "evidencias/FASE-0/b.png").write_bytes(b"x")
(HOME / "aprobadores.json").write_text(json.dumps({"andres": {"nombre": "Andrés", "rol": "Cliente", "canales": {"telegram": "111"}}}))
(HOME / "instalacion.json").write_text(json.dumps({"root": str(T / "arnes")}))
(T / "arnes").mkdir(); (T / "arnes/firmar.sh").write_text('echo "firmado $2"; [ -f "$1/.sdd/hermes/decisiones/$2.json" ]')
opc = [{"verbo": "ver", "etiqueta": "▶ Ver demo", "paso": 1}, {"verbo": "acepto", "etiqueta": "✅ Aceptar", "paso": 2},
       {"verbo": "rechazo", "etiqueta": "❌ Rechazar", "texto": True, "paso": 2}]
puerta = {"id": "t_1", "tipo": "fase", "fase": "0", "tablero": "demo", "repo": str(R), "titulo": "Aceptar FASE-0",
          "texto": "Sin alertas", "opciones": opc, "estado": "abierta"}
(HOME / "puertas/t_1.json").write_text(json.dumps(puerta))
bot = Bot(); ctx = NS(bot=bot)
leer = lambda: json.loads((HOME / "puertas/t_1.json").read_text())

async def main():
    m._RT["app"] = NS(bot=bot)
    await m._publicar(bot, puerta); (HOME / "puertas/t_1.json").write_text(json.dumps(puerta))
    kb = bot.enviados[-1][1]; datos = [b.callback_data for f in kb.inline_keyboard for b in f]
    ok(datos == ["g:ver:t_1"], f"paso 1 solo ofrece Ver demo ({datos})")
    q = Query("g:acepto:t_1", 999); await m._on_boton(NS(callback_query=q), ctx)
    ok("No estás autorizado" in (q.respuestas[-1] or ""), "rechaza a quien no es aprobador")
    q = Query("g:ver:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok(any(t == "fotos" for t, _ in bot.enviados), "Ver demo envía las capturas")
    datos = [b.callback_data for f in bot.editados[-1][1].inline_keyboard for b in f]
    ok("g:acepto:t_1" in datos and "g:ver:t_1" not in datos, "tras ver la demo aparecen Aceptar/Rechazar")
    q = Query("g:rechazo:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    pid = max(m._RT["pendientes"]); ok(len(m._RT["pendientes"]) == 1, "Rechazar pide el motivo con respuesta forzada")
    msg = NS(text="falta el filtro", from_user=NS(id=111, username="u"), message_id=9, reply_to_message=NS(message_id=pid))
    async def rep(t): msg.r = t
    msg.reply_text = rep
    await m._on_respuesta(NS(message=msg), ctx)
    d = json.loads((R / ".sdd/hermes/decisiones/t_1.json").read_text())
    ok(d["verbo"] == "rechazo" and d["texto"] == "falta el filtro" and d["actor"]["id"] == "111", "la respuesta crea la decisión con identidad de Telegram")
    ok(leer()["estado"] == "decidida" and leer()["decision"].get("dwell_s", -1) >= 0, "puerta decidida, con el tiempo desde que vio la demo")
    q = Query("g:deshacer:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok(leer()["estado"] == "abierta" and not (R / ".sdd/hermes/decisiones/t_1.json").exists(), "Deshacer borra la decisión y reabre")
    q = Query("g:acepto:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok(leer()["estado"] == "decidida", "Aceptar deja la decisión pendiente de firma")
    q = Query("g:rechazo:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok("ya está resuelta" in (q.respuestas[-1] or ""), "un segundo clic no cambia una decisión tomada")
    time.sleep(1.1); await m._firmar(bot, leer())
    ok(leer()["estado"] == "firmada" and "firmado t_1" in leer()["resultado"], "pasada la ventana, firma el notario y queda el acta")
    q = Query("g:deshacer:t_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok("Ya no se puede deshacer" in (q.respuestas[-1] or ""), "después de firmar ya no se puede deshacer")

asyncio.run(main()); sys.exit(1 if fallos else 0)
