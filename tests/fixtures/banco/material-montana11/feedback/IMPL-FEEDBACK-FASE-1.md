# Implementation Feedback — FASE-1

> Revisión independiente de la Fase 9 (paso 2b). Cada entrada es una opinión sin contrastar: una persona decide en la puerta de la FASE si se corrige (tarea de arreglo) o se descarta. Esta etapa no las ha corregido.

## Issues

### IF-1-001: añadir material sin tope de cantidad puede bloquear el servidor

| Field | Value |
|---|---|
| **ID** | IF-1-001 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/contracts/API-inventario.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `validarCantidad` (`src/domain/validacion.js`) solo exige un entero ≥ 1 (INV-STK-002) y `anadirMaterial` (`src/domain/inventario.js`) crea las unidades en un bucle síncrono; además `Math.max(0, ...unidades)` desborda la pila con unas 100 000 unidades de un tipo.
**Evidence:** `POST /api/anadirMaterial {"tipo":"Casco","cantidad":1000000}` con sesión de encargado cabe en el límite de 16 KB del cuerpo, crea un millón de unidades, `operar` las clona con `structuredClone` y cada operación posterior de cualquier socio relee y reescribe el almacén entero; con más unidades de un tipo, `Math.max(...)` lanza `RangeError` (sale como 503) y ya no se puede añadir de ese tipo. No se ha lanzado la petición.
**Suggested Resolution:** el contrato no fija un máximo: hace falta decidir uno (valor de `VALUE-REGISTRY`) y rechazarlo con `E_CANTIDAD_INVALIDA`; calcular el mayor número con `reduce`.

---

### IF-1-002: cuerpo JSON `null` en las operaciones nuevas da 503 en vez de 422

| Field | Value |
|---|---|
| **ID** | IF-1-002 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | design/OPERATION-MAPPING.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** el valor por defecto `= {}` de la desestructuración solo cubre `undefined`, no `null`; en `reservarMaterial`, `cancelarReserva`, `anadirMaterial` y `consultarDisponibilidad` (`src/domain/reservas.js`, `src/domain/inventario.js`) un cuerpo `null` lanza `TypeError`, que el plugin traduce a `E_ALMACEN_NO_DISPONIBLE` (503). Es la misma causa que IF-0-002 (FASE-0), ahora también en las operaciones de FASE-1.
**Evidence:** `POST /api/reservarMaterial` con `Content-Type: application/json` y cuerpo `null` → 503 en vez de 422 `E_DATOS_INVALIDOS`. Sin fuga ni corrupción. No se ha lanzado la petición.
**Suggested Resolution:** normalizar el cuerpo a `{}` cuando no es un objeto, en un solo punto del plugin (resuelve también IF-0-002).

---
