# Guion de la demo — FASE-3

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-002 — Gestionar socios

Flujo principal:
1. Encargado: abre Socios.
2. System: lista nombre, correo y estado de los socios (API-001-06).
3. Encargado: envía nombre, correo y contraseña inicial.
4. System: normaliza el correo (RN-014); valida contraseña (INV-ACC-002) y correo único (INV-ACC-001).
5. System: crea la cuenta Activa con rol socio y solo su hash (INV-ACC-003); aparece en la lista. (AC-002-01)

Extensiones:
- 3a. Encargado pide la baja → System comprueba INV-ACC-007 (RN-010), deja la cuenta en Baja (INV-ACC-006) y la lista muestra "Baja". (AC-002-04)
- 3b. Encargado envía nueva contraseña → System la valida y sustituye la anterior (INV-ACC-103); muestra "Contraseña restablecida". (AC-002-06)

Criterios:
- AC-002-01: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Marta Ruiz».
  El criterio pide: the user sees "Marta Ruiz" in the list of Socios and Marta can enter
- AC-002-02: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Ya existe un socio con ese correo».
  El criterio pide: the user sees "Ya existe un socio con ese correo" and the list keeps one "Marta Ruiz"
- AC-002-03: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres».
  El criterio pide: the user sees "La contraseña debe tener al menos 8 caracteres" and no account is created
- AC-002-04: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «{nombre}» y «Baja».
  El criterio pide: the user sees "Pablo" with "Baja" in Socios and Pablo cannot enter
- AC-002-05: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «No se puede dar de baja: tiene material prestado o multas pendientes».
  El criterio pide: the user sees "No se puede dar de baja: tiene material prestado o multas pendientes" and her account stays active
- AC-002-06: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «Contraseña restablecida».
  El criterio pide: Marta enters with it and the old one no longer works
- AC-002-07: Dar de alta, dar de baja y restablecer contraseña de socios. En Socios se ve «No tienes permiso para ver esta pantalla».
  El criterio pide: the user sees "No tienes permiso para ver esta pantalla"

## UC-006 — Devolver y multar

Flujo principal:
1. Encargado: marca la devolución de una reserva.
2. System: comprueba que existe y está Prestada (INV-LOA-003).
3. System: cuenta los días naturales de retraso desde `hasta` (RN-009).
4. System: pasa la reserva a Devuelta y fija `devueltaEl` (API-003-02).
5. System: si días > 0, crea una multa Pendiente en la misma operación indivisible (INV-LOA-004).
6. System: muestra "{unidad} · {socio} · Devuelta" y, si hay multa, su aviso; el Socio la ve después en Mis reservas.

Extensiones:
- 3a. Devuelta el día `hasta` o antes → no se crea multa (RN-009). (AC-006-01)

Criterios:
