# Security Audit Baseline — material-montana11

> **Audit:** SECURITY-AUDIT-v1.0 · **Date:** 2026-11-21 · **Specs:** `spec/` · **Marco:** OWASP ASVS 4.0.3 + CWE · **Modo:** arnés (sin persona)
> **Findings:** 16 · Crítico (P0) 0 · Alto (P1) 3 · Medio (P2) 12 · Bajo (P3) 1 · excluded by baseline 0
> **Delta vs none (first audit):** new 16 · persistent 0 · regression 0
> **Global score:** 87.3 · **Grade:** B · **owasp_coverage:** 90 % (V12 sin elemento aplicable ni fila "Not applicable")

## Resumen

La base es sólida para un sistema pequeño: roles por operación (INV-ACC-007, matriz), propiedad de los datos (INV-SEC-001/002), hash con sal (ADR-003), bloqueo y caducidad con valores (`LOGIN_MAX_FAILURES`=5, `LOCK_MINUTES`=15, `SESSION_IDLE_MINUTES`=30), mensaje único para correo inexistente o baja (RN-008, INV-ACC-006) y sesiones invalidadas al dar de baja o restablecer (RN-013). No hay P0. Los huecos importantes son: identificador de sesión sin requisitos, ausencia de protección en tránsito y ausencia de registro de eventos de seguridad.

## Scorecard

| Dim | Dimensión | Peso | Hallazgos (C/A/M/B) | Score |
|---|---|---|---|---|
| D1 | Authentication | 15 % | 0/1/3/0 | 70 |
| D2 | Authorization | 15 % | 0/0/1/0 | 95 |
| D3 | Data Protection | 15 % | 0/1/1/0 | 80 |
| D4 | Input Validation | 10 % | 0/0/1/0 | 95 |
| D5 | Cryptographic Rigor | 10 % | 0/0/1/0 | 95 |
| D6 | Incident Readiness | 10 % | 0/1/0/1 | 83 |
| D7 | Regulatory Compliance | 10 % | 0/0/2/0 | 90 |
| D8 | Security Test Coverage | 5 % | 0/0/1/0 | 95 |
| D9 | Threat Model Coverage | 5 % | 0/0/1/0 | 95 |
| D10 | Security Decision Documentation | 5 % | 0/0/1/0 | 95 |
| | **Global** | | | **87.3 (B)** |

Dimensiones más débiles: D1 Authentication (70), D3 Data Protection (80), D6 Incident Readiness (83).

## Inventario

Documentos de seguridad: `spec/nfr/SECURITY.md` (6 filas SPEC-SEC), `spec/contracts/PERMISSIONS-MATRIX.md`, invariantes INV-ACC-001..009 e INV-SEC-001..003, ADR-003 (hash) y ADR-005 (escrituras atómicas), 4 contratos API (31 operaciones), 16 BDD, PROPERTY-TESTS (PROP-009 de aislamiento). No hay runbooks ni integraciones externas ni subida de ficheros.

Superficie: 1 operación pública (API-001-01), 29 autenticadas, 2 internas ("sistema"). Datos sensibles: correo, nombre, hash de contraseña, reservas, multas. Frontera: navegador de cada dispositivo → almacén único compartido (ADR-001).

## Findings

### Alto (P1)

#### AUTH-001: El identificador de sesión no tiene requisitos de imprevisibilidad ni vida máxima

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V3.2.1, V3.3.2 (4.0.3) |
| **CWE** | CWE-330, CWE-613 |
| **Where** | `spec/domain/02-ENTITIES.md` ENT-005; `spec/domain/05-INVARIANTS.md` INV-ACC-005 |
| **Threat** | Un atacante puede adivinar o reutilizar un identificador de sesión (o mantener una sesión robada viva indefinidamente con actividad periódica) porque ENT-005 solo dice `id: string` y la caducidad es solo por inactividad |
| **What** | Sin requisito de aleatoriedad del id ni de caducidad absoluta; cada operación renueva la actividad sin tope |
| **Fix** | Especificar que el id no es predecible ni derivable de datos de la cuenta, y si existe una duración máxima de sesión (valor en VALUE-REGISTRY) y qué pasa con varias sesiones simultáneas de una cuenta |
| **Evidence** | ENT-005 (02-ENTITIES.md); INV-ACC-005; API-001-03 (renueva actividad) |
| **Existing mitigation** | parcial: caducidad por inactividad 30 min, invalidación en baja/restablecimiento (INV-ACC-008) |

#### DATA-001: Sin requisito de protección de las credenciales y datos en tránsito

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-04: Unprotected data |
| **OWASP ASVS** | V8.3.1, V9.1.1 (4.0.3; V9 fuera de la tabla del método) |
| **CWE** | CWE-319 |
| **Where** | `spec/nfr/SECURITY.md` (sin fila de transporte); `spec/contracts/API-acceso.md` API-001-01 |
| **Threat** | Un atacante en la red de un dispositivo del socio puede leer correo y contraseña, o el identificador de sesión, porque ninguna medida exige canal protegido |
| **What** | REQ-C-003 hace el almacén compartido entre dispositivos y API-001-01 recibe la contraseña en claro, pero SECURITY.md no tiene objetivo de transporte; "Transporte" remite a `design/OPERATION-MAPPING.md`, que no existe aún |
| **Fix** | Añadir a SECURITY.md un objetivo medible: toda operación, y en especial API-001-01 y la sesión, solo por canal protegido; qué se hace con una petición sin él |
| **Evidence** | REQ-C-003; API-001-01; SECURITY.md SPEC-SEC-001..006 |
| **Existing mitigation** | none |

#### INCIDENT-001: Sin registro de eventos de seguridad ni de acciones privilegiadas

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-07: Incomplete incident response |
| **OWASP ASVS** | V7.1.1, V7.2.1 (4.0.3) |
| **CWE** | CWE-778 |
| **Where** | `spec/nfr/SECURITY.md` SPEC-SEC-006; `spec/contracts/EVENTS-sistema.md` |
| **Threat** | Un encargado o un atacante con una cuenta puede restablecer contraseñas, dar de baja socios o marcar multas pagadas sin dejar rastro atribuible, porque no hay lista de eventos auditables |
| **What** | SPEC-SEC-006 habla de "registros" solo para excluir contraseñas; no define qué se registra (fallos de entrada, bloqueos, restablecimientos, bajas, accesos denegados, cambios de multa), con qué campos, ni su conservación |
| **Fix** | Definir la taxonomía mínima de eventos de seguridad, sus campos, quién puede leerlos y su plazo de conservación |
| **Evidence** | SPEC-SEC-006; API-001-06, API-001-07, API-003-08 (operaciones privilegiadas); RN-007 (conservación) |
| **Existing mitigation** | parcial: SPEC-SEC-006 evita contraseñas en registros |

### Medio (P2)

#### AUTH-002: `E_CUENTA_BLOQUEADA` revela que el correo existe

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-02 |
| **OWASP ASVS** | V2.2.1 (4.0.3) · **CWE** CWE-204 |
| **Where** | `spec/contracts/API-acceso.md` API-001-01; RN-008 en `spec/CLARIFICATIONS.md` |
| **Threat** | Un atacante puede enumerar correos de socios enviando 5 intentos erróneos: solo las cuentas existentes pasan a `E_CUENTA_BLOQUEADA`; el resto sigue en `E_CREDENCIALES_INVALIDAS` (RN-008, sin contador) |
| **What** | RN-008 oculta la existencia en un intento, pero el bloqueo la delata |
| **Fix** | Decidir y especificar si los correos inexistentes responden de forma indistinguible al bloqueo |
| **Evidence** | INV-ACC-004; RN-008; API-001-01 errores |
| **Existing mitigation** | parcial: mensaje único por intento (RN-008) |

#### AUTH-003: El bloqueo por cuenta permite dejar fuera a un socio a voluntad

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-02 |
| **OWASP ASVS** | V2.2.1 · **CWE** CWE-307 |
| **Where** | `spec/domain/05-INVARIANTS.md` INV-ACC-004 |
| **Threat** | Cualquiera que conozca el correo de un socio puede bloquearlo `LOCK_MINUTES` repetidamente (p. ej. antes de una salida) con 5 intentos, porque el bloqueo no depende del origen y no hay aviso al encargado |
| **What** | La defensa contra fuerza bruta es la misma que habilita la denegación de servicio; no hay límite por origen ni vía de desbloqueo |
| **Fix** | Especificar si el encargado puede desbloquear y si los bloqueos repetidos se notifican (evento de seguridad) |
| **Evidence** | INV-ACC-004; UC-001; API-001-01 público |
| **Existing mitigation** | parcial: bloqueo temporal de 15 min |

#### AUTH-004: El encargado fija y conoce la contraseña nueva; no hay cambio por el socio

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-02 |
| **OWASP ASVS** | V2.1.3, V2.5.1 · **CWE** CWE-640 |
| **Where** | `spec/contracts/API-acceso.md` API-001-06; `spec/adr/ADR-003-contrasenas-con-hash.md` (consecuencias) |
| **Threat** | El encargado (o quien use su sesión) puede entrar como un socio con la contraseña que le fijó, porque no hay cambio obligatorio ni función de cambio propio |
| **What** | Decisión de negocio, no un defecto claro (ADR-003 acepta "restablecer es la única vía") |
| **Fix** | Ver pregunta Q-security-auditor-001 |
| **Evidence** | API-001-06; ADR-003; matriz de permisos |
| **Existing mitigation** | parcial: sesiones del socio invalidadas (INV-ACC-008) |

#### AUTHZ-001: Operaciones internas sin fila de rol propia

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new (relacionado con CON-001 de AUDIT-BASELINE) · **Category** SEC-CAT-03 |
| **OWASP ASVS** | V4.1.3 · **CWE** CWE-862 |
| **Where** | `spec/contracts/PERMISSIONS-MATRIX.md`; `spec/contracts/API-prestamos.md` API-003-03, API-003-05 |
| **Threat** | Un socio podría invocar API-003-05 (multa) o API-003-03 si se exponen, porque el actor "sistema" no tiene fila y la matriz solo las da al encargado |
| **What** | No queda dicho si son alcanzables desde fuera ni qué error recibe otro rol |
| **Fix** | Declarar que las operaciones internas no son invocables por ningún rol, o su rol y su error (depende de Q-spec-auditor-001) |
| **Evidence** | PERMISSIONS-MATRIX; API-003-03/05; INV-ACC-007 |
| **Existing mitigation** | parcial: INV-ACC-007 exige rol por operación |

#### DATA-002: Datos personales en el almacén sin requisito de protección

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-04 |
| **OWASP ASVS** | V8.3.4, V6.1.1 · **CWE** CWE-311 |
| **Where** | `spec/domain/02-ENTITIES.md` ENT-001; `spec/adr/ADR-001-almacen-unico-compartido.md`; REQ-NF-001 |
| **Threat** | Quien acceda al fichero o copia del almacén puede leer nombre, correo e historial porque solo la contraseña tiene protección especificada |
| **What** | No hay campos marcados como sensibles ni requisito de acceso al almacén ni de copias de seguridad |
| **Fix** | Especificar qué campos son personales, quién puede acceder al almacén y el tratamiento de las copias |
| **Evidence** | ENT-001; ADR-001; REQ-NF-001; SPEC-SEC-003 (solo contraseñas) |
| **Existing mitigation** | parcial: solo hash de contraseña |

#### INPUT-001: Entradas de texto sin longitud máxima

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-05 |
| **OWASP ASVS** | V5.1.3, V2.1.2 · **CWE** CWE-20, CWE-400 |
| **Where** | `spec/contracts/API-acceso.md` API-001-04; `spec/nfr/LIMITS.md` |
| **Threat** | Un encargado o cliente puede enviar nombre o contraseña de tamaño arbitrario y degradar el servicio (el hash lento sobre una contraseña enorme) porque solo hay mínimo de contraseña |
| **What** | `nombre` no tiene tipo de valor; ninguna entrada tiene longitud máxima ni se define el escape en pantalla (inyección de texto en listados) |
| **Fix** | Añadir longitudes máximas a LIMITS.md y a los VO, y qué error se devuelve |
| **Evidence** | API-001-01, API-001-04, API-001-06; LIMITS.md |
| **Existing mitigation** | parcial: VO de correo y contraseña mínima |

#### CRYPTO-001: ADR-003 no nombra el algoritmo ni sus parámetros

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-06 |
| **OWASP ASVS** | V2.4.1, V6.2.2 · **CWE** CWE-916 |
| **Where** | `spec/adr/ADR-003-contrasenas-con-hash.md` |
| **Threat** | Un implementador puede elegir un hash demasiado barato y una fuga del almacén permitiría recuperar contraseñas porque la ADR solo dice "algoritmo lento de contraseñas" |
| **What** | Sin algoritmo, coste mínimo ni política de rehash al subir el coste |
| **Fix** | Nombrar la familia admitida y su coste mínimo medible, y si se rehace el hash al entrar |
| **Evidence** | ADR-003; INV-ACC-003; SPEC-SEC-003 |
| **Existing mitigation** | parcial: hash con sal, lento |

#### COMPLY-001: La retención de `RETENTION_YEARS` no tiene mecanismo

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new (ya señalado como INV-003 en AUDIT-BASELINE) · **Category** SEC-CAT-08 |
| **OWASP ASVS** | V8.3.7 · **CWE** CWE-359 |
| **Where** | `spec/nfr/LIMITS.md` SPEC-LIM-003; `spec/CLARIFICATIONS.md` RN-010; `spec/DERIVED-SPECS.md` |
| **Threat** | Los datos de socios se conservarían sin límite porque la purga está **[PENDING REQ]**; RGPD art. 5.1.e (limitación del plazo) |
| **What** | El plazo se declara pero nada lo aplica |
| **Fix** | Resolver RN-010 por la vía de requisitos (`/sdd-req-change`) |
| **Evidence** | LIMITS.md; RN-010; DERIVED-SPECS.md |
| **Existing mitigation** | none (decisión pendiente, no se reabre aquí) |

#### COMPLY-002: Sin derechos del interesado (acceso, supresión)

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-08 |
| **OWASP ASVS** | V8.3.2 · **CWE** CWE-359 |
| **Where** | `spec/use-cases/` (sin UC); UC-004; RN-007 |
| **Threat** | Un socio no puede ejercer acceso (RGPD art. 15) ni supresión (art. 17) porque la baja conserva el historial (RN-007) y ningún UC cubre esas peticiones |
| **What** | Decisión consciente de conservación para la junta, pero sin base jurídica ni vía de petición documentadas |
| **Fix** | Decidir si el club atiende estos derechos fuera del sistema (y dejarlo escrito) o dentro |
| **Evidence** | RN-007; UC-004; REQ-NF-001 |
| **Existing mitigation** | parcial: acceso restringido a dueño, encargado y junta |

#### STEST-001: Sin prueba que recorra todas las operaciones por rol

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-09 |
| **OWASP ASVS** | V4.1.1 · **CWE** CWE-862 |
| **Where** | `spec/tests/PROPERTY-TESTS.md` |
| **Threat** | Una operación nueva sin comprobación de rol pasaría inadvertida porque solo PROP-009 cubre lectura ajena; INV-ACC-007 e INV-SEC-002 solo se prueban escenario a escenario |
| **What** | Falta una propiedad "para toda operación y rol fuera de la matriz, error de acceso" |
| **Fix** | Añadir propiedades para INV-ACC-007 (matriz completa) e INV-SEC-002 (junta nunca escribe) |
| **Evidence** | PROPERTY-TESTS.md; PERMISSIONS-MATRIX; BDD-UC-* |
| **Existing mitigation** | parcial: escenarios negativos por UC |

#### THR-001: No hay modelo de amenazas ni fronteras de confianza

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-01 |
| **OWASP ASVS** | V1.1.2 · **CWE** CWE-1008 |
| **Where** | `spec/nfr/SECURITY.md` |
| **Threat** | Amenazas como fuerza bruta, enumeración, abuso del encargado o robo de sesión no se registran porque SECURITY.md lista objetivos sin amenazas ni frontera navegador-almacén |
| **What** | Cada medida existe de forma suelta; no hay mapa amenaza → medida |
| **Fix** | Añadir amenazas y fronteras a SECURITY.md con referencia a sus medidas |
| **Evidence** | SECURITY.md; ADR-001; REQ-C-003 |
| **Existing mitigation** | parcial: medidas SPEC-SEC-001..006 |

#### SADR-001: Decisiones de autenticación y sesión sin ADR

| Field | Value |
|---|---|
| **Severity** | Medio (P2) · **Status** new · **Category** SEC-CAT-10 (no relacionada con CAT-10 del spec-auditor) |
| **OWASP ASVS** | V1.2.1 · **CWE** CWE-1059 |
| **Where** | `spec/adr/` |
| **Threat** | Los compromisos de bloqueo por cuenta, caducidad por inactividad y transporte se pierden porque solo ADR-003 trata seguridad |
| **What** | Sin ADR para estrategia de sesión/bloqueo ni de transporte |
| **Fix** | Documentar esas decisiones con su compromiso (p. ej. bloqueo frente a DoS, AUTH-003) |
| **Evidence** | adr/ (5 ADR); INV-ACC-004/005 |
| **Existing mitigation** | parcial: valores en VALUE-REGISTRY |

### Bajo (P3)

#### INCIDENT-002: Sin runbook de respuesta

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) · **Status** new · **Category** SEC-CAT-07 |
| **OWASP ASVS** | V7.1.3 · **CWE** CWE-778 |
| **Where** | `spec/` (no existe `runbooks/`) |
| **Threat** | Ante una cuenta comprometida el club no tiene pasos escritos (restablecer, invalidar sesiones, revisar registro) |
| **What** | Solo documentación; las operaciones existen (API-001-06/07) |
| **Fix** | Especificar el procedimiento mínimo ante cuenta comprometida |
| **Evidence** | API-001-06, API-001-07; INV-ACC-008 |
| **Existing mitigation** | parcial: operaciones disponibles |

## Cobertura ASVS

V1 AUTH/THR/SADR · V2 INV-ACC-002/004 · V3 INV-ACC-005/008 · V4 matriz, INV-ACC-007, INV-SEC-001/002 · V5 VO · V6 ADR-003 · V7 SPEC-SEC-006 · V8 SPEC-SEC-001/003 · V12 sin elemento (no hay subida de ficheros; falta fila "Not applicable") · V13 contratos API.

## Handoff

Preguntas abiertas: Q-security-auditor-001 (AUTH-004). Los cambios en la especificación van por `/sdd-req-change`; ninguno se ha entregado todavía. AUTHZ-001 y COMPLY-001 se solapan con CON-001 e INV-003 de `audits/AUDIT-BASELINE.md`.

## Baseline

| ID | Severity | Status | Resolución |
|---|---|---|---|
| (16 hallazgos) | ver arriba | Open | — |
