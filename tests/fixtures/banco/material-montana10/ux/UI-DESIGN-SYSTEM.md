---
title: Sistema de diseño UX — material-montana10
version: 1.0
date: 2026-11-21
refs: REQ-C-001, REQ-F-001..010, REQ-NF-001, RN-015, RN-016, SEC-002, SEC-007
---

# Sistema de diseño UX

Tokens en `DESIGN-TOKENS.json`; pantallas en `WIREFRAMES.md`; accesibilidad en `ACCESSIBILITY-SPEC.md`; interacción en `INTERACTION-MODEL.md`. Sin código: solo decisiones.

## 1. Design Vision

**Interface Type:** aplicación web (Vite, JavaScript, páginas con navegación por rol).
**Primary Users:** socio (reserva y consulta, uso ocasional, perfil no técnico, desde móvil o portátil); encargado (trabajo diario en el almacén, entrega y devolución rápidas, suele usar un portátil o tableta); junta (solo lectura, uso esporádico).
**Delivery Channels:** navegador de escritorio y móvil con la misma web adaptable (sin app nativa, sin offline).
**Brand Direction:** sobrio, claro y práctico, de club de montaña: verde pino, piedra, mucho aire; textos directos y en español (REQ-C-001).
**Key UX Constraint:** cada pantalla depende del rol (RN-016) y el servidor manda: la interfaz nunca decide si algo es válido, solo muestra el mensaje del catálogo de errores.

> El socio entra, ve sus reservas y reserva en tres campos. El encargado abre una sola pantalla con lo que está fuera, lo que vuelve hoy y lo que hay que entregar, y actúa con un botón por fila. La junta ve lo mismo sin botones. Todo se puede hacer con teclado y lector de pantalla, y cada error dice qué pasó y qué hacer.

## 2. Decisiones por dimensión

| # | Dimensión | Decisión | Motivo / alternativa descartada |
|---|---|---|---|
| 1 | Marca | Verde pino como primario, piedra neutra, fuente del sistema; voz en segunda persona singular y frases cortas ("No tienes reservas") | Sin logo ni guía previa; una fuente web añadiría peso sin valor |
| 2 | Tokens | DTCG en `DESIGN-TOKENS.json`: primitivos + grupo `theme-light`; espaciado base 4px | Un solo tema |
| 3 | Componentes | Atomic Design, ver sección 3 | Pocos componentes reutilizados por 8 pantallas |
| 4 | Responsive | Mobile-first; puntos de corte `md` 640px y `lg` 1024px; tablas pasan a tarjetas bajo `md`; contenido máx. `size.content-max` | El encargado usa tableta: probar 768px |
| 5 | Accesibilidad | WCAG 2.2 AA, ver `ACCESSIBILITY-SPEC.md` | Requisito de calidad del proyecto |
| 6 | Interacción | Sin animaciones decorativas; transiciones ≤200ms; respeta `prefers-reduced-motion`; estados de carga, vacío y error explícitos | Ver `INTERACTION-MODEL.md` |
| 7 | Formularios | Etiqueta visible siempre; errores del servidor en un resumen + junto al campo; sin `required`/`maxlength`/`pattern` bloqueantes: `aria-required`, `aria-invalid`, `aria-describedby`; el servidor valida | Para que salgan los mensajes que exige la especificación (p. ej. `E_FECHA_PASADA`) |
| 8 | Navegación | Barra superior con las pantallas del rol (RN-016) y "Salir"; pantalla inicial por rol (RN-015); sin buscador ni migas | Máximo 5 entradas por rol |
| 9 | Seguridad frontend | Contraseña siempre oculta y nunca repetida en pantalla (SEC-002); mismo mensaje para correo desconocido y contraseña mala (SEC-007, `E_CREDENCIALES_INVALIDAS`); no se muestran hashes ni datos de otros socios (SEC-006, INV-ACC-009); `autocomplete` correcto; el texto de usuario se inserta como texto, nunca como HTML; recomendar CSP restrictiva y `frame-ancestors 'none'` (decisión técnica, ver `design/` si existe) | Sin hallazgos de auditoría de seguridad abiertos que toquen el cliente |
| 10 | Rendimiento | LCP < 2,5 s, INP < 200 ms, CLS < 0,1 (p75); JS por pantalla con carga diferida; sin imágenes pesadas | Web de uso interno y ligera |
| 11 | Móvil | Objetivos ≥ 44px (`size.target-min`); sin gestos obligatorios; tipos de campo nativos (`date`, `email`) | Sin PWA ni offline: no se piden |
| 12 | Tema oscuro | No aplica: ningún requisito lo pide; los tokens semánticos (`theme-*`) permiten añadirlo después | — |

## 3. Biblioteca de componentes

| Nivel | Componente | Variantes y estados | Tokens |
|---|---|---|---|
| atom | `atom-button` | primario, secundario, peligro; default, hover, focus, active, disabled, loading (`aria-busy`) | `theme-primary`, `theme-danger`, `size.target-min` |
| atom | `atom-field` (texto, correo, contraseña, fecha, número, selector) | default, focus, error (`aria-invalid`), disabled | `theme-border`, `theme-status-error-text` |
| atom | `atom-badge` | estado de reserva (Reservada, Prestada, Devuelta, Cancelada, No recogida), multa (Pendiente, Pagada), unidad (Activa, De baja), cuenta (Activa, Baja); siempre texto + icono, nunca solo color | `theme-status-*` |
| atom | `atom-link` | default, hover, focus, visited no distinguido | `theme-primary` |
| mol | `mol-form-field` | etiqueta + ayuda + `atom-field` + mensaje de error enlazado | `spacing.2` |
| mol | `mol-alert` | éxito (`role="status"`), aviso, error (`role="alert"`) | `theme-status-*` |
| mol | `mol-list-row` | fila con datos + acción opcional; bajo `md` se muestra como tarjeta | `theme-divider` |
| mol | `mol-empty-state` | texto de vacío del catálogo ("No tienes reservas") | `theme-text-muted` |
| mol | `mol-confirm` | confirmación en la propia fila antes de acciones destructivas (cancelar reserva, dar de baja socio o unidad) | `theme-danger` |
| org | `org-nav` | enlaces según rol, página actual con `aria-current="page"`, "Salir"; bajo `md` se pliega en botón "Menú" | `breakpoint.md` |
| org | `org-loan-list` | sección con título y lista de `mol-list-row` (prestado, vuelve hoy, con retraso, entregar hoy) | — |
| org | `org-reservation-form` | tipo + desde + hasta + enviar | — |
| org | `org-member-form`, `org-stock-form` | alta de socio; añadir unidades | — |
| tmpl | `tmpl-app` | cabecera con `org-nav`, `main` con `h1`, zona de mensajes | `size.content-max` |
| tmpl | `tmpl-login` | tarjeta centrada sin navegación | — |
| page | `page-entrar`, `page-mis-reservas`, `page-reservar`, `page-entregas`, `page-multas`, `page-socios`, `page-inventario`, `page-historial` | ver `WIREFRAMES.md` | — |

## 4. Supuestos

- Sin logo ni guía de marca del club: se propone paleta verde pino y piedra; sustituible cambiando los tokens.
- Los textos de cada mensaje de error vienen del catálogo (VO-010); este documento no los redacta, solo dice dónde aparecen.
- Pantalla extra no pedida: ninguna. La confirmación antes de cancelar/dar de baja se hace en la misma fila, no es una pantalla nueva, y el servidor sigue siendo quien valida.
- Sin tema oscuro, sin app nativa y sin modo offline por no estar en los requisitos.
- La rejilla de móvil se comprueba a 360px de ancho; la de tableta a 768px.

## 5. Document History

| Versión | Fecha | Cambio |
|---|---|---|
| 1.0 | 2026-11-21 | Primera versión |
