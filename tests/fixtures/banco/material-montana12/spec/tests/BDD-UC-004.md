# BDD-UC-004 — Cambiar contraseña provisional

> Refs: UC-004; REQ-F-002; INV-SOC-002, INV-SOC-006. Convention: Marta ("marta@club.test") tiene la provisional "Provisional1".

Feature: Cambiar contraseña — Como socio quiero elegir mi contraseña para usar la web

Scenario: AC-004-01 — primer acceso [REQ-F-002 AC4]
  When Marta entra con su contraseña provisional
  Then ve "Elige una contraseña nueva" en Cambiar contraseña

Scenario: AC-004-02 — no puede continuar [REQ-F-002 AC4]
  Given Marta no ha cambiado la contraseña
  When intenta abrir "/mis-reservas"
  Then ve "Elige una contraseña nueva" en Cambiar contraseña

Scenario: AC-004-03 — contraseña corta [REQ-F-002 AC4]
  When Marta envía "corta"
  Then error `E_CONTRASENA_CORTA` y ve "La contraseña debe tener al menos 8 caracteres" en Cambiar contraseña

Scenario: AC-004-04 — cambio correcto
  When Marta envía una contraseña de 8 caracteres o más
  Then se muestra su página de socio y la cuenta queda Activa

Scenario: AC-004-05 — sin sesión
  When un visitante envía una contraseña nueva
  Then ve el formulario "Entrar" y no cambia nada

Scenario: AC-004-06 — replay
  Given Marta ya cambió la contraseña
  When envía de nuevo la misma contraseña
  Then no hay duplicados y la contraseña vigente es la enviada
