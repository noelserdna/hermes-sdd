# Interaction Model — material-montana11

## Document History

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-11-21 | sdd-ux-designer | Primera versión |

## 1. State Diagrams

### Envío de formulario (todas las pantallas con formulario)
```
reposo -> enviando -> exito  (aviso role=status, se refresca la lista)
                  \-> error  (aviso role=alert + campos con aria-invalid; foco al primer campo inválido o al aviso)
                  \-> sesión caducada (se muestra Entrar con «Sesión caducada, vuelve a entrar»)
```
### Acción destructiva en línea (Cancelar reserva, Dar de baja, Marcar pagada)
```
reposo -> confirmando ([Sí, ...] [No], foco al primero) -> enviando -> resultado
                       \-> Esc / No -> reposo (foco vuelve al botón original)
```
### Estado visible de una reserva (SM-001)
Reservada → Entregado → Devuelto; Reservada → Cancelada; Reservada → No recogida. La interfaz solo ofrece la acción válida del estado actual; el servidor decide.

## 2. Transition Specifications

| Elemento | Disparador | Duración | Easing | Reduced motion |
|---|---|---|---|---|
| Aparición de aviso | resultado | 120 ms (opacidad) | ease-out | sin animación |
| Menú móvil | botón «Menú» | 200 ms | ease-out | sin animación |
| Confirmación en línea | acción | 120 ms | ease-out | sin animación |

Nada parpadea ni se mueve más de 5 s (2.2.2). Los cambios de contenido no desplazan el resto de la página (CLS).

## 3. Loading States

Botón en envío: texto sin cambiar, `aria-disabled="true"` y etiqueta añadida «Enviando…» visible; segundo clic ignorado. Listas: texto «Cargando…» en `role="status"`; sin esqueletos animados.

## 4. Error States

- Mensaje del servidor, literal de REQUIREMENTS, en `mol-alert` con prefijo textual «Error:» para no depender del color; mismo mensaje en un único sitio (junto a `h1`) y enlazado al campo cuando aplique.
- Fallo de red: «No se ha podido conectar. Inténtalo de nuevo.» con botón «Reintentar» (R: texto no fijado por los requisitos).
- Los valores escritos se conservan tras error (salvo contraseña).
- Acceso no permitido: SCR-012.

## 5. Empty States

| Pantalla | Texto literal |
|---|---|
| Mis reservas | No tienes reservas |
| Multas (socio y encargado) | Sin multas |
| Prestado | No hay material prestado |
| Historial del socio | Sin préstamos ni multas |

## 6. Animation Catalog

Solo las tres transiciones de §2; ninguna es esencial. Con `prefers-reduced-motion: reduce` todas se eliminan.

## 7. Session Behaviour

Cada acción renueva la actividad; a los 30 minutos sin actividad la siguiente pantalla muestra Entrar con «Sesión caducada, vuelve a entrar». Sin aviso previo ni cuenta atrás (el requisito no lo pide). «Salir» siempre visible en la cabecera.

## Traceability

REQ-F-001, REQ-F-003..010; INV-ACC-004, INV-ACC-005, INV-RES-008, INV-LOA-003.
