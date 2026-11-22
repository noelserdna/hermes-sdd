# BDD-UC-002 — Salir

> Refs: UC-002; REQ-F-001; INV-SOC-005, INV-SEC-001. Convention: "sin datos privados" = ninguna reserva, multa ni nombre de socio en pantalla.

Feature: Salir — Como usuario quiero salir para que nadie vea mis datos

Scenario: AC-002-01 — salir [REQ-F-001 AC7]
  Given un usuario con sesión
  When pulsa "Salir"
  Then ve el formulario "Entrar"

Scenario: AC-002-02 — volver atrás [REQ-F-001 AC7]
  Given un usuario que acaba de pulsar "Salir"
  When vuelve atrás con el navegador
  Then ve "Entrar", sin ninguna reserva, multa ni nombre de socio en pantalla

Scenario: AC-002-03 — replay de salir
  Given una sesión ya cerrada
  When pulsa "Salir" otra vez
  Then ve el formulario "Entrar" y no cambia nada
