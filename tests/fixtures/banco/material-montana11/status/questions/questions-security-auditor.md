# Questions — security-auditor

<!-- Vista generada desde questions-security-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role security-auditor`. -->

## Q-security-auditor-001 [ANSWERED] skill=sdd-security-auditor context=AUTH-004 spec/contracts/API-acceso.md API-001-06 tema=cambio-contrasena-tras-restablecer
Question: API-001-06 restablecerContrasena: el encargado fija la contraseña nueva y por tanto la conoce; no hay obligación de cambiarla ni vía para que el socio la cambie por sí mismo.
Para el cliente: Cuando el encargado restablece la contraseña de un socio, ¿debe el socio cambiarla al entrar, o puede seguir con la que le dio el encargado?
Options:
  A) Mantener como está: el socio conserva la contraseña fijada por el encargado (sin cambio de requisitos) (recommended)
     efecto: ninguno
     cliente: Se queda igual; el encargado conoce la contraseña hasta que se vuelva a restablecer
  B) Añadir que el socio cambie su propia contraseña (nuevo caso de uso)
     efecto: req-change
     cliente: El socio podrá poner su propia contraseña; es una función nueva
Blocks: AUTH-004
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-21)
