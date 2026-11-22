# Security Audit: material-montana12

> Date: 2026-11-22 · Spec version: 1.0 · Security docs analysed: 9 (SECURITY.md, LIMITS.md, PERMISSIONS-MATRIX, API-cuentas, INV-SEC/SOC, ADR-003, CLARIFICATIONS, VALUE-REGISTRY, REQ-NF-001/003) · Total docs: 64 · OWASP ASVS 4.0.3

## Security Posture Scorecard

| # | Dimension | Score | Grade | Findings (C/H/M/L) |
|---|---|---|---|---|
| D1 | Authentication Completeness | 70 | C | 0/1/3/0 |
| D2 | Authorization | 80 | B | 0/1/1/0 |
| D3 | Data Protection | 80 | B | 0/1/1/0 |
| D4 | Input Validation | 95 | A | 0/0/1/0 |
| D5 | Cryptographic Rigor | 83 | B | 0/1/0/1 |
| D6 | Incident Readiness | 80 | B | 0/1/1/0 |
| D7 | Regulatory Compliance | 93 | A | 0/0/1/1 |
| D8 | Security Test Coverage | 93 | A | 0/0/1/1 |
| D9 | Threat Model Coverage | 95 | A | 0/0/1/0 |
| D10 | Security Decision Documentation | 95 | A | 0/0/1/0 |
| **GLOBAL** | Weighted average | **84** | **B** | **0/5/11/3** |

Weakest dimensions: D1 Authentication (70), D2 Authorization, D3 Data Protection and D6 Incident Readiness (80).
ASVS chapters assessed: V1, V2, V3, V4, V5, V6, V7, V8, V12, V13 → 8 of 10 with an applicable spec element (V7 logging and V12 files have none and no `Not applicable` row) → `owasp_coverage` 80%

## Summary by Category

| Category | Total | Crítico (P0) | Alto (P1) | Medio (P2) | Bajo (P3) |
|---|---|---|---|---|---|
| SEC-CAT-02 | 4 | 0 | 1 | 3 | 0 |
| SEC-CAT-03 | 2 | 0 | 1 | 1 | 0 |
| SEC-CAT-04 | 2 | 0 | 1 | 1 | 0 |
| SEC-CAT-05 | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-06 | 2 | 0 | 1 | 0 | 1 |
| SEC-CAT-07 | 2 | 0 | 1 | 1 | 0 |
| SEC-CAT-08 | 2 | 0 | 0 | 1 | 1 |
| SEC-CAT-09 | 2 | 0 | 0 | 1 | 1 |
| SEC-CAT-01 | 1 | 0 | 0 | 1 | 0 |
| SEC-CAT-10 | 1 | 0 | 0 | 1 | 0 |
| **TOTAL** | 19 | 0 | 5 | 11 | 3 |

## Baseline Delta

Compared against: N/A (first audit) — new 19 · persistent 0 · regression 0 · resolved since last run 0 · excluded by baseline 0

## Threat Surface

| Surface | Elements | Covered | Uncovered |
|---|---|---|---|
| Operations / endpoints | 22 (API-001..004; 1 anónima, 3 de sistema/lectura) | 22 con rol en la matriz | 2 de sistema sin definición de invocación (AUTHZ-002) |
| Sensitive fields | 5 (email, passwordHash, failedLogins/lockedUntil, sesión, historial) | 3 | sesión y registro/mensajes (CRYPTO-002, DATA-002) |
| External integrations | 0 (sin integraciones; REQ-C) | 0 | n/a; no hay fila `Not applicable` (V12) |
| Trust boundaries | 3 (navegador→servidor, servidor→almacén compartido, sistema→almacén) | 1 (rol/sesión) | transporte y almacén (DATA-001, THR-001) |

## Traceability

| Chain | Total | Complete | Incomplete |
|---|---|---|---|
| Security REQ / SEC row → INV or ADR | 9 (REQ-NF-001/003 + SPEC-SEC-001..007) | 7 a INV | 2 sin ADR (SADR-001) |
| Security REQ / SEC row → UC → BDD | 9 | 7 | 2 (sesión tras baja/restablecer, STEST-001; SPEC-SEC-007 sin escenario propio) |
| Security ADR → runbook (when an operation is required) | 0 ADR de seguridad | 0 | n/a (INCIDENT-002) |

## Findings by Category

### SEC-CAT-01: Threats without model

#### THR-001: No hay modelo de amenazas ni fronteras de confianza documentadas

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-01: Threats without model |
| **OWASP ASVS** | V1.1.2 / V1.1.3 (4.0.3) |
| **CWE** | CWE-1008 |
| **Where** | spec/nfr/SECURITY.md; spec/README.md |
| **Threat** | Cualquier amenaza no listada (almacén compartido entre dispositivos, REQ-NF-002; cuentas de gestión comprometidas) carece de análisis |
| **What** | SECURITY.md lista controles sin amenazas ni fronteras (navegador → servidor → almacén compartido) |
| **Fix** | Especificar actores, fronteras y amenazas principales (con el almacén compartido como activo) |
| **Evidence** | REQ-NF-002, SECURITY.md, API-001-08 |
| **Existing mitigation** | Parcial: controles SPEC-SEC-001..007 |

### SEC-CAT-02: Incomplete authentication

#### AUTH-001: El bloqueo de cuenta revela qué correos existen y permite bloquear a otro

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.2.1 / V2.5.2 (4.0.3) |
| **CWE** | CWE-204 |
| **Where** | spec/use-cases/UC-001-entrar.md E1/E2; spec/CLARIFICATIONS.md RN-007 |
| **Threat** | Un anónimo puede distinguir un correo registrado de uno desconocido (el segundo intento tras 5 fallos devuelve `E_CUENTA_BLOQUEADA` solo si existe) y puede bloquear 15 min la cuenta del encargado con 5 fallos a propósito, impidiendo toda la gestión |
| **What** | RN-007 uniformiza `E_CREDENCIALES` pero RN-001/INV-SOC-004 devuelven un error distinto en bloqueo y un correo desconocido nunca se bloquea; no hay vía de desbloqueo para el encargado |
| **Fix** | Especificar qué respuesta ve quien consulta una cuenta bloqueada o inexistente (indistinguible) y qué ocurre cuando se bloquea la única cuenta de gestión |
| **Evidence** | UC-001 (operación pública API-001-01), SPEC-SEC-005, RN-001, RN-007 |
| **Existing mitigation** | Parcial: bloqueo por cuenta (SPEC-SEC-005) y mismo error para baja/desconocido |

#### AUTH-002: Sin límite de intentos por origen: password spraying y fuerza bruta a correos desconocidos

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.2.1 (4.0.3) |
| **CWE** | CWE-307 |
| **Where** | spec/nfr/LIMITS.md SPEC-LIM-001/002 |
| **Threat** | Un atacante prueba pocas contraseñas comunes en todas las cuentas (menos de `LOGIN_MAX_FAILURES` por cuenta) sin que nada lo frene, porque el único contador es por cuenta y los correos desconocidos no cuentan |
| **What** | Solo hay control por cuenta; falta el límite de ritmo de la operación pública API-001-01 por origen o global |
| **Fix** | Indicar si debe haber un límite de intentos por origen/tiempo para `login` y cuál es el valor (a VALUE-REGISTRY) |
| **Evidence** | API-001-01 (anónimo), SPEC-LIM-001, RN-007 |
| **Existing mitigation** | Parcial: bloqueo por cuenta |

#### AUTH-003: La contraseña provisional no caduca y las sesiones vivas sobreviven al restablecimiento

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V2.1.1 / V3.3.1 (4.0.3) |
| **CWE** | CWE-613 |
| **Where** | spec/use-cases/UC-005-restablecer-contrasena.md; spec/domain/05-INVARIANTS.md INV-SOC-102 |
| **Threat** | Quien conozca o robe la provisional (la escribe el encargado y viaja al socio por canal no definido) entra sin límite de tiempo; con una sesión robada sigue dentro tras el restablecimiento |
| **What** | INV-SOC-102 solo dice que la contraseña anterior no autentica; no cierra las sesiones abiertas (a diferencia de la baja, RN-026) y la provisional no tiene vigencia |
| **Fix** | Especificar vigencia de la provisional y si restablecer o cambiar la contraseña invalida las sesiones existentes de esa cuenta |
| **Evidence** | UC-003, UC-005, UC-004, RN-026 |
| **Existing mitigation** | Parcial: obligación de cambiarla (INV-SOC-006) |

#### AUTH-004: Ciclo de vida de sesión incompleto: sin identificador nuevo al entrar, sin caducidad absoluta, sin atributos de la cookie

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-02: Incomplete authentication |
| **OWASP ASVS** | V3.2.1 / V3.3.2 / V3.4.1 (4.0.3) |
| **CWE** | CWE-384 |
| **Where** | spec/nfr/SECURITY.md SPEC-SEC-006; spec/use-cases/UC-001-entrar.md E5 |
| **Threat** | Un atacante que fije o robe un identificador de sesión lo mantiene activo indefinidamente renovándolo con actividad; E5 permite varias sesiones simultáneas sin tope |
| **What** | Solo hay caducidad por inactividad (INV-SOC-005) y cierre en servidor; no se pide identificador nuevo al autenticar, caducidad absoluta, límite de sesiones ni atributos de transporte de la sesión |
| **Fix** | Especificar la renovación del identificador al entrar, una caducidad absoluta y las propiedades de la sesión frente al navegador |
| **Evidence** | SPEC-SEC-006, INV-SOC-005, UC-001 |
| **Existing mitigation** | Parcial: inactividad y cierre en servidor (RN-002/003) |

### SEC-CAT-03: Insufficient authorization

#### AUTHZ-001: El encargado puede restablecer o dar de baja cuentas que no son de socio

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-03: Insufficient authorization |
| **OWASP ASVS** | V4.1.3 / V4.2.1 (4.0.3) |
| **CWE** | CWE-269 |
| **Where** | spec/contracts/API-cuentas.md API-001-05/-06; spec/contracts/PERMISSIONS-MATRIX.md |
| **Threat** | El encargado restablece la contraseña de la cuenta de la junta (o de otro encargado), entra con ella y lee historiales de socios que RN-028 reserva solo a la junta; o da de baja esas cuentas |
| **What** | API-001-05/-06 reciben un `accountId` cualquiera; RN-027 y UC-005/006 hablan de «socio» pero ningún invariante limita el rol de la cuenta destino |
| **Fix** | Especificar sobre qué roles puede actuar cada operación de gestión de cuentas (y el error si la cuenta destino no es socio) |
| **Evidence** | API-001-05, API-001-06, RN-005, RN-028, INV-SEC-003 |
| **Existing mitigation** | Parcial: solo el encargado puede invocarlas |

#### AUTHZ-002: Matriz sin regla de denegar por defecto ni definición de «sistema»

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-03: Insufficient authorization |
| **OWASP ASVS** | V4.1.5 / V4.1.1 (4.0.3) |
| **CWE** | CWE-862 |
| **Where** | spec/contracts/PERMISSIONS-MATRIX.md |
| **Threat** | Una operación nueva o una invocación externa de `purgeOldRecords`/`authorize` (rol «sistema») podría aceptarse sin sesión de usuario |
| **What** | La matriz lista a «sistema» sin decir que no es invocable desde la web ni que todo lo no listado se deniega |
| **Fix** | Añadir la regla de denegar lo no listado y que las operaciones de sistema no se ofrecen a ningún usuario |
| **Evidence** | PERMISSIONS-MATRIX, API-002-07, UC-019 |
| **Existing mitigation** | Parcial: INV-SEC-001..003 por rol |

### SEC-CAT-04: Unprotected data

#### DATA-001: No se especifica protección de los datos en tránsito (credenciales)

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-04: Unprotected data |
| **OWASP ASVS** | V9.1.1 / V8.3.4 (4.0.3) |
| **CWE** | CWE-319 |
| **Where** | spec/contracts/API-cuentas.md (Transport); spec/nfr/SECURITY.md |
| **Threat** | Un atacante en la red del club o wifi lee correo y contraseña de `login` y de la contraseña provisional en tránsito |
| **What** | Los contratos remiten a `design/OPERATION-MAPPING.md`, que no existe, y SECURITY.md no pide cifrado de transporte; INV-SOC-003 solo cubre el dato guardado |
| **Fix** | Especificar el requisito de transporte cifrado para toda operación y la política sobre redirección desde conexión no cifrada |
| **Evidence** | API-001-01, API-001-03, UC-001, design/ (solo QUALITY-ATTRIBUTES.md) |
| **Existing mitigation** | none |

#### DATA-002: Sin regla sobre qué datos pueden aparecer en errores, avisos y registros

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-04: Unprotected data |
| **OWASP ASVS** | V7.1.1 / V8.3.4 (4.0.3) |
| **CWE** | CWE-532 |
| **Where** | spec/domain/03-VALUE-OBJECTS.md VO-010; spec/nfr/SECURITY.md |
| **Threat** | Contraseñas (incluida la provisional) o datos de otro socio acaban en mensajes de error o registros del servidor accesibles a personal no autorizado |
| **What** | SPEC-SEC-001/004 cubren respuestas y almacenamiento, no mensajes de error ni trazas |
| **Fix** | Especificar los campos que nunca se registran ni se muestran (contraseña, hash, identificador de sesión) |
| **Evidence** | SPEC-SEC-004, VO-010, API-001-01/-03/-05 |
| **Existing mitigation** | Parcial: respuestas sin datos ajenos |

### SEC-CAT-05: Missing input validation

#### INPUT-001: Entradas de texto sin longitud máxima ni juego de caracteres: nombre, correo, búsqueda, nombre de material

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-05: Missing input validation |
| **OWASP ASVS** | V5.1.3 / V5.1.4 / V5.3.3 (4.0.3) |
| **CWE** | CWE-20 |
| **Where** | spec/domain/03-VALUE-OBJECTS.md VO-002/003; spec/contracts/API-cuentas.md API-001-04/-07; API-003-01 |
| **Threat** | Un encargado o atacante autenticado guarda nombres de 1 MB o con marcado que se muestra a la junta/otros usuarios (XSS almacenado); la búsqueda de la junta (RN-019) recibe consultas arbitrarias |
| **What** | VO-002 solo pide «formato correo», `E_SOCIO_DATOS_INVALIDOS` dice «nombre vacío»; ni nombre, contraseña, `query` ni nombre de tipo tienen máximo; no se habla de codificación de salida |
| **Fix** | Especificar longitud máxima y caracteres admitidos por campo de texto libre y la salida segura al mostrarlos |
| **Evidence** | API-001-04, API-001-07, API-003-01, UC-018, VO-002 |
| **Existing mitigation** | Parcial: formato del correo y unicidad |

### SEC-CAT-06: Weak/incomplete crypto

#### CRYPTO-001: El almacenamiento de contraseñas dice «hash con sal» sin exigir un algoritmo lento de derivación

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-06: Weak/incomplete crypto |
| **OWASP ASVS** | V2.4.1 / V2.4.2 / V6.2.1 (4.0.3) |
| **CWE** | CWE-916 |
| **Where** | spec/domain/05-INVARIANTS.md INV-SOC-003; spec/nfr/SECURITY.md SPEC-SEC-004 |
| **Threat** | Si se filtra el almacén compartido, un atacante recupera las contraseñas con fuerza bruta rápida si se implementó un hash con sal pero barato, y la spec lo da por válido |
| **What** | SPEC-SEC-004 solo se mide con «ninguna contraseña legible»; no se nombra la clase de algoritmo (derivación de claves adaptable con coste) ni cómo evoluciona el coste |
| **Fix** | Especificar la familia/parámetros mínimos del hash de contraseña y la política de migración si cambian |
| **Evidence** | INV-SOC-003, SPEC-SEC-004, REQ-NF-001, UC-003..005 |
| **Existing mitigation** | Parcial: hash con sal |

#### CRYPTO-002: Aleatoriedad del identificador de sesión y de la contraseña provisional sin especificar

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) |
| **Status** | new |
| **Category** | SEC-CAT-06: Weak/incomplete crypto |
| **OWASP ASVS** | V3.2.2 / V2.3.1 (4.0.3) |
| **CWE** | CWE-330 |
| **Where** | spec/nfr/SECURITY.md SPEC-SEC-006 |
| **Threat** | Un atacante adivina identificadores de sesión previsibles |
| **What** | No se exige origen criptográficamente seguro ni longitud mínima del identificador |
| **Fix** | Especificar el requisito de imprevisibilidad y longitud del identificador |
| **Evidence** | SPEC-SEC-006, INV-SOC-005 |
| **Existing mitigation** | none |

### SEC-CAT-07: Incomplete incident response

#### INCIDENT-001: Sin registro de auditoría de las acciones de gestión

| Field | Value |
|---|---|
| **Severity** | Alto (P1) |
| **Status** | new |
| **Category** | SEC-CAT-07: Incomplete incident response |
| **OWASP ASVS** | V7.2.1 / V7.1.3 (4.0.3) |
| **CWE** | CWE-778 |
| **Where** | spec/use-cases/UC-013-marcar-multa-pagada.md; spec/contracts/API-multas.md API-004-02; API-cuentas.md API-001-05/-06 |
| **Threat** | El encargado marca multas como pagadas, restablece contraseñas o da de baja sin que quede quién, cuándo ni qué; repudio y fraude indetectables (`paidOn` solo guarda el día) |
| **What** | SPEC-SEC-001..007 no incluyen ningún control de auditoría y no hay entidad de registro en 02-ENTITIES |
| **Fix** | Especificar qué acciones se registran (autor, fecha-hora, objeto, resultado), su protección frente a modificación y su conservación |
| **Evidence** | UC-013, UC-005, UC-006, UC-010, UC-011, SPEC-SEC, ENT-004 |
| **Existing mitigation** | none |

#### INCIDENT-002: Sin catálogo de eventos de seguridad, alertas ni procedimiento de respuesta

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-07: Incomplete incident response |
| **OWASP ASVS** | V7.1.1 / V7.2.2 (4.0.3) |
| **CWE** | CWE-223 |
| **Where** | spec/nfr/SECURITY.md; spec/ (no hay runbooks/) |
| **Threat** | Una oleada de fallos de entrada o bloqueos pasa inadvertida al encargado hasta que los socios se quejan |
| **What** | Los fallos y bloqueos de INV-SOC-004 no se definen como eventos ni se notifican; no hay runbook |
| **Fix** | Especificar los eventos de seguridad (fallos, bloqueos, accesos denegados), a quién se avisan y el procedimiento ante sospecha de cuenta comprometida |
| **Evidence** | INV-SOC-004, UC-001, RN-001 |
| **Existing mitigation** | none |

### SEC-CAT-08: Incomplete regulatory compliance

#### COMPLY-001: Datos personales de cuentas de baja sin plazo de conservación

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-08: Incomplete regulatory compliance |
| **OWASP ASVS** | — (4.0.3) |
| **CWE** | CWE-359 |
| **Where** | spec/adr/ADR-003-baja-logica.md; spec/domain/05-INVARIANTS.md INV-SOC-009, INV-RES-011 |
| **Threat** | Nombre y correo de ex-socios permanecen indefinidamente aunque sus préstamos se depuren a los 3 años (RGPD art. 5.1.e y 17), exponiéndolos en cualquier filtración |
| **What** | RN-005/ADR-003 deciden la baja lógica y la no reutilización del correo, pero ningún documento acota la conservación de los datos personales de la cuenta; REQ-NF-003 habla de «préstamos y multas» |
| **Fix** | Decidir el plazo o la excepción documentada (ver pregunta Q-security-auditor-001) |
| **Evidence** | REQ-NF-003, ADR-003, RN-005, RN-021 |
| **Existing mitigation** | Parcial: depuración de préstamos y multas cerrados |

#### COMPLY-002: Sin casos de uso de derechos del interesado ni aviso de tratamiento

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) |
| **Status** | new |
| **Category** | SEC-CAT-08: Incomplete regulatory compliance |
| **OWASP ASVS** | — (4.0.3) |
| **CWE** | CWE-359 |
| **Where** | spec/use-cases/ (UC-001..019) |
| **Threat** | Un socio no puede acceder a sus datos, rectificarlos ni pedir su supresión por un cauce definido (RGPD arts. 13, 15-17) |
| **What** | Ningún UC cubre acceso, rectificación o supresión; solo existe baja iniciada por el encargado (UC-006) y el socio no cambia su propia contraseña por decisión (RN-025) |
| **Fix** | Indicar si se cubren por vía manual del encargado o con un UC, y si se muestra un aviso de tratamiento |
| **Evidence** | REQ-NF-003, UC-006, RN-025 |
| **Existing mitigation** | Parcial: minimización (INV-SOC-009) |

### SEC-CAT-09: Missing security tests

#### STEST-001: Sin escenario BDD de cierre de sesión por baja ni de sesión tras restablecer

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-09: Missing security tests |
| **OWASP ASVS** | V3.3.1 (4.0.3) |
| **CWE** | CWE-613 |
| **Where** | spec/tests/BDD-UC-006.md; spec/tests/BDD-UC-005.md |
| **Threat** | Una regresión deja viva la sesión de un socio dado de baja y nadie lo detecta |
| **What** | RN-026 (UC-006) no aparece en ningún escenario de BDD-UC-006; no hay negativo de sesión en BDD-UC-005 |
| **Fix** | Añadir los escenarios negativos de sesión (baja y restablecimiento) |
| **Evidence** | RN-026, INV-SOC-102, BDD-UC-005/006 |
| **Existing mitigation** | Parcial: AC-006 cubren impedimentos |

#### STEST-002: Sin pruebas de propiedad para validación de entradas ni para denegar lo no listado

| Field | Value |
|---|---|
| **Severity** | Bajo (P3) |
| **Status** | new |
| **Category** | SEC-CAT-09: Missing security tests |
| **OWASP ASVS** | V5.1.1 (4.0.3) |
| **CWE** | CWE-1286 |
| **Where** | spec/tests/PROPERTY-TESTS.md |
| **Threat** | Entradas límite (longitudes, caracteres) pasan sin ser probadas |
| **What** | PROPERTY-TESTS no incluye propiedades de seguridad de entrada ni de la matriz de permisos |
| **Fix** | Añadir propiedades sobre longitud/caracteres (tras INPUT-001) y sobre la matriz |
| **Evidence** | INPUT-001, AUTHZ-002, PROPERTY-TESTS |
| **Existing mitigation** | none |

### SEC-CAT-10: Security decision without ADR

#### SADR-001: Sin ADR de decisiones de seguridad (autenticación, sesión, almacenamiento de contraseñas, autorización)

| Field | Value |
|---|---|
| **Severity** | Medio (P2) |
| **Status** | new |
| **Category** | SEC-CAT-10: Security decision without ADR |
| **OWASP ASVS** | V1.2.1 (4.0.3) |
| **CWE** | CWE-1059 |
| **Where** | spec/adr/ (ADR-001..005) |
| **Threat** | La decisión de bloqueo, caducidad y hash queda sin consecuencias ni alternativas y puede revertirse sin que nadie lo note |
| **What** | Los cinco ADR tratan disponibilidad, estados, baja lógica, multas e idempotencia; ninguno de seguridad (los controles viven solo en RN) |
| **Fix** | Registrar en ADR la estrategia de autenticación/sesión, el almacenamiento de contraseñas y el modelo de autorización |
| **Evidence** | RN-001..003, INV-SOC-003, spec/adr/ |
| **Existing mitigation** | none |

## Remediation

Findings are fixed through `/sdd-req-change` (one CR per finding or group; the CR's `Refs:` cites the finding IDs). Order: P0 before implementation → P1 → P2 backlog → P3 continuous improvement. Handed to req-change: none yet (a human decides each one). Open question: Q-security-auditor-001 (COMPLY-001).
- P0: ninguno
- P1: AUTH-001 — El bloqueo de cuenta revela qué correos existen y permite bloquear a otro
- P1: AUTHZ-001 — El encargado puede restablecer o dar de baja cuentas que no son de socio
- P1: DATA-001 — No se especifica protección de los datos en tránsito (credenciales)
- P1: CRYPTO-001 — El almacenamiento de contraseñas dice «hash con sal» sin exigir un algoritmo lento de derivación
- P1: INCIDENT-001 — Sin registro de auditoría de las acciones de gestión
- P2: AUTH-002 — Sin límite de intentos por origen: password spraying y fuerza bruta a correos desconocidos
- P2: AUTH-003 — La contraseña provisional no caduca y las sesiones vivas sobreviven al restablecimiento
- P2: AUTH-004 — Ciclo de vida de sesión incompleto: sin identificador nuevo al entrar, sin caducidad absoluta, sin atributos de la cookie
- P2: AUTHZ-002 — Matriz sin regla de denegar por defecto ni definición de «sistema»
- P2: DATA-002 — Sin regla sobre qué datos pueden aparecer en errores, avisos y registros
- P2: INPUT-001 — Entradas de texto sin longitud máxima ni juego de caracteres: nombre, correo, búsqueda, nombre de material
- P2: INCIDENT-002 — Sin catálogo de eventos de seguridad, alertas ni procedimiento de respuesta
- P2: COMPLY-001 — Datos personales de cuentas de baja sin plazo de conservación
- P2: STEST-001 — Sin escenario BDD de cierre de sesión por baja ni de sesión tras restablecer
- P2: THR-001 — No hay modelo de amenazas ni fronteras de confianza documentadas
- P2: SADR-001 — Sin ADR de decisiones de seguridad (autenticación, sesión, almacenamiento de contraseñas, autorización)
- P3: CRYPTO-002 — Aleatoriedad del identificador de sesión y de la contraseña provisional sin especificar
- P3: COMPLY-002 — Sin casos de uso de derechos del interesado ni aviso de tratamiento
- P3: STEST-002 — Sin pruebas de propiedad para validación de entradas ni para denegar lo no listado

## Baseline

| ID | Title | Status | Decided by / date | Re-evaluate on | Reason |
|---|---|---|---|---|---|
