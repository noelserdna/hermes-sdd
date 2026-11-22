# UI Design System — material-montana11

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-21 | sdd-ux-designer (modo arnés) | Primera versión: sistema de diseño breve para una app pequeña |

## 1. Design Vision

**Interface Type:** Web application, rendered by Vite + JavaScript (ES modules), sin otro framework de UI (REQ-C-001); multipágina por rol.
**Primary Users:** socio (reserva y consulta lo suyo, a menudo desde el móvil), encargado (opera en el ordenador del club: entregas, devoluciones, multas, inventario, socios), junta (solo lectura). Personas no técnicas, edades variadas.
**Delivery Channels:** web responsive (móvil y ordenador con los mismos datos, REQ-C-003). Sin app nativa ni offline.
**Brand Direction:** sobrio, claro y práctico; tono cercano en español (REQ-C-002).
**Key UX Constraint:** los textos de los criterios de aceptación (mensajes, encabezados, estados) aparecen literales; la UI no los reformula.

> El socio entra, ve el material y reserva con unas fechas en pocos pasos. El encargado trabaja con listas claras y botones grandes de acción directa (Entregar, Devolver, Pagada). La junta consulta sin ver ningún botón que cambie datos. Cada resultado se confirma con un mensaje visible y leído por lector de pantalla.

## 2. Brand Identity (dim 1)

- **Decisión:** identidad mínima de club de montaña: texto «Material Montaña 11» como cabecera, sin logo (no hay marca aportada). Clase R.
- **Colores:** azul glaciar como primario; rojo/verde/ámbar solo para estado, siempre con texto o icono añadido (nunca solo color). Valores en `DESIGN-TOKENS.json`; ratios en `ACCESSIBILITY-SPEC.md` §5.
- **Tipografía:** pila del sistema (`font.family.sans`), cuerpo 1rem, interlineado 1.5; sin descargas de fuentes (rendimiento y privacidad).
- **Iconografía:** ninguna imprescindible; si se usa icono, acompaña siempre a texto visible.
- **Voz y tono:** español, tuteo, frases cortas, verbos de acción («Reservar», «Cancelar», «Entregar»). Mensajes de error dicen qué pasó y qué hacer; se usan exactamente los de `requirements/REQUIREMENTS.md`.

## 3. Design Tokens (dim 2)

Fuente: `ux/DESIGN-TOKENS.json` (DTCG). Escala de espaciado 4/8/12/16/24/32 px; radios 4 y 8 px; sin sombras (separación por borde de 1 px, que evita problemas en modo de contraste forzado); duraciones 120 y 200 ms; anillo de foco 3 px con separación 2 px; objetivo táctil `target.touch` 44 px.

## 4. Responsive Strategy (dim 4, 11)

- **Mobile-first**, fluido, un solo codebase. Breakpoints: 480, 768, 1024 px.
- **< 768 px:** navegación en una barra superior con menú desplegable por botón «Menú»; tablas se transforman en listas de tarjetas (cada fila un bloque con pares etiqueta: valor); formularios a una columna.
- **≥ 768 px:** navegación horizontal visible; listas como tabla; formularios en dos columnas cuando aporte.
- **Reflujo a 320 px sin scroll horizontal** y legible al 200 % de zoom (1.4.4, 1.4.10).
- Móvil: sin gestos; todo se hace con toques simples. Sin PWA ni modo sin conexión (los datos son compartidos, REQ-C-003).

## 5. Component Library (dim 3)

### Atoms
| Name | Variantes / estados | Tokens |
|---|---|---|
| `atom-button` | primario, secundario, peligro (Cancelar, Dar de baja); default, hover, active, focus, disabled, loading | `color.primary`, `target.touch`, `radius.md` |
| `atom-input` | texto, correo, contraseña, número, fecha; default, focus, error, disabled | `color.border`, `color.error` |
| `atom-select` | tipo de material, socio | igual que input |
| `atom-label` | con pista de obligatorio visible «(obligatorio)» | `color.text` |
| `atom-badge` | estado de reserva (Reservada, Entregado, Devuelto, Cancelada, No recogida), de multa (Pendiente, Pagada), de socio (Baja), unidad (De baja), «Retrasado n día(s)» | `color.*-bg` + texto |
| `atom-link` | navegación, subrayado siempre | `color.primary` |

### Molecules
| Name | Contenido |
|---|---|
| `mol-field` | label + input + pista + mensaje de error enlazado con `aria-describedby` |
| `mol-alert` | mensaje de resultado o error (`role="status"` éxito / `role="alert"` error), con icono de texto «Error:» / «Hecho:» |
| `mol-list-row` | fila con pares etiqueta/valor + acciones; tabla en ≥768 px, tarjeta en móvil |
| `mol-confirm` | confirmación en línea de acciones destructivas (cancelar reserva, dar de baja) |
| `mol-date-range` | dos campos de fecha inicio/fin con validación del servidor |

### Organisms
| Name | Contenido |
|---|---|
| `org-header` | nombre de la web, usuario en sesión, botón «Salir» |
| `org-nav` | enlaces según rol (ver §7) |
| `org-login-form` | formulario de Entrar |
| `org-reservation-form` | tipo + fechas + «Reservar» y disponibilidad por tipo |
| `org-data-list` | lista/tabla con estado vacío |
| `org-member-form`, `org-inventory-form` | alta de socio, alta de material |

### Templates / Pages
`tmpl-public` (solo cabecera + contenido; Entrar) y `tmpl-app` (cabecera, navegación, `main`, zona de avisos). Pages: `page-{pantalla}` por cada SCR de `WIREFRAMES.md`.

## 6. Interaction, Forms, Navigation, Security, Performance (dim 6-10)

- **Interacción (dim 6):** ver `INTERACTION-MODEL.md`. Transiciones mínimas; respeta `prefers-reduced-motion`.
- **Formularios (dim 7):** validación **autoritativa en el servidor**: sin `required`/`minlength`/`pattern` bloqueantes; los mensajes de REQUIREMENTS aparecen tras enviar, junto al campo o en un resumen que recibe el foco. `aria-required="true"` y pista visible «obligatorio». El campo contraseña permite pegar y gestores de contraseñas (3.3.8). Tras error se conservan los valores escritos, salvo la contraseña.
- **Navegación (dim 8):** una navegación por rol, mismo orden en todas las pantallas; sin migas (jerarquía de un solo nivel); sin buscador (volumen pequeño). Cada rol aterriza en su inicio (REQ-F-001). Enlace «Salir» en la cabecera en la misma posición siempre.
- **Seguridad del front (dim 9):** sin HTML inyectado desde datos (nombres de socio se pintan como texto); no se muestran datos de otro socio (REQ-NF-001, INV-SEC-001); los botones de escritura no se renderizan para la junta (REQ-F-010, INV-SEC-002) y, si alguien abre una dirección de otro rol, se ve «Acceso no permitido». Las contraseñas nunca se muestran ni se guardan en el navegador; evitar poner datos personales en la URL. CSP recomendada: `default-src 'self'`; sin scripts ni estilos en línea cuando sea viable; protección anti-clickjacking (`frame-ancestors 'none'`). Cabeceras y cookies de sesión: decisión de `design/`, no de ux/. No hay `audits/SECURITY-AUDIT-BASELINE.md` aún: sin hallazgos que citar.
- **Rendimiento (dim 10):** objetivos LCP < 2.5 s, INP < 200 ms, CLS < 0.1 (p75). Sin imágenes ni fuentes web; listas pequeñas, sin virtualización. Reservar espacio para los avisos para no desplazar el contenido.

## 7. Navigation per Role

| Rol | Enlaces (orden fijo) | Inicio |
|---|---|---|
| socio | Material disponible · Mis reservas · Mis multas · Salir | SCR-002 |
| encargado | Panel · Préstamos · Prestado · Multas · Inventario · Socios · Salir | SCR-005 |
| junta | Historial de socios · Salir | SCR-011 |

## 8. Theme Configuration (dim 12)

Claro por defecto y oscuro automático con `prefers-color-scheme: dark` (clase R: no hay selector manual; menos superficie). Dos grupos `theme-light` / `theme-dark` en tokens; el estado nunca depende solo del color.

## Supuestos

- La junta aterriza en el selector de socios con el encabezado «Historial de socios» porque los requisitos no nombran su pantalla de inicio.
- «Reservar» no tiene pantalla propia: es el formulario dentro de «Material disponible» (inicio del socio), que además muestra las unidades libres por fechas.
- Se añade modo oscuro automático y sin logo porque el encargo no aporta marca; es reversible.
- La navegación y los encabezados de pantallas no fijados por criterios («Mis reservas», «Mis multas», «Inventario», «Socios», «Préstamos», «Multas», «Prestado», «Panel del encargado», «Material disponible») usan los nombres que aparecen en los criterios de aceptación.

## Traceability

REQ-F-001..010, REQ-NF-001, REQ-C-001 (sin otro framework de UI), REQ-C-002 (textos), REQ-C-003 (responsive, mismos datos en cada dispositivo). Pantallas: `ux/WIREFRAMES.md`.
