# Questions — spec-auditor

<!-- Vista generada desde questions-spec-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role spec-auditor`. -->

## Q-spec-auditor-001 [ANSWERED] skill=sdd-spec-auditor context=CON-001 spec/contracts/PERMISSIONS-MATRIX.md:7 tema=actor-operaciones-internas
Question: API-003-03 y API-003-05 tienen actor 'sistema' pero la matriz de permisos las da al encargado y no hay fila 'sistema'.
Para el cliente: ¿Las operaciones automáticas de multas y no recogidas las dispara solo el sistema, o también el encargado a mano?
Options:
  A) Solo el sistema: añadir fila 'sistema' y quitarlas del encargado (recommended)
     efecto: ninguno
  B) También el encargado: cambiar el actor en los contratos y añadir E_ACCESO_NO_PERMITIDO
     efecto: ninguno
Blocks: CON-001
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)

## Q-spec-auditor-002 [ANSWERED] skill=sdd-spec-auditor context=CON-002 spec/nfr/SECURITY.md:9 tema=sesion-y-rol-junta
Question: SPEC-SEC-005 dice que ninguna escritura admite la junta, pero comprobarSesion y cerrarSesion escriben y admiten a cualquier rol.
Para el cliente: ¿La junta puede cerrar su propia sesión y mantenerla activa aunque sea de solo lectura?
Options:
  A) Sí: las operaciones de sesión quedan exentas de INV-SEC-002 y SPEC-SEC-005 (recommended)
     efecto: ninguno
  B) No: restringir el rol de esas operaciones
     efecto: ninguno
Blocks: CON-002
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)
