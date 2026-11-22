# Implementation Feedback — FASE-2

> Revisión independiente de la Fase 9 (paso 2b). Cada entrada es una opinión sin contrastar: una persona decide en la puerta de la FASE si se corrige (tarea de arreglo) o se descarta. Esta etapa no las ha corregido.

## Issues

### IF-2-001: cuerpo JSON `null` en las operaciones de préstamos da 503 en vez de 401/403/422

| Field | Value |
|---|---|
| **ID** | IF-2-001 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | design/OPERATION-MAPPING.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** el valor por defecto `= {}` de `entregarReserva` y `registrarDevolucion` (`src/domain/prestamos.js`) solo cubre `undefined`, no `null`; un cuerpo JSON `null` lanza `TypeError` antes de autenticar y el plugin lo traduce a `E_ALMACEN_NO_DISPONIBLE`. Es la misma causa que IF-0-002 e IF-1-002.
**Evidence:** `POST /api/entregarReserva` con `Content-Type: application/json` y cuerpo `null` → error de almacén en vez de 401 sin sesión o `E_ACCESO_NO_PERMITIDO` a un socio. Sin fuga ni escritura. No se ha lanzado la petición.
**Suggested Resolution:** normalizar el cuerpo a `{}` cuando no es un objeto, en un solo punto del plugin (resuelve también IF-0-002 e IF-1-002).

---

### IF-2-002: el aviso «Multa creada» puede mostrarse al repetir una devolución que ya creó la multa otro encargado

| Field | Value |
|---|---|
| **ID** | IF-2-002 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | ux/WIREFRAMES.md (SCR-007) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `registrarDevolucion` repetida devuelve la vista con la multa existente y la pantalla Préstamos (`src/ui/pantallas/prestamos.js`) muestra «Multa creada: …» siempre que la respuesta lleva multa.
**Evidence:** un segundo encargado con la lista desactualizada que pulsa «Registrar devolución» sobre una reserva ya devuelta con retraso ve el aviso aunque la multa no la creó su pulsación. Solo afecta al texto; no cambia datos.
**Suggested Resolution:** que la operación indique si la multa es nueva, o no mostrar el aviso cuando la reserva ya figuraba Devuelta.

---
