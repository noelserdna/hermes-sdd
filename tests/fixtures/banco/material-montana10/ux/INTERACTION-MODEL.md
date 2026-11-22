---
title: Modelo de interacción
version: 1.0
date: 2026-11-21
refs: UC-001..UC-010, WF-002
---

# Modelo de interacción

## 1. Estados de una acción (botón de envío)

```
reposo --pulsar--> enviando (aria-busy, inactivo)
enviando --respuesta ok--> éxito (aviso role=status, navega o actualiza lista)
enviando --error del servidor--> error (aviso role=alert, valores conservados, foco al aviso)
éxito/error --> reposo
```

El estado visible de cada reserva, multa, unidad y cuenta es el que devuelve el servidor; la interfaz no lo calcula.

## 2. Transiciones

| Elemento | Disparador | Duración | Curva |
|---|---|---|---|
| Hover/foco de botón | puntero/teclado | `duration.fast` 120ms | ease-out |
| Menú plegable | pulsar "Menú" | `duration.base` 200ms | ease-out |
| Aviso nuevo | respuesta | sin animación (aparece directamente) | — |

Con `prefers-reduced-motion: reduce` todas las transiciones se anulan. No hay animaciones infinitas ni parpadeos.

## 3. Catálogo de estados de pantalla

| Estado | Presentación |
|---|---|
| Cargando lista | texto "Cargando…" en `role="status"`; sin esqueletos animados |
| Vacío | `mol-empty-state` con el texto del caso de uso ("No tienes reservas", "No hay material prestado", "Este socio no tiene préstamos ni multas") |
| Éxito | `mol-alert` de éxito con el texto del caso de uso; permanece hasta cambiar de pantalla |
| Error de negocio | `mol-alert` de error con el mensaje del catálogo; junto al campo si afecta a uno |
| Sin permiso / sin sesión | `E_SIN_PERMISO` o pantalla Entrar con su mensaje; no se muestran datos |
| Almacén no disponible | aviso de error con `E_ALMACEN_NO_DISPONIBLE`; los datos anteriores no se ocultan ni se alteran |

## 4. Flujos clave

| Flujo | Pasos de interacción |
|---|---|
| Entrar (UC-001) | enviar -> "Hola, {nombre}" -> pantalla inicial del rol; Salir -> Entrar |
| Reservar (UC-003) | rellenar -> Reservar -> Mis reservas con "Reserva creada: …"; error: se queda en Reservar con los valores |
| Cancelar (UC-004) | Cancelar -> confirmar en fila -> la lista se actualiza, foco en el aviso |
| Entregar / devolver (UC-005, 006) | elegir unidad -> Entregar; Devolver; la fila pasa de sección y se anuncia el resultado; si hay multa se muestra su aviso |
| Pagar multa (UC-007) | Marcar como pagada -> fila Pagada con fecha |
| Alta, baja, restablecer (UC-002) | formulario o confirmación en fila -> aviso |
| Inventario (UC-008) | añadir -> "Añadidas {n} unidades de {material}"; marcar rota -> "{unidad} · De baja" |

## 5. Reglas de feedback

- Cada acción termina en un aviso visible y anunciado; nunca en silencio.
- Tras una acción el foco va al aviso (error) o al `h1`/aviso de la pantalla destino (éxito con navegación).
- Las acciones destructivas (cancelar, dar de baja socio o unidad) piden confirmación en la fila; devolver y entregar no, por ser el trabajo diario del encargado.
- La interfaz no bloquea envíos por reglas de negocio: espera la respuesta del servidor.
