# BDD-UC-004 — Restablecer contraseña y dar de baja socio

> Refs: UC-004; REQ-F-002; INV-ACC-002, INV-LOA-004. Convention: "sin cambios" = cuenta y reservas como estaban.

Feature: Cuentas — Como encargado quiero restablecer contraseñas y dar de baja para mantener los accesos

Background:
  Given sesión del encargado "marta@club.test"

Scenario: AC-004-01 — Restablecer contraseña [REQ-F-002 AC4]
  Given "Lucía Gil" olvidó su contraseña
  When fija la nueva "Hielo2026x"
  Then el usuario ve "Contraseña restablecida"
  And Lucía entra con la nueva y no con la antigua

Scenario: AC-004-02 — Dar de baja [REQ-F-002 AC5]
  Given "Pablo Ruiz" tiene 1 reserva futura de "Casco 2"
  When lo da de baja
  Then el usuario ve "Pablo Ruiz" marcado "Baja"
  And la reserva queda Cancelada y "Casco 2" libre

Scenario: AC-004-03 — Contraseña corta
  When fija la contraseña "corta1"
  Then error `E_CONTRASENA_CORTA` y la anterior sigue vigente

Scenario: AC-004-04 — Socio inexistente
  When restablece a un socio que no existe
  Then error `E_SOCIO_NO_ENCONTRADO` y nada cambia

Scenario: AC-004-05 — Material sin devolver [REQ-F-002 AC6]
  Given "Pablo Ruiz" tiene una unidad Entregado sin devolver
  When intenta darlo de baja
  Then error `E_SOCIO_CON_MATERIAL`
  And el usuario ve "No se puede dar de baja: tiene material sin devolver" y sigue Activa

Scenario: AC-004-06 — Socio no autorizado
  Given sesión de un socio
  When intenta dar de baja a otro socio
  Then error `E_ACCESO_NO_PERMITIDO` y nada cambia

Scenario: AC-004-07 — Almacén caído
  Given el almacén no está disponible
  When da de baja a "Pablo Ruiz"
  Then error `E_ALMACEN_NO_DISPONIBLE` y sigue Activa

Scenario: AC-004-08 — Restablecer repetido
  Given ya fijó "Hielo2026x" a Lucía
  When la fija otra vez
  Then el usuario ve "Contraseña restablecida" y solo vale "Hielo2026x"

Scenario: AC-004-09 — Baja repetida
  Given "Pablo Ruiz" ya está en Baja
  When lo da de baja otra vez
  Then sigue en "Baja" sin cambios
