"""Canal dashboard (backend FastAPI del plugin) y su sincronización con Telegram, sin red ni panel real.
   Ejecutar con el Python de Hermes (fastapi + python-telegram-bot); tests/plugin_dashboard.sh lo lanza."""
import asyncio, getpass, importlib.util, json, os, sys, tempfile
from pathlib import Path
from types import SimpleNamespace as NS

ROOT = Path(__file__).resolve().parent.parent
T = Path(tempfile.mkdtemp()); HOME = T / "home"; (HOME / "puertas").mkdir(parents=True)
os.environ.update(HERMES_SDD_HOME=str(HOME), HERMES_SDD_DESHACER_S="180", TELEGRAM_HOME_CHANNEL="111")

def cargar(nombre, ruta):
    spec = importlib.util.spec_from_file_location(nombre, ruta); mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod); return mod

tg = cargar("hsdd_tg", ROOT / "plugin/hermes-sdd/__init__.py")
api = cargar("hsdd_api", ROOT / "plugin/hermes-sdd/dashboard/plugin_api.py")
from fastapi import FastAPI
from fastapi.testclient import TestClient

fallos = 0
def ok(c, t):
    global fallos
    print(("ok   " if c else "FAIL ") + t); fallos += (not c)

YO = getpass.getuser()
(HOME / "aprobadores.json").write_text(json.dumps({"ana": {"nombre": "Ana", "rol": "Cliente", "canales": {"telegram": "111", "dashboard": YO}}}))
R = T / "repo"; (R / "evidencias/FASE-0").mkdir(parents=True)
(R / "evidencias/FASE-0/a.png").write_bytes(b"\x89PNG-a"); (R / "secreto.txt").write_text("no")
puerta = {"id": "g1", "tipo": "fase", "fase": "0", "tablero": "demo", "repo": str(R), "titulo": "Aceptar FASE-0",
          "texto": "Sin alertas", "estado": "abierta", "sha": "abc1234", "creada": "2026-01-01T00:00:00Z",
          "opciones": [{"verbo": "ver", "etiqueta": "▶ Ver demo", "paso": 1}, {"verbo": "acepto", "etiqueta": "✅ Aceptar", "paso": 2},
                       {"verbo": "rechazo", "etiqueta": "❌ Rechazar", "texto": True, "paso": 2}],
          "preguntas": [{"n": 1, "id": "Q-a", "opciones": ["A", "B"], "recomendada": "A"}],
          "telegram": [{"chat": 111, "msg": 7}]}
(HOME / "puertas/g1.json").write_text(json.dumps(puerta))

def cliente(local=True, host="127.0.0.1", sesion=None):
    app = FastAPI(); app.state.auth_required = not local
    if sesion is not None:
        @app.middleware("http")
        async def _s(request, call_next):
            request.state.session = sesion; return await call_next(request)
    app.include_router(api.router, prefix="/api/plugins/hermes-sdd")
    return TestClient(app, client=(host, 5000))

c = cliente(); B = "/api/plugins/hermes-sdd"
r = c.get(f"{B}/puertas").json()
ok(r["persona"] == "ana" and r["puertas"][0]["paso"] == 1, "lista la puerta y quién decide (canal dashboard)")
ok(cliente(host="10.0.0.5").get(f"{B}/puertas").status_code == 403, "en modo local, una petición desde otra máquina no tiene persona")
ok(cliente(local=False).get(f"{B}/puertas").status_code == 403, "con login activo y sin sesión no hay persona")
s = NS(email="ana@ejemplo.org", user_id="u1", provider="oauth")
ok(cliente(local=False, sesion=s).get(f"{B}/puertas").status_code == 403, "una cuenta del panel que no está en aprobadores no decide")
r = c.post(f"{B}/decidir/g1", json={"verbo": "acepto"})
ok(r.status_code == 409 and "demo" in r.json()["detail"], "no se puede aceptar sin ver la demo (lo comprueba el servidor)")
r = c.post(f"{B}/ver/g1").json()
ok(r["paso"] == 2 and r["evidencias"] == ["a.png"], "Ver demo habilita el paso 2 y lista las evidencias")
ok(c.get(f"{B}/evidencia/g1/a.png").content == b"\x89PNG-a", "sirve la captura de la demo")
ok(c.get(f"{B}/evidencia/g1/..%2Fsecreto.txt").status_code in (404, 409), "no sirve ficheros fuera de las evidencias")
ok(c.get(f"{B}/evidencia/..%2Fx/a.png").status_code in (404, 409), "id de puerta con ruta: rechazado")
r = c.post(f"{B}/respuesta/g1", json={"n": 1, "letra": "B"}).json()
ok(r["respuestas"] == {"1": "B"}, "el formulario marca Q1·B")
ok(c.post(f"{B}/respuesta/g1", json={"n": 1, "letra": "Z"}).status_code == 409, "respuesta fuera de las opciones: rechazada")
ok(c.post(f"{B}/decidir/g1", json={"verbo": "rechazo", "texto": " "}).status_code == 409, "rechazar exige motivo")
ok(c.post(f"{B}/decidir/g1", json={"verbo": "ver"}).status_code == 409, "«ver» no es una decisión")
r = c.post(f"{B}/decidir/g1", json={"verbo": "acepto"}).json()
d = json.loads((R / ".sdd/hermes/decisiones/g1.json").read_text())
ok(r["estado"] == "decidida" and d["actor"] == {"persona": "ana", "canal": "dashboard", "id": YO} and d["texto"] == "Q1: B",
   "decide con identidad del canal dashboard y las respuestas del formulario")
ok(c.post(f"{B}/decidir/g1", json={"verbo": "rechazo", "texto": "x"}).status_code == 409, "una puerta decidida no se vuelve a decidir")

class Bot:
    def __init__(s): s.editados = []
    async def edit_message_text(s, chat_id, message_id, text, reply_markup=None): s.editados.append((text, reply_markup))

async def sincronizar():
    bot = Bot()
    await tg._sincronizar(bot, json.loads((HOME / "puertas/g1.json").read_text()))
    texto, kb = bot.editados[-1]
    ok("desde dashboard" in texto and kb.inline_keyboard[0][0].callback_data == "g:deshacer:g1",
       "Telegram se pone al día: decidida desde el panel, con Deshacer")
    await tg._sincronizar(bot, json.loads((HOME / "puertas/g1.json").read_text()))
    ok(len(bot.editados) == 1, "sin cambios no se vuelve a editar el mensaje")
    r = c.post(f"{B}/deshacer/g1").json()
    await tg._sincronizar(bot, json.loads((HOME / "puertas/g1.json").read_text()))
    datos = [b.callback_data for f in bot.editados[-1][1].inline_keyboard for b in f]
    ok(r["estado"] == "abierta" and "g:acepto:g1" in datos, "deshacer en el panel reabre también el mensaje de Telegram")
asyncio.run(sincronizar())
sys.exit(1 if fallos else 0)
