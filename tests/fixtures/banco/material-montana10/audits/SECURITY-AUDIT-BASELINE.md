# Security Audit: material-montana10

> Date: 2026-11-21 · Spec version: spec/ (52eb422) · Security docs analysed: 14 · Total docs: 45 · OWASP ASVS 4.0.3

## Security Posture Scorecard

| # | Dimension | Score | Grade | Findings (C/H/M/L) |
|---|---|---|---|---|
| D1 | Authentication Completeness | 58 | C | 0/2/2/1 |
| D2 | Authorization | 80 | B | 0/1/1/0 |
| D3 | Data Protection | 90 | A | 0/0/2/0 |
| D4 | Input Validation | 95 | A | 0/0/1/0 |
| D5 | Cryptographic Rigor | 95 | A | 0/0/1/0 |
| D6 | Incident Readiness | 80 | B | 0/1/1/0 |
| D7 | Regulatory Compliance | 90 | A | 0/0/2/0 |
| D8 | Security Test Coverage | 95 | A | 0/0/1/0 |
| D9 | Threat Model Coverage | 95 | A | 0/0/1/0 |
| D10 | Security Decision Documentation | 98 | A | 0/0/0/1 |
| **GLOBAL** | Weighted average | **84.6** | **B** | **0/4/12/2** |

Dimensiones más débiles: D1 Autenticación y D2/D6. ASVS chapters assessed: V1-V8, V12, V13; con elemento de spec aplicable: V1, V2, V3, V4, V5, V6, V8, V13 (V7 registro y V12 ficheros: ninguno; no hay subidas) -> `owasp_coverage` 80%

## Summary by Category

| Category | Total | Crítico (P0) | Alto (P1) | Medio (P2) | Bajo (P3) |
|---|---|---|---|---|---|
| SEC-CAT-01 Threats without model | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-02 Incomplete authentication | 5 | 0 | 2 | 2 | 1 |
| SEC-CAT-03 Insufficient authorization | 2 | 0 | 1 | 1 | 0 |
| SEC-CAT-04 Unprotected data | 2 | 0 | 0 | 2 | 0 |
| SEC-CAT-05 Missing input validation | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-06 Weak/incomplete crypto | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-07 Incomplete incident response | 2 | 0 | 1 | 1 | 0 |
| SEC-CAT-08 Incomplete regulatory compliance | 2 | 0 | 0 | 2 | 0 |
| SEC-CAT-09 Missing security tests | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-10 Security decision without ADR | 1 | 0 | 0 | 0 | 1 |
| **TOTAL** | 18 | 0 | 4 | 12 | 2 |

## Baseline Delta

Compared against: N/A (first audit) - new 18 · persistent 0 · regression 0 · resolved since last run 0 · excluded by baseline 0

Alcance: `spec/`. Los borradores de `design/` (scrypt, cookie HttpOnly, HTTPS por proxy, Origin) se tomaron como mitigación parcial, no como contrato: por eso AUTH-003, DATA-001, CRYPTO-001 y SADR-001 bajan de gravedad pero siguen abiertos hasta que la spec los exija.
Decisiones respetadas (Principio 4): RN-023 (la junta ve la lista de socios con correo) y RN-005 (el bloqueo no se alarga) son reglas de CLARIFICATIONS.md y no se reportan. La baja con sesión abierta ya es Q-spec-auditor-001 y no se duplica.

## Threat Surface

| Surface | Elements | Covered | Uncovered |
|---|---|---|---|
| Operations / endpoints | 23 (API-001..004) | 21 con rol en matriz | API-003-07/08 (sistema) sin actor autenticable |
| Sensitive fields | 4 (hash, correo, nombre, sesión) | hash (SEC-001/002) | correo, nombre (logs, retención), sesión |
| External integrations | 0 (EVENTS: None) | n/a | n/a |
| Trust boundaries | 4 (navegador-API, API-almacén, planificador-API, red) | 1 (almacén en servidor, ADR-002) | 3 |

## Traceability

| Chain | Total | Complete | Incomplete |
|---|---|---|---|
| Security REQ / SEC row -> INV or ADR | 8 (REQ-NF-001, SEC-001..007) | 7 | 1 (SEC-006 solo revisión) |
| Security REQ / SEC row -> UC -> BDD | 8 | 6 | 2 (SEC-002, SEC-006 sin escenario propio) |
| Security ADR -> runbook | 0 | 0 | 0 (ningún ADR de seguridad aceptado; ver SADR-001, INCIDENT-002) |

## Findings by Category

### SEC-CAT-01: Threats without model

#### THR-001: Sin modelo de amenazas ni fronteras de confianza

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-01: Threats without model |
| **OWASP ASVS** | V1.1.2, V1.2.x (4.0.3) |
| **CWE** | CWE-1053 |
| **Where** | spec/ (sin documento de amenazas) |
| **Threat** | Los huecos AUTH/DATA pasan inadvertidos porque ninguna spec nombra actores hostiles ni fronteras (navegador, API, almacén, planificador) |
| **What** | Solo hay controles sueltos en SECURITY.md |
| **Fix** | Nombrar fronteras y amenazas principales y enlazarlas a SEC-NNN |
| **Evidence** | ADR-002; SECURITY.md; API-003-07/08 |
| **Existing mitigation** | partial: SECURITY.md |


### SEC-CAT-02: Incomplete authentication

#### AUTH-001: Alta de cuentas encargado y junta sin especificar

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.1.x, V2.5.x (4.0.3) |
| **CWE** | CWE-798 |
| **Where** | spec/contracts/API-acceso.md:API-001-03 |
| **Threat** | Un atacante puede entrar como encargado con credenciales por defecto porque ninguna spec dice cómo nacen esas cuentas |
| **What** | Solo existe crearSocio (rol socio); no hay origen ni contraseña inicial para encargado y junta, los roles con más poder |
| **Fix** | Especificar cómo se crean esas cuentas, que no hay credencial por defecto y quién puede cambiarlas (Q-security-auditor-002) |
| **Evidence** | API-001-03 (solo socio); REQ-F-002; ENT-001 (rol) |
| **Existing mitigation** | none |

#### AUTH-002: Restablecer contraseña no invalida las sesiones abiertas

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V3.3.x, V2.5.x (4.0.3) |
| **CWE** | CWE-613 |
| **Where** | spec/domain/05-INVARIANTS.md:INV-ACC-103 |
| **Threat** | Quien tiene una sesión robada la conserva tras el restablecimiento porque INV-ACC-103 solo sustituye el hash |
| **What** | Ninguna invariante dice qué pasa con las sesiones de la cuenta al restablecer (la baja con sesión abierta ya es Q-spec-auditor-001; no se duplica) |
| **Fix** | Especificar si restablecer cierra las sesiones de esa cuenta |
| **Evidence** | API-001-05 y UC-002 (restablecer); ENT-002 (sesión con cuentaId) |
| **Existing mitigation** | partial: INV-ACC-102 solo para Salir |

#### AUTH-003: Propiedades de la sesión y CSRF solo en borradores de diseño, no en la spec

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V3.2.1, V3.4.x (4.0.3) |
| **CWE** | CWE-330, CWE-352 |
| **Where** | spec/domain/02-ENTITIES.md:ENT-002 |
| **Threat** | Si el diseño cambia, un atacante podría adivinar una sesión o forzar operaciones del encargado desde otra web porque la spec no exige id impredecible ni protección de origen |
| **What** | ENT-002 solo dice id: string; SEC-004 solo cubre caducidad. design/TECHNICAL-DESIGN.md (id de 32 bytes, SameSite=Strict, Origin) lo cubre pero es borrador, no contrato |
| **Fix** | Subir a un control SEC las propiedades mínimas (id impredecible, renovado al entrar, rechazo de escrituras de otro origen) |
| **Evidence** | ENT-002; SEC-004; UC-001 paso 5; design/ADR-DRAFT-003 |
| **Existing mitigation** | partial: diseño (borrador) |

#### AUTH-004: El bloqueo por cuenta permite bloquear a otros y no frena el barrido de cuentas

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.2.1 (4.0.3) |
| **CWE** | CWE-307 |
| **Where** | spec/nfr/SECURITY.md:SEC-003 |
| **Threat** | Un atacante puede dejar bloqueado al encargado repitiendo 5 fallos cada 15 min con su correo, y probar una contraseña común contra muchos correos sin llegar al límite |
| **What** | SEC-003 y RN-005 cuentan solo por cuenta existente; correo desconocido sin contador; sin vía de desbloqueo |
| **Fix** | Especificar la respuesta al barrido entre cuentas y si el encargado puede desbloquear |
| **Evidence** | SEC-003; RN-005; UC-001 E2/E3 |
| **Existing mitigation** | partial: bloqueo por cuenta |

#### AUTH-005: Política de contraseña: sin máximo ni cambio propio

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.1.1, V2.1.2, V2.1.7 (4.0.3) |
| **CWE** | CWE-521, CWE-620 |
| **Where** | spec/domain/05-INVARIANTS.md:INV-ACC-002 |
| **Threat** | Un atacante puede agotar el servidor con una contraseña enorme, y el encargado conoce la contraseña de cada socio porque ningún socio puede cambiarla |
| **What** | INV-ACC-002 solo fija mínimo 8; sin longitud máxima, sin rechazo de contraseñas comunes, sin operación de cambio propio ni cambio forzado de la inicial |
| **Fix** | Especificar máximo, qué contraseñas se rechazan y si el socio cambia la suya |
| **Evidence** | API-001-03/05; LIM-002; PERMISSIONS-MATRIX (socio) |
| **Existing mitigation** | partial: mínimo 8 |


### SEC-CAT-03: Insufficient authorization

#### AUTHZ-001: Operaciones del sistema (API-003-07/08) sin quién puede invocarlas

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-03: Insufficient authorization |
| **OWASP ASVS** | V4.1.1, V4.1.3 (4.0.3) |
| **CWE** | CWE-862 |
| **Where** | spec/contracts/PERMISSIONS-MATRIX.md |
| **Threat** | Un socio autenticado puede ejecutar purgarRegistrosAntiguos (borrado irreversible) porque ningún rol la tiene y nada niega a los demás |
| **What** | Tras quitar API-003-07/08 de la matriz (CON-005) no queda dicho cómo se dispara ni aísla al actor «sistema» |
| **Fix** | Especificar que solo el planificador interno las dispara y que cualquier rol las deniega |
| **Evidence** | API-003-08; INV-LOA-006; PERMISSIONS-MATRIX |
| **Existing mitigation** | none |

#### AUTHZ-002: Matriz sin denegar por defecto y cuentas privilegiadas sin alcance

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-03: Insufficient authorization |
| **OWASP ASVS** | V4.1.5, V4.2.x (4.0.3) |
| **CWE** | CWE-285 |
| **Where** | spec/contracts/PERMISSIONS-MATRIX.md; spec/contracts/API-acceso.md:API-001-04/05 |
| **Threat** | El encargado puede restablecer la contraseña de la junta o dar de baja al último encargado, dejando al club sin gestión, porque cuentaId vale para cualquier rol y la matriz no dice «lo no listado se deniega» |
| **What** | La matriz no declara deny-by-default; API-001-04/05 no limitan el rol del destino (E_SIN_PERMISO por rol en 003-01/02 y 002-02/03: ver SIL-001 de AUDIT-BASELINE) |
| **Fix** | Declarar deny-by-default y qué roles pueden ser destino de baja y restablecimiento |
| **Evidence** | PERMISSIONS-MATRIX; API-001-04/05; INV-ACC-007 |
| **Existing mitigation** | partial: INV-ACC-008 |


### SEC-CAT-04: Unprotected data

#### DATA-001: Sin exigencia de transporte protegido en la spec

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-04: Unprotected data |
| **OWASP ASVS** | V8.3.x, V9.1.1 (4.0.3) |
| **CWE** | CWE-319 |
| **Where** | spec/contracts/API-acceso.md:Transport |
| **Threat** | Un atacante en la red del club puede leer correo, contraseña y sesión si el despliegue no usa cifrado, porque ninguna spec lo exige |
| **What** | Transport remite a design/OPERATION-MAPPING.md, que no existe; SEC-001..007 solo cubren el almacén. design/TECHNICAL-DESIGN.md lo prevé (HTTPS por proxy) como borrador |
| **Fix** | Añadir un control SEC que exija canal cifrado y su fallo observable |
| **Evidence** | API-001-01 (contrasena en entrada); ADR-002; nfr/SECURITY.md |
| **Existing mitigation** | partial: diseño (borrador) |

#### DATA-002: Sin política de logs ni protección en reposo en la spec

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-04: Unprotected data |
| **OWASP ASVS** | V8.3.4, V7.1.1 (4.0.3) |
| **CWE** | CWE-532, CWE-311 |
| **Where** | spec/nfr/SECURITY.md |
| **Threat** | Quien lea registros o copias del almacén obtiene correos, nombres y sesiones porque nada prohíbe contraseña o id de sesión en logs ni exige proteger copias |
| **What** | SEC-002 cubre salidas de API, no registros; ADR-002 difiere la tecnología del almacén; el diseño acepta no cifrar en reposo sin cubrir copias |
| **Fix** | Especificar qué nunca se registra y la protección de datos personales y sesiones en reposo y copias |
| **Evidence** | SEC-001/002/006; ADR-002; E_ALMACEN_NO_DISPONIBLE |
| **Existing mitigation** | partial: SEC-001/002 |


### SEC-CAT-05: Missing input validation

#### INPUT-001: Entradas de texto sin longitud máxima ni tratamiento al mostrarse

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-05: Missing input validation |
| **OWASP ASVS** | V5.1.3, V5.3.3 (4.0.3) |
| **CWE** | CWE-20, CWE-79 |
| **Where** | spec/domain/03-VALUE-OBJECTS.md; RN-021 |
| **Threat** | Un nombre con script o de megabytes se muestra a todos («Hola, {nombre}», listas) porque solo se exige no vacío |
| **What** | RN-021 solo rechaza vacío o correo sin formato; sin máximos de nombre, correo, contraseña |
| **Fix** | Especificar longitudes máximas y que el texto de usuario se muestra siempre como texto |
| **Evidence** | UC-001 paso 6; API-001-03; RN-021 |
| **Existing mitigation** | partial: formato de correo |


### SEC-CAT-06: Weak/incomplete crypto

#### CRYPTO-001: «Hash con sal» sin familia de algoritmo ni coste en la spec

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-06: Weak/incomplete crypto |
| **OWASP ASVS** | V2.4.1, V2.4.2, V6.2.x (4.0.3) |
| **CWE** | CWE-916 |
| **Where** | spec/nfr/SECURITY.md:SEC-001 |
| **Threat** | Quien obtenga el almacén puede romper contraseñas deprisa si se elige un hash rápido, porque la spec admite cualquiera con sal |
| **What** | SEC-001 e INV-ACC-003 no nombran familia (derivación lenta), parámetro de coste ni comparación en tiempo constante. El diseño propone scrypt (borrador) |
| **Fix** | Especificar hash de derivación lenta con coste mínimo y comparación en tiempo constante |
| **Evidence** | SEC-001; INV-ACC-003; design/TECHNICAL-DESIGN.md |
| **Existing mitigation** | partial: sal y diseño (borrador) |


### SEC-CAT-07: Incomplete incident response

#### INCIDENT-001: Sin eventos de seguridad ni traza de auditoría

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-07: Incomplete incident response |
| **OWASP ASVS** | V7.1.x, V7.2.x (4.0.3) |
| **CWE** | CWE-778 |
| **Where** | spec/nfr/SECURITY.md |
| **Threat** | Nadie detecta un barrido de contraseñas ni quién restableció una contraseña o marcó una multa como pagada porque no se especifican eventos, campos ni retención |
| **What** | SECURITY.md no tiene filas de auditoría; API-001-05, 001-04 y 003-03 cambian estado sensible sin autor ni fecha |
| **Fix** | Especificar la lista de eventos (fallos, bloqueos, restablecer, baja, pago), sus campos y retención |
| **Evidence** | API-001-05; API-003-03; SEC-003 |
| **Existing mitigation** | none |

#### INCIDENT-002: Sin runbook de respuesta a incidentes ni de brecha de datos

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-07: Incomplete incident response |
| **OWASP ASVS** | V7.x (4.0.3) |
| **CWE** | CWE-223 |
| **Where** | spec/ (no existe runbooks/) |
| **Threat** | Una fuga de correos tarda en detectarse y notificarse porque no hay pasos ni responsables |
| **What** | No hay runbooks/RB-*.md; sí se guardan datos personales (SEC-006) |
| **Fix** | Especificar quién actúa y en qué plazo ante una brecha (RGPD art. 33) |
| **Evidence** | SEC-006; REQ-NF-001 |
| **Existing mitigation** | none |


### SEC-CAT-08: Incomplete regulatory compliance

#### COMPLY-001: Datos de cuentas en Baja sin plazo de conservación

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-08: Incomplete regulatory compliance |
| **OWASP ASVS** | n/a (4.0.3) |
| **CWE** | CWE-359; RGPD art. 5.1.e y 17 |
| **Where** | spec/nfr/LIMITS.md:LIM-004 |
| **Threat** | Un exsocio ve sus datos conservados sin límite porque RETENTION_YEARS solo borra préstamos y multas, no nombre ni correo de la cuenta |
| **What** | INV-LOA-006 no cubre ENT-001; REQ-NF-001 pide guardar lo mínimo (Q-security-auditor-001) |
| **Fix** | Decidir y especificar el plazo de borrado de la cuenta en Baja |
| **Evidence** | LIM-004; INV-ACC-006; ENT-001 |
| **Existing mitigation** | partial: retención de préstamos y multas |

#### COMPLY-002: Derechos de acceso/rectificación e información sin caso de uso

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-08: Incomplete regulatory compliance |
| **OWASP ASVS** | n/a (4.0.3) |
| **CWE** | CWE-359; RGPD art. 13, 15, 16 |
| **Where** | spec/use-cases/ (sin UC) |
| **Threat** | Un socio no puede ejercer sus derechos sobre nombre y correo porque ningún UC ni texto informativo los contempla |
| **What** | Hay datos personales (SEC-006) pero ningún UC de acceso, rectificación ni aviso de tratamiento |
| **Fix** | Especificar cómo se atienden (p. ej. vía encargado) y dónde se informa |
| **Evidence** | SEC-006; REQ-NF-001; UC-002 |
| **Existing mitigation** | none |


### SEC-CAT-09: Missing security tests

#### STEST-001: Faltan negativos de rol y de salida de contraseña

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-09: Missing security tests |
| **OWASP ASVS** | n/a (4.0.3) |
| **CWE** | CWE-1053 |
| **Where** | spec/tests/BDD-UC-005.md, spec/tests/BDD-UC-006.md |
| **Threat** | Un cambio puede abrir entregar o devolver a un socio sin que ningún escenario falle, porque no tienen caso de rol no permitido |
| **What** | 0 menciones de E_SIN_PERMISO/E_NO_AUTENTICADO en BDD-UC-005/006; SEC-002 sin escenario que busque la contraseña en salidas; sin escenario de sesión tras restablecer (AUTH-002) |
| **Fix** | Un escenario por operación restringida con rol equivocado y uno por control SEC sin cubrir |
| **Evidence** | SEC-002; SEC-005; UC-005/006 |
| **Existing mitigation** | partial: otros UC sí lo tienen |


### SEC-CAT-10: Security decision without ADR

#### SADR-001: Autenticación, sesión y hash sin ADR aceptado

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) |
| **Status** | new |
| **Category** | SEC-CAT-10: Security decision without ADR |
| **OWASP ASVS** | V1.1.1 (4.0.3) |
| **CWE** | CWE-1059 |
| **Where** | spec/adr/ |
| **Threat** | Sin ADR aceptado, la decisión de sesión y hash queda solo en borradores y puede cambiar sin registrar amenaza y riesgo residual |
| **What** | Solo hay ADR-001/002 (reloj, almacén); design/ADR-DRAFT-003 está pendiente de revisión |
| **Fix** | Aceptar un ADR de autenticación y sesión con amenaza y consecuencias |
| **Evidence** | SEC-001/003/004; ADR-001/002 |
| **Existing mitigation** | partial: borrador de diseño |

## Remediation

Findings are fixed through `/sdd-req-change` (one CR per finding or group; the CR's `Refs:` cites the finding IDs).
Order: P0 before implementation -> P1 -> P2 backlog -> P3 continuous improvement. Handed to req-change: none yet (lo decide la persona).
- P0: ninguno.
- P1: AUTH-001, AUTH-002, AUTHZ-001, INCIDENT-001.
- Preguntas abiertas: Q-security-auditor-001 (COMPLY-001), Q-security-auditor-002 (AUTH-001).

## Baseline

| ID | Title | Status | Decided by / date | Re-evaluate on | Reason |
|---|---|---|---|---|---|
