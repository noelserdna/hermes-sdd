"""Guardia del ENCARGADO (hook pre_tool_call de Hermes, fail-closed). Lee, conversa y prepara la entrada.

  python3 -I guardia.py <repo> <arnes>      (lee el evento de stdin)

- write_file / patch: dentro de <repo>/wiki/ (su memoria, un repositorio git propio). Mientras el proyecto está en
  preparación (<repo>/.sdd/hermes/preparando, lanzar.sh preparar), también intent/ y requirements/ (la entrada).
- Su única acción: `bash <arnes>/encargado.sh lanzar <repo>`, y solo en preparación.
- execute_code: nunca.
- terminal: lista BLANCA de órdenes de solo lectura, segmento a segmento (; && || |). Sin redirecciones a ficheros,
  sin sustituciones ($( ) ni ``), nada de ~/.hermes salvo el propio arnés. Git del proyecto solo para leer; en el wiki,
  cualquier cosa menos push. La CLI del método y `hsdd_proyectos.py estado`, solo en sus órdenes de lectura.

Bloquear = imprimir {"decision":"block","reason":…} y salir con 2 (dialecto de Hermes). Permitir = salir con 0.
"""
from __future__ import annotations

import json
import os
import re
import shlex
import sys

REPO, ARNES = os.path.realpath(sys.argv[1]), os.path.realpath(sys.argv[2])
ARNES_RUTAS = {ARNES, os.path.abspath(os.path.expanduser(sys.argv[2]))}   # la real (…/0.3.2) y la del enlace (…/actual)
WIKI = os.path.join(REPO, "wiki")
PREPARANDO = os.path.exists(os.path.join(REPO, ".sdd", "hermes", "preparando"))
ENTRADA = [os.path.join(REPO, "intent"), os.path.join(REPO, "requirements")] if PREPARANDO else []
HOME = os.path.expanduser("~")


def bloquear(motivo: str) -> None:
    print(json.dumps({"decision": "block", "reason": f"hermes-sdd (encargado): {motivo}. El encargado lee, conversa, "
                      "escribe en su wiki y, mientras el proyecto se prepara, la entrada; explícale a la persona qué harías."}, ensure_ascii=False))
    sys.exit(2)


def ruta(p: str, base: str = REPO) -> str:
    p = os.path.expanduser(p)
    return os.path.realpath(p if os.path.isabs(p) else os.path.join(base, p))


def dentro(p: str, d: str) -> bool:
    return p == d or p.startswith(d + os.sep)


LECTURA = {"ls", "cat", "head", "tail", "grep", "egrep", "rg", "wc", "jq", "sort", "uniq", "cut", "tr", "diff", "tree",
           "file", "stat", "date", "echo", "printf", "pwd", "basename", "dirname", "realpath", "column", "nl", "true",
           "cd", "test", "[", "shasum", "sha256sum", "md5", "md5sum"}
GIT_LECTURA = {"log", "show", "diff", "status", "blame", "describe", "rev-parse", "ls-files", "shortlog", "rev-list",
               "cat-file", "grep", "reflog"}
SDD_LECTURA = {"status", "trace", "gate", "lint", "tasks", "coverage", "context", "query", "impact", "gaps", "accept",
               "route", "journal"}


def segmento(seg: list, cwd: str) -> str | None:
    """None si el segmento es de lectura; si no, el motivo."""
    while seg and re.match(r"^[A-Za-z_][A-Za-z0-9_]*=", seg[0]):   # VAR=valor delante
        seg = seg[1:]
    if not seg:
        return None
    cmd, args = os.path.basename(seg[0]), seg[1:]
    if cmd in LECTURA:
        return None
    if cmd == "find":
        return None if not any(a in ("-exec", "-execdir", "-delete", "-ok", "-fprint", "-fls") for a in args) else "find con acciones"
    if cmd == "sed":
        return None if "-n" in args and not any(a.startswith("-i") or a.startswith("--in-place") for a in args) else "sed que no es solo lectura (-n)"
    if cmd == "git":
        d = cwd
        while args[:1] == ["-C"] and len(args) >= 2:
            d = ruta(args[1], d); args = args[2:]
        sub = args[0] if args else ""
        if dentro(d, WIKI):
            return None if sub != "push" else "publicar el wiki (push) lo decide una persona"
        if sub in GIT_LECTURA or (sub == "tag" and (len(args) == 1 or "-l" in args or "--list" in args)
                                  and not any(a in ("-d", "-a", "-f", "-s", "-m", "--delete") for a in args)) \
                or (sub == "branch" and all(a in ("-a", "--list", "-v", "-r") for a in args[1:])):
            return None
        return f"git {sub} en el proyecto (solo lectura: log, show, diff, status…)"
    if cmd in ("bash", "sh") and args and os.path.basename(args[0]) == "encargado.sh":
        if dentro(ruta(args[0], cwd), ARNES) and args[1:2] == ["lanzar"] and len(args) == 3 and ruta(args[2], cwd) == REPO:
            return None if PREPARANDO else "el proyecto ya se lanzó"
        return "de encargado.sh solo puede usar «lanzar» con su propio proyecto"
    if cmd in ("python3", "python"):
        script = next((a for a in args if a.endswith(".py")), "")
        nombre = os.path.basename(script)
        if dentro(ruta(script, cwd), ARNES) and ((nombre == "hsdd_proyectos.py" and "estado" in args)
                                                 or (nombre == "hsdd_plan.py" and "dependencias" in args)):
            return None
        return "solo puede ejecutar hsdd_proyectos.py estado y hsdd_plan.py dependencias del arnés"
    if cmd == "node":
        script = next((a for a in args if a.endswith("sdd.mjs")), "")
        if not script or not dentro(ruta(script, cwd), ARNES):
            return "solo puede ejecutar la CLI del método (sdd.mjs) del arnés"
        resto = args[args.index(script) + 1:]
        sub = resto[0] if resto else ""
        if sub not in SDD_LECTURA:
            return f"sdd {sub} no es una orden de lectura"
        texto = " ".join(resto)
        if re.search(r"\b(record|measure|challenge|pack|add)\b|--(report|write|fix|confirm|set)\b", texto):
            return f"sdd {texto[:40]} escribe; el encargado solo lee"
        return None
    return f"la orden «{cmd}» no está en la lista de lectura"


def terminal(c: str, cwd: str) -> None:
    if re.search(r"\$\(|`|<\(|>\(", c):
        bloquear("sin sustituciones de órdenes ($( ), ``)")
    sin_null = re.sub(r"\d?>&\d|\d?>\s*/dev/null", "", c)
    if re.search(r">", sin_null):
        bloquear("sin redirecciones a ficheros: para escribir, usa write_file en wiki/")
    sin_arnes = c.replace("~/", HOME + "/")
    for a in sorted(ARNES_RUTAS, key=len, reverse=True):   # las rutas del propio arnés (plugin, CLI) sí se usan
        sin_arnes = sin_arnes.replace(a, "")
    if re.search(r"\.hermes(/|\s|$)", sin_arnes):
        bloquear("el estado de Hermes no se lee ni se toca desde el encargado")
    if re.search(r"(aprobadores|jev|sdd)\.json|\.sdd/hermes/(decisiones|puertas)", c):
        bloquear("decisiones, puertas, aprobadores y configuración no son cosa del encargado")
    try:   # se analiza sin las redirecciones inocuas (2>&1, >/dev/null): el & de 2>&1 no separa órdenes
        lex = shlex.shlex(sin_null, posix=True, punctuation_chars=";&|")
        lex.whitespace_split = True
        toks = list(lex)
    except ValueError:
        bloquear("orden que no se puede analizar (comillas sin cerrar)")
    seg, d = [], cwd
    for t in toks + [";"]:
        if t and set(t) <= set(";&|"):
            if seg:
                if os.path.basename(seg[0]) == "cd" and len(seg) > 1:
                    d = ruta(seg[1], d)
                m = segmento(seg, d)
                if m:
                    bloquear(m)
            seg = []
        else:
            seg.append(t)


def main() -> None:
    try:
        ev = json.load(sys.stdin)
    except ValueError:
        bloquear("evento ilegible")
    herramienta = ev.get("tool_name") or ""
    entrada = ev.get("tool_input") or {}
    if herramienta == "execute_code":
        bloquear("sin código suelto")
    if herramienta in ("write_file", "patch"):
        p = ruta(str(entrada.get("path") or entrada.get("file_path") or ""))
        if dentro(p, os.path.join(WIKI, ".git")) or not (dentro(p, WIKI) or any(dentro(p, d) for d in ENTRADA)):
            donde = "su wiki, intent/ y requirements/ (en preparación)" if PREPARANDO else f"su wiki ({WIKI})"
            bloquear(f"solo escribe en {donde}, no en {p}")
        sys.exit(0)
    if herramienta == "terminal":
        terminal(str(entrada.get("command") or ""), ruta(str(entrada.get("workdir") or entrada.get("cwd") or REPO)))
    sys.exit(0)


if __name__ == "__main__":
    main()
