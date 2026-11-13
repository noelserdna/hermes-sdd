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
    m._RT["app"] = NS(bot=bot); m._RT["bucle"] = asyncio.get_running_loop().create_future()  # bucle "vivo": el test no lo lanza
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
    pend = m._pendientes(); pid = int(max(pend, key=int)) if pend else 0; ok(len(pend) == 1, "Rechazar pide el motivo con respuesta forzada (y lo guarda en disco)")
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

async def formulario_y_operacion():
    # Puerta de plan con dos preguntas: el formulario marca la recomendada y se puede cambiar con un toque
    pq = {"id": "t_2", "tipo": "plan", "tablero": "demo", "repo": str(R), "titulo": "Plan", "texto": "4 FASEs",
          "opciones": [{"verbo": "conforme", "etiqueta": "✅ Conforme"}], "estado": "abierta",
          "preguntas": [{"n": 1, "id": "Q-a", "opciones": ["A", "B"], "recomendada": "A"},
                        {"n": 2, "id": "Q-b", "opciones": ["A", "B", "C"], "recomendada": "A"}]}
    (HOME / "puertas/t_2.json").write_text(json.dumps(pq))
    kb = m._teclado(pq, 1)
    filas = [[b.text for b in f] for f in kb.inline_keyboard]
    ok(filas[0] == ["✓ Q1·A", "Q1·B"] and filas[1][0] == "✓ Q2·A", f"formulario con la recomendada marcada ({filas[:2]})")
    await m._publicar(bot, pq); (HOME / "puertas/t_2.json").write_text(json.dumps(pq))
    q = Query("g:q2C:t_2", 111); await m._on_boton(NS(callback_query=q), ctx)
    ok(json.loads((HOME / "puertas/t_2.json").read_text())["respuestas"] == {"2": "C"}, "un toque cambia la respuesta de Q2 a C")
    q = Query("g:conforme:t_2", 111); await m._on_boton(NS(callback_query=q), ctx)
    d = json.loads((R / ".sdd/hermes/decisiones/t_2.json").read_text())
    ok(d["texto"] == "Q1: A, Q2: C", f"la decisión lleva las respuestas del formulario ({d['texto']})")
    # Estado y resumen con proyectos simulados
    async def falso_cli(*a, timeout=60):
        if a[:4] == ("hermes", "kanban", "boards", "list"):
            return json.dumps([{"slug": "demo", "default_workdir": str(R)}])
        return json.dumps([{"id": "t_9", "title": "Implementar FASE-1", "status": "running", "assignee": "sdd-estacion"}])
    m._cli = falso_cli
    (R / ".sdd/hermes/runs").mkdir(parents=True, exist_ok=True)
    (R / ".sdd/hermes/runs/x.json").write_text(json.dumps({"total_cost_usd": 1.5}))
    tarjetas_viejas = [{"id": "t_1", "title": "Implementar FASE-0", "status": "blocked", "assignee": "sdd-estacion", "created_at": 1},
                       {"id": "t_2", "title": "Implementar FASE-0", "status": "done", "assignee": "sdd-estacion", "created_at": 2},
                       {"id": "t_3", "title": "Aceptar FASE-1", "status": "blocked", "assignee": "sdd-estacion", "created_at": 3}]
    async def tarjetas_falsas(board): return tarjetas_viejas
    real = m._tarjetas; m._tarjetas = tarjetas_falsas
    r = await m._resumen_proyecto("demo", str(R)); m._tarjetas = real
    ok("Parado en: Aceptar FASE-1" in r and "Implementar FASE-0" not in r, f"una tarjeta parada que se relanzó después no sale como parada ({r!r})")
    txt = await m._estado_texto()
    ok("demo" in txt and "Implementar FASE-1" in txt and "1.5 $" in txt, "/estado muestra etapa en curso y coste")
    for i in range(3):   # tres aceptaciones rápidas → aviso de aprobación por inercia
        (HOME / f"puertas/f{i}.json").write_text(json.dumps({"id": f"f{i}", "tipo": "fase", "estado": "firmada",
            "firmar_en": time.time(), "decision": {"verbo": "acepto", "dwell_s": 5}}))
    res = await m._resumen_periodico()
    ok("aceptando muy deprisa" in res, "el resumen avisa de aprobación por inercia")
    ok(m._autorizado_en_sesion()[0] is None, "sin sesión de Telegram no hay persona autorizada (pausar/anular se niegan)")

async def jev():
    # Jev en modo auto: el bucle lo consulta antes de publicar, decide, y el mensaje sale ya decidido con Deshacer
    juicios = {"j_1": {"choice": "conforme", "p": 0.96, "confidence": "high", "modelo": "jev-test"},
               "j_2": {"choice": "persona", "p": 0.8, "confidence": "medium", "modelo": "jev-test"}}
    consultadas = []
    async def falso_jev(p):
        consultadas.append(p["id"]); return juicios[p["id"]]
    m._consultar_jev = falso_jev
    (HOME / "jev.json").write_text(json.dumps({"defecto": "humano", "proyectos": {"local": "auto"}}))
    for gid in ("j_1", "j_2"):
        (HOME / f"puertas/{gid}.json").write_text(json.dumps({
            "id": gid, "tipo": "plan", "tablero": "", "repo": str(R), "titulo": "Plan", "texto": "3 FASEs", "estado": "abierta",
            "opciones": [{"verbo": "conforme", "etiqueta": "✅ Conforme"}, {"verbo": "cambios", "etiqueta": "✏️ Cambiar", "texto": True}]}))
    for f in HOME.glob("puertas/t_*.json"):   # las de las otras pruebas, fuera del bucle
        f.unlink()
    for f in HOME.glob("puertas/f*.json"):
        f.unlink()
    antes = len(bot.enviados)
    await m._vuelta(1)
    j1 = json.loads((HOME / "puertas/j_1.json").read_text()); j2 = json.loads((HOME / "puertas/j_2.json").read_text())
    ok(j1["estado"] == "decidida" and j1["decision"]["actor"]["canal"] == "jev", "auto: el bucle consulta a Jev y registra su decisión")
    textos = [t for t, _ in bot.enviados[antes:]]
    ok(any("Jev lo ha decidido por ti: ✅ Conforme (seguridad 96 %)" in t and "↩ Deshacer" in t for t in textos),
       "el mensaje dice, en claro, que decidió Jev, con su seguridad y hasta cuándo se puede deshacer")
    kb = [b.callback_data for t, k in bot.enviados[antes:] if "Jev lo ha decidido" in t for f in k.inline_keyboard for b in f]
    ok(kb == ["g:deshacer:j_1"], f"y trae el botón Deshacer ({kb})")
    ok(j2["estado"] == "abierta" and any("🤖 Jev prefiere que lo mires tú (está seguro al 80 %)" in t for t in textos),
       "si Jev pide una persona, la puerta sale con su consejo y tus botones")
    await m._vuelta(2)
    ok(consultadas.count("j_1") == 1 and consultadas.count("j_2") == 1, "Jev se consulta una sola vez por puerta")
    q = Query("g:deshacer:j_1", 111); await m._on_boton(NS(callback_query=q), ctx)
    j1 = json.loads((HOME / "puertas/j_1.json").read_text())
    ok(j1["estado"] == "abierta" and j1.get("jev_vetado", {}).get("por") == "andres", "tú deshaces a Jev desde Telegram y la puerta vuelve a ti")
    (HOME / "jev.json").write_text(json.dumps({"defecto": "humano"}))

async def superada():
    # una puerta superada (un cambio la sustituyó o se reabrió) se queda sin botones en Telegram
    p = {"id": "s_1", "tipo": "requisitos", "titulo": "Requisitos", "tablero": "demo", "estado": "superada",
         "superada_por": "reapertura: texto de la puerta corregido", "texto": "x", "opciones": [],
         "telegram": [{"chat": 111, "msg": 5}], "tg_vista": "abierta|1||{}"}
    (HOME / "puertas/s_1.json").write_text(json.dumps(p))
    bot = Bot(); await m._sincronizar(bot, p)
    ok(len(bot.editados) == 1 and bot.editados[0][1] is None and "ya no vale: texto de la puerta corregido" in bot.editados[0][0],
       f"una puerta superada se edita sin botones y dice por qué ({bot.editados})")

async def todo():
    await main(); await formulario_y_operacion(); await jev(); await superada()

asyncio.run(todo()); sys.exit(1 if fallos else 0)
