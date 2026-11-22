# Modelo de interacción

> Generado por sdd-ux-designer v1.0.0 · Fecha: 2026-11-22

## Historial

| Versión | Fecha | Cambios |
|---|---|---|
| 1.0.0 | 2026-11-22 | Modelo inicial |

Principio: la interfaz es sobria; casi todo es envío de formulario y respuesta. No hay animación necesaria para entender nada. El servidor decide el resultado y el mensaje; la interfaz lo muestra tal cual en la zona de mensajes y actualiza las listas (ADR-005: repetir una operación no cambia nada y avisa).

## 1. Diagramas de estado

### Envío de una acción (todos los formularios y botones de fila)

```
 [Reposo] --(enviar)--> [Enviando] --(éxito)--> [Resultado: mensaje ok + lista nueva]
     ^                       |
     |                       +--(rechazo del servidor)--> [Resultado: mensaje de error, datos conservados]
     |                       +--(sin conexión / fallo)--> [Fallo: «No se ha podido completar. Inténtalo de nuevo.»]
     +---------(nueva acción)---------------------------------------+
```

| Estado | Descripción | Entra | Sale |
|---|---|---|---|
| Reposo | Control activo | carga o resultado visto | enviar |
| Enviando | Botón con `aria-busy="true"`, mismo nombre, no reenvía | enviar | respuesta |
| Resultado | Mensaje en zona viva, foco en él | respuesta | siguiente acción |
| Fallo | Mensaje de error genérico, controles activos para reintentar | sin respuesta | reintentar |

### Sesión

```
 [Sin sesión] --(Entrar ok)--> [Sesión]  --(Salir)-----------------> [Sin sesión]
      ^        --(Entrar ok con provisional)--> [Debe cambiar contraseña] --(Guardar ok)--> [Sesión]
      |                                                   |
      +--(30 min sin actividad)---------------------------+--(cualquier página)--> [Debe cambiar contraseña]
```

### Cuenta (Entrar)

```
 [Normal] --(fallo)--> [Fallos 1..4] --(5.º fallo)--> [Bloqueada 15 min] --(pasan 15 min + acierto)--> [Sesión]
                           |  (acierto) -> reinicia el contador
```
Bloqueada: mismo formulario con «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos»; el envío sigue disponible.

### Confirmación de baja (`org-confirm`)

```
 [Cerrado] --(clic «Dar de baja»)--> [Abierto, foco en «No»] --(«Dar de baja»)--> [Enviando] --> [Cerrado + resultado]
                                          |--(«No» o Esc)--> [Cerrado, foco al botón de origen]
```

### Campo en línea «Restablecer contraseña»

`[Plegado] --(Restablecer contraseña)--> [Abierto, foco al campo] --(Guardar)--> [Enviando] --> [Plegado + mensaje]`; Esc plegado sin guardar.

## 2. Transiciones

| Transición | Duración | Easing | Propiedad | Disparador |
|---|---|---|---|---|
| Hover/foco de botón | `duration.fast` 100 ms | `easing.default` | color de fondo, borde | puntero / teclado |
| Aparición del mensaje | `duration.normal` 200 ms | `easing.enter` | opacidad | resultado |
| Campo en línea de Restablecer | 200 ms | `easing.enter` | altura/opacidad | clic |
| Diálogo `org-confirm` | 150 ms | `easing.enter` / `easing.exit` | opacidad | abrir / cerrar |
| Menú móvil | 200 ms | `easing.default` | altura | botón «Menú» |

Con `prefers-reduced-motion: reduce` todo es instantáneo (`duration` = 0).

## 3. Estados de carga

| Situación | Espera | Patrón |
|---|---|---|
| < 200 ms | instantánea | sin indicador |
| 200 ms–1 s | corta | botón pulsado con texto de estado visible «Enviando…» y `aria-busy` |
| > 1 s | larga | además, el texto «Cargando…» en la lista (sin esqueletos animados) en las cargas de página |
| Sin respuesta | — | estado Fallo (ver arriba) |

Las pantallas se muestran completas desde el servidor; no hay carga progresiva obligada.

## 4. Estados de error

| Tipo | Patrón visual | Mensaje | Recuperación |
|---|---|---|---|
| Regla de campo o de negocio | Mensaje en `role="alert"` bajo el título + texto de error junto al campo si aplica; borde de error | Literal del requisito | Corregir y reenviar; los valores se conservan |
| Entrada fallida | Alerta en Entrar | «Correo o contraseña incorrectos» / «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos» | Reintentar; contraseña vaciada |
| Sin conexión o servidor caído | Alerta | «No se ha podido completar. Inténtalo de nuevo.» (texto mío; sin literal en los requisitos) | Reintentar; no se pierde lo escrito |
| Sin permiso | SCR-011 | «No tienes permiso para ver esta página» | «Volver a mi página» |
| Sesión caducada | Pantalla Entrar | (el requisito solo fija que se ve «Entrar») | Entrar de nuevo |
| Repetición (idempotente) | Aviso `status` | «La reserva ya estaba cancelada», «Ya estaba entregada», «Ya estaba devuelta», «La multa ya estaba pagada» | Ninguna: no cambió nada |

Cuando un envío vuelve a mostrar la misma pantalla con error, el foco va al mensaje; si es una validación de varios campos, al resumen (primer campo con error enlazado).

## 5. Estados vacíos

| Contexto | Mensaje | Acción |
|---|---|---|
| Mis reservas sin reservas | «Aún no tienes reservas» | Enlace «Reservar material» |
| Mis multas sin multas | «No tienes multas» | — |
| Panel sin préstamos | «No hay material prestado» | — |
| Multas (encargado) sin multas | «No hay multas» (redacción mía) | — |
| Historial sin préstamos ni multas | «Sin préstamos ni multas» | — |
| Búsqueda sin resultados | «Ningún socio coincide» | Cambiar la búsqueda |
| Material sin tipos | «No hay material todavía» (redacción mía) | Formulario «Tipo nuevo» |
| Reservar con todo a 0 unidades | «No hay material disponible para reservar» (redacción mía) | — |

Sin ilustraciones: texto claro.

## 6. Catálogo de animaciones

| Animación | Propósito | Duración | Easing | Alternativa con movimiento reducido |
|---|---|---|---|---|
| Aparición de mensaje | Mostrar el resultado | 200 ms | ease-out | Aparece sin transición |
| Despliegue del campo en línea | Indicar que se abre | 200 ms | ease-out | Aparece sin transición |
| Menú móvil | Plegar y desplegar | 200 ms | ease-in-out | Instantáneo |
| Diálogo de confirmación | Aparecer / cerrar | 150 ms | ease-out / ease-in | Instantáneo |

No hay temporizadores: los mensajes no desaparecen solos (el lector y quien tarda en leer no lo pierden; además lo exigen los AC que comprueban que el texto se ve tras la acción).

## 7. Reglas de formulario

- Etiqueta siempre visible; ayudas de reglas al lado del campo (mínimo 8 caracteres, máximo 5 unidades, máximo 14 días).
- El servidor valida; no hay validación bloqueante en el navegador ni validación «mientras escribes».
- Un envío en curso bloquea el reenvío del mismo formulario (el servidor igualmente trata el repetido como no-op, ADR-005).
- Tras un envío con éxito en formularios de alta, se vacían los campos (menos la fecha del panel).
- Intro envía el formulario.
