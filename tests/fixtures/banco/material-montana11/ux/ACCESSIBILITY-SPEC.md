# Accessibility Specification — material-montana11

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-21 | sdd-ux-designer | Primera versión, WCAG 2.2 AA |

## 1. Compliance Target

WCAG 2.2 nivel AA en todas las pantallas SCR-001..012 (no es un requisito legal expreso; se adopta como buena práctica, clase R). Verificación: axe-core en los e2e de Playwright (`npx playwright test`) más pasadas manuales (§6).

## 2. Success Criteria Applicability

| SC | Level | Applies? | Where | How the project meets it | Verified by |
|---|---|---|---|---|---|
| 1.1.1 Non-text Content | A | Yes | iconos si los hay | todo icono con texto visible; decorativos `aria-hidden` | axe |
| 1.2.x Multimedia | A/AA | No | — | no hay audio ni vídeo | — |
| 1.3.1 Info and Relationships | A | Yes | tablas, formularios, listas | `th scope`, `label`, `fieldset`, `ul`, `dl`, encabezados jerárquicos | axe + manual |
| 1.3.2 Meaningful Sequence | A | Yes | todas | orden del DOM = orden visual | manual |
| 1.3.3 Sensory Characteristics | A | Yes | avisos | nunca «el botón verde»; se nombra el botón | revisión |
| 1.3.4 Orientation | AA | Yes | todas | sin bloqueo de orientación | manual |
| 1.3.5 Identify Input Purpose | AA | Yes | SCR-001, SCR-006 | `autocomplete` username/current-password/new-password/name/email | axe |
| 1.4.1 Use of Color | A | Yes | estados, errores | insignias y errores llevan texto («Error:», «Pendiente») | revisión |
| 1.4.3 Contrast (Minimum) | AA | Yes | todo el texto | tabla §5 | tabla + axe |
| 1.4.4 Resize Text | AA | Yes | todas | rem, sin alturas fijas; 200 % sin pérdida | manual |
| 1.4.5 Images of Text | AA | Yes | cabecera | texto real | revisión |
| 1.4.10 Reflow | AA | Yes | todas | 320 px sin scroll horizontal; tablas → tarjetas | manual |
| 1.4.11 Non-text Contrast | AA | Yes | bordes de campo, foco, botones | ≥ 3:1 (tabla §5) | tabla |
| 1.4.12 Text Spacing | AA | Yes | todas | sin alturas ni anchos fijos en texto | manual |
| 1.4.13 Content on Hover/Focus | AA | No | no hay tooltips ni menús al pasar el ratón | — | — |
| 2.1.1 Keyboard | A | Yes | todas | todo con teclado nativo | manual |
| 2.1.2 No Keyboard Trap | A | Yes | menú móvil, confirmaciones | Esc cierra; foco libre | manual |
| 2.1.4 Character Key Shortcuts | A | No | sin atajos de una tecla | — | — |
| 2.2.1 Timing Adjustable | A | Yes | sesión 30 min | caduca por inactividad (RN del requisito); es excepción por seguridad; se explica en el mensaje de Entrar | revisión |
| 2.2.2 Pause, Stop, Hide | A | No | sin movimiento automático | — | — |
| 2.3.1 Three Flashes | A | No | sin destellos | — | — |
| 2.4.1 Bypass Blocks | A | Yes | `tmpl-app` | enlace «Saltar al contenido» primero en el DOM | manual |
| 2.4.2 Page Titled | A | Yes | todas | `<title>` = `h1` + « — Material Montaña 11» | axe |
| 2.4.3 Focus Order | A | Yes | todas | §4 | manual |
| 2.4.4 Link Purpose | A | Yes | acciones por fila | nombre accesible incluye el objeto | axe + manual |
| 2.4.5 Multiple Ways | AA | No | app de un solo nivel con navegación visible en cada pantalla (excepción: pasos de un proceso) | — | — |
| 2.4.6 Headings and Labels | AA | Yes | todas | un `h1` por pantalla, etiquetas descriptivas | axe |
| 2.4.7 Focus Visible | AA | Yes | todos los controles | anillo `focus-ring` 3 px | manual |
| 2.4.11 Focus Not Obscured (Min.) | AA | Yes | cabecera y avisos | cabecera no es fija (no se superpone); avisos en flujo normal | manual |
| 2.5.1 Pointer Gestures | A | Yes | todas | sin gestos | — |
| 2.5.2 Pointer Cancellation | A | Yes | botones | acción al soltar (nativo) | — |
| 2.5.3 Label in Name | A | Yes | botones | nombre accesible empieza por el texto visible («Cancelar» → «Cancelar Piolet 2026-12-05») | axe + test |
| 2.5.4 Motion Actuation | A | No | sin sensores | — | — |
| 2.5.7 Dragging Movements | AA | No | no hay arrastre | — | — |
| 2.5.8 Target Size (Minimum) | AA | Yes | todos los controles | `target.touch` 44 px (≥ 24 px exigido) | manual |
| 3.1.1 Language of Page | A | Yes | todas | `lang="es"` | axe |
| 3.1.2 Language of Parts | AA | No | todo en español | — | — |
| 3.2.1 On Focus | A | Yes | todos | foco no cambia contexto | manual |
| 3.2.2 On Input | A | Yes | selectores de día, tipo, socio | cambiar valor no envía; hay botón explícito | manual |
| 3.2.3 Consistent Navigation | AA | Yes | `org-nav` | mismo orden por rol | revisión |
| 3.2.4 Consistent Identification | AA | Yes | acciones | mismos nombres para la misma función | revisión |
| 3.2.6 Consistent Help | A | No | no hay ayuda ni chat; el encargado es el contacto en persona | — | — |
| 3.3.1 Error Identification | A | Yes | formularios | mensaje en texto + `aria-invalid` | test |
| 3.3.2 Labels or Instructions | A | Yes | formularios | `label` visible + «(obligatorio)» | axe |
| 3.3.3 Error Suggestion | AA | Yes | formularios | mensajes dicen qué corregir | test |
| 3.3.4 Error Prevention (Legal, Financial, Data) | AA | Yes | baja de socio/unidad, cancelar, marcar pagada | confirmación en línea; son reversibles solo por el encargado | manual |
| 3.3.7 Redundant Entry | A | Yes | formularios | tras error los valores se conservan | test |
| 3.3.8 Accessible Authentication (Min.) | AA | Yes | SCR-001, SCR-006 | solo correo y contraseña; se permite pegar y gestor de contraseñas; sin CAPTCHA ni transcripción | manual |
| 4.1.2 Name, Role, Value | A | Yes | todos | HTML nativo primero; ARIA solo donde falta | axe |
| 4.1.3 Status Messages | AA | Yes | avisos | `role="status"` / `role="alert"` | manual con lector |

(4.1.1 Parsing obsoleto en 2.2: omitido.)

## 3. Component ARIA Mapping

| Componente | Role / nombre | Teclado | Foco | Estados |
|---|---|---|---|---|
| `atom-button` | `button` nativo; nombre = texto + objeto de la fila | Intro, Espacio | visible; tras acción vuelve a la fila o al aviso | `aria-disabled` durante envío (no `disabled`, para mantener foco) |
| `mol-field` | `label` for; pista y error en `aria-describedby` | Tab | en error: primer campo inválido | `aria-required="true"`, `aria-invalid="true"` (sin atributos HTML bloqueantes, ver §7) |
| `mol-alert` éxito | `role="status"` (educado) | — | no roba foco | — |
| `mol-alert` error | `role="alert"` | — | foco al aviso solo si hay resumen | — |
| `org-nav` | `nav` con `aria-label="Principal"`; página actual `aria-current="page"` | Tab/Intro | — | — |
| menú móvil | botón con `aria-expanded`, `aria-controls` | Intro, Espacio, Esc cierra y devuelve foco | — | `aria-expanded` |
| `org-data-list` tabla | `table`, `caption` = nombre de la lista, `th scope` | Tab por controles | — | — |
| `org-data-list` tarjetas (móvil) | lista `ul`; cada tarjeta `li` con pares `dl` | Tab | — | — |
| `atom-badge` | texto visible | — | — | el estado es el texto |
| `mol-confirm` | grupo `role="group"` con `aria-label` («Confirmar cancelar Piolet») | Tab; Esc cancela | foco al primer botón; al cerrar vuelve al disparador | — |
| `mol-date-range` | dos `input type=date` con label «Inicio» y «Fin»; admite texto AAAA-MM-DD | Tab | — | `aria-invalid` |
| Enlace «Saltar al contenido» | `a` al `main` | Tab (primero) | — | visible al recibir foco |

Landmarks: `header`, `nav`, `main` (uno por página), sin `aside`/`footer` necesarios.

## 4. Keyboard Navigation Matrix

| Pantalla | Orden de Tab | Notas |
|---|---|---|
| SCR-001 | Saltar → Correo → Contraseña → Entrar | Intro envía |
| SCR-002 | Saltar → nav → Salir → Material → Inicio → Fin → Reservar | `select` nativo: flechas |
| SCR-003 | nav → [por fila] Cancelar → Sí/No | Esc cierra confirmación |
| SCR-004 | nav (sin controles de página) | |
| SCR-005 | nav → accesos | |
| SCR-006 | nav → Nombre → Correo → Contraseña → Crear → [por fila] Restablecer, Dar de baja | campo de nueva contraseña aparece tras el botón en el orden del DOM |
| SCR-007 | nav → filtro → [por fila] Entregar/Devolver | |
| SCR-008 | nav → [por fila] Marcar pagada | |
| SCR-009 | nav → Tipo → Cantidad → Añadir → [por unidad] Dar de baja | |
| SCR-010 | nav → Día → Ver | |
| SCR-011 | nav → Socio → Ver historial | sin controles de escritura |
| SCR-012 | nav → Volver al inicio | |

El orden de Tab sigue el visual. «Salir» ocupa siempre la misma posición.

## 5. Color Contrast Verification

Ratios calculados con la fórmula WCAG sobre los valores de `DESIGN-TOKENS.json`.

| Par (token) | Claro | Oscuro | Mínimo |
|---|---|---|---|
| text / bg | 15,65 | 15,44 | 4,5 |
| text / surface | 14,18 | 13,63 | 4,5 |
| text-muted / bg | 7,58 | 8,66 | 4,5 |
| text-muted / surface | 6,87 | 7,65 | 4,5 |
| on-primary / primary (botón) | 6,45 | 7,87 | 4,5 |
| primary / bg (enlaces) | 6,45 | 8,25 | 4,5 |
| error / bg | 6,54 | 9,04 | 4,5 |
| on-error-bg / error-bg | 7,90 | (error sobre surface ≥ 7) | 4,5 |
| success / bg | 6,52 | 10,12 | 4,5 |
| on-success-bg / success-bg | 7,68 | (success sobre surface ≥ 7) | 4,5 |
| on-warning-bg / warning-bg | 7,36 | (ámbar sobre surface ≥ 7) | 4,5 |
| border / bg (campos, botones secundarios) | 4,62 | 6,12 | 3 (1.4.11) |
| focus / bg | 10,04 | 10,09 | 3 (1.4.11) |

En oscuro los fondos de aviso usan `surface` y el color de estado va como texto y borde. Los valores «≥ 7» del tema oscuro sobre surface se confirmarán con axe en e2e (son derivados, menos que sobre bg en < 1 punto).

## 6. Screen Reader & Manual Test Plan

Pasadas manuales (SC marcados «manual» arriba): solo teclado en SCR-001..012; zoom 200 % y 320 px; modo de contraste forzado; `prefers-reduced-motion`; un lector por plataforma (NVDA + Firefox en Windows, VoiceOver en iOS Safari) sobre los flujos: entrar, reservar con error y con éxito, cancelar, entregar/devolver, marcar pagada. Comprobar que los avisos de estado se anuncian una sola vez. axe-core no detecta orden de foco, calidad de nombres ni lectura de avisos: por eso son manuales.

## 7. Project Rules Applied

- **Validación autoritativa del servidor:** los campos con mensajes exigidos por REQUIREMENTS (contraseña mínima, cantidad ≥ 1, fechas, correo repetido) no llevan `required`, `minlength`, `min`, `pattern` ni `type="email"` bloqueante; se usa `aria-required`, pista visible, error en `aria-describedby`, `aria-invalid` y foco al primer campo inválido o al aviso. Los límites son pistas.
- **Roles y nombres estables:** botones «Entrar», «Reservar», «Cancelar», «Salir», «Entregar», «Devolver», «Dar de baja», «Restablecer contraseña», «Marcar pagada» siguen siendo botones con ese texto en el nombre; no se convierten en enlaces (los criterios de aceptación los localizan por rol y nombre).
- **Sin transporte:** no se describen rutas ni códigos; las direcciones protegidas se describen por resultado («Acceso no permitido»).

## 8. Reduced Motion

`@media (prefers-reduced-motion: reduce)` desactiva toda transición de INTERACTION-MODEL §2. Ninguna información depende del movimiento.

## Traceability

REQ-C-002 (español, `lang="es"`), REQ-F-001..010, REQ-NF-001 (SCR-012 y ocultar escritura a junta).
