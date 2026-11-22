# Questions — security-auditor

<!-- Vista generada desde questions-security-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role security-auditor`. -->

## Q-security-auditor-001 [ANSWERED] skill=sdd-security-auditor context=spec/domain/05-INVARIANTS.md INV-SOC-009, INV-RES-011; ADR-003; RN-005 (COMPLY-001) tema=conservacion-datos-socios-de-baja
Question: La cuenta de un socio dado de baja (nombre, correo, hash) se conserva para siempre (ADR-003, RN-005) y RETENTION_YEARS solo depura reservas, préstamos y multas. Se pide un plazo para los datos personales de la cuenta de baja o confirmar que se conservan indefinidamente.
Para el cliente: Cuando un socio se da de baja, ¿su nombre y correo deben borrarse pasado un tiempo o se guardan siempre?
Options:
  A) Anonimizar nombre y correo de la cuenta de baja al cumplirse RETENTION_YEARS desde su último registro; el correo sigue sin reutilizarse (hash) (recommended)
     efecto: ninguno
     cliente: Se borran sus datos personales a los 3 años de la baja
  B) Conservar la cuenta de baja indefinidamente y documentarlo como excepción
     efecto: req-change
     cliente: Se guardan siempre, y queda escrito el motivo
  C) Borrar nombre y correo en el momento de la baja
     efecto: req-change
     cliente: Se borran al dar de baja
Blocks: ninguno
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-22)
