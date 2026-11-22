---
title: Especificación de accesibilidad — WCAG 2.2 AA
version: 1.0
date: 2026-11-21
refs: REQ-C-001, SEC-002, SEC-007
---

# Accesibilidad (WCAG 2.2 AA)

Idioma del documento: `lang="es"` en la página (3.1.1).

## 1. Aplicabilidad por criterio

Solo se listan los criterios con decisión concreta; el resto de A y AA aplica por defecto (sin vídeo, audio ni contenido temporizado, 1.2.x y 2.2.1 no aplican salvo la caducidad de sesión).

| Criterio | Decisión |
|---|---|
| 1.1.1 Contenido no textual | Iconos de estado con texto al lado; decorativos `aria-hidden` |
| 1.3.1 Información y relaciones | Encabezados jerárquicos, listas y tablas reales con `th scope`; etiquetas `label for` |
| 1.3.5 Propósito de entrada | `autocomplete="username"` (correo), `current-password`, `new-password` en alta y restablecer |
| 1.4.1 Uso del color | Estados siempre con texto (badge) |
| 1.4.3 / 1.4.11 Contraste | Ver sección 4 |
| 1.4.4 / 1.4.10 Zoom y reflujo | Hasta 200% y a 320px sin scroll horizontal; tablas pasan a tarjetas |
| 1.4.12 Espaciado de texto | Sin alturas fijas en contenedores de texto |
| 2.1.1 / 2.1.2 Teclado | Todo operable por teclado, sin trampas |
| 2.4.1 Saltar bloques | Enlace "Ir al contenido" como primer foco |
| 2.4.2 / 2.4.6 Título y encabezados | `title` = "{pantalla} · Material Montaña 10"; un `h1` por pantalla |
| 2.4.3 Orden de foco | Orden visual; tras navegar, foco en `h1` |
| 2.4.7 Foco visible / 2.4.11 Foco no oculto | Anillo `size.focus-ring` color `theme-focus`; la cabecera no es fija para no tapar el foco |
| 2.4.13 | (AAA, no aplica) |
| 2.5.7 Arrastre | Ninguna función requiere arrastrar |
| 2.5.8 Tamaño de objetivo | Objetivos ≥ 44px (`size.target-min`), por encima del mínimo de 24px |
| 3.2.6 Ayuda coherente | "Salir" y navegación siempre en el mismo sitio |
| 3.3.1 / 3.3.3 Errores | Mensaje de texto que dice qué pasó y qué hacer; viene del catálogo |
| 3.3.2 Etiquetas | Etiqueta visible y ayuda (p. ej. "Mínimo 8 caracteres") |
| 3.3.7 Entrada redundante | No se pide dos veces lo ya introducido; tras un error se conservan los valores escritos (excepto la contraseña) |
| 3.3.8 Autenticación accesible | Entrar con correo y contraseña sin pruebas cognitivas; se permite pegar y usar gestores de contraseñas; sin CAPTCHA |
| 4.1.2 Nombre, función, valor | Botones con nombre específico ("Cancelar reserva de Casco 2026-12-01"), via `aria-label` si la fila no basta |
| 4.1.3 Mensajes de estado | Éxitos en `role="status"`, errores en `role="alert"` |

Caducidad de sesión (2.2.1): la sesión caduca tras 8 h sin actividad; no hay aviso previo (no se pide en los requisitos). Al caducar se muestra Entrar con el mensaje y se conservan los datos que no son sensibles solo si el navegador los guarda.

## 2. Patrones ARIA por componente

| Componente | Patrón |
|---|---|
| `org-nav` | `nav aria-label="Principal"`, enlaces, `aria-current="page"`; botón "Menú" con `aria-expanded` y `aria-controls` |
| `mol-form-field` | `label` asociada; error en elemento con id referenciado por `aria-describedby`; `aria-invalid="true"` solo tras respuesta del servidor; `aria-required` en lugar de `required` |
| Resumen de errores | `role="alert"`, enlaces a cada campo con error |
| `mol-alert` | éxito `role="status"` (educado), error `role="alert"` |
| `atom-badge` | texto visible; sin rol especial |
| `atom-button` cargando | `aria-busy="true"` y `aria-disabled="true"` (sin quitar del orden de foco) |
| `mol-confirm` | grupo en la propia fila con `role="group"` y nombre; foco pasa al primer botón y vuelve al disparador al cerrar |
| Tablas | `table` con `caption` (puede ser visualmente oculta) y `th scope="col"`; en tarjetas se mantienen listas (`ul`) con etiquetas "Desde:" visibles |
| Selectores | `select` nativo |
| Secciones de SCR-004 | `section aria-labelledby` con `h2` |

## 3. Matriz de teclado

| Contexto | Tecla | Efecto |
|---|---|---|
| Global | Tab / Mayús+Tab | Siguiente / anterior |
| Global | Enter, Espacio | Activa botón; Enter envía formulario; Espacio no activa enlaces |
| Menú plegado | Enter / Espacio | Abre/cierra; Esc cierra y devuelve el foco al botón |
| Confirmación en fila | Esc | Cancela la confirmación y devuelve el foco |
| Selector | Flechas | Cambia opción |
| Campo de fecha | Flechas / teclado | Según el control nativo |

Sin atajos propios de una sola letra (2.1.4).

## 4. Contraste verificado (tokens `theme-light`)

| Par | Ratio | Mínimo | OK |
|---|---|---|---|
| text / bg | 15,14 | 4,5 | si |
| text / surface | 16,51 | 4,5 | si |
| text-muted / surface | 6,91 | 4,5 | si |
| text-muted / bg | 6,34 | 4,5 | si |
| on-primary / primary | 7,89 | 4,5 | si |
| on-primary / primary-hover | 10,45 | 4,5 | si |
| on-danger / danger | 7,53 | 4,5 | si |
| status-ok-text / status-ok-bg | 9,45 | 4,5 | si |
| status-warn-text / status-warn-bg | 8,99 | 4,5 | si |
| status-error-text / status-error-bg | 6,16 | 4,5 | si |
| focus / surface | 8,39 | 3 | si |
| focus / bg | 7,69 | 3 | si |
| border / surface (campos) | 6,91 | 3 | si |

## 5. Comprobación

- Automática: axe en Playwright sobre cada pantalla (la suite de aceptación ya usa Playwright).
- Manual: recorrido solo con teclado de SCR-001, SCR-003 y SCR-004; lector de pantalla en una reserva y una devolución; zoom 200% y 320px.
