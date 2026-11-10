# Jev en las puertas

Por defecto, cada puerta la decides tú. Si tienes una clave de [TypeSafe](https://typesafe.ai)
(`TYPESAFE_API_KEY`), puedes dejar que **Jev**, su modelo de juicio rápido, te ayude o decida por ti. Cuánto le
dejas hacer lo eliges tú, proyecto a proyecto.

| Modo | Qué hace Jev | Quién decide |
|---|---|---|
| `humano` (por defecto) | nada | tú |
| `consejo` | recomienda una opción en cada puerta, con su seguridad | tú |
| `piloto` | recomienda en todas, y decide él las puertas de **ruta** y **plan** | Jev en ruta y plan; tú en el resto |
| `auto` | decide cualquier puerta: requisitos, FASEs, entrega y mantenimiento | Jev, salvo en los casos de abajo |

## Cómo se elige

```bash
bash jev.sh                      # modos actuales
bash jev.sh recetas consejo      # modo de un proyecto (el nombre de su tablero)
bash jev.sh piloto               # modo por defecto para todos los proyectos
bash jev.sh umbral 0.9           # seguridad mínima para que Jev decida él (por defecto 0.9)
bash jev.sh piloto ruta,plan     # qué puertas decide en modo piloto
bash jev.sh probar <puerta>      # pregunta a Jev por una puerta abierta y enseña su respuesta, sin decidir
```

También desde Telegram (`/jev`, `/jev recetas auto`) y desde la pestaña **SDD** del panel y de Hermes Desktop:
cada proyecto tiene sus cuatro botones de modo en **Proyectos**, y los ajustes generales están en **Configuración**.

La configuración vive en `~/.hermes/hermes-sdd/jev.json`, nunca en el repo del proyecto, y el ejecutor tiene
prohibido tocarla: un agente no puede darse a sí mismo más permisos.

## Lo que Jev nunca hace, en ningún modo

- **Rechazar o pedir cambios.** Jev elige entre las opciones que no piden un motivo escrito (aprobar, conforme,
  aceptar, ruta completa, lanzar cambio) y «que lo decida una persona». Si se inclina por algo que necesita un
  motivo, la puerta queda para ti con su consejo.
- **Decidir sin estar seguro.** Por debajo del umbral, la puerta queda para ti.
- **Decidir una puerta con un bloqueo.** Si la puerta muestra ⛔ (la puerta de calidad no se cumple), o si se
  modificaron tests que ya existían (artículo 12), decides tú.
- **Contestar preguntas abiertas en modo piloto.** Las preguntas de clase C tocan el contrato. En modo `auto`, al
  aprobar se aceptan las opciones recomendadas, y queda anotado que las aceptó Jev.
- **Ver la demo.** Jev no ve imágenes ni vídeo. En una FASE juzga el informe de aceptación (veredicto por
  requisito); la decisión queda marcada con `demo: no vista`.

## Lo que ves cuando decide Jev

La puerta te llega igual, por Telegram y al panel, pero ya decidida: «🤖 Ha decidido Jev (modo auto, p 0.94)», con
el botón **↩ Deshacer**. Tienes la misma ventana que con tus decisiones (180 s por defecto, configurable en **SDD → Configuración** o con
`nuevo.sh config --deshacer SEGUNDOS`) y puede deshacerla cualquier
persona autorizada. Una puerta en la que deshaces a Jev ya solo la decide una persona.

Cuando Jev no decide, la puerta llega con tus botones de siempre y una línea de consejo:
`🤖 Jev recomienda: ✅ Conforme (p 0.91, modo consejo)`.

## Qué queda registrado

El notario firma la decisión de Jev como de Jev, nunca como tuya:

- el commit y el diario dicen `Jev (jev-latest)`, con rol `Agente automático (modo auto)`;
- el tag (`requirements-v*`, `fase-N-accepted`, `entrega-N`) lleva `Accepted-by: Jev (…)` y
  `Channel: jev:… p:0.94 modo:auto`;
- `REQUIREMENTS.md` queda con `Approved by: Jev (…)`.

Así, mirando un tag sabes si lo aceptó una persona o un modelo. El notario vuelve a comprobar el modo al firmar: si
pasas un proyecto de `auto` a `consejo` mientras una decisión de Jev espera su firma, no se firma.

## Qué ve Jev

Una pregunta de elección (`plugin/hermes-sdd/jev_puertas.json`) con el texto de la puerta y los documentos que
hay detrás:

| Puerta | Documentos |
|---|---|
| requisitos | `CUSTOMER-NEEDS.md` y `REQUIREMENTS.md` |
| ruta | `.sdd/hermes/ruta.json` |
| plan | `plan/fases/FASE-*.md` |
| FASE y entrega | `acceptance/ACCEPTANCE-REPORT.md` |
| mantenimiento | los hallazgos de la revisión |

Esos textos salen de tu máquina hacia `api.typesafe.ai`. No actives Jev en proyectos cuyo código o documentación
no pueda salir.

## Si algo falla

- **«Jev no respondió» o «Jev apagado».** El gateway no tiene `TYPESAFE_API_KEY`. Ponla en `~/.hermes/.env` (o en
  el entorno del servicio) y reinicia el gateway. Mientras tanto decides tú: nada se queda parado.
- **Quiero ver qué diría Jev antes de activarlo.** `bash jev.sh probar <puerta>` con una puerta abierta
  (`ls ~/.hermes/hermes-sdd/puertas`).
- **Jev aprobó algo que no debía.** Deshazlo en la ventana. Si ya se firmó, es como cualquier otra aceptación: para
  una FASE, `/anular <proyecto> <fase> <motivo>`; para requisitos, un `/cambio`.
