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
    # entrega de una sola FASE (sin «fase», con «unica»): su demo es la de la FASE-0 (taller2: «Esta fase no trae demo»)
    n0 = len(bot.enviados)
    await m._enviar_demo(bot, 111, {**puerta, "tipo": "entrega", "fase": "", "unica": True})
    nuevos = bot.enviados[n0:]
    ok(any(t == "fotos" for t, _ in nuevos) and not any("no trae demo" in str(x) for _, x in nuevos),
       f"entrega de una sola FASE: envía la demo de la FASE-0 ({nuevos})")
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
    # solo lo marcado: la recomendada de Q1 la aplica el notario al dar conformidad (así distingue lo elegido)
    ok(d["texto"] == "Q2: C", f"la decisión lleva solo las respuestas que se marcaron en el formulario ({d['texto']})")
    # «👉 … esto lanzará» se recalcula con lo marcado en los botones Q (era fijo con las recomendadas)
    sin = {"efecto": "ninguno", "ficheros": []}
    pl = {"id": "t_3", "tipo": "requisitos", "tablero": "demo", "repo": str(R), "titulo": "Requisitos",
          "texto": "📝 Requisitos\n\n👉 Si firmas sin tocar los botones Q, esto lanzará: sin más efecto: Q1, Q2.",
          "opciones": [{"verbo": "acepto", "etiqueta": "✅ Apruebo"}], "estado": "abierta",
          "preguntas": [{"n": 1, "id": "Q-a", "opciones": ["A", "B"], "recomendada": "A",
                         "efectos": {"A": sin, "B": {"efecto": "req-change", "ficheros": []}}},
                        {"n": 2, "id": "Q-b", "opciones": ["A", "B"], "recomendada": "A",
                         "efectos": {"A": sin, "B": {"efecto": "editar-test", "ficheros": ["tests/a.test.js"]}}}]}
    (HOME / "puertas/t_3.json").write_text(json.dumps(pl))
    await m._publicar(bot, pl); (HOME / "puertas/t_3.json").write_text(json.dumps(pl))
    ok(bot.enviados[-1][0].endswith("esto lanzará: sin más efecto: Q1, Q2."), "sin tocar los botones Q: lo de las recomendadas")
    q = Query("g:q1B:t_3", 111); await m._on_boton(NS(callback_query=q), ctx)
    q = Query("g:q2B:t_3", 111); await m._on_boton(NS(callback_query=q), ctx)
    t = bot.editados[-1][0]
    ok("👉 Con lo que has marcado en los botones Q, firmar lanzará: 📝 abre un cambio de requisitos (antes de seguir te llega su puerta): Q1"
       " · ✏️ autoriza editar tests que ya existían: tests/a.test.js (Q2)." in t and "Si firmas sin tocar" not in t,
       f"al pulsar un botón Q se reescribe «esto lanzará» con lo marcado ({t[-200:]})")
    largo = "📝 Requisitos\n" + "\n".join(f"• requisito {i} " + "x" * 60 for i in range(80)) + "\n\n❓ Antes, una pregunta:\n\n1. ¿?\n\n" + pl["texto"].splitlines()[-1]
    c = m._cabe(largo)
    ok(len(c) <= 4000 and c.startswith("📝 Requisitos") and c.endswith(pl["texto"].splitlines()[-1]) and "❓ Antes" in c and "✂️" in c,
       "un mensaje de más de 4000 caracteres se recorta por en medio: las preguntas y «esto lanzará» siguen")
    sob = m._sobrante(largo)
    ok(sob and "requisito 79" in sob and "❓" not in sob and "requisito 79" not in c and len(c) + len(sob) >= len(largo) - 200,
       "lo que se recorta del medio se manda antes en su propio mensaje: no se pierde nada")
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
    # (puertas de requisitos iniciales: las que siguen yendo al modelo; un plan limpio ya lo firma una regla, sin él)
    juicios = {"j_1": {"choice": "acepto", "p": 0.96, "confidence": "high", "modelo": "jev-test"},
               "j_2": {"choice": "persona", "p": 0.8, "confidence": "medium", "modelo": "jev-test"}}
    consultadas = []
    async def falso_jev(p):
        consultadas.append(p["id"]); return juicios[p["id"]]
    m._consultar_jev = falso_jev
    (HOME / "jev.json").write_text(json.dumps({"defecto": "humano", "proyectos": {"local": "auto"}}))
    for gid in ("j_1", "j_2"):
        (HOME / f"puertas/{gid}.json").write_text(json.dumps({
            "id": gid, "tipo": "requisitos", "tablero": "", "repo": str(R), "titulo": "Requisitos", "texto": "12 requisitos", "estado": "abierta",
            "opciones": [{"verbo": "acepto", "etiqueta": "✅ Apruebo"}, {"verbo": "cambios", "etiqueta": "✏️ Falta o sobra algo", "texto": True}]}))
    for f in HOME.glob("puertas/t_*.json"):   # las de las otras pruebas, fuera del bucle
        f.unlink()
    for f in HOME.glob("puertas/f*.json"):
        f.unlink()
    antes = len(bot.enviados)
    await m._vuelta(1)
    j1 = json.loads((HOME / "puertas/j_1.json").read_text()); j2 = json.loads((HOME / "puertas/j_2.json").read_text())
    ok(j1["estado"] == "decidida" and j1["decision"]["actor"]["canal"] == "jev", "auto: el bucle consulta a Jev y registra su decisión")
    textos = [t for t, _ in bot.enviados[antes:]]
    ok(any("Jev lo ha decidido por ti: ✅ Apruebo (seguridad 96 %)" in t and "↩ Deshacer" in t for t in textos),
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

async def firmada_fuera():
    # decidida y firmada desde el ordenador: el mensaje de Telegram deja de ofrecer «Deshacer»
    p = {"id": "f_1", "tipo": "plan", "titulo": "Plan", "tablero": "demo", "estado": "firmada",
         "resultado": "Plan conforme (Andrés León, Cliente)", "texto": "x", "opciones": [],
         "telegram": [{"chat": 111, "msg": 6}], "tg_vista": "decidida|1|2026|{}"}
    (HOME / "puertas/f_1.json").write_text(json.dumps(p))
    bot = Bot(); await m._sincronizar(bot, p)
    ok(len(bot.editados) == 1 and bot.editados[0][1] is None and "Plan conforme" in bot.editados[0][0],
       f"firmada desde otro canal: el mensaje se pone al día y sin botones ({bot.editados})")

async def reintentos():
    # una etapa cuyo worker perdió el kanban se reintenta sola, dos veces como mucho por etapa, FASE y HEAD; con el
    # candado del repo vivo, no (sigue en marcha)
    llamadas = []
    perdida = {"id": "t_p", "title": "Implementar FASE-2", "status": "blocked", "assignee": "sdd-estacion",
               "last_failure_error": "Kanban execution unknown; retained by owner",
               "body": f"Ejecuta: bash /x/etapa.sh {R} implementar 2"}
    fallida = {**perdida, "id": "t_f", "title": "Aceptar FASE-2", "last_failure_error": "quedan tareas sin hacer",
               "body": f"Ejecuta: bash /x/etapa.sh {R} aceptar 2"}
    async def proyectos(): return {"demo": str(R)}
    async def tarjetas(b): return [perdida, fallida]
    async def cli(*a, timeout=60):
        llamadas.append(a)
        return "abc123\n" if a[:2] == ("git", "-C") else "t_nueva\n"
    viejos = (m._proyectos, m._tarjetas, m._cli)
    m._proyectos, m._tarjetas, m._cli = proyectos, tarjetas, cli
    try:
        b = Bot(); hechos = []
        for _ in range(3):
            hechos += await m._reintentar_perdidos(b)
        lanz = [a for a in llamadas if a[:1] == ("bash",)]
        ok(len(lanz) == 2 and all(a[2:] == ("reintentar", str(R), "implementar", "2", "--de", "t_p") for a in lanz),
           f"worker perdido: se reintenta solo (con sus hijas), dos veces como mucho con el mismo HEAD ({len(lanz)} veces)")
        ok(not any("aceptar" in a for a in lanz), "una etapa que falló por sí misma no se reintenta sola")
        ok(any("lo repito solo" in t for t, _ in b.enviados), "y se avisa, sin ruido (sin sonido)")
        llamadas.clear(); (HOME / "reintentos.json").unlink()
        (R / ".sdd/hermes/lock").mkdir(parents=True, exist_ok=True); (R / ".sdd/hermes/lock/pid").write_text(str(os.getpid()))
        await m._reintentar_perdidos(b)
        ok(not [a for a in llamadas if a[:1] == ("bash",)], "con el candado del repo vivo no se reintenta (la etapa sigue)")
        import shutil; shutil.rmtree(R / ".sdd/hermes/lock")
    finally:
        m._proyectos, m._tarjetas, m._cli = viejos

async def puerta_rota():
    # una puerta que falla en el bucle no impide atender a las demás; sin Telegram conectado, se sigue firmando
    for f in HOME.glob("puertas/*.json"):
        f.unlink()
    (HOME / "puertas/r_1.json").write_text(json.dumps({"id": "r_1", "tipo": "plan", "estado": "abierta", "repo": str(R),
                                                       "tablero": "demo", "titulo": "Plan"}))
    (R / ".sdd/hermes/decisiones").mkdir(parents=True, exist_ok=True); (R / ".sdd/hermes/decisiones/r_2.json").write_text("{}")
    (HOME / "puertas/r_2.json").write_text(json.dumps({"id": "r_2", "tipo": "plan", "estado": "decidida", "repo": str(R),
        "tablero": "", "titulo": "Plan", "firmar_en": 0, "decision": {"actor": {"canal": "telegram"}}}))
    async def roto(p): raise RuntimeError("kanban caído")
    real = m._crear_tarjeta; m._crear_tarjeta = roto
    app = m._RT["app"]; m._RT["app"] = None
    async def nada(*a, **k): return []
    reales = (m._limpiar_tableros, m._reintentar_perdidos); m._limpiar_tableros = nada; m._reintentar_perdidos = nada
    m.log.disabled = True   # el error de r_1 se registra (con su traza): aquí no hace falta verlo
    try:
        await m._vuelta(1)
    finally:
        m.log.disabled = False
        m._crear_tarjeta = real; m._RT["app"] = app; m._limpiar_tableros, m._reintentar_perdidos = reales
    ok(json.loads((HOME / "puertas/r_2.json").read_text())["estado"] == "firmada",
       "una puerta que falla no bloquea a las demás, y sin Telegram se firma igual")

async def cerrojos():
    # Escrituras del índice y del estado del plugin: todas leen-modifican-escriben con N.actualizar (bajo el cerrojo)
    import threading, logging
    N = m.N
    # 1) sin perder escrituras: 4 hilos de este proceso y 2 procesos suman a la vez en el mismo fichero
    cont = HOME / "contador.json"; cont.unlink(missing_ok=True)
    def suma(d): d["n"] = d.get("n", 0) + 1; return d
    hilos = [threading.Thread(target=lambda: [N.actualizar(cont, suma, {}) for _ in range(50)]) for _ in range(4)]
    codigo = ("import sys; sys.path.insert(0, sys.argv[1]); import hsdd_nucleo as N; from pathlib import Path\n"
              "for _ in range(50): N.actualizar(Path(sys.argv[2]), lambda d: {**d, 'n': d.get('n', 0) + 1}, {})")
    procs = [subprocess.Popen([sys.executable, "-c", codigo, str(ROOT / "plugin/hermes-sdd"), str(cont)]) for _ in range(2)]
    for h in hilos: h.start()
    for h in hilos: h.join()
    for pr in procs: pr.wait()
    ok(json.loads(cont.read_text()).get("n") == 300, f"actualizar no pierde escrituras entre hilos y procesos ({json.loads(cont.read_text()).get('n')} de 300)")
    ok(not [f for f in HOME.iterdir() if f.name.endswith(".tmp")], "y no deja temporales (únicos por pid, hilo y aleatorio)")
    cont.unlink()
    # 2) /puertas contra una decisión a la vez: /puertas lee la puerta abierta, la decisión entra mientras tanto y
    #    /puertas escribe. Antes (sin cerrojo) volvía a dejar «abierta» con la decisión ya escrita en el repo.
    for f in HOME.glob("puertas/*.json"): f.unlink()
    pz = {"id": "z_1", "tipo": "plan", "tablero": "demo", "repo": str(R), "titulo": "Plan", "estado": "abierta",
          "opciones": [{"verbo": "conforme", "etiqueta": "✅ Conforme"}], "telegram": {"chat": 111, "msg": 5}}
    (HOME / "puertas/z_1.json").write_text(json.dumps(pz))
    leido, decidida = threading.Event(), threading.Event()
    leer_real = N.leer
    def leer_lento(p, defecto=None):
        v = leer_real(p, defecto)
        if threading.current_thread().name == "puertas" and Path(p).name == "z_1.json" and not leido.is_set():
            leido.set(); decidida.wait(0.5)   # con cerrojo, la decisión espera a que /puertas acabe (no llega a tiempo)
        return v
    def decide():
        leido.wait(2); N.decidir("z_1", "conforme", "", "andres", "telegram", "111", {}); decidida.set()
    N.leer = leer_lento
    try:
        t1 = threading.Thread(target=m._republicar_abiertas, name="puertas"); t2 = threading.Thread(target=decide)
        t1.start(); t2.start(); t1.join(); t2.join()
    finally:
        N.leer = leer_real
    z = json.loads((HOME / "puertas/z_1.json").read_text())
    ok(z["estado"] == "decidida" and z["decision"]["verbo"] == "conforme",
       f"/puertas a la vez que una decisión no la pisa (índice «{z['estado']}»)")
    # 3) un JSON roto en el índice no se salta en silencio: aviso en el log y /puertas lo cuenta
    (HOME / "puertas/z_roto.json").write_text("{roto")
    avisos = []
    class H(logging.Handler):
        def emit(s, r): avisos.append(r.getMessage())
    h = H(); logging.getLogger("hermes_plugins.hermes_sdd").addHandler(h)
    try:
        await m._vuelta_puerta(None, HOME / "puertas/z_roto.json")
        txt = m._republicar_abiertas()
    finally:
        logging.getLogger("hermes_plugins.hermes_sdd").removeHandler(h)
    ok(len([a for a in avisos if "z_roto.json" in a]) == 1, f"un JSON roto deja un aviso en el log, una vez ({len(avisos)})")
    ok("z_roto" in txt and "no se puede leer" in txt, "y /puertas dice que hay una puerta que no se puede leer")
    (HOME / "puertas/z_roto.json").unlink(); (HOME / "puertas/z_1.json").unlink()
    # 4) el motivo pendiente es de quien pulsó: si responde otra persona autorizada no se consume
    (HOME / "aprobadores.json").write_text(json.dumps({
        "andres": {"nombre": "Andrés", "rol": "Cliente", "canales": {"telegram": "111"}},
        "bea": {"nombre": "Bea", "rol": "Cliente", "canales": {"telegram": "222"}}}))
    pr = {"id": "z_2", "tipo": "plan", "tablero": "demo", "repo": str(R), "titulo": "Plan", "estado": "abierta",
          "opciones": [{"verbo": "rechazo", "etiqueta": "❌ Rechazar", "texto": True}]}
    (HOME / "puertas/z_2.json").write_text(json.dumps(pr))
    m._pendientes_guardar(555, ("z_2", "rechazo", "andres"))
    def respuesta(uid, texto):
        r = NS(text=texto, from_user=NS(id=uid, username="u"), message_id=600 + uid, reply_to_message=NS(message_id=555), r=None)
        async def rep(t): r.r = t
        r.reply_text = rep
        return r
    otra = respuesta(222, "lo rechazo yo"); await m._on_respuesta(NS(message=otra), ctx)
    ok("Solo puede responder quien pulsó" in (otra.r or "") and m._pendientes_hay(555),
       "si responde otra persona, se le dice y la espera sigue (no se pierde)")
    suya = respuesta(111, "falta el mapa"); await m._on_respuesta(NS(message=suya), ctx)
    z2 = json.loads((HOME / "puertas/z_2.json").read_text())
    ok(z2["estado"] == "decidida" and z2["decision"]["texto"] == "falta el mapa" and not m._pendientes_hay(555),
       "y quien pulsó responde después: su motivo decide la puerta")
    tarde = respuesta(111, "otra vez"); await m._on_respuesta(NS(message=tarde), ctx)
    ok(tarde.r is None, "una segunda respuesta a la misma espera ya no hace nada")
    (HOME / "puertas/z_2.json").unlink()
    # 5) reintentos: comprobar y contar es un paso; si el lanzamiento falla, no gasta la vez
    (HOME / "reintentos.json").unlink(missing_ok=True)
    vistos = []
    hs = [threading.Thread(target=lambda: vistos.append(m._reintento_reservar("x|implementar|2|h"))) for _ in range(6)]
    for h in hs: h.start()
    for h in hs: h.join()
    ok(sorted(vistos) == [0, 0, 0, 0, 1, 2], f"seis vueltas a la vez reservan solo REINTENTOS_MAX reintentos ({sorted(vistos)})")
    m._reintento_reservar("x|implementar|2|h", -1)
    ok(m._reintento_reservar("x|implementar|2|h") == 2, "un reintento que no llegó a lanzarse se devuelve")
    (HOME / "reintentos.json").unlink()

async def todo():
    await main(); await formulario_y_operacion(); await jev(); await superada(); await firmada_fuera()
    await reintentos(); await puerta_rota(); await cerrojos()

asyncio.run(todo()); sys.exit(1 if fallos else 0)
