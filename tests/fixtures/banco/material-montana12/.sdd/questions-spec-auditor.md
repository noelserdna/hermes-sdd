# Questions — spec-auditor

<!-- Vista generada desde questions-spec-auditor.json por `sdd questions`: no se edita a mano (se regenera). Pregunta nueva: `sdd questions add --role spec-auditor`. -->

## Q-spec-auditor-001 [ANSWERED] skill=sdd-spec-auditor context=spec/domain/05-INVARIANTS.md:11 vs spec/tests/BDD-UC-001.md:31 tema=limite-caducidad-sesion
Question: INV-SOC-005 caduca la sesión con `ahora − última actividad > 30 min` (con exactamente 30 min sigue viva) pero AC-001-06 pide ver Entrar con 30 minutos sin actividad; PROP-005 dice viva si ≤ SESSION_IDLE_MINUTES. El borde exacto se contradice.
Para el cliente: Si un socio lleva exactamente 30 minutos sin tocar nada, ¿la sesión sigue abierta o ya se ha cerrado?
Options:
  A) Con exactamente 30 min sigue viva; caduca al pasar de 30 (cambiar el ejemplo de AC-001-06 a 31 min) (recommended)
     efecto: ninguno
     cliente: Se cierra al pasar de 30 minutos
  B) Con exactamente 30 min ya caducó (cambiar INV-SOC-005 y PROP-005 a ≥)
     efecto: ninguno
     cliente: Se cierra al cumplir los 30 minutos
Blocks: CON-002
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-22)

## Q-spec-auditor-002 [ANSWERED] skill=sdd-spec-auditor context=spec/use-cases/UC-006-baja-socio.md:46,50 vs spec/CLARIFICATIONS.md RN-012/RN-027 tema=baja-repetida
Question: UC-006 E4 trata la baja repetida de una cuenta ya de baja como replay sin código y sin cambios (RN-012, ADR-005), pero RN-027 y UC-006:50 exigen E_SOCIO_NO_ENCONTRADO. Dos reglas dan resultados distintos para la misma acción.
Para el cliente: Si el encargado da de baja otra vez a un socio que ya está de baja, ¿qué debe ver?
Options:
  A) Aviso de que ya estaba de baja, sin error (replay, ADR-005); RN-027 solo para ids inexistentes (recommended)
     efecto: ninguno
     cliente: Un aviso de que ya estaba de baja
  B) Error E_SOCIO_NO_ENCONTRADO también para baja repetida (RN-027 tal cual)
     efecto: ninguno
     cliente: Un mensaje de error de socio no encontrado
Blocks: CON-001
Answer: A — opción recomendada, aceptada por Jev (regla) (Agente automático (modo auto)) (2026-11-22)
