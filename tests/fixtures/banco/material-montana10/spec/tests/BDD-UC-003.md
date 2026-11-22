# BDD-UC-003 — Reservar material

> Refs: UC-003; REQ-F-003; INV-RES-001..005.

Feature: Reservar material

Background:
  Given hoy es 2026-12-01 y el socio tiene sesión

Scenario: AC-003-01 — creada [REQ-F-003 AC1]
  Given 3 "Piolet", ninguno reservado 2026-12-05..2026-12-07
  When "lucia@club.es" reserva "Piolet" 2026-12-05..2026-12-07
  Then ve en Mis reservas "Reserva creada: Piolet del 2026-12-05 al 2026-12-07"

Scenario: AC-003-02 — repetición [REQ-F-003 AC2]
  Given la misma reserva existe
  When se envía de nuevo
  Then Mis reservas tiene una sola reserva de "Piolet" esas fechas

Scenario: AC-003-03 — sin unidades [REQ-F-003 AC3]
  Given 2 "Tienda" reservadas 2026-12-05..2026-12-07
  When "pablo@club.es" reserva "Tienda" el 2026-12-06
  Then `E_SIN_UNIDADES_LIBRES`: "No quedan unidades libres de Tienda esas fechas"

Scenario: AC-003-04 — días libres [REQ-F-003 AC4]
  Given 2 "Tienda", una reservada 2026-12-05..2026-12-06
  When "pablo@club.es" reserva "Tienda" 2026-12-07..2026-12-08
  Then "Reserva creada: Tienda del 2026-12-07 al 2026-12-08"

Scenario: AC-003-05 — pasado [REQ-F-003 AC5]
  When reserva "Casco" desde 2026-11-30
  Then `E_FECHA_PASADA`: "Las fechas no pueden estar en el pasado"

Scenario: AC-003-06 — invertidas [REQ-F-003 AC6]
  When reserva "Cuerda" 2026-12-10..2026-12-09
  Then `E_FECHAS_INVERTIDAS`: "La fecha final no puede ser anterior a la inicial"

Scenario: AC-003-07 — muy larga [REQ-F-003 AC7]
  When reserva "Cuerda" 2026-12-10..2026-12-25
  Then `E_RESERVA_MUY_LARGA`: "Máximo 14 días por reserva"

Scenario: AC-003-08 — multa 4 € [REQ-F-003 AC8]
  Given "lucia@club.es" con multa de 4 €
  When reserva "Casco"
  Then `E_MULTA_PENDIENTE`: "Tienes una multa pendiente de 4 €. Págala al encargado para poder reservar"

Scenario: AC-003-09 — multa 2 € [REQ-F-003 AC9]
  Given "pablo@club.es" con multa de 2 €
  When reserva "Casco"
  Then "Tienes una multa pendiente de 2 €. Págala al encargado para poder reservar"

Scenario: AC-003-10 — última unidad [REQ-F-003 AC10]
  Given 1 "Crampones" libre y dos socios envían a la vez
  Then solo se crea una; la otra ve "No quedan unidades libres de Crampones esas fechas"

Scenario: AC-003-11 — rol sin permiso
  When el encargado reserva "Casco"
  Then `E_SIN_PERMISO`

Scenario: AC-003-12 — tipo inválido
  When reserva "Mochila"
  Then `E_TIPO_INVALIDO`
