# BDD-UC-005 — Reservar material

> Refs: UC-005; REQ-F-003; INV-RES-001..005. Hoy = 2026-11-21. "Sin cambios" = no hay reserva nueva.

Feature: Reservar material — As a socio I want reservar material para unas fechas so that tengo la unidad cuando la necesito

Scenario: AC-005-01 — reservar con unidades libres [REQ-F-003 AC1]
  Given 3 unidades de "Piolet" libres
  When "lucia" reserva "Piolet" de 2026-12-05 a 2026-12-07
  Then ve "Reserva creada: Piolet, 2026-12-05 a 2026-12-07"
  And "Piolet" muestra "2 libres" esas fechas

Scenario: AC-005-02 — días contiguos no solapan [REQ-F-003 AC3]
  Given "Tienda" (1 unidad) reservada hasta 2026-12-08
  When "pablo" reserva "Tienda" de 2026-12-09 a 2026-12-10
  Then ve "Reserva creada: Tienda, 2026-12-09 a 2026-12-10"

Scenario: AC-005-03 — socio sin multas [REQ-F-003 AC8]
  When "lucia" reserva "Casco" de 2026-12-05 a 2026-12-06
  Then la reserva se crea

Scenario: AC-005-04 — sin unidades [REQ-F-003 AC2]
  Given "Tienda" reservada de 2026-12-06 a 2026-12-08
  When "pablo" reserva "Tienda" de 2026-12-07 a 2026-12-09
  Then error `E_SIN_UNIDADES`: "No hay unidades libres esas fechas"

Scenario: AC-005-05 — fecha pasada [REQ-F-003 AC4]
  When "lucia" reserva "Casco" de 2026-11-20 a 2026-11-22
  Then error `E_FECHA_PASADA`: "No se puede reservar en fechas pasadas"

Scenario: AC-005-06 — fechas invertidas [REQ-F-003 AC5]
  When "lucia" envía inicio 2026-12-10 y fin 2026-12-08
  Then error `E_FECHAS_INVERTIDAS`: "La fecha de fin no puede ser anterior a la de inicio"

Scenario: AC-005-07 — reserva muy larga [REQ-F-003 AC6]
  When "lucia" reserva "Cuerda" de 2026-12-01 a 2026-12-15
  Then error `E_RESERVA_MUY_LARGA`: "La reserva no puede superar 14 días"

Scenario: AC-005-08 — multa pendiente [REQ-F-003 AC7]
  Given "pablo" con multa Pendiente de 4 €
  When reserva "Casco" de 2026-12-05 a 2026-12-06
  Then error `E_MULTA_PENDIENTE`: "Tienes una multa pendiente: no puedes reservar hasta pagarla"

Scenario: AC-005-09 — tipo inválido
  When "lucia" reserva "Bastón"
  Then error `E_MATERIAL_INVALIDO`; sin cambios

Scenario: AC-005-10 — datos vacíos
  When "lucia" envía sin fechas
  Then error `E_DATOS_INVALIDOS`; sin cambios

Scenario: AC-005-11 — rol no permitido
  When el encargado intenta reservar
  Then error `E_ACCESO_NO_PERMITIDO`; sin cambios

Scenario: AC-005-12 — última unidad en concurrencia
  Given "Tienda" con 1 unidad libre
  When "lucia" y "pablo" reservan a la vez
  Then la primera confirmada se crea
  And la otra recibe `E_SIN_UNIDADES`

Scenario: AC-005-13 — almacén caído
  When "lucia" reserva y el almacén falla
  Then error `E_ALMACEN_NO_DISPONIBLE`; sin cambios

Scenario: AC-005-14 — mismo envío repetido [REQ-F-003 AC9]
  Given "lucia" reservó "Piolet" de 2026-12-05 a 2026-12-07
  When repite el mismo envío
  Then "Mis reservas" muestra un solo "Piolet" esas fechas
  And sin unidad libre ve `E_SIN_UNIDADES`: "No hay unidades libres esas fechas"
