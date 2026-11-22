# Guion de la demo — FASE-0

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-001 — Entrar

Flujo principal:
1. Usuario: envía correo y contraseña en Entrar.
2. Sistema: comprueba bloqueo de cuenta (`LOGIN_MAX_FAILURES`, `LOGIN_LOCK_MINUTES`; RN-001) y credenciales (RN-007).
3. Sistema: abre la sesión y muestra la página de su rol (API-001-01).
4. Usuario: abre una página privada; Sistema: autoriza con sesión y rol, caduca tras `SESSION_IDLE_MINUTES` sin actividad (API-001-08; INV-SOC-005, RN-002).

Extensiones:
- 3a. `mustChangePassword` → se muestra Cambiar contraseña (UC-004; INV-SOC-006).
- 2a. pasados `LOGIN_LOCK_MINUTES` desde el bloqueo, la contraseña correcta entra. (AC-001-05)
- 3b. rol encargado → Panel del encargado. (AC-001-02)

Criterios:
- AC-001-01: Entrar y salir. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Lucía" in the page "Mis reservas"
- AC-001-02: Entrar y salir. En Panel del encargado se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Pablo" in the page "Panel del encargado"
- AC-001-03: Entrar y salir. En Entrar se ve «Correo o contraseña incorrectos».
  El criterio pide: the user sees "Correo o contraseña incorrectos"
- AC-001-04: Entrar y salir. En Entrar se ve «Cuenta bloqueada. Vuelve a intentarlo en 15 minutos».
  El criterio pide: the user sees "Cuenta bloqueada. Vuelve a intentarlo en 15 minutos"
- AC-001-05: Entrar y salir. En Mis reservas se ve «Hola, {nombre}».
  El criterio pide: the user sees "Hola, Lucía"
- AC-001-06: Entrar y salir. En Entrar se ve «Entrar».
  El criterio pide: the user sees the form "Entrar"
- AC-001-07: Entrar y salir. En Entrar se ve «Entrar».
  El criterio pide: the user sees the form "Entrar"

## UC-002 — Salir

Flujo principal:
1. Usuario: pulsa "Salir".
2. Sistema: invalida la sesión (API-001-02, RN-003).
3. Sistema: muestra el formulario Entrar.
4. Usuario: vuelve atrás con el navegador; Sistema: exige sesión para toda página privada (API-001-08, RN-020).

Extensiones:
- 4a. el usuario vuelve atrás → se muestra Entrar sin datos de socios. (AC-002-02)

Criterios:
- AC-002-01: Entrar y salir. En Entrar se ve «Entrar» y «Entrar».
  El criterio pide: the user sees the form "Entrar" and going back does not show private data

## UC-007 — Reservar material

Flujo principal:
1. Socio: abre "Reservar"; el sistema autoriza (API-001-08) y ofrece solo tipos con unidades > 0 (API-003-03, INV-MAT-003).
2. Socio: elige tipo, cantidad, fecha de inicio y de fin, y envía.
3. System: comprueba que no hay multa pendiente (INV-MUL-002, RN-016; WF-001 paso 7 al pagarla).
4. System: valida en orden fecha pasada, fin anterior, `MAX_RESERVATION_DAYS`, `MAX_UNITS_PER_RESERVATION` (RN-010, INV-RES-001..003).
5. System: calcula libres por día desde las reservas (ADR-001, RN-009, INV-RES-004).
6. System: crea la reserva Reservada (WF-001 paso 1) y muestra "Mis reservas".

Extensiones:
- 1a. Tipo con 0 unidades → no se ofrece. (AC-007-10)
- 3a. Multa ya pagada (WF-001 paso 7) → sigue en 4.

Criterios:
- AC-007-10: Inventario. En Reservar (ejemplo con datos: "Casco") se ve «{material}», «Casco» y «Cuerda».
  El criterio pide: the user sees "Casco" among the types and "Cuerda" does not offer reservation

## UC-015 — Añadir unidades de material

Flujo principal:
1. Encargado: abre "Material"; el sistema lo autoriza y lista tipos con su total (API-003-03).
2. Encargado: indica nombre y cantidad y envía.
3. System: valida nombre no vacío y cantidad entera ≥ 1 (RN-017).
4. System: busca el tipo sin distinguir mayúsculas; si no existe lo crea (INV-MAT-004).
5. System: suma la cantidad y muestra la lista actualizada.

Extensiones:
- 4a. Tipo nuevo → se crea con la cantidad como total. (AC-015-02)

Criterios:
- AC-015-01: Inventario. En Material se ve «{material}: {total} unidades».
  El criterio pide: the user sees "Cuerda: 6 unidades" in "Material"
- AC-015-02: Inventario. En Material se ve «{material}: {total} unidades».
  El criterio pide: the user sees "Mosquetón: 10 unidades"

## UC-016 — Retirar unidades rotas

Flujo principal:
1. Encargado: elige tipo y cantidad de baja en "Material" y envía; el sistema autoriza (API-001-08).
2. System: valida cantidad entera ≥ 1 (RN-017).
3. System: comprueba que la cantidad no supera el total (INV-MAT-001).
4. System: comprueba cada día desde hoy `total − n ≥ ocupadas` (INV-MAT-002, RN-009, ADR-001).
5. System: reduce el total y muestra la lista actualizada.

Criterios:
- AC-016-01: Inventario. En Material se ve «{material}: {total} unidades».
  El criterio pide: the user sees "Cuerda: 5 unidades"
- AC-016-02: Inventario. En Material (ejemplo con datos: "Tienda: 2 unidades") se ve «No se puede dar de baja: hay {n} unidades de {material} necesarias el {día}» y «{material}: {total} unidades».
  El criterio pide: the user sees "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06" and "Tienda: 2 unidades"
- AC-016-03: Inventario. En Material (ejemplo con datos: "Cuerda: 0 unidades") se ve «No hay tantas unidades para dar de baja» y «{material}: {total} unidades».
  El criterio pide: the user sees "No hay tantas unidades para dar de baja" and "Cuerda: 0 unidades"
