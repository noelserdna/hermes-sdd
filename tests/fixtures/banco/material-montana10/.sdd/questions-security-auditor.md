# Questions — security-auditor

<!-- Vista generada desde questions-security-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role security-auditor`. -->

## Q-security-auditor-001 [ANSWERED] skill=sdd-security-auditor context=COMPLY-001 · spec/domain/02-ENTITIES.md ENT-001 · spec/nfr/LIMITS.md LIM-004 tema=datos-socio-tras-baja
Question: La retención de 2 años solo cubre préstamos y multas; nada dice cuánto se conservan nombre, correo y hash de una cuenta en Baja (RGPD art. 5.1.e y 17).
Para el cliente: Cuando un socio se da de baja, ¿se borran sus datos personales (nombre y correo) o se guardan para siempre?
Options:
  A) Se borran nombre y correo de la cuenta en Baja al cerrarse su último préstamo o multa, o a los RETENTION_YEARS años, lo que ocurra después (recommended)
     efecto: ninguno
     cliente: Se borran cuando ya no hacen falta para préstamos y multas
  B) Se conservan indefinidamente
     efecto: ninguno
     cliente: Se guardan siempre, aunque el socio se haya ido
Blocks: COMPLY-001
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)

## Q-security-auditor-002 [ANSWERED] skill=sdd-security-auditor context=AUTH-001 · spec/contracts/API-acceso.md API-001-03 · requirements/REQUIREMENTS.md REQ-F-002 tema=alta-cuentas-encargado-junta
Question: Solo existe crearSocio (rol socio); nada dice cómo nacen las cuentas de encargado y junta ni quién las gestiona.
Para el cliente: ¿Cómo se crean las cuentas del encargado y de la junta, y quién puede cambiarles la contraseña?
Options:
  A) Las cuentas encargado y junta las crea quien despliega la web con contraseña de un solo uso a cambiar al primer acceso; el encargado no restablece ni da de baja cuentas encargado o junta (recommended)
     efecto: ninguno
     cliente: Las deja preparadas quien instala la web; el encargado solo gestiona socios
  B) El encargado gestiona también las cuentas de encargado y junta
     efecto: ninguno
     cliente: El encargado puede crear y cambiar cualquier cuenta
Blocks: AUTH-001
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)
