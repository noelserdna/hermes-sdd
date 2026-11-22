# Guion de la demo — FASE-4

Cada criterio se enseña de dos maneras: se DICE (narrar: rótulo y voz) y se VE (captura con sus textos «Se ve:»).
Narra con la frase exacta de cada criterio justo antes de su captura; los pasos del caso de uso, con tus palabras.
Si «El criterio pide» algo más que esos textos (que algo no cambie, que solo quede uno, que no se añada, que siga tras
recargar), dilo también, en castellano y con los datos del test, en la narración de ese criterio.

## UC-003 — Crear socio y listar socios

Flujo principal:
1. Encargado: abre Socios.
2. System: lista nombre, correo y estado de cada socio (API-001-05, INV-SEC-001).
3. Encargado: envía nombre, correo y contraseña.
4. System: valida que los tres datos vienen informados.
5. System: valida la contraseña mínima (INV-ACC-002) y la unicidad del correo (INV-ACC-001).
6. System: guarda la cuenta de forma atómica (INV-SEC-003) y muestra la lista actualizada.

Extensiones:
- 2a. Un socio dado de baja → aparece marcado "Baja". (AC-003-02)

Criterios:
- AC-003-01: Gestionar las cuentas de socios. En Socios se ve «Pablo Ruiz».
  El criterio pide: the user sees "Pablo Ruiz" in the list of socios
- AC-003-04: Gestionar las cuentas de socios. En Socios se ve «La contraseña debe tener al menos 8 caracteres».
  El criterio pide: the user sees "La contraseña debe tener al menos 8 caracteres" and no member is created
- AC-003-05: Gestionar las cuentas de socios. En Socios se ve «Ya existe un socio con ese correo».
  El criterio pide: the user sees "Ya existe un socio con ese correo" and the list keeps a single "pablo@club.test"
- AC-003-06: Gestionar las cuentas de socios. En Socios se ve «Acceso no permitido».
  El criterio pide: the user sees "Acceso no permitido"

## UC-004 — Restablecer contraseña y dar de baja socio

Flujo principal:
1. Encargado: elige un socio en Socios y envía una contraseña nueva.
2. System: valida el socio y la contraseña mínima (INV-ACC-002).
3. System: guarda el hash y muestra el aviso M_CONTRASENA_RESTABLECIDA.
4. Encargado: da de baja a un socio.
5. System: comprueba que no tiene reservas Entregado (INV-LOA-004).
6. System: pone la cuenta en Baja y cancela sus reservas Reservada de forma atómica (INV-SEC-003).
7. System: muestra la lista actualizada.

Criterios:
- AC-004-01: Gestionar las cuentas de socios. En Socios se ve «Contraseña restablecida».
  El criterio pide: she can sign in with it and no longer with the old one
- AC-004-02: Gestionar las cuentas de socios. En Socios se ve «Baja».
  El criterio pide: the user sees "Pablo Ruiz" marked "Baja" and the reservation is cancelled, freeing the unit
- AC-004-05: Gestionar las cuentas de socios. En Socios se ve «No se puede dar de baja: tiene material sin devolver».
  El criterio pide: the user sees "No se puede dar de baja: tiene material sin devolver" and he stays active

## UC-013 — Añadir material

Flujo principal:
1. Encargado: abre Inventario (API-004-01).
2. System: muestra cada tipo con "{tipo}: {n} unidades" y sus unidades, también las "De baja".
3. Encargado: elige un tipo e indica la cantidad (API-004-02).
4. System: valida tipo (INV-STK-001) y cantidad (INV-STK-002).
5. System: crea las unidades con los números siguientes del tipo, de forma atómica (INV-SEC-003).
6. System: muestra Inventario con el recuento nuevo.

Extensiones:
- 2a. Un tipo sin unidades → se muestra con 0 unidades. (AC-013-02)

Criterios:
- AC-013-01: Gestionar el inventario. En Inventario se ve «{tipo}: {n} unidades».
  El criterio pide: the user sees "Crampones: 2 unidades" in the inventory
- AC-013-03: Gestionar el inventario. En Inventario se ve «La cantidad debe ser al menos 1».
  El criterio pide: the user sees "La cantidad debe ser al menos 1"
- AC-013-06: Gestionar el inventario. En Inventario se ve «Acceso no permitido».
  El criterio pide: the user sees "Acceso no permitido"

## UC-014 — Dar de baja unidad

Flujo principal:
1. Encargado: elige una unidad en Inventario y la da de baja (API-004-03).
2. System: comprueba que la unidad existe y que no tiene reserva Entregado (INV-STK-003).
3. System: pasa la unidad a De baja y cancela sus reservas Reservada, de forma atómica (INV-STK-005, INV-SEC-003).
4. System: muestra Inventario con "{tipo}: {n} unidades" y la unidad como "De baja".

Extensiones:
- 3a. La unidad tenía reservas Reservada futuras → se muestra `M_RESERVAS_CANCELADAS_BAJA`. (AC-014-02)

Criterios:
- AC-014-01: Gestionar el inventario. En Inventario se ve «{tipo}: {n} unidades».
  El criterio pide: the user sees "Casco: 3 unidades" and "Casco 3" as "De baja"
- AC-014-03: Gestionar el inventario. En Inventario se ve «No se puede dar de baja: está prestada».
  El criterio pide: the user sees "No se puede dar de baja: está prestada" and the unit stays
- AC-014-02: Gestionar el inventario. En Inventario se ve «{n} reserva cancelada por la baja».
  El criterio pide: that reservation is cancelled and the user sees "1 reserva cancelada por la baja"
- AC-014-07: Gestionar el inventario. En Inventario se ve «{tipo}: {n} unidades».
  El criterio pide: the count stays the same
