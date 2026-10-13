"""hermes-sdd — canal DASHBOARD: las puertas en una pestaña del panel web de Hermes (/api/plugins/hermes-sdd/).

Como Telegram, este canal no firma: registra la decisión normalizada y el gateway la firma al acabar la ventana de
deshacer. La identidad sale de la sesión del panel: con login (modo con autenticación) es el email o el id de la
cuenta; en modo local (127.0.0.1, sin login) es el usuario del sistema que arrancó el panel, que debe figurar en
aprobadores.json como canal "dashboard". Es una identidad más débil que la de Telegram y así queda registrado.
"""
from __future__ import annotations

import getpass
import importlib.util
import json
import socket
import subprocess
import sys
import time
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse

if "hsdd_nucleo" not in sys.modules:
    _spec = importlib.util.spec_from_file_location("hsdd_nucleo", Path(__file__).resolve().parent.parent / "hsdd_nucleo.py")
    _mod = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_mod); sys.modules["hsdd_nucleo"] = _mod
N = sys.modules["hsdd_nucleo"]

router = APIRouter()
CAMPOS = ("id", "tipo", "fase", "tablero", "titulo", "texto", "opciones", "preguntas", "estado", "creada", "sha",
          "firmar_en", "ver_at", "adopcion")


def _actor(request: Request) -> tuple[str, str, dict]:
    """(persona, id en el canal, prueba). Sin persona autorizada → 403."""
    sesion = getattr(request.state, "session", None)
    if sesion is not None:
        ident = sesion.email or sesion.user_id
        prueba = {"proveedor": sesion.provider, "cuenta": sesion.user_id}
    else:
        # Solo en modo local explícito (panel sin login, petición desde esta máquina); si no, no hay persona
        local = getattr(request.app.state, "auth_required", None) is False
        cliente = request.client.host if request.client else ""
        if not local or cliente not in ("127.0.0.1", "::1", "localhost"):
            raise HTTPException(403, "sin sesión del panel no hay persona autorizada")
        ident = getpass.getuser()
        prueba = {"modo": "local", "host": socket.gethostname().split(".")[0]}
    persona, _ = N.persona_de("dashboard", ident)
    if not persona:
        raise HTTPException(403, f"{ident} no figura en aprobadores.json con canal dashboard")
    return persona, ident, prueba


def _vista(p: dict, persona: str) -> dict:
    v = {k: p.get(k) for k in CAMPOS}
    v["paso"] = N.paso_actual(p)
    v["respuestas"] = N.respuestas(p)
    v["evidencias"] = N.evidencias(p)
    dec = p.get("decision")
    if dec:
        v["decision"] = {"verbo": dec.get("verbo"), "texto": dec.get("texto"), "at": dec.get("at"),
                         "persona": dec.get("actor", {}).get("persona"), "canal": dec.get("actor", {}).get("canal")}
        v["puedo_deshacer"] = dec.get("actor", {}).get("persona") == persona
    return v


def _puerta(gid: str) -> dict:
    try:
        p = N.leer(N.indice(gid))
    except ValueError:
        p = None
    if not p:
        raise HTTPException(404, "No conozco esta puerta")
    return p


def _accion(fn):
    try:
        return fn()
    except N.Rechazo as e:
        raise HTTPException(409, str(e))


@router.get("/puertas")
async def puertas(request: Request):
    persona, ident, _ = _actor(request)
    abiertas = N.puertas(("abierta", "decidida"))
    recientes = sorted(N.puertas(("firmada", "error")), key=lambda p: p.get("creada", ""))[-8:]
    lat = N.leer(N.HOME / "latido.json", {}) or {}
    return {"persona": persona, "identidad": ident, "ahora": time.time(),
            "canal_vivo": lat.get("ts"), "puertas": [_vista(p, persona) for p in abiertas],
            "recientes": [{"id": p["id"], "titulo": p.get("titulo"), "tablero": p.get("tablero"), "estado": p.get("estado"),
                           "resultado": p.get("resultado") or p.get("error", "")} for p in reversed(recientes)]}


@router.post("/ver/{gid}")
async def ver(gid: str, request: Request):
    persona, _, _ = _actor(request)
    p = _puerta(gid)
    return _vista(_accion(lambda: N.marcar(gid, ver_at=p.get("ver_at") or time.time())), persona)


@router.post("/respuesta/{gid}")
async def respuesta(gid: str, request: Request):
    persona, _, _ = _actor(request)
    body = await request.json()
    return _vista(_accion(lambda: N.marcar(gid, respuesta=(str(body.get("n")), str(body.get("letra"))))), persona)


@router.post("/decidir/{gid}")
async def decidir(gid: str, request: Request):
    persona, ident, prueba = _actor(request)
    body = await request.json()
    prueba = {**prueba, "ua": (request.headers.get("user-agent") or "")[:60]}
    p = _accion(lambda: N.decidir(gid, str(body.get("verbo", "")), str(body.get("texto", "")), persona, "dashboard",
                                  ident, prueba))
    return _vista(p, persona)


@router.post("/deshacer/{gid}")
async def deshacer(gid: str, request: Request):
    persona, _, _ = _actor(request)
    return _vista(_accion(lambda: N.deshacer(gid, persona)), persona)


@router.get("/evidencia/{gid}/{nombre}")
async def evidencia(gid: str, nombre: str, request: Request):
    _actor(request)
    return FileResponse(_accion(lambda: N.fichero_evidencia(_puerta(gid), nombre)))


@router.get("/proyectos")
async def proyectos(request: Request):
    """Proyectos del arnés con sus hitos (tags) y su estado de pausa; el detalle de tarjetas está en la pestaña Kanban."""
    _actor(request)
    try:
        boards = json.loads(subprocess.run(["hermes", "kanban", "boards", "list", "--json"], capture_output=True,
                                           text=True, timeout=30).stdout or "[]")
    except Exception:
        boards = []
    res = []
    for b in boards:
        wd = b.get("default_workdir") or ""
        if not wd or not (Path(wd) / ".sdd" / "hermes").is_dir():
            continue
        tags = subprocess.run(["git", "-C", wd, "tag", "-l", "requirements-v*", "fase-*-accepted", "entrega-*"],
                              capture_output=True, text=True).stdout.split()
        res.append({"tablero": b["slug"], "repo": wd, "hitos": tags,
                    "pausado": (N.HOME / "pausa" / b["slug"]).exists() or (N.HOME / "pausa" / "_todo").exists()})
    return {"proyectos": res}
