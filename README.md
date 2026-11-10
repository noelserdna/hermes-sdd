# hermes-sdd

**Construye software con un agente de IA sin perder el control de las decisiones.** La IA hace el trabajo, etapa a
etapa, y tú decides en momentos concretos (las *puertas*) con un botón en Telegram o en un panel web. Nada se da por
bueno sin tu decisión, y cada decisión queda firmada en git.

Es el método **SDD** (*Specification-Driven Development*: primero los requisitos, después el código, y cada requisito con
su prueba) montado como **arnés** para [Hermes Agent](https://github.com/NousResearch/hermes-agent).

> **Artículo 13.** El ejecutor nunca firma; el notario nunca decide; el orquestador nunca interpreta.

Probado de punta a punta con Hermes v0.21.6 y Claude Code 2.1: una CLI de tareas (10 requisitos, 4 FASEs) pasó de los
requisitos a la entrega con 10 decisiones tomadas con botones de Telegram. Coste real: unos 25 $ del ejecutor (46 min
de Claude) y céntimos de Hermes.

---

## Índice

1. [Cómo funciona](#1-cómo-funciona)
2. [Instalación](#2-instalación) · [macOS / Linux](#macos-y-linux) · [Windows](#windows)
3. [Tu primera vez: practicar gratis](#3-tu-primera-vez-practicar-gratis)
4. [Un proyecto de verdad](#4-un-proyecto-de-verdad)
5. [Decidir: las puertas](#5-decidir-las-puertas)
6. [Después de la entrega](#6-después-de-la-entrega)
7. [Qué garantiza y qué no](#7-qué-garantiza-y-qué-no)
8. [Problemas frecuentes](#8-problemas-frecuentes)
9. [Glosario](#9-glosario) · [Estructura del repo](#10-estructura-del-repo) · [Más documentación](#11-más-documentación)

---

## 1. Cómo funciona

Piensa en una obra: un **constructor** propone y construye, el **cliente** decide y un **notario** da fe de lo que
se decidió. Aquí es igual, con un papel por pieza:

| Papel | Quién | Qué hace | Fichero |
|---|---|---|---|
| **Propone** | el ejecutor (Claude Code con las skills del método) | hace una etapa entera sin preguntarte a mitad | `etapa.sh`, `executors/` |
| **Pregunta** | la puerta | te enseña el resultado y te pide una decisión con botones | `puerta.sh`, `plugin/` |
| **Decide** | tú (o quien esté autorizado) | un toque; tienes 3 min para deshacer | Telegram o el panel |
| **Firma** | el notario (sin IA) | comprueba quién decidió y sobre qué commit, lo registra y pone un tag de git | `firmar.sh` |
| **Orquesta** | el kanban de Hermes (sin IA) | encadena las etapas: un tablero por proyecto | `lanzar.sh` |

El recorrido de un proyecto (🚪 = puerta, donde decides tú):

```
 requisitos ─▶ 🚪 ─▶ ruta ─▶ 🚪 ─▶ plan ─▶ tareas ─▶ 🚪 ─▶ implementar N ─▶ aceptar N ─▶ 🚪 ─▶ … ─▶ cierre ─▶ 🚪 entrega
                                                                   ▲                       │
                                                                   └──── rechazo ──────────┘
```

1. **Requisitos:** qué tiene que hacer el software, cada requisito con criterios comprobables. Los apruebas tú.
2. **Ruta:** qué etapas opcionales necesita *este* proyecto (no todos necesitan specs formales). La confirmas tú.
3. **Plan y tareas:** el trabajo dividido en **FASEs**, y cada FASE en tareas de un commit cada una.
4. **Implementar y aceptar, FASE a FASE:** el ejecutor programa con los tests primero y te enseña una demo con
   capturas y vídeo. Aceptas o rechazas. Si rechazas, vuelve a implementar con lo que pediste.
5. **Cierre y entrega:** una comprobación global de que todos los requisitos se cumplen, y el tag `entrega-N`.

**Cuándo te pregunta el ejecutor.** Clasifica cada decisión que encuentra por el camino:

- **R, reversible:** elige la opción recomendada y lo anota.
- **C, toca el contrato:** te deja la pregunta por escrito con opciones y sigue con lo demás. La contestas en la
  siguiente puerta.
- **H, humana:** aceptar, conceder una exención, editar un test que ya existía… Nunca la toma él.

---

## 2. Instalación

**Qué necesitas**

| | Para qué |
|---|---|
| [Hermes Agent](https://github.com/NousResearch/hermes-agent) ≥ 0.21.6, con el gateway y Telegram configurados | orquesta y te trae las puertas |
| [Claude Code](https://claude.com/claude-code) | el ejecutor de las etapas pesadas |
| Node 22 (mínimo 18; Playwright, que hace las capturas de las demos, necesita 20 o más) | la CLI del método y los tests |
| `git`, `jq`, `rsync`, `python3`, `perl`, `openssl` | los scripts del arnés |

| Sistema | Cómo |
|---|---|
| macOS | directamente |
| Linux (Ubuntu/Debian) | directamente |
| Windows 10/11 | dentro de **WSL2** (un Ubuntu dentro de Windows), con un instalador automático |

### macOS y Linux

```bash
git clone https://github.com/noelserdna/hermes-sdd && cd hermes-sdd
hermes config set kanban.auto_decompose false   # el instalador lo comprueba
bash instalar.sh                                 # perfiles de Hermes, plugin de Telegram y del panel, aprobadores.json
hermes gateway restart                           # carga el plugin
bash tests/todo.sh                               # todas las pruebas, sin IA (~2 min): todo debe salir "ok"
```

Antes de hacer nada, `instalar.sh` comprueba que tienes las dependencias y te dice cómo instalar las que falten. En
Ubuntu, `bash windows/preparar-ubuntu.sh` instala todo lo anterior por ti (no hace falta que estés en Windows).

Qué deja instalado:

- Una copia del arnés en `~/.hermes/hermes-sdd/<versión>`, con un enlace `actual`.
- `~/.hermes/hermes-sdd/aprobadores.json`: tú como persona que decide, con tu id de Telegram.
- El plugin `hermes-sdd`: Telegram y la pestaña «Puertas SDD» del panel.
- Dos perfiles de Hermes con permisos mínimos y sin tus tokens: `sdd-estacion`, que solo ejecuta etapas y no decide
  nada, y `sdd-ejecutor`, para etapas ligeras.

Para actualizar: `git pull && bash instalar.sh`. Con etapas en marcha, usa `--sin-estacion`.

### Windows

En **PowerShell como administrador**:

```powershell
irm https://raw.githubusercontent.com/noelserdna/hermes-sdd/main/windows/instalar.ps1 | iex
```

Instala WSL2 y Ubuntu si no los tienes. Si Windows pide reiniciar, reinicia, abre «Ubuntu», crea tu usuario y vuelve a
ejecutarlo. Dentro de Ubuntu instala Node, Hermes, Claude Code y el arnés, y deja Ubuntu encendido en segundo plano
para que te sigan llegando las puertas. Al terminar te dice qué configurar a mano (tus claves y Telegram).

Guía completa, instalación a mano y problemas frecuentes: **[docs/windows.md](docs/windows.md)**.

> Tus proyectos van **dentro de Ubuntu** (`~/proyectos/…`), no en `C:\`. Desde Windows los ves en `\\wsl$\Ubuntu\home\<usuario>`.

---

## 3. Tu primera vez: practicar gratis

Antes de gastar en IA, recorre un proyecto entero **sin coste**. `practicar.sh` lo monta a partir de una ejecución real
grabada. Las tarjetas, las puertas, Telegram y el notario son de verdad. Lo que hace «el agente» es lo que hizo en la
grabación, y los tests se ejecutan de verdad.

```bash
bash practicar.sh grabaciones/todo-app ~/practica-todo
```

1. Te llega a Telegram la primera puerta: **requisitos**. Léelos y pulsa `✅`.
2. Siguen la ruta, el plan y las FASEs. En cada FASE pulsa `▶ Ver demo`, mira las capturas y el vídeo, y acepta.
3. Al final llega la puerta de **entrega**. Acéptala y tienes el tag `entrega-1` en `~/practica-todo`.

Cuesta 0 $ y tardas lo que tardes en decidir. Para ver lo que quedó: `git -C ~/practica-todo log --oneline` y
`git -C ~/practica-todo tag`.

---

## 4. Un proyecto de verdad

1. **Prepara el repo** (un repo git sin cambios pendientes):
   - `AGENTS.md` con su sección `## SDD Stack Profile`, que le dice al método cómo ejecutar tus tests. Parte de la
     plantilla [`templates/AGENTS.md`](templates/AGENTS.md):

     ```markdown
     ## SDD Stack Profile
     - stack: node-typescript
     - test: npx vitest run
     - test_file: npx vitest run {file}
     - code_paths: src/
     - test_paths: tests/
     ```

   - Lo que quieres construir. Basta con `requirements/CUSTOMER-NEEDS.md`: lo que pide el cliente, con sus palabras.
     El ejecutor redacta los requisitos a partir de ahí. Si ya tienes `requirements/REQUIREMENTS.md`, se usa tal cual.
2. **Lánzalo:**

   ```bash
   bash ~/.hermes/hermes-sdd/actual/lanzar.sh iniciar /ruta/al/repo
   ```

3. **Decide** cuando te llegue cada puerta. Entre puertas no tienes que hacer nada.

¿Tu repo ya tiene código pero nunca usó el método? Mira «Adoptar» en la [sección 6](#6-después-de-la-entrega).

---

## 5. Decidir: las puertas

Cada puerta te llega por **Telegram** y aparece también en el **panel web** (`hermes dashboard` → pestaña «Puertas
SDD»). Puedes decidir en cualquiera de los dos: al decidir en uno, el otro se actualiza.

| Puerta | Qué ves | Qué puedes hacer |
|---|---|---|
| Requisitos, ruta, plan | un resumen | `✅` · `✏️ cambios` (con motivo) · `❌` |
| FASE | 1º alertas, veredicto por requisito y `▶ Ver demo` (capturas y vídeo) | 2º `✅ Aceptar` · `📝 Con observaciones` · `❌ Rechazar` |
| Preguntas abiertas | un formulario `Q1·A Q1·B …` con la opción recomendada marcada | elegir una respuesta por pregunta |
| Entrega | la comprobación global de todos los requisitos | aceptar → tag `entrega-N` |

En las puertas de FASE se registra cuánto tiempo pasó entre ver la demo y decidir.

**Comandos de Telegram**

| Comando | Para qué |
|---|---|
| `/puertas` | puertas pendientes |
| `/estado [proyecto]` | en qué punto está cada proyecto |
| `/cambio <proyecto> <petición>` | pedir un cambio o una funcionalidad nueva |
| `/mantenimiento [proyecto]` | lanzar ahora la revisión de mantenimiento |
| `/pausar [proyecto\|todo] [ahora]` · `/reanudar [proyecto\|todo]` | parar y seguir |
| `/anular <proyecto> <fase> <motivo>` | anular una aceptación ya firmada (queda registrado, no se borra nada) |

Un mensaje por proyecto se actualiza en silencio con el progreso. Hay resúmenes a las 08:30 y a las 19:00, y silencio
de 22:00 a 8:00 (configurable en `~/.hermes/hermes-sdd/atencion.json`).

**Sin Telegram** (plan B): `bash decidir.sh <puerta> acepto`. Queda registrado que la decisión fue local.

Más detalle sobre cada canal y cómo añadir otros (Slack, email): [docs/canales.md](docs/canales.md).

---

## 6. Después de la entrega

- **Pedir un cambio o una funcionalidad nueva:** `/cambio <proyecto> <lo que quieres>` en Telegram, o
  `lanzar.sh cambio <repo> "…"`.
  1. Tu petición literal se guarda en `intent/INT-NNN.md`.
  2. El ejecutor la convierte en una versión nueva de los requisitos y tú decides en la puerta (tag `requirements-vN`).
  3. Se replanifica **solo lo nuevo**: las FASEs aceptadas no se tocan.
  4. Acaba en una entrega nueva.

  Medido: el comando `todo edit` sobre la CLI de tareas, de la petición al tag `entrega-2`, en 19 min de Claude y 8,66 $.
- **Adoptar un repo que nunca usó el método:** `lanzar.sh adoptar <repo>`. El ejecutor lee el código y propone
  requisitos, FASEs retroactivas y preguntas sobre lo que no puede deducir. Tu aprobación es el punto de partida.
  Medido sobre una tienda web pequeña: 9 requisitos, 3 FASEs y tres fallos reales encontrados (búsqueda sin SKU ni
  tildes, «79,90» rechazado y «1e2» aceptado como precio) en 9 min y 3,08 $.
- **Mantenimiento automático:** cada día (a las 07:00, configurable) o con `/mantenimiento`, `vigilar.sh` revisa sin
  IA los proyectos entregados: si los tests pasan, si se sigue cumpliendo la comprobación global, si hay código
  cambiado fuera del método, vulnerabilidades (`npm audit`) y versiones mayores nuevas. Si algo cruza su umbral, te
  abre una **puerta de mantenimiento** con dos opciones:
  - `🛠 Lanzar cambio`: entra como un `/cambio` con lo detectado.
  - `🔕 Ignorar` con motivo: no se vuelve a preguntar mientras no cambie.

  Los umbrales están en `.sdd/hermes/hermes-sdd.json` → `mantenimiento`.
- **Elegir el ejecutor por etapa:** Claude Code para lo pesado y un agente de Hermes para lo ligero (por defecto, la
  ruta). Ver [docs/ejecutores.md](docs/ejecutores.md).

---

## 7. Qué garantiza y qué no

**Garantiza** que nada se firma sin la decisión de una persona autorizada en su canal, y que lo firmado es exactamente
el commit que se le mostró. Tres registros cuentan la misma historia: el canal, el acta del notario y
`acceptance/decisions.jsonl` más el tag de git.

**No garantiza** quién sostenía el móvil, ni resiste a alguien con acceso a tu sesión del sistema operativo: el kanban,
los registros y los tags son ficheros tuyos. Las guardias (hooks, `approvals.deny`) lo *dificultan*. Solo un ejecutor
en un contenedor o una firma con llave física lo *impiden*.

---

## 8. Problemas frecuentes

| Síntoma | Qué hacer |
|---|---|
| `instalar.sh` dice «faltan: …» | Instala lo que indica (`brew install …` en macOS, `sudo apt install …` en Ubuntu) y repite. |
| No llega nada a Telegram | `hermes gateway restart`. Comprueba que tu id de Telegram está en `~/.hermes/hermes-sdd/aprobadores.json`. |
| La pestaña «Puertas SDD» no sale en el panel | Reinicia `hermes dashboard` después de instalar. |
| `AVISO: kanban.auto_decompose está activo` | `hermes config set kanban.auto_decompose false` |
| Una etapa sale «busy» | Ya hay otra etapa en marcha en ese repo: el arnés nunca ejecuta dos a la vez en el mismo proyecto. Espera a que termine. |
| Una etapa sale «scheduled» | Se agotó la cuota de tu suscripción de Claude. Se reanuda sola a la hora de reinicio. |
| La demo de una FASE no tiene capturas | Falta el navegador de Playwright en el proyecto: `npx playwright install chromium` (en Linux/WSL, con `--with-deps`). |
| Windows: `$'\r': command not found`, lentitud, puertas que dejan de llegar… | Ver [docs/windows.md → Problemas frecuentes](docs/windows.md#problemas-frecuentes). |

---

## 9. Glosario

| Término | Qué es |
|---|---|
| **Puerta** | Un momento en que el proceso se para hasta que una persona decide. |
| **FASE** | Un trozo del plan que se entrega y se acepta por separado, con su demo. |
| **Ejecutor** | El agente que hace el trabajo de una etapa (Claude Code o un agente de Hermes). Nunca firma. |
| **Notario** | `firmar.sh`: valida y registra las decisiones. No usa IA y nunca decide. |
| **Estación** | El perfil de Hermes `sdd-estacion`: toma las tarjetas del kanban y ejecuta las etapas. No decide nada. |
| **Stack Profile** | La sección de `AGENTS.md` que dice cómo se ejecutan los tests de tu proyecto. |
| **Ruta** | La elección de qué etapas opcionales necesita un proyecto. Ver [docs/metodo/ruta.md](docs/metodo/ruta.md). |
| **Grabación** | Una ejecución real guardada para practicar sin coste (`grabar.sh` crea grabaciones nuevas). |

---

## 10. Estructura del repo

| Ruta | Qué es |
|---|---|
| `instalar.sh` | Instalador (macOS, Linux y WSL) |
| `windows/` | Instalador para Windows (`instalar.ps1`) y preparación de Ubuntu (`preparar-ubuntu.sh`) |
| `lanzar.sh` | Orquestador: inicia proyectos, cambios y adopciones, y encadena las etapas |
| `etapa.sh` · `puerta.sh` · `firmar.sh` | Ejecutar una etapa, abrir una puerta y firmar una decisión |
| `executors/` | `claude.sh` (vigila a Claude: candado, grupo de procesos, cuota, entorno limpio), `hermes.sh` y `replay.sh` (reproducir grabaciones) |
| `decidir.sh` · `anular.sh` | Decidir sin Telegram y anular una aceptación de forma auditable |
| `vigilar.sh` | Mantenimiento por umbrales |
| `practicar.sh` · `grabar.sh` · `grabaciones/` | Practicar sin coste y crear grabaciones |
| `plugin/hermes-sdd/` | Plugin de Hermes: núcleo de las puertas (`hsdd_nucleo.py`), canal Telegram y canal panel (`dashboard/`) |
| `metodo/` | El método SDD como plugin de Claude Code: CLI (`scripts/sdd.mjs`), skills, hooks (la guardia que impide firmar), plantillas, ejemplo y tests |
| `profiles/` · `templates/` | Perfil de la estación y plantillas (`AGENTS.md`, configuración por proyecto) |
| `tests/` · `evals/` | Pruebas sin IA (`bash tests/todo.sh`) y el simulador de Claude |
| `docs/` | Documentación detallada |

---

## 11. Más documentación

- [docs/windows.md](docs/windows.md): instalación en Windows (WSL2), paso a paso.
- [docs/canales.md](docs/canales.md): Telegram, el panel y el canal local, la identidad de cada uno y cómo añadir otros.
- [docs/ejecutores.md](docs/ejecutores.md): Claude Code o Hermes por etapa, con modelos y costes.
- [docs/metodo/](docs/metodo/): el método por dentro (constitución, ruta, aceptación, preguntas asíncronas, convenciones de git).

## Origen

El núcleo parte de [sdd-pipeline](https://github.com/noelserdna/sdd-pipeline) 5.3.0 (mismo autor, MIT), del que se tomó
lo esencial. Desde aquí evoluciona por su cuenta.
