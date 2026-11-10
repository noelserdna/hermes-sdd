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
import re
import time
from datetime import datetime, timezone
from pathlib import Path

HOME = Path(os.environ.get("HERMES_SDD_HOME", Path.home() / ".hermes" / "hermes-sdd"))
DESHACER_DEFECTO_S = 180
DESHACER_MIN_S, DESHACER_MAX_S = 10, 86400


def deshacer_s() -> int:
    """Segundos para deshacer una decisión antes de que el notario la firme. Se lee en cada decisión: cambiarlo no pide
    reiniciar nada. HERMES_SDD_DESHACER_S (pruebas, operación) manda sobre sdd.json → "deshacer_s"."""
    if os.environ.get("HERMES_SDD_DESHACER_S"):
        return int(os.environ["HERMES_SDD_DESHACER_S"])
    try:
        v = int((leer(HOME / "sdd.json", {}) or {}).get("deshacer_s") or DESHACER_DEFECTO_S)
    except (TypeError, ValueError):
        return DESHACER_DEFECTO_S
    return min(max(v, DESHACER_MIN_S), DESHACER_MAX_S)


def duracion(s: int) -> str:
    """180 → «3 min», 90 → «1 min 30 s», 45 → «45 s», 7200 → «2 h»."""
    h, m, s = s // 3600, s % 3600 // 60, s % 60
    partes = [f"{h} h"] * bool(h) + [f"{m} min"] * bool(m) + [f"{s} s"] * bool(s)
    return " ".join(partes) or "0 s"


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


def _registrar(idx: Path, puerta: dict, verbo: str, texto: str, actor: dict, prueba: dict) -> dict:
    """Guarda la decisión normalizada (la lee el notario) y abre la ventana de deshacer. Con el cerrojo tomado."""
    if puerta.get("preguntas") and verbo != "rechazo":
        resp = ", ".join(f"Q{n}: {l}" for n, l in respuestas(puerta).items() if l)
        texto = f"{texto}. {resp}" if texto else resp
    decision = {"verbo": verbo, "texto": texto, "actor": actor, "prueba": prueba, "at": ahora()}
    dirdec = Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones"
    dirdec.mkdir(parents=True, exist_ok=True)
    escribir(dirdec / f"{puerta['id']}.json", decision)
    if puerta.get("ver_at"):
        decision["dwell_s"] = int(time.time() - puerta["ver_at"])
    puerta.update(estado="decidida", decision=decision, firmar_en=time.time() + deshacer_s())
    escribir(idx, puerta)
    return puerta


def decidir(gid: str, verbo: str, texto: str, persona: str, canal: str, ident: str, prueba: dict) -> dict:
    """Registra la decisión de `persona` (ya identificada por el canal) y abre la ventana de deshacer.
    Devuelve la puerta actualizada. Lanza Rechazo si no procede."""
    if canal == JEV:
        raise Rechazo("Jev decide solo con aplicar_jev")
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
        return _registrar(idx, puerta, verbo, texto, {"persona": persona, "canal": canal, "id": str(ident)}, prueba)


def deshacer(gid: str, persona: str) -> dict:
    """Quien decidió, o cualquier persona autorizada si decidió Jev; solo mientras no se haya firmado. Deshacer una
    decisión de Jev la veta: esa puerta ya solo la decide una persona."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx) or {}
        dec = puerta.get("decision") or {}
        de_jev = dec.get("actor", {}).get("canal") == JEV
        if puerta.get("estado") != "decidida" or not persona or (dec.get("actor", {}).get("persona") != persona and not de_jev):
            raise Rechazo("Ya no se puede deshacer")
        (Path(puerta["repo"]) / ".sdd" / "hermes" / "decisiones" / f"{gid}.json").unlink(missing_ok=True)
        puerta.update(estado="abierta")
        if de_jev:
            puerta["jev_vetado"] = {"por": persona, "at": ahora()}
        puerta.pop("decision", None)
        puerta.pop("firmar_en", None)
        escribir(idx, puerta)
        return puerta


# ── Jev (TypeSafe) en las puertas: consejo, piloto automático o todo automático ─────────────────────────────────────
# Modos por proyecto (jev.json en $HERMES_SDD_HOME, nunca en el repo: el ejecutor no debe poder cambiarlo):
#   humano   Jev no interviene (por defecto)
#   consejo  Jev recomienda en cada puerta; decide siempre una persona
#   piloto   como consejo, y Jev decide él mismo las puertas de los tipos de "piloto" (ruta y plan por defecto)
#   auto     Jev decide cualquier puerta, FASEs y entrega incluidas
# En todos los modos Jev solo puede dar por buena una puerta (verbos sin texto): si se inclina por pedir cambios o
# rechazar, o no llega al umbral, la puerta queda para una persona. Las reglas duras de puede_jev mandan sobre el modo.
JEV = "jev"
MODOS = ("humano", "consejo", "piloto", "auto")
JEV_DEFECTO = {"defecto": "humano", "proyectos": {}, "piloto": ["ruta", "plan"], "umbral": 0.9}


def config_jev() -> dict:
    return {**JEV_DEFECTO, **(leer(HOME / "jev.json", {}) or {})}


def modo_jev(tablero: str, cfg: dict | None = None) -> str:
    cfg = cfg or config_jev()
    modo = (cfg.get("proyectos") or {}).get(tablero or "local", cfg.get("defecto", "humano"))
    return modo if modo in MODOS else "humano"


def poner_modo(modo: str, tablero: str | None = None) -> dict:
    """Cambia el modo de un proyecto (o el de por defecto si tablero es None)."""
    if modo not in MODOS:
        raise Rechazo(f"Modo desconocido: {modo}. Modos: {', '.join(MODOS)}")
    cfg = config_jev()
    if tablero:
        cfg["proyectos"] = {**(cfg.get("proyectos") or {}), tablero: modo}
    else:
        cfg["defecto"] = modo
    escribir(HOME / "jev.json", cfg)
    return cfg


TIPOS_PUERTA = ("requisitos", "ruta", "plan", "fase", "entrega", "mantenimiento")


def ajustar_jev(defecto: str | None = None, umbral=None, piloto: list | None = None) -> dict:
    """Ajustes generales de Jev (los modos por proyecto, con poner_modo). Valida todo antes de escribir."""
    cfg = config_jev()
    if defecto is not None:
        if defecto not in MODOS:
            raise Rechazo(f"Modo desconocido: {defecto}. Modos: {', '.join(MODOS)}")
        cfg["defecto"] = defecto
    if umbral is not None:
        try:
            u = float(umbral)
        except (TypeError, ValueError):
            raise Rechazo("El umbral es un número entre 0 y 1")
        if not 0.5 <= u <= 1:
            raise Rechazo("El umbral va de 0.5 a 1: por debajo, Jev decidiría casi a cara o cruz")
        cfg["umbral"] = u
    if piloto is not None:
        if not isinstance(piloto, list) or any(t not in TIPOS_PUERTA for t in piloto):
            raise Rechazo(f"Tipos de puerta: {', '.join(TIPOS_PUERTA)}")
        cfg["piloto"] = [t for t in TIPOS_PUERTA if t in piloto]
    escribir(HOME / "jev.json", cfg)
    return cfg


def verbos_jev(puerta: dict) -> dict:
    """Opciones que Jev puede elegir: las que no piden un motivo escrito."""
    return {o["verbo"]: o["etiqueta"] for o in puerta.get("opciones", []) if o["verbo"] != "ver" and not o.get("texto")}


def puede_jev(puerta: dict, cfg: dict | None = None) -> tuple[bool, str]:
    """¿Puede Jev decidir esta puerta (si está seguro)? → (sí/no, motivo). Lo usan el gateway y el notario."""
    cfg = cfg or config_jev()
    modo = modo_jev(puerta.get("tablero", ""), cfg)
    tipo = puerta.get("tipo", "")
    if modo in ("humano", "consejo"):
        return False, f"modo {modo}"
    if modo == "piloto" and tipo not in (cfg.get("piloto") or []):
        return False, f"en modo piloto las puertas de {tipo} las decide una persona"
    if puerta.get("jev_vetado"):
        return False, "una persona deshizo la decisión de Jev"
    if modo == "piloto" and puerta.get("preguntas"):
        return False, "hay preguntas abiertas (clase C): en modo piloto las contesta una persona"
    texto = puerta.get("texto", "")
    if "⛔" in texto:
        return False, "la puerta muestra un bloqueo (⛔)"
    m = re.search(r"Tests existentes con líneas borradas o cambiadas: (\d+)", texto)
    if m and int(m.group(1)) > 0:
        return False, "se modificaron tests que ya existían (art. 12: lo revisa una persona)"
    if not verbos_jev(puerta):
        return False, "ninguna opción de esta puerta se puede elegir sin escribir un motivo"
    return True, f"modo {modo}"


def _preguntas_jev() -> dict:
    return leer(Path(__file__).with_name("jev_puertas.json"), {}) or {}


def pregunta_jev(puerta: dict) -> dict:
    """La pregunta de TypeSafe para esta puerta: una Choice entre los verbos sin texto y «persona»."""
    q = _preguntas_jev()
    tipo = (q.get("tipos") or {}).get(puerta.get("tipo", ""), {})
    criterios = {v: tipo.get("verbos", {}).get(v, f"Choose «{e}»") for v, e in verbos_jev(puerta).items()}
    # Preguntas abiertas: en auto la persona delegó sus respuestas (aprobar acepta las recomendadas) y Jev juzga si son
    # aceptables; en los demás modos, que haya preguntas ya es motivo para que decida una persona.
    # En auto la persona delegó la decisión: Jev aprueba lo que responde fielmente a lo pedido y solo devuelve la puerta
    # ante un problema concreto (instructions_auto); en consejo y piloto, ante cualquier duda.
    auto = modo_jev(puerta.get("tablero", "")) == "auto"
    delegadas = bool(puerta.get("preguntas")) and auto
    if auto:
        criterios["persona"] = q.get("persona_auto") or q.get("persona", "A person must decide")
    elif puerta.get("preguntas"):
        criterios["persona"] = q.get("persona_preguntas") or q.get("persona", "A person must decide")
    else:
        criterios["persona"] = q.get("persona", "A person must decide")
    base = (q.get("instructions_auto") if auto else None) or q.get("instructions", "")
    instrucciones = f"{base} {tipo.get('contexto', '')}"
    if delegadas:
        instrucciones += " " + q.get("preguntas_auto", "")
    return {"decision": {"type": "choice", "criteria": criterios, "instructions": instrucciones.strip()}}


def estado_jev(puerta: dict, max_chars: int = 90000) -> dict:
    """Lo que Jev lee: la puerta tal como la vería la persona y los documentos que hay detrás."""
    repo = Path(puerta.get("repo", "."))
    tipo = puerta.get("tipo", "")
    ficheros = {"requisitos": ["requirements/CUSTOMER-NEEDS.md", "requirements/REQUIREMENTS.md"],
                "ruta": [".sdd/hermes/ruta.json"],
                "plan": sorted(str(p.relative_to(repo)) for p in (repo / "plan" / "fases").glob("FASE-*.md"))
                        if (repo / "plan" / "fases").is_dir() else [],
                "fase": ["acceptance/ACCEPTANCE-REPORT.md"],
                "entrega": ["acceptance/ACCEPTANCE-REPORT.md"]}.get(tipo, [])
    contexto, resto = {}, max_chars
    for f in ficheros:
        try:
            t = (repo / f).read_text(errors="replace")
        except OSError:
            continue
        contexto[f] = t[:max(0, resto)]
        resto -= len(contexto[f])
    for f in sorted(repo.glob(".sdd/questions-*.md")) if puerta.get("preguntas") else []:
        try:   # las preguntas abiertas con sus opciones (la recomendada, marcada)
            contexto[str(f.relative_to(repo))] = f.read_text(errors="replace")[:max(0, resto)]
            resto -= len(contexto[str(f.relative_to(repo))])
        except OSError:
            pass
    if puerta.get("hallazgos"):
        contexto["hallazgos"] = json.dumps(puerta["hallazgos"], ensure_ascii=False)[:20000]
    return {"puerta": {k: puerta.get(k) for k in ("tipo", "titulo", "texto")},
            "opciones": {**verbos_jev(puerta), "persona": "Que lo decida una persona"}, "contexto": contexto}


def aplicar_jev(gid: str, juicio: dict) -> dict:
    """Guarda el juicio de Jev en la puerta y, si el modo lo permite y Jev está seguro, registra su decisión.
    juicio: {"choice", "p", "confidence", "modelo"} o {"error"}. Devuelve la puerta actualizada."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx)
        if not puerta:
            raise Rechazo("No conozco esta puerta")
        cfg = config_jev()
        modo = modo_jev(puerta.get("tablero", ""), cfg)
        umbral = float(cfg.get("umbral", 0.9))
        jev = {**juicio, "modo": modo, "umbral": umbral, "at": ahora()}
        if puerta.get("estado") != "abierta":
            jev["decide"], jev["motivo"] = False, "la puerta ya estaba resuelta"
        elif juicio.get("error"):
            jev["decide"], jev["motivo"] = False, "Jev no respondió"
        else:
            puede, motivo = puede_jev(puerta, cfg)
            eleccion, p = juicio.get("choice"), float(juicio.get("p") or 0)
            if not puede:
                jev["decide"], jev["motivo"] = False, motivo
            elif eleccion not in verbos_jev(puerta):
                jev["decide"], jev["motivo"] = False, "Jev pide que lo decida una persona"
            elif p < umbral:
                jev["decide"], jev["motivo"] = False, f"Jev no está seguro (p {p:.2f} < {umbral:.2f})"
            else:
                jev["decide"], jev["motivo"] = True, motivo
        puerta["jev"] = jev
        if not jev["decide"]:
            escribir(idx, puerta)
            return puerta
        prueba = {"modelo": juicio.get("modelo", ""), "p": f"{float(juicio['p']):.3f}", "modo": modo,
                  "demo": "no vista" if puerta.get("tipo") == "fase" else ""}
        return _registrar(idx, puerta, juicio["choice"], "",
                          {"persona": JEV, "canal": JEV, "id": juicio.get("modelo") or "jev"},
                          {k: v for k, v in prueba.items() if v})


def rejuzgar_jev(gid: str) -> dict:
    """Borra el juicio de Jev de una puerta abierta para que el gateway le vuelva a preguntar (p. ej. tras cambiar el
    modo o sus instrucciones). No vale para una puerta en la que una persona deshizo a Jev."""
    with cerrojo():
        idx = indice(gid)
        puerta = leer(idx)
        if not puerta:
            raise Rechazo("No conozco esta puerta")
        if puerta.get("estado") != "abierta":
            raise Rechazo("Solo se puede volver a preguntar a Jev en una puerta abierta")
        if puerta.get("jev_vetado"):
            raise Rechazo("Una persona deshizo a Jev en esta puerta: ya solo la decide una persona")
        puerta.pop("jev", None)
        escribir(idx, puerta)
        return puerta


def describir_jev(puerta: dict) -> str:
    """Una línea para los canales: qué dijo Jev en esta puerta."""
    j = puerta.get("jev") or {}
    if not j:
        return ""
    if j.get("error"):
        return f"🤖 Jev no respondió ({j['error'][:80]}); decide una persona."
    etiqueta = verbos_jev(puerta).get(j.get("choice"), "que lo decida una persona")
    linea = f"🤖 Jev recomienda: {etiqueta} (p {float(j.get('p') or 0):.2f}, modo {j.get('modo')})"
    if not j.get("decide") and j.get("modo") in ("piloto", "auto"):
        linea += f"\n   No decide él: {j.get('motivo')}."
    return linea


if __name__ == "__main__":   # CLI del notario y de jev.sh
    import sys
    a = sys.argv[1:]
    try:
        if a[:1] == ["permite-jev"]:      # permite-jev <puerta.json> <verbo> <p>: ¿vale una decisión de Jev?
            puerta, verbo, p = leer(Path(a[1])) or {}, a[2], float(a[3] or 0)
            # El veto (una persona deshizo a Jev) vive en el índice global, no en la copia del repo
            global_ = (leer(indice(puerta["id"]), {}) or {}) if puerta.get("id") else {}
            ok, motivo = puede_jev({**puerta, "jev_vetado": global_.get("jev_vetado")})
            if ok and verbo not in verbos_jev(puerta):
                ok, motivo = False, f"Jev no puede elegir «{verbo}»"
            if ok and p < float(config_jev().get("umbral", 0.9)):
                ok, motivo = False, f"p {p} por debajo del umbral"
            print(f"{modo_jev(puerta.get('tablero', ''))}" if ok else motivo)
            sys.exit(0 if ok else 1)
        if a[:1] == ["rejuzgar"]:         # rejuzgar <puerta>
            rejuzgar_jev(a[1]); print(f"El gateway volverá a preguntar a Jev por {a[1]} en unos segundos"); sys.exit(0)
        if a[:1] == ["modo"]:             # modo [<modo> [<tablero>]]
            if len(a) > 1:
                poner_modo(a[1], a[2] if len(a) > 2 else None)
            print(json.dumps(config_jev(), ensure_ascii=False, indent=2))
            sys.exit(0)
    except Rechazo as e:
        print(e, file=sys.stderr)
        sys.exit(2)
    print("uso: hsdd_nucleo.py permite-jev <puerta.json> <verbo> <p> | modo [<modo> [<tablero>]]", file=sys.stderr)
    sys.exit(2)


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
