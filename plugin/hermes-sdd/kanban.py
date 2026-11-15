"""hermes-sdd · cliente del kanban de Hermes y de los scripts del arnés (por su CLI, sin LLM).

Parte del plugin (la carga ``__init__.py`` con ``hsdd_carga.parte``): ``P`` es el plugin que la carga. Lo que sale del
proceso (``_cli``, ``_proyectos``, ``_tarjetas``…) se llama siempre por ``P``, también desde aquí: así se sustituye en
un solo sitio (las pruebas cambian ``plugin._cli`` y lo ven todas las partes).
"""
from __future__ import annotations

import asyncio
import json
import os
import shutil
from pathlib import Path

P = globals()["P"]   # el plugin que carga esta parte (hsdd_carga.Vista); lo pone hsdd_carga.parte
N, log = P.N, P.log
HOME = N.HOME

__all__ = ["_path_cmds", "PATH_CMDS", "_root", "_cli", "_proyectos", "_tarjetas", "_crear_tarjeta",
           "_reanudar_aparcadas", "_limpiar_tableros"]


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


def _root() -> Path:
    return Path((N.leer(HOME / "instalacion.json", {}) or {}).get("root", ""))


async def _cli(*args: str, timeout: int = 60) -> str:
    # Locale UTF-8: sin él, bash lee «$BOARD»» como una variable con un byte de «»» en el nombre (unbound variable)
    loc = {} if "UTF-8" in (os.environ.get("LC_ALL") or os.environ.get("LANG") or "").upper() else {"LANG": "en_US.UTF-8", "LC_ALL": "en_US.UTF-8"}
    proc = await asyncio.create_subprocess_exec(*args, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE,
                                                env={**os.environ, **loc, "PATH": PATH_CMDS, "HERMES_SDD_HOME": str(HOME)})
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
    for b in json.loads(await P._cli("hermes", "kanban", "boards", "list", "--json") or "[]"):
        wd = b.get("default_workdir") or ""
        if wd and (Path(wd) / ".sdd" / "hermes").is_dir():
            res[b["slug"]] = wd
    return res


async def _tarjetas(board: str) -> list:
    try:
        datos = json.loads(await P._cli("hermes", "kanban", "--board", board, "list", "--json") or "[]")
    except Exception:
        return []
    return datos if isinstance(datos, list) else datos.get("tasks", [])


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


async def _reanudar_aparcadas(boards) -> int:
    n = 0
    for b in boards:
        for t in await P._tarjetas(b):
            if t.get("status") == "scheduled" and t.get("assignee") == "sdd-estacion":
                try:
                    await P._cli("hermes", "kanban", "--board", b, "unblock", t["id"]); n += 1
                except Exception as e:
                    log.warning("hermes-sdd: no se pudo reanudar %s/%s: %s", b, t["id"], e)
    return n


async def _limpiar_tableros() -> None:
    """Archiva las tarjetas de etapa ya resueltas (lanzar.sh limpiar). Lo hace el gateway: desde una etapa no se puede,
    porque Hermes no deja que los procesos de un worker modifiquen el tablero (las tarjetas viejas se quedaban)."""
    for b, repo in (await P._proyectos()).items():
        try:
            proc = await asyncio.create_subprocess_exec("bash", str(_root() / "lanzar.sh"), "limpiar", repo,
                                                        stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.DEVNULL,
                                                        env={**os.environ, "PATH": PATH_CMDS})
            out, _ = await asyncio.wait_for(proc.communicate(), 120)
            if out.strip():
                log.info("hermes-sdd: %s: %s", b, out.decode("utf-8", errors="replace").strip().replace("\n", " · "))
        except Exception as e:
            log.warning("hermes-sdd: no se pudo limpiar %s: %s", b, e)
