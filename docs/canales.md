# Canales

Una puerta no es de Telegram ni del panel: es un fichero (`$HERMES_SDD_HOME/puertas/<id>.json`). Un **canal** solo
la presenta y convierte el gesto de una persona en una llamada al núcleo (`plugin/hermes-sdd/hsdd_nucleo.py`), que
valida y guarda la decisión normalizada. El notario (`firmar.sh`) no sabe de qué canal viene: comprueba que la
identidad de ese canal pertenece a la persona en `aprobadores.json` y firma.

```
canal ──gesto──▶ hsdd_nucleo.decidir(puerta, verbo, texto, persona, canal, id, prueba)
                   · puerta abierta · persona autorizada en ESE canal · demo vista antes del paso 2
                   · motivo obligatorio donde toca · respuestas del formulario Q1·A…
                 ──▶ <repo>/.sdd/hermes/decisiones/<puerta>.json  +  ventana de deshacer (180 s por defecto; SDD → Configuración)
gateway ─────────▶ firmar.sh (notario)  ──▶ registro, commit, tag, tarjeta, siguiente tramo
```

## Canales disponibles

| Canal | Identidad | Fuerza | Dónde |
|---|---|---|---|
| `telegram` | `from.id` del update (el bot hace polling: Telegram lo firma) | alta | `plugin/hermes-sdd/__init__.py` |
| `dashboard` | con login del panel: email o id de la cuenta; en modo local (127.0.0.1, sin login): el usuario del sistema que arrancó el panel | media / baja en local | `plugin/hermes-sdd/dashboard/` |
| `local` | `$USER` de quien ejecuta `decidir.sh` | baja (plan B) | `decidir.sh` |

Si una puerta se decide o se deshace en un canal, los demás se ponen al día solos (el mensaje de Telegram pasa a
«decidida desde dashboard» con su botón de deshacer).

### Panel web (pestaña «SDD»)

`bash instalar.sh` copia el plugin con su parte de panel; reinicia `hermes dashboard` para montar sus rutas
(`/api/plugins/hermes-sdd/…`). La pestaña enseña las puertas abiertas con su demo (capturas y vídeo), el formulario de
preguntas y los botones, la lista de proyectos con sus hitos y las últimas firmas. El instalador añade a
`aprobadores.json` el canal `dashboard` para el usuario local.

No expongas el panel con `--host 0.0.0.0` sin el login del panel: en modo local la identidad es «quien está sentado
en esta máquina», y el plugin rechaza (403) cualquier petición que no venga de 127.0.0.1.

### Hermes Desktop (pestaña «SDD»)

La misma pestaña, escrita con el SDK de la app (`plugin/hermes-sdd/desktop/plugin.js`), sobre el mismo backend que el
panel. Hermes copia esa parte a `~/.hermes/desktop-plugins/hermes-sdd/` y la deja **apagada**: se activa en
**Capabilities → Plugins** (pulsa **Rescan** si no aparece). Sale en la barra lateral y en ⌘K.

El panel y Desktop pintan la misma pestaña: `plugin/hermes-sdd/ui/sdd.js` es el único código, y
`python3 plugin/hermes-sdd/ui/construir.py` genera `dashboard/dist/index.js` y `desktop/plugin.js` con el adaptador
de cada uno (no se editan a mano; `tests/ui.sh` falla si no están al día).

La identidad es la del canal `dashboard`: contra el backend local, Hermes verifica que la petición viene de la app
del mismo usuario (credencial nativa de Desktop) y el plugin decide como el usuario del sistema, que debe figurar en
`aprobadores.json` con canal `dashboard`. La decisión queda marcada con `modo: desktop`. Contra un backend remoto con
login, la identidad es la cuenta de esa sesión, como en el panel.

Las capturas de la demo llegan como imágenes dentro de la pestaña. Un vídeo de más de 25 MB se abre en el Finder.

## Añadir un canal (Slack, email…)

1. Presentar: leer `hsdd_nucleo.puertas()` y enseñar `titulo`, `texto`, `opciones` (respetando `paso`: primero
   `ver`), `preguntas` y, en FASEs, `hsdd_nucleo.evidencias()`.
2. Identificar: sacar la identidad **del canal**, nunca de un texto que escriba alguien (Slack: `user.id` de una
   interacción firmada por Slack; email: enlace de un solo uso con caducidad o respuesta con DKIM verificado).
3. Decidir: `persona = hsdd_nucleo.persona_de("<canal>", id)` y `hsdd_nucleo.decidir(...)`; `marcar(ver_at=…)` al
   enseñar la demo; `marcar(respuesta=(n, letra))` en el formulario; `deshacer(id, persona)`.
4. Ponerse al día: comparar `hsdd_nucleo.clave_vista(puerta)` con la última que enseñó el canal.
5. Dar de alta la identidad en `aprobadores.json` (`"canales": {"slack": "U0…"}`) y añadir una prueba como
   `tests/plugin_dashboard.py`.

Hermes ya trae las piezas para Slack (`ctx.register_slack_action_handler`) y un adaptador de email; no se incluyen
aún porque no se han podido probar con una cuenta real.
