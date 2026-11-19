"""hermes-sdd · el bucle del gateway: cada 5 s una vuelta por las puertas (tarjeta, Jev, publicar, firmar al acabar la
ventana, poner el mensaje al día) y, cada tanto, las tareas del vigía; un solo bucle por ``$HERMES_SDD_HOME``.

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga y lo de otras
partes se llama por ``P``. Lo que vive mientras el plugin está cargado (la app de Telegram, la tarea del bucle, su
hilo, el candado) está en ``P._RT``, un ``Vivo`` por carga del plugin.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, log = P.N, P.log
HOME = N.HOME
PATH_CMDS = P.PATH_CMDS
_leer, _escribir, _ahora = N.leer, N.escribir, N.ahora
OCUPADO = 75   # firmar.sh: el repo lo tiene una etapa u otra firma (lib/candado.sh); se reintenta, no es un error

__all__ = ["OCUPADO", "Vivo", "_firmar", "_consultar_jev", "_jev_en_puerta", "_vuelta_puerta", "_vuelta", "_bucle",
           "_es_gateway", "_tomar_candado", "_soltar_candado", "_parar_bucle", "_bucle_en_hilo", "_arrancar_bucle",
           "_asegurar_bucle"]


@dataclass
class Vivo:
    """Lo que vive mientras el plugin está cargado; uno por carga (dos cargas en un proceso no se pisan, y la que no
    tiene el candado no lanza nada)."""
    app: Any = None                               # la Application de Telegram (None: sin Telegram)
    bucle: Any = None                             # la tarea del bucle en el loop del gateway
    hilo: threading.Thread | None = None          # el bucle sin Telegram, en su hilo
    hilo_parar: threading.Event | None = None     # pide a ese hilo que ceda el sitio
    candado: int | None = None                    # descriptor con el flock de bucle.lock
    mant_vivo: bool = False                       # el mantenimiento diario está en marcha
    # Una sola vuelta a la vez: el bucle sin Telegram (en su hilo) y el del gateway pueden convivir un tick mientras el
    # primero cede el sitio al segundo
    vuelta: threading.Lock = field(default_factory=threading.Lock)

    # Compatibilidad: antes era un dict (``_RT["app"]``, ``_RT.get("hilo")``) y las pruebas lo siguen usando así
    def __getitem__(self, k: str):
        return getattr(self, k)

    def __setitem__(self, k: str, v) -> None:
        setattr(self, k, v)

    def get(self, k: str, defecto=None):
        return getattr(self, k, defecto)


# ── firmar al acabar la ventana ─────────────────────────────────────────────────────────────────────────────────
async def _firmar(bot, puerta: dict) -> None:
    gid = puerta["id"]
    proc = await asyncio.create_subprocess_exec(
        "bash", str(P._root() / "firmar.sh"), puerta["repo"], gid,
        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
        env={**os.environ, "PATH": PATH_CMDS, "HERMES_SDD_HOME": str(HOME)})
    try:
        out, err = await asyncio.wait_for(proc.communicate(), 600)
    except asyncio.TimeoutError:
        proc.kill(); out, err = b"", b"el notario no termino en 10 min"
    if proc.returncode == OCUPADO:   # una etapa (u otra firma) tiene el repo: se firma en cuanto lo suelte
        log.info("hermes-sdd: %s: el repo está ocupado; se firma en la próxima vuelta", gid)
        try:
            N.marcar(gid, firmar_en=time.time() + 30)
        except N.Rechazo:
            pass
        return
    # El estado cambia por la tabla de transiciones del núcleo (decidida → firmada | error), con su cerrojo
    try:
        if proc.returncode == 0:
            # Lo firmado lo deja el notario estructurado en el índice («firma»); la última línea de stdout solo vale
            # para un notario anterior a ese campo
            firma = (N.leer(N.indice(gid), {}) or {}).get("firma") or {}
            resultado = firma.get("resumen") or (
                out.decode("utf-8", errors="replace").strip().splitlines()[-1] if out.strip() else "firmada")
            p = N.transicion(gid, "firmada", resultado=resultado, error=None)
            texto = f"{P._cabecera(p)}\n{P._resultado_claro(p['resultado'], p.get('firma'))}"
        else:
            p = N.transicion(gid, "error", error=err.decode("utf-8", errors="replace").strip()[-500:])
            texto = (f"{P._cabecera(p)}\n⚠️ Tu decisión no se ha podido registrar, así que no se ha aplicado.\n"
                     f"Motivo: {p['error'].replace('NOTARIO: rechazado — ', '')}\n"
                     "Normalmente es porque el proyecto cambió después de abrir esta puerta: espera a la siguiente.\n"
                     f"(Para recuperarla: bash puerta.sh recuperar {gid})")
    except N.Rechazo as e:
        log.warning("hermes-sdd: %s: %s", gid, e)
        return
    await P._editar(bot, p, texto, None)


# ── Jev en cada puerta ──────────────────────────────────────────────────────────────────────────────────────────
# Tamaños del contexto de Jev, de mayor a menor: si el modelo dice que no le cabe (material-montana, plan de 10 FASEs con
# 5 preguntas: «HTTP 400 max_tokens_exceeded», y la puerta se quedó sin juicio), se vuelve a preguntar con menos
TAMANOS_JEV = (90000, 40000, 15000)
DEMASIADO = ("max_tokens", "larger than", "too large", "too long", "context length")


async def _consultar_jev(puerta: dict) -> dict:
    """Pregunta a Jev por esta puerta; si el estado no le cabe, otra vez con menos contexto. Nunca lanza."""
    juicio = {"error": "sin respuesta"}
    for n in TAMANOS_JEV:
        juicio = await _consultar_jev_una(puerta, n)
        if not any(d in str(juicio.get("error") or "").lower() for d in DEMASIADO):
            return juicio
    return juicio


async def _consultar_jev_una(puerta: dict, max_chars: int) -> dict:
    """Pregunta a Jev por esta puerta con sdd-jev.mjs (el mismo cliente que usa el método). Nunca lanza: un fallo
    vuelve como {"error"} y la puerta queda para una persona."""
    import tempfile
    sdd_jev = P._root() / "metodo" / "scripts" / "sdd-jev.mjs"
    try:
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / "q.json").write_text(json.dumps({"questions": N.pregunta_jev(puerta)}))
            (Path(d) / "i.jsonl").write_text(json.dumps({"id": puerta["id"], "state": N.estado_jev(puerta, max_chars)}) + "\n")
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
    # Vetada: va a una persona y no se gasta una llamada al modelo. Una regla: firma sin juicio. Si no, lo juzga Jev.
    puede, _ = N.puede_jev(p)
    regla = N.regla_jev(p) if puede else None
    if not puede:
        juicio = {"choice": "persona", "p": 1.0, "confidence": 1.0, "modelo": "regla:veto"}
    elif regla:
        juicio = {"choice": regla[0], "p": 1.0, "confidence": 1.0, "modelo": "regla", "regla": regla[1]}
    else:
        juicio = await P._consultar_jev(p)
    try:
        p = N.aplicar_jev(p["id"], juicio)
    except N.Rechazo:
        return _leer(idx) or p
    j = p.get("jev", {})
    log.info("hermes-sdd: Jev en %s → %s (p %s, decide %s: %s)", p["id"], j.get("choice") or j.get("error"),
             j.get("p"), j.get("decide"), j.get("motivo"))
    return p


# ── una vuelta: cada puerta y, cada tanto, las tareas del vigía ─────────────────────────────────────────────────
async def _vuelta_puerta(bot, idx: Path) -> None:
    """Una puerta del índice: su tarjeta, Jev, publicarla, firmarla al acabar la ventana o poner su mensaje al día.
    Sin bot (Telegram no conectado) se hace todo menos lo que es de Telegram."""
    p = _leer(idx)
    if not p:   # JSON roto: lo avisa N.leer en el log (una vez por versión del fichero) y /puertas lo cuenta
        return
    if p.get("estado") == "abierta" and not p.get("tarjeta") and p.get("tablero"):
        tarjeta = await P._crear_tarjeta(p)
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
    if bot is not None and ((p.get("estado") == "abierta" and not p.get("telegram"))
                            or (p.get("estado") == "decidida" and "telegram" not in p)):
        await asyncio.wait_for(P._publicar(bot, p), 60)
        with N.cerrojo():
            actual = _leer(idx) or p
            actual.update(telegram=p["telegram"], publicada=p["publicada"], tg_vista=p["tg_vista"])
            _escribir(idx, actual)
    elif (p.get("estado") == "decidida" and time.time() >= p.get("firmar_en", 0)
          and ((p.get("decision") or {}).get("actor", {}).get("canal") != "local"
               or p.get("firma_gateway"))):   # el local lo firma decidir.sh, salvo con --en (ventana para deshacer)
        log.info("hermes-sdd: firmando la puerta %s", p["id"])
        await _firmar(bot, p)
    elif bot is not None:   # decidida o deshecha desde otro canal (dashboard): el mensaje de Telegram se pone al día
        await asyncio.wait_for(P._sincronizar(bot, p), 60)


async def _vuelta(ciclo: int, con_bot: bool = True) -> None:
    app = P._RT.app if con_bot else None
    bot = app.bot if app is not None else None   # la app puede reconstruirse tras un fallo de conexión: siempre la actual
    for idx in sorted((HOME / "puertas").glob("*.json")):
        try:   # una puerta que falla (un repo borrado, un JSON roto, el kanban caído) no bloquea las demás
            await _vuelta_puerta(bot, idx)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("hermes-sdd: error con la puerta %s (sigue con las demás)", idx.stem)
    tareas = []
    if ciclo % 6 == 0 and bot is not None:
        tareas.append(("lecciones", lambda: P._avisar_lecciones(bot), 60))
    if ciclo % 12 == 0:
        tareas.append(("limpiar", P._limpiar_tableros, 300))
        tareas.append(("reintentos", lambda: P._reintentar_perdidos(bot), 300))
        # El vigía también sin Telegram: reanuda lo aparcado por la cuota y deja sus avisos para el panel
        tareas.append(("vigía", lambda: P._vigia(bot), 180))
        if bot is not None:
            tareas.append(("fallos", lambda: P._avisar_fallos(bot), 180))
    for nombre, tarea, plazo in tareas:   # cada una por separado: si una falla, las demás se hacen igual
        try:
            await asyncio.wait_for(tarea(), plazo)
        except asyncio.CancelledError:
            raise
        except Exception:
            log.exception("hermes-sdd: error en %s (sigue)", nombre)


async def _bucle(parar: threading.Event | None = None) -> None:
    """Cada 5 s una vuelta. `parar` (solo el bucle sin Telegram, en su hilo): al activarse, el bucle termina."""
    ciclo = 0
    log.info("hermes-sdd: bucle en marcha%s", "" if parar is None else " (sin Telegram)")
    while True:
        await asyncio.sleep(5)
        if parar is not None and parar.is_set():
            log.info("hermes-sdd: el bucle sin Telegram cede el sitio al del gateway")
            return
        if not P._RT.vuelta.acquire(blocking=False):   # la otra vuelta aún no ha terminado: esta se salta
            continue
        try:
            await _vuelta(ciclo, con_bot=parar is None)
        except asyncio.CancelledError:
            log.warning("hermes-sdd: bucle cancelado")
            raise
        except Exception:
            log.exception("hermes-sdd: error en una vuelta del bucle (sigue)")
        finally:
            P._RT.vuelta.release()
        ciclo += 1
        try:   # latido: lo leen /estado y doctor para saber que el canal está vivo
            _escribir(HOME / "latido.json", {"ts": _ahora(), "ciclo": ciclo, "pid": os.getpid(),
                                             "telegram": parar is None and P._RT.app is not None})
        except Exception:
            pass


# ── un solo bucle por $HERMES_SDD_HOME ──────────────────────────────────────────────────────────────────────────
# Hermes no tiene un gancho de arranque del gateway para plugins (los «gateway:startup» son hooks de shell del perfil,
# y register_platform_handler solo se llama al conectar ESA plataforma). Por eso el bucle arranca desde register()
# cuando el proceso es el gateway, y el adaptador de Telegram, si engancha luego, lo reutiliza. Un candado de proceso
# (flock sobre $HERMES_SDD_HOME/bucle.lock, se suelta solo si el proceso muere) garantiza un único bucle aunque haya
# varios gateways (perfiles) o el plugin se cargue dos veces.
def _es_gateway() -> bool:
    forzado = os.environ.get("HERMES_SDD_GATEWAY")   # pruebas: 1 / 0
    if forzado is not None:
        return forzado == "1"
    a = sys.argv
    if any(a[i] == "gateway" and a[i + 1] == "run" for i in range(len(a) - 1)):
        return True
    if getattr(getattr(sys.modules.get("__main__"), "__spec__", None), "name", "") == "gateway.run":   # python -m gateway.run
        return True
    try:   # `hermes gateway run` marca así su proceso (hermes_cli/gateway.py run_gateway → begin_process("gateway"))
        from hermes_cli.observability import shared_metrics_process as smp
        return smp._STATE.get("kind") == "gateway"
    except Exception:
        return False


def _tomar_candado() -> bool:
    """True si este proceso tiene (o acaba de tomar) el candado del bucle."""
    if P._RT.candado is not None:
        return True
    import fcntl
    HOME.mkdir(parents=True, exist_ok=True)
    fd = os.open(HOME / "bucle.lock", os.O_RDWR | os.O_CREAT, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        os.close(fd)
        return False
    os.ftruncate(fd, 0)
    os.write(fd, f"{os.getpid()}\n".encode())
    P._RT.candado = fd
    return True


def _soltar_candado() -> None:
    fd, P._RT.candado = P._RT.candado, None
    if fd is not None:
        try:
            os.close(fd)   # cerrar el descriptor suelta el flock
        except OSError:
            pass


def _parar_bucle() -> None:
    """Al descargar el plugin: para el bucle (en el loop del gateway o en su hilo) y suelta el candado."""
    if P._RT.hilo_parar is not None:
        P._RT.hilo_parar.set()
    t = P._RT.bucle
    if t is not None and not t.done() and not t.get_loop().is_closed():
        t.get_loop().call_soon_threadsafe(t.cancel)   # Hermes puede descargar el plugin desde otro hilo
    _soltar_candado()


def _bucle_en_hilo() -> None:
    """El bucle en su propio hilo con su loop, sin Telegram, hasta que el adaptador de Telegram enganche y lo pase al
    loop del gateway."""
    if P._RT.hilo is not None and P._RT.hilo.is_alive():
        return
    parar = threading.Event()
    P._RT.hilo_parar = parar

    def _correr():
        try:
            asyncio.run(_bucle(parar))
        except Exception:
            log.exception("hermes-sdd: el bucle sin Telegram se detuvo")
    P._RT.hilo = threading.Thread(target=_correr, name="hermes-sdd-bucle", daemon=True)
    P._RT.hilo.start()


def _arrancar_bucle() -> str:
    """Desde register(): en el gateway, arranca el bucle aunque Telegram no esté configurado. Devuelve qué hizo."""
    if not _es_gateway():
        return "no es el gateway"
    if not _tomar_candado():
        log.info("hermes-sdd: ya hay un bucle con el candado %s (otro proceso o carga del plugin)", HOME / "bucle.lock")
        return "ya hay un bucle"
    # Siempre en su hilo: no se sabe si register() corre en el loop definitivo del gateway o en uno de arranque (el
    # descubrimiento de plugins se dispara desde varios sitios); el hilo vive lo que el proceso. Telegram lo pasa luego
    # a su loop (_asegurar_bucle)
    if P._RT.bucle is not None and not P._RT.bucle.done():
        return "ya en marcha"
    _bucle_en_hilo()
    return "hilo"


def _asegurar_bucle() -> None:
    """Si el bucle no corre en el loop actual (no arrancó, murió o va en su hilo sin Telegram), lo lanza aquí: una
    sola tarea viva aunque el adaptador reconstruya la app. Con el candado en otro proceso no lanza nada."""
    if not _tomar_candado():
        log.warning("hermes-sdd: el bucle de las puertas ya lo tiene otro proceso o carga del plugin (%s); no se lanza otro",
                    HOME / "bucle.lock")
        return
    hilo = P._RT.hilo
    if hilo is not None and hilo.is_alive():   # el de sin Telegram cede: a partir de aquí, el del loop del gateway
        P._RT.hilo_parar.set()
    t = P._RT.bucle
    loop = asyncio.get_running_loop()
    if t is not None and not t.done() and t.get_loop() is not loop:   # quedó en otro loop (p. ej. uno de arranque ya cerrado)
        if not t.get_loop().is_closed():
            t.get_loop().call_soon_threadsafe(t.cancel)
        t = None
    if t is None or t.done():
        if t is not None:
            log.warning("hermes-sdd: el bucle estaba parado; se relanza")
        P._RT.bucle = loop.create_task(_bucle())
