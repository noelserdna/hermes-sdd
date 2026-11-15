"""«Hecho» significa desplegable: la app arranca como en producción y responde fuera de localhost.

El taller se entregó con todos los criterios verificados y no se podía desplegar: su servidor escuchaba solo en
127.0.0.1, package.json no tenía `start` ni `build` y no había README. Esta comprobación, sin LLM, la hace el cierre
antes de abrir la puerta de entrega; la revisión del encargado la enseña en la puerta (y un fallo es grave: Jev no
entrega sola una app que no arranca).

  python3 hsdd_desplegable.py <repo>   → {"ok": true|false|null, "fallos": [...], "hecho": [...], "url": …}

ok null: no se sabe arrancar este tipo de proyecto (hoy, solo Node con package.json).
Proyecto Node: README.md que diga cómo arrancarla; script `start`; si hay `build`, se construye; `npm start` con
PORT libre, HOST=0.0.0.0 y NODE_ENV=production tiene que responder por HTTP en ese puerto y no escuchar solo en
localhost. Un proyecto puede desactivarla con `"desplegable": false` en .sdd/hermes/hermes-sdd.json.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import signal
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ESPERA_ARRANQUE_S = 40
ESPERA_BUILD_S = 300


def _puerto_libre() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def _responde(url: str) -> int | None:
    try:
        with urllib.request.urlopen(url, timeout=3) as r:
            return r.status
    except urllib.error.HTTPError as e:   # 404 en «/» también es una app que responde
        return e.code
    except Exception:
        return None


def _solo_local(puerto: int) -> bool | None:
    """True si todo lo que escucha en el puerto es 127.0.0.1/::1; None si no se puede saber (sin lsof)."""
    if not shutil.which("lsof"):
        return None
    try:
        out = subprocess.run(["lsof", "-nP", f"-iTCP:{puerto}", "-sTCP:LISTEN"], capture_output=True, text=True, timeout=10).stdout
    except Exception:
        return None
    dirs = [l.split()[8] for l in out.splitlines()[1:] if len(l.split()) > 8]
    if not dirs:
        return None
    return all(d.startswith(("127.", "[::1]", "localhost")) for d in dirs)


def comprobar(repo: Path) -> dict:
    conf = {}
    try:
        conf = json.loads((repo / ".sdd/hermes/hermes-sdd.json").read_text())
    except Exception:
        pass
    if conf.get("desplegable") is False:
        return {"ok": None, "fallos": [], "hecho": [], "motivo": "desactivada en .sdd/hermes/hermes-sdd.json"}
    pj = repo / "package.json"
    if not pj.exists():
        return {"ok": None, "fallos": [], "hecho": [], "motivo": "no es un proyecto Node: no sé arrancarlo"}
    fallos, hecho = [], []
    try:
        scripts = json.loads(pj.read_text()).get("scripts") or {}
    except Exception:
        return {"ok": False, "fallos": ["package.json no se puede leer"], "hecho": []}
    readme = next((p for p in (repo / "README.md", repo / "readme.md", repo / "README") if p.exists()), None)
    if not readme or not readme.read_text(errors="replace").strip():
        fallos.append("no hay README.md que diga cómo instalarla y arrancarla")
    elif not re.search(r"npm (run )?start|npm ci|npm install", readme.read_text(errors="replace")):
        fallos.append("el README no dice cómo arrancarla (npm install / npm start)")
    else:
        hecho.append("README con cómo arrancarla")
    if "start" not in scripts:
        fallos.append("package.json no tiene script «start» (solo hay: " + (", ".join(sorted(scripts)) or "ninguno") + ")")
        return {"ok": False, "fallos": fallos, "hecho": hecho}
    if re.search(r"\b(vite|next dev|nodemon|webpack serve)\b(?! (preview|build|start))", scripts["start"]):
        fallos.append(f"«npm start» arranca el servidor de desarrollo ({scripts['start']}), no la app para producción")
    entorno = {**os.environ, "NODE_ENV": "production", "HOST": "0.0.0.0", "CI": "1"}
    if "build" in scripts:
        try:
            r = subprocess.run(["npm", "run", "build"], cwd=repo, env=entorno, capture_output=True, text=True, timeout=ESPERA_BUILD_S)
            if r.returncode != 0:
                fallos.append("«npm run build» falla: " + (r.stderr or r.stdout).strip()[-300:])
                return {"ok": False, "fallos": fallos, "hecho": hecho}
            hecho.append("se construye (npm run build)")
        except subprocess.TimeoutExpired:
            fallos.append(f"«npm run build» tarda más de {ESPERA_BUILD_S} s")
            return {"ok": False, "fallos": fallos, "hecho": hecho}
    puerto = _puerto_libre()
    url = f"http://127.0.0.1:{puerto}/"
    log = repo / ".sdd/hermes/desplegable.log"
    log.parent.mkdir(parents=True, exist_ok=True)
    with open(log, "w") as salida:
        p = subprocess.Popen(["npm", "start"], cwd=repo, env={**entorno, "PORT": str(puerto)}, stdout=salida,
                             stderr=subprocess.STDOUT, start_new_session=True)
    try:
        estado, t0 = None, time.time()
        while time.time() - t0 < ESPERA_ARRANQUE_S and p.poll() is None:
            estado = _responde(url)
            if estado is not None:
                break
            time.sleep(1)
        if estado is None:
            cola = log.read_text(errors="replace").strip()[-300:]
            fallos.append(f"«npm start» con PORT={puerto} no responde en {ESPERA_ARRANQUE_S} s"
                          + (" (el proceso terminó)" if p.poll() is not None else "")
                          + (f": {cola}" if cola else "") + " — ¿lee el puerto de la variable PORT?")
        else:
            hecho.append(f"arranca con npm start y responde (HTTP {estado})")
            local = _solo_local(puerto)
            if local:
                fallos.append("solo escucha en localhost (127.0.0.1): nadie más puede entrar; tiene que escuchar en HOST (0.0.0.0)")
            elif local is False:
                hecho.append("escucha fuera de localhost")
    finally:
        try:
            os.killpg(p.pid, signal.SIGTERM)
            p.wait(timeout=10)
        except Exception:
            try:
                os.killpg(p.pid, signal.SIGKILL)
            except Exception:
                pass
    return {"ok": not fallos, "fallos": fallos, "hecho": hecho, "url": url}


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__.strip().splitlines()[0], file=sys.stderr)
        sys.exit(2)
    print(json.dumps(comprobar(Path(sys.argv[1]).resolve()), ensure_ascii=False))
