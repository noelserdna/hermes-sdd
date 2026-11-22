# Sistema de diseño de la interfaz

> Generado por sdd-ux-designer v1.0.0 · Fecha: 2026-11-22 · Basado en: requirements v1.0 y spec/ (19 UC, 2 WF)
> Tokens: [DESIGN-TOKENS.json](DESIGN-TOKENS.json) · Pantallas: [WIREFRAMES.md](WIREFRAMES.md) · Accesibilidad: [ACCESSIBILITY-SPEC.md](ACCESSIBILITY-SPEC.md) · Interacción: [INTERACTION-MODEL.md](INTERACTION-MODEL.md)

## Historial

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | 2026-11-22 | Sistema de diseño inicial |

---

## 1. Visión de diseño

**Tipo de interfaz:** aplicación web de varias páginas (Vite, JavaScript), sin framework impuesto; el diseño es independiente de él (REQ-C-002).
**Usuarios:** socio (reserva y mira sus cosas, uso ocasional, desde el móvil o el ordenador), encargado (uso diario, gestiona entregas, devoluciones, socios, material y multas; trabaja de pie en el almacén, a menudo con el móvil), junta (solo consulta, uso esporádico).
**Canales:** web responsive; prioridad móvil (mobile-first) porque el encargado entrega y recibe material con el teléfono. Sin app nativa ni offline: los datos viven en el servidor compartido (REQ-NF-002).
**Dirección de marca:** club de montaña, sobria y legible: verde bosque, fondos cálidos de piedra, sin ornamento; tono cercano y claro, tuteo.
**Restricción clave:** todos los textos en español y literales de los criterios de aceptación (REQ-C-001); los mensajes los decide el servidor y la interfaz los muestra tal cual.

> La web es una herramienta de trabajo: cada rol aterriza en su página y ve solo lo suyo. Cada acción devuelve un mensaje claro y visible («Reserva creada…», «Devuelto con 3 días de retraso…») y deja la lista actualizada. Los errores dicen qué pasó y qué hacer. Todo se puede usar con teclado y lector de pantalla, y con el pulgar en el móvil.

---

## 2. Identidad

### 2.1 Paleta (decisión de clase R: paleta propia, no hay marca previa)

Valores en [DESIGN-TOKENS.json](DESIGN-TOKENS.json); ratios en ACCESSIBILITY-SPEC §5.

| Token | Claro | Oscuro | Uso |
|---|---|---|---|
| `color.background` | #F7F5F0 | #14191F | Fondo de página |
| `color.surface` | #FFFFFF | #1E252D | Tarjetas, filas, formularios |
| `color.on-surface` | #1F2933 | #E8ECEF | Texto |
| `color.muted` | #52606D | #A9B4BF | Ayudas, fechas secundarias |
| `color.border` | #6B7785 | #8794A1 | Bordes de campos (3:1 mínimo, 1.4.11) |
| `color.primary` / `-hover` / `on-primary` | #1D5C4B / #164A3C / #FFFFFF | #6FD1B1 / #8FE0C5 / #0F1A16 | Acción principal, enlaces |
| `color.danger` / `on-danger` | #A32020 / #FFFFFF | #FF9B9B / #1A0B0B | Cancelar, dar de baja, retirar |
| `color.error` | #A32020 | #FF9B9B | Mensajes de error |
| `color.success` | #1B6B3A | #7FDDA0 | Mensajes de confirmación |
| `color.warning` | #7A4B00 | #F5C26B | Avisos (retraso, bloqueo) |
| `color.focus` | #0B5FD6 | #7DB2FF | Anillo de foco |
| `badge-*` (neutral, ok, warn, err) | pares fondo/texto | pares fondo/texto | Estados (Reservada, Prestada, Pagada…) |

Regla: el color nunca es la única señal; todo estado lleva su texto («Pendiente», «Pagada», «Retraso: 3 días»).

### 2.2 Tipografía

Pila del sistema (`font.family.sans`), sin fuentes externas (rendimiento y sin terceros). Base 1 rem (16 px); títulos de página `font.size.xl` semibold, secciones `font.size.lg`, ayudas `font.size.sm`. Interlineado normal 1,5. Todo en rem para que escale con el zoom.

### 2.3 Iconografía

Ningún icono es imprescindible. Si se usan, son SVG decorativos (`aria-hidden`) junto a un texto visible; nunca iconos solos.

### 2.4 Voz y tono

Español neutro, tuteo, frases cortas. Los mensajes de resultado son literales de los requisitos (p. ej. «Reserva creada: 2 × Casco del 2026-12-05 al 2026-12-07»). Errores: qué pasó + qué hace falta, sin culpar. Vacíos: «Aún no tienes reservas», «No tienes multas». Fechas en formato ISO `AAAA-MM-DD` como en los requisitos; importes «6 €»; singular/plural correcto («1 día», «3 días»).

---

## 3. Tokens

Spacing (`spacing.1…12`, base 4 px), radios (`radius.sm|md|full`), sombras (`shadow.sm|md`, solo tarjeta y aviso), breakpoints (`sm` 480, `md` 768, `lg` 1024), contenedor máx. `72rem`, duraciones (`100/200/300 ms`), easing y z-index (`header` 100, `toast` 200) están en el JSON. Tamaño de objetivo: `target.touch` = 44 px de alto mínimo para todo control (supera el suelo 24 px de 2.5.8).

---

## 4. Responsive

- **Enfoque:** mobile-first, columna única por defecto; rejilla de 12 columnas innecesaria: flex/grid sencillos.
- **Contenedor:** `container.max`, relleno lateral `spacing.4` (`spacing.6` desde `md`).
- **Reflow:** sin scroll horizontal hasta 320 px de ancho y 200 % de zoom (1.4.10).

| Ancho | Cabecera/navegación | Listas | Formularios |
|---|---|---|---|
| < md (móvil) | Barra superior con nombre y «Salir»; navegación como lista de enlaces apilada bajo ella, plegable con un botón «Menú» (muestra/oculta, `aria-expanded`) | Cada fila es una tarjeta apilada (texto, estado, acción debajo) | Campos a ancho completo, una columna |
| ≥ md | Barra superior con enlaces en línea y «Salir» a la derecha | Filas en una línea con la acción a la derecha | Campos de fecha y cantidad en 2–3 columnas; botón principal a la izquierda |

---

## 5. Biblioteca de componentes (Atomic Design)

### Átomos

| Componente | Variantes | Estados | Notas A11y |
|---|---|---|---|
| `atom-button` | primary, secondary, danger | default, hover, active, focus, disabled, loading | `<button>`; nombre = literal del requisito («Entregar», «Cancelar», «Marcar pagada», «Devolver», «Salir»); loading mantiene el nombre y añade `aria-busy` |
| `atom-link` | nav, inline | default, hover, focus, current | `aria-current="page"` en la página activa |
| `atom-input` | text, email, password, number, date | default, focus, error, disabled | `<label>` visible siempre; sin `required`/`maxlength`/`min`/`pattern` bloqueantes; `aria-invalid` y `aria-describedby` al error |
| `atom-select` | tipo de material | igual | `<select>` nativo con `<label>` |
| `atom-badge` | neutral, ok, warn, err | — | Texto del estado siempre visible («Reservada», «Prestada», «Pendiente»…) |
| `atom-message` | success, error, warning, info | — | Texto + borde de color; ver `org-toast-region` |

### Moléculas

| Componente | Composición | Notas |
|---|---|---|
| `mol-field` | label + atom-input/select + ayuda + error | Error en elemento referenciado por `aria-describedby`; ayuda de requisitos visible («mínimo 8 caracteres») |
| `mol-password-field` | mol-field con `autocomplete` correcto | Permite pegar y gestores de contraseñas (3.3.8); sin «mostrar contraseña» obligatorio, opcional con botón `aria-pressed` |
| `mol-date-field` | mol-field type=date | Formato mostrado `AAAA-MM-DD` en la ayuda |
| `mol-row-reserva` | texto «{cantidad} × {material} del {inicio} al {fin} — {estado}» + atom-badge + acción | Texto en un solo nodo legible; la acción se nombra con `aria-label` solo si el nombre visible es genérico; el visible es el literal («Cancelar»), con contexto vía `aria-describedby` hacia el texto de la fila |
| `mol-row-prestamo` | «Prestado: {cantidad} × {material} — {nombre} — vuelve el {fecha}» + badge Retraso + «Devolver» | idem |
| `mol-row-multa` | «{nombre} — Multa de {importe} € — {estado}» + «Marcar pagada» | Para el socio sin nombre: «Multa de {importe} € — {estado}» |
| `mol-search` | label + input + «Buscar» | Para historial |

### Organismos

| Componente | Composición | Responsive | Notas A11y |
|---|---|---|---|
| `org-header` | marca, nombre del usuario («Hola, {nombre}»), `org-nav`, «Salir» | colapsa menú < md | Landmark `banner`; no es sticky (evita tapar el foco, 2.4.11) |
| `org-nav` | enlaces según rol | apilada < md | `<nav aria-label="Principal">` |
| `org-toast-region` | zona de mensajes de resultado | ancho completo del contenido | Región viva `role="status"` (éxito/aviso) o `role="alert"` (error); **en flujo, no flotante ni temporal**: el mensaje queda hasta la siguiente acción |
| `org-form-reservar` | selects, cantidad, fechas, botón | 1 col / 3 col | Resumen de errores si hay varios |
| `org-list-reservas`, `org-list-panel`, `org-list-multas`, `org-list-socios`, `org-list-material`, `org-historial` | filas de moléculas | tarjetas < md | `<ul>`/`<li>` o tabla simple con `<th scope>` en las listas con columnas |
| `org-confirm` | diálogo de confirmación | modal centrado | `role="alertdialog"`, foco atrapado, Esc cancela; solo para «Dar de baja» y «Retirar» (irreversibles); ver INTERACTION-MODEL |

### Plantillas y páginas

`tmpl-publica` (sin cabecera de rol: Entrar), `tmpl-privada` (header + `<main>` con `<h1>`), páginas `page-entrar`, `page-cambiar-contrasena`, `page-mis-reservas`, `page-reservar`, `page-mis-multas`, `page-panel`, `page-socios`, `page-material`, `page-multas`, `page-historial`, `page-sin-permiso`.

---

## 6. Decisiones por dimensión

| # | Dimensión | Decisión | Clase | Motivo / referencia |
|---|---|---|---|---|
| 1 | Marca | Paleta verde/piedra propia, tono cercano | R | Sin marca previa |
| 2 | Tokens | DTCG en JSON, temas `theme-light`/`theme-dark` | R | Plantilla del método |
| 3 | Componentes | Biblioteca de §5, nombres literales de los requisitos en botones | — | Los criterios usan «Entregar», «Cancelar»… (4.1.2) |
| 4 | Responsive | Mobile-first, 3 breakpoints | R | El encargado trabaja con el móvil |
| 5 | Accesibilidad | WCAG 2.2 AA completo | — | ACCESSIBILITY-SPEC |
| 6 | Interacción | Sin animación necesaria; mensajes en flujo | R | INTERACTION-MODEL |
| 7 | Formularios | Validación solo del servidor, mensajes literales; sin atributos bloqueantes | — | Los AC exigen ver los mensajes del servidor |
| 8 | Navegación | Una barra por rol, sin buscador global ni migas | R | ≤ 5 destinos por rol; ver §7 |
| 9 | Seguridad front | Ver §8 | — | REQ-NF-001, INV-SEC-001/002/003, INV-SOC-005/006 |
| 10 | Rendimiento | HTML ligero, sin fuentes ni librerías de UI externas; LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (p75) | R | Listas pequeñas |
| 11 | Móvil | Solo responsive web: objetivos 44 px, sin gestos ni arrastre | R | Sin app nativa |
| 12 | Tema | Claro/oscuro por `prefers-color-scheme`, sin conmutador manual | R | Evita estado extra; ambos temas con contraste verificado |

---

## 7. Navegación e información

Sin menú global compartido: cada rol ve solo sus destinos (REQ-NF-001); lo que no es suyo ni aparece en la navegación.

| Rol | Aterriza en | Menú |
|---|---|---|
| Socio | Mis reservas (`/mis-reservas`) | Mis reservas · Reservar · Mis multas · Salir |
| Encargado | Panel del encargado (`/panel`) | Panel · Socios · Material · Multas · Salir |
| Junta | Historial del socio | Historial del socio · Salir |
| Sin sesión | Entrar | — |

Las rutas `/mis-reservas` y `/panel` las fijan los criterios de REQ-F-001 y REQ-F-008; el resto de rutas se deja al plan técnico. Con `mustChangePassword` (INV-SOC-006) cualquier página lleva a «Cambiar contraseña» y la navegación no se muestra. Sesión caducada o ruta sin sesión muestra «Entrar». Un rol en página ajena ve «No tienes permiso para ver esta página».

## 8. Seguridad del front (dim. 9)

El servidor decide todo (REQ-NF-001); la interfaz solo oculta lo que no toca al rol y nunca confía en ello.

- Sin datos privados en caché visible tras «Salir»: al volver atrás se muestra «Entrar» sin reservas, multas ni nombres (AC de REQ-F-001); las páginas privadas no se guardan en la caché del navegador.
- Textos de usuarios (nombres, correos) siempre como texto, nunca como HTML (XSS).
- Sesión en cookie de servidor no accesible desde JavaScript; sin datos de negocio en `localStorage` (SPEC-PERF-002).
- Contraseñas: campos `type=password`, sin registrarlas ni mostrarlas en mensajes; el error de entrada es siempre el mismo («Correo o contraseña incorrectos»), no revela si la cuenta existe (INV-SOC-008).
- CSP restrictiva (sin scripts ni estilos de terceros) y protección frente a incrustación en marcos (clickjacking); formularios de acción protegidos frente a CSRF: se definen en `design/` o el plan técnico.
- Hallazgos de `audits/SECURITY-AUDIT-BASELINE.md` que tocan al cliente: INPUT-001 (nombres y búsquedas con marcado: la interfaz los pinta siempre como texto y no limita la longitud en el navegador, lo hace el servidor), DATA-002 (los mensajes de error no llevan datos de otros usuarios), AUTH-001 (el mensaje de bloqueo no debe revelar qué correos existen: el texto lo fija el requisito y lo decide el servidor), AUTH-004 (atributos de la cookie, del lado del servidor).
- Rutas: `design/TECHNICAL-DESIGN.md` ya fija el router del cliente (`/reservar`, `/socios`, `/multas`, `/historial`, `/entrar`, `/cambiar-contrasena`); este diseño no las contradice.

## Supuestos

- Paleta, tipografía del sistema, tema por preferencia del sistema y navegación por rol: decisiones mías por defecto (clase R), sin marca del club.
- «Mis multas» y «Reservar» son páginas propias del socio (los AC las nombran como «Mis multas» y «Reservar»).
- La junta tiene una sola pantalla (Historial del socio), porque REQ-F-009 es lo único que se le pide.
- Los diálogos de confirmación para «Dar de baja» y «Retirar» no los piden los requisitos; son una protección de usabilidad y no cambian los mensajes ni los literales de los botones. Si el cliente no los quiere, se quitan sin tocar nada más.
- El purgado del historial (UC-019) es automático: no tiene pantalla.

## Trazabilidad

| Decisión | Spec |
|---|---|
| Literales de botones y mensajes | REQ-F-001…009 criterios «Se ve» |
| Navegación por rol | REQ-NF-001, RN-020 |
| Contraseña provisional → pantalla única | INV-SOC-006, UC-004, WF-002 |
| Mensajes en flujo, no temporales | ADR-005 (repetir no cambia nada y avisa) |
| Sin datos en el dispositivo | REQ-NF-002, SPEC-PERF-002 |
