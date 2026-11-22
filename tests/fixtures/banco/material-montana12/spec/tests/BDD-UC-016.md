# BDD-UC-016 — Retirar unidades rotas

> Refs: UC-016; REQ-F-007; INV-MAT-001, INV-MAT-002. Convention: "sin cambios" = totales de "Material" iguales.

Feature: Retirar unidades — As an encargado I want dar de baja unidades rotas so that el inventario sea cierto

Background:
  Given el encargado tiene sesión abierta

Scenario: AC-016-01 — baja correcta [REQ-F-007 AC3]
  Given "Cuerda" tiene 6 unidades sin préstamos ni reservas
  When retira 1 unidad rota
  Then ve "Cuerda: 5 unidades" en "Material"

Scenario: AC-016-02 — unidades necesarias [REQ-F-007 AC4]
  Given "Tienda" tiene 2 unidades, ambas reservadas el 2026-12-06
  When retira 1 unidad
  Then error `E_BAJA_UNIDADES_NECESARIAS`: "No se puede dar de baja: hay 2 unidades de Tienda necesarias el 2026-12-06"
  And ve "Tienda: 2 unidades"

Scenario: AC-016-03 — baja repetida [REQ-F-007 AC5]
  Given "Cuerda" tuvo 1 unidad y el encargado la retiró (stock 0)
  When envía la misma baja otra vez
  Then error `E_BAJA_UNIDADES_INSUFICIENTES`: "No hay tantas unidades para dar de baja"
  And ve "Cuerda: 0 unidades"

Scenario: AC-016-04 — cantidad inválida
  When retira 0 unidades de Cuerda
  Then error `E_CANTIDAD_INVALIDA` y sin cambios

Scenario: AC-016-05 — rol no permitido
  When un socio intenta retirar 1 unidad de Cuerda
  Then error `E_PAGINA_PROHIBIDA` o `E_ACCESO_DENEGADO` y sin cambios
