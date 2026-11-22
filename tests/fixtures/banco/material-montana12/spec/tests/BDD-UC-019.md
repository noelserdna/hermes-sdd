# BDD-UC-019 — Depurar historial antiguo

> Refs: UC-019; REQ-NF-003; INV-RES-011. Convention: la depuración se ejecuta con hoy = 2026-11-22.

Feature: Depurar historial — As the sistema I want borrar registros antiguos so that se cumpla la retención

Background:
  Given hoy es 2026-11-22

Scenario: AC-019-01 — borra lo antiguo [REQ-NF-003 AC2]
  Given un préstamo terminó el 2023-11-01 y otro el 2025-01-10
  When se ejecuta la depuración
  Then el préstamo del 2023-11-01 ya no existe
  And el préstamo del 2025-01-10 sigue existiendo

Scenario: AC-019-02 — límite exacto
  Given un préstamo terminó el 2023-11-22
  When se ejecuta la depuración
  Then el préstamo sigue existiendo

Scenario: AC-019-03 — replay
  Given la depuración ya se ejecutó hoy
  When se ejecuta otra vez
  Then no se borra nada y los datos no cambian
