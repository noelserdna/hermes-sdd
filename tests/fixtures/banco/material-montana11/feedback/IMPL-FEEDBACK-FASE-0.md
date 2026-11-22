# Implementation Feedback — FASE-0

> Revisión independiente de la Fase 9 (paso 2b). Cada entrada es una opinión sin contrastar: una persona decide en la puerta de la FASE si se corrige (tarea de arreglo) o se descarta. Esta etapa no las ha corregido.

## Issues

### IF-0-001: URL malformada tumba el proceso del servidor

| Field | Value |
|---|---|
| **ID** | IF-0-001 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/nfr/SECURITY.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `new URL(req.url, …)` está fuera del `try` en un manejador `async` (`src/server/plugin.js:59`); una URL que `URL` rechaza deja una promesa rechazada sin capturar.
**Evidence:** `GET //[ HTTP/1.1` sin sesión → `TypeError: Invalid URL` → en Node ≥ 15 cae el proceso. No se ha lanzado la petición.
**Suggested Resolution:** meter el análisis de la URL dentro del `try` y responder 400.

---

### IF-0-002: cuerpo JSON `null` da 503 en vez de 401/422

| Field | Value |
|---|---|
| **ID** | IF-0-002 |
| **Severity** | BLOCKER |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/contracts/API-acceso.md, spec/domain/05-INVARIANTS.md (INV-ACC-007) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** `JSON.parse('null')` da `datos = null`; el valor por defecto `= {}` solo cubre `undefined` y la desestructuración lanza `TypeError` (`src/domain/cuentas.js:16`, `:98`). El `catch` de `plugin.js` lo convierte en 503 `E_ALMACEN_NO_DISPONIBLE`.
**Evidence:** `POST /api/crearSocio` con cuerpo `null` y sin sesión → 503 (debería ser 401, orden sesión → rol → validación, D-T-006); `iniciarSesion` con `null` → 503 (debería ser 422).
**Suggested Resolution:** tratar un cuerpo que no sea objeto como `{}` en `leerCuerpo`, o no desestructurar en la firma.

---

### IF-0-003: el bloqueo permite enumerar correos

| Field | Value |
|---|---|
| **ID** | IF-0-003 |
| **Severity** | WARNING |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/domain/05-INVARIANTS.md (INV-ACC-004, INV-ACC-006) |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** tras 5 fallos con un correo registrado responde `E_CUENTA_BLOQUEADA`; con un correo inexistente siempre `E_CREDENCIALES_INVALIDAS` (`src/domain/cuentas.js:26-33`). Además una cuenta en Baja ya bloqueada contesta bloqueo, no «credenciales». Las cuentas bloqueadas no hacen scrypt, así que el tiempo también las distingue.
**Evidence:** 6 intentos con `lucia@club.test` y 6 con `nadie@club.test` dan respuestas distintas. El contrato (INV-ACC-004) exige el mensaje de bloqueo al 5.º fallo, así que cerrarlo del todo choca con la especificación.
**Suggested Resolution:** decisión de la persona: aceptar el riesgo (club pequeño) o ajustar la especificación.

---

### IF-0-004: cuerpo excedido se sigue leyendo entero

| Field | Value |
|---|---|
| **ID** | IF-0-004 |
| **Severity** | WARNING |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/nfr/SECURITY.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** al pasar de 16 KB se deja de guardar pero se sigue consumiendo la petición (`src/server/plugin.js:43-47`); un POST anónimo enorme o muy lento ocupa la conexión. Se hizo así para poder responder 413 sin cortar la conexión.
**Suggested Resolution:** comprobar `Content-Length` por adelantado y cerrar la conexión tras responder 413.

---

### IF-0-005: escritura concurrente entre `seed` y el servidor

| Field | Value |
|---|---|
| **ID** | IF-0-005 |
| **Severity** | WARNING |
| **Task** | n/a (CODE-REVIEW) |
| **Affected Specs** | spec/adr/ADR-005-escrituras-atomicas.md |
| **Category** | CODE-REVIEW |
| **Status** | OPEN |

**Problem:** leer → modificar → escribir no es atómico entre procesos (`src/server/store.js`, `scripts/seed.js`): con `seed` y servidor a la vez, uno puede pisar al otro y comparten `${archivo}.tmp`. Dentro de un proceso es síncrono y no hay carrera. Riesgo bajo: `seed` se ejecuta una vez al instalar.
**Suggested Resolution:** documentar en el README que `seed` se ejecuta con la web parada, o añadir un candado de fichero.

---

### IF-0-006: la prueba de «Salir y volver atrás» no espera a que termine la vuelta (CH-002)

| Field | Value |
|---|---|
| **ID** | IF-0-006 |
| **Severity** | BLOCKER |
| **Task** | TASK-F0-010 (corrección tras CH-001) |
| **Affected Specs** | REQ-F-001 AC7 (`requirements/`), AC-002-01 (`spec/tests/BDD-UC-002.md`) |
| **Category** | ACCEPTANCE-ADVERSARIAL (CH-002, WEAKENED-ASSERT) |
| **Status** | OPEN |

**Problem:** tras la corrección 415fe75, `tests/e2e/fase-0-wf-002.spec.js:138-149` añade aserciones después de `page.goBack()` (línea 135). Se evalúan antes de que `conSesion` (`src/ui/main.js:35-42`) termine `comprobarSesion` y renderice la pantalla, así que pasan sobre el formulario Entrar que ya estaba en pantalla. Un fallo en el que volver atrás mostrara «Mis reservas» podría pasar. El criterio pide que «going back to a member screen shows the login form again». CH-001 queda sin resolver: el verificador independiente lo confirma leyendo el código (no con un fallo inducido).

**Suggested Resolution:** que la prueba espere al resultado de la vuelta antes de comprobar: por ejemplo, esperar a la petición de comprobación de sesión o a un estado del DOM que solo exista tras el render, y después afirmar «Entrar» sin «Salir» ni «Mis reservas». Comprobar que la prueba falla con un fallo inducido (p. ej. que `volverAEntrar` no se ejecute). **Esto es editar un test existente: lo aprueba una persona (art. 12) antes del commit.**
