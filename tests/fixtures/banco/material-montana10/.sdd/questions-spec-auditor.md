# Questions — spec-auditor

<!-- Vista generada desde questions-spec-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role spec-auditor`. -->

## Q-spec-auditor-001 [ANSWERED] skill=sdd-spec-auditor context=SIL-002 · spec/use-cases/UC-002-gestionar-socios.md:40 tema=baja-socio-sesion-abierta
Question: UC-002 no define qué pasa con una sesión abierta de una cuenta dada de baja, ni si se puede restablecer la contraseña de una cuenta en Baja; INV-ACC-006 solo impide iniciar sesión.
Para el cliente: Si el encargado da de baja a un socio que tiene la sesión abierta, ¿debe dejar de poder usar la web en ese mismo momento?
Options:
  A) La baja cierra las sesiones abiertas de la cuenta y no se restablece una cuenta en Baja (recommended)
     efecto: ninguno
     cliente: Sí, deja de poder usar la web al instante
  B) La sesión abierta sigue valiendo hasta que caduque
     efecto: ninguno
     cliente: No, puede seguir hasta que se le cierre la sesión
Blocks: SIL-002
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)
