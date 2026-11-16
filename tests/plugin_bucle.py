"""Arranque del bucle del gateway sin Telegram (hermético: sin red, sin kanban, sin Hermes). tests/plugin_bucle.sh lo lanza.
   · fuera del gateway no arranca; en el gateway arranca aunque Telegram no enganche (en su hilo si no hay loop)
   · un solo bucle por $HERMES_SDD_HOME (flock en bucle.lock): otra carga del plugin u otro proceso no lanzan otro
   · cuando Telegram engancha, el bucle pasa al loop del gateway (no hay dos) y un segundo enganche lo reutiliza
   · sin Telegram firma lo decidido en el panel y lo decidido con decidir.sh --en, no lo local inmediato
   · vigía: etapa «running» sin latido en su repo más de 30 min → alertas.json (panel) y un aviso por Telegram"""
import asyncio, importlib.util, json, os, shutil, subprocess, sys, tempfile, time
from pathlib import Path
from types import SimpleNamespace as NS

ROOT = Path(__file__).resolve().parent.parent
T = Path(tempfile.mkdtemp()); HOME = T / "home"; (HOME / "puertas").mkdir(parents=True)
os.environ.update(HERMES_SDD_HOME=str(HOME), TELEGRAM_HOME_CHANNEL="111")
os.environ.pop("HERMES_SDD_GATEWAY", None)


def cargar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, ROOT / "plugin/hermes-sdd/__init__.py")
    m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    async def ninguno(): return {}
    async def sin_tarjetas(b): return []
    m._proyectos, m._tarjetas = ninguno, sin_tarjetas   # sin kanban: nada de limpiar ni reintentar proyectos reales
    return m


fallos = 0
def ok(c, t):
    global fallos
    print(("ok   " if c else "FAIL ") + t); fallos += (not c)

def esperar(cond, s=20):
    fin = time.time() + s
    while time.time() < fin:
        if cond():
            return True
        time.sleep(0.2)
    return False

# arnés falso: firmar.sh firma si existe la decisión del repo
(T / "arnes").mkdir(); (T / "arnes/firmar.sh").write_text('echo "firmado $2"; [ -f "$1/.sdd/hermes/decisiones/$2.json" ]')
(HOME / "instalacion.json").write_text(json.dumps({"root": str(T / "arnes")}))
R = T / "repo"; (R / ".sdd/hermes/decisiones").mkdir(parents=True)
def decidida(gid, canal, **extra):
    (R / f".sdd/hermes/decisiones/{gid}.json").write_text("{}")
    (HOME / f"puertas/{gid}.json").write_text(json.dumps({"id": gid, "tipo": "plan", "estado": "decidida", "repo": str(R),
        "tablero": "", "titulo": "Plan", "firmar_en": 0, "decision": {"actor": {"canal": canal}}, **extra}))
estado = lambda gid: json.loads((HOME / f"puertas/{gid}.json").read_text())["estado"]

# 1. fuera del gateway (CLI, panel, workers) el registro no arranca nada
os.environ["HERMES_SDD_GATEWAY"] = "0"
m = cargar("hsdd_a")
ok(m._arrancar_bucle() == "no es el gateway" and m._RT.get("candado") is None and m._RT.get("hilo") is None,
   "fuera del gateway no arranca el bucle ni toma el candado")
os.environ.pop("HERMES_SDD_GATEWAY")
argv = sys.argv[:]; sys.argv[1:] = ["gateway", "run", "--external-supervisor"]
ok(m._es_gateway(), "reconoce el proceso del gateway por «gateway run»")
sys.argv[:] = argv
ok(not m._es_gateway(), "y no lo confunde con otro proceso")

# 2. en el gateway, sin loop en marcha al registrar y sin Telegram: bucle en su hilo, con el candado
os.environ["HERMES_SDD_GATEWAY"] = "1"
decidida("p_panel", "dashboard"); decidida("p_local", "local"); decidida("p_en", "local", firma_gateway=True)
r = m._arrancar_bucle()
ok(r == "hilo" and m._RT["hilo"].is_alive(), f"en el gateway arranca sin Telegram, en su hilo ({r})")
ok((HOME / "bucle.lock").read_text().strip() == str(os.getpid()), "bucle.lock con el pid del gateway")
ok(esperar(lambda: estado("p_panel") == "firmada" and estado("p_en") == "firmada"),
   "sin Telegram firma lo decidido en el panel y lo de decidir.sh --en")
ok(estado("p_local") == "decidida", "lo local sin --en no lo firma el gateway (lo firma decidir.sh)")
ok(esperar(lambda: (HOME / "latido.json").exists()), "deja latido")
lat = json.loads((HOME / "latido.json").read_text())
ok(lat.get("pid") == os.getpid() and lat.get("telegram") is False, "latido sin Telegram")

# 3. un solo bucle: otra carga del plugin en el mismo proceso, y otro proceso, no lanzan otro
m2 = cargar("hsdd_b")
ok(m2._arrancar_bucle() == "ya hay un bucle" and m2._RT.get("hilo") is None, "otra carga del plugin no lanza un segundo bucle")
otro = subprocess.run([sys.executable, "-c", "import fcntl,os,sys\nfd=os.open(sys.argv[1],os.O_RDWR)\n"
                       "try:\n fcntl.flock(fd,fcntl.LOCK_EX|fcntl.LOCK_NB); print('tomado')\nexcept OSError: print('ocupado')",
                       str(HOME / "bucle.lock")], capture_output=True, text=True).stdout.strip()
ok(otro == "ocupado", "otro proceso encuentra el candado ocupado")


# 4. Telegram engancha (en el loop del gateway): el bucle pasa a ese loop; el hilo termina; un segundo enganche lo reutiliza
async def engancha():
    m._RT["app"] = NS(bot=None)
    m._asegurar_bucle(); t1 = m._RT["bucle"]
    m._asegurar_bucle(); t2 = m._RT["bucle"]
    ok(t1 is t2 and not t1.done(), "un segundo enganche de Telegram reutiliza el bucle")
    fin = time.time() + 20
    while m._RT["hilo"].is_alive() and time.time() < fin:
        await asyncio.sleep(0.3)
    ok(not m._RT["hilo"].is_alive() and not t1.done(), "el bucle sin Telegram cede el sitio al del gateway: queda uno solo")
    m2._RT["app"] = NS(bot=None); m2._asegurar_bucle()
    ok(m2._RT.get("bucle") is None, "Telegram enganchado en otra carga sin el candado no lanza otro bucle")
    m._parar_bucle()
    await asyncio.sleep(0.1)
    ok(m._RT.get("candado") is None and t1.done(), "al descargar el plugin el bucle se para y suelta el candado")
asyncio.run(engancha())
ok(m2._arrancar_bucle() == "hilo", "soltado el candado, otra carga puede tomarlo")
m2._parar_bucle()


# 5. vigía: etapa en marcha sin latido en su repo
async def vigia():
    v = cargar("hsdd_c"); R2 = T / "lento"; (R2 / ".sdd/hermes/runs").mkdir(parents=True); (R2 / ".git").mkdir()
    viejo = time.time() - 3 * 3600
    for f in (R2 / ".sdd/hermes/runs/r1.json", R2 / ".git/index"):
        f.write_text("x"); os.utime(f, (viejo, viejo))
    tarjeta = {"id": "t_9", "title": "Implementar FASE-1", "status": "running", "assignee": "sdd-estacion",
               "started_at": int(viejo)}
    ok(len(v.PR.sin_latido(str(R2), [tarjeta])) == 1, "hsdd_proyectos: etapa running sin latido > 30 min")
    (R2 / ".git/index").write_text("y")
    ok(v.PR.sin_latido(str(R2), [tarjeta]) == [], "un commit reciente (índice de git) cuenta como latido")
    os.utime(R2 / ".git/index", (viejo, viejo))
    ok(v.PR.sin_latido(str(R2), [{**tarjeta, "status": "ready"}]) == [], "sin tarjeta running no hay aviso")
    async def proys(): return {"lento": str(R2)}
    async def tarjs(b): return [tarjeta]
    v._proyectos, v._tarjetas = proys, tarjs
    enviados = []
    class Bot:
        async def send_message(s, chat_id, text, **k): enviados.append(text)
    await v._vigia_etapas(None)
    ok(json.loads((HOME / "alertas.json").read_text())["proyectos"].get("lento") and not enviados,
       "sin Telegram queda en alertas.json para el panel")
    await v._vigia_etapas(Bot()); await v._vigia_etapas(Bot())
    ok(len(enviados) == 1 and "Implementar FASE-1" in enviados[0], f"con Telegram avisa una sola vez ({len(enviados)})")
    tarjeta["status"] = "done"; await v._vigia_etapas(Bot())
    ok(json.loads((HOME / "alertas.json").read_text())["proyectos"] == {}, "recuperada, desaparece del panel")
asyncio.run(vigia())

# 6. Jev con un estado demasiado grande (material-montana: «HTTP 400 max_tokens_exceeded» y la puerta sin juicio): se
#    vuelve a preguntar con menos contexto
async def jev_grande():
    m = cargar("hsdd_d"); tamanos = []
    async def una(puerta, n):
        tamanos.append(n)
        return {"error": 'HTTP 400: {"detail":{"error_type":"max_tokens_exceeded"}}'} if n > 40000 else {"choice": "conforme", "p": 0.9}
    m.bucle._consultar_jev_una = una
    j = await m.bucle._consultar_jev({"id": "g1"})
    ok(j.get("choice") == "conforme" and tamanos == [90000, 40000], f"Jev: si no le cabe, pregunta otra vez con menos contexto ({tamanos})")
    tamanos.clear()
    async def otra(puerta, n):
        tamanos.append(n); return {"error": "HTTP 500"}
    m.bucle._consultar_jev_una = otra
    j = await m.bucle._consultar_jev({"id": "g1"})
    ok(j.get("error") == "HTTP 500" and tamanos == [90000], "Jev: otro error no se reintenta aquí")
asyncio.run(jev_grande())
shutil.rmtree(T, ignore_errors=True)
sys.exit(1 if fallos else 0)
