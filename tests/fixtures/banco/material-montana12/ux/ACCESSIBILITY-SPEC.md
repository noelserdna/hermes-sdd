# Especificación de accesibilidad

> Generado por sdd-ux-designer v1.0.0 · Fecha: 2026-11-22 · Objetivo: WCAG 2.2 nivel AA

## Historial

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | 2026-11-22 | Especificación inicial |

## 1. Objetivo

- **Norma:** WCAG 2.2 AA. Sin obligación legal declarada en los requisitos; se adopta como criterio de calidad (clase R).
- **Verificación:** automática (axe-core, integrable en los tests de aceptación de Playwright) y manual (teclado, un lector de pantalla —NVDA en escritorio y TalkBack o VoiceOver en móvil—, zoom 200 % y reflow a 320 px, modo de contraste forzado, `prefers-reduced-motion`).
- **Reglas del proyecto:** validación solo del servidor (los mensajes de los requisitos deben verse): no se usan `required`, `maxlength`, `minlength`, `min`, `max`, `pattern` ni `type=email` bloqueantes; se usan `aria-required="true"`, pista visible, `aria-invalid="true"` y `aria-describedby` al mensaje, y foco al primer campo con error o a la zona de mensajes. Los botones conservan el nombre literal de los requisitos («Entregar», «Devolver», «Cancelar», «Marcar pagada», «Salir», «Entrar»): son el contrato para las pruebas (4.1.2).

## 2. Aplicabilidad de criterios de éxito (A y AA)

| SC | Nivel | ¿Aplica? | Dónde | Cómo se cumple | Verificado por |
|---|---|---|---|---|---|
| 1.1.1 Contenido no textual | A | Sí | iconos decorativos | `aria-hidden`; sin imágenes informativas | axe, revisión |
| 1.2.1–1.2.5 Multimedia | A/AA | No | — | No hay audio ni vídeo | — |
| 1.3.1 Información y relaciones | A | Sí | todas | HTML semántico: landmarks, `h1`–`h2`, listas, `label`, `th scope` | axe, lector |
| 1.3.2 Secuencia con sentido | A | Sí | todas | Orden del DOM = orden visual; el móvil reordena solo por apilado | teclado |
| 1.3.3 Características sensoriales | A | Sí | acciones | Las instrucciones no dependen de posición ni color | revisión |
| 1.3.4 Orientación | AA | Sí | todas | Sin bloqueo de orientación | manual |
| 1.3.5 Identificar el propósito de la entrada | AA | Sí | Entrar, Cambiar contraseña, Socios | `autocomplete` (`username`, `current-password`, `new-password`, `name`, `email`) | axe |
| 1.4.1 Uso del color | A | Sí | estados, errores, retraso | Cada estado lleva texto («Pendiente», «Retraso: 3 días»); error con texto y borde | revisión |
| 1.4.2 Control del audio | A | No | — | Sin audio | — |
| 1.4.3 Contraste (mínimo) | AA | Sí | todo texto | Tokens `on-surface`, `muted`, `primary`… ≥ 4,5:1 (§5) | §5, axe |
| 1.4.4 Cambio de tamaño del texto | AA | Sí | todas | Unidades rem; sin altura fija en contenedores de texto | zoom 200 % |
| 1.4.5 Imágenes de texto | AA | Sí | — | No se usan | revisión |
| 1.4.10 Reflow | AA | Sí | todas | Una columna a 320 px; sin scroll horizontal (las tablas se apilan) | 320 px |
| 1.4.11 Contraste no textual | AA | Sí | bordes de campo, foco, badges | `border` ≥ 3:1; foco ≥ 3:1 (§5) | §5 |
| 1.4.12 Espaciado del texto | AA | Sí | todas | Sin alturas fijas; el texto no se recorta al ampliar espaciado | manual |
| 1.4.13 Contenido al pasar el ratón o foco | AA | Sí | ayudas | No hay tooltips; las ayudas son texto fijo | revisión |
| 2.1.1 Teclado | A | Sí | todas | Todo es `button`, `a`, `input`, `select` nativos | teclado |
| 2.1.2 Sin trampas de teclado | A | Sí | `org-confirm` | El foco queda atrapado en el diálogo solo mientras está abierto; Esc lo cierra | teclado |
| 2.1.4 Atajos de teclado | A | No | — | No hay atajos de un solo carácter | — |
| 2.2.1 Tiempo ajustable | A | Sí | sesión de 30 min | La caducidad por inactividad (INV-SOC-005) es una limitación del sistema; tras caducar, la pantalla Entrar lo dice y no se pierde nada guardado (los envíos fallidos no se aceptan, nada queda a medias). **Observación:** el requisito fija 30 min; 2.2.1 se cumple como excepción por seguridad (el SC permite límites esenciales) | revisión |
| 2.2.2 Poner en pausa, detener, ocultar | A | No | — | Sin movimiento automático ni actualización automática | — |
| 2.3.1 Tres destellos | A | No | — | Sin destellos | — |
| 2.4.1 Saltar bloques | A | Sí | tmpl-privada | Primer elemento enfocable: enlace «Ir al contenido» que mueve al `main` | teclado |
| 2.4.2 Título de página | A | Sí | todas | `<title>` = «{Página} — Material Montaña» | axe |
| 2.4.3 Orden del foco | A | Sí | todas | Ver §4 | teclado |
| 2.4.4 Propósito del enlace | A | Sí | nav, resultados | Texto del enlace descriptivo | revisión |
| 2.4.5 Varias vías | AA | No | — | Conjunto pequeño (≤ 5 destinos por rol, todos en la navegación) | — |
| 2.4.6 Encabezados y etiquetas | AA | Sí | todas | `h1` único; etiquetas descriptivas | revisión |
| 2.4.7 Foco visible | AA | Sí | todo control | Anillo `focus.ring-width` 3 px color `focus` con desplazamiento 2 px, ≥ 3:1 | §5 |
| 2.4.11 Foco no oculto (mínimo) | AA | Sí | cabecera, mensajes | Cabecera y zona de mensajes **no son sticky ni flotantes**; nada tapa el control enfocado | teclado + zoom |
| 2.5.1 Gestos con puntero | A | Sí | todas | Solo clic/toque simple | — |
| 2.5.2 Cancelación del puntero | A | Sí | botones | Acción al soltar (`click` nativo) | — |
| 2.5.3 Etiqueta en el nombre | A | Sí | botones | El nombre accesible empieza por el texto visible («Cancelar»); el contexto va en `aria-describedby`, no cambia el nombre | axe |
| 2.5.4 Activación por movimiento | A | No | — | Sin movimiento | — |
| 2.5.7 Movimientos de arrastre | AA | No | — | No hay arrastrar | — |
| 2.5.8 Tamaño del objetivo (mínimo) | AA | Sí | botones, enlaces, campos | `target.touch` 44 px de alto y ≥ 24 px de ancho, separados ≥ `spacing.2` | manual |
| 3.1.1 Idioma de la página | A | Sí | todas | `<html lang="es">` | axe |
| 3.1.2 Idioma de las partes | AA | Sí | nombres de material | Todo en español; nombres propios sin cambiar el idioma | revisión |
| 3.2.1 Al recibir el foco | A | Sí | todas | El foco no cambia el contexto | — |
| 3.2.2 Al introducir datos | A | Sí | selects, fechas | No se envía ni navega al cambiar un valor; solo con el botón | — |
| 3.2.3 Navegación coherente | AA | Sí | org-nav | Mismo orden de enlaces en todas las páginas de un rol | revisión |
| 3.2.4 Identificación coherente | AA | Sí | botones | Misma etiqueta para la misma acción en todas las pantallas | revisión |
| 3.2.6 Ayuda coherente | A | Sí | Entrar, Cambiar contraseña | La ayuda («pídele una provisional al encargado») va siempre bajo el formulario | revisión |
| 3.3.1 Identificación de errores | A | Sí | formularios | Mensaje en texto, asociado al campo y en la zona viva | lector |
| 3.3.2 Etiquetas o instrucciones | A | Sí | formularios | Etiqueta visible + ayuda de reglas (mín. 8, máx. 5, máx. 14 días) | revisión |
| 3.3.3 Sugerencias ante errores | AA | Sí | formularios | Los mensajes dicen la regla («La contraseña debe tener al menos 8 caracteres», «solo queda 1 de Tienda el 2026-12-06») | revisión |
| 3.3.4 Prevención de errores (legales, financieros, datos) | AA | Sí | baja de socio, baja de unidades | `org-confirm` en las dos acciones irreversibles; las demás son idempotentes o reversibles | teclado |
| 3.3.7 Entrada redundante | A | Sí | formularios | El formulario conserva lo escrito tras un error; no se pide repetir la contraseña | manual |
| 3.3.8 Autenticación accesible (mínimo) | AA | Sí | Entrar, Cambiar contraseña | Solo correo y contraseña; permite pegar y gestor de contraseñas; sin CAPTCHA ni test cognitivo | manual |
| 4.1.2 Nombre, función, valor | A | Sí | todos | Controles nativos; estado con `aria-*` solo donde hace falta | axe |
| 4.1.3 Mensajes de estado | AA | Sí | zona de mensajes | `role="status"` / `role="alert"` (ver §3) | lector |

(4.1.1 Parsing queda omitido: obsoleto en 2.2.)

## 3. Mapa ARIA por componente

| Componente | Rol | Propiedades ARIA | Teclado |
|---|---|---|---|
| `org-header` | `banner` | — | — |
| `org-nav` | `navigation` | `aria-label="Principal"`; `aria-current="page"` | Tab, Intro |
| Botón «Menú» (< md) | `button` | `aria-expanded`, `aria-controls` | Intro/Espacio |
| `org-toast-region` | `status` / `alert` | `role="status"` para éxito y avisos; `role="alert"` para errores; la región existe vacía en el DOM al cargar para que el lector anuncie el cambio | — |
| `mol-field` | — | `<label for>`, `aria-describedby` (ayuda + error), `aria-invalid`, `aria-required` | Tab |
| `mol-password-field` | — | botón «Mostrar contraseña» opcional con `aria-pressed` | Tab, Espacio |
| `mol-row-*` acciones | `button` | `aria-describedby` → texto de la fila | Tab, Intro/Espacio |
| `atom-badge` | texto | sin rol; el estado es texto visible | — |
| Listas | `list` / tabla | `<ul>`; si hay columnas, `<table>` con `<caption>` y `<th scope>` | — |
| `org-confirm` | `alertdialog` | `aria-modal="true"`, `aria-labelledby`, `aria-describedby`; el contenido de fondo es `inert` | Tab cicla dentro; Esc cierra y devuelve el foco al botón de origen; foco inicial en el botón no destructivo («No») |
| `mol-search` | `search` | `aria-label="Buscar socio"` | Intro envía |
| «Ir al contenido» | enlace | visible al recibir el foco | Intro |

## 4. Matriz de teclado

| Pantalla | Orden de tabulación | Teclas especiales | Trampas de foco |
|---|---|---|---|
| SCR-001 Entrar | Ir al contenido → Correo → Contraseña → Entrar | Intro envía | No |
| SCR-002 Cambiar contraseña | Contenido → Contraseña nueva → (Mostrar) → Guardar → Salir | Intro envía | No |
| SCR-003 Mis reservas | Contenido → nav → «Cancelar» por fila | — | No |
| SCR-004 Reservar | nav → Material → Cantidad → Inicio → Fin → Reservar | Flechas en el `select` | No |
| SCR-005 Mis multas | nav | — | No |
| SCR-006 Panel | nav → Fecha → Ver → «Entregar»/«Devolver» por fila | — | No |
| SCR-007 Socios | nav → Nombre → Correo → Contraseña provisional → Dar de alta → por fila: Restablecer, Dar de baja | Esc cierra el campo en línea y el diálogo | Solo `org-confirm` abierto |
| SCR-008 Material | nav → por tipo: Cantidad → Añadir → Dar de baja; tipo nuevo: Nombre → Unidades → Añadir tipo | Esc en diálogo | Solo `org-confirm` |
| SCR-009 Multas | nav → «Marcar pagada» por fila | — | No |
| SCR-010 Historial | nav → Buscar → Buscar (botón) → enlaces de resultados | — | No |
| SCR-011 Sin permiso | nav → Volver | — | No |

Gestión del foco tras una acción: al terminar, el foco va al `h1` de la zona de mensajes (tabindex -1) o al mensaje de error si lo hubo; no se pierde en `body`. Al cerrar un diálogo vuelve al elemento que lo abrió, salvo que su fila haya cambiado: entonces va al mensaje.

## 5. Verificación de contraste

Calculado con la fórmula WCAG de luminancia relativa (2026-11-22).

### Tema claro

| Elemento | Primer plano | Fondo | Ratio | Requisito | Estado |
|---|---|---|---|---|---|
| Texto base / fondo | #1F2933 | #F7F5F0 | 13,54:1 | 4,5:1 | PASA |
| Texto base / superficie | #1F2933 | #FFFFFF | 14,76:1 | 4,5:1 | PASA |
| Texto atenuado / superficie | #52606D | #FFFFFF | 6,46:1 | 4,5:1 | PASA |
| Texto atenuado / fondo | #52606D | #F7F5F0 | 5,93:1 | 4,5:1 | PASA |
| Botón primario | #FFFFFF | #1D5C4B | 7,82:1 | 4,5:1 | PASA |
| Botón primario (hover) | #FFFFFF | #164A3C | 10,10:1 | 4,5:1 | PASA |
| Enlace / superficie | #1D5C4B | #FFFFFF | 7,82:1 | 4,5:1 | PASA |
| Botón peligro | #FFFFFF | #A32020 | 7,54:1 | 4,5:1 | PASA |
| Error / superficie | #A32020 | #FFFFFF | 7,54:1 | 4,5:1 | PASA |
| Error / fondo | #A32020 | #F7F5F0 | 6,92:1 | 4,5:1 | PASA |
| Éxito / superficie | #1B6B3A | #FFFFFF | 6,54:1 | 4,5:1 | PASA |
| Aviso / superficie | #7A4B00 | #FFFFFF | 7,41:1 | 4,5:1 | PASA |
| Badge neutro | #323F4B | #E4E7EB | 8,69:1 | 4,5:1 | PASA |
| Badge ok | #14532D | #DCF3E3 | 7,80:1 | 4,5:1 | PASA |
| Badge aviso | #7A4B00 | #FFF3D6 | 6,72:1 | 4,5:1 | PASA |
| Badge error | #8A1A1A | #FBE3E3 | 7,67:1 | 4,5:1 | PASA |
| Borde de campo / superficie | #6B7785 | #FFFFFF | 4,56:1 | 3:1 | PASA |
| Foco / superficie | #0B5FD6 | #FFFFFF | 5,80:1 | 3:1 | PASA |
| Foco / fondo | #0B5FD6 | #F7F5F0 | 5,32:1 | 3:1 | PASA |

### Tema oscuro

| Elemento | Primer plano | Fondo | Ratio | Requisito | Estado |
|---|---|---|---|---|---|
| Texto base / fondo | #E8ECEF | #14191F | 14,87:1 | 4,5:1 | PASA |
| Texto base / superficie | #E8ECEF | #1E252D | 13,02:1 | 4,5:1 | PASA |
| Texto atenuado / superficie | #A9B4BF | #1E252D | 7,34:1 | 4,5:1 | PASA |
| Botón primario | #0F1A16 | #6FD1B1 | 9,69:1 | 4,5:1 | PASA |
| Enlace / superficie | #6FD1B1 | #1E252D | 8,42:1 | 4,5:1 | PASA |
| Botón peligro | #1A0B0B | #FF9B9B | 9,50:1 | 4,5:1 | PASA |
| Error / superficie | #FF9B9B | #1E252D | 7,67:1 | 4,5:1 | PASA |
| Éxito / superficie | #7FDDA0 | #1E252D | 9,39:1 | 4,5:1 | PASA |
| Aviso / superficie | #F5C26B | #1E252D | 9,44:1 | 4,5:1 | PASA |
| Borde de campo / superficie | #8794A1 | #1E252D | 4,99:1 | 3:1 | PASA |
| Foco / superficie | #7DB2FF | #1E252D | 7,13:1 | 3:1 | PASA |
| Foco / fondo | #7DB2FF | #14191F | 8,15:1 | 3:1 | PASA |
| Badge neutro | #14191F | #8794A1 | 5,70:1 | 4,5:1 | PASA |
| Badge ok | #14191F | #7FDDA0 | 10,73:1 | 4,5:1 | PASA |
| Badge aviso | #14191F | #F5C26B | 10,78:1 | 4,5:1 | PASA |
| Badge error | #14191F | #FF9B9B | 8,76:1 | 4,5:1 | PASA |

## 6. Plan de lector de pantalla

| Escenario | Anuncio esperado | Lector |
|---|---|---|
| Entrar con contraseña errónea | «Correo o contraseña incorrectos» (alerta) | NVDA / TalkBack |
| Reservar con éxito | «Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07», título «Mis reservas» | NVDA |
| Reservar sin unidades | «No hay unidades libres: solo queda 1 de Tienda el 2026-12-06» (alerta), foco en el mensaje | NVDA |
| Cancelar | «Reserva cancelada» (estado); el botón anunciado como «Cancelar, 2 × Casco del … — Reservada» | NVDA / VoiceOver |
| Entregar / Devolver con retraso | «Devuelto con 3 días de retraso: multa de 6 €» | NVDA |
| Dar de baja | Diálogo: «¿Dar de baja a Marta Ruiz? …», foco en «No» | NVDA |
| Historial sin coincidencias | «Ningún socio coincide» | NVDA |
| Cuenta bloqueada | «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos» | NVDA |

## 7. Movimiento reducido

El diseño apenas anima (ver INTERACTION-MODEL). Las únicas transiciones (color de fondo en hover y foco, 100–200 ms; despliegue del campo en línea de «Restablecer») se desactivan con `prefers-reduced-motion: reduce`: el cambio es instantáneo. No hay animaciones esenciales.

## Supuestos

- La caducidad de sesión a 30 minutos (requisito) se mantiene; se avisa en pantalla al volver a Entrar, sin aviso previo con cuenta atrás (no lo pide el requisito). Si el cliente quiere un aviso previo con opción de prolongar, es un cambio de requisito, no se añade aquí.
- Objetivo de contraste y foco más estricto que el mínimo (AA con margen) por uso en móvil con luz exterior.
