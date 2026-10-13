"""Núcleo de las puertas, común a todos los canales (Telegram, dashboard…).

Un canal solo presenta la puerta y traduce un gesto de una persona en una llamada a este módulo; aquí se valida
(estado, persona autorizada en ESE canal, demo vista antes de aceptar) y se guarda la decisión normalizada que luego
firma el notario. Los canales viven en procesos distintos (gateway, dashboard): el índice se protege con un cerrojo
de fichero, no con un lock de asyncio.
"""
from __future__ import annotations

import contextlib
import fcntl
import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(os.environ.get("HERMES_SDD_HOME", Path.home() / ".hermes" / "hermes-sdd"))
DESHACER_S = int(os.environ.get("HERMES_SDD_DESHACER_S", "180"))


def leer(p: Path, defecto=None):
    try:
        return json.loads(p.read_text())
    except Exception:
        return defecto


def escribir(p: Path, datos) -> None:
    tmp = p.with_suffix(f".{os.getpid()}.tmp")
    tmp.write_text(json.dumps(datos, ensure_ascii=False, indent=2))
    tmp.replace(p)


def ahora() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@contextlib.contextmanager
def cerrojo():
    """Exclusión entre procesos para leer-modificar-escribir el índice de puertas. Sección corta y sin esperas."""
    (HOME / "puertas").mkdir(parents=True, exist_ok=True)
    with open(HOME / "puertas" / ".cerrojo", "w") as f:
        fcntl.flock(f, fcntl.LOCK_EX)
        try:
            yield
        finally:
            fcntl.flock(f, fcntl.LOCK_UN)


def indice(gid: str) -> Path:
    if not gid or "/" in gid or gid.startswith("."):
        raise ValueError("id de puerta no válido")
    return HOME / "puertas" / f"{gid}.json"


def persona_de(canal: str, ident) -> tuple:
    """Persona de aprobadores.json cuya identidad en `canal` es `ident` → (clave, datos) o (None, None)."""
    for clave, p in (leer(HOME / "aprobadores.json", {}) or {}).items():
        if str(p.get("canales", {}).get(canal, "")) == str(ident) and str(ident):
            return clave, p
    return None, None


def respuestas(puerta: dict) -> dict:
    """Opción elegida por pregunta: la que marcó la persona o, si no, la recomendada."""
    elegidas = puerta.get("respuestas") or {}
    return {str(q["n"]): elegidas.get(str(q["n"]), q.get("recomendada", "")) for q in puerta.get("preguntas") or []}


def escalonada(puerta: dict) -> bool:
    return any(o.get("paso") for o in puerta.get("opciones", []))


def paso_actual(puerta: dict) -> int:
    return 2 if (puerta.get("ver_at") or not escalonada(puerta)) else 1


def clave_vista(puerta: dict) -> str:
    """Resume lo que un canal debe enseñar; si cambia (p. ej. se decidió desde otro canal), el canal se actualiza."""
    dec = puerta.get("decision") or {}
    return "|".join([puerta.get("estado", ""), str(paso_actual(puerta)), dec.get("at", ""),
                     json.dumps(puerta.get("respuestas") or {}, sort_keys=True)])


class Rechazo(Exception):
    """La acción no procede; el mensaje se enseña tal cual a la persona."""


def decidir(gid: str, verbo: str, texto: str, persona: str, canal: str, ident: str, prueba: dict) -> dict:
    """Registra la decisión de `persona` (ya identificada por el canal) y abre la ventana de deshacer.
    Devuelve la puerta actualizada. Lanza Rechazo si no procede."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx)
        if not puerta:
            raise Rechazo("No conozco esta puerta")
        if puerta.get("estado") != "abierta":
            raise Rechazo("Esta puerta ya está resuelta")
        if persona_de(canal, ident)[0] != persona:
            raise Rechazo("No estás autorizado para decidir esta puerta")
        opcion = next((o for o in puerta.get("opciones", []) if o["verbo"] == verbo and verbo != "ver"), None)
        if not opcion:
            raise Rechazo("Opción no válida")
        if opcion.get("paso", 1) == 2 and not puerta.get("ver_at"):
            raise Rechazo("Mira la demo antes de decidir")
        texto = (texto or "").strip()
        if opcion.get("texto") and not texto:
            raise Rechazo(f"«{opcion['etiqueta']}» necesita un motivo")
        if puerta.get("preguntas") and verbo != "rechazo":
            resp = ", ".join(f"Q{n}: {l}" for n, l in respuestas(puerta).items() if l)
            texto = f"{texto}. {resp}" if texto else resp
        decision = {"verbo": verbo, "texto": texto,
                    "actor": {"persona": persona, "canal": canal, "id": str(ident)},
                    "prueba": prueba, "at": ahora()}
        dirdec = Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones"
        dirdec.mkdir(parents=True, exist_ok=True)
        escribir(dirdec / f"{gid}.json", decision)
        if puerta.get("ver_at"):
            decision["dwell_s"] = int(time.time() - puerta["ver_at"])
        puerta.update(estado="decidida", decision=decision, firmar_en=time.time() + DESHACER_S)
        escribir(idx, puerta)
        return puerta


def deshacer(gid: str, persona: str) -> dict:
    """Solo quien decidió, y solo mientras no se haya firmado (dentro de la ventana)."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx) or {}
        dec = puerta.get("decision") or {}
        if puerta.get("estado") != "decidida" or dec.get("actor", {}).get("persona") != persona:
            raise Rechazo("Ya no se puede deshacer")
        (Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones" / f"{gid}.json").unlink(missing_ok=True)
        puerta.update(estado="abierta")
        puerta.pop("decision", None)
        puerta.pop("firmar_en", None)
        escribir(idx, puerta)
        return puerta


def marcar(gid: str, **campos) -> dict:
    """Actualiza campos de presentación (ver_at, respuestas, telegram…) de una puerta."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx)
        if not puerta:
            raise Rechazo("No conozco esta puerta")
        for k, v in campos.items():
            if k == "respuesta":
                if puerta.get("estado") != "abierta":
                    raise Rechazo("Esta puerta ya está resuelta")
                n, letra = v
                q = next((q for q in puerta.get("preguntas") or [] if str(q["n"]) == str(n)), None)
                if not q or letra not in q.get("opciones", []):
                    raise Rechazo("Respuesta no válida")
                puerta.setdefault("respuestas", {})[str(n)] = letra
            elif v is None:
                puerta.pop(k, None)
            else:
                puerta[k] = v
        escribir(idx, puerta)
        return puerta


def puertas(estados=("abierta", "decidida")) -> list:
    return [p for p in (leer(f) for f in sorted((HOME / "puertas").glob("*.json"))) if p and p.get("estado") in estados]


def evidencias(puerta: dict) -> list:
    """Ficheros de la demo de una FASE (nombres; el canal decide cómo enseñarlos)."""
    if not puerta.get("fase"):
        return []
    carpeta = Path(puerta["repo"]) / "evidencias" / f"FASE-{puerta['fase']}"
    if not carpeta.is_dir():
        return []
    return sorted(p.name for p in carpeta.iterdir() if p.suffix.lower() in (".png", ".jpg", ".jpeg", ".mp4", ".webm", ".mov"))


def fichero_evidencia(puerta: dict, nombre: str) -> Path:
    if nombre not in evidencias(puerta):
        raise Rechazo("No existe esa evidencia")
    return Path(puerta["repo"]) / "evidencias" / f"FASE-{puerta['fase']}" / nombre
