#!/usr/bin/env python3
"""Genera la pestaña SDD para el panel web y para Hermes Desktop desde ui/sdd.js (un solo código para los dos).

Ninguno de los dos sitios deja importar otros ficheros (el panel carga un IIFE; Desktop solo resuelve
@hermes/plugin-sdk y react), así que cada salida lleva el código común y su adaptador: React, la API del plugin,
los componentes de la app y las variables de su tema.

    python3 plugin/hermes-sdd/ui/construir.py              regenera dashboard/dist/index.js y desktop/plugin.js
    python3 plugin/hermes-sdd/ui/construir.py --comprobar  falla si alguna salida no está al día (lo usa tests/ui.sh)
"""
import sys
from pathlib import Path

AQUI = Path(__file__).resolve().parent
PLUGIN = AQUI.parent
AVISO = "GENERADO por plugin/hermes-sdd/ui/construir.py desde ui/sdd.js: no lo edites a mano."

PANEL = """// hermes-sdd — pestaña «SDD» del panel web de Hermes (canal dashboard). {aviso}
// Sin build en el panel: IIFE con el SDK del panel (window.__HERMES_PLUGIN_SDK__).
(function () {{
  "use strict";
  const SDK = window.__HERMES_PLUGIN_SDK__;
  const {{ React }} = SDK;
  const {{ useState, useEffect, useCallback }} = SDK.hooks;
  const {{ Button, Badge, Input }} = SDK.components;
  const h = React.createElement;
  const API = "/api/plugins/hermes-sdd";
  const BOTON = {{ principal: "default", borde: "outline", peligro: "destructive", suave: "ghost" }};
  const ETIQUETA = {{ normal: "default", suave: "secondary", aviso: "secondary", borde: "outline" }};

{comun}

  const E = {{
    h, useState, useEffect, useCallback,
    api: {{
      get: (ruta) => SDK.fetchJSON(API + ruta),
      post: (ruta, cuerpo) => SDK.fetchJSON(API + ruta, {{
        method: "POST", headers: {{ "Content-Type": "application/json" }}, body: JSON.stringify(cuerpo || {{}}) }}),
    }},
    C: {{
      Boton: ({{ tono, ...p }}) => h(Button, {{ size: "sm", variant: BOTON[tono] || "default", ...p }}),
      Etiqueta: ({{ tono, ...p }}) => h(Badge, {{ variant: ETIQUETA[tono] || "default", ...p }}),
      Campo: (p) => h(Input, p),
    }},
    tema: {{ borde: "var(--color-border)", acento: "var(--color-primary)", peligro: "var(--color-destructive)" }},
    avisar: () => {{}},
    abrirRuta: null,
    intervalo: (fn, ms) => {{ const t = setInterval(fn, ms); return () => clearInterval(t); }},
  }};
  window.__HERMES_PLUGINS__.register("hermes-sdd", crearSDD(E));
}})();
"""

DESKTOP = """// hermes-sdd — pestaña «SDD» en Hermes Desktop. {aviso}
// Disco, sin build: ESM sin JSX. Mismo backend que el panel (dashboard/plugin_api.py → /api/plugins/hermes-sdd); decide
// como canal dashboard con la identidad del usuario de esta máquina. No firma: lo hace el notario desde el gateway.
import {{ createElement as h, useCallback, useEffect, useState }} from 'react'
import {{ Badge, Button, host, Input, PALETTE_AREA, ROUTES_AREA, SIDEBAR_NAV_AREA }} from '@hermes/plugin-sdk'

const RUTA = '/sdd'
const BOTON = {{ principal: 'default', borde: 'outline', peligro: 'destructive', suave: 'ghost' }}
const ETIQUETA = {{ normal: 'default', suave: 'muted', aviso: 'warn', borde: 'outline' }}

{comun}

export default {{
  id: 'hermes-sdd',
  name: 'SDD',
  register(ctx) {{
    const Pagina = crearSDD({{
      h, useState, useEffect, useCallback,
      api: {{
        get: ruta => ctx.rest(ruta),
        post: (ruta, cuerpo) => ctx.rest(ruta, {{ method: 'POST', body: cuerpo || {{}}, timeoutMs: 330000 }})
      }},
      C: {{
        Boton: ({{ tono, ...p }}) => h(Button, {{ size: 'sm', variant: BOTON[tono] || 'default', ...p }}),
        Etiqueta: ({{ tono, ...p }}) => h(Badge, {{ variant: ETIQUETA[tono] || 'default', ...p }}),
        Campo: p => h(Input, p)
      }},
      tema: {{ borde: 'var(--ui-stroke-secondary)', acento: 'var(--ui-accent)', peligro: 'var(--ui-text-primary)' }},
      avisar: m => host.notify({{ kind: 'info', message: m }}),
      abrirRuta: ruta => ctx.os.revealPath(ruta),
      intervalo: (fn, ms) => ctx.setInterval(fn, ms),   // se limpia solo al desactivar o recargar el plugin
      relleno: '16px 20px'
    }})
    ctx.registerMany([
      {{ id: 'page', area: ROUTES_AREA, data: {{ path: RUTA }}, render: () => h(Pagina, {{}}) }},
      {{ id: 'nav', area: SIDEBAR_NAV_AREA, data: {{ path: RUTA, label: 'SDD', codicon: 'shield' }} }},
      {{ id: 'open', area: PALETTE_AREA,
        data: {{ id: 'hermes-sdd.open', label: 'Abrir SDD (puertas, proyectos, nuevo proyecto)', keywords: ['sdd', 'puertas', 'nuevo', 'proyecto', 'jev'], run: () => host.navigate(RUTA) }} }}
    ])
  }}
}}
"""


def salidas() -> dict:
    comun = (AQUI / "sdd.js").read_text().rstrip() + "\n"
    sangrado = "".join(("  " + l if l.strip() else l) for l in comun.splitlines(keepends=True)).rstrip()
    return {PLUGIN / "dashboard" / "dist" / "index.js": PANEL.format(aviso=AVISO, comun=sangrado),
            PLUGIN / "desktop" / "plugin.js": DESKTOP.format(aviso=AVISO, comun=comun.rstrip())}


if __name__ == "__main__":
    viejas = [str(p.relative_to(PLUGIN)) for p, t in salidas().items() if not p.exists() or p.read_text() != t]
    if "--comprobar" in sys.argv:
        if viejas:
            print("Sin regenerar (python3 plugin/hermes-sdd/ui/construir.py): " + ", ".join(viejas), file=sys.stderr)
            sys.exit(1)
        sys.exit(0)
    for p, t in salidas().items():
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(t)
    print("Generados: " + ", ".join(str(p.relative_to(PLUGIN)) for p in salidas()))
